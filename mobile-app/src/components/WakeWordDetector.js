/**
 * WakeWordDetector.js
 * Component for local wake word detection to reduce voice command latency
 */

class WakeWordDetector {
  constructor(options = {}) {
    this.options = {
      wakeWord: options.wakeWord || 'hey memory',
      threshold: options.threshold || 0.7,
      maxRecordingTime: options.maxRecordingTime || 5000, // ms
      processingInterval: options.processingInterval || 500, // ms
      ...options
    };
    
    this.isListening = false;
    this.audioContext = null;
    this.recognizer = null;
    this.mediaStream = null;
    this.audioProcessor = null;
    this.recordingBuffer = [];
    this.isProcessing = false;
    this.processingInterval = null;
    this.onDetectedCallbacks = [];
    this.onListeningCallbacks = [];
    this.onErrorCallbacks = [];
    
    // Check for browser compatibility
    this.isCompatible = this.checkCompatibility();
  }

  /**
   * Check if the browser supports the necessary features
   * @returns {boolean} Whether the browser is compatible
   */
  checkCompatibility() {
    return !!(
      window.AudioContext || window.webkitAudioContext ||
      navigator.mediaDevices?.getUserMedia ||
      window.SpeechRecognition || window.webkitSpeechRecognition
    );
  }

  /**
   * Initialize the wake word detector
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async init() {
    if (!this.isCompatible) {
      this.notifyError('Browser not compatible with wake word detection');
      return false;
    }
    
    try {
      // Initialize audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognizer = new SpeechRecognition();
      this.recognizer.continuous = true;
      this.recognizer.interimResults = true;
      this.recognizer.lang = 'en-US';
      
      // Set up event handlers
      this.recognizer.onresult = this.handleSpeechResult.bind(this);
      this.recognizer.onerror = this.handleSpeechError.bind(this);
      this.recognizer.onend = this.handleSpeechEnd.bind(this);
      
      return true;
    } catch (error) {
      console.error('Error initializing wake word detector:', error);
      this.notifyError(`Initialization error: ${error.message}`);
      return false;
    }
  }

  /**
   * Start listening for the wake word
   * @returns {Promise<boolean>} Whether start was successful
   */
  async start() {
    if (this.isListening) return true;
    
    if (!this.audioContext || !this.recognizer) {
      const initSuccess = await this.init();
      if (!initSuccess) return false;
    }
    
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Connect to audio context
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Set up audio processing for recording buffer
      this.audioProcessor.onaudioprocess = (e) => {
        if (this.isListening) {
          // Store raw audio data for potential command processing
          this.recordingBuffer.push(new Float32Array(e.inputBuffer.getChannelData(0)));
          
          // Limit buffer size based on maxRecordingTime
          const bufferDuration = this.recordingBuffer.length * 4096 / this.audioContext.sampleRate * 1000;
          if (bufferDuration > this.options.maxRecordingTime) {
            this.recordingBuffer.shift();
          }
        }
      };
      
      // Connect the audio graph
      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);
      
      // Start speech recognition
      this.recognizer.start();
      
      // Start periodic processing
      this.processingInterval = setInterval(() => {
        this.processAudioBuffer();
      }, this.options.processingInterval);
      
      this.isListening = true;
      this.notifyListeningChange(true);
      
