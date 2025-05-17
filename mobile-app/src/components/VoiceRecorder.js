/**
 * Voice Recorder component for mobile app
 * Captures and processes audio for voice commands
 */
class VoiceRecorder {
  /**
   * Initialize Voice Recorder
   * @param {HTMLElement} container - Container element for the UI
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.socket = options.socket;
    this.session = options.session;
    this.eventListeners = {};
    
    this.isRecording = false;
    this.isProcessing = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    
    this.render();
    this.bindEvents();
    this.initPermissionCheck();
  }
  
  /**
   * Render the voice recorder UI
   */
  render() {
    this.container.innerHTML = `
      <div class="voice-recorder">
        <div class="voice-status">
          <div class="voice-status-indicator"></div>
          <span class="voice-status-text">Ready for voice commands</span>
        </div>
        
        <button class="voice-button" id="voiceButton">
          <div class="voice-button-icon">
            <i class="icon-mic"></i>
          </div>
          <span class="voice-button-text">Hold to speak</span>
        </button>
        
        <div class="voice-instructions">
          <p>Try saying:</p>
          <ul>
            <li>"Pause the video"</li>
            <li>"Skip forward 30 seconds"</li>
            <li>"Turn on subtitles"</li>
            <li>"What just happened?"</li>
          </ul>
        </div>
        
        <div class="voice-results">
          <div class="voice-transcription"></div>
          <div class="voice-response"></div>
        </div>
      </div>
    `;
    
    // Cache DOM elements
    this.elements = {
      button: this.container.querySelector('.voice-button'),
      statusIndicator: this.container.querySelector('.voice-status-indicator'),
      statusText: this.container.querySelector('.voice-status-text'),
      transcription: this.container.querySelector('.voice-transcription'),
      response: this.container.querySelector('.voice-response')
    };
    
    // Initial state
    this.updateUIState('initial');
  }
  
  /**
   * Bind event listeners to UI elements
   */
  bindEvents() {
    const button = this.elements.button;
    
    // Record while button is pressed
    button.addEventListener('mousedown', this.startRecording.bind(this));
    button.addEventListener('touchstart', this.startRecording.bind(this));
    
    // Stop when released
    button.addEventListener('mouseup', this.stopRecording.bind(this));
    button.addEventListener('touchend', this.stopRecording.bind(this));
    
    // Cancel on mouse/touch leave
    button.addEventListener('mouseleave', this.cancelRecording.bind(this));
    button.addEventListener('touchcancel', this.cancelRecording.bind(this));
    
    // Listen for socket events
    if (this.socket) {
      this.socket.on('command:processed', this.handleCommandResponse.bind(this));
      this.socket.on('voice:transcription', this.handleTranscription.bind(this));
    }
  }
  
  /**
   * Check microphone permissions
   */
  async initPermissionCheck() {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.updateUIState('unsupported');
        return;
      }
      
      // Check if permission is already granted
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      
      if (permissionStatus.state === 'granted') {
        this.updateUIState('ready');
      } else if (permissionStatus.state === 'denied') {
        this.updateUIState('denied');
      } else {
        this.updateUIState('prompt');
      }
      
