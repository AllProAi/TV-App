const { Readable } = require('stream');
const { OpenAI } = require('openai');
const WebSocket = require('ws');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Optimized Whisper service with streaming and batch processing
 * for near real-time subtitle generation
 */
class OptimizedWhisperService {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
    
    // Temporary directory for audio chunks
    this.tempDir = path.join(os.tmpdir(), 'memorystream-audio');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    // Subtitle caches for different content
    this.subtitleCache = new Map();
    
    // Active subtitle processing sessions
    this.activeSessions = new Map();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupTempFiles(), 3600000); // 1 hour
  }
  
  /**
   * Initialize a new streaming subtitle session
   * @param {string} sessionId - Session identifier
   * @param {Object} options - Transcription options
   * @returns {Object} Session information
   */
  initSession(sessionId, options = {}) {
    // Create a unique session key if not provided
    const session = {
      id: sessionId || crypto.randomUUID(),
      options: {
        language: options.language || 'en',
        prompt: options.prompt || '',
        chunkDuration: options.chunkDuration || 10, // seconds
        model: options.model || 'whisper-1',
        batchSize: options.batchSize || 3, // process chunks in batches
        maxWorkers: options.maxWorkers || 2, // parallel API calls
      },
      chunks: [],
      subtitles: [],
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      processingQueue: [],
      activeWorkers: 0,
      lastProcessedTime: 0,
      chunkIndex: 0,
      isStreaming: true
    };
    
    this.activeSessions.set(session.id, session);
    
    return { sessionId: session.id };
  }
  
  /**
   * Process audio chunk for streaming transcription
   * @param {string} sessionId - Session identifier
   * @param {Buffer} audioChunk - Audio data
   * @param {number} timestamp - Chunk timestamp (in seconds)
   * @returns {Promise<Object>} Processing status
   */
  async processAudioChunk(sessionId, audioChunk, timestamp) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Update session activity time
    session.lastActivityTime = Date.now();
    
    // Generate a filename for this chunk
    const chunkFilename = path.join(this.tempDir, 
      `chunk_${sessionId}_${session.chunkIndex}_${Date.now()}.wav`);
    session.chunkIndex++;
    
    // Convert the audio chunk to WAV format
    await this.convertAudioToWav(audioChunk, chunkFilename);
    
    // Add the chunk to the processing queue
    const chunk = {
      filename: chunkFilename,
      timestamp,
      index: session.chunkIndex - 1,
      status: 'queued'
    };
    
    session.chunks.push(chunk);
    session.processingQueue.push(chunk);
    
    // Process the queue if we have enough chunks or enough time has passed
    if (session.processingQueue.length >= session.options.batchSize || 
        (timestamp - session.lastProcessedTime > session.options.chunkDuration * 2)) {
      this.processQueue(sessionId);
    }
    
    return { 
      status: 'queued', 
      queueLength: session.processingQueue.length,
      totalChunks: session.chunks.length 
    };
  }
  
  /**
   * Process the queue of audio chunks
   * @param {string} sessionId - Session identifier
   */
  async processQueue(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    // If we're already using max workers, wait
    if (session.activeWorkers >= session.options.maxWorkers) return;
    
    // Process chunks in batches to optimize API usage
    while (session.processingQueue.length > 0 && session.activeWorkers < session.options.maxWorkers) {
      // Take up to batchSize chunks from the queue for processing
      const batchSize = Math.min(session.options.batchSize, session.processingQueue.length);
      const chunkBatch = session.processingQueue.splice(0, batchSize);
      
      // Mark these chunks as processing
      chunkBatch.forEach(chunk => { chunk.status = 'processing'; });
      
      // Increment active workers count
      session.activeWorkers++;
      
      // Process the batch asynchronously
      this.processBatch(sessionId, chunkBatch).finally(() => {
        // Decrement active workers when done
        session.activeWorkers--;
        
        // Set the last processed time
        session.lastProcessedTime = Math.max(...chunkBatch.map(c => c.timestamp));
        
        // Continue processing if there are more chunks
        if (session.processingQueue.length > 0) {
          this.processQueue(sessionId);
        }
      });
    }
  }
  
  /**
   * Process a batch of audio chunks
   * @param {string} sessionId - Session identifier
   * @param {Array} chunkBatch - Batch of audio chunks
   */
  async processBatch(sessionId, chunkBatch) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    try {
      // Sort chunks by timestamp
      chunkBatch.sort((a, b) => a.timestamp - b.timestamp);
      
      // Merge the audio chunks into a single file for more efficient processing
      const mergedFilename = path.join(this.tempDir, `merged_${sessionId}_${Date.now()}.wav`);
      await this.mergeAudioFiles(chunkBatch.map(c => c.filename), mergedFilename);
      
      // Process the merged file
      const subtitles = await this.transcribeAudio(mergedFilename, {
        language: session.options.language,
        prompt: session.options.prompt,
        model: session.options.model,
        response_format: 'vtt',
        timestamp_granularities: ['segment', 'word']
      });
      
      // Adjust the timestamps based on the first chunk's timestamp
      const baseTimestamp = chunkBatch[0].timestamp;
      const adjustedSubtitles = this.adjustSubtitleTimestamps(subtitles, baseTimestamp);
      
      // Add the subtitles to the session
      session.subtitles.push(...adjustedSubtitles);
      
      // Sort subtitles by start time
      session.subtitles.sort((a, b) => a.start - b.start);
      
      // Mark chunks as processed
      chunkBatch.forEach(chunk => { 
        chunk.status = 'processed'; 
        
        // Delete the temp file
        try {
          fs.unlinkSync(chunk.filename);
        } catch (err) {
          console.error(`Error deleting chunk file ${chunk.filename}:`, err);
        }
      });
      
      // Delete the merged file
      try {
        fs.unlinkSync(mergedFilename);
      } catch (err) {
        console.error(`Error deleting merged file ${mergedFilename}:`, err);
      }
      
      // Emit the new subtitles
      this.emitSubtitles(sessionId, adjustedSubtitles);
      
      return adjustedSubtitles;
    } catch (error) {
      console.error(`Error processing batch for session ${sessionId}:`, error);
      
      // Mark chunks as failed
      chunkBatch.forEach(chunk => { chunk.status = 'failed'; });
      
      throw error;
    }
  }
  
  /**
   * Convert audio data to WAV format
   * @param {Buffer} audioData - Audio data
   * @param {string} outputFilename - Output filename
   * @returns {Promise<string>} Output filename
   */
  convertAudioToWav(audioData, outputFilename) {
    return new Promise((resolve, reject) => {
      // Create a temporary file for the input audio
      const inputFilename = path.join(this.tempDir, `input_${Date.now()}.raw`);
      fs.writeFileSync(inputFilename, audioData);
      
      // Convert to WAV using ffmpeg
      ffmpeg(inputFilename)
        .inputFormat('s16le') // 16-bit signed PCM
        .audioChannels(1)
        .audioFrequency(16000)
        .outputFormat('wav')
        .on('end', () => {
          // Delete the temporary input file
          fs.unlinkSync(inputFilename);
          resolve(outputFilename);
        })
        .on('error', (err) => {
          // Delete the temporary input file
          try {
            fs.unlinkSync(inputFilename);
          } catch (e) {
            // Ignore errors
          }
          reject(err);
        })
        .save(outputFilename);
    });
  }
  
  /**
   * Merge multiple audio files into one
   * @param {Array<string>} inputFiles - Input filenames
   * @param {string} outputFilename - Output filename
   * @returns {Promise<string>} Output filename
   */
  mergeAudioFiles(inputFiles, outputFilename) {
    return new Promise((resolve, reject) => {
      // Create a temporary file list
      const fileListPath = path.join(this.tempDir, `filelist_${Date.now()}.txt`);
      const fileListContent = inputFiles.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
      fs.writeFileSync(fileListPath, fileListContent);
      
      // Merge files using ffmpeg
      ffmpeg()
        .input(fileListPath)
        .inputFormat('concat')
        .inputOptions(['-safe 0'])
        .outputFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => {
          // Delete the temporary file list
          fs.unlinkSync(fileListPath);
          resolve(outputFilename);
        })
        .on('error', (err) => {
          // Delete the temporary file list
          try {
            fs.unlinkSync(fileListPath);
          } catch (e) {
            // Ignore errors
          }
          reject(err);
        })
        .save(outputFilename);
    });
  }
  
  /**
   * Transcribe audio file using Whisper
   * @param {string} audioFile - Audio filename
   * @param {Object} options - Transcription options
   * @returns {Promise<Array>} Subtitles
   */
  async transcribeAudio(audioFile, options) {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFile),
        model: options.model,
        language: options.language,
        prompt: options.prompt,
        response_format: options.response_format,
        timestamp_granularities: options.timestamp_granularities
      });
      
      // Parse VTT content into structured subtitles
      return this.parseVttContent(transcription);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }
  
  /**
   * Parse VTT content into structured subtitles
   * @param {string} vttContent - VTT content
   * @returns {Array} Structured subtitles
   */
  parseVttContent(vttContent) {
    const subtitles = [];
    const lines = vttContent.split('\n');
    
    let currentSubtitle = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and WebVTT header
      if (!line || line === 'WEBVTT') continue;
      
      // Check if it's a timestamp line
      const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
      const match = line.match(timestampRegex);
      
      if (match) {
        // If we were building a subtitle, push it
        if (currentSubtitle && currentSubtitle.text) {
          subtitles.push(currentSubtitle);
        }
        
        // Start a new subtitle
        currentSubtitle = {
          start: this.timestampToSeconds(match[1]),
          end: this.timestampToSeconds(match[2]),
          text: ''
        };
      } else if (currentSubtitle) {
        // Add text to current subtitle
        if (currentSubtitle.text) {
          currentSubtitle.text += ' ' + line;
        } else {
          currentSubtitle.text = line;
        }
      }
    }
    
    // Add the last subtitle if we have one
    if (currentSubtitle && currentSubtitle.text) {
      subtitles.push(currentSubtitle);
    }
    
    return subtitles;
  }
  
  /**
   * Convert timestamp to seconds
   * @param {string} timestamp - Timestamp in format HH:MM:SS.mmm
   * @returns {number} Seconds
   */
  timestampToSeconds(timestamp) {
    const [hours, minutes, seconds] = timestamp.split(':').map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  /**
   * Convert seconds to timestamp
   * @param {number} seconds - Seconds
   * @returns {string} Timestamp in format HH:MM:SS.mmm
   */
  secondsToTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${
      minutes.toString().padStart(2, '0')}:${
      secs.toFixed(3).padStart(6, '0')}`;
  }
  
  /**
   * Adjust subtitle timestamps based on a base timestamp
   * @param {Array} subtitles - Subtitles
   * @param {number} baseTimestamp - Base timestamp in seconds
   * @returns {Array} Adjusted subtitles
   */
  adjustSubtitleTimestamps(subtitles, baseTimestamp) {
    return subtitles.map(subtitle => ({
      ...subtitle,
      start: subtitle.start + baseTimestamp,
      end: subtitle.end + baseTimestamp
    }));
  }
  
  /**
   * Emit subtitles to connected clients
   * @param {string} sessionId - Session identifier
   * @param {Array} subtitles - New subtitles
   */
  emitSubtitles(sessionId, subtitles) {
    // This would be implemented in the main server
    // where WebSocket connections are managed
    console.log(`Emitting ${subtitles.length} subtitles for session ${sessionId}`);
  }
  
  /**
   * Get all subtitles for a session
   * @param {string} sessionId - Session identifier
   * @returns {Array} Subtitles
   */
  getSubtitles(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return [];
    }
    
    return [...session.subtitles].sort((a, b) => a.start - b.start);
  }
  
  /**
   * Get subtitles for a specific time range
   * @param {string} sessionId - Session identifier
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   * @returns {Array} Subtitles in range
   */
  getSubtitlesInRange(sessionId, startTime, endTime) {
    const subtitles = this.getSubtitles(sessionId);
    
    return subtitles.filter(subtitle => 
      (subtitle.start >= startTime && subtitle.start <= endTime) ||
      (subtitle.end >= startTime && subtitle.end <= endTime) ||
      (subtitle.start <= startTime && subtitle.end >= endTime)
    );
  }
  
  /**
   * End a subtitle session
   * @param {string} sessionId - Session identifier
   * @returns {Object} Final session state
   */
  endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Wait for any in-progress processing to complete
    if (session.activeWorkers > 0 || session.processingQueue.length > 0) {
      console.log(`Session ${sessionId} has pending work, waiting before closing...`);
    }
    
    // Get the final subtitles
    const subtitles = this.getSubtitles(sessionId);
    
    // Remove the session
    this.activeSessions.delete(sessionId);
    
    // Clean up any files
    session.chunks.forEach(chunk => {
      if (fs.existsSync(chunk.filename)) {
        try {
          fs.unlinkSync(chunk.filename);
        } catch (err) {
          console.error(`Error deleting chunk file ${chunk.filename}:`, err);
        }
      }
    });
    
    return {
      sessionId,
      subtitles,
      duration: (Date.now() - session.startTime) / 1000
    };
  }
  
  /**
   * Clean up temporary files
   */
  cleanupTempFiles() {
    // Get all files in the temp directory
    const files = fs.readdirSync(this.tempDir);
    const now = Date.now();
    
    // Delete files older than 24 hours
    files.forEach(file => {
      const filePath = path.join(this.tempDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;
      
      if (fileAge > 24 * 3600 * 1000) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Error deleting temp file ${filePath}:`, err);
        }
      }
    });
  }
  
  /**
   * Stop the service and clean up resources
   */
  shutdown() {
    // Clear the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // End all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      try {
        this.endSession(sessionId);
      } catch (err) {
        console.error(`Error ending session ${sessionId}:`, err);
      }
    }
    
    // Final cleanup of temp directory
    this.cleanupTempFiles();
  }
}

module.exports = OptimizedWhisperService; 