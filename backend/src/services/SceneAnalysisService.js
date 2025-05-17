const { OpenAI } = require('openai');

/**
 * Service for analyzing scenes in video content using AI vision models
 */
class SceneAnalysisService {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
    
    // Cache to store recent frame analyses to avoid repeated processing
    this.analysisCache = new Map();
    // Maximum cache size
    this.maxCacheSize = 50;
  }

  /**
   * Analyze a scene from a video frame
   * @param {string} frameBase64 - Base64-encoded image of the current video frame
   * @param {string} dialogue - Recent dialogue for context
   * @returns {Promise<Object>} Scene analysis results
   */
  async analyzeScene(frameBase64, dialogue = '') {
    try {
      // Generate a cache key based on image hash (simplified here)
      const cacheKey = this.generateCacheKey(frameBase64);
      
      // Check if we have a cached analysis
      if (this.analysisCache.has(cacheKey)) {
        return this.analysisCache.get(cacheKey);
      }
      
      // Prepare the prompt for the vision model
      const messages = [
        {
          role: "system",
          content: `You are a scene analysis AI for a TV assistant app. 
          Analyze the given frame and provide details about what's happening in the scene.
          If dialogue is provided, use it for additional context.
          Focus on: main characters present, their emotions, actions, setting, and significant objects.
          Structure your response as JSON with these keys: characters, setting, action, mood, objects, relationships.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: dialogue ? `Recent dialogue: "${dialogue}"` : "Analyze this scene:" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${frameBase64}`
              }
            }
          ]
        }
      ];

      // Call the OpenAI Vision model
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: messages,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      // Parse the response
      let analysis;
      try {
        analysis = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        analysis = {
          raw: response.choices[0].message.content,
          characters: [],
          setting: "",
          action: "",
          mood: "",
          objects: [],
          relationships: []
        };
      }

      // Add timestamp for cache management
      analysis.timestamp = Date.now();
      
      // Cache the result
      this.analysisCache.set(cacheKey, analysis);
      
      // Clean cache if it exceeds maximum size
      if (this.analysisCache.size > this.maxCacheSize) {
        this.cleanCache();
      }
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing scene:', error);
      return {
        error: 'Failed to analyze scene',
        characters: [],
        setting: "",
        action: "",
        mood: "",
        objects: [],
        relationships: []
      };
    }
  }

  /**
   * Generate a simple cache key from frame data
   * @param {string} frameBase64 - Base64-encoded image
   * @returns {string} Cache key
   */
  generateCacheKey(frameBase64) {
    // Simple cache key generation - in production would use proper image hashing
    const sampleSize = 100;
    const startPos = Math.floor(frameBase64.length / 2);
    return frameBase64.substr(startPos, sampleSize);
  }

  /**
   * Clean the analysis cache by removing oldest entries
   */
  cleanCache() {
    // Convert cache to array, sort by timestamp, and keep only newest entries
    const entries = [...this.analysisCache.entries()];
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    // Keep only the newest entries up to maxCacheSize/2
    this.analysisCache = new Map(entries.slice(0, Math.floor(this.maxCacheSize / 2)));
  }

  /**
   * Extract key entities from scene analysis
   * @param {Object} analysis - Scene analysis
   * @returns {Object} Key entities and concepts
   */
  extractKeyEntities(analysis) {
    // Extract important entities for context tracking
    const entities = {
      characters: analysis.characters || [],
      locations: [analysis.setting].filter(Boolean),
      objects: analysis.objects || [],
      concepts: [analysis.mood, analysis.action].filter(Boolean)
    };
    
    return entities;
  }
  
  /**
   * Get scene context over time by analyzing multiple frames
   * @param {Array<Object>} frameAnalyses - Array of frame analyses
   * @returns {Object} Aggregated scene context
   */
  aggregateSceneContext(frameAnalyses) {
    // Combine multiple frame analyses to get a more complete scene understanding
    const characters = new Set();
    const locations = new Set();
    const objects = new Set();
    const concepts = new Set();
    
    frameAnalyses.forEach(analysis => {
      const entities = this.extractKeyEntities(analysis);
      
      entities.characters.forEach(c => characters.add(c));
      entities.locations.forEach(l => locations.add(l));
      entities.objects.forEach(o => objects.add(o));
      entities.concepts.forEach(c => concepts.add(c));
    });
    
    return {
      characters: [...characters],
      locations: [...locations],
      objects: [...objects],
      concepts: [...concepts],
      timestamp: Date.now()
    };
  }
}

module.exports = SceneAnalysisService; 