      return true;
    } catch (error) {
      console.error('Error starting wake word detector:', error);
      this.notifyError(`Start error: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop listening for the wake word
   */
  stop() {
    if (!this.isListening) return;
    
    try {
      // Stop speech recognition
      if (this.recognizer) {
        this.recognizer.stop();
      }
      
      // Stop audio processing
      if (this.audioProcessor) {
        this.audioProcessor.disconnect();
        this.audioProcessor = null;
      }
      
      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      // Clear processing interval
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
      
      // Clear recording buffer
      this.recordingBuffer = [];
      this.isProcessing = false;
      this.isListening = false;
      this.notifyListeningChange(false);
    } catch (error) {
      console.error('Error stopping wake word detector:', error);
      this.notifyError(`Stop error: ${error.message}`);
    }
  }

  /**
   * Handle speech recognition results
   * @param {Event} event - Speech recognition event
   */
  handleSpeechResult(event) {
    if (!this.isListening || !event.results) return;
    
    const result = event.results[event.results.length - 1];
    if (!result.isFinal) {
      const transcript = result[0].transcript.trim().toLowerCase();
      
      // Check if the transcript contains the wake word
      if (transcript.includes(this.options.wakeWord) && result[0].confidence >= this.options.threshold) {
        this.handleWakeWordDetected(transcript);
      }
    }
  }

  /**
   * Handle speech recognition errors
   * @param {Event} event - Speech recognition error event
   */
  handleSpeechError(event) {
    console.warn('Speech recognition error:', event.error);
    
    // Some errors are non-fatal, just notify
    this.notifyError(`Recognition error: ${event.error}`);
    
    // If we get a fatal error, restart recognition
    if (['network', 'service-not-allowed'].includes(event.error)) {
      // Wait a bit before restarting
      setTimeout(() => {
        if (this.isListening) {
          this.stop();
          this.start();
        }
      }, 3000);
    }
  }

  /**
   * Handle speech recognition end
   */
  handleSpeechEnd() {
    // Speech recognition can end unexpectedly, restart if we're still supposed to be listening
    if (this.isListening && this.recognizer) {
      try {
        this.recognizer.start();
      } catch (error) {
        console.warn('Error restarting speech recognition:', error);
        
        // If we can't restart immediately, try again after a delay
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognizer.start();
            } catch (e) {
              // If it fails again, give up and stop properly
              this.stop();
              this.notifyError('Failed to restart speech recognition');
            }
          }
        }, 1000);
      }
    }
  }

  /**
   * Handle wake word detection
   * @param {string} transcript - Detected speech transcript
   */
  handleWakeWordDetected(transcript) {
    // Notify listeners of wake word detection
    this.notifyDetection(transcript);
    
    // Process the audio buffer to provide the recent audio for command processing
    // This allows for lower latency as we already have the audio data
    const recordingData = this.getRecordingBuffer();
    
    // Stop listening temporarily to avoid recursive detections
    this.stop();
    
    // Notify with the recording data
    this.notifyDetection(transcript, recordingData);
  }

  /**
   * Process the audio buffer for wake word detection
   * Alternative to using the speech recognition API
   */
  processAudioBuffer() {
    // This is a placeholder for more sophisticated wake word detection
    // In a real implementation, this would use a local model (e.g., TensorFlow.js)
    // to detect the wake word in the audio buffer
    
    // For now, we rely primarily on the speech recognition API
    if (this.isProcessing || this.recordingBuffer.length === 0) return;
    
    this.isProcessing = true;
    
    // Example of how we might process the buffer:
    // 1. Convert raw audio to the format needed by our model
    // 2. Run the wake word detection model on the processed audio
    // 3. If wake word detected with sufficient confidence, trigger the callback
    
    this.isProcessing = false;
  }

  /**
   * Get the current recording buffer as a single audio buffer
   * @returns {Float32Array} Concatenated audio buffer
   */
  getRecordingBuffer() {
    if (this.recordingBuffer.length === 0) return new Float32Array(0);
    
    // Calculate total length
    const totalLength = this.recordingBuffer.reduce(
      (sum, buffer) => sum + buffer.length, 0
    );
    
    // Create a new buffer and copy data
    const result = new Float32Array(totalLength);
    let offset = 0;
    
    for (const buffer of this.recordingBuffer) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    
    return result;
  }

  /**
   * Register a callback for wake word detection
   * @param {Function} callback - Callback function
   */
  onDetected(callback) {
    if (typeof callback === 'function') {
      this.onDetectedCallbacks.push(callback);
    }
  }

  /**
   * Register a callback for listening state changes
   * @param {Function} callback - Callback function
   */
  onListeningChange(callback) {
    if (typeof callback === 'function') {
      this.onListeningCallbacks.push(callback);
    }
  }

  /**
   * Register a callback for errors
   * @param {Function} callback - Callback function
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this.onErrorCallbacks.push(callback);
    }
  }

  /**
   * Notify all detection callbacks
   * @param {string} transcript - Detected speech transcript
   * @param {Float32Array} audioData - Raw audio data
   */
  notifyDetection(transcript, audioData) {
    const data = {
      timestamp: Date.now(),
      transcript,
      audioData,
      wakeWord: this.options.wakeWord
    };
    
    this.onDetectedCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in wake word detection callback:', error);
      }
    });
  }

  /**
   * Notify all listening change callbacks
   * @param {boolean} isListening - Whether the detector is now listening
   */
  notifyListeningChange(isListening) {
    this.onListeningCallbacks.forEach(callback => {
      try {
        callback(isListening);
      } catch (error) {
        console.error('Error in listening change callback:', error);
      }
    });
  }

  /**
   * Notify all error callbacks
   * @param {string} message - Error message
   */
  notifyError(message) {
    const error = {
      timestamp: Date.now(),
      message
    };
    
    this.onErrorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error callback:', err);
      }
    });
  }

  /**
   * Set a new wake word
   * @param {string} wakeWord - New wake word
   */
  setWakeWord(wakeWord) {
    if (!wakeWord) return;
    this.options.wakeWord = wakeWord.toLowerCase();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.recognizer = null;
    this.onDetectedCallbacks = [];
    this.onListeningCallbacks = [];
    this.onErrorCallbacks = [];
  }
}

export default WakeWordDetector; 