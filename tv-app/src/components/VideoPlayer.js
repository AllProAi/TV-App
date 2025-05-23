import shaka from 'shaka-player';
import * as senza from 'senza-sdk';

/**
 * VideoPlayer component for handling video playback with Shaka Player
 * Integrates with Senza platform when available
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
      useSenzaPlayer: options.useSenzaPlayer !== false,
      ...options
    };
    
    this.player = null;
    this.senzaPlayerEnabled = false;
    this.eventListeners = {};
    
    this.initialize();
  }
  
  /**
   * Initialize the player (Senza or Shaka)
   */
  async initialize() {
    try {
      // Try to use Senza player if available
      if (this.options.useSenzaPlayer && typeof senza !== 'undefined' && senza.player) {
        await this.initializeSenzaPlayer();
      } else {
        // Fall back to Shaka player
        await this.initializeShakaPlayer();
      }
      
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
   * Initialize Senza platform player
   */
  async initializeSenzaPlayer() {
    try {
      console.log('Initializing Senza platform player');
      
      // Register media player with Senza
      senza.player.registerMediaElement(this.videoElement);
      
      // Set up Senza player event listeners
      senza.player.addEventListener('error', this.onError.bind(this));
      senza.player.addEventListener('statechange', this.onSenzaStateChange.bind(this));
      
      this.senzaPlayerEnabled = true;
      console.log('Senza player initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Senza player:', error);
      console.warn('Falling back to Shaka player');
      // Fall back to Shaka player
      await this.initializeShakaPlayer();
    }
  }
  
  /**
   * Initialize Shaka Player
   */
  async initializeShakaPlayer() {
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
    
    console.log('Shaka player initialized successfully');
  }

  /**
   * Handle Senza player state changes
   * @param {Event} event - State change event
   */
  onSenzaStateChange(event) {
    const state = event.detail.state;
    console.log('Senza player state changed:', state);
    
    switch (state) {
      case 'playing':
        this.triggerEvent('play');
        break;
      case 'paused':
        this.triggerEvent('pause');
        break;
      case 'ended':
        this.triggerEvent('ended');
        break;
      case 'buffering':
        this.triggerEvent('buffering', true);
        break;
      case 'ready':
        this.triggerEvent('buffering', false);
        break;
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
      
      if (this.senzaPlayerEnabled) {
        // Load content using Senza player
        await senza.player.load({
          url: url,
          type: mimeType
        });
      } else {
        // Load content using Shaka player
        await this.player.load(url, null, mimeType);
      }
      
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
    if (this.senzaPlayerEnabled) {
      senza.player.play();
    } else {
      this.videoElement.play();
    }
  }
  
  /**
   * Pause the video
   */
  pause() {
    if (this.senzaPlayerEnabled) {
      senza.player.pause();
    } else {
      this.videoElement.pause();
    }
  }
  
  /**
   * Toggle between play and pause
   */
  togglePlayPause() {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }
  
  /**
   * Seek to a specific time
   * @param {number} time - Time in seconds
   */
  seekTo(time) {
    try {
      const duration = this.getDuration();
      const safeTime = Math.max(0, Math.min(time, duration));
      
      if (this.senzaPlayerEnabled) {
        senza.player.seek(safeTime);
      } else {
        this.videoElement.currentTime = safeTime;
      }
      
      this.triggerEvent('seek', { time: safeTime });
    } catch (error) {
      console.error('Seek error:', error);
    }
  }
  
  /**
   * Seek by a relative amount
   * @param {number} seconds - Seconds to seek forward (positive) or backward (negative)
   */
  seekBy(seconds) {
    try {
      const currentTime = this.getCurrentTime();
      const duration = this.getDuration();
      const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
      
      this.seekTo(newTime);
    } catch (error) {
      console.error('Seek error:', error);
    }
  }
  
  /**
   * Set volume level
   * @param {number} level - Volume level (0-1)
   */
  setVolume(level) {
    const safeLevel = Math.max(0, Math.min(level, 1));
    
    if (this.senzaPlayerEnabled) {
      senza.player.setVolume(safeLevel);
    } 
    
    this.videoElement.volume = safeLevel;
    this.triggerEvent('volumechange', { level: safeLevel });
  }
  
  /**
   * Increase volume
   * @param {number} amount - Amount to increase (0-1)
   */
  increaseVolume(amount = 0.1) {
    const newVolume = Math.min(this.videoElement.volume + amount, 1);
    this.setVolume(newVolume);
  }
  
  /**
   * Decrease volume
   * @param {number} amount - Amount to decrease (0-1)
   */
  decreaseVolume(amount = 0.1) {
    const newVolume = Math.max(this.videoElement.volume - amount, 0);
    this.setVolume(newVolume);
  }
  
  /**
   * Toggle mute state
   */
  toggleMute() {
    const newState = !this.videoElement.muted;
    
    if (this.senzaPlayerEnabled) {
      senza.player.setMuted(newState);
    }
    
    this.videoElement.muted = newState;
    this.triggerEvent('mutechange', { muted: newState });
  }
  
  /**
   * Check if video is currently playing
   * @return {boolean} Is playing
   */
  isPlaying() {
    return !this.videoElement.paused;
  }
  
  /**
   * Get current playback time
   * @return {number} Current time in seconds
   */
  getCurrentTime() {
    return this.videoElement.currentTime;
  }
  
  /**
   * Get video duration
   * @return {number} Duration in seconds
   */
  getDuration() {
    return this.videoElement.duration || 0;
  }
  
  /**
   * Clean up and release resources
   */
  destroy() {
    // Remove event listeners
    this.eventListeners = {};
    
    // Destroy player instance
    if (this.senzaPlayerEnabled) {
      try {
        senza.player.unregisterMediaElement(this.videoElement);
      } catch (error) {
        console.error('Error unregistering from Senza player:', error);
      }
    } else if (this.player) {
      try {
        this.player.destroy();
      } catch (error) {
        console.error('Error destroying Shaka player:', error);
      }
    }
    
    this.player = null;
  }
}

export default VideoPlayer; 