/**
 * Service for managing shared viewing sessions with synchronized playback
 * and collaborative Q&A across multiple devices
 */
class SharedViewingService {
  constructor() {
    // Map of session IDs to session data
    this.sessions = new Map();
    
    // Map of user IDs to session IDs
    this.userSessions = new Map();
    
    // Map of session IDs to arrays of connected socket IDs
    this.sessionSockets = new Map();
  }
  
  /**
   * Create a new shared viewing session
   * @param {string} hostUserId - ID of the user hosting the session
   * @param {Object} mediaInfo - Information about the media being watched
   * @returns {Object} Session information
   */
  createSession(hostUserId, mediaInfo) {
    const sessionId = this.generateSessionId();
    const timestamp = Date.now();
    
    const session = {
      id: sessionId,
      hostUserId,
      mediaInfo,
      participants: [{ userId: hostUserId, role: 'host', joinedAt: timestamp }],
      state: {
        isPlaying: false,
        currentTime: 0,
        lastUpdated: timestamp
      },
      chat: [],
      questions: [],
      createdAt: timestamp,
      lastActive: timestamp
    };
    
    this.sessions.set(sessionId, session);
    this.userSessions.set(hostUserId, sessionId);
    this.sessionSockets.set(sessionId, []);
    
    return {
      sessionId,
      joinCode: this.generateJoinCode(sessionId)
    };
  }
  
  /**
   * Join an existing shared viewing session
   * @param {string} userId - ID of the user joining
   * @param {string} sessionId - ID of the session to join
   * @param {string} joinCode - Code required to join the session
   * @returns {Object} Session information or error
   */
  joinSession(userId, sessionId, joinCode) {
    // Validate the join code
    if (!this.validateJoinCode(sessionId, joinCode)) {
      return { error: 'Invalid join code' };
    }
    
    // Check if the session exists
    if (!this.sessions.has(sessionId)) {
      return { error: 'Session not found' };
    }
    
    const session = this.sessions.get(sessionId);
    const timestamp = Date.now();
    
    // Check if user is already in the session
    const existingParticipant = session.participants.find(p => p.userId === userId);
    
    if (!existingParticipant) {
      // Add the user to the session
      session.participants.push({
        userId,
        role: 'viewer',
        joinedAt: timestamp
      });
    } else {
      // Update the existing participant's last activity
      existingParticipant.lastActive = timestamp;
    }
    
    // Update user-session mapping
    this.userSessions.set(userId, sessionId);
    
    // Update session last active timestamp
    session.lastActive = timestamp;
    
    return {
      session: this.getSessionInfo(sessionId)
    };
  }
  
  /**
   * Leave a shared viewing session
   * @param {string} userId - ID of the user leaving
   * @returns {boolean} Success status
   */
  leaveSession(userId) {
    // Check if the user is in a session
    if (!this.userSessions.has(userId)) {
      return false;
    }
    
    const sessionId = this.userSessions.get(userId);
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.userSessions.delete(userId);
      return false;
    }
    
    // Remove the user from the session participants
    session.participants = session.participants.filter(p => p.userId !== userId);
    
    // Update the user-session mapping
    this.userSessions.delete(userId);
    
    // If the host leaves, either promote another participant or close the session
    if (session.hostUserId === userId) {
      if (session.participants.length > 0) {
        // Promote the longest-connected participant to host
        const newHost = session.participants.sort((a, b) => a.joinedAt - b.joinedAt)[0];
        session.hostUserId = newHost.userId;
        newHost.role = 'host';
      } else {
        // No participants left, close the session
        this.closeSession(sessionId);
        return true;
      }
    }
    
    // Update session last active timestamp
    session.lastActive = Date.now();
    
