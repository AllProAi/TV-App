const { OpenAI } = require('openai');

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
    // For demo purposes, create a temporary file from the audio data
    // In production, handle this more efficiently
    const tempFilePath = `/tmp/audio-${Date.now()}.wav`;
    
    // Convert audioData to format Whisper accepts
    // This is simplified for the demo - actual implementation would depend on
    // how audio is being captured and streamed from the client
    
    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: tempFilePath, // In real implementation, handle file creation properly
      model: "whisper-1",
      language: options.language || "en",
      temperature: options.temperature || 0,
      response_format: "verbose_json"
    });
    
    // Parse and format the result
    return {
      timestamp: Date.now(),
      text: transcription.text,
      segments: transcription.segments.map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text,
        confidence: segment.confidence
      })),
      language: transcription.language,
      confidence: calculateAverageConfidence(transcription.segments)
    };
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
}

/**
 * Calculate average confidence score from segments
 * @param {Array} segments - Transcription segments
 * @returns {number} - Average confidence score
 */
function calculateAverageConfidence(segments) {
  if (!segments || segments.length === 0) return 0;
  
  const sum = segments.reduce((total, segment) => total + segment.confidence, 0);
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
  identifySpeakers
}; 