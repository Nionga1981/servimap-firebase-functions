// ServiMap Service Worker - Complete PWA Implementation
// Version 1.0.0 - Production Ready

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `servimap-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `servimap-dynamic-${CACHE_VERSION}`;
const API_CACHE = `servimap-api-${CACHE_VERSION}`;
const IMAGES_CACHE = `servimap-images-${CACHE_VERSION}`;
const OFFLINE_CACHE = `servimap-offline-${CACHE_VERSION}`;

// Cache size limits (MB)
const CACHE_LIMITS = {
  [STATIC_CACHE]: 50,
  [DYNAMIC_CACHE]: 30,
  [API_CACHE]: 20,
  [IMAGES_CACHE]: 100,
  [OFFLINE_CACHE]: 10
};

// Cache expiration times (milliseconds)
const CACHE_EXPIRATION = {
  static: 7 * 24 * 60 * 60 * 1000,    // 7 days
  api: 60 * 60 * 1000,                // 1 hour
  images: 30 * 24 * 60 * 60 * 1000,   // 30 days
  dynamic: 24 * 60 * 60 * 1000,       // 1 day
  offline: 365 * 24 * 60 * 60 * 1000  // 1 year
};

// Static assets to precache
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints for caching
const API_ENDPOINTS = [
  '/api/user/profile',
  '/api/services/categories',
  '/api/wallet/balance',
  '/api/messages/recent'
];

// Offline fallback pages
const OFFLINE_FALLBACKS = {
  '/search': '/offline-search.html',
  '/messages': '/offline-messages.html',
  '/wallet': '/offline-wallet.html',
  '/profile': '/offline-profile.html'
};

// Background sync tags
const SYNC_TAGS = {
  MESSAGE_SEND: 'message-send',
  RATING_SUBMIT: 'rating-submit',
  PHOTO_UPLOAD: 'photo-upload',
  SERVICE_REQUEST: 'service-request'
};

// Performance metrics
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  offlineRequests: 0
};

// Install Event - Cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return caches.open(OFFLINE_CACHE);
      })
      .then(cache => {
        console.log('[SW] Caching offline fallbacks');
        return cache.addAll([
          '/offline.html',
          '/offline-search.html', 
          '/offline-messages.html',
          '/offline-wallet.html',
          '/offline-profile.html'
        ]);
      })
      .then(() => {
        console.log('[SW] Service Worker installed successfully');
        self.skipWaiting(); // Force activation
      })
      .catch(error => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const deletePromises = cacheNames
          .filter(cacheName => {
            return cacheName.startsWith('servimap-') && 
                   !cacheName.includes(CACHE_VERSION);
          })
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim(); // Take control immediately
      })
      .catch(error => {
        console.error('[SW] Activation failed:', error);
      })
  );
});

// Fetch Event - Main request handling
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  performanceMetrics.networkRequests++;
  
  // Route request to appropriate strategy
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isAPIRequest(request)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isImageRequest(request)) {
    event.respondWith(staleWhileRevalidateStrategy(request, IMAGES_CACHE));
  } else if (isNavigationRequest(request)) {
    event.respondWith(navigationStrategy(request));
  } else {
    event.respondWith(dynamicCacheStrategy(request));
  }
});

// Cache First Strategy - For static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      console.log('[SW] Cache hit:', request.url);
      
      // Check if cache is expired
      const cacheDate = new Date(cachedResponse.headers.get('sw-cache-date') || 0);
      const now = new Date();
      const isExpired = (now - cacheDate) > CACHE_EXPIRATION.static;
      
      if (!isExpired) {
        return cachedResponse;
      }
    }
    
    // Fetch from network and update cache
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      responseToCache.headers.set('sw-cache-date', new Date().toISOString());
      await cache.put(request, responseToCache);
      console.log('[SW] Updated cache for:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    performanceMetrics.cacheMisses++;
    console.error('[SW] Cache first strategy failed:', error);
    
    // Return cached version if available, even if expired
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('Asset not available offline', { status: 404 });
  }
}

// Network First Strategy - For API requests
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      responseToCache.headers.set('sw-cache-date', new Date().toISOString());
      await cache.put(request, responseToCache);
      performanceMetrics.cacheHits++;
    }
    
    return networkResponse;
    
  } catch (error) {
    performanceMetrics.offlineRequests++;
    console.log('[SW] Network failed, checking cache for:', request.url);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cache is not too old for API data
      const cacheDate = new Date(cachedResponse.headers.get('sw-cache-date') || 0);
      const now = new Date();
      const isExpired = (now - cacheDate) > CACHE_EXPIRATION.api;
      
      if (!isExpired) {
        console.log('[SW] Serving cached API response:', request.url);
        return cachedResponse;
      }
    }
    
    // Return offline response for critical API endpoints
    if (isCriticalAPI(request)) {
      return new Response(JSON.stringify({
        offline: true,
        message: 'Datos no disponibles sin conexión',
        cached: !!cachedResponse
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Stale While Revalidate Strategy - For images
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Start fetching from network (don't await)
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      responseToCache.headers.set('sw-cache-date', new Date().toISOString());
      cache.put(request, responseToCache);
    }
    return networkResponse;
  }).catch(error => {
    console.log('[SW] Network fetch failed for image:', request.url);
    return null;
  });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    
    // Check if cache is very old
    const cacheDate = new Date(cachedResponse.headers.get('sw-cache-date') || 0);
    const now = new Date();
    const isVeryOld = (now - cacheDate) > CACHE_EXPIRATION.images;
    
    if (!isVeryOld) {
      return cachedResponse;
    }
  }
  
  // Wait for network if no cache or very old cache
  try {
    const networkResponse = await fetchPromise;
    return networkResponse || cachedResponse || createOfflineImageResponse();
  } catch (error) {
    return cachedResponse || createOfflineImageResponse();
  }
}

// Navigation Strategy - For page navigation
async function navigationStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    
    return networkResponse;
    
  } catch (error) {
    performanceMetrics.offlineRequests++;
    console.log('[SW] Navigation offline, serving fallback for:', request.url);
    
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Check for specific offline fallbacks
    if (OFFLINE_FALLBACKS[pathname]) {
      const cache = await caches.open(OFFLINE_CACHE);
      const fallback = await cache.match(OFFLINE_FALLBACKS[pathname]);
      if (fallback) return fallback;
    }
    
    // Try cached version of the page
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    
    // Return generic offline page
    const offlineCache = await caches.open(OFFLINE_CACHE);
    const offlinePage = await offlineCache.match('/offline.html');
    return offlinePage || new Response('Página no disponible sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// Dynamic Cache Strategy - For other requests
async function dynamicCacheStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      const responseToCache = networkResponse.clone();
      responseToCache.headers.set('sw-cache-date', new Date().toISOString());
      
      // Manage cache size
      await manageCacheSize(cache, CACHE_LIMITS[DYNAMIC_CACHE]);
      await cache.put(request, responseToCache);
    }
    
    return networkResponse;
    
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      return cachedResponse;
    }
    
    throw error;
  }
}

// Background Sync Event
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.MESSAGE_SEND:
      event.waitUntil(syncPendingMessages());
      break;
    case SYNC_TAGS.RATING_SUBMIT:
      event.waitUntil(syncPendingRatings());
      break;
    case SYNC_TAGS.PHOTO_UPLOAD:
      event.waitUntil(syncPendingPhotos());
      break;
    case SYNC_TAGS.SERVICE_REQUEST:
      event.waitUntil(syncPendingServiceRequests());
      break;
    default:
      console.log('[SW] Unknown sync tag:', event.tag);
  }
});

// Push Event - Handle push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'ServiMap',
    body: 'Tienes una nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    requireInteraction: false,
    actions: []
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (error) {
      console.error('[SW] Error parsing notification data:', error);
      notificationData.body = event.data.text();
    }
  }
  
  // Add default actions if none provided
  if (!notificationData.actions || notificationData.actions.length === 0) {
    notificationData.actions = [
      { action: 'view', title: 'Ver', icon: '/icons/view-action.png' },
      { action: 'dismiss', title: 'Descartar', icon: '/icons/dismiss-action.png' }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  
  if (action === 'dismiss') {
    return; // Just close the notification
  }
  
  // Determine URL based on notification type and action
  let targetUrl = '/';
  
  if (notificationData.type) {
    switch (notificationData.type) {
      case 'service_request':
        targetUrl = action === 'respond' ? `/services/${notificationData.serviceId}/respond` : `/services/${notificationData.serviceId}`;
        break;
      case 'message':
        targetUrl = `/messages/${notificationData.chatId}`;
        break;
      case 'payment':
        targetUrl = action === 'wallet' ? '/wallet' : `/payments/${notificationData.paymentId}`;
        break;
      case 'community':
        targetUrl = `/community/${notificationData.communityId}`;
        break;
      default:
        targetUrl = notificationData.url || '/';
    }
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              action: action,
              data: notificationData,
              targetUrl: targetUrl
            });
            return client.focus();
          }
        }
        
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Message Event - Communication with main thread
self.addEventListener('message', event => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_PERFORMANCE_METRICS':
      event.ports[0].postMessage(performanceMetrics);
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;
      
    case 'QUEUE_BACKGROUND_SYNC':
      event.waitUntil(queueBackgroundSync(data.tag, data.data));
      break;
      
    case 'PRECACHE_ROUTES':
      event.waitUntil(precacheRoutes(data.routes));
      break;
      
    default:
      console.log('[SW] Unknown message type:', data.type);
  }
});

// Helper Functions

function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/static/') || 
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.woff2') ||
         url.pathname.endsWith('.woff') ||
         url.pathname === '/manifest.json';
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') ||
         url.hostname.includes('firebaseapp.com') ||
         url.hostname.includes('googleapis.com');
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return request.destination === 'image' ||
         url.pathname.includes('/images/') ||
         url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isCriticalAPI(request) {
  const criticalEndpoints = [
    '/api/user/profile',
    '/api/wallet/balance',
    '/api/services/favorites',
    '/api/messages/recent'
  ];
  
  const url = new URL(request.url);
  return criticalEndpoints.some(endpoint => url.pathname.includes(endpoint));
}

function createOfflineImageResponse() {
  // Create a simple SVG placeholder for offline images
  const svg = `
    <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af" font-family="Arial">
        Imagen no disponible offline
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

