import './styles/main.css';
import { io } from 'socket.io-client';
import QrScanner from 'qrcode-parser';

// Import app components
import QRCodeScanner from './components/QRCodeScanner';
import RemoteControl from './components/RemoteControl';
import VoiceRecorder from './components/VoiceRecorder';
import ChatInterface from './components/ChatInterface';
import ConnectionManager from './components/ConnectionManager';

// App configuration
const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  reconnectInterval: 5000,
  debug: process.env.NODE_ENV !== 'production'
};

// Main App class
class MemoryStreamMobileApp {
  constructor() {
    this.sessionId = null;
    this.socket = null;
    this.connected = false;
    this.tvConnected = false;
    this.components = {};
    
    // DOM elements for screens
    this.screens = {
      scanning: document.getElementById('scanning-screen'),
      manualConnect: document.getElementById('manual-connect-screen'),
      control: document.getElementById('control-screen'),
      loading: document.getElementById('loading-overlay'),
      error: document.getElementById('error-overlay')
    };
    
    // DOM elements for tabs
    this.tabs = {
      remote: document.getElementById('remote-tab'),
      voice: document.getElementById('voice-tab'),
      chat: document.getElementById('chat-tab')
    };
    
    // Bind event handlers
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleManualConnect = this.handleManualConnect.bind(this);
    this.handleQRCodeScanned = this.handleQRCodeScanned.bind(this);
    this.handleSocketError = this.handleSocketError.bind(this);
    this.handleErrorDismiss = this.handleErrorDismiss.bind(this);
    
    // Check for saved session
    this.checkSavedSession();
  }
  
  /**
   * Initialize the application
   */
  async initialize() {
    try {
      console.log('Initializing MemoryStream Mobile App');
      
      // Initialize components
      this.initializeComponents();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Check for PWA installation prompts
      this.checkForPWAPrompt();
      
      console.log('App initialization complete');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Initialization Error', error.message);
    }
  }
  
