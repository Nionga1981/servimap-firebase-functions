import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, Clock, Sync } from 'lucide-react';

const OfflineManager = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState([]);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [offlineData, setOfflineData] = useState({
    messages: [],
    services: [],
    favorites: [],
    userProfile: null
  });

  useEffect(() => {
    initializeOfflineManager();
    setupNetworkListeners();
    loadOfflineData();
    setupServiceWorkerSync();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initializeOfflineManager = () => {
    // Initialize IndexedDB for offline storage
    if ('indexedDB' in window) {
      openOfflineDB().then(db => {
        console.log('[Offline] IndexedDB initialized');
      }).catch(error => {
        console.error('[Offline] IndexedDB initialization failed:', error);
      });
    }

    // Load pending sync items from localStorage
    const stored = localStorage.getItem('servimap_pending_sync');
    if (stored) {
      try {
        setPendingSync(JSON.parse(stored));
      } catch (error) {
        console.error('[Offline] Error loading pending sync:', error);
      }
    }

    // Load last sync time
    const lastSync = localStorage.getItem('servimap_last_sync');
    if (lastSync) {
      setLastSyncTime(new Date(parseInt(lastSync)));
    }
  };

  const setupNetworkListeners = () => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check connection quality
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', handleConnectionChange);
    }
  };

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    console.log('[Offline] Connection restored');
    
    // Show connection restored notification
    showNetworkNotification('Conexión restaurada', 'success');
    
    // Start background sync
    setTimeout(() => {
      syncPendingData();
    }, 1000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    console.log('[Offline] Connection lost');
    
    // Show offline notification
    showNetworkNotification('Sin conexión - Modo offline activado', 'warning');
    
    // Preload critical data
    preloadCriticalData();
  }, []);

  const handleConnectionChange = () => {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      console.log('[Offline] Connection changed:', {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      });
    }
  };

  const openOfflineDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ServiMapOffline', 2);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('chatId', 'chatId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('services')) {
          const servicesStore = db.createObjectStore('services', { keyPath: 'id' });
          servicesStore.createIndex('category', 'category', { unique: false });
          servicesStore.createIndex('location', 'location', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('userProfile')) {
          db.createObjectStore('userProfile', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('pendingActions')) {
          const pendingStore = db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
          pendingStore.createIndex('type', 'type', { unique: false });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const preloadCriticalData = async () => {
    try {
      const db = await openOfflineDB();
      
      // Load recent messages
      const messagesTransaction = db.transaction(['messages'], 'readonly');
      const messagesStore = messagesTransaction.objectStore('messages');
      const messages = await getAllFromStore(messagesStore);
      
      // Load user services
      const servicesTransaction = db.transaction(['services'], 'readonly');
      const servicesStore = servicesTransaction.objectStore('services');
      const services = await getAllFromStore(servicesStore);
      
      // Load user profile
      const profileTransaction = db.transaction(['userProfile'], 'readonly');
      const profileStore = profileTransaction.objectStore('userProfile');
      const profile = await getFromStore(profileStore, 'current');
      
      setOfflineData({
        messages: messages || [],
        services: services || [],
        favorites: JSON.parse(localStorage.getItem('servimap_favorites') || '[]'),
        userProfile: profile
      });
      
      console.log('[Offline] Critical data preloaded');
    } catch (error) {
      console.error('[Offline] Error preloading data:', error);
    }
  };

  const loadOfflineData = async () => {
    if (!isOnline) {
      await preloadCriticalData();
    }
  };

  const setupServiceWorkerSync = () => {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
      });
    }
  };

  const handleSWMessage = (event) => {
    const { data } = event;
    
    switch (data.type) {
      case 'SYNC_COMPLETE':
        handleSyncComplete(data.tag);
        break;
      case 'SYNC_FAILED':
        handleSyncFailed(data.tag, data.error);
        break;
      case 'CACHE_UPDATED':
        console.log('[Offline] Cache updated:', data.cache);
        break;
      default:
        console.log('[Offline] Unknown SW message:', data);
    }
  };

  const queueAction = async (actionType, data) => {
    const action = {
      id: Date.now() + Math.random(),
      type: actionType,
      data: data,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    };

    // Add to pending sync queue
    const newQueue = [...pendingSync, action];
    setPendingSync(newQueue);
    localStorage.setItem('servimap_pending_sync', JSON.stringify(newQueue));

    // Store in IndexedDB
    try {
      const db = await openOfflineDB();
      const transaction = db.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      await addToStore(store, action);
      
      console.log('[Offline] Action queued:', actionType);
    } catch (error) {
      console.error('[Offline] Error queueing action:', error);
    }

    // Try immediate sync if online
    if (isOnline) {
      setTimeout(() => syncPendingData(), 500);
    } else {
      // Register background sync
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          if ('sync' in registration) {
            registration.sync.register(actionType);
          }
        });
      }
    }

    return action.id;
  };

  const syncPendingData = async () => {
    if (syncInProgress || !isOnline || pendingSync.length === 0) {
      return;
    }

    setSyncInProgress(true);
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    console.log('[Offline] Starting sync of', pendingSync.length, 'items');

    for (const action of pendingSync) {
      try {
        const success = await syncAction(action);
        
        if (success) {
          successCount++;
          // Remove from queue
          const updatedQueue = pendingSync.filter(item => item.id !== action.id);
          setPendingSync(updatedQueue);
          localStorage.setItem('servimap_pending_sync', JSON.stringify(updatedQueue));
          
          // Remove from IndexedDB
          const db = await openOfflineDB();
          const transaction = db.transaction(['pendingActions'], 'readwrite');
          const store = transaction.objectStore('pendingActions');
          await deleteFromStore(store, action.id);
        } else {
          failureCount++;
          action.retries++;
          
          // Remove if too many retries
          if (action.retries >= 3) {
            const updatedQueue = pendingSync.filter(item => item.id !== action.id);
            setPendingSync(updatedQueue);
            localStorage.setItem('servimap_pending_sync', JSON.stringify(updatedQueue));
          }
        }
      } catch (error) {
        console.error('[Offline] Sync error for action:', action.type, error);
        failureCount++;
      }
    }

    setSyncInProgress(false);
    setLastSyncTime(new Date());
    localStorage.setItem('servimap_last_sync', Date.now().toString());

    console.log(`[Offline] Sync completed: ${successCount} success, ${failureCount} failures`);
    
    if (successCount > 0) {
      showSyncNotification(`${successCount} elementos sincronizados`, 'success');
    }
  };

  const syncAction = async (action) => {
    try {
      switch (action.type) {
        case 'message-send':
          return await syncMessage(action.data);
        case 'rating-submit':
          return await syncRating(action.data);
        case 'service-request':
          return await syncServiceRequest(action.data);
        case 'photo-upload':
          return await syncPhotoUpload(action.data);
        case 'profile-update':
          return await syncProfileUpdate(action.data);
        default:
          console.warn('[Offline] Unknown action type:', action.type);
          return false;
      }
    } catch (error) {
      console.error('[Offline] Sync action failed:', action.type, error);
      return false;
    }
  };

  const syncMessage = async (messageData) => {
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });
    
    return response.ok;
  };

  const syncRating = async (ratingData) => {
    const response = await fetch('/api/ratings/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ratingData)
    });
    
    return response.ok;
  };

  const syncServiceRequest = async (requestData) => {
    const response = await fetch('/api/services/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });
    
    return response.ok;
  };

  const syncPhotoUpload = async (photoData) => {
    const formData = new FormData();
    formData.append('photo', photoData.blob);
    formData.append('metadata', JSON.stringify(photoData.metadata));
    
    const response = await fetch('/api/photos/upload', {
      method: 'POST',
      body: formData
    });
    
    return response.ok;
  };

  const syncProfileUpdate = async (profileData) => {
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });
    
    return response.ok;
  };

  const handleSyncComplete = (tag) => {
    console.log('[Offline] Background sync completed:', tag);
    syncPendingData();
  };

  const handleSyncFailed = (tag, error) => {
    console.error('[Offline] Background sync failed:', tag, error);
  };

  const showNetworkNotification = (message, type) => {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-orange-500';
    const icon = type === 'success' ? 
      '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' :
      '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';

    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2 max-w-sm`;
    notification.innerHTML = `
      ${icon}
      <span class="text-sm">${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  const showSyncNotification = (message, type) => {
    showNetworkNotification(message, type);
  };

  // IndexedDB helper functions
  const getAllFromStore = (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const getFromStore = (store, key) => {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const addToStore = (store, data) => {
    return new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const deleteFromStore = (store, key) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  // Public API for other components
  const OfflineManagerAPI = {
    isOnline,
    queueAction,
    syncPendingData,
    pendingCount: pendingSync.length,
    offlineData,
    lastSyncTime
  };

  // Make API available globally
  useEffect(() => {
    window.OfflineManager = OfflineManagerAPI;
  }, [OfflineManagerAPI]);

  // Render network status indicator
  const getConnectionStatus = () => {
    if (isOnline) {
      if ('connection' in navigator && navigator.connection.effectiveType) {
        const speed = navigator.connection.effectiveType;
        const speedMap = {
          'slow-2g': 'Conexión muy lenta',
          '2g': 'Conexión lenta',
          '3g': 'Conexión media',
          '4g': 'Conexión rápida'
        };
        return speedMap[speed] || 'Conectado';
      }
      return 'Conectado';
    }
    return 'Sin conexión';
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40">
      {/* Network status bar */}
      <div className={`transition-all duration-300 ${!isOnline ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="bg-orange-500 text-white px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4" />
            <span>Modo offline - Tus acciones se sincronizarán cuando regreses</span>
          </div>
          {pendingSync.length > 0 && (
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{pendingSync.length} pendientes</span>
            </div>
          )}
        </div>
      </div>

      {/* Sync indicator */}
      {syncInProgress && (
        <div className="bg-blue-500 text-white px-4 py-2 text-sm flex items-center space-x-2">
          <Sync className="w-4 h-4 animate-spin" />
          <span>Sincronizando datos...</span>
        </div>
      )}

      {/* Connection restored notification */}
      {isOnline && pendingSync.length === 0 && lastSyncTime && (
        <div className="bg-green-500 text-white px-4 py-1 text-xs flex items-center justify-center opacity-75">
          <CheckCircle className="w-3 h-3 mr-1" />
          <span>Sincronizado - {getConnectionStatus()}</span>
        </div>
      )}
    </div>
  );
};

export default OfflineManager;
export { OfflineManager };