async function manageCacheSize(cache, maxSizeMB) {
  const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
  
  try {
    const keys = await cache.keys();
    let totalSize = 0;
    const items = [];
    
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const size = await getResponseSize(response);
        const cacheDate = new Date(response.headers.get('sw-cache-date') || 0);
        
        items.push({ key, size, cacheDate });
        totalSize += size;
      }
    }
    
    if (totalSize > maxSize) {
      // Sort by cache date (oldest first)
      items.sort((a, b) => a.cacheDate - b.cacheDate);
      
      // Delete oldest items until under limit
      let deletedSize = 0;
      for (const item of items) {
        if (totalSize - deletedSize <= maxSize) break;
        
        await cache.delete(item.key);
        deletedSize += item.size;
        console.log('[SW] Deleted cached item:', item.key.url);
      }
    }
  } catch (error) {
    console.error('[SW] Error managing cache size:', error);
  }
}

async function getResponseSize(response) {
  try {
    const blob = await response.clone().blob();
    return blob.size;
  } catch (error) {
    return 0;
  }
}

async function syncPendingMessages() {
  try {
    console.log('[SW] Syncing pending messages...');
    
    // Get pending messages from IndexedDB
    const pendingMessages = await getPendingData('messages');
    
    for (const message of pendingMessages) {
      try {
        const response = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.data)
        });
        
        if (response.ok) {
          await removePendingData('messages', message.id);
          console.log('[SW] Message synced successfully:', message.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync message:', message.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error syncing messages:', error);
  }
}

