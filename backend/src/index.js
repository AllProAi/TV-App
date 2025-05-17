require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// Import service modules
const whisperService = require('./services/whisperService');
const gptService = require('./services/gptService');
const sessionService = require('./services/sessionService');

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Socket.io setup with namespaces
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Create namespaces
const tvNamespace = io.of('/tv');
const mobileNamespace = io.of('/mobile');
const subtitleNamespace = io.of('/subtitle');
const voiceNamespace = io.of('/voice');
const aiNamespace = io.of('/ai');

// Session storage (in-memory for demo)
const sessions = {};

// Queue for subtitle processing to avoid overlapping requests
const subtitleQueue = {};

// API Routes
app.get('/', (req, res) => {
  res.send('MemoryStream Backend API Running');
});

// Create a new session
app.post('/api/session/create', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      created: new Date(),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      subtitles: [],
      connected: {
        tv: false,
        mobile: []
      }
    };
    
    sessions[sessionId] = session;
    
    // Generate QR code for mobile pairing
    const pairingUrl = `${process.env.MOBILE_APP_URL || 'http://localhost:8081'}?session=${sessionId}`;
    const qrCode = await QRCode.toDataURL(pairingUrl);
    
    res.status(201).json({
      sessionId,
      pairingUrl,
      qrCode,
      expires: session.expires
    });
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session details
app.get('/api/session/:id', (req, res) => {
  const { id } = req.params;
  const session = sessions[id];
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    id: session.id,
    created: session.created,
    expires: session.expires,
    connected: session.connected
  });
});

