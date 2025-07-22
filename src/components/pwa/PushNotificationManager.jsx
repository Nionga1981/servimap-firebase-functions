import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Settings, X, Check, AlertCircle } from 'lucide-react';

const PushNotificationManager = () => {
  const [permission, setPermission] = useState(Notification.permission);
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    messages: true,
    serviceRequests: true,
    payments: true,
    promotions: false,
    community: true,
    reminders: true
  });
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    checkPushSupport();
    loadPreferences();
    initializePushNotifications();
  }, []);

  const checkPushSupport = () => {
    const supported = 'serviceWorker' in navigator && 
                     'PushManager' in window && 
                     'Notification' in window;
    setIsSupported(supported);
    
    if (!supported) {
      console.warn('[Push] Push notifications not supported');
    }
  };

  const loadPreferences = () => {
    const stored = localStorage.getItem('servimap_notification_preferences');
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch (error) {
        console.error('[Push] Error loading preferences:', error);
      }
    }
  };

  const savePreferences = (newPreferences) => {
    setPreferences(newPreferences);
    localStorage.setItem('servimap_notification_preferences', JSON.stringify(newPreferences));
    
    // Update server preferences
    updateServerPreferences(newPreferences);
  };

  const initializePushNotifications = async () => {
    if (!isSupported || permission === 'denied') {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        setSubscription(existingSubscription);
        console.log('[Push] Existing subscription found');
      }
    } catch (error) {
      console.error('[Push] Error initializing:', error);
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      showNotificationError('Las notificaciones push no están soportadas en este navegador');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        await subscribeToPush();
        showNotificationSuccess('¡Notificaciones activadas exitosamente!');
        return true;
      } else if (result === 'denied') {
        showNotificationError('Notificaciones denegadas. Puedes habilitarlas en la configuración del navegador.');
        return false;
      }
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      showNotificationError('Error al solicitar permisos de notificación');
      return false;
    }
  };

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getVAPIDPublicKey())
      });

      setSubscription(subscription);
      
      // Send subscription to server
      await sendSubscriptionToServer(subscription);
      
      console.log('[Push] Successfully subscribed');
      return subscription;
    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      throw error;
    }
  };

  const unsubscribeFromPush = async () => {
    if (!subscription) {
      return;
    }

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      
      // Remove subscription from server
      await removeSubscriptionFromServer(subscription);
      
      showNotificationSuccess('Notificaciones desactivadas');
      console.log('[Push] Successfully unsubscribed');
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      showNotificationError('Error al desactivar notificaciones');
    }
  };

  const sendSubscriptionToServer = async (subscription) => {
    try {
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription,
          preferences: preferences,
          device: getDeviceInfo()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('[Push] Subscription sent to server');
    } catch (error) {
      console.error('[Push] Error sending subscription:', error);
    }
  };

  const removeSubscriptionFromServer = async (subscription) => {
    try {
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription
        })
      });

      if (!response.ok) {
        throw new Error('Failed to remove subscription from server');
      }

      console.log('[Push] Subscription removed from server');
    } catch (error) {
      console.error('[Push] Error removing subscription:', error);
    }
  };

  const updateServerPreferences = async (newPreferences) => {
    if (!subscription) {
      return;
    }

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription,
          preferences: newPreferences
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      console.log('[Push] Preferences updated on server');
    } catch (error) {
      console.error('[Push] Error updating preferences:', error);
    }
  };

  const sendTestNotification = async () => {
    if (!subscription) {
      showNotificationError('Primero debes activar las notificaciones');
      return;
    }

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription
        })
      });

      if (response.ok) {
        showNotificationSuccess('Notificación de prueba enviada');
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error) {
      console.error('[Push] Error sending test notification:', error);
      showNotificationError('Error al enviar notificación de prueba');
    }
  };

  const getVAPIDPublicKey = () => {
    // This should be your actual VAPID public key
    return process.env.REACT_APP_VAPID_PUBLIC_KEY || 
           'BEl62iUYgUivxIkv69yViEuiBIa40HI8YqiIJnbvYnhDWgC-Mf4Eu4M5jIFgF9u8Rw3jT_hRs8cJ3Q6V5N2f2B8';
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const getDeviceInfo = () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: screen.width,
        height: screen.height
      }
    };
  };

  const showNotificationSuccess = (message) => {
    showToast(message, 'success');
  };

  const showNotificationError = (message) => {
    showToast(message, 'error');
  };

  const showToast = (message, type) => {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const icon = type === 'success' ? 
      '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' :
      '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';

    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2 max-w-sm transform transition-all duration-300`;
    toast.innerHTML = `
      <div class="flex items-center space-x-2">
        ${icon}
        <span class="text-sm">${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  const handleToggleNotifications = async () => {
    if (permission === 'granted' && subscription) {
      await unsubscribeFromPush();
    } else {
      await requestPermission();
    }
  };

  const handlePreferenceChange = (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    savePreferences(newPreferences);
  };

  const getNotificationStatusText = () => {
    if (!isSupported) {
      return 'No soportado';
    }
    
    switch (permission) {
      case 'granted':
        return subscription ? 'Activadas' : 'Permitidas';
      case 'denied':
        return 'Bloqueadas';
      case 'default':
        return 'No configuradas';
      default:
        return 'Desconocido';
    }
  };

  const getNotificationStatusColor = () => {
    if (!isSupported || permission === 'denied') {
      return 'text-red-500';
    }
    
    if (permission === 'granted' && subscription) {
      return 'text-green-500';
    }
    
    return 'text-yellow-500';
  };

  const NotificationSettings = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Configuración de Notificaciones
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Estado:</span>
              <span className={`text-sm font-semibold ${getNotificationStatusColor()}`}>
                {getNotificationStatusText()}
              </span>
            </div>
            
            {permission === 'denied' && (
              <div className="text-xs text-gray-600 mt-2">
                Para habilitar las notificaciones, ve a la configuración de tu navegador
                y permite las notificaciones para ServiMap.
              </div>
            )}
          </div>

          {/* Main toggle */}
          <div className="mb-6">
            <button
              onClick={handleToggleNotifications}
              disabled={!isSupported || permission === 'denied'}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                permission === 'granted' && subscription
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
              }`}
            >
              {permission === 'granted' && subscription
                ? 'Desactivar Notificaciones'
                : 'Activar Notificaciones'
              }
            </button>
          </div>

          {/* Preferences */}
          {permission === 'granted' && subscription && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                Tipos de Notificación
              </h3>
              
              {Object.entries({
                messages: 'Mensajes nuevos',
                serviceRequests: 'Solicitudes de servicio',
                payments: 'Pagos y transacciones',
                promotions: 'Promociones y ofertas',
                community: 'Actividad de la comunidad',
                reminders: 'Recordatorios'
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences[key]}
                      onChange={(e) => handlePreferenceChange(key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Test notification */}
          {permission === 'granted' && subscription && (
            <div className="mt-6 pt-4 border-t">
              <button
                onClick={sendTestNotification}
                className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Enviar Notificación de Prueba
              </button>
            </div>
          )}

          {/* Debug info (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 pt-4 border-t">
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Debug Info</summary>
                <pre className="mt-2 overflow-auto">
                  {JSON.stringify({
                    permission,
                    isSupported,
                    hasSubscription: !!subscription,
                    preferences
                  }, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Main component render - notification status indicator
  return (
    <>
      {/* Floating notification button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowSettings(true)}
          className={`p-3 rounded-full shadow-lg transition-all hover:scale-105 ${
            permission === 'granted' && subscription
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
          title={`Notificaciones: ${getNotificationStatusText()}`}
        >
          {permission === 'granted' && subscription ? (
            <Bell className="w-6 h-6" />
          ) : (
            <BellOff className="w-6 h-6" />
          )}
          
          {/* Notification indicator */}
          {permission === 'granted' && subscription && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
          )}
        </button>
      </div>

      {/* Settings modal */}
      {showSettings && <NotificationSettings />}

      {/* Permission prompt for first-time users */}
      {permission === 'default' && !localStorage.getItem('servimap_notification_prompt_shown') && (
        <div className="fixed top-4 left-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50 mx-auto max-w-md">
          <div className="flex items-start space-x-3">
            <Bell className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">¿Activar notificaciones?</h3>
              <p className="text-sm text-blue-100 mb-3">
                Recibe notificaciones de mensajes, solicitudes y pagos en tiempo real.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={async () => {
                    localStorage.setItem('servimap_notification_prompt_shown', 'true');
                    await requestPermission();
                  }}
                  className="px-3 py-1 bg-white text-blue-500 text-sm font-medium rounded hover:bg-blue-50"
                >
                  Activar
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('servimap_notification_prompt_shown', 'true');
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                >
                  Después
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PushNotificationManager;