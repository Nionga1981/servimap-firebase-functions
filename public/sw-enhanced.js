// Enhanced Service Worker for ServiMap PWA
// Versión optimizada con estrategias específicas para marketplace de servicios

const CACHE_NAME = 'servimap-v2.0.0';
const STATIC_CACHE = 'servimap-static-v2.0.0';
const DYNAMIC_CACHE = 'servimap-dynamic-v2.0.0';
const IMAGE_CACHE = 'servimap-images-v2.0.0';

// Recursos críticos para cachear inmediatamente
const CRITICAL_RESOURCES = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/css/styles.css',
  '/js/app.js',
  '/offline.html'
];

// Recursos estáticos que cambian raramente
const STATIC_RESOURCES = [
  '/components/',
  '/lib/',
  '/public/icons/',
  '/public/images/categories/',
  '/_next/static/'
];

// URLs de API que requieren estrategia especial
const API_ENDPOINTS = [
  '/api/providers',
  '/api/services',
  '/api/search',
  '/api/location'
];

// URLs que siempre deben ser fresh (nunca cachear)
const NEVER_CACHE = [
  '/api/auth',
  '/api/payment',
  '/api/chat',
  '/api/notifications'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Installing ServiMap Service Worker v2.0.0');
  
  event.waitUntil(
    Promise.all([
      // Cache crítico
      caches.open(CACHE_NAME).then(cache => {
        console.log('[SW] Caching critical resources');
        return cache.addAll(CRITICAL_RESOURCES);
      }),
      
      // Cache estático
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Setting up static cache');
        return cache.addAll([]);
      }),
      
      // Skip waiting para activar inmediatamente
      self.skipWaiting()
    ])
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activating ServiMap Service Worker v2.0.0');
  
  event.waitUntil(
    Promise.all([
      // Limpiar caches antiguos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE &&
                cacheName !== IMAGE_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Tomar control de todos los clientes
      self.clients.claim()
    ])
  );
});

