const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate response to user query based on subtitle context
 * @param {string} query - User's question
 * @param {Array} subtitles - Array of subtitle objects for context
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - AI response
 */
async function generateResponse(query, subtitles = [], options = {}) {
  try {
    // Format subtitles as context
    const subtitleContext = subtitles
      .map(s => `[${formatTimestamp(s.timestamp)}] ${s.text}`)
      .join('\n');
    
    // Create system prompt with instructions
    const systemPrompt = `You are MemoryStream AI, an assistant that answers questions about TV content based on subtitles. 
You have access to the following subtitle text from the content the user is watching:

${subtitleContext}

When answering:
1. Only use information from the provided subtitles
2. If the answer isn't in the subtitles, say "I don't have enough information from what I've seen so far"
3. Reference specific timestamps when possible
4. Keep responses concise and informative
5. Don't mention that you're working with "subtitles" - refer to it as "what I've seen" or "what was said"`;

    // Call GPT
    const completion = await openai.chat.completions.create({
      model: options.model || "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 150
    });

    // Format response
    return {
      timestamp: Date.now(),
      text: completion.choices[0].message.content,
      sources: identifySourceSubtitles(completion.choices[0].message.content, subtitles)
    };
  } catch (error) {
    console.error('GPT response generation error:', error);
    throw error;
  }
}

/**
 * Process voice command and determine action
 * @param {string} command - Voice command text
 * @returns {Promise<Object>} - Action to take
 */
async function processCommand(command) {
  try {
    // System prompt for command processing
    const systemPrompt = `You are a TV voice command processor.
Analyze the user's voice command and determine the appropriate action.
Response must be a valid JSON object with the following structure:
{
  "action": "play|pause|rewind|forward|volume_up|volume_down|search|answer|none",
  "parameters": {}, // Additional parameters if needed
  "confidence": 0.95, // How confident you are that this is the correct action
  "clarification": "" // If confidence is low, suggest clarification
}`;

    // Call GPT to interpret the command
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: command }
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    // Parse and return the result
    const result = JSON.parse(completion.choices[0].message.content);
    return {
      timestamp: Date.now(),
      command,
      ...result
    };
  } catch (error) {
    console.error('Command processing error:', error);
    return {
      timestamp: Date.now(),
      command,
      action: "none",
      confidence: 0,
      clarification: "I couldn't understand that command"
    };
  }
}

/**
 * Generate a summary of content based on subtitles
 * @param {Array} subtitles - Array of subtitle objects
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Generated summary
 */
async function generateSummary(subtitles, options = {}) {
  try {
    // Format subtitles as context
    const subtitleContext = subtitles
      .map(s => `[${formatTimestamp(s.timestamp)}] ${s.text}`)
      .join('\n');
    
    // Create system prompt with instructions
    const systemPrompt = `You are a content summarization expert.
Based on the following subtitles from a TV show or movie, generate a concise summary.
Focus on key plot points, main characters, and significant events.
The summary should be approximately ${options.length || 3} paragraphs.

SUBTITLES:
${subtitleContext}`;

    // Call GPT
    const completion = await openai.chat.completions.create({
      model: options.model || "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Please summarize this content." }
      ],
      temperature: options.temperature || 0.5,
      max_tokens: options.maxTokens || 300
    });

    // Format response
    return {
      timestamp: Date.now(),
      text: completion.choices[0].message.content,
      type: "summary",
      subtitleCount: subtitles.length
    };
  } catch (error) {
    console.error('Summary generation error:', error);
    throw error;
  }
}

/**
 * Format timestamp as readable time
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} - Formatted time string (MM:SS)
 */
function formatTimestamp(timestamp) {
  if (typeof timestamp !== 'number') return '00:00';
  
  const date = new Date(timestamp);
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * Identify which subtitles were used as sources for the response
 * @param {string} response - AI response text
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {Array} - Subtitle sources used in response
 */
function identifySourceSubtitles(response, subtitles) {
  // This is a simplified implementation for the demo
  // In production, this would use more sophisticated NLP techniques
  
  return subtitles.filter(subtitle => {
    // Split subtitle text into significant words (exclude stop words)
    const words = subtitle.text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4); // Only consider "significant" words
    
    // Check if any significant word appears in the response
    return words.some(word => response.toLowerCase().includes(word));
  });
}

module.exports = {
  generateResponse,
  processCommand,
  generateSummary
}; 