// Process audio for transcription
app.post('/api/whisper/transcribe', async (req, res) => {
  try {
    const { audioData, sessionId, timestamp } = req.body;
    
    if (!audioData || !sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Process with Whisper
    const transcription = await whisperService.transcribe(audioData);
    
    // Add timestamp if not provided
    if (!timestamp && transcription) {
      transcription.timestamp = Date.now();
    } else if (timestamp) {
      transcription.timestamp = timestamp;
    }
    
    // Add to session subtitles
    session.subtitles.push(transcription);
    
    // Maintain a reasonable history size
    if (session.subtitles.length > 1000) {
      session.subtitles = session.subtitles.slice(-1000);
    }
    
    // Emit to subtitle namespace
    subtitleNamespace.to(sessionId).emit('subtitle:new', {
      sessionId,
      subtitle: transcription
    });
    
    res.json({ success: true, transcription });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

// Process AI query
app.post('/api/gpt/query', async (req, res) => {
  try {
    const { query, sessionId, timestamp } = req.body;
    
    if (!query || !sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Process with GPT
    const response = await gptService.generateResponse(query, session.subtitles, {
      timestamp: timestamp,
      contextWindow: 60 // seconds
    });
    
    // Emit to AI namespace
    aiNamespace.to(sessionId).emit('response:ai', {
      sessionId,
      response
    });
    
    res.json({ success: true, response });
  } catch (error) {
    console.error('AI query error:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

// Search subtitles
app.post('/api/search/subtitles', async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    
    if (!query || !sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Search subtitles
    const results = await gptService.searchSubtitles(query, session.subtitles);
    
    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Subtitle search error:', error);
    res.status(500).json({ error: 'Failed to search subtitles' });
  }
});

// Generate content summary
app.post('/api/gpt/summary', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Generate summary
    const summary = await gptService.generateSummary(session.subtitles);
    
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Socket.io event handlers
tvNamespace.on('connection', (socket) => {
  console.log('TV client connected:', socket.id);
  
  socket.on('join:session', (data) => {
    const { sessionId } = data;
    if (sessions[sessionId]) {
      socket.join(sessionId);
      sessions[sessionId].connected.tv = true;
      console.log(`TV joined session: ${sessionId}`);
      
      // Send current session state
      socket.emit('session:state', {
        id: sessionId,
        subtitleCount: sessions[sessionId].subtitles.length,
        connectedMobileCount: sessions[sessionId].connected.mobile.length
      });
    } else {
      socket.emit('error', { message: 'Invalid session ID' });
    }
  });
  
  socket.on('subtitle:request', async (data) => {
    const { sessionId, audioData, timestamp } = data;
    if (!sessions[sessionId]) {
      socket.emit('error', { message: 'Invalid session ID' });
      return;
    }
    
    try {
      // Check if we're already processing for this timestamp range
      const currentTime = timestamp || Date.now();
      const queueKey = `${sessionId}-${Math.floor(currentTime / 5000)}`; // Group by 5-second chunks
      
      if (subtitleQueue[queueKey]) {
        // Already processing, skip
        return;
      }
      
      // Mark as processing
      subtitleQueue[queueKey] = true;
      
      // Process with Whisper
      const transcription = await whisperService.transcribe(audioData);
      
      // Add timestamp if not provided
      if (!timestamp && transcription) {
        transcription.timestamp = Date.now();
      } else if (timestamp) {
        transcription.timestamp = timestamp;
      }
      
      // Add to session subtitles
      sessions[sessionId].subtitles.push(transcription);
      
      // Maintain a reasonable history size
      if (sessions[sessionId].subtitles.length > 1000) {
        sessions[sessionId].subtitles = sessions[sessionId].subtitles.slice(-1000);
      }
      
      // Emit to subtitle namespace
      subtitleNamespace.to(sessionId).emit('subtitle:new', {
        sessionId,
        subtitle: transcription
      });
      
      // Clear queue status
      delete subtitleQueue[queueKey];
    } catch (error) {
      console.error('Socket subtitle request error:', error);
      socket.emit('error', { message: 'Failed to process audio' });
      
      // Clear queue status even on error
      if (timestamp) {
        delete subtitleQueue[`${sessionId}-${Math.floor(timestamp / 5000)}`];
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('TV client disconnected:', socket.id);
    // Update session connection status
    Object.values(sessions).forEach(session => {
      if (session.connected.tv && socket.rooms.has(session.id)) {
        session.connected.tv = false;
      }
    });
  });
});

mobileNamespace.on('connection', (socket) => {
  console.log('Mobile client connected:', socket.id);
  let currentSessionId = null;
  
  socket.on('join:session', (data) => {
    const { sessionId, deviceInfo } = data;
    if (sessions[sessionId]) {
      socket.join(sessionId);
      currentSessionId = sessionId;
      
      const mobileClient = {
        socketId: socket.id,
        deviceInfo,
        connected: true
      };
      sessions[sessionId].connected.mobile.push(mobileClient);
      console.log(`Mobile joined session: ${sessionId}`);
      
      // Notify TV that mobile client has connected
      tvNamespace.to(sessionId).emit('mobile:connected', { 
        deviceInfo,
        timestamp: Date.now()
      });
      
      // Send current session state
      socket.emit('session:joined', {
        id: sessionId,
        tvConnected: sessions[sessionId].connected.tv,
        subtitleCount: sessions[sessionId].subtitles.length
      });
    } else {
      socket.emit('error', { message: 'Invalid session ID' });
    }
  });
  
  socket.on('command:voice', async (data) => {
    if (!currentSessionId || !sessions[currentSessionId]) {
      socket.emit('error', { message: 'Not connected to any session' });
      return;
    }
    
    try {
      const { audio, text } = data;
      
      // If audio is provided, transcribe first
      let commandText = text;
      if (!text && audio) {
        try {
          const transcription = await whisperService.transcribe(audio);
          commandText = transcription.text;
        } catch (error) {
          console.error('Voice command transcription error:', error);
          socket.emit('error', { message: 'Failed to transcribe voice command' });
          return;
        }
      }
      
      if (!commandText) {
        socket.emit('error', { message: 'No command text available' });
        return;
      }
      
      // Process command
      const command = await gptService.processCommand(commandText);
      
      // Emit command to TV
      tvNamespace.to(currentSessionId).emit('command:voice', command);
      
      // Send response back to mobile
      socket.emit('command:processed', command);
    } catch (error) {
      console.error('Voice command processing error:', error);
      socket.emit('error', { message: 'Failed to process voice command' });
    }
  });
  
  socket.on('remote:control', (data) => {
    if (!currentSessionId || !sessions[currentSessionId]) {
      socket.emit('error', { message: 'Not connected to any session' });
      return;
    }
    
    const { action } = data;
    // Forward remote control action to TV
    tvNamespace.to(currentSessionId).emit('remote:control', action);
  });
  
  socket.on('query:text', async (data) => {
    if (!currentSessionId || !sessions[currentSessionId]) {
      socket.emit('error', { message: 'Not connected to any session' });
      return;
    }
    
    try {
      const { query } = data;
      
      // Process query with GPT
      const response = await gptService.generateResponse(
        query.text, 
        sessions[currentSessionId].subtitles,
        { timestamp: query.timestamp }
      );
      
      // Send response back to mobile
      socket.emit('response:ai', response);
      
      // Also send to TV if query display is enabled
      tvNamespace.to(currentSessionId).emit('query:received', {
        query,
        response
      });
    } catch (error) {
      console.error('Text query processing error:', error);
      socket.emit('error', { message: 'Failed to process query' });
    }
  });
  
  socket.on('search:subtitles', async (data) => {
    if (!currentSessionId || !sessions[currentSessionId]) {
      socket.emit('error', { message: 'Not connected to any session' });
      return;
    }
    
    try {
      const { query } = data;
      
      // Search subtitles
      const results = await gptService.searchSubtitles(
        query, 
        sessions[currentSessionId].subtitles
      );
      
      // Send results back to mobile
      socket.emit('search:results', results);
      
      // Also send to TV
      tvNamespace.to(currentSessionId).emit('search:results', results);
    } catch (error) {
      console.error('Subtitle search error:', error);
      socket.emit('error', { message: 'Failed to search subtitles' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Mobile client disconnected:', socket.id);
    
    // Update session connection status
    if (currentSessionId && sessions[currentSessionId]) {
      const session = sessions[currentSessionId];
      const index = session.connected.mobile.findIndex(m => m.socketId === socket.id);
      
      if (index !== -1) {
        // Remove client
        session.connected.mobile.splice(index, 1);
        
        // Notify TV that mobile client has disconnected
        tvNamespace.to(currentSessionId).emit('mobile:disconnected', { 
          socketId: socket.id,
          timestamp: Date.now()
        });
      }
    }
  });
});

// Voice namespace for streaming audio
voiceNamespace.on('connection', (socket) => {
  console.log('Voice client connected:', socket.id);
  let currentSessionId = null;
  
  socket.on('join:session', (data) => {
    const { sessionId } = data;
    if (sessions[sessionId]) {
      socket.join(sessionId);
      currentSessionId = sessionId;
      console.log(`Voice client joined session: ${sessionId}`);
    }
  });
  
  socket.on('voice:stream', async (data) => {
    if (!currentSessionId) {
      return;
    }
    
    try {
      // Handle real-time voice processing
      const { audio, timestamp } = data;
      
      // Process with Whisper realtime
      const result = await whisperService.transcribeRealtime(audio, currentSessionId);
      
      if (result && result.text) {
        // Process as command if it looks like one
        if (result.text.toLowerCase().includes('pause') ||
            result.text.toLowerCase().includes('play') ||
            result.text.toLowerCase().includes('volume') ||
            result.text.toLowerCase().includes('forward') ||
            result.text.toLowerCase().includes('rewind') ||
            result.text.toLowerCase().includes('search for')) {
          
          // Process command
          const command = await gptService.processCommand(result.text);
          
          if (command.confidence > 0.7) {
            // Emit command to TV
            tvNamespace.to(currentSessionId).emit('command:voice', command);
            
            // Send feedback to voice client
            socket.emit('voice:command', command);
          }
        }
        
        // Send transcription to both TV and mobile
        socket.emit('voice:transcription', result);
        tvNamespace.to(currentSessionId).emit('voice:transcription', result);
      }
    } catch (error) {
      console.error('Voice streaming error:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Voice client disconnected:', socket.id);
  });
});

// Subtitle namespace for handling subtitle streams
subtitleNamespace.on('connection', (socket) => {
  console.log('Subtitle client connected:', socket.id);
  let currentSessionId = null;
  
  socket.on('join:session', (data) => {
    const { sessionId } = data;
    if (sessions[sessionId]) {
      socket.join(sessionId);
      currentSessionId = sessionId;
      console.log(`Subtitle client joined session: ${sessionId}`);
      
      // Send the last 10 subtitles to catch up
      if (sessions[sessionId].subtitles.length > 0) {
        const recentSubtitles = sessions[sessionId].subtitles.slice(-10);
        socket.emit('subtitle:history', {
          sessionId,
          subtitles: recentSubtitles
        });
      }
    }
  });
  
  socket.on('subtitle:request', async (data) => {
    if (!currentSessionId) {
      return;
    }
    
    // Get subtitles for a specific time range
    const { startTime, endTime } = data;
    
    if (sessions[currentSessionId]) {
      const filteredSubtitles = sessions[currentSessionId].subtitles.filter(s => {
        return s.timestamp >= startTime && s.timestamp <= endTime;
      });
      
      socket.emit('subtitle:range', {
        sessionId: currentSessionId,
        subtitles: filteredSubtitles,
        startTime,
        endTime
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Subtitle client disconnected:', socket.id);
  });
});

// AI namespace for query/response handling
aiNamespace.on('connection', (socket) => {
  console.log('AI client connected:', socket.id);
  let currentSessionId = null;
  
  socket.on('join:session', (data) => {
    const { sessionId } = data;
    if (sessions[sessionId]) {
      socket.join(sessionId);
      currentSessionId = sessionId;
      console.log(`AI client joined session: ${sessionId}`);
    }
  });
  
  socket.on('query:text', async (data) => {
    if (!currentSessionId || !sessions[currentSessionId]) {
      socket.emit('error', { message: 'Not connected to any session' });
      return;
    }
    
    try {
      const { query, timestamp } = data;
      
      // Process query with GPT
      const response = await gptService.generateResponse(
        query, 
        sessions[currentSessionId].subtitles,
        { timestamp }
      );
      
      // Send response back
      socket.emit('response:ai', response);
      
      // Also broadcast to all clients in the AI namespace for this session
      socket.to(currentSessionId).emit('response:ai', response);
      
      // And to the TV
      tvNamespace.to(currentSessionId).emit('response:ai', response);
    } catch (error) {
      console.error('AI query error:', error);
      socket.emit('error', { message: 'Failed to process query' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('AI client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MemoryStream backend server running on port ${PORT}`);
}); 