async function syncPendingRatings() {
  try {
    console.log('[SW] Syncing pending ratings...');
    
    const pendingRatings = await getPendingData('ratings');
    
    for (const rating of pendingRatings) {
      try {
        const response = await fetch('/api/ratings/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rating.data)
        });
        
        if (response.ok) {
          await removePendingData('ratings', rating.id);
          console.log('[SW] Rating synced successfully:', rating.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync rating:', rating.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error syncing ratings:', error);
  }
}

async function syncPendingPhotos() {
  try {
    console.log('[SW] Syncing pending photos...');
    
    const pendingPhotos = await getPendingData('photos');
    
    for (const photo of pendingPhotos) {
      try {
        const formData = new FormData();
        formData.append('photo', photo.data.blob);
        formData.append('metadata', JSON.stringify(photo.data.metadata));
        
        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          await removePendingData('photos', photo.id);
          console.log('[SW] Photo synced successfully:', photo.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync photo:', photo.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error syncing photos:', error);
  }
}

async function syncPendingServiceRequests() {
  try {
    console.log('[SW] Syncing pending service requests...');
    
    const pendingRequests = await getPendingData('serviceRequests');
    
    for (const request of pendingRequests) {
      try {
        const response = await fetch('/api/services/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.data)
        });
        
        if (response.ok) {
          await removePendingData('serviceRequests', request.id);
          console.log('[SW] Service request synced successfully:', request.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync service request:', request.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error syncing service requests:', error);
  }
}

async function queueBackgroundSync(tag, data) {
  try {
    await storePendingData(tag, data);
    await self.registration.sync.register(tag);
    console.log('[SW] Background sync queued:', tag);
  } catch (error) {
    console.error('[SW] Failed to queue background sync:', error);
  }
}

async function precacheRoutes(routes) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    
    for (const route of routes) {
      try {
        const response = await fetch(route);
        if (response.ok) {
          await cache.put(route, response);
          console.log('[SW] Precached route:', route);
        }
      } catch (error) {
        console.error('[SW] Failed to precache route:', route, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error precaching routes:', error);
  }
}

async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames
      .filter(name => name.startsWith('servimap-'))
      .map(name => caches.delete(name));
    
    await Promise.all(deletePromises);
    console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Error clearing caches:', error);
  }
}

// IndexedDB helpers for background sync
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ServiMapSW', 1);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains('pendingData')) {
        const store = db.createObjectStore('pendingData', { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storePendingData(type, data) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['pendingData'], 'readwrite');
    const store = transaction.objectStore('pendingData');
    
    await new Promise((resolve, reject) => {
      const request = store.add({
        type: type,
        data: data,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Error storing pending data:', error);
  }
}

async function getPendingData(type) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['pendingData'], 'readonly');
    const store = transaction.objectStore('pendingData');
    const index = store.index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(type);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Error getting pending data:', error);
    return [];
  }
}

async function removePendingData(type, id) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['pendingData'], 'readwrite');
    const store = transaction.objectStore('pendingData');
    
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Error removing pending data:', error);
  }
}

// Performance monitoring
setInterval(() => {
  console.log('[SW] Performance metrics:', performanceMetrics);
  
  // Reset metrics periodically
  if (performanceMetrics.networkRequests > 1000) {
    performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      networkRequests: 0,
      offlineRequests: 0
    };
  }
}, 300000); // 5 minutes

console.log('[SW] Service Worker loaded successfully - Version ' + CACHE_VERSION);