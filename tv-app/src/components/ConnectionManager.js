/**
 * ConnectionManager component for managing connection status display
 */
class ConnectionManager {
  /**
   * Create a new ConnectionManager instance
   * @param {HTMLElement} connectionStatusElement - Element for connection status display
   * @param {HTMLElement} mobileStatusElement - Element for mobile connections display
   * @param {Object} options - Configuration options
   */
  constructor(connectionStatusElement, mobileStatusElement, options = {}) {
    this.connectionStatusElement = connectionStatusElement;
    this.mobileStatusElement = mobileStatusElement;
    this.options = {
      socket: options.socket || null,
      ...options
    };
    
    this.socket = this.options.socket;
    this.connectedMobiles = [];
    
    this.initialize();
  }
  
  /**
   * Initialize the connection manager
   */
  initialize() {
    if (this.socket) {
      this.setupSocketListeners();
    }
    
    // Set initial connection status
    this.updateStatus('disconnected');
    this.updateMobileStatus();
  }
  
  /**
   * Set the socket for connection management
   * @param {SocketIOClient.Socket} socket - Socket.io client instance
   */
  setSocket(socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }
  
  /**
   * Set up socket event listeners
   */
  setupSocketListeners() {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      this.updateStatus('connected');
    });
    
    this.socket.on('disconnect', () => {
      this.updateStatus('disconnected');
    });
    
    this.socket.on('connect_error', () => {
      this.updateStatus('error');
    });
    
    this.socket.on('mobile:connected', (data) => {
      this.addMobileClient(data);
    });
    
    this.socket.on('mobile:disconnected', (data) => {
      this.removeMobileClient(data);
    });
  }
  
  /**
   * Update the connection status display
   * @param {string} status - Connection status (connected, disconnected, error)
   */
  updateStatus(status) {
    if (!this.connectionStatusElement) return;
    
    const statusIcon = this.connectionStatusElement.querySelector('.status-icon');
    const statusText = this.connectionStatusElement.querySelector('.status-text');
    
    if (statusIcon && statusText) {
      // Remove all status classes
      ['connected', 'disconnected', 'error'].forEach(cls => {
        this.connectionStatusElement.classList.remove(cls);
      });
      
      // Add new status class
      this.connectionStatusElement.classList.add(status);
      
      // Update text and icon color
      switch (status) {
        case 'connected':
          statusIcon.style.color = 'green';
          statusText.textContent = 'Connected';
          break;
        case 'disconnected':
          statusIcon.style.color = 'red';
          statusText.textContent = 'Disconnected';
          break;
        case 'error':
          statusIcon.style.color = 'orange';
          statusText.textContent = 'Connection Error';
          break;
        default:
          statusIcon.style.color = 'gray';
          statusText.textContent = 'Unknown';
      }
    }
  }
  
  /**
   * Add a mobile client to the connected clients list
   * @param {Object} data - Mobile client data
   */
  addMobileClient(data) {
    // Add to internal list if not already present
    const existingIndex = this.connectedMobiles.findIndex(m => m.socketId === data.socketId);
    if (existingIndex === -1) {
      this.connectedMobiles.push({
        socketId: data.socketId,
        deviceInfo: data.deviceInfo || { type: 'unknown' },
        timestamp: data.timestamp || Date.now()
      });
    }
    
    // Update mobile status display
    this.updateMobileStatus();
  }
  
  /**
   * Remove a mobile client from the connected clients list
   * @param {Object} data - Mobile client data
   */
  removeMobileClient(data) {
    // Remove from internal list
    this.connectedMobiles = this.connectedMobiles.filter(m => m.socketId !== data.socketId);
    
    // Update mobile status display
    this.updateMobileStatus();
  }
  
  /**
   * Update the mobile connections status display
   */
  updateMobileStatus() {
    if (!this.mobileStatusElement) return;
    
    const count = this.connectedMobiles.length;
    const statusText = this.mobileStatusElement.querySelector('.status-text');
    
    if (statusText) {
      statusText.textContent = `${count} connected`;
    }
    
    // Show/hide based on connection count
    if (count > 0) {
      this.mobileStatusElement.classList.remove('hidden');
    } else {
      this.mobileStatusElement.classList.add('hidden');
    }
  }
  
  /**
   * Get the count of connected mobile clients
   * @returns {number} - Number of connected mobile clients
   */
  getConnectedMobilesCount() {
    return this.connectedMobiles.length;
  }
  
  /**
   * Get the list of connected mobile clients
   * @returns {Array} - List of connected mobile clients
   */
  getConnectedMobiles() {
    return [...this.connectedMobiles];
  }
}

export default ConnectionManager; 