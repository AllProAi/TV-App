import QrScanner from 'qrcode-parser';

/**
 * QRCodeScanner component for scanning QR codes with mobile camera
 */
class QRCodeScanner {
  /**
   * Create a new QRCodeScanner instance
   * @param {HTMLVideoElement} videoElement - Video element for camera view
   * @param {Object} options - Configuration options
   */
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement;
    this.options = {
      onScan: options.onScan || null, // Callback when QR code is scanned
      scanInterval: options.scanInterval || 500, // Interval in ms between scan attempts
      ...options
    };
    
    this.stream = null;
    this.scannerInterval = null;
    this.isScanning = false;
    this.lastResult = null;
    
    // Bind methods
    this.handleVideoStream = this.handleVideoStream.bind(this);
    this.handleStreamError = this.handleStreamError.bind(this);
    this.scanFrame = this.scanFrame.bind(this);
  }
  
  /**
   * Start QR code scanner
   */
  async startScanner() {
    if (this.isScanning) return;
    
    try {
      // Check for camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera if available
        audio: false
      });
      
      this.handleVideoStream(stream);
    } catch (error) {
      this.handleStreamError(error);
    }
  }
  
  /**
   * Handle video stream after permissions are granted
   * @param {MediaStream} stream - Camera stream
   */
  handleVideoStream(stream) {
    this.stream = stream;
    this.videoElement.srcObject = stream;
    this.isScanning = true;
    
    // Wait for video to be ready
    this.videoElement.onloadedmetadata = () => {
      this.videoElement.play();
      
      // Start scanning for QR codes
      this.scannerInterval = setInterval(this.scanFrame, this.options.scanInterval);
    };
  }
  
  /**
   * Handle errors when accessing camera
   * @param {Error} error - Stream error
   */
  handleStreamError(error) {
    console.error('Camera access error:', error);
    
    // Show appropriate error message based on error type
    let errorMessage = 'Failed to access camera.';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = 'Camera access denied. Please allow camera access to scan QR codes.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = 'No camera found on this device.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = 'Camera is already in use by another application.';
    }
    
    // Trigger error callback if provided
    if (this.options.onError) {
      this.options.onError(errorMessage, error);
    }
  }
  
  /**
   * Scan video frame for QR codes
   */
  async scanFrame() {
    if (!this.isScanning || !this.videoElement) return;
    
    try {
      // Get video dimensions
      const width = this.videoElement.videoWidth;
      const height = this.videoElement.videoHeight;
      
      if (width === 0 || height === 0) return; // Video not ready
      
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Draw video frame to canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0, width, height);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      
      // Scan for QR code
      const result = await QrScanner.scan(imageData);
      
      // If QR code found and different from last result
      if (result && result !== this.lastResult) {
        this.lastResult = result;
        
        // Call onScan callback
        if (this.options.onScan) {
          this.options.onScan(result);
        }
      }
    } catch (error) {
      // Ignore errors during scanning - usually just means no QR code found
      // But log unexpected errors
      if (error.name !== 'QRCodeError') {
        console.error('QR scan error:', error);
      }
    }
  }
  
  /**
   * Stop QR code scanner
   */
  stopScanner() {
    this.isScanning = false;
    
    // Clear scanning interval
    if (this.scannerInterval) {
      clearInterval(this.scannerInterval);
      this.scannerInterval = null;
    }
    
    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Clear video source
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    
    this.lastResult = null;
  }
  
  /**
   * Check if camera is available
   * @returns {Promise<boolean>} - Whether camera is available
   */
  static async isCameraAvailable() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error checking camera availability:', error);
      return false;
    }
  }
}

export default QRCodeScanner; 