  /**
   * Check for saved session in localStorage
   */
  checkSavedSession() {
    try {
      const savedSession = localStorage.getItem('memorystream_session');
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        // Check if session is still valid (less than 24h old)
        const expiryTime = new Date(sessionData.timestamp + 24 * 60 * 60 * 1000);
        if (expiryTime > new Date()) {
          // Session still valid, try to reconnect
          this.sessionId = sessionData.sessionId;
          this.connectToSession(this.sessionId);
          return;
        } else {
          // Session expired, remove it
          localStorage.removeItem('memorystream_session');
        }
      }
    } catch (error) {
      console.error('Error checking saved session:', error);
      // Clear potentially corrupted data
      localStorage.removeItem('memorystream_session');
    }
  }
  
  /**
   * Initialize app components
   */
  initializeComponents() {
    // Initialize QR code scanner
    this.components.qrScanner = new QRCodeScanner(
      document.getElementById('qr-video'),
      {
        onScan: this.handleQRCodeScanned
      }
    );
    
    // Initialize connection manager (will be set after connecting)
    this.components.connectionManager = new ConnectionManager(
      document.getElementById('connection-status')
    );
    
    // Initialize remote control (will be enabled after connecting)
    this.components.remoteControl = new RemoteControl({
      dpadButtons: {
        up: document.getElementById('dpad-up'),
        down: document.getElementById('dpad-down'),
        left: document.getElementById('dpad-left'),
        right: document.getElementById('dpad-right'),
        center: document.getElementById('dpad-center')
      },
      mediaButtons: {
        playPause: document.getElementById('play-pause-btn'),
        rewind: document.getElementById('rewind-btn'),
        forward: document.getElementById('forward-btn')
      },
      volumeButtons: {
        up: document.getElementById('volume-up-btn'),
        down: document.getElementById('volume-down-btn'),
        mute: document.getElementById('mute-btn')
      },
      extraButtons: {
        back: document.getElementById('back-btn'),
        home: document.getElementById('home-btn'),
        info: document.getElementById('info-btn')
      }
    });
    
    // Initialize voice recorder (will be enabled after connecting)
    this.components.voiceRecorder = new VoiceRecorder(
      document.getElementById('voice-record-btn'),
      document.getElementById('voice-status-text'),
      document.getElementById('voice-status-icon'),
      document.getElementById('voice-waveform-canvas')
    );
    
    // Initialize chat interface (will be enabled after connecting)
    this.components.chatInterface = new ChatInterface(
      document.getElementById('chat-messages'),
      document.getElementById('chat-form'),
      document.getElementById('chat-input')
    );
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      button.addEventListener('click', this.handleTabClick);
    });
    
    // Manual connect form
    const manualConnectForm = document.getElementById('manual-connect-form');
    manualConnectForm.addEventListener('submit', this.handleManualConnect);
    
    // Manual connect button
    const manualConnectBtn = document.getElementById('manual-connect-btn');
    manualConnectBtn.addEventListener('click', () => {
      this.showScreen('manualConnect');
    });
    
    // Back to scan button
    const backToScanBtn = document.getElementById('back-to-scan-btn');
    backToScanBtn.addEventListener('click', () => {
      this.showScreen('scanning');
    });
    
    // Error dismiss button
    const errorCloseBtn = document.getElementById('error-close-btn');
    errorCloseBtn.addEventListener('click', this.handleErrorDismiss);
    
    // iOS PWA prompt close
    const iosPwaClose = document.getElementById('ios-pwa-close');
    if (iosPwaClose) {
      iosPwaClose.addEventListener('click', () => {
        const prompt = document.getElementById('ios-pwa-prompt');
        prompt.classList.add('hidden');
        localStorage.setItem('pwa_prompt_dismissed', 'true');
      });
    }
  }
  
  /**
   * Handle tab button click
   * @param {Event} event - Click event
   */
  handleTabClick(event) {
    const tabId = event.currentTarget.dataset.tab;
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabId);
    });
    
    // Update active tab content
    Object.values(this.tabs).forEach(tab => {
      tab.classList.toggle('active', tab.id === tabId);
    });
  }
  
  /**
   * Handle manual connect form submission
   * @param {Event} event - Form submission event
   */
  handleManualConnect(event) {
    event.preventDefault();
    
    const sessionIdInput = document.getElementById('session-id');
    const sessionId = sessionIdInput.value.trim();
    
    if (!sessionId) {
      this.showError('Connection Error', 'Please enter a valid Session ID');
      return;
    }
    
    this.connectToSession(sessionId);
  }
  
  /**
   * Handle QR code scan result
   * @param {string} result - Scanned QR code content
   */
  handleQRCodeScanned(result) {
    try {
      console.log('QR code scanned:', result);
      
      // Parse the URL to extract session ID
      const url = new URL(result);
      const sessionId = url.searchParams.get('session');
      
      if (!sessionId) {
        throw new Error('Invalid QR code. No session ID found.');
      }
      
      this.connectToSession(sessionId);
    } catch (error) {
      console.error('QR code parsing error:', error);
      this.showError('QR Code Error', 'Invalid QR code format. Please try again.');
    }
  }
  
  /**
   * Connect to a session
   * @param {string} sessionId - Session ID to connect to
   */
  async connectToSession(sessionId) {
    try {
      this.showLoading('Connecting to TV...');
      
      // Stop QR scanner if running
      if (this.components.qrScanner.isScanning) {
        this.components.qrScanner.stopScanner();
      }
      
      // Store session ID
      this.sessionId = sessionId;
      
      // Connect to socket server
      this.connectSocket();
      
      // Save session to localStorage
      localStorage.setItem('memorystream_session', JSON.stringify({
        sessionId: this.sessionId,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Connection error:', error);
      this.showError('Connection Error', error.message);
      this.hideLoading();
    }
  }
  
  /**
   * Connect to socket.io server
   */
  connectSocket() {
    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Connect to socket.io server
    this.socket = io(`${config.backendUrl}/mobile`, {
      transports: ['websocket'],
      query: {
        clientType: 'mobile'
      }
    });
    
    // Socket event handlers
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.connected = true;
      
      // Join session
      this.socket.emit('join:session', {
        sessionId: this.sessionId,
        deviceInfo: {
          type: 'mobile',
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      });
      
      // Update connection status
      this.components.connectionManager.updateStatus('connected');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;
      this.components.connectionManager.updateStatus('disconnected');
      
      // Try to reconnect after interval
      setTimeout(() => {
        if (!this.connected) {
          this.connectSocket();
        }
      }, config.reconnectInterval);
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleSocketError(error);
    });
    
    this.socket.on('session:joined', (data) => {
      console.log('Session joined:', data);
      this.tvConnected = data.tvConnected;
      this.hideLoading();
      this.showScreen('control');
      
      // Enable components with socket
      this.enableComponents();
    });
    
    this.socket.on('tv:status', (status) => {
      console.log('TV status update:', status);
      this.tvConnected = status.connected;
      this.components.connectionManager.updateTVStatus(this.tvConnected);
    });
    
    this.socket.on('response:ai', (response) => {
      console.log('AI response received:', response);
      this.components.chatInterface.addMessage('ai', response.text);
    });
  }
  
  /**
   * Enable components with socket connection
   */
  enableComponents() {
    // Enable remote control
    this.components.remoteControl.enable(this.socket, this.sessionId);
    
    // Enable voice recorder
    this.components.voiceRecorder.enable(this.socket, this.sessionId);
    
    // Enable chat interface
    this.components.chatInterface.enable(this.socket, this.sessionId);
    
    // Set connection manager socket
    this.components.connectionManager.setSocket(this.socket);
  }
  
  /**
   * Handle socket connection errors
   * @param {Error} error - Socket error
   */
  handleSocketError(error) {
    this.connected = false;
    this.components.connectionManager.updateStatus('error');
    
    console.error('Socket error:', error);
    this.hideLoading();
    
    // Show error if not already on control screen
    if (!this.screens.control.classList.contains('active')) {
      this.showError('Connection Error', 'Failed to connect to the TV. Please try again.');
    }
  }
  
  /**
   * Handle error dismiss button click
   */
  handleErrorDismiss() {
    this.hideError();
  }
  
  /**
   * Show specified screen
   * @param {string} screenName - Screen name to show
   */
  showScreen(screenName) {
    // Hide all screens
    Object.values(this.screens).forEach(screen => {
      if (screen.classList.contains('screen')) {
        screen.classList.remove('active');
      }
    });
    
    // Show requested screen
    if (this.screens[screenName]) {
      this.screens[screenName].classList.add('active');
      
      // Additional actions based on screen
      if (screenName === 'scanning') {
        this.components.qrScanner.startScanner();
      } else if (screenName === 'control') {
        // Set initial tab
        this.showTab('remote');
      }
    }
  }
  
  /**
   * Show specified tab
   * @param {string} tabName - Tab name to show
   */
  showTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === `${tabName}-tab`);
    });
    
    // Update tab content
    Object.keys(this.tabs).forEach(key => {
      this.tabs[key].classList.toggle('active', key === `${tabName}-tab`);
    });
  }
  
  /**
   * Show loading overlay
   * @param {string} message - Loading message
   */
  showLoading(message) {
    const loadingText = this.screens.loading.querySelector('.loading-text');
    if (loadingText && message) {
      loadingText.textContent = message;
    }
    
    this.screens.loading.classList.remove('hidden');
  }
  
  /**
   * Hide loading overlay
   */
  hideLoading() {
    this.screens.loading.classList.add('hidden');
  }
  
  /**
   * Show error overlay
   * @param {string} title - Error title
   * @param {string} message - Error message
   */
  showError(title, message) {
    const errorTitle = this.screens.error.querySelector('#error-title');
    const errorMessage = this.screens.error.querySelector('#error-message');
    
    if (errorTitle) errorTitle.textContent = title;
    if (errorMessage) errorMessage.textContent = message;
    
    this.screens.error.classList.remove('hidden');
  }
  
  /**
   * Hide error overlay
   */
  hideError() {
    this.screens.error.classList.add('hidden');
  }
  
  /**
   * Check if we should show PWA installation prompt
   */
  checkForPWAPrompt() {
    // iOS PWA prompt
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone;
    const promptDismissed = localStorage.getItem('pwa_prompt_dismissed') === 'true';
    
    if (isIOS && !isStandalone && !promptDismissed) {
      const iosPwaPrompt = document.getElementById('ios-pwa-prompt');
      if (iosPwaPrompt) {
        setTimeout(() => {
          iosPwaPrompt.classList.remove('hidden');
        }, 2000);
      }
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new MemoryStreamMobileApp();
  app.initialize();
});

// Export for testing
export default MemoryStreamMobileApp; 