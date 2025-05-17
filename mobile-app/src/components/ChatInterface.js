/**
 * Chat Interface component for mobile app
 * Enables content-related Q&A with AI assistant
 */
class ChatInterface {
  /**
   * Initialize Chat Interface
   * @param {HTMLElement} container - Container element for the UI
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.socket = options.socket;
    this.session = options.session;
    this.eventListeners = {};
    
    this.messages = [];
    this.isTyping = false;
    
    this.render();
    this.bindEvents();
    
    // Add some sample suggestions
    this.addSuggestions([
      "Who is that character?",
      "What just happened?",
      "Why did they do that?",
      "Explain the plot so far"
    ]);
  }
  
  /**
   * Render the chat interface UI
   */
  render() {
    this.container.innerHTML = `
      <div class="chat-interface">
        <div class="chat-header">
          <div class="chat-title">Content Assistant</div>
          <div class="chat-status">
            <span class="status-indicator"></span>
            <span class="status-text">Ready</span>
          </div>
        </div>
        
        <div class="chat-messages" id="chatMessages"></div>
        
        <div class="chat-suggestions" id="chatSuggestions"></div>
        
        <div class="chat-input">
          <input type="text" id="chatInput" placeholder="Ask about the content..." autocomplete="off">
          <button class="chat-send-btn" id="chatSendBtn">
            <i class="icon-send"></i>
          </button>
        </div>
      </div>
    `;
    
    // Cache DOM elements
    this.elements = {
      messages: this.container.querySelector('#chatMessages'),
      input: this.container.querySelector('#chatInput'),
      sendButton: this.container.querySelector('#chatSendBtn'),
      suggestions: this.container.querySelector('#chatSuggestions'),
      statusIndicator: this.container.querySelector('.status-indicator'),
      statusText: this.container.querySelector('.status-text')
    };
  }
  
  /**
   * Bind event listeners to UI elements
   */
  bindEvents() {
    // Send message on button click
    this.elements.sendButton.addEventListener('click', () => {
      this.sendMessage();
    });
    
    // Send message on Enter key
    this.elements.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Show/hide suggestions based on input focus
    this.elements.input.addEventListener('focus', () => {
      this.elements.suggestions.classList.add('active');
    });
    
    this.elements.input.addEventListener('blur', () => {
      // Short delay to allow clicking on suggestions
      setTimeout(() => {
        this.elements.suggestions.classList.remove('active');
      }, 200);
    });
    
    // Input typing indicator
    this.elements.input.addEventListener('input', () => {
      if (this.elements.input.value.length > 0) {
        this.elements.input.classList.add('has-text');
      } else {
        this.elements.input.classList.remove('has-text');
      }
    });
    
    // Listen for socket events
    if (this.socket) {
      this.socket.on('response:ai', this.handleAIResponse.bind(this));
      this.socket.on('search:results', this.handleSearchResults.bind(this));
    }
  }
  
  /**
   * Send message to backend
   */
  sendMessage() {
    const message = this.elements.input.value.trim();
    
    if (!message || !this.socket || !this.session) return;
    
    // Clear input
    this.elements.input.value = '';
    this.elements.input.classList.remove('has-text');
    
    // Add message to UI
    this.addMessage({
      text: message,
      type: 'user',
      timestamp: Date.now()
    });
    
    // Update status
    this.updateStatus('thinking');
    
    // Send to server
    this.socket.emit('query:text', {
      query: {
        text: message,
        timestamp: Date.now()
      }
    });
    
    // Trigger event
    this.triggerEvent('messageSent', { text: message });
  }
  
  /**
   * Handle AI response from server
   * @param {Object} response - AI response data
   */
  handleAIResponse(response) {
    // Add message to UI
    this.addMessage({
      text: response.text,
      type: 'ai',
      timestamp: response.timestamp,
      sources: response.sources
    });
    
    // Update status
    this.updateStatus('ready');
    
    // Scroll to bottom
    this.scrollToBottom();
    
    // Trigger event
    this.triggerEvent('responseReceived', response);
  }
  
