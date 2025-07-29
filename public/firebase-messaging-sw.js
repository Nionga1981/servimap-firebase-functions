// Import the Firebase scripts needed for messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
const firebaseConfig = {
  apiKey: "your-api-key", // This will be replaced with actual values
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Nueva notificación';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: payload.data?.type || 'servimap',
    data: payload.data || {},
    requireInteraction: payload.data?.priority === 'high',
    actions: getNotificationActions(payload.data?.type),
    timestamp: Date.now(),
    renotify: true,
    vibrate: [200, 100, 200]
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data;
  const action = event.action;

  // Handle action buttons
  if (action) {
    handleNotificationAction(action, notificationData);
    return;
  }

  // Default click behavior - focus or open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Send message to client about notification click
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              notification: {
                data: notificationData
              }
            });
            return client.focus();
          }
        }

        // Open new window if none exists
        if (clients.openWindow) {
          const targetUrl = getTargetUrl(notificationData);
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle notification action buttons
function handleNotificationAction(action, data) {
  console.log('[firebase-messaging-sw.js] Notification action:', action, data);

  const actions = {
    'view': () => {
      const url = getTargetUrl(data);
      return clients.openWindow(url);
    },
    'reply': () => {
      return clients.openWindow(`/chat/${data.chatId}?reply=true`);
    },
    'dismiss': () => {
      // Just close the notification
      return Promise.resolve();
    },
    'accept': () => {
      return clients.openWindow(`/service-request/${data.requestId}?action=accept`);
    },
    'decline': () => {
      return clients.openWindow(`/service-request/${data.requestId}?action=decline`);
    }
  };

  const actionHandler = actions[action];
  if (actionHandler) {
    return actionHandler();
  }
}

// Get notification actions based on type
function getNotificationActions(type) {
  const actionsByType = {
    'service_request': [
      { action: 'view', title: '👁️ Ver solicitud', icon: '/icons/view.png' },
      { action: 'dismiss', title: '❌ Descartar', icon: '/icons/dismiss.png' }
    ],
    'message': [
      { action: 'reply', title: '💬 Responder', icon: '/icons/reply.png' },
      { action: 'view', title: '👁️ Ver chat', icon: '/icons/chat.png' }
    ],
    'emergency': [
      { action: 'accept', title: '✅ Aceptar', icon: '/icons/accept.png' },
      { action: 'decline', title: '❌ Declinar', icon: '/icons/decline.png' }
    ],
    'payment': [
      { action: 'view', title: '👁️ Ver pago', icon: '/icons/view.png' }
    ],
    'community': [
      { action: 'view', title: '👁️ Ver comunidad', icon: '/icons/community.png' }
    ]
  };

  return actionsByType[type] || [
    { action: 'view', title: '👁️ Ver', icon: '/icons/view.png' }
  ];
}

// Get target URL based on notification data
function getTargetUrl(data) {
  if (data?.type === 'service_request' && data?.requestId) {
    return `/service-request/${data.requestId}`;
  } else if (data?.type === 'message' && data?.chatId) {
    return `/chat/${data.chatId}`;
  } else if (data?.type === 'payment' && data?.paymentId) {
    return `/payment/${data.paymentId}`;
  } else if (data?.type === 'emergency' && data?.emergencyId) {
    return `/emergency/${data.emergencyId}`;
  } else if (data?.type === 'community' && data?.communityId) {
    return `/community/${data.communityId}`;
  } else if (data?.url) {
    return data.url;
  } else {
    return '/dashboard';
  }
}

// Handle push events (for additional push data)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[firebase-messaging-sw.js] Push data:', payload);
      
      // This will be handled by onBackgroundMessage above
    } catch (error) {
      console.error('[firebase-messaging-sw.js] Error parsing push data:', error);
    }
  }
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installed');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activated');
  event.waitUntil(self.clients.claim());
});