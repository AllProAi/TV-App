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
app.use(express.json());

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
    const pairingUrl = `${process.env.MOBILE_APP_URL || 'https://memorystream-mobile.example.com'}?session=${sessionId}`;
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
    const { audioData, sessionId } = req.body;
    
    if (!audioData || !sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const session = sessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Process with Whisper (placeholder for demo)
    // In actual implementation, this would call whisperService.transcribe()
    const transcription = {
      timestamp: Date.now(),
      text: "This is a placeholder subtitle from Whisper API",
      confidence: 0.95
    };
    
    // Add to session subtitles
    session.subtitles.push(transcription);
    
    // Emit to subtitle namespace
    subtitleNamespace.emit('subtitle:new', {
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
    
    // Get relevant subtitles for context
    const relevantSubtitles = timestamp 
      ? session.subtitles.filter(s => Math.abs(s.timestamp - timestamp) < 30000) // Within 30 seconds
      : session.subtitles.slice(-10); // Last 10 subtitles
    
    // Process with GPT (placeholder for demo)
    // In actual implementation, this would call gptService.generateResponse()
    const response = {
      timestamp: Date.now(),
      text: `This is a placeholder response to: "${query}"`,
      sources: relevantSubtitles.map(s => ({ timestamp: s.timestamp, text: s.text }))
    };
    
    // Emit to AI namespace
    aiNamespace.emit('response:ai', {
      sessionId,
      response
    });
    
    res.json({ success: true, response });
  } catch (error) {
    console.error('AI query error:', error);
    res.status(500).json({ error: 'Failed to process query' });
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
  
  socket.on('join:session', (data) => {
    const { sessionId, deviceInfo } = data;
    if (sessions[sessionId]) {
      socket.join(sessionId);
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
    }
  });
  
  socket.on('command:voice', (data) => {
    const { sessionId, command } = data;
    if (sessions[sessionId]) {
      // Forward command to TV
      tvNamespace.to(sessionId).emit('command:voice', command);
    }
  });
  
  socket.on('remote:control', (data) => {
    const { sessionId, action } = data;
    if (sessions[sessionId]) {
      // Forward remote control action to TV
      tvNamespace.to(sessionId).emit('remote:control', action);
    }
  });
  
  socket.on('query:text', (data) => {
    const { sessionId, query } = data;
    if (sessions[sessionId]) {
      // Process query with GPT (placeholder)
      // In production, this would call gptService.generateResponse()
      const response = {
        timestamp: Date.now(),
        text: `This is a placeholder response to: "${query.text}"`,
        sources: []
      };
      
      // Send response back to mobile
      socket.emit('response:ai', response);
      
      // Also send to TV if query display is enabled
      tvNamespace.to(sessionId).emit('query:received', {
        query,
        response
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Mobile client disconnected:', socket.id);
    // Update session connection status
    Object.values(sessions).forEach(session => {
      const index = session.connected.mobile.findIndex(m => m.socketId === socket.id);
      if (index !== -1) {
        // Remove client or mark as disconnected
        session.connected.mobile.splice(index, 1);
        
        // Notify TV that mobile client has disconnected
        tvNamespace.to(session.id).emit('mobile:disconnected', { 
          socketId: socket.id,
          timestamp: Date.now()
        });
      }
    });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MemoryStream backend server running on port ${PORT}`);
}); 