  /**
   * Handle search results from server
   * @param {Object} results - Search results data
   */
  handleSearchResults(results) {
    if (results.results && results.results.length > 0) {
      // Create message content with results
      let message = `I found ${results.results.length} moments related to "${results.query}":\n\n`;
      
      results.results.forEach((result, index) => {
        message += `${index + 1}. [${result.timestamp}] ${result.text}\n`;
      });
      
      // Add message to UI
      this.addMessage({
        text: message,
        type: 'search',
        timestamp: results.timestamp,
        results: results.results
      });
    } else {
      // No results found
      this.addMessage({
        text: `I couldn't find any content related to "${results.query}".`,
        type: 'ai',
        timestamp: results.timestamp
      });
    }
    
    // Update status
    this.updateStatus('ready');
    
    // Scroll to bottom
    this.scrollToBottom();
    
    // Trigger event
    this.triggerEvent('searchResultsReceived', results);
  }
  
  /**
   * Add message to chat interface
   * @param {Object} message - Message data
   */
  addMessage(message) {
    this.messages.push(message);
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.type}-message`;
    
    // Format timestamp
    const time = new Date(message.timestamp);
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    
    // Message content based on type
    if (message.type === 'user') {
      messageEl.innerHTML = `
        <div class="message-content">${this.formatMessageText(message.text)}</div>
        <div class="message-time">${timeStr}</div>
      `;
    } else if (message.type === 'ai') {
      messageEl.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">${this.formatMessageText(message.text)}</div>
        <div class="message-time">${timeStr}</div>
      `;
      
