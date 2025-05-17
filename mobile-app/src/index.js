import './styles/main.css';
import { io } from 'socket.io-client';

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
    this.connectionManager = null;
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
    
    // DOM elements for tab content
    this.tabContents = {
      remote: document.getElementById('remote-content'),
      voice: document.getElementById('voice-content'),
      chat: document.getElementById('chat-content')
    };
    
    // Bind event handlers
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleManualConnect = this.handleManualConnect.bind(this);
    this.handleQRCodeScanned = this.handleQRCodeScanned.bind(this);
    this.handleErrorDismiss = this.handleErrorDismiss.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    
    // Check for saved session
    this.checkSavedSession();
  }
  
  /**
   * Initialize the application
   */
  async initialize() {
    try {
      console.log('Initializing MemoryStream Mobile App');
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize components
      this.initializeComponents();
      
      // Check for PWA installation prompts
      this.checkForPWAPrompt();
      
      // Show initial screen based on URL parameters
      this.checkUrlParameters();
      
      console.log('App initialization complete');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Initialization Error', error.message || 'Could not initialize the application');
    }
  }
  
  /**
   * Check for session ID in URL parameters
   */
  checkUrlParameters() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session');
      
      if (sessionId) {
        console.log('Session ID found in URL:', sessionId);
        this.connectToSession(sessionId);
        
        // Remove the session parameter from URL
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.replaceState({}, '', url);
      } else {
        // No session in URL, show scanning screen
        this.showScreen('scanning');
      }
    } catch (error) {
      console.error('Error checking URL parameters:', error);
      this.showScreen('scanning');
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
      document.getElementById('qr-scanner-container'),
      { onScan: this.handleQRCodeScanned }
    );
    
    // Initialize connection manager
    this.connectionManager = new ConnectionManager({
      serverUrl: config.backendUrl,
      reconnectInterval: config.reconnectInterval,
      io: io
    });
    
    // Add connection event handlers
    this.connectionManager.on('connected', this.handleConnected.bind(this));
    this.connectionManager.on('disconnected', this.handleDisconnected.bind(this));
    this.connectionManager.on('error', this.handleConnectionError.bind(this));
    this.connectionManager.on('session:joined', this.handleSessionJoined.bind(this));
    
    // Connection status element
    this.components.connectionStatus = document.getElementById('connection-status');
  }
  
  /**
   * Initialize control components after connection
   */
  initializeControlComponents() {
    // Create component containers if they don't exist
    if (!this.tabContents.remote || !this.tabContents.voice || !this.tabContents.chat) {
      console.error('Tab content containers not found');
      return;
    }
    
    // Initialize remote control
    this.components.remoteControl = new RemoteControl(
      this.tabContents.remote,
      {
        socket: this.connectionManager.socket,
        session: this.sessionId
      }
    );
    
    // Initialize voice recorder
    this.components.voiceRecorder = new VoiceRecorder(
      this.tabContents.voice,
      {
        socket: this.connectionManager.socket,
        session: this.sessionId
      }
    );
    
    // Initialize chat interface
    this.components.chatInterface = new ChatInterface(
      this.tabContents.chat,
      {
        socket: this.connectionManager.socket,
        session: this.sessionId
      }
    );
    
    // Add welcome message to chat
    this.components.chatInterface.addSystemMessage('Connected to TV. Ask questions about what you\'re watching!');
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
    if (manualConnectForm) {
      manualConnectForm.addEventListener('submit', this.handleManualConnect);
    }
    
    // Manual connect button
    const manualConnectBtn = document.getElementById('manual-connect-btn');
    if (manualConnectBtn) {
      manualConnectBtn.addEventListener('click', () => {
        this.showScreen('manualConnect');
      });
    }
    
    // Back to scan button
    const backToScanBtn = document.getElementById('back-to-scan-btn');
    if (backToScanBtn) {
      backToScanBtn.addEventListener('click', () => {
        this.showScreen('scanning');
      });
    }
    
    // Error dismiss button
    const errorCloseBtn = document.getElementById('error-close-btn');
    if (errorCloseBtn) {
      errorCloseBtn.addEventListener('click', this.handleErrorDismiss);
    }
    
    // Disconnect button
    const disconnectBtn = document.getElementById('disconnect-btn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', this.handleDisconnect);
    }
    
    // iOS PWA prompt close
    const iosPwaClose = document.getElementById('ios-pwa-close');
    if (iosPwaClose) {
      iosPwaClose.addEventListener('click', () => {
        const prompt = document.getElementById('ios-pwa-prompt');
        if (prompt) {
          prompt.classList.add('hidden');
          localStorage.setItem('pwa_prompt_dismissed', 'true');
        }
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
    Object.keys(this.tabContents).forEach(key => {
      const tabContent = this.tabContents[key];
      if (tabContent) {
        tabContent.classList.toggle('active', `${key}-tab` === tabId);
      }
    });
  }
  
  /**
   * Handle manual connect form submission
   * @param {Event} event - Form submission event
   */
  handleManualConnect(event) {
    event.preventDefault();
    
    const sessionIdInput = document.getElementById('session-id-input');
    if (!sessionIdInput) {
      this.showError('Form Error', 'Session ID input not found');
      return;
    }
    
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
  connectToSession(sessionId) {
    try {
      this.showLoading('Connecting to TV...');
      
      // Stop QR scanner if running
      if (this.components.qrScanner && this.components.qrScanner.isScanning) {
        this.components.qrScanner.stopScanner();
      }
      
      // Store session ID
      this.sessionId = sessionId;
      
      // Connect through connection manager
      this.connectionManager.connect(sessionId).catch(error => {
        console.error('Connection error:', error);
        this.showError('Connection Error', 'Failed to connect to the server. Please try again.');
        this.hideLoading();
      });
    } catch (error) {
      console.error('Connection setup error:', error);
      this.showError('Connection Error', error.message || 'Failed to connect');
      this.hideLoading();
    }
  }
  
  /**
   * Handle successful connection
   */
  handleConnected() {
    console.log('Successfully connected to server');
    
    // Update connection status
    if (this.components.connectionStatus) {
      this.components.connectionStatus.classList.remove('disconnected');
      this.components.connectionStatus.classList.add('connected');
      this.components.connectionStatus.textContent = 'Connected';
    }
  }
  
  /**
   * Handle session joined event
   * @param {Object} data - Session data
   */
  handleSessionJoined(data) {
    console.log('Session joined:', data);
    
    // Save session to localStorage
    localStorage.setItem('memorystream_session', JSON.stringify({
      sessionId: this.sessionId,
      timestamp: Date.now()
    }));
    
    // Hide loading overlay
    this.hideLoading();
    
    // Show control screen
    this.showScreen('control');
    
    // Initialize control components
    this.initializeControlComponents();
    
    // Set initial active tab
    this.showTab('remote');
  }
  
  /**
   * Handle disconnection
   */
  handleDisconnected(data) {
    console.log('Disconnected from server:', data);
    
    // Update connection status
    if (this.components.connectionStatus) {
      this.components.connectionStatus.classList.remove('connected');
      this.components.connectionStatus.classList.add('disconnected');
      this.components.connectionStatus.textContent = 'Disconnected';
    }
    
    // Show reconnection message if not manual
    if (data && data.reason !== 'manual') {
      this.showError('Disconnected', 'Connection to the TV was lost. Trying to reconnect...');
    }
  }
  
  /**
   * Handle connection error
   * @param {Object} error - Error data
   */
  handleConnectionError(error) {
    console.error('Connection error:', error);
    
    // Update connection status
    if (this.components.connectionStatus) {
      this.components.connectionStatus.classList.remove('connected');
      this.components.connectionStatus.classList.add('error');
      this.components.connectionStatus.textContent = 'Error';
    }
    
    // Show error if not already on control screen
    if (!this.screens.control.classList.contains('active')) {
      this.showError('Connection Error', 'Failed to connect to the TV. Please try again.');
      this.hideLoading();
    }
  }
  
  /**
   * Handle manual disconnect
   */
  handleDisconnect() {
    // Disconnect connection manager
    if (this.connectionManager) {
      this.connectionManager.disconnect();
    }
    
    // Clear stored session
    localStorage.removeItem('memorystream_session');
    this.sessionId = null;
    
    // Go back to scanning screen
    this.showScreen('scanning');
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
      if (screen && screen.classList.contains('screen')) {
        screen.classList.remove('active');
      }
    });
    
    // Show requested screen
    if (this.screens[screenName]) {
      this.screens[screenName].classList.add('active');
      
      // Additional actions based on screen
      if (screenName === 'scanning' && this.components.qrScanner) {
        this.components.qrScanner.startScanner();
      } else if (screenName === 'control') {
        // Stop QR scanner if running
        if (this.components.qrScanner && this.components.qrScanner.isScanning) {
          this.components.qrScanner.stopScanner();
        }
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
    Object.keys(this.tabContents).forEach(key => {
      const tabContent = this.tabContents[key];
      if (tabContent) {
        tabContent.classList.toggle('active', key === tabName);
      }
    });
  }
  
  /**
   * Show loading overlay
   * @param {string} message - Loading message
   */
  showLoading(message) {
    if (!this.screens.loading) return;
    
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
    if (this.screens.loading) {
      this.screens.loading.classList.add('hidden');
    }
  }
  
  /**
   * Show error overlay
   * @param {string} title - Error title
   * @param {string} message - Error message
   */
  showError(title, message) {
    if (!this.screens.error) return;
    
    const errorTitle = this.screens.error.querySelector('#error-title');
    const errorMessage = this.screens.error.querySelector('#error-message');
    
    if (errorTitle) errorTitle.textContent = title || 'Error';
    if (errorMessage) errorMessage.textContent = message || 'An error occurred';
    
    this.screens.error.classList.remove('hidden');
  }
  
  /**
   * Hide error overlay
   */
  hideError() {
    if (this.screens.error) {
      this.screens.error.classList.add('hidden');
    }
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