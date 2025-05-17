import './styles/main.css';
import shaka from 'shaka-player';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';

// Import app modules
import VideoPlayer from './components/VideoPlayer';
import SubtitleManager from './components/SubtitleManager';
import RemoteNavigation from './components/RemoteNavigation';
import ConnectionManager from './components/ConnectionManager';
import AIAssistant from './components/AIAssistant';

// App configuration
const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  contentUrl: 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd',
  contentType: 'application/dash+xml',
  debug: process.env.NODE_ENV !== 'production'
};

// Main App class
class MemoryStreamApp {
  constructor() {
    this.player = null;
    this.session = null;
    this.socket = null;
    this.components = {};
    
    // DOM elements
    this.elements = {
      loading: document.getElementById('loading-screen'),
      pairing: document.getElementById('pairing-screen'),
      video: document.getElementById('video-player'),
      subtitles: document.getElementById('subtitle-container'),
      aiAssistant: document.getElementById('ai-assistant'),
      controls: document.getElementById('controls-overlay'),
      qrContainer: document.getElementById('qrcode-container'),
      sessionId: document.getElementById('session-id'),
      connectionStatus: document.getElementById('connection-status'),
      mobileStatus: document.getElementById('mobile-status'),
      focusDebug: document.getElementById('focus-debug')
    };
    
    // Bind event handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleVideoClick = this.handleVideoClick.bind(this);
  }
  
  async initialize() {
    try {
      console.log('Initializing MemoryStream TV App');
      
      // Check for Shaka Player support
      const shakaSupported = shaka.Player.isBrowserSupported();
      if (!shakaSupported) {
        throw new Error('Browser not supported for video playback');
      }
      
      // Create session
      await this.createSession();
      
      // Initialize components
      this.initializeComponents();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Show pairing screen
      this.showPairingScreen();
      
      console.log('App initialization complete');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to initialize application', error.message);
    }
  }
  
