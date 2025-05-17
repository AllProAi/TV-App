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
    // Find relevant subtitles based on query
    const relevantSubtitles = options.timestamp 
      ? getSubtitlesAroundTimestamp(subtitles, options.timestamp, options.contextWindow || 60)
      : findRelevantSubtitles(query, subtitles, options.maxContext || 20);
    
    // Format subtitles as context
    const subtitleContext = relevantSubtitles
      .map(s => `[${formatTimestamp(s.timestamp || s.start * 1000)}] ${s.text}`)
      .join('\n');
    
    // Create system prompt with instructions
    const systemPrompt = `You are MemoryStream AI, an assistant that answers questions about TV content based on dialogue. 
You have access to the following transcript from the content the user is watching:

${subtitleContext}

When answering:
1. Only use information from the provided transcript
2. If the answer isn't in the transcript, say "I don't have enough information from what I've seen so far"
3. Reference specific timestamps when possible
4. Keep responses concise and informative
5. Don't mention that you're working with "subtitles" or "transcript" - refer to it as "what I've seen" or "what was said"`;

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
      sources: relevantSubtitles.map(s => ({
        timestamp: s.timestamp || s.start * 1000,
        text: s.text
      }))
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
  "action": "play|pause|rewind|forward|volume_up|volume_down|mute|search|answer|subtitle_on|subtitle_off|none",
  "parameters": {}, // Additional parameters if needed (e.g. {"seconds": 30} for forward/rewind)
  "confidence": 0.95, // How confident you are that this is the correct action
  "clarification": "" // If confidence is low, suggest clarification
}

For search commands, include a "query" parameter with the search term.
For example: {"action": "search", "parameters": {"query": "who is the murderer"}}`;

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
      .map(s => `[${formatTimestamp(s.timestamp || s.start * 1000)}] ${s.text}`)
      .join('\n');
    
    // Create system prompt with instructions
    const systemPrompt = `You are a content summarization expert.
Based on the following transcript from a TV show or movie, generate a concise summary.
Focus on key plot points, main characters, and significant events.
The summary should be approximately ${options.length || 3} paragraphs.

TRANSCRIPT:
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
 * Search subtitles for a specific query
 * @param {string} query - Search query
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {Promise<Object>} - Search results
 */
async function searchSubtitles(query, subtitles) {
  try {
    // First find potentially relevant subtitles using simple keyword matching
    const potentialMatches = findRelevantSubtitles(query, subtitles, 30);
    
    if (potentialMatches.length === 0) {
      return {
        timestamp: Date.now(),
        results: [],
        query
      };
    }
    
    // Format subtitle context for semantic search
    const subtitleContext = potentialMatches
      .map(s => `[${formatTimestamp(s.timestamp || s.start * 1000)}] ${s.text}`)
      .join('\n');
    
    // Create system prompt for semantic search
    const systemPrompt = `You are a semantic search engine for TV content.
Based on the user's query and the following transcript excerpts, identify the most relevant moments.
Return a JSON array of objects containing:
1. The timestamp string [MM:SS]
2. The text of the transcript
3. A relevance score (0-1) indicating how relevant this moment is to the query

Return only the timestamp sections that are truly relevant to the query. If none are relevant, return an empty array.`;

    // Call GPT for semantic search
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Query: "${query}"\n\nTranscript excerpts:\n${subtitleContext}` }
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    // Parse results
    const results = JSON.parse(completion.choices[0].message.content);
    
    return {
      timestamp: Date.now(),
      results: Array.isArray(results) ? results : (results.results || []),
      query
    };
  } catch (error) {
    console.error('Subtitle search error:', error);
    
    // Fallback to simple keyword search if GPT fails
    const fallbackResults = findRelevantSubtitles(query, subtitles, 5)
      .map(s => ({
        timestamp: formatTimestamp(s.timestamp || s.start * 1000),
        text: s.text,
        relevance: 0.5
      }));
    
    return {
      timestamp: Date.now(),
      results: fallbackResults,
      query,
      fallback: true
    };
  }
}

/**
 * Format timestamp as readable time
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} - Formatted time string (MM:SS)
 */
function formatTimestamp(timestamp) {
  if (typeof timestamp !== 'number') return '00:00';
  
  const totalSeconds = Math.floor(timestamp / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * Get subtitles around a specific timestamp
 * @param {Array} subtitles - Array of subtitle objects
 * @param {number} timestamp - Timestamp in milliseconds
 * @param {number} contextWindow - Context window in seconds (half before, half after)
 * @returns {Array} - Subtitles within the context window
 */
function getSubtitlesAroundTimestamp(subtitles, timestamp, contextWindow = 60) {
  const halfWindowMs = (contextWindow / 2) * 1000;
  const startTime = timestamp - halfWindowMs;
  const endTime = timestamp + halfWindowMs;
  
  return subtitles.filter(subtitle => {
    const subtitleTime = subtitle.timestamp || subtitle.start * 1000;
    return subtitleTime >= startTime && subtitleTime <= endTime;
  }).sort((a, b) => {
    return (a.timestamp || a.start * 1000) - (b.timestamp || b.start * 1000);
  });
}

/**
 * Find subtitles relevant to a query using simple keyword matching
 * @param {string} query - Search query
 * @param {Array} subtitles - Array of subtitle objects
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Array} - Relevant subtitles
 */
function findRelevantSubtitles(query, subtitles, maxResults = 20) {
  // Convert query to lowercase and split into tokens
  const queryTokens = query.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(token => token.length > 2);
  
  // Score each subtitle based on token matches
  const scoredSubtitles = subtitles.map(subtitle => {
    const text = subtitle.text.toLowerCase();
    let score = 0;
    
    queryTokens.forEach(token => {
      if (text.includes(token)) {
        score += 1;
      }
    });
    
    return { ...subtitle, relevanceScore: score };
  });
  
  // Sort by relevance score (descending) and take top results
  return scoredSubtitles
    .filter(s => s.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
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
  generateSummary,
  searchSubtitles,
  getSubtitlesAroundTimestamp,
  findRelevantSubtitles
}; 