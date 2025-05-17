/**
 * AdaptiveStreamingManager.js
 * Component for managing adaptive streaming quality based on connection speed
 */

class AdaptiveStreamingManager {
  constructor(videoPlayer, options = {}) {
    this.videoPlayer = videoPlayer;
    this.options = {
      // Thresholds in Kbps
      qualityThresholds: {
        low: 1000,    // 1 Mbps
        medium: 5000,  // 5 Mbps
        high: 10000    // 10 Mbps
      },
      // Default ABR (Adaptive Bitrate) strategy
      defaultAbrStrategy: 'auto',
      // Network speed test interval in ms
      speedTestInterval: 30000, // 30 seconds
      // Initial ABR strategy
      initialAbrStrategy: 'bandwidth',
      // Enable advanced metrics collection
      enableMetrics: true,
      // Override with provided options
      ...options
    };
    
    // Network state
    this.networkState = {
      lastSpeedMeasurement: 0,
      lastMeasurementTime: 0,
      averageSpeed: 0,
      measurements: [],
      connectionType: 'unknown',
      isMetered: false
    };
    
    // Quality settings
    this.currentQuality = 'auto';
    this.preferredQuality = 'auto';
    this.isAdaptiveEnabled = true;
    
    // Monitoring intervals
    this.speedTestIntervalId = null;
    this.networkMonitoringEnabled = false;
    
    // Performance metrics
    this.metrics = {
      bufferingEvents: 0,
      qualitySwitches: 0,
      bufferingDuration: 0,
      lastBufferingEvent: 0,
      initialLoadTime: 0,
      rebufferingRatio: 0,
      bandwidthEstimates: []
    };
    
    // Cache for stream ABR settings
    this.streamConfigurations = new Map();
    
    // Bind methods
    this.updateNetworkInformation = this.updateNetworkInformation.bind(this);
    this.handleBufferingStart = this.handleBufferingStart.bind(this);
    this.handleBufferingEnd = this.handleBufferingEnd.bind(this);
    this.handleQualityChange = this.handleQualityChange.bind(this);
  }

  /**
   * Initialize the adaptive streaming manager
   */
  init() {
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize network information
    this.updateNetworkInformation();
    
    // Start network monitoring
    this.startNetworkMonitoring();
    
    // Configure initial ABR strategy
    this.configureAbrStrategy(this.options.initialAbrStrategy);
    
    // Set up speed test interval
    this.speedTestIntervalId = setInterval(() => {
      this.measureConnectionSpeed();
    }, this.options.speedTestInterval);
    
    console.log('AdaptiveStreamingManager initialized');
  }

  /**
   * Set up event listeners for video and network events
   */
  setupEventListeners() {
    // Listen for player events
    if (this.videoPlayer) {
      // Shaka player events
      if (this.videoPlayer.player) {
        this.videoPlayer.player.addEventListener('buffering', (event) => {
          if (event.buffering) {
            this.handleBufferingStart();
          } else {
            this.handleBufferingEnd();
          }
        });
        
        this.videoPlayer.player.addEventListener('adaptation', this.handleQualityChange);
      }
      
      // HTML5 video element events
      if (this.videoPlayer.video) {
        this.videoPlayer.video.addEventListener('waiting', this.handleBufferingStart);
        this.videoPlayer.video.addEventListener('playing', this.handleBufferingEnd);
      }
    }
    
    // Network information events
    if (navigator.connection) {
      navigator.connection.addEventListener('change', this.updateNetworkInformation);
    }
    
    // Window online/offline events
    window.addEventListener('online', this.updateNetworkInformation);
    window.addEventListener('offline', this.updateNetworkInformation);
  }

  /**
   * Start monitoring network conditions
   */
  startNetworkMonitoring() {
    if (this.networkMonitoringEnabled) return;
    
    this.networkMonitoringEnabled = true;
    
    // Perform initial speed measurement
    this.measureConnectionSpeed();
  }

  /**
   * Stop monitoring network conditions
   */
  stopNetworkMonitoring() {
    this.networkMonitoringEnabled = false;
    
    if (this.speedTestIntervalId) {
      clearInterval(this.speedTestIntervalId);
      this.speedTestIntervalId = null;
    }
  }