// Interceptar peticiones de red
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requests no HTTP/HTTPS
  if (!request.url.startsWith('http')) return;
  
  // Nunca cachear ciertas URLs
  if (NEVER_CACHE.some(path => url.pathname.startsWith(path))) {
    return event.respondWith(
      fetch(request).catch(() => {
        // Fallback para offline
        return new Response(
          JSON.stringify({ error: 'Offline', message: 'Esta función requiere conexión' }),
          { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
  }
  
  // Estrategia por tipo de contenido
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticResource(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Manejo de imágenes con cache first
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Retornar imagen cacheada
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Solo cachear respuestas exitosas
    if (networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Image fetch failed:', error);
    
    // Retornar imagen placeholder offline
    return new Response(
      await getPlaceholderImage(),
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// Manejo de APIs con network first + fallback
async function handleAPIRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    // Intentar red primero
    const networkResponse = await fetch(request, {
      timeout: 5000 // 5 segundos timeout
    });
    
    // Cachear respuestas exitosas de APIs de lectura
    if (networkResponse.status === 200 && request.method === 'GET') {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] API fetch failed, trying cache:', error);
    
    // Fallback a cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Respuesta offline específica por endpoint
    return generateOfflineAPIResponse(request);
  }
}

// Manejo de recursos estáticos con stale while revalidate
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Retornar cache inmediatamente si existe
  if (cachedResponse) {
    // Actualizar en background
    fetch(request).then(response => {
      if (response.status === 200) {
        cache.put(request, response);
      }
    }).catch(() => {
      // Ignorar errores de actualización en background
    });
    
    return cachedResponse;
  }
  
  // No hay cache, buscar en red
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Static resource fetch failed:', error);
    throw error;
  }
}

// Manejo de navegación con cache first + network fallback
async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Intentar red primero para navegación
    const networkResponse = await fetch(request);
    
    // Cachear páginas exitosas
    if (networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation fetch failed, trying cache:', error);
    
    // Fallback a cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Última opción: página offline
    const offlinePage = await cache.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
    
    // Generar página offline básica
    return new Response(generateOfflinePage(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Utilidades
function isStaticResource(pathname) {
  return STATIC_RESOURCES.some(path => pathname.startsWith(path)) ||
         pathname.includes('/_next/') ||
         pathname.includes('/static/') ||
         pathname.includes('/assets/');
}

function generateOfflineAPIResponse(request) {
  const url = new URL(request.url);
  
  // Respuestas específicas por endpoint
  if (url.pathname.includes('/providers')) {
    return new Response(JSON.stringify({
      providers: [],
      message: 'Sin conexión. Mostrando prestadores cacheados.',
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname.includes('/services')) {
    return new Response(JSON.stringify({
      services: [],
      message: 'Sin conexión. Algunas funciones no están disponibles.',
      offline: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Respuesta genérica
  return new Response(JSON.stringify({
    error: 'offline',
    message: 'Sin conexión a internet'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getPlaceholderImage() {
  return `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f3f4f6"/>
    <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#6b7280" 
          text-anchor="middle" dy=".3em">Sin conexión</text>
  </svg>`;
}

function generateOfflinePage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sin conexión - ServiMap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .offline-container {
            text-align: center;
            max-width: 400px;
            background: white;
            padding: 40px 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .offline-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 20px;
            background: #209ded;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
        }
        h1 {
            color: #1e293b;
            margin-bottom: 12px;
            font-size: 24px;
            font-weight: 600;
        }
        p {
            color: #64748b;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        .retry-btn {
            background: #209ded;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        .retry-btn:hover {
            background: #1e88e5;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📶</div>
        <h1>Sin conexión</h1>
        <p>No hay conexión a internet. Revisa tu conexión y vuelve a intentarlo.</p>
        <button class="retry-btn" onclick="window.location.reload()">
            Reintentar
        </button>
    </div>
</body>
</html>`;
}

// Background Sync para acciones offline
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'service-request') {
    event.waitUntil(syncServiceRequests());
  }
  
  if (event.tag === 'chat-messages') {
    event.waitUntil(syncChatMessages());
  }
});

async function syncServiceRequests() {
  // Sincronizar solicitudes de servicio pendientes
  try {
    const requests = await getOfflineServiceRequests();
    
    for (const request of requests) {
      await fetch('/api/services/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
    }
    
    await clearOfflineServiceRequests();
    console.log('[SW] Service requests synced successfully');
  } catch (error) {
    console.error('[SW] Failed to sync service requests:', error);
  }
}

async function syncChatMessages() {
  // Sincronizar mensajes de chat pendientes
  try {
    const messages = await getOfflineChatMessages();
    
    for (const message of messages) {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    }
    
    await clearOfflineChatMessages();
    console.log('[SW] Chat messages synced successfully');
  } catch (error) {
    console.error('[SW] Failed to sync chat messages:', error);
  }
}

// Push Notifications
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    image: data.image,
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.urgent || false,
    silent: false,
    tag: data.tag || 'default',
    timestamp: Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  // Determinar URL basada en tipo de notificación
  if (data?.type === 'service_request') {
    url = `/services/${data.serviceId}`;
  } else if (data?.type === 'chat_message') {
    url = `/chat/${data.chatId}`;
  } else if (data?.type === 'quotation') {
    url = `/quotations/${data.quotationId}`;
  }
  
  event.waitUntil(
    clients.openWindow(url)
  );
});

// Utilidades para IndexedDB (storage offline)
async function getOfflineServiceRequests() {
  // Implementación con IndexedDB
  return [];
}

async function clearOfflineServiceRequests() {
  // Implementación con IndexedDB
}

async function getOfflineChatMessages() {
  // Implementación con IndexedDB
  return [];
}

async function clearOfflineChatMessages() {
  // Implementación con IndexedDB
}

console.log('[SW] ServiMap Enhanced Service Worker loaded');