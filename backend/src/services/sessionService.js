const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// In-memory session store for demo
const sessions = {};

/**
 * Create a new viewing session
 * @param {Object} options - Session creation options
 * @returns {Promise<Object>} - Session details with QR code
 */
async function createSession(options = {}) {
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    created: new Date(),
    expires: new Date(Date.now() + (options.duration || 24 * 60 * 60 * 1000)), // Default 24 hours
    subtitles: [],
    connected: {
      tv: false,
      mobile: []
    },
    settings: {
      subtitlesEnabled: true,
      aiAssistantEnabled: true,
      ...options.settings
    },
    content: options.content || {
      title: "Demo Content",
      source: "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd",
      type: "application/dash+xml"
    }
  };
  
  // Store in memory
  sessions[sessionId] = session;
  
  // Generate QR code for mobile pairing
  const baseUrl = process.env.MOBILE_APP_URL || 'https://memorystream-mobile.example.com';
  const pairingUrl = `${baseUrl}?session=${sessionId}`;
  const qrCode = await QRCode.toDataURL(pairingUrl);
  
  return {
    sessionId,
    pairingUrl,
    qrCode,
    expires: session.expires,
    content: session.content
  };
}

/**
 * Get session details by ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} - Session details or null if not found
 */
function getSession(sessionId) {
  const session = sessions[sessionId];
  
  if (!session) return null;
  
  // Check if session has expired
  if (new Date() > new Date(session.expires)) {
    // Session expired, clean it up
    deleteSession(sessionId);
    return null;
  }
  
  return session;
}

/**
 * Update session details
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} - Success status
 */
function updateSession(sessionId, updates) {
  const session = sessions[sessionId];
  
  if (!session) return false;
  
  // Apply updates
  if (updates.settings) {
    session.settings = {
      ...session.settings,
      ...updates.settings
    };
  }
  
  if (updates.content) {
    session.content = {
      ...session.content,
      ...updates.content
    };
  }
  
  if (updates.expires) {
    session.expires = new Date(updates.expires);
  }
  
  return true;
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID
 * @returns {boolean} - Success status
 */
function deleteSession(sessionId) {
  if (!sessions[sessionId]) return false;
  
  delete sessions[sessionId];
  return true;
}

/**
 * Add subtitle to session
 * @param {string} sessionId - Session ID
 * @param {Object} subtitle - Subtitle object
 * @returns {boolean} - Success status
 */
function addSubtitle(sessionId, subtitle) {
  const session = sessions[sessionId];
  
  if (!session) return false;
  
  session.subtitles.push({
    ...subtitle,
    timestamp: subtitle.timestamp || Date.now()
  });
  
  // Optionally limit the number of stored subtitles to prevent memory bloat
  if (session.subtitles.length > 1000) {
    session.subtitles = session.subtitles.slice(-1000);
  }
  
  return true;
}

/**
 * Search subtitles by text or timestamp
 * @param {string} sessionId - Session ID
 * @param {Object} criteria - Search criteria
 * @returns {Array} - Matching subtitles
 */
function searchSubtitles(sessionId, criteria) {
  const session = sessions[sessionId];
  
  if (!session) return [];
  
  let results = [...session.subtitles];
  
  // Filter by timestamp range
  if (criteria.startTime !== undefined && criteria.endTime !== undefined) {
    results = results.filter(subtitle => 
      subtitle.timestamp >= criteria.startTime && 
      subtitle.timestamp <= criteria.endTime
    );
  }
  
  // Filter by text search
  if (criteria.text) {
    const searchTerms = criteria.text.toLowerCase().split(' ');
    results = results.filter(subtitle => {
      const subtitleText = subtitle.text.toLowerCase();
      return searchTerms.some(term => subtitleText.includes(term));
    });
  }
  
  // Sort by relevance or timestamp
  if (criteria.sortBy === 'relevance' && criteria.text) {
    // Simple relevance sorting - count occurrences of search terms
    const searchTerms = criteria.text.toLowerCase().split(' ');
    results.sort((a, b) => {
      const aRelevance = searchTerms.reduce((count, term) => {
        return count + (a.text.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      }, 0);
      
      const bRelevance = searchTerms.reduce((count, term) => {
        return count + (b.text.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      }, 0);
      
      return bRelevance - aRelevance; // Higher relevance first
    });
  } else {
    // Default sort by timestamp
    results.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  // Apply limit
  if (criteria.limit) {
    results = results.slice(0, criteria.limit);
  }
  
  return results;
}

/**
 * Update the connection status for a client
 * @param {string} sessionId - Session ID
 * @param {string} clientType - Type of client ('tv' or 'mobile')
 * @param {Object} connectionInfo - Connection details
 * @returns {boolean} - Success status
 */
function updateConnectionStatus(sessionId, clientType, connectionInfo) {
  const session = sessions[sessionId];
  
  if (!session) return false;
  
  if (clientType === 'tv') {
    session.connected.tv = connectionInfo.connected !== false;
  } else if (clientType === 'mobile') {
    const { socketId, connected, deviceInfo } = connectionInfo;
    
    if (connected === false) {
      // Remove disconnected client
      session.connected.mobile = session.connected.mobile.filter(
        client => client.socketId !== socketId
      );
    } else {
      // Add or update client
      const existingClient = session.connected.mobile.find(
        client => client.socketId === socketId
      );
      
      if (existingClient) {
        existingClient.deviceInfo = deviceInfo || existingClient.deviceInfo;
        existingClient.connected = true;
      } else {
        session.connected.mobile.push({
          socketId,
          deviceInfo: deviceInfo || { type: 'unknown' },
          connected: true
        });
      }
    }
  }
  
  return true;
}

/**
 * Get all active sessions
 * @returns {Array} - List of session IDs with basic info
 */
function getActiveSessions() {
  const now = new Date();
  
  return Object.values(sessions)
    .filter(session => new Date(session.expires) > now)
    .map(session => ({
      id: session.id,
      created: session.created,
      expires: session.expires,
      contentTitle: session.content?.title,
      connectedClients: {
        tv: session.connected.tv ? 1 : 0,
        mobile: session.connected.mobile.length
      }
    }));
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = new Date();
  
  Object.entries(sessions).forEach(([sessionId, session]) => {
    if (new Date(session.expires) <= now) {
      deleteSession(sessionId);
    }
  });
}, 60 * 1000); // Run every minute

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  addSubtitle,
  searchSubtitles,
  updateConnectionStatus,
  getActiveSessions,
  // Expose sessions for direct access from index.js
  getSessions: () => sessions
}; 