  /**
   * Update network information from navigator.connection
   */
  updateNetworkInformation() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      this.networkState.connectionType = connection.type || 'unknown';
      this.networkState.isMetered = connection.metered || false;
      
      // If downlink speed is available, use it
      if (connection.downlink) {
        // Convert Mbps to Kbps
        const speedKbps = connection.downlink * 1000;
        this.updateSpeedMeasurement(speedKbps);
      }
      
      // If the connection is slow or metered, adjust quality accordingly
      if (connection.saveData) {
        this.setQuality('low');
      } else if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
        this.setQuality('low');
      } else if (connection.effectiveType === '3g') {
        this.setQuality('medium');
      }
    }
    
    // If we're offline, handle it
    if (!navigator.onLine) {
      this.handleOfflineMode();
    }
    
    console.log('Network information updated:', this.networkState);
  }

  /**
   * Measure current connection speed
   * @returns {Promise<number>} Connection speed in Kbps
   */
  async measureConnectionSpeed() {
    if (!this.networkMonitoringEnabled || !navigator.onLine) return 0;
    
    try {
      const startTime = Date.now();
      // Use a small image from a CDN for speed testing
      const testImageUrl = `https://cdn.jsdelivr.net/gh/Automattic/node-canvas/test/fixtures/cat.png?nocache=${startTime}`;
      
      const response = await fetch(testImageUrl, { mode: 'cors', cache: 'no-store' });
      const data = await response.blob();
      const endTime = Date.now();
      
      // Calculate speed in kilobits per second
      const durationSeconds = (endTime - startTime) / 1000;
      const fileSizeBits = data.size * 8;
      const speedKbps = (fileSizeBits / durationSeconds) / 1000;
      
      this.updateSpeedMeasurement(speedKbps);
      this.adjustQualityBasedOnSpeed(speedKbps);
      
      return speedKbps;
    } catch (error) {
      console.error('Error measuring connection speed:', error);
      return 0;
    }
  }

  /**
   * Update speed measurement history and average
   * @param {number} speedKbps - Speed in Kbps
   */
  updateSpeedMeasurement(speedKbps) {
    const now = Date.now();
    this.networkState.lastSpeedMeasurement = speedKbps;
    this.networkState.lastMeasurementTime = now;
    
    // Add to measurements array (keep last 5)
    this.networkState.measurements.push({
      speed: speedKbps,
      timestamp: now
    });
    
    // Keep only the last 5 measurements
    if (this.networkState.measurements.length > 5) {
      this.networkState.measurements.shift();
    }
    
    // Calculate average speed
    this.networkState.averageSpeed = this.networkState.measurements.reduce(
      (sum, measurement) => sum + measurement.speed, 0
    ) / this.networkState.measurements.length;
    
    // Record for metrics
    if (this.options.enableMetrics) {
      this.metrics.bandwidthEstimates.push({
        timestamp: now,
        bandwidth: speedKbps
      });
      
      // Keep metrics history manageable
      if (this.metrics.bandwidthEstimates.length > 20) {
        this.metrics.bandwidthEstimates.shift();
      }
    }
  }

  /**
   * Adjust streaming quality based on measured speed
   * @param {number} speedKbps - Speed in Kbps
   */
  adjustQualityBasedOnSpeed(speedKbps) {
    if (!this.isAdaptiveEnabled) return;
    
    const { qualityThresholds } = this.options;
    
    let targetQuality;
    if (speedKbps < qualityThresholds.low) {
      targetQuality = 'low';
    } else if (speedKbps < qualityThresholds.medium) {
      targetQuality = 'medium';
    } else if (speedKbps < qualityThresholds.high) {
      targetQuality = 'high';
    } else {
      targetQuality = 'auto';
    }
    
    // Only change if different from current quality
    if (targetQuality !== this.currentQuality) {
      this.setQuality(targetQuality);
    }
  }

  /**
   * Handle offline mode
   */
  handleOfflineMode() {
    console.log('Device is offline, adjusting playback settings');
    
    // Set quality to lowest to conserve data when connection returns
    this.setQuality('low');
    
    // If we have a player, pause it if playing
    if (this.videoPlayer && this.videoPlayer.video && !this.videoPlayer.video.paused) {
      this.videoPlayer.pause();
    }
  }

  /**
   * Set streaming quality
   * @param {string} quality - Quality level (low, medium, high, auto)
   */
  setQuality(quality) {
    if (!this.videoPlayer || !this.videoPlayer.player) return;
    
    this.currentQuality = quality;
    
    // Configure Shaka player based on quality
    const player = this.videoPlayer.player;
    const config = { abr: {}, streaming: {} };
    
    switch (quality) {
      case 'low':
        config.abr.enabled = false;
        config.streaming.preferredVideoQuality = 360; // Prefer 360p
        config.streaming.maxHeight = 480; // Cap at 480p
        config.streaming.bufferingGoal = 15; // Increase buffer (15 seconds)
        break;
        
      case 'medium':
        config.abr.enabled = true;
        config.abr.restrictToScreenSize = true;
        config.streaming.preferredVideoQuality = 720; // Prefer 720p
        config.streaming.maxHeight = 720; // Cap at 720p
        config.streaming.bufferingGoal = 10; // Standard buffer
        break;
        
      case 'high':
        config.abr.enabled = true;
        config.streaming.preferredVideoQuality = 1080; // Prefer 1080p
        config.streaming.maxHeight = 1440; // Allow up to 1440p
        config.streaming.bufferingGoal = 6; // Lower buffer for high bandwidth
        break;
        
      case 'auto':
      default:
        config.abr.enabled = true;
        config.abr.restrictToScreenSize = false;
        config.streaming.preferredVideoQuality = null; // No preference
        config.streaming.maxHeight = null; // No cap
        config.streaming.bufferingGoal = 10; // Standard buffer
        break;
    }
    
    // Apply configuration
    player.configure(config);
    
    console.log(`Streaming quality set to ${quality}`);
    
    // Record quality change in metrics
    if (this.options.enableMetrics) {
      this.metrics.qualitySwitches++;
    }
  }

  /**
   * Configure ABR (Adaptive Bitrate) strategy
   * @param {string} strategy - ABR strategy (bandwidth, buffer, auto)
   */
  configureAbrStrategy(strategy) {
    if (!this.videoPlayer || !this.videoPlayer.player) return;
    
    const player = this.videoPlayer.player;
    const config = { abr: {} };
    
    switch (strategy) {
      case 'bandwidth':
        // Prioritize bandwidth estimation
        config.abr.enabled = true;
        config.abr.bandwidthEstimate = this.networkState.averageSpeed * 1000; // Convert to bps
        config.abr.switchInterval = 8; // Faster switching
        config.abr.safetyFactor = 0.8; // 80% of estimated bandwidth
        break;
        
      case 'buffer':
        // Prioritize stable buffer levels
        config.abr.enabled = true;
        config.abr.switchInterval = 10; // Normal switching
        config.abr.safetyFactor = 0.9; // 90% of estimated bandwidth
        break;
        
      case 'auto':
      default:
        // Default Shaka behavior
        config.abr.enabled = true;
        config.abr.switchInterval = 8;
        config.abr.safetyFactor = 0.85;
        break;
    }
    
    // Apply configuration
    player.configure(config);
    
    console.log(`ABR strategy set to ${strategy}`);
  }

  /**
   * Handle buffering start event
   */
  handleBufferingStart() {
    if (!this.options.enableMetrics) return;
    
    const now = Date.now();
    this.metrics.bufferingEvents++;
    this.metrics.lastBufferingEvent = now;
    
    // Check if we should adjust quality due to buffering
    if (this.metrics.bufferingEvents > 3 && this.currentQuality !== 'low') {
      // Multiple buffering events, reduce quality
      const previousQuality = this.currentQuality;
      if (previousQuality === 'high') {
        this.setQuality('medium');
      } else if (previousQuality === 'medium' || previousQuality === 'auto') {
        this.setQuality('low');
      }
      
      console.log(`Reducing quality due to buffering: ${previousQuality} -> ${this.currentQuality}`);
    }
  }

  /**
   * Handle buffering end event
   */
  handleBufferingEnd() {
    if (!this.options.enableMetrics) return;
    
    const now = Date.now();
    
    // Calculate buffering duration if we have a start time
    if (this.metrics.lastBufferingEvent > 0) {
      const bufferingTime = now - this.metrics.lastBufferingEvent;
      this.metrics.bufferingDuration += bufferingTime;
      
      // Calculate rebuffering ratio
      const videoElement = this.videoPlayer.video;
      if (videoElement) {
        const playbackTime = videoElement.currentTime;
        if (playbackTime > 0) {
          this.metrics.rebufferingRatio = this.metrics.bufferingDuration / (playbackTime * 1000);
        }
      }
    }
  }

  /**
   * Handle quality change event
   * @param {Event} event - Quality change event
   */
  handleQualityChange(event) {
    if (!this.options.enableMetrics) return;
    
    // Record quality switch
    this.metrics.qualitySwitches++;
    
    console.log('Quality changed:', event);
  }

  /**
   * Save stream configuration for a specific content
   * @param {string} contentId - Content identifier
   */
  saveStreamConfiguration(contentId) {
    if (!contentId) return;
    
    const configuration = {
      quality: this.currentQuality,
      timestamp: Date.now(),
      networkState: { ...this.networkState }
    };
    
    this.streamConfigurations.set(contentId, configuration);
  }

  /**
   * Load stream configuration for a specific content
   * @param {string} contentId - Content identifier
   * @returns {boolean} Whether configuration was loaded
   */
  loadStreamConfiguration(contentId) {
    if (!contentId || !this.streamConfigurations.has(contentId)) return false;
    
    const configuration = this.streamConfigurations.get(contentId);
    
    // Only use saved configuration if it's recent (less than 1 hour old)
    const isRecent = (Date.now() - configuration.timestamp) < 3600000;
    
    if (isRecent) {
      this.setQuality(configuration.quality);
      return true;
    }
    
    return false;
  }

  /**
   * Set preferred quality (user override)
   * @param {string} quality - Quality level
   */
  setPreferredQuality(quality) {
    this.preferredQuality = quality;
    
    // If preferred quality is not 'auto', disable adaptive behavior
    this.isAdaptiveEnabled = (quality === 'auto');
    
    // Apply the quality setting
    this.setQuality(quality);
  }

  /**
   * Get current streaming metrics
   * @returns {Object} Streaming metrics
   */
  getMetrics() {
    if (!this.options.enableMetrics) return null;
    
    // Add current player stats if available
    if (this.videoPlayer && this.videoPlayer.player) {
      const stats = this.videoPlayer.player.getStats();
      this.metrics.currentStats = stats;
    }
    
    return { ...this.metrics };
  }

  /**
   * Get current quality
   * @returns {string} Current quality level
   */
  getCurrentQuality() {
    return this.currentQuality;
  }

  /**
   * Get estimated bandwidth
   * @returns {number} Estimated bandwidth in Kbps
   */
  getEstimatedBandwidth() {
    return this.networkState.averageSpeed;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      bufferingEvents: 0,
      qualitySwitches: 0,
      bufferingDuration: 0,
      lastBufferingEvent: 0,
      initialLoadTime: 0,
      rebufferingRatio: 0,
      bandwidthEstimates: []
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopNetworkMonitoring();
    
    // Remove event listeners
    if (this.videoPlayer && this.videoPlayer.player) {
      this.videoPlayer.player.removeEventListener('buffering');
      this.videoPlayer.player.removeEventListener('adaptation');
    }
    
    if (this.videoPlayer && this.videoPlayer.video) {
      this.videoPlayer.video.removeEventListener('waiting', this.handleBufferingStart);
      this.videoPlayer.video.removeEventListener('playing', this.handleBufferingEnd);
    }
    
    if (navigator.connection) {
      navigator.connection.removeEventListener('change', this.updateNetworkInformation);
    }
    
    window.removeEventListener('online', this.updateNetworkInformation);
    window.removeEventListener('offline', this.updateNetworkInformation);
  }
}

export default AdaptiveStreamingManager; 