      // Listen for permission changes
      permissionStatus.addEventListener('change', () => {
        if (permissionStatus.state === 'granted') {
          this.updateUIState('ready');
        } else if (permissionStatus.state === 'denied') {
          this.updateUIState('denied');
        }
      });
    } catch (error) {
      console.error('Permission check error:', error);
      // If permissions API is not supported, we'll find out when trying to record
      this.updateUIState('prompt');
    }
  }
  
  /**
   * Start recording audio
   */
  async startRecording(event) {
    event.preventDefault();
    
    if (this.isRecording || this.isProcessing) return;
    
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      
      // Listen for data available event
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });
      
      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      
      // Update UI
      this.updateUIState('recording');
      
      // Auto-stop after 10 seconds
      this.recordingTimeout = setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, 10000);
      
      this.triggerEvent('recordingStarted');
    } catch (error) {
      console.error('Recording error:', error);
      
      if (error.name === 'NotAllowedError') {
        this.updateUIState('denied');
      } else {
        this.updateUIState('error');
      }
    }
  }
  
  /**
   * Stop recording and process audio
   */
  async stopRecording(event) {
    if (event) event.preventDefault();
    if (!this.isRecording) return;
    
    clearTimeout(this.recordingTimeout);
    
    try {
      // Stop recording
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.isProcessing = true;
      
      // Update UI
      this.updateUIState('processing');
      
      // Wait for mediaRecorder to finish
      await new Promise(resolve => {
        this.mediaRecorder.addEventListener('stop', resolve, { once: true });
      });
      
      // Create blob from audio chunks
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      
      // Convert to base64 for transmission
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = () => {
        const base64data = reader.result;
        
        // Send to server
        if (this.socket && this.session) {
          this.socket.emit('command:voice', {
            audio: base64data,
            timestamp: Date.now()
          });
        }
        
        this.triggerEvent('recordingComplete', { audioBlob, base64data });
      };
    } catch (error) {
      console.error('Stop recording error:', error);
      this.updateUIState('error');
    } finally {
      // Stop microphone access
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
    }
  }
  
  /**
   * Cancel recording without processing
   */
  cancelRecording(event) {
    if (event) event.preventDefault();
    if (!this.isRecording) return;
    
    clearTimeout(this.recordingTimeout);
    
    // Stop recording
    this.mediaRecorder.stop();
    this.isRecording = false;
    
    // Update UI
    this.updateUIState('ready');
    
    // Stop microphone access
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.triggerEvent('recordingCancelled');
  }
  
  /**
   * Handle command processing response
   * @param {Object} response - Command processing result
   */
  handleCommandResponse(response) {
    this.isProcessing = false;
    
    // Update UI
    if (response.confidence > 0.7) {
      this.updateUIState('success');
    } else {
      this.updateUIState('unclear');
    }
    
    // Display response
    this.elements.response.textContent = response.action === 'none'
      ? `I couldn't understand that command. ${response.clarification || ''}`
      : `Command: ${response.action}`;
    
    // Reset to ready state after a delay
    setTimeout(() => {
      this.updateUIState('ready');
      this.elements.response.textContent = '';
    }, 3000);
    
    this.triggerEvent('commandProcessed', response);
  }
  
  /**
   * Handle transcription result
   * @param {Object} result - Transcription result
   */
  handleTranscription(result) {
    // Display transcription
    this.elements.transcription.textContent = result.text;
    
    // Clear after delay
    setTimeout(() => {
      this.elements.transcription.textContent = '';
    }, 5000);
    
    this.triggerEvent('transcriptionReceived', result);
  }
  
  /**
   * Update UI based on current state
   * @param {string} state - Current state
   */
  updateUIState(state) {
    const { statusIndicator, statusText, button } = this.elements;
    
    // Remove all state classes
    this.container.classList.remove('state-initial', 'state-ready', 'state-recording', 
      'state-processing', 'state-success', 'state-unclear', 'state-error', 
      'state-denied', 'state-unsupported', 'state-prompt');
    
    // Add current state class
    this.container.classList.add(`state-${state}`);
    
    // Update status text
    switch (state) {
      case 'initial':
        statusText.textContent = 'Checking microphone access...';
        button.disabled = true;
        break;
        
      case 'ready':
        statusText.textContent = 'Ready for voice commands';
        button.disabled = false;
        break;
        
      case 'recording':
        statusText.textContent = 'Listening...';
        break;
        
      case 'processing':
        statusText.textContent = 'Processing voice command...';
        button.disabled = true;
        break;
        
      case 'success':
        statusText.textContent = 'Command recognized!';
        button.disabled = false;
        break;
        
      case 'unclear':
        statusText.textContent = 'Command unclear. Please try again.';
        button.disabled = false;
        break;
        
      case 'error':
        statusText.textContent = 'Error processing voice. Please try again.';
        button.disabled = false;
        break;
        
      case 'denied':
        statusText.textContent = 'Microphone access denied. Please enable in browser settings.';
        button.disabled = true;
        break;
        
      case 'unsupported':
        statusText.textContent = 'Voice commands not supported in this browser.';
        button.disabled = true;
        break;
        
      case 'prompt':
        statusText.textContent = 'Click button to enable microphone';
        button.disabled = false;
        break;
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
        console.error(`Error in VoiceRecorder ${event} event handler:`, error);
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

export default VoiceRecorder; 