    return true;
  }
  
  /**
   * Close a shared viewing session
   * @param {string} sessionId - ID of the session to close
   * @returns {boolean} Success status
   */
  closeSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      return false;
    }
    
    const session = this.sessions.get(sessionId);
    
    // Remove all user-session mappings for this session
    session.participants.forEach(participant => {
      this.userSessions.delete(participant.userId);
    });
    
    // Delete the session and its socket mappings
    this.sessions.delete(sessionId);
    this.sessionSockets.delete(sessionId);
    
    return true;
  }
  
  /**
   * Update the playback state for a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User making the update
   * @param {Object} state - New playback state
   * @returns {Object} Updated session state or error
   */
  updatePlaybackState(sessionId, userId, state) {
    if (!this.sessions.has(sessionId)) {
      return { error: 'Session not found' };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Only the host or participants with control permissions can update playback
    const participant = session.participants.find(p => p.userId === userId);
    if (!participant || (participant.role !== 'host' && !participant.canControl)) {
      return { error: 'Permission denied' };
    }
    
    // Update the playback state
    session.state = {
      isPlaying: state.isPlaying !== undefined ? state.isPlaying : session.state.isPlaying,
      currentTime: state.currentTime !== undefined ? state.currentTime : session.state.currentTime,
      lastUpdated: Date.now()
    };
    
    // Update session last active timestamp
    session.lastActive = Date.now();
    
    return { state: session.state };
  }
  
  /**
   * Add a socket connection to a session
   * @param {string} sessionId - Session ID
   * @param {string} socketId - Socket ID
   * @returns {boolean} Success status
   */
  addSocketToSession(sessionId, socketId) {
    if (!this.sessions.has(sessionId) || !this.sessionSockets.has(sessionId)) {
      return false;
    }
    
    const sockets = this.sessionSockets.get(sessionId);
    if (!sockets.includes(socketId)) {
      sockets.push(socketId);
    }
    
    return true;
  }
  
  /**
   * Remove a socket connection from a session
   * @param {string} socketId - Socket ID to remove
   * @returns {boolean} Success status
   */
  removeSocketFromAllSessions(socketId) {
    for (const [sessionId, sockets] of this.sessionSockets.entries()) {
      const index = sockets.indexOf(socketId);
      if (index !== -1) {
        sockets.splice(index, 1);
      }
    }
    
    return true;
  }
  
  /**
   * Get the active session for a user
   * @param {string} userId - User ID
   * @returns {Object} Session information or null
   */
  getUserSession(userId) {
    if (!this.userSessions.has(userId)) {
      return null;
    }
    
    const sessionId = this.userSessions.get(userId);
    return this.getSessionInfo(sessionId);
  }
  
  /**
   * Get session information
   * @param {string} sessionId - Session ID
   * @returns {Object} Session information or null
   */
  getSessionInfo(sessionId) {
    if (!this.sessions.has(sessionId)) {
      return null;
    }
    
    const session = this.sessions.get(sessionId);
    
    // Return a clean version of the session object
    return {
      id: session.id,
      hostUserId: session.hostUserId,
      mediaInfo: session.mediaInfo,
      participants: session.participants.map(p => ({
        userId: p.userId,
        role: p.role,
        joinedAt: p.joinedAt
      })),
      state: { ...session.state },
      chatCount: session.chat.length,
      questionCount: session.questions.length,
      createdAt: session.createdAt,
      lastActive: session.lastActive
    };
  }
  
  /**
   * Add a chat message to a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID sending the message
   * @param {string} message - Chat message
   * @returns {Object} Added message or error
   */
  addChatMessage(sessionId, userId, message) {
    if (!this.sessions.has(sessionId)) {
      return { error: 'Session not found' };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Check if the user is a participant in the session
    if (!session.participants.some(p => p.userId === userId)) {
      return { error: 'Not a participant in this session' };
    }
    
    const timestamp = Date.now();
    const chatMessage = {
      id: this.generateId(),
      userId,
      message,
      timestamp,
      type: 'chat'
    };
    
    session.chat.push(chatMessage);
    
    // Limit chat history size
    if (session.chat.length > 100) {
      session.chat = session.chat.slice(-100);
    }
    
    // Update session last active timestamp
    session.lastActive = timestamp;
    
    return { message: chatMessage };
  }
  
  /**
   * Add a question to a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID asking the question
   * @param {string} question - Question text
   * @param {number} videoTime - Current video time when the question was asked
   * @returns {Object} Added question or error
   */
  addQuestion(sessionId, userId, question, videoTime) {
    if (!this.sessions.has(sessionId)) {
      return { error: 'Session not found' };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Check if the user is a participant in the session
    if (!session.participants.some(p => p.userId === userId)) {
      return { error: 'Not a participant in this session' };
    }
    
    const timestamp = Date.now();
    const questionObj = {
      id: this.generateId(),
      userId,
      question,
      videoTime,
      timestamp,
      type: 'question',
      answers: [],
      likes: []
    };
    
    session.questions.push(questionObj);
    
    // Update session last active timestamp
    session.lastActive = timestamp;
    
    return { question: questionObj };
  }
  
  /**
   * Add an answer to a question
   * @param {string} sessionId - Session ID
   * @param {string} questionId - Question ID
   * @param {string} userId - User ID answering
   * @param {string} answer - Answer text
   * @returns {Object} Updated question or error
   */
  addAnswer(sessionId, questionId, userId, answer) {
    if (!this.sessions.has(sessionId)) {
      return { error: 'Session not found' };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Check if the user is a participant in the session
    if (!session.participants.some(p => p.userId === userId)) {
      return { error: 'Not a participant in this session' };
    }
    
    // Find the question
    const questionIndex = session.questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) {
      return { error: 'Question not found' };
    }
    
    const question = session.questions[questionIndex];
    
    const timestamp = Date.now();
    const answerObj = {
      id: this.generateId(),
      userId,
      answer,
      timestamp,
      likes: []
    };
    
    question.answers.push(answerObj);
    
    // Update session last active timestamp
    session.lastActive = timestamp;
    
    return { question: session.questions[questionIndex] };
  }
  
  /**
   * Like a question or answer
   * @param {string} sessionId - Session ID
   * @param {string} itemId - Question or answer ID
   * @param {string} userId - User ID liking the item
   * @param {string} type - Type of item (question or answer)
   * @returns {Object} Updated question or error
   */
  likeItem(sessionId, itemId, userId, type) {
    if (!this.sessions.has(sessionId)) {
      return { error: 'Session not found' };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Check if the user is a participant in the session
    if (!session.participants.some(p => p.userId === userId)) {
      return { error: 'Not a participant in this session' };
    }
    
    if (type === 'question') {
      // Find the question
      const questionIndex = session.questions.findIndex(q => q.id === itemId);
      if (questionIndex === -1) {
        return { error: 'Question not found' };
      }
      
      const question = session.questions[questionIndex];
      
      // Add like if not already liked
      if (!question.likes.includes(userId)) {
        question.likes.push(userId);
      }
      
      return { question };
    } else if (type === 'answer') {
      // Find the question containing the answer
      for (const question of session.questions) {
        const answerIndex = question.answers.findIndex(a => a.id === itemId);
        if (answerIndex !== -1) {
          const answer = question.answers[answerIndex];
          
          // Add like if not already liked
          if (!answer.likes.includes(userId)) {
            answer.likes.push(userId);
          }
          
          return { question };
        }
      }
      
      return { error: 'Answer not found' };
    }
    
    return { error: 'Invalid item type' };
  }
  
  /**
   * Get chat history for a session
   * @param {string} sessionId - Session ID
   * @param {number} limit - Maximum number of messages to return
   * @param {number} before - Timestamp to get messages before
   * @returns {Array} Chat messages
   */
  getChatHistory(sessionId, limit = 50, before = Date.now()) {
    if (!this.sessions.has(sessionId)) {
      return [];
    }
    
    const session = this.sessions.get(sessionId);
    
    return session.chat
      .filter(msg => msg.timestamp < before)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Get questions for a session
   * @param {string} sessionId - Session ID
   * @param {string} sortBy - Sort method (newest, popular, unanswered)
   * @param {number} limit - Maximum number of questions to return
   * @returns {Array} Questions
   */
  getQuestions(sessionId, sortBy = 'newest', limit = 20) {
    if (!this.sessions.has(sessionId)) {
      return [];
    }
    
    const session = this.sessions.get(sessionId);
    
    let questions = [...session.questions];
    
    // Sort questions
    if (sortBy === 'newest') {
      questions.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === 'popular') {
      questions.sort((a, b) => b.likes.length - a.likes.length);
    } else if (sortBy === 'unanswered') {
      questions = questions.filter(q => q.answers.length === 0);
      questions.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return questions.slice(0, limit);
  }
  
  /**
   * Send information to mobile device
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID sending information
   * @param {string} type - Type of information (link, note, timestamp)
   * @param {Object} data - Information data
   * @returns {Object} Result
   */
  sendToMobile(sessionId, userId, type, data) {
    if (!this.sessions.has(sessionId)) {
      return { error: 'Session not found' };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Check if the user is a participant in the session
    if (!session.participants.some(p => p.userId === userId)) {
      return { error: 'Not a participant in this session' };
    }
    
    const timestamp = Date.now();
    const info = {
      id: this.generateId(),
      userId,
      type,
      data,
      timestamp,
      videoTime: session.state.currentTime
    };
    
    // We'll return the info object to be sent through WebSockets to the mobile device
    return { info };
  }
  
  /**
   * Generate a unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }
  
  /**
   * Generate a unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  }
  
  /**
   * Generate a join code for a session
   * @param {string} sessionId - Session ID
   * @returns {string} Join code
   */
  generateJoinCode(sessionId) {
    // Create a 6-character alphanumeric code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters.charAt(randomIndex);
    }
    
    return code;
  }
  
  /**
   * Validate a join code for a session
   * @param {string} sessionId - Session ID
   * @param {string} joinCode - Join code to validate
   * @returns {boolean} Validation result
   */
  validateJoinCode(sessionId, joinCode) {
    // In a real implementation, we would store and validate actual join codes
    // For this prototype, we'll accept any non-empty string as valid
    return joinCode && joinCode.length === 6;
  }
  
  /**
   * Clean up expired sessions
   * @param {number} maxAgeMs - Maximum age of inactive sessions in milliseconds
   */
  cleanupExpiredSessions(maxAgeMs = 3600000) { // Default: 1 hour
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActive > maxAgeMs) {
        this.closeSession(sessionId);
      }
    }
  }
  
  /**
   * Get session socket IDs
   * @param {string} sessionId - Session ID
   * @returns {Array} Socket IDs
   */
  getSessionSockets(sessionId) {
    if (!this.sessionSockets.has(sessionId)) {
      return [];
    }
    
    return [...this.sessionSockets.get(sessionId)];
  }
  
  /**
   * Get all active sessions
   * @returns {Array} Active sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      hostUserId: session.hostUserId,
      mediaInfo: {
        title: session.mediaInfo.title
      },
      participantCount: session.participants.length,
      createdAt: session.createdAt,
      lastActive: session.lastActive
    }));
  }
}

module.exports = SharedViewingService; 