/**
 * AIAssistant component for displaying AI responses and interactions
 */
class AIAssistant {
  /**
   * Create a new AIAssistant instance
   * @param {HTMLElement} container - Container element for the AI assistant
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      socket: options.socket || null,
      sessionId: options.sessionId || null,
      messageLimit: options.messageLimit || 10,
      autoHideDelay: options.autoHideDelay || 30000, // 30 seconds
      ...options
    };
    
    this.messagesElement = this.container.querySelector('#ai-messages');
    this.closeButton = this.container.querySelector('.ai-close');
    this.messages = [];
    this.autoHideTimer = null;
    this.eventListeners = {};
    
    this.initialize();
  }
  
  /**
   * Initialize the AI assistant
   */
  initialize() {
    if (!this.messagesElement) {
      console.error('AI messages container not found');
      return;
    }
    
    // Set up close button
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => {
        this.hide();
        this.triggerEvent('close');
      });
    }
    
    // Set up socket listeners
    this.setupSocketListeners();
  }
  
  /**
   * Set up socket event listeners
   */
  setupSocketListeners() {
    if (!this.options.socket) return;
    
    this.options.socket.on('query:received', (data) => {
      if (data.sessionId === this.options.sessionId) {
        this.showResponse(data.query, data.response);
      }
    });
  }
  
  /**
   * Show a response from the AI
   * @param {Object} query - User query object
   * @param {Object} response - AI response object
   */
  showResponse(query, response) {
    // Add the message
    this.addMessage('user', query.text || query);
    this.addMessage('ai', response.text || response);
    
    // Show the assistant
    this.show();
    
    // Auto-hide after delay if enabled
    this.resetAutoHideTimer();
  }
  
  /**
   * Add a message to the display
   * @param {string} role - Message role ('user' or 'ai')
   * @param {string} text - Message text
   */
  addMessage(role, text) {
    // Create message object
    const message = {
      role,
      text,
      timestamp: Date.now(),
      element: null
    };
    
    // Add to messages array
    this.messages.push(message);
    
    // Limit the number of messages
    if (this.messages.length > this.options.messageLimit) {
      const removedMessage = this.messages.shift();
      if (removedMessage.element) {
        removedMessage.element.remove();
      }
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}-message`;
    
    // Format timestamp
    const date = new Date(message.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    // Add content
    messageElement.innerHTML = `
      <div class="message-header">
        <span class="message-role">${role === 'user' ? 'You' : 'AI'}</span>
        <span class="message-time">${timeStr}</span>
      </div>
      <div class="message-text">${this.formatMessageText(text)}</div>
    `;
    
    // Store element reference
    message.element = messageElement;
    
    // Add to messages container
    this.messagesElement.appendChild(messageElement);
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  /**
   * Format message text with markdown-like syntax
   * @param {string} text - Message text to format
   * @returns {string} - Formatted HTML
   */
  formatMessageText(text) {
    if (!text) return '';
    
    // Convert line breaks to <br>
    let formatted = text.replace(/\n/g, '<br>');
    
    // Bold text between ** **
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text between * *
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert timestamps [00:00] to spans
    formatted = formatted.replace(/\[(\d{1,2}:\d{2})\]/g, '<span class="timestamp">[$1]</span>');
    
    return formatted;
  }
  
  /**
   * Show the AI assistant
   */
  show() {
    this.container.classList.remove('hidden');
    this.scrollToBottom();
    this.triggerEvent('show');
  }
  
  /**
   * Hide the AI assistant
   */
  hide() {
    this.container.classList.add('hidden');
    this.clearAutoHideTimer();
    this.triggerEvent('hide');
  }
  
  /**
   * Toggle visibility of the AI assistant
   */
  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }
  
  /**
   * Reset the auto-hide timer
   */
  resetAutoHideTimer() {
    this.clearAutoHideTimer();
    
    if (this.options.autoHideDelay > 0) {
      this.autoHideTimer = setTimeout(() => {
        this.hide();
      }, this.options.autoHideDelay);
    }
  }
  
  /**
   * Clear the auto-hide timer
   */
  clearAutoHideTimer() {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }
  
  /**
   * Scroll the messages container to the bottom
   */
  scrollToBottom() {
    if (this.messagesElement) {
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }
  }
  
  /**
   * Clear all messages
   */
  clearMessages() {
    this.messages = [];
    if (this.messagesElement) {
      this.messagesElement.innerHTML = '';
    }
  }
  
  /**
   * Subscribe to component events
   * @param {string} eventName - Event name
   * @param {Function} callback - Event callback
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    
    this.eventListeners[eventName].push(callback);
    return this;
  }
  
  /**
   * Unsubscribe from component events
   * @param {string} eventName - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(eventName, callback) {
    if (!this.eventListeners[eventName]) return this;
    
    if (callback) {
      this.eventListeners[eventName] = this.eventListeners[eventName]
        .filter(cb => cb !== callback);
    } else {
      delete this.eventListeners[eventName];
    }
    
    return this;
  }
  
  /**
   * Trigger an event
   * @param {string} eventName - Event name
   * @param {*} data - Event data
   */
  triggerEvent(eventName, data) {
    if (!this.eventListeners[eventName]) return;
    
    this.eventListeners[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventName} event handler:`, error);
      }
    });
  }
}

export default AIAssistant; 