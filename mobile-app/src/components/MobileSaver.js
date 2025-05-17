/**
 * MobileSaver.js
 * Component for receiving and saving content sent from the TV app
 */

class MobileSaver {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
    this.container = null;
    this.savedItems = [];
    this.notificationTimeout = null;
    
    // Load saved items from local storage
    this.loadSavedItems();
    
    // Set up event listeners for WebSocket messages
    this.setupEventListeners();
  }

  /**
   * Initialize the component in the DOM
   * @param {HTMLElement} container - Container element
   */
  init(container) {
    this.container = container;
    this.render();
  }

  /**
   * Set up WebSocket event listeners
   */
  setupEventListeners() {
    // Listen for mobile save events from the server
    this.connectionManager.socket.on('mobile:save', (data) => {
      this.handleNewItem(data);
    });
  }

  /**
   * Load saved items from local storage
   */
  loadSavedItems() {
    try {
      const savedData = localStorage.getItem('memorystream_saved_items');
      if (savedData) {
        this.savedItems = JSON.parse(savedData);
      }
    } catch (error) {
      console.error('Error loading saved items:', error);
      this.savedItems = [];
    }
  }

  /**
   * Save items to local storage
   */
  saveToPersistentStorage() {
    try {
      localStorage.setItem('memorystream_saved_items', JSON.stringify(this.savedItems));
    } catch (error) {
      console.error('Error saving items to storage:', error);
    }
  }

  /**
   * Handle a new saved item
   * @param {Object} item - Item to save
   */
  handleNewItem(item) {
    // Add timestamp if not present
    if (!item.timestamp) {
      item.timestamp = Date.now();
    }
    
    // Add the item to the saved list
    this.savedItems.unshift(item);
    
    // Limit the number of saved items
    if (this.savedItems.length > 100) {
      this.savedItems = this.savedItems.slice(0, 100);
    }
    
    // Save to persistent storage
    this.saveToPersistentStorage();
    
    // Re-render the UI
    this.render();
    
    // Show notification
    this.showNotification(item);
  }

  /**
   * Delete a saved item
   * @param {string} itemId - ID of the item to delete
   */
  deleteItem(itemId) {
    this.savedItems = this.savedItems.filter(item => item.id !== itemId);
    this.saveToPersistentStorage();
    this.render();
  }

  /**
   * Clear all saved items
   */
  clearAllItems() {
    if (confirm('Are you sure you want to delete all saved items?')) {
      this.savedItems = [];
      this.saveToPersistentStorage();
      this.render();
    }
  }

  /**
   * Show a notification for a new saved item
   * @param {Object} item - Saved item
   */
  showNotification(item) {
    // Clear any existing notification
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'mobile-saver-notification';
    
    let notificationContent = '';
    switch (item.type) {
      case 'link':
        notificationContent = `<h3>Link Saved</h3><p>${item.data.title || 'External content'}</p>`;
        break;
      case 'timestamp':
        notificationContent = `<h3>Timestamp Saved</h3><p>${this.formatTime(item.videoTime)}</p>`;
        break;
      case 'note':
        notificationContent = `<h3>Note Saved</h3><p>${item.data.text.substring(0, 50)}${item.data.text.length > 50 ? '...' : ''}</p>`;
        break;
      case 'image':
        notificationContent = `<h3>Image Saved</h3><p>${item.data.caption || 'Screenshot'}</p>`;
        break;
      default:
        notificationContent = `<h3>Item Saved</h3>`;
    }
    
    notification.innerHTML = notificationContent;
    
    // Add to the DOM
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('visible');
    }, 10);
    
    // Remove after delay
    this.notificationTimeout = setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300); // Matches CSS transition time
    }, 3000);
  }

  /**
   * Format seconds as timestamp
   * @param {number} seconds - Seconds to format
   * @returns {string} Formatted timestamp
   */
  formatTime(seconds) {
    if (typeof seconds !== 'number') return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Format date for display
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted date
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the header
    const header = document.createElement('div');
    header.className = 'mobile-saver-header';
    header.innerHTML = `
      <h2>Saved Items</h2>
      <button class="clear-all-button" ${this.savedItems.length === 0 ? 'disabled' : ''}>Clear All</button>
    `;
    this.container.appendChild(header);
    
    // Add event listener to the clear all button
    const clearButton = header.querySelector('.clear-all-button');
    clearButton.addEventListener('click', () => this.clearAllItems());
    
    // Create the items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'mobile-saver-items';
    
    if (this.savedItems.length === 0) {
      // Show empty state
      itemsContainer.innerHTML = `
        <div class="empty-state">
          <p>No saved items yet</p>
          <p class="hint">Items you save from the TV will appear here</p>
        </div>
      `;
    } else {
      // Render each saved item
      this.savedItems.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = `saved-item ${item.type}`;
        itemElement.dataset.id = item.id;
        
        let itemContent = '';
        
        // Common header for all items
        const header = `
          <div class="item-header">
            <span class="timestamp">${this.formatDate(item.timestamp)}</span>
            <button class="delete-button" aria-label="Delete">×</button>
          </div>
        `;
        
        // Content based on item type
        switch (item.type) {
          case 'link':
            itemContent = `
              ${header}
              <div class="item-content">
                <h3>${item.data.title || 'External Link'}</h3>
                <p>${item.data.description || ''}</p>
                <a href="${item.data.url}" target="_blank" rel="noopener noreferrer">Open Link</a>
              </div>
            `;
            break;
            
          case 'timestamp':
            itemContent = `
              ${header}
              <div class="item-content">
                <h3>Saved Moment</h3>
                <p class="video-time">${this.formatTime(item.videoTime)}</p>
                <p>${item.data.note || ''}</p>
              </div>
            `;
            break;
            
          case 'note':
            itemContent = `
              ${header}
              <div class="item-content">
                <h3>Note</h3>
                <p>${item.data.text}</p>
                ${item.videoTime ? `<p class="video-time">From: ${this.formatTime(item.videoTime)}</p>` : ''}
              </div>
            `;
            break;
            
          case 'image':
            itemContent = `
              ${header}
              <div class="item-content">
                <h3>${item.data.caption || 'Screenshot'}</h3>
                <img src="${item.data.url}" alt="${item.data.caption || 'Screenshot'}" />
                ${item.videoTime ? `<p class="video-time">From: ${this.formatTime(item.videoTime)}</p>` : ''}
              </div>
            `;
            break;
            
          default:
            itemContent = `
              ${header}
              <div class="item-content">
                <h3>Saved Item</h3>
                <p>Unknown format</p>
              </div>
            `;
        }
        
        itemElement.innerHTML = itemContent;
        
        // Add event listener for delete button
        const deleteButton = itemElement.querySelector('.delete-button');
        if (deleteButton) {
          deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteItem(item.id);
          });
        }
        
        itemsContainer.appendChild(itemElement);
      });
    }
    
    this.container.appendChild(itemsContainer);
  }
}

export default MobileSaver; 