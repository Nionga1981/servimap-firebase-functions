
// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
// Import other Firebase services as needed, e.g., getAuth, getFirestore
// For FCM, you would also import getMessaging, getToken, onMessage from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export { app };

// --- Conceptual FCM Client-Side Service ---
// In a real app, you would use firebase/messaging
// const messaging = getMessaging(app);

export const requestNotificationPermission = async (): Promise<string | null> => {
  console.log('[FCM Service] Requesting notification permission (simulated)...');
  // Real implementation:
  // try {
  //   const permission = await Notification.requestPermission();
  //   if (permission === 'granted') {
  //     console.log('[FCM Service] Notification permission granted.');
  //     const currentToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
  //     if (currentToken) {
  //       console.log('[FCM Service] FCM Token:', currentToken);
  //       // Send this token to your server to store it against the user
  //       // e.g., await saveTokenToServer(currentToken);
  //       return currentToken;
  //     } else {
  //       console.log('[FCM Service] No registration token available. Request permission to generate one.');
  //       return null;
  //     }
  //   } else {
  //     console.log('[FCM Service] Unable to get permission to notify.');
  //     return null;
  //   }
  // } catch (error) {
  //   console.error('[FCM Service] An error occurred while retrieving token. ', error);
  //   return null;
  // }

  // Simulation:
  const mockPermission = window.confirm("ServiMap desea enviarle notificaciones. ¿Permitir? (Simulado)");
  if (mockPermission) {
    const mockToken = `simulated-fcm-token-${Date.now()}`;
    console.log(`[FCM Service] Permiso concedido (simulado). Token: ${mockToken}`);
    // Here you would send the token to your server
    return mockToken;
  } else {
    console.log('[FCM Service] Permiso denegado (simulado).');
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  console.log('[FCM Service] Setting up foreground message handler (simulated).');
  // Real implementation:
  // onMessage(messaging, (payload) => {
  //   console.log('[FCM Service] Message received in foreground. ', payload);
  //   callback(payload);
  //   // Customize notification handling here (e.g., show a custom toast)
  // });

  // Simulation (e.g., you could use a global event bus or a simple timeout for demo)
  // setTimeout(() => {
  //   callback({
  //     notification: { title: "Notificación Simulada", body: "Este es un mensaje de prueba en primer plano." },
  //     data: { key: "value" }
  //   });
  // }, 15000); // Simulate a message after 15 seconds
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

// Placeholder for saving token to server
// export const saveTokenToServer = async (token: string, userId: string) => {
//   console.log(`[FCM Service] Simulating saving token ${token} for user ${userId} to server.`);
//   // In a real app, you would make a Firestore call here:
//   // const userRef = doc(db, "users", userId);
//   // await updateDoc(userRef, {
//   //  fcmTokens: arrayUnion(token)
//   // });
//   return Promise.resolve();
// }
