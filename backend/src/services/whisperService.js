const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Process audio data with Whisper API to generate transcription
 * @param {Buffer|string} audioData - Audio data buffer or base64 string
 * @param {Object} options - Transcription options
 * @returns {Promise<Object>} - Transcription result
 */
async function transcribe(audioData, options = {}) {
  try {
    // Create temporary file name
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}.webm`);
    
    // Convert audioData to a file
    let fileBuffer;
    if (typeof audioData === 'string') {
      // Handle base64 string
      if (audioData.startsWith('data:audio')) {
        // Extract base64 data from data URL
        const base64Data = audioData.split(',')[1];
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Assume it's already base64
        fileBuffer = Buffer.from(audioData, 'base64');
      }
    } else if (Buffer.isBuffer(audioData)) {
      // Already a buffer
      fileBuffer = audioData;
    } else {
      throw new Error('Invalid audio data format. Expected Buffer or base64 string.');
    }
    
    // Write buffer to temp file
    fs.writeFileSync(tempFilePath, fileBuffer);
    
    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
      language: options.language || "en",
      temperature: options.temperature || 0,
      response_format: "verbose_json"
    });
    
    // Delete temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.warn(`Failed to delete temp file ${tempFilePath}:`, err);
    }
    
    // Parse and format the result
    return {
      timestamp: Date.now(),
      text: transcription.text,
      segments: transcription.segments?.map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text,
        confidence: segment.confidence
      })) || [],
      language: transcription.language,
      confidence: calculateAverageConfidence(transcription.segments || [])
    };
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
}

/**
 * Process audio chunks for real-time transcription
 * @param {Buffer|string} audioChunk - Audio chunk data
 * @param {string} sessionId - Session identifier for tracking context
 * @param {Object} options - Transcription options
 * @returns {Promise<Object>} - Transcription result
 */
async function transcribeRealtime(audioChunk, sessionId, options = {}) {
  // This is a simplified version for the demo
  // In a production system, we would:
  // 1. Buffer audio chunks until we have enough for meaningful transcription
  // 2. Maintain session context for continuity between chunks
  // 3. Handle overlapping transcriptions for smoother experience
  
  return transcribe(audioChunk, options);
}

/**
 * Calculate average confidence score from segments
 * @param {Array} segments - Transcription segments
 * @returns {number} - Average confidence score
 */
function calculateAverageConfidence(segments) {
  if (!segments || segments.length === 0) return 0;
  
  const sum = segments.reduce((total, segment) => total + (segment.confidence || 0), 0);
  return sum / segments.length;
}

/**
 * Detect potential speakers in transcription
 * @param {Array} segments - Transcription segments
 * @returns {Array} - Segments with speaker identification
 */
function identifySpeakers(segments) {
  // This is a placeholder for demo purposes
  // In a real implementation, this would use a more sophisticated algorithm
  // or an additional AI model for speaker diarization
  
  if (!segments || segments.length === 0) return [];
  
  let currentSpeaker = 1;
  let lastSegmentEnd = 0;
  
  return segments.map(segment => {
    // Simple heuristic: if there's a gap > 2 seconds, might be a new speaker
    if (segment.start - lastSegmentEnd > 2) {
      currentSpeaker = currentSpeaker === 1 ? 2 : 1;
    }
    
    lastSegmentEnd = segment.end;
    
    return {
      ...segment,
      speaker: `Speaker ${currentSpeaker}`
    };
  });
}

module.exports = {
  transcribe,
  transcribeRealtime,
  identifySpeakers
}; 