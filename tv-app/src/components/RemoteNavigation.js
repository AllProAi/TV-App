/**
 * RemoteNavigation component for handling focus navigation with remote control
 */
class RemoteNavigation {
  /**
   * Create a new RemoteNavigation instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      debug: options.debug || false,
      focusDebugElement: options.focusDebugElement || null,
      ...options
    };
    
    this.focusableElements = [];
    this.currentFocusIndex = -1;
    this.initialized = false;
    
    this.initialize();
  }
  
  /**
   * Initialize the navigation system
   */
  initialize() {
    // Find all focusable elements
    this.refreshFocusableElements();
    
    // Set initial focus
    if (this.focusableElements.length > 0) {
      this.setFocus(0);
    }
    
    this.initialized = true;
    
    // Enable debug if requested
    if (this.options.debug && this.options.focusDebugElement) {
      this.options.focusDebugElement.classList.remove('hidden');
    }
  }
  
  /**
   * Refresh the list of focusable elements
   */
  refreshFocusableElements() {
    // Get all elements with tabindex
    this.focusableElements = Array.from(document.querySelectorAll('[tabindex]:not([tabindex="-1"])'));
    
    // Sort by tabindex if specified
    this.focusableElements.sort((a, b) => {
      const indexA = parseInt(a.getAttribute('tabindex'), 10);
      const indexB = parseInt(b.getAttribute('tabindex'), 10);
      
      if (isNaN(indexA) || isNaN(indexB)) return 0;
      return indexA - indexB;
    });
  }
  
  /**
   * Handle key down events for navigation
   * @param {KeyboardEvent} event - Key event
   * @returns {boolean} - Whether the event was handled
   */
  handleKeyDown(event) {
    if (!this.initialized || this.focusableElements.length === 0) {
      return false;
    }
    
    // Get current focused element
    const focused = document.activeElement;
    this.currentFocusIndex = this.focusableElements.indexOf(focused);
    
    switch (event.key) {
      case 'ArrowUp':
        this.moveFocus('up');
        return true;
      case 'ArrowDown':
        this.moveFocus('down');
        return true;
      case 'ArrowLeft':
        this.moveFocus('left');
        return true;
      case 'ArrowRight':
        this.moveFocus('right');
        return true;
      default:
        return false;
    }
  }
  
  /**
   * Move focus in the specified direction
   * @param {string} direction - Direction to move (up, down, left, right)
   */
  moveFocus(direction) {
    if (this.currentFocusIndex === -1) {
      // No current focus, set initial
      this.setFocus(0);
      return;
    }
    
    const currentElement = this.focusableElements[this.currentFocusIndex];
    
    // Get element position
    const currentRect = currentElement.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;
    
    // Find the best candidate in the requested direction
    let bestElement = null;
    let bestDistance = Infinity;
    
    this.focusableElements.forEach(element => {
      if (element === currentElement) return;
      
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const horizontal = centerX - currentCenterX;
      const vertical = centerY - currentCenterY;
      const distance = Math.sqrt(horizontal * horizontal + vertical * vertical);
      
      // Check if element is in the requested direction
      let inDirection = false;
      
      switch (direction) {
        case 'up':
          inDirection = vertical < -10;
          break;
        case 'down':
          inDirection = vertical > 10;
          break;
        case 'left':
          inDirection = horizontal < -10;
          break;
        case 'right':
          inDirection = horizontal > 10;
          break;
      }
      
      if (inDirection && distance < bestDistance) {
        bestElement = element;
        bestDistance = distance;
      }
    });
    
    // If no suitable element found, try circular navigation
    if (!bestElement) {
      if (direction === 'down' || direction === 'right') {
        // Move to first element
        bestElement = this.focusableElements[0];
      } else if (direction === 'up' || direction === 'left') {
        // Move to last element
        bestElement = this.focusableElements[this.focusableElements.length - 1];
      }
    }
    
    // Set focus to best element
    if (bestElement) {
      const index = this.focusableElements.indexOf(bestElement);
      this.setFocus(index);
    }
  }
  
  /**
   * Set focus to the element at the specified index
   * @param {number} index - Element index to focus
   */
  setFocus(index) {
    if (index < 0 || index >= this.focusableElements.length) {
      return;
    }
    
    const element = this.focusableElements[index];
    element.focus();
    this.currentFocusIndex = index;
    
    // Update debug info if enabled
    if (this.options.debug && this.options.focusDebugElement) {
      const focusName = element.id || element.classList.toString() || 'Unknown';
      const focusElementName = this.options.focusDebugElement.querySelector('#focus-element-name');
      if (focusElementName) {
        focusElementName.textContent = focusName;
      }
    }
  }
  
  /**
   * Set initial focus to an element with the specified ID
   * @param {string} elementId - ID of element to focus
   */
  setInitialFocus(elementId) {
    // Refresh elements to ensure we have the latest DOM state
    this.refreshFocusableElements();
    
    // Find element with matching ID
    const index = this.focusableElements.findIndex(el => el.id === elementId);
    if (index !== -1) {
      this.setFocus(index);
    } else {
      // If not found, set focus to first element
      this.setFocus(0);
    }
  }
}

export default RemoteNavigation; 