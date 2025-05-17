/**
 * SubtitleManager component for handling real-time subtitles
 */
class SubtitleManager {
  /**
   * Create a new SubtitleManager instance
   * @param {HTMLElement} subtitleContainer - The container element for subtitles
   * @param {Object} options - Configuration options
   */
  constructor(subtitleContainer, options = {}) {
    this.subtitleContainer = subtitleContainer;
    this.options = {
      maxVisibleTime: options.maxVisibleTime || 5000, // Time in ms to display each subtitle
      fadeOutTime: options.fadeOutTime || 500, // Time in ms for fade out animation
      maxSubtitles: options.maxSubtitles || 3, // Maximum number of visible subtitles
      fontSize: options.fontSize || '24px',
      fontColor: options.fontColor || '#FFFFFF',
      backgroundColor: options.backgroundColor || 'rgba(0, 0, 0, 0.5)',
      visible: options.visible !== false,
      socket: options.socket || null,
      sessionId: options.sessionId || null,
      ...options
    };
    
    this.subtitles = []; // Array of subtitle objects with timestamp and element
    this.visible = this.options.visible;
    
    this.initialize();
  }
  
  /**
   * Initialize the subtitle manager
   */
  initialize() {
    // Set up styles for subtitle container
    this.subtitleContainer.style.position = 'absolute';
    this.subtitleContainer.style.bottom = '10%';
    this.subtitleContainer.style.width = '100%';
    this.subtitleContainer.style.textAlign = 'center';
    this.subtitleContainer.style.color = this.options.fontColor;
    this.subtitleContainer.style.fontSize = this.options.fontSize;
    this.subtitleContainer.style.display = this.visible ? 'block' : 'none';
    this.subtitleContainer.setAttribute('aria-live', 'polite');
    
    // Connect to socket events if provided
    this.connectSocketEvents();
  }
  
  /**
   * Connect to socket.io events for real-time subtitles
   */
  connectSocketEvents() {
    if (!this.options.socket) return;
    
    this.options.socket.on('subtitle:new', (data) => {
      // Verify this subtitle is for our session
      if (data.sessionId === this.options.sessionId) {
        this.addSubtitle(data.subtitle.text, data.subtitle);
      }
    });
  }
  
  /**
   * Add a new subtitle
   * @param {string} text - Subtitle text
   * @param {Object} data - Additional subtitle data
   */
  addSubtitle(text, data = {}) {
    if (!this.visible) return;
    
    // Create subtitle element
    const subtitleElement = document.createElement('div');
    subtitleElement.className = 'subtitle';
    subtitleElement.style.backgroundColor = this.options.backgroundColor;
    subtitleElement.style.padding = '8px 16px';
    subtitleElement.style.margin = '4px auto';
    subtitleElement.style.borderRadius = '4px';
    subtitleElement.style.maxWidth = '80%';
    subtitleElement.style.display = 'inline-block';
    subtitleElement.style.transition = `opacity ${this.options.fadeOutTime}ms ease`;
    
    // Set subtitle text
    subtitleElement.textContent = text;
    
    // Add speaker identification if available
    if (data.speaker) {
      const speakerElement = document.createElement('span');
      speakerElement.className = 'subtitle-speaker';
      speakerElement.textContent = data.speaker + ': ';
      speakerElement.style.fontWeight = 'bold';
      speakerElement.style.marginRight = '4px';
      
      // Insert speaker before text
      subtitleElement.textContent = '';
      subtitleElement.appendChild(speakerElement);
      subtitleElement.appendChild(document.createTextNode(text));
    }
    
    // Add confidence indicator if available
    if (data.confidence !== undefined) {
      // Apply styling based on confidence level
      if (data.confidence < 0.7) {
        subtitleElement.style.fontStyle = 'italic';
      }
    }
    
    // Add subtitle wrapper for proper stacking
    const wrapper = document.createElement('div');
    wrapper.className = 'subtitle-wrapper';
    wrapper.style.marginBottom = '8px';
    wrapper.appendChild(subtitleElement);
    
    // Add to container
    this.subtitleContainer.appendChild(wrapper);
    
    // Add to subtitles array
    const subtitle = {
      text,
      element: wrapper,
      timestamp: data.timestamp || Date.now(),
      data
    };
    
    this.subtitles.push(subtitle);
    
    // Limit number of visible subtitles
    this.pruneSubtitles();
    
    // Set up auto-removal
    setTimeout(() => {
      this.removeSubtitle(subtitle);
    }, this.options.maxVisibleTime);
    
    return subtitle;
  }
  
  /**
   * Remove a subtitle with fade out animation
   * @param {Object} subtitle - Subtitle object to remove
   */
  removeSubtitle(subtitle) {
    if (!subtitle || !subtitle.element) return;
    
    // Apply fade out
    const subtitleEl = subtitle.element.querySelector('.subtitle');
    if (subtitleEl) {
      subtitleEl.style.opacity = '0';
    }
    
    // Remove after animation
    setTimeout(() => {
      if (subtitle.element && subtitle.element.parentNode) {
        subtitle.element.parentNode.removeChild(subtitle.element);
      }
      
      // Remove from array
      this.subtitles = this.subtitles.filter(s => s !== subtitle);
    }, this.options.fadeOutTime);
  }
  
  /**
   * Ensure we don't exceed the maximum number of visible subtitles
   */
  pruneSubtitles() {
    // If we exceed max subtitles, remove oldest
    while (this.subtitles.length > this.options.maxSubtitles) {
      const oldest = this.subtitles[0];
      this.removeSubtitle(oldest);
      // Remove directly from array so we don't get into an infinite loop
      this.subtitles.shift();
    }
  }
  
  /**
   * Toggle subtitle visibility
   * @returns {boolean} - New visibility state
   */
  toggleVisibility() {
    this.visible = !this.visible;
    this.subtitleContainer.style.display = this.visible ? 'block' : 'none';
    return this.visible;
  }
  
  /**
   * Set subtitle visibility
   * @param {boolean} visible - Visibility state
   */
  setVisibility(visible) {
    this.visible = visible;
    this.subtitleContainer.style.display = this.visible ? 'block' : 'none';
  }
  
  /**
   * Clear all subtitles
   */
  clearSubtitles() {
    // Remove all subtitle elements
    while (this.subtitleContainer.firstChild) {
      this.subtitleContainer.removeChild(this.subtitleContainer.firstChild);
    }
    
    // Clear subtitles array
    this.subtitles = [];
  }
  
  /**
   * Add a subtitle from video time update
   * @param {number} currentTime - Current video time in seconds
   * @param {Array} subtitleData - Array of subtitle data objects
   */
  updateFromTimedSubtitles(currentTime, subtitleData) {
    if (!this.visible || !subtitleData || !subtitleData.length) return;
    
    // Find subtitles that should be visible at current time
    const activeSubtitles = subtitleData.filter(subtitle => {
      return subtitle.start <= currentTime && subtitle.end >= currentTime;
    });
    
    // Only add new subtitle if it's different from the most recent one
    if (activeSubtitles.length > 0) {
      const latestSubtitle = activeSubtitles[activeSubtitles.length - 1];
      const mostRecent = this.subtitles[this.subtitles.length - 1];
      
      if (!mostRecent || mostRecent.text !== latestSubtitle.text) {
        this.addSubtitle(latestSubtitle.text, latestSubtitle);
      }
    }
  }
  
  /**
   * Get all current subtitles
   * @returns {Array} - Array of subtitle objects
   */
  getSubtitles() {
    return [...this.subtitles];
  }
}

export default SubtitleManager; 