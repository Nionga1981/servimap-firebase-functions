import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, CheckCircle, AlertCircle, X } from 'lucide-react';
import { UpdateSplashScreen } from './SplashScreens';

const AppUpdater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [showUpdateComplete, setShowUpdateComplete] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    checkForUpdates();
    setupUpdateListeners();
    
    // Check for updates every 30 minutes
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, []);

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none'
        });
        
        setRegistration(reg);
        console.log('[AppUpdater] Service Worker registered');
        
        // Check for updates on registration
        reg.addEventListener('updatefound', handleUpdateFound);
        
        // Check if there's already a waiting worker
        if (reg.waiting) {
          setUpdateReady(true);
          setUpdateAvailable(true);
          showUpdateNotification();
        }
      } catch (error) {
        console.error('[AppUpdater] Service Worker registration failed:', error);
      }
    }
  };

  const setupUpdateListeners = () => {
    // Listen for messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }
    
    // Listen for controller change (new SW activated)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }
    
    // Listen for app visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for beforeinstallprompt for update context
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  };

  const cleanup = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  };

  const handleUpdateFound = () => {
    console.log('[AppUpdater] Update found');
    const newWorker = registration.installing;
    
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New update available
        setUpdateAvailable(true);
        setUpdateReady(true);
        fetchUpdateInfo();
        showUpdateNotification();
      }
    });
  };

  const handleSWMessage = (event) => {
    const { data } = event;
    
    switch (data.type) {
      case 'UPDATE_AVAILABLE':
        setUpdateAvailable(true);
        setUpdateInfo(data.info);
        break;
      case 'UPDATE_READY':
        setUpdateReady(true);
        break;
      case 'UPDATE_ACTIVATED':
        handleUpdateActivated();
        break;
      default:
        console.log('[AppUpdater] Unknown SW message:', data);
    }
  };

  const handleControllerChange = () => {
    console.log('[AppUpdater] Controller changed, reloading...');
    window.location.reload();
  };

  const handleVisibilityChange = () => {
    if (!document.hidden && updateAvailable) {
      // Check for updates when app becomes visible
      checkForUpdates();
    }
  };

  const handleBeforeInstallPrompt = (event) => {
    // Store for potential update context
    window.deferredPrompt = event;
  };

  const checkForUpdates = async () => {
    if (!registration) return;
    
    try {
      await registration.update();
      console.log('[AppUpdater] Checked for updates');
      
      // Check version from server
      const response = await fetch('/api/version');
      if (response.ok) {
        const serverVersion = await response.json();
        const currentVersion = localStorage.getItem('servimap_version');
        
        if (serverVersion.version !== currentVersion) {
          setUpdateInfo(serverVersion);
          setUpdateAvailable(true);
        }
      }
    } catch (error) {
      console.error('[AppUpdater] Error checking for updates:', error);
    }
  };

  const fetchUpdateInfo = async () => {
    try {
      const response = await fetch('/api/version');
      if (response.ok) {
        const info = await response.json();
        setUpdateInfo({
          version: info.version || '1.0.1',
          features: info.features || [
            'Mejoras de rendimiento',
            'Correcciones de errores',
            'Nuevas funcionalidades'
          ],
          size: info.size || '2.5 MB',
          releaseDate: info.releaseDate || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[AppUpdater] Error fetching update info:', error);
      // Set default update info
      setUpdateInfo({
        version: '1.0.1',
        features: ['Actualización disponible'],
        size: 'Desconocido'
      });
    }
  };

  const showUpdateNotification = () => {
    // Don't show if user dismissed recently
    const lastDismissed = localStorage.getItem('servimap_update_dismissed');
    if (lastDismissed) {
      const timeSinceDismissed = Date.now() - parseInt(lastDismissed);
      if (timeSinceDismissed < 24 * 60 * 60 * 1000) { // 24 hours
        return;
      }
    }
    
    setShowUpdatePrompt(true);
  };

  const applyUpdate = async () => {
    if (!registration || !registration.waiting) {
      console.error('[AppUpdater] No waiting worker to activate');
      return;
    }
    
    setUpdateInProgress(true);
    
    try {
      // Tell waiting service worker to activate
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Store update info for splash screen
      if (updateInfo) {
        sessionStorage.setItem('servimap_update_info', JSON.stringify(updateInfo));
      }
      
      // Wait a bit for activation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show completion message
      setShowUpdateComplete(true);
      
      // Reload after showing message
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('[AppUpdater] Error applying update:', error);
      setUpdateInProgress(false);
    }
  };

  const dismissUpdate = () => {
    setShowUpdatePrompt(false);
    localStorage.setItem('servimap_update_dismissed', Date.now().toString());
  };

  const handleUpdateActivated = () => {
    console.log('[AppUpdater] Update activated');
    localStorage.setItem('servimap_version', updateInfo?.version || '1.0.1');
    setShowUpdateComplete(true);
  };

  // Check if we should show update splash
  const shouldShowUpdateSplash = () => {
    const updateInfoStr = sessionStorage.getItem('servimap_update_info');
    if (updateInfoStr) {
      try {
        const info = JSON.parse(updateInfoStr);
        sessionStorage.removeItem('servimap_update_info');
        return info;
      } catch (error) {
        return null;
      }
    }
    return null;
  };

  const updateSplashInfo = shouldShowUpdateSplash();
  
  // Show update splash if needed
  if (updateSplashInfo) {
    return (
      <UpdateSplashScreen 
        version={updateSplashInfo.version}
        features={updateSplashInfo.features}
      />
    );
  }

  return (
    <>
      {/* Update notification banner */}
      {updateAvailable && !showUpdatePrompt && (
        <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white px-4 py-2 text-sm flex items-center justify-between z-50">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4" />
            <span>Nueva versión disponible</span>
          </div>
          <button
            onClick={() => setShowUpdatePrompt(true)}
            className="text-white underline hover:no-underline"
          >
            Ver detalles
          </button>
        </div>
      )}

      {/* Update prompt modal */}
      {showUpdatePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Download className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Actualización disponible
                    </h3>
                    {updateInfo && (
                      <p className="text-sm text-gray-600">
                        Versión {updateInfo.version} • {updateInfo.size}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={dismissUpdate}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Features */}
              {updateInfo && updateInfo.features && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Novedades:
                  </h4>
                  <ul className="space-y-2">
                    {updateInfo.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Update benefits */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">¿Por qué actualizar?</p>
                    <p className="text-blue-700">
                      Las actualizaciones incluyen mejoras de seguridad, 
                      correcciones de errores y nuevas funcionalidades para 
                      mejorar tu experiencia.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={applyUpdate}
                  disabled={updateInProgress}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {updateInProgress ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Actualizando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Actualizar ahora</span>
                    </>
                  )}
                </button>
                <button
                  onClick={dismissUpdate}
                  disabled={updateInProgress}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Después
                </button>
              </div>

              {/* Auto-update notice */}
              <p className="text-xs text-gray-500 text-center mt-4">
                La actualización se aplicará automáticamente en 24 horas
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Update complete notification */}
      {showUpdateComplete && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2 max-w-sm animate-slide-in">
          <CheckCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">¡Actualización completada!</p>
            <p className="text-sm text-green-100">Recargando la aplicación...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default AppUpdater;