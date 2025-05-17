const axios = require('axios');

/**
 * Service for recognizing TV shows and movies based on dialogue and metadata
 */
class ContentRecognitionService {
  constructor(apiKey) {
    this.tmdbApiKey = apiKey || process.env.TMDB_API_KEY;
    this.baseUrl = 'https://api.themoviedb.org/3';
  }

  /**
   * Identify content based on dialogue and metadata
   * @param {string} dialogue - Transcribed dialogue from the content
   * @param {Object} metadata - Any available metadata (title, duration, etc.)
   * @returns {Promise<Object>} Content information
   */
  async identifyContent(dialogue, metadata = {}) {
    try {
      // First try to match based on metadata if available
      if (metadata.title) {
        const metadataResults = await this.searchByTitle(metadata.title);
        if (metadataResults.length > 0) {
          return this.getContentDetails(metadataResults[0]);
        }
      }

      // If no metadata match, try dialogue-based identification
      // Extract potential show names, character names, and distinctive phrases
      const potentialTitles = this.extractPotentialTitles(dialogue);
      const results = [];

      for (const title of potentialTitles) {
        const searchResults = await this.searchByTitle(title);
        results.push(...searchResults);
      }

      // Score and rank results
      const scoredResults = this.scoreResults(results, dialogue, metadata);
      
      if (scoredResults.length > 0) {
        return this.getContentDetails(scoredResults[0]);
      }

      return null;
    } catch (error) {
      console.error('Error identifying content:', error);
      return null;
    }
  }

  /**
   * Extract potential show or movie titles from dialogue
   * @param {string} dialogue - Transcribed dialogue
   * @returns {Array<string>} Potential titles
   */
  extractPotentialTitles(dialogue) {
    // This is a simplified implementation
    // In a production app, we would use NER models or more sophisticated methods
    const sentences = dialogue.split(/[.!?]+/);
    const potentialTitles = [];
    
    // Look for quoted text that might be titles
    const quotedText = dialogue.match(/"([^"]*)"/g) || [];
    potentialTitles.push(...quotedText.map(t => t.replace(/"/g, '')));
    
    // Look for capitalized phrases that might be titles
    const capitalizedPhrases = dialogue.match(/\b([A-Z][a-z]+\s){1,4}[A-Z][a-z]+\b/g) || [];
    potentialTitles.push(...capitalizedPhrases);
    
    return [...new Set(potentialTitles)]; // Remove duplicates
  }

  /**
   * Search TMDB by title
   * @param {string} title - Title to search for
   * @returns {Promise<Array>} Search results
   */
  async searchByTitle(title) {
    try {
      const response = await axios.get(`${this.baseUrl}/search/multi`, {
        params: {
          api_key: this.tmdbApiKey,
          query: title,
          include_adult: false
        }
      });
      
      return response.data.results || [];
    } catch (error) {
      console.error('Error searching by title:', error);
      return [];
    }
  }

  /**
   * Get detailed information about content
   * @param {Object} item - Basic content item
   * @returns {Promise<Object>} Detailed content information
   */
  async getContentDetails(item) {
    try {
      const type = item.media_type === 'movie' ? 'movie' : 'tv';
      const response = await axios.get(`${this.baseUrl}/${type}/${item.id}`, {
        params: {
          api_key: this.tmdbApiKey,
          append_to_response: 'credits,keywords,videos'
        }
      });
      
      return {
        id: item.id,
        type: type,
        title: type === 'movie' ? response.data.title : response.data.name,
        overview: response.data.overview,
        poster: response.data.poster_path ? 
          `https://image.tmdb.org/t/p/w500${response.data.poster_path}` : null,
        backdrop: response.data.backdrop_path ? 
          `https://image.tmdb.org/t/p/original${response.data.backdrop_path}` : null,
        year: type === 'movie' ? 
          (response.data.release_date ? response.data.release_date.split('-')[0] : null) : 
          (response.data.first_air_date ? response.data.first_air_date.split('-')[0] : null),
        cast: response.data.credits.cast.slice(0, 10).map(actor => ({
          name: actor.name,
          character: actor.character,
          profile: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
        })),
        genres: response.data.genres.map(g => g.name),
        keywords: response.data.keywords.keywords || response.data.keywords.results || []
      };
    } catch (error) {
      console.error('Error getting content details:', error);
      return null;
    }
  }

  /**
   * Score and rank results based on relevance to dialogue and metadata
   * @param {Array} results - Search results
   * @param {string} dialogue - Transcribed dialogue
   * @param {Object} metadata - Any available metadata
   * @returns {Array} Scored and ranked results
   */
  scoreResults(results, dialogue, metadata) {
    return results
      .map(result => {
        let score = 0;
        
        // Score based on title match if metadata is available
        if (metadata.title) {
          const resultTitle = result.title || result.name || '';
          const titleSimilarity = this.calculateSimilarity(resultTitle.toLowerCase(), metadata.title.toLowerCase());
          score += titleSimilarity * 3; // Weighted more heavily
        }
        
        // Score based on overview match with dialogue
        const overview = result.overview || '';
        if (overview && dialogue) {
          const dialogueWords = new Set(dialogue.toLowerCase().split(/\s+/));
          const overviewWords = overview.toLowerCase().split(/\s+/);
          
          const matchingWords = overviewWords.filter(word => dialogueWords.has(word)).length;
          score += matchingWords / overviewWords.length;
        }
        
        return { ...result, score };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score);
  }
  
  /**
   * Calculate text similarity (simplified version)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    // Simple implementation - would use more sophisticated methods in production
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word)).length;
    const union = new Set([...words1, ...words2]).size;
    
    return intersection / union;
  }
}

module.exports = ContentRecognitionService; 