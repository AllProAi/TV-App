/**
 * Connection Manager component for the mobile app
 * Handles WebSocket connections and reconnection logic
 */
class ConnectionManager {
  /**
   * Initialize ConnectionManager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      serverUrl: options.serverUrl || 'http://localhost:3000',
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      ...options
    };
    
    this.io = options.io; // Socket.io client
    this.socket = null;
    this.sessionId = null;
    this.connected = false;
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.eventListeners = {};
    
    // Initialize connection if sessionId is provided
    if (options.sessionId) {
      this.connect(options.sessionId);
    }
  }
  
  /**
   * Connect to WebSocket server
   * @param {string} sessionId - Session ID for connection
   * @returns {Promise} - Resolves when connected
   */
  connect(sessionId) {
    return new Promise((resolve, reject) => {
      if (!this.io) {
        reject(new Error('Socket.io client not available'));
        return;
      }
      
      this.sessionId = sessionId;
      
      // Initialize mobile namespace socket
      this.socket = this.io(`${this.options.serverUrl}/mobile`);
      
      // Setup connection event handlers
      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Join session
        this.socket.emit('join:session', {
          sessionId: this.sessionId,
          deviceInfo: this.getDeviceInfo()
        });
        
        this.triggerEvent('connected');
        resolve(this.socket);
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.connected = false;
        this.triggerEvent('error', { type: 'connect_error', error });
        
        if (!this.reconnecting) {
          this.startReconnection();
        }
        
        reject(error);
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        this.connected = false;
        this.triggerEvent('disconnected', { reason });
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect automatically
          this.triggerEvent('error', { 
            type: 'server_disconnect',
            message: 'The server disconnected the client'
          });
        } else {
          // Client-side disconnection, try to reconnect
          if (!this.reconnecting) {
            this.startReconnection();
          }
        }
      });
      
      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
        this.triggerEvent('error', { type: 'socket_error', error });
      });
      
      // Server-side events
      this.socket.on('session:joined', (data) => {
        console.log('Joined session:', data);
        this.triggerEvent('session:joined', data);
      });
      
      this.socket.on('error', (data) => {
        console.error('Server error:', data);
        this.triggerEvent('error', { type: 'server_error', ...data });
      });
    });
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connected = false;
    this.stopReconnection();
    this.triggerEvent('disconnected', { reason: 'manual' });
  }
  
  /**
   * Start reconnection process
   */
  startReconnection() {
    this.reconnecting = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.reconnecting = false;
        this.triggerEvent('error', { 
          type: 'max_reconnect_attempts',
          message: 'Maximum reconnection attempts reached'
        });
        return;
      }
      
      this.reconnectAttempts++;
      
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);
      this.triggerEvent('reconnecting', { attempt: this.reconnectAttempts });
      
      // Try to reconnect
      if (this.socket) {
        this.socket.connect();
      } else if (this.sessionId) {
        this.connect(this.sessionId).catch(() => {
          // If reconnection fails, try again
          this.startReconnection();
        });
      }
    }, this.options.reconnectInterval);
  }
  
  /**
   * Stop reconnection process
   */
  stopReconnection() {
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Get device information
   * @returns {Object} - Device information
   */
  getDeviceInfo() {
    const info = {
      type: 'mobile',
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
      timestamp: Date.now()
    };
    
    // Try to detect mobile OS
    if (/android/i.test(navigator.userAgent)) {
      info.os = 'Android';
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
      info.os = 'iOS';
    } else if (/Windows/.test(navigator.userAgent)) {
      info.os = 'Windows';
    } else if (/Mac OS X/.test(navigator.userAgent)) {
      info.os = 'MacOS';
    } else {
      info.os = 'Unknown';
    }
    
    return info;
  }
  
  /**
   * Check if connected to server
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
  
  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    this.eventListeners[event].push(callback);
    return this;
  }
  
  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  off(event, callback) {
    if (!this.eventListeners[event]) return this;
    
    if (callback) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    } else {
      delete this.eventListeners[event];
    }
    
    return this;
  }
  
  /**
   * Trigger event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  triggerEvent(event, data) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ConnectionManager ${event} event handler:`, error);
      }
    });
  }
  
  /**
   * Destroy the connection manager
   */
  destroy() {
    this.disconnect();
    this.eventListeners = {};
  }
}

export default ConnectionManager; 