      // Add source references if available
      if (message.sources && message.sources.length > 0) {
        const sourcesEl = document.createElement('div');
        sourcesEl.className = 'message-sources';
        sourcesEl.innerHTML = '<div class="sources-title">Based on:</div>';
        
        const sourcesList = document.createElement('ul');
        message.sources.slice(0, 3).forEach(source => {
          const sourceTime = this.formatTimestamp(source.timestamp);
          const li = document.createElement('li');
          li.className = 'source-item';
          li.innerHTML = `<span class="source-time">${sourceTime}</span> ${this.truncateText(source.text, 50)}`;
          li.setAttribute('data-time', source.timestamp);
          
          // Add click event to jump to timestamp
          li.addEventListener('click', () => {
            this.jumpToTimestamp(source.timestamp);
          });
          
          sourcesList.appendChild(li);
        });
        
        sourcesEl.appendChild(sourcesList);
        messageEl.appendChild(sourcesEl);
      }
    } else if (message.type === 'search') {
      messageEl.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">${this.formatMessageText(message.text)}</div>
        <div class="message-time">${timeStr}</div>
      `;
      
      // Add clickable results
      if (message.results && message.results.length > 0) {
        const resultsEl = document.createElement('div');
        resultsEl.className = 'search-results';
        
        message.results.forEach(result => {
          const resultItem = document.createElement('div');
          resultItem.className = 'search-result-item';
          resultItem.innerHTML = `
            <span class="result-time">${result.timestamp}</span>
            <span class="result-text">${this.truncateText(result.text, 80)}</span>
          `;
          resultItem.setAttribute('data-time', result.timestamp);
          
          // Add click event to jump to timestamp
          resultItem.addEventListener('click', () => {
            this.jumpToTimestamp(this.parseTimestamp(result.timestamp));
          });
          
          resultsEl.appendChild(resultItem);
        });
        
        messageEl.appendChild(resultsEl);
      }
    } else if (message.type === 'system') {
      messageEl.innerHTML = `
        <div class="message-content system-message">${this.formatMessageText(message.text)}</div>
        <div class="message-time">${timeStr}</div>
      `;
    }
    
    // Add to DOM
    this.elements.messages.appendChild(messageEl);
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  /**
   * Add system message to chat
   * @param {string} text - Message text
   */
  addSystemMessage(text) {
    this.addMessage({
      text,
      type: 'system',
      timestamp: Date.now()
    });
  }
  
  /**
   * Add suggestion buttons
   * @param {Array} suggestions - Array of suggestion texts
   */
  addSuggestions(suggestions) {
    // Clear existing suggestions
    this.elements.suggestions.innerHTML = '';
    
    // Add each suggestion
    suggestions.forEach(text => {
      const button = document.createElement('button');
      button.className = 'suggestion-btn';
      button.textContent = text;
      
      // Add click event
      button.addEventListener('click', () => {
        this.elements.input.value = text;
        this.elements.input.classList.add('has-text');
        this.elements.input.focus();
      });
      
      this.elements.suggestions.appendChild(button);
    });
  }
  
  /**
   * Update connection status
   * @param {string} status - Status type
   * @param {string} message - Optional status message
   */
  updateStatus(status, message) {
    const { statusIndicator, statusText } = this.elements;
    
    // Remove existing status classes
    statusIndicator.classList.remove('status-ready', 'status-thinking', 'status-error', 'status-disconnected');
    
    // Set new status
    switch (status) {
      case 'ready':
        statusIndicator.classList.add('status-ready');
        statusText.textContent = message || 'Ready';
        break;
        
      case 'thinking':
        statusIndicator.classList.add('status-thinking');
        statusText.textContent = message || 'Thinking...';
        break;
        
      case 'error':
        statusIndicator.classList.add('status-error');
        statusText.textContent = message || 'Error';
        break;
        
      case 'disconnected':
        statusIndicator.classList.add('status-disconnected');
        statusText.textContent = message || 'Disconnected';
        break;
    }
  }
  
  /**
   * Format message text with markdown-like syntax
   * @param {string} text - Message text
   * @returns {string} - Formatted HTML
   */
  formatMessageText(text) {
    // Simple markdown-like formatting
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }
  
  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  /**
   * Format timestamp in human-readable format
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} - Formatted timestamp (MM:SS)
   */
  formatTimestamp(timestamp) {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Parse timestamp string to milliseconds
   * @param {string} timestampStr - Timestamp string (MM:SS)
   * @returns {number} - Timestamp in milliseconds
   */
  parseTimestamp(timestampStr) {
    const [minutes, seconds] = timestampStr.split(':').map(Number);
    return (minutes * 60 + seconds) * 1000;
  }
  
  /**
   * Jump to specific timestamp in video
   * @param {number} timestamp - Timestamp in milliseconds
   */
  jumpToTimestamp(timestamp) {
    if (this.socket && this.session) {
      this.socket.emit('remote:control', {
        action: {
          type: 'seek',
          timestamp: Date.now(),
          parameters: {
            time: timestamp / 1000 // Convert to seconds
          }
        }
      });
      
      // Add system message
      this.addSystemMessage(`Jumping to ${this.formatTimestamp(timestamp)}`);
      
      // Trigger event
      this.triggerEvent('jumpToTimestamp', { timestamp });
    }
  }
  
  /**
   * Scroll chat container to bottom
   */
  scrollToBottom() {
    const messages = this.elements.messages;
    messages.scrollTop = messages.scrollHeight;
  }
  
  /**
   * Clear all messages
   */
  clearMessages() {
    this.messages = [];
    this.elements.messages.innerHTML = '';
    
    // Add welcome message
    this.addSystemMessage("Ask questions about what you're watching!");
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
        console.error(`Error in ChatInterface ${event} event handler:`, error);
      }
    });
  }
  
  /**
   * Update connection status UI
   * @param {boolean} connected - Connection status
   */
  updateConnectionStatus(connected) {
    this.updateStatus(connected ? 'ready' : 'disconnected');
    
    if (connected) {
      this.container.classList.remove('disconnected');
    } else {
      this.container.classList.add('disconnected');
    }
  }
}

export default ChatInterface; 