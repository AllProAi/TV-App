/**
 * Remote Control component for mobile app
 * Provides D-pad and media buttons for TV navigation
 */
class RemoteControl {
  /**
   * Initialize Remote Control
   * @param {HTMLElement} container - Container element for the UI
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.socket = options.socket;
    this.session = options.session;
    this.eventListeners = {};
    
    this.vibrationEnabled = 'vibrate' in navigator;
    
    this.render();
    this.bindEvents();
  }
  
  /**
   * Render the remote control UI
   */
  render() {
    this.container.innerHTML = `
      <div class="remote-control">
        <div class="remote-header">
          <div class="remote-power-btn" data-action="power">
            <i class="icon-power"></i>
          </div>
          <div class="remote-title">Remote</div>
          <div class="remote-settings-btn" data-action="settings">
            <i class="icon-settings"></i>
          </div>
        </div>
        
        <div class="remote-navigation">
          <div class="dpad">
            <button class="dpad-btn dpad-up" data-action="up">
              <i class="icon-arrow-up"></i>
            </button>
            <button class="dpad-btn dpad-right" data-action="right">
              <i class="icon-arrow-right"></i>
            </button>
            <button class="dpad-btn dpad-down" data-action="down">
              <i class="icon-arrow-down"></i>
            </button>
            <button class="dpad-btn dpad-left" data-action="left">
              <i class="icon-arrow-left"></i>
            </button>
            <button class="dpad-btn dpad-center" data-action="select">OK</button>
          </div>
        </div>
        
        <div class="remote-playback">
          <button class="playback-btn" data-action="rewind">
            <i class="icon-rewind"></i>
          </button>
          <button class="playback-btn play-pause-btn" data-action="playpause">
            <i class="icon-play"></i>
            <i class="icon-pause"></i>
          </button>
          <button class="playback-btn" data-action="forward">
            <i class="icon-forward"></i>
          </button>
        </div>
        
        <div class="remote-volume">
          <button class="volume-btn" data-action="volume_down">
            <i class="icon-volume-down"></i>
          </button>
          <button class="volume-btn" data-action="mute">
            <i class="icon-volume-mute"></i>
          </button>
          <button class="volume-btn" data-action="volume_up">
            <i class="icon-volume-up"></i>
          </button>
        </div>
        
        <div class="remote-back-home">
          <button class="nav-btn" data-action="back">
            <i class="icon-back"></i>
          </button>
          <button class="nav-btn" data-action="home">
            <i class="icon-home"></i>
          </button>
        </div>
      </div>
    `;
    
    // Create references to elements
    this.elements = {
      power: this.container.querySelector('[data-action="power"]'),
      settings: this.container.querySelector('[data-action="settings"]'),
      dpad: {
        up: this.container.querySelector('[data-action="up"]'),
        right: this.container.querySelector('[data-action="right"]'),
        down: this.container.querySelector('[data-action="down"]'),
        left: this.container.querySelector('[data-action="left"]'),
        select: this.container.querySelector('[data-action="select"]')
      },
      playback: {
        rewind: this.container.querySelector('[data-action="rewind"]'),
        playpause: this.container.querySelector('[data-action="playpause"]'),
        forward: this.container.querySelector('[data-action="forward"]')
      },
      volume: {
        down: this.container.querySelector('[data-action="volume_down"]'),
        mute: this.container.querySelector('[data-action="mute"]'),
        up: this.container.querySelector('[data-action="volume_up"]')
      },
      navigation: {
        back: this.container.querySelector('[data-action="back"]'),
        home: this.container.querySelector('[data-action="home"]')
      }
    };
  }
  
  /**
   * Bind event listeners to UI elements
   */
  bindEvents() {
    // Get all buttons with data-action attribute
    const buttons = this.container.querySelectorAll('[data-action]');
    
    // Add click event to each button
    buttons.forEach(button => {
      const action = button.getAttribute('data-action');
      
      button.addEventListener('click', () => {
        this.handleButtonPress(action);
      });
      
      // Add touch feedback
      button.addEventListener('touchstart', () => {
        button.classList.add('active');
      });
      
      button.addEventListener('touchend', () => {
        button.classList.remove('active');
      });
    });
  }
  
  /**
   * Handle button press event
   * @param {string} action - Button action
   */
  handleButtonPress(action) {
    // Trigger haptic feedback if available
    if (this.vibrationEnabled) {
      navigator.vibrate(25);
    }
    
    // Add visual feedback
    this.triggerVisualFeedback(action);
    
    // Send remote control action to TV via WebSocket
    if (this.socket && this.session) {
      this.socket.emit('remote:control', {
        action: {
          type: action,
          timestamp: Date.now()
        }
      });
    }
    
    // Trigger event for other components
    this.triggerEvent('action', { action });
  }
  
  /**
   * Add visual feedback for button press
   * @param {string} action - Button action
   */
  triggerVisualFeedback(action) {
    // Find the button element
    let button;
    
    if (action === 'power') button = this.elements.power;
    else if (action === 'settings') button = this.elements.settings;
    else if (['up', 'right', 'down', 'left', 'select'].includes(action)) {
      button = this.elements.dpad[action];
    }
    else if (['rewind', 'playpause', 'forward'].includes(action)) {
      button = this.elements.playback[action];
    }
    else if (['volume_down', 'mute', 'volume_up'].includes(action)) {
      button = this.elements.volume[action === 'volume_down' ? 'down' : action === 'volume_up' ? 'up' : 'mute'];
    }
    else if (['back', 'home'].includes(action)) {
      button = this.elements.navigation[action];
    }
    
    if (button) {
      button.classList.add('pressed');
      setTimeout(() => {
        button.classList.remove('pressed');
      }, 200);
    }
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
        console.error(`Error in RemoteControl ${event} event handler:`, error);
      }
    });
  }
  
  /**
   * Update connection status UI
   * @param {boolean} connected - Connection status
   */
  updateConnectionStatus(connected) {
    if (connected) {
      this.container.classList.remove('disconnected');
    } else {
      this.container.classList.add('disconnected');
    }
  }
}

export default RemoteControl; 