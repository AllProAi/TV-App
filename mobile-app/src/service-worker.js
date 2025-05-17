// Service Worker for MemoryStream Mobile PWA

const CACHE_NAME = 'memorystream-mobile-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/main.js',
  '/main.css',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json'
];

// Service Worker Install Event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker...', event);
  
  // Precache critical assets
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Precache error:', error);
      })
  );
});

// Service Worker Activate Event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker...', event);
  
  // Clean up old caches
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('[Service Worker] Clearing old cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
  
  return self.clients.claim();
});

// Service Worker Fetch Event
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip socket.io requests
  if (event.request.url.includes('/socket.io/')) {
    return;
  }
  
  // Network-first strategy for API calls
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Otherwise try to fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response to store in cache
            const responseToCache = response.clone();
            
            // Add to cache for future requests
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // If offline and requesting a page, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Service Worker Message Event
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  // Handle messages from the client
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background Sync Event (for offline operations)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Sync event:', event.tag);
  
  if (event.tag === 'offline-commands') {
    event.waitUntil(syncOfflineCommands());
  }
});

// Function to sync offline commands
async function syncOfflineCommands() {
  try {
    // Get offline commands from IndexedDB
    const db = await openDatabase();
    const commands = await getOfflineCommands(db);
    
    if (commands.length === 0) {
      return;
    }
    
    // Process each command
    for (const command of commands) {
      try {
        // Send to server
        const response = await fetch('/api/command/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(command)
        });
        
        if (response.ok) {
          // Remove from IndexedDB if successful
          await removeOfflineCommand(db, command.id);
        }
      } catch (error) {
        console.error('[Service Worker] Failed to sync command:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync error:', error);
  }
}

// IndexedDB helper functions
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MemoryStreamOfflineDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('commands')) {
        db.createObjectStore('commands', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function getOfflineCommands(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['commands'], 'readonly');
    const store = transaction.objectStore('commands');
    const request = store.getAll();
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function removeOfflineCommand(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['commands'], 'readwrite');
    const store = transaction.objectStore('commands');
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
} 