const axios = require('axios');
const { OpenAI } = require('openai');

/**
 * Service for generating personalized content recommendations
 */
class RecommendationService {
  constructor(tmdbApiKey, openaiApiKey) {
    this.tmdbApiKey = tmdbApiKey || process.env.TMDB_API_KEY;
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.openai = new OpenAI({
      apiKey: openaiApiKey || process.env.OPENAI_API_KEY
    });
    
    // In-memory user profile store
    // In production, this would be stored in a database
    this.userProfiles = new Map();
  }

  /**
   * Track user interaction with content
   * @param {string} userId - User identifier
   * @param {Object} content - Content information (id, type, title, etc.)
   * @param {string} action - Interaction type (watch, search, question, like, dislike)
   * @param {Object} details - Additional details about the interaction
   */
  trackUserInteraction(userId, content, action, details = {}) {
    if (!userId || !content || !action) return;

    // Initialize user profile if it doesn't exist
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        interactionHistory: [],
        contentHistory: [],
        preferences: {
          genres: {},
          actors: {},
          directors: {},
          keywords: {}
        },
        lastUpdated: Date.now()
      });
    }

    const profile = this.userProfiles.get(userId);
    
    // Add to interaction history
    profile.interactionHistory.push({
      timestamp: Date.now(),
      action,
      contentId: content.id,
      contentType: content.type,
      contentTitle: content.title,
      details
    });
    
    // Keep interaction history at a reasonable size
    if (profile.interactionHistory.length > 100) {
      profile.interactionHistory = profile.interactionHistory.slice(-100);
    }
    
    // Update content history for watched items
    if (action === 'watch' && !profile.contentHistory.some(item => item.id === content.id)) {
      profile.contentHistory.push({
        id: content.id,
        type: content.type,
        title: content.title,
        watchDate: Date.now(),
        genres: content.genres || []
      });
      
      // Keep content history at a reasonable size
      if (profile.contentHistory.length > 50) {
        profile.contentHistory = profile.contentHistory.slice(-50);
      }
    }
    
    // Update preferences based on interactions
    this.updatePreferences(profile, content, action, details);
    
    // Update last updated timestamp
    profile.lastUpdated = Date.now();
  }
  
  /**
   * Update user preferences based on content interaction
   * @param {Object} profile - User profile
   * @param {Object} content - Content information
   * @param {string} action - Interaction type
   * @param {Object} details - Additional details
   */
  updatePreferences(profile, content, action, details) {
    // Weight modifiers based on action
    const weights = {
      watch: 2,
      search: 1,
      question: 0.5,
      like: 3,
      dislike: -2
    };
    
    const weight = weights[action] || 1;
    
    // Update genre preferences
    if (content.genres && Array.isArray(content.genres)) {
      content.genres.forEach(genre => {
        profile.preferences.genres[genre] = (profile.preferences.genres[genre] || 0) + weight;
      });
    }
    
    // Update actor preferences
    if (content.cast && Array.isArray(content.cast)) {
      content.cast.forEach((actor, index) => {
        // Weigh leading actors more heavily
        const actorWeight = weight * (1 - (index * 0.1));
        if (actorWeight > 0) {
          profile.preferences.actors[actor.name] = (profile.preferences.actors[actor.name] || 0) + actorWeight;
        }
      });
    }
    
    // Update keyword preferences
    if (content.keywords && Array.isArray(content.keywords)) {
      content.keywords.forEach(keyword => {
        if (typeof keyword === 'object' && keyword.name) {
          profile.preferences.keywords[keyword.name] = (profile.preferences.keywords[keyword.name] || 0) + weight;
        } else if (typeof keyword === 'string') {
          profile.preferences.keywords[keyword] = (profile.preferences.keywords[keyword] || 0) + weight;
        }
      });
    }
  }
  
  /**
   * Get personalized recommendations
   * @param {string} userId - User identifier
   * @param {number} limit - Maximum number of recommendations
   * @returns {Promise<Array>} Recommended content
   */
  async getRecommendations(userId, limit = 10) {
    try {
      if (!this.userProfiles.has(userId)) {
        return this.getPopularContent(limit);
      }
      
      const profile = this.userProfiles.get(userId);
      
      // If profile has limited history, supplement with popular content
      if (profile.contentHistory.length < 3) {
        return this.getPopularContent(limit);
      }
      
      // Get top genres
      const topGenres = this.getTopEntities(profile.preferences.genres, 3);
      
      // Get top actors
      const topActors = this.getTopEntities(profile.preferences.actors, 3);
      
      // Get top keywords
      const topKeywords = this.getTopEntities(profile.preferences.keywords, 5);
      
      // Get recommendations based on recently watched items
      const recentItems = profile.contentHistory.slice(-3);
      const similarContentPromises = recentItems.map(item => 
        this.getSimilarContent(item.id, item.type));
      
      const similarContent = await Promise.all(similarContentPromises);
      let recommendations = [].concat(...similarContent);
      
      // Get recommendations based on user preferences
      const discoveryRecommendations = await this.getDiscoveryRecommendations(
        topGenres.map(g => g.name), 
        topKeywords.map(k => k.name)
      );
      
      recommendations = [...recommendations, ...discoveryRecommendations];
      
      // Filter out already watched content
      recommendations = recommendations.filter(item => 
        !profile.contentHistory.some(watched => watched.id === item.id));
      
      // Remove duplicates
      recommendations = this.removeDuplicates(recommendations, 'id');
      
      // Score recommendations based on user preferences
      recommendations = this.scoreRecommendations(recommendations, profile);
      
      // Sort by score and limit
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return this.getPopularContent(limit);
    }
  }
  
  /**
   * Get similar content based on a reference item
   * @param {string} itemId - Content ID
   * @param {string} type - Content type (movie or tv)
   * @returns {Promise<Array>} Similar content items
   */
  async getSimilarContent(itemId, type) {
    try {
      const response = await axios.get(`${this.baseUrl}/${type}/${itemId}/similar`, {
        params: {
          api_key: this.tmdbApiKey
        }
      });
      
      return response.data.results.map(item => ({
        id: item.id,
        type: type,
        title: type === 'movie' ? item.title : item.name,
        overview: item.overview,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        year: type === 'movie' ? 
          (item.release_date ? item.release_date.split('-')[0] : null) : 
          (item.first_air_date ? item.first_air_date.split('-')[0] : null),
        source: 'similar'
      }));
    } catch (error) {
      console.error('Error getting similar content:', error);
      return [];
    }
  }
  
  /**
   * Get discovery recommendations based on genres and keywords
   * @param {Array<string>} genres - Preferred genres
   * @param {Array<string>} keywords - Preferred keywords
   * @returns {Promise<Array>} Discovery recommendations
   */
  async getDiscoveryRecommendations(genres, keywords) {
    try {
      // Get genre IDs from TMDB
      const genreMap = await this.getGenreMap();
      const genreIds = genres
        .map(name => {
          const genre = Object.values(genreMap).find(g => g.name.toLowerCase() === name.toLowerCase());
          return genre ? genre.id : null;
        })
        .filter(Boolean);
      
      // Get recommendations for both movies and TV shows
      const moviePromise = axios.get(`${this.baseUrl}/discover/movie`, {
        params: {
          api_key: this.tmdbApiKey,
          sort_by: 'popularity.desc',
          with_genres: genreIds.join(','),
          with_keywords: keywords.join('|')
        }
      });
      
      const tvPromise = axios.get(`${this.baseUrl}/discover/tv`, {
        params: {
          api_key: this.tmdbApiKey,
          sort_by: 'popularity.desc',
          with_genres: genreIds.join(','),
          with_keywords: keywords.join('|')
        }
      });
      
      const [movieResponse, tvResponse] = await Promise.all([moviePromise, tvPromise]);
      
      const movieRecommendations = movieResponse.data.results.map(item => ({
        id: item.id,
        type: 'movie',
        title: item.title,
        overview: item.overview,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        year: item.release_date ? item.release_date.split('-')[0] : null,
        source: 'discovery'
      }));
      
      const tvRecommendations = tvResponse.data.results.map(item => ({
        id: item.id,
        type: 'tv',
        title: item.name,
        overview: item.overview,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        year: item.first_air_date ? item.first_air_date.split('-')[0] : null,
        source: 'discovery'
      }));
      
      return [...movieRecommendations, ...tvRecommendations];
    } catch (error) {
      console.error('Error getting discovery recommendations:', error);
      return [];
    }
  }
  
  /**
   * Get popular content as fallback
   * @param {number} limit - Maximum number of items
   * @returns {Promise<Array>} Popular content
   */
  async getPopularContent(limit = 10) {
    try {
      // Get popular movies and TV shows
      const moviePromise = axios.get(`${this.baseUrl}/movie/popular`, {
        params: {
          api_key: this.tmdbApiKey
        }
      });
      
      const tvPromise = axios.get(`${this.baseUrl}/tv/popular`, {
        params: {
          api_key: this.tmdbApiKey
        }
      });
      
      const [movieResponse, tvResponse] = await Promise.all([moviePromise, tvPromise]);
      
      const movies = movieResponse.data.results.map(item => ({
        id: item.id,
        type: 'movie',
        title: item.title,
        overview: item.overview,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        year: item.release_date ? item.release_date.split('-')[0] : null,
        source: 'popular'
      }));
      
      const tvShows = tvResponse.data.results.map(item => ({
        id: item.id,
        type: 'tv',
        title: item.name,
        overview: item.overview,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        year: item.first_air_date ? item.first_air_date.split('-')[0] : null,
        source: 'popular'
      }));
      
      // Combine and shuffle to provide a mix of content types
      const combined = [...movies, ...tvShows];
      this.shuffleArray(combined);
      
      return combined.slice(0, limit);
    } catch (error) {
      console.error('Error getting popular content:', error);
      return [];
    }
  }
  
  /**
   * Get TMDB genre mapping
   * @returns {Promise<Object>} Genre ID to name mapping
   */
  async getGenreMap() {
    try {
      const movieGenresPromise = axios.get(`${this.baseUrl}/genre/movie/list`, {
        params: {
          api_key: this.tmdbApiKey
        }
      });
      
      const tvGenresPromise = axios.get(`${this.baseUrl}/genre/tv/list`, {
        params: {
          api_key: this.tmdbApiKey
        }
      });
      
      const [movieGenres, tvGenres] = await Promise.all([movieGenresPromise, tvGenresPromise]);
      
      const genreMap = {};
      
      movieGenres.data.genres.forEach(genre => {
        genreMap[`movie_${genre.id}`] = { id: genre.id, name: genre.name, type: 'movie' };
      });
      
      tvGenres.data.genres.forEach(genre => {
        genreMap[`tv_${genre.id}`] = { id: genre.id, name: genre.name, type: 'tv' };
      });
      
      return genreMap;
    } catch (error) {
      console.error('Error getting genre map:', error);
      return {};
    }
  }
  
  /**
   * Score recommendations based on user preferences
   * @param {Array} recommendations - Recommended content
   * @param {Object} profile - User profile
   * @returns {Array} Scored recommendations
   */
  async scoreRecommendations(recommendations, profile) {
    // Get content details for each recommendation to access genres and keywords
    const detailedRecommendations = await this.getContentDetails(recommendations);
    
    return detailedRecommendations.map(item => {
      let score = 1; // Base score
      
      // Score based on genres
      if (item.genres && Array.isArray(item.genres)) {
        item.genres.forEach(genre => {
          const genrePreference = profile.preferences.genres[genre] || 0;
          score += genrePreference * 0.5;
        });
      }
      
      // Score based on actors
      if (item.cast && Array.isArray(item.cast)) {
        item.cast.forEach(actor => {
          const actorPreference = profile.preferences.actors[actor.name] || 0;
          score += actorPreference * 0.3;
        });
      }
      
      // Score based on keywords
      if (item.keywords && Array.isArray(item.keywords)) {
        item.keywords.forEach(keyword => {
          const keywordName = typeof keyword === 'object' ? keyword.name : keyword;
          const keywordPreference = profile.preferences.keywords[keywordName] || 0;
          score += keywordPreference * 0.2;
        });
      }
      
      // Give extra points to items from similar content
      if (item.source === 'similar') {
        score += 1;
      }
      
      return { ...item, score };
    });
  }
  
  /**
   * Get detailed content information for recommendations
   * @param {Array} items - Content items
   * @returns {Promise<Array>} Detailed content items
   */
  async getContentDetails(items) {
    try {
      // Group items by type to batch requests
      const movieIds = items.filter(item => item.type === 'movie').map(item => item.id);
      const tvIds = items.filter(item => item.type === 'tv').map(item => item.id);
      
      const detailedItems = [...items];
      
      // Get detailed information for movies
      await Promise.all(movieIds.map(async (id) => {
        try {
          const response = await axios.get(`${this.baseUrl}/movie/${id}`, {
            params: {
              api_key: this.tmdbApiKey,
              append_to_response: 'credits,keywords'
            }
          });
          
          const index = detailedItems.findIndex(item => item.id === id && item.type === 'movie');
          if (index !== -1) {
            detailedItems[index] = {
              ...detailedItems[index],
              genres: response.data.genres.map(g => g.name),
              cast: response.data.credits.cast.slice(0, 5).map(actor => ({
                name: actor.name,
                character: actor.character
              })),
              keywords: response.data.keywords.keywords || []
            };
          }
        } catch (error) {
          console.error(`Error getting movie details for ID ${id}:`, error);
        }
      }));
      
      // Get detailed information for TV shows
      await Promise.all(tvIds.map(async (id) => {
        try {
          const response = await axios.get(`${this.baseUrl}/tv/${id}`, {
            params: {
              api_key: this.tmdbApiKey,
              append_to_response: 'credits,keywords'
            }
          });
          
          const index = detailedItems.findIndex(item => item.id === id && item.type === 'tv');
          if (index !== -1) {
            detailedItems[index] = {
              ...detailedItems[index],
              genres: response.data.genres.map(g => g.name),
              cast: response.data.credits.cast.slice(0, 5).map(actor => ({
                name: actor.name,
                character: actor.character
              })),
              keywords: response.data.keywords.results || []
            };
          }
        } catch (error) {
          console.error(`Error getting TV details for ID ${id}:`, error);
        }
      }));
      
      return detailedItems;
    } catch (error) {
      console.error('Error getting content details:', error);
      return items;
    }
  }
  
  /**
   * Get top entities from a preference map
   * @param {Object} preferences - Map of entity names to preference scores
   * @param {number} limit - Maximum number of entities to return
   * @returns {Array} Top entities with scores
   */
  getTopEntities(preferences, limit = 3) {
    return Object.entries(preferences)
      .map(([name, score]) => ({ name, score }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Remove duplicate items from an array based on a key
   * @param {Array} array - Array of items
   * @param {string} key - Key to use for deduplication
   * @returns {Array} Deduplicated array
   */
  removeDuplicates(array, key) {
    return Array.from(new Map(array.map(item => [item[key], item])).values());
  }
  
  /**
   * Shuffle an array in place
   * @param {Array} array - Array to shuffle
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  /**
   * Generate AI-enhanced personalized recommendations
   * @param {string} userId - User identifier
   * @param {Object} profile - User profile data
   * @param {number} limit - Maximum number of recommendations
   * @returns {Promise<Array>} Enhanced recommendations
   */
  async generateAIRecommendations(userId, limit = 5) {
    try {
      if (!this.userProfiles.has(userId)) {
        return [];
      }
      
      const profile = this.userProfiles.get(userId);
      
      // Extract user preferences and history
      const topGenres = this.getTopEntities(profile.preferences.genres, 5)
        .map(g => g.name)
        .join(', ');
      
      const recentlyWatched = profile.contentHistory
        .slice(-5)
        .map(c => c.title)
        .join(', ');
      
      const topKeywords = this.getTopEntities(profile.preferences.keywords, 5)
        .map(k => k.name)
        .join(', ');
      
      const topActors = this.getTopEntities(profile.preferences.actors, 5)
        .map(a => a.name)
        .join(', ');
      
      // Extract recent questions to understand interests
      const recentQuestions = profile.interactionHistory
        .filter(i => i.action === 'question')
        .slice(-10)
        .map(i => i.details.question || '')
        .join('; ');
      
      // Generate recommendations using GPT
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a personalized content recommendation system. Based on the user's viewing history, 
            preferences, and questions they've asked, recommend content they might enjoy. 
            For each recommendation, provide a brief reason why they might like it that references their specific tastes.
            Format your response as a JSON array with objects containing: title, type (movie/tv), year, and reason.`
          },
          {
            role: "user",
            content: `Generate ${limit} highly personalized recommendations based on this profile:
            
            - Favorite genres: ${topGenres || 'No data'}
            - Recently watched: ${recentlyWatched || 'No data'}
            - Favorite actors: ${topActors || 'No data'}
            - Interests based on keywords: ${topKeywords || 'No data'}
            - Recent questions asked: ${recentQuestions || 'No data'}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });
      
      // Parse the response
      let recommendations;
      try {
        const content = JSON.parse(response.choices[0].message.content);
        recommendations = content.recommendations || [];
      } catch (error) {
        console.error('Error parsing AI recommendations:', error);
        return [];
      }
      
      return recommendations.map(rec => ({
        title: rec.title,
        type: rec.type,
        year: rec.year,
        reason: rec.reason,
        source: 'ai'
      }));
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return [];
    }
  }
}

module.exports = RecommendationService; 