  async createSession() {
    try {
      // Show loading indicator
      this.showLoading('Creating session...');
      
      // Call backend to create session
      const response = await fetch(`${config.backendUrl}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contentUrl: config.contentUrl,
          contentType: config.contentType
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }
      
      this.session = await response.json();
      console.log('Session created:', this.session);
      
      // Display session ID
      this.elements.sessionId.textContent = this.session.sessionId;
      
      // Generate QR code
      await QRCode.toCanvas(
        this.elements.qrContainer,
        this.session.pairingUrl,
        {
          width: 256,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        }
      );
      
      // Connect to socket server
      this.connectSocket();
    } catch (error) {
      console.error('Session creation error:', error);
      throw error;
    }
  }
  
  connectSocket() {
    // Connect to socket.io server
    this.socket = io(`${config.backendUrl}/tv`, {
      transports: ['websocket'],
      query: {
        clientType: 'tv'
      }
    });
    
    // Socket event handlers
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.updateConnectionStatus('connected');
      
      // Join session
      this.socket.emit('join:session', {
        sessionId: this.session.sessionId
      });
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.updateConnectionStatus('disconnected');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.updateConnectionStatus('error');
    });
    
    this.socket.on('mobile:connected', (data) => {
      console.log('Mobile device connected:', data);
      this.updateMobileStatus();
    });
    
    this.socket.on('mobile:disconnected', (data) => {
      console.log('Mobile device disconnected:', data);
      this.updateMobileStatus();
    });
    
    this.socket.on('command:voice', (command) => {
      console.log('Voice command received:', command);
      this.handleVoiceCommand(command);
    });
    
    this.socket.on('remote:control', (action) => {
      console.log('Remote control action:', action);
      this.handleRemoteAction(action);
    });
    
    this.socket.on('query:received', (data) => {
      console.log('Query received:', data);
      this.components.aiAssistant.showResponse(data.query, data.response);
    });
  }
  
  initializeComponents() {
    // Initialize video player
    this.components.videoPlayer = new VideoPlayer(
      this.elements.video,
      {
        contentUrl: this.session.content.source || config.contentUrl,
        contentType: this.session.content.type || config.contentType
      }
    );
    
    // Initialize subtitle manager
    this.components.subtitleManager = new SubtitleManager(
      this.elements.subtitles,
      {
        socket: this.socket,
        sessionId: this.session.sessionId
      }
    );
    
    // Initialize remote navigation
    this.components.remoteNavigation = new RemoteNavigation({
      debug: config.debug,
      focusDebugElement: this.elements.focusDebug
    });
    
    // Initialize connection manager
    this.components.connectionManager = new ConnectionManager(
      this.elements.connectionStatus,
      this.elements.mobileStatus,
      {
        socket: this.socket
      }
    );
    
    // Initialize AI assistant
    this.components.aiAssistant = new AIAssistant(
      this.elements.aiAssistant,
      {
        socket: this.socket,
        sessionId: this.session.sessionId
      }
    );
  }
  
  setupEventListeners() {
    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Click events
    this.elements.video.addEventListener('click', this.handleVideoClick);
    
    // Video player events
    this.components.videoPlayer.on('play', () => this.hideControls());
    this.components.videoPlayer.on('pause', () => this.showControls());
    this.components.videoPlayer.on('timeupdate', (time) => this.handleTimeUpdate(time));
    
    // AI Assistant events
    this.components.aiAssistant.on('close', () => this.handleAIClose());
  }
  
  handleKeyDown(event) {
    console.log('Key pressed:', event.key);
    
    // Pass to remote navigation first
    const handled = this.components.remoteNavigation.handleKeyDown(event);
    if (handled) return;
    
    // Handle global keys
    switch (event.key) {
      case 'Enter':
        this.handleEnterKey();
        break;
      case 'Escape':
        this.handleEscapeKey();
        break;
      case ' ': // Spacebar
        this.togglePlayPause();
        break;
      case 'ArrowLeft':
        this.seekBackward();
        break;
      case 'ArrowRight':
        this.seekForward();
        break;
      case 'ArrowUp':
        this.showControls();
        break;
      case 'ArrowDown':
        this.hideControls();
        break;
      default:
        // Unhandled key
        break;
    }
  }
  
  handleVideoClick() {
    // Toggle controls visibility
    if (this.elements.controls.classList.contains('hidden')) {
      this.showControls();
    } else {
      this.hideControls();
    }
  }
  
  handleEnterKey() {
    // Check what is currently focused
    const focused = document.activeElement;
    if (!focused) return;
    
    if (focused.id === 'play-pause-btn') {
      this.togglePlayPause();
    } else if (focused.id === 'subtitle-toggle-btn') {
      this.toggleSubtitles();
    } else if (focused.id === 'ai-toggle-btn') {
      this.toggleAIAssistant();
    }
  }
  
  handleEscapeKey() {
    // Close overlays in priority order
    if (!this.elements.aiAssistant.classList.contains('hidden')) {
      this.hideAIAssistant();
      return;
    }
    
    if (!this.elements.controls.classList.contains('hidden')) {
      this.hideControls();
      return;
    }
  }
  
  handleTimeUpdate(time) {
    // Update UI elements based on current time
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const progressFill = document.querySelector('.progress-fill');
    
    if (currentTimeEl && time.current !== undefined) {
      currentTimeEl.textContent = this.formatTime(time.current);
    }
    
    if (totalTimeEl && time.duration !== undefined) {
      totalTimeEl.textContent = this.formatTime(time.duration);
    }
    
    if (progressFill && time.current !== undefined && time.duration !== undefined) {
      const percentage = (time.current / time.duration) * 100;
      progressFill.style.width = `${percentage}%`;
    }
  }
  
  handleVoiceCommand(command) {
    // Process voice command
    if (!command || !command.action) return;
    
    switch (command.action) {
      case 'play':
        this.components.videoPlayer.play();
        break;
      case 'pause':
        this.components.videoPlayer.pause();
        break;
      case 'rewind':
        this.seekBackward(command.parameters?.seconds || 10);
        break;
      case 'forward':
        this.seekForward(command.parameters?.seconds || 10);
        break;
      case 'volume_up':
        this.components.videoPlayer.increaseVolume();
        break;
      case 'volume_down':
        this.components.videoPlayer.decreaseVolume();
        break;
      case 'answer':
        this.showAIAssistant();
        break;
      default:
        console.log('Unknown command action:', command.action);
    }
  }
  
  handleRemoteAction(action) {
    // Process remote control action
    if (!action || !action.type) return;
    
    switch (action.type) {
      case 'dpad':
        this.handleDPadAction(action.direction);
        break;
      case 'media':
        this.handleMediaAction(action.command);
        break;
      default:
        console.log('Unknown remote action type:', action.type);
    }
  }
  
  handleDPadAction(direction) {
    // Simulate arrow key press
    const keyMap = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      center: 'Enter'
    };
    
    const key = keyMap[direction];
    if (key) {
      const event = new KeyboardEvent('keydown', { key });
      this.handleKeyDown(event);
    }
  }
  
  handleMediaAction(command) {
    // Handle media control command
    switch (command) {
      case 'play':
        this.components.videoPlayer.play();
        break;
      case 'pause':
        this.components.videoPlayer.pause();
        break;
      case 'toggle':
        this.togglePlayPause();
        break;
      case 'rewind':
        this.seekBackward();
        break;
      case 'forward':
        this.seekForward();
        break;
      default:
        console.log('Unknown media command:', command);
    }
  }
  
  handleAIClose() {
    this.hideAIAssistant();
  }
  
  // Player controls
  togglePlayPause() {
    this.components.videoPlayer.togglePlayPause();
  }
  
  seekForward(seconds = 10) {
    this.components.videoPlayer.seekBy(seconds);
  }
  
  seekBackward(seconds = 10) {
    this.components.videoPlayer.seekBy(-seconds);
  }
  
  toggleSubtitles() {
    this.components.subtitleManager.toggleVisibility();
    const subtitleBtn = document.getElementById('subtitle-toggle-btn');
    if (subtitleBtn) {
      subtitleBtn.classList.toggle('active');
    }
  }
  
  toggleAIAssistant() {
    if (this.elements.aiAssistant.classList.contains('hidden')) {
      this.showAIAssistant();
    } else {
      this.hideAIAssistant();
    }
  }
  
  // UI state management
  showLoading(message) {
    this.elements.loading.classList.remove('hidden');
    const loadingText = document.querySelector('.loading-text');
    if (loadingText && message) {
      loadingText.textContent = message;
    }
  }
  
  hideLoading() {
    this.elements.loading.classList.add('hidden');
  }
  
  showPairingScreen() {
    this.hideLoading();
    this.elements.pairing.classList.remove('hidden');
  }
  
  hidePairingScreen() {
    this.elements.pairing.classList.add('hidden');
  }
  
  showControls() {
    this.elements.controls.classList.remove('hidden');
    this.components.remoteNavigation.setInitialFocus('play-pause-btn');
  }
  
  hideControls() {
    this.elements.controls.classList.add('hidden');
  }
  
  showAIAssistant() {
    this.elements.aiAssistant.classList.remove('hidden');
    this.components.remoteNavigation.setInitialFocus('ai-close');
  }
  
  hideAIAssistant() {
    this.elements.aiAssistant.classList.add('hidden');
  }
  
  updateConnectionStatus(status) {
    const statusIcon = this.elements.connectionStatus.querySelector('.status-icon');
    const statusText = this.elements.connectionStatus.querySelector('.status-text');
    
    if (statusIcon && statusText) {
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
  
  updateMobileStatus() {
    const connectedMobiles = this.components.connectionManager.getConnectedMobilesCount();
    const mobileStatusText = this.elements.mobileStatus.querySelector('.status-text');
    
    if (mobileStatusText) {
      mobileStatusText.textContent = `${connectedMobiles} connected`;
    }
    
    if (connectedMobiles > 0) {
      this.elements.mobileStatus.classList.remove('hidden');
      this.hidePairingScreen();
    } else {
      this.elements.mobileStatus.classList.add('hidden');
    }
  }
  
  showError(title, message) {
    // Create error overlay
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'error-overlay fullscreen-overlay';
    errorOverlay.innerHTML = `
      <div class="error-content">
        <h2>${title}</h2>
        <p>${message}</p>
        <button id="error-retry-btn">Retry</button>
      </div>
    `;
    
    document.body.appendChild(errorOverlay);
    
    // Add retry button handler
    const retryBtn = document.getElementById('error-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        errorOverlay.remove();
        window.location.reload();
      });
    }
  }
  
  formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new MemoryStreamApp();
  app.initialize();
});

// Export for testing
export default MemoryStreamApp; 