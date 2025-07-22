
// src/lib/firebase.ts
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getMessaging, Messaging, getToken, onMessage, isSupported } from 'firebase/messaging';
// For FCM, you would also import getMessaging, getToken, onMessage from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firebase services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app);
export const storage: FirebaseStorage = getStorage(app);

// Initialize messaging only if supported (browser environment)
let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

export { app, messaging };

// --- Conceptual FCM Client-Side Service ---
// In a real app, you would use firebase/messaging
// const messaging = getMessaging(app);

export const requestNotificationPermission = async (): Promise<string | null> => {
  console.log('[FCM Service] Requesting notification permission...');
  
  // Check if we're in a browser environment and messaging is supported
  if (typeof window === 'undefined' || !messaging) {
    console.log('[FCM Service] Not in browser environment or messaging not supported');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[FCM Service] Notification permission granted.');
      
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn('[FCM Service] VAPID key not configured');
        return null;
      }

      const currentToken = await getToken(messaging, { vapidKey });
      if (currentToken) {
        console.log('[FCM Service] FCM Token obtained:', currentToken);
        
        // Send token to server
        await saveTokenToServer(currentToken);
        return currentToken;
      } else {
        console.log('[FCM Service] No registration token available. Request permission to generate one.');
        return null;
      }
    } else {
      console.log('[FCM Service] Unable to get permission to notify.');
      return null;
    }
  } catch (error) {
    console.error('[FCM Service] An error occurred while retrieving token:', error);
    
    // Fallback to simulation mode in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[FCM Service] Falling back to simulation mode for development');
      const mockPermission = window.confirm("ServiMap desea enviarle notificaciones. ¿Permitir? (Modo desarrollo)");
      if (mockPermission) {
        const mockToken = `dev-fcm-token-${Date.now()}`;
        console.log(`[FCM Service] Mock token generated: ${mockToken}`);
        return mockToken;
      }
    }
    
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  console.log('[FCM Service] Setting up foreground message handler...');
  
  if (!messaging) {
    console.log('[FCM Service] Messaging not available, using simulation mode');
    // Simulation for development
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        callback({
          notification: { 
            title: "Notificación Demo", 
            body: "Este es un mensaje de prueba en primer plano." 
          },
          data: { type: "demo", timestamp: Date.now().toString() }
        });
      }, 15000); // Simulate a message after 15 seconds
    }
    return;
  }

  // Real implementation
  onMessage(messaging, (payload) => {
    console.log('[FCM Service] Message received in foreground:', payload);
    callback(payload);
    
    // Show custom notification if needed
    if (payload.notification) {
      showCustomNotification(payload.notification, payload.data);
    }
  });
};

// Helper function to show custom in-app notifications
const showCustomNotification = (notification: any, data: any) => {
  // Create a custom toast notification
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50 transform translate-x-full transition-transform duration-300';
  
  toast.innerHTML = `
    <div class="flex items-start space-x-3">
      <div class="flex-shrink-0">
        <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2L3 7v11h14V7l-7-5z"/>
          </svg>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900">${notification.title}</p>
        <p class="text-sm text-gray-500">${notification.body}</p>
      </div>
      <button class="flex-shrink-0 text-gray-400 hover:text-gray-500" onclick="this.parentElement.parentElement.remove()">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 100);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 5000);
};

// You would also need a public/firebase-messaging-sw.js for background messages
// Example content for public/firebase-messaging-sw.js:
// importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js');
// importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-messaging-compat.js');
//
// const firebaseConfig = { /* ... your config ... */ };
// firebase.initializeApp(firebaseConfig);
// const messaging = firebase.messaging();
//
// messaging.onBackgroundMessage((payload) => {
//   console.log('[firebase-messaging-sw.js] Received background message ', payload);
//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: '/firebase-logo.png' // or your app icon
//   };
//   self.registration.showNotification(notificationTitle, notificationOptions);
// });

// Save FCM token to server
export const saveTokenToServer = async (token: string, userId?: string) => {
  console.log(`[FCM Service] Saving token to server: ${token}`);
  
  try {
    // Get current user if userId not provided
    if (!userId && auth.currentUser) {
      userId = auth.currentUser.uid;
    }
    
    if (!userId) {
      console.log('[FCM Service] No user ID available, storing token locally');
      localStorage.setItem('fcm_token', token);
      return;
    }

    // Save to Firestore
    const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
    const userRef = doc(db, "users", userId);
    
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
      lastTokenUpdate: new Date()
    });
    
    console.log('[FCM Service] Token successfully saved to server');
    
    // Also store locally as backup
    localStorage.setItem('fcm_token', token);
    
  } catch (error) {
    console.error('[FCM Service] Error saving token to server:', error);
    
    // Fallback: store locally
    localStorage.setItem('fcm_token', token);
  }
};

// Get stored FCM token
export const getStoredFCMToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('fcm_token');
  }
  return null;
};

// Remove FCM token (on logout)
export const removeFCMToken = async (userId?: string) => {
  const token = getStoredFCMToken();
  if (!token) return;
  
  try {
    if (!userId && auth.currentUser) {
      userId = auth.currentUser.uid;
    }
    
    if (userId) {
      const { doc, updateDoc, arrayRemove } = await import('firebase/firestore');
      const userRef = doc(db, "users", userId);
      
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(token)
      });
    }
    
    localStorage.removeItem('fcm_token');
    console.log('[FCM Service] Token removed successfully');
    
  } catch (error) {
    console.error('[FCM Service] Error removing token:', error);
  }
};
