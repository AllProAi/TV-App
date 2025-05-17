import shaka from 'shaka-player';

/**
 * VideoPlayer component for handling video playback with Shaka Player
 */
class VideoPlayer {
  /**
   * Create a new VideoPlayer instance
   * @param {HTMLVideoElement} videoElement - The video element to control
   * @param {Object} options - Configuration options
   */
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement;
    this.options = {
      contentUrl: options.contentUrl || 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd',
      contentType: options.contentType || 'application/dash+xml',
      autoPlay: options.autoPlay !== false,
      startMuted: options.startMuted || false,
      ...options
    };
    
    this.player = null;
    this.eventListeners = {};
    
    this.initialize();
  }
  
  /**
   * Initialize the Shaka Player
   */
  async initialize() {
    try {
      // Install polyfills
      shaka.polyfill.installAll();
      
      // Check browser support
      if (!shaka.Player.isBrowserSupported()) {
        throw new Error('Browser not supported for Shaka Player');
      }
      
      // Create player instance
      this.player = new shaka.Player(this.videoElement);
      
      // Listen for errors
      this.player.addEventListener('error', this.onError.bind(this));
      
      // Configure player
      this.player.configure({
        streaming: {
          bufferingGoal: 30,
          rebufferingGoal: 2,
          bufferBehind: 30
        }
      });
      
      // Set up video element event listeners
      this.setupEventListeners();
      
      // Set initial volume
      this.videoElement.volume = 0.8;
      this.videoElement.muted = this.options.startMuted;
      
      // Load content
      await this.loadContent(this.options.contentUrl, this.options.contentType);
      
      // Auto-play if enabled
      if (this.options.autoPlay) {
        this.play();
      }
    } catch (error) {
      console.error('VideoPlayer initialization error:', error);
      this.triggerEvent('error', error);
    }
  }
  
  /**
   * Load content into the player
   * @param {string} url - Content URL
   * @param {string} mimeType - Content MIME type
   */
  async loadContent(url, mimeType) {
    try {
      this.triggerEvent('loading', { url, mimeType });
      
      // Load manifest
      await this.player.load(url, null, mimeType);
      
      this.triggerEvent('loaded', {
        url,
        mimeType,
        duration: this.videoElement.duration
      });
    } catch (error) {
      console.error('Failed to load content:', error);
      this.triggerEvent('error', error);
      throw error;
    }
  }
  
  /**
   * Handle playback errors
   * @param {Event} event - Error event
   */
  onError(event) {
    console.error('Shaka player error:', event);
    this.triggerEvent('error', event);
  }
  
  /**
   * Set up event listeners for the video element
   */
  setupEventListeners() {
    // Playback events
    this.videoElement.addEventListener('play', () => {
      this.triggerEvent('play');
    });
    
    this.videoElement.addEventListener('pause', () => {
      this.triggerEvent('pause');
    });
    
    this.videoElement.addEventListener('ended', () => {
      this.triggerEvent('ended');
    });
    
    this.videoElement.addEventListener('timeupdate', () => {
      this.triggerEvent('timeupdate', {
        current: this.videoElement.currentTime,
        duration: this.videoElement.duration,
        percent: (this.videoElement.currentTime / this.videoElement.duration) * 100
      });
    });
    
    // Buffering events
    this.videoElement.addEventListener('waiting', () => {
      this.triggerEvent('buffering', true);
    });
    
    this.videoElement.addEventListener('canplay', () => {
      this.triggerEvent('buffering', false);
    });
    
    // Error event
    this.videoElement.addEventListener('error', (e) => {
      this.triggerEvent('error', e);
    });
  }
  
  /**
   * Subscribe to player events
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
   * Unsubscribe from player events
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
   * Trigger event and execute callbacks
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
  
  /**
   * Play the video
   */
  play() {
    try {
      return this.videoElement.play();
    } catch (error) {
      console.error('Play error:', error);
      this.triggerEvent('error', error);
    }
  }
  
  /**
   * Pause the video
   */
  pause() {
    this.videoElement.pause();
  }
  
  /**
   * Toggle between play and pause
   */
  togglePlayPause() {
    if (this.videoElement.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  /**
   * Seek to a specific time
   * @param {number} time - Time in seconds
   */
  seekTo(time) {
    try {
      this.videoElement.currentTime = time;
      this.triggerEvent('seek', time);
    } catch (error) {
      console.error('Seek error:', error);
      this.triggerEvent('error', error);
    }
  }
  
  /**
   * Seek by a relative amount of seconds
   * @param {number} seconds - Number of seconds to seek by (positive or negative)
   */
  seekBy(seconds) {
    const newTime = Math.max(0, Math.min(
      this.videoElement.currentTime + seconds,
      this.videoElement.duration || Infinity
    ));
    
    this.seekTo(newTime);
  }
  
  /**
   * Set volume level
   * @param {number} level - Volume level (0-1)
   */
  setVolume(level) {
    const volume = Math.max(0, Math.min(1, level));
    this.videoElement.volume = volume;
    this.triggerEvent('volumechange', volume);
  }
  
  /**
   * Increase volume by a specified amount
   * @param {number} amount - Amount to increase (default: 0.1)
   */
  increaseVolume(amount = 0.1) {
    this.setVolume(this.videoElement.volume + amount);
  }
  
  /**
   * Decrease volume by a specified amount
   * @param {number} amount - Amount to decrease (default: 0.1)
   */
  decreaseVolume(amount = 0.1) {
    this.setVolume(this.videoElement.volume - amount);
  }
  
  /**
   * Toggle mute state
   */
  toggleMute() {
    this.videoElement.muted = !this.videoElement.muted;
    this.triggerEvent('mutechange', this.videoElement.muted);
  }
  
  /**
   * Check if player is currently playing
   * @returns {boolean} - True if playing
   */
  isPlaying() {
    return !this.videoElement.paused;
  }
  
  /**
   * Get current playback time
   * @returns {number} - Current time in seconds
   */
  getCurrentTime() {
    return this.videoElement.currentTime;
  }
  
  /**
   * Get video duration
   * @returns {number} - Duration in seconds
   */
  getDuration() {
    return this.videoElement.duration;
  }
  
  /**
   * Destroy the player and clean up resources
   */
  destroy() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    
    // Remove all event listeners
    this.eventListeners = {};
  }
}

export default VideoPlayer; 