import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Camera, MapPin, Share2, Vibrate, Battery, Wifi } from 'lucide-react';

const DeviceIntegration = () => {
  const [deviceCapabilities, setDeviceCapabilities] = useState({
    camera: false,
    location: false,
    share: false,
    vibration: false,
    battery: false,
    network: false,
    contacts: false,
    clipboard: false,
    fileSystem: false,
    bluetooth: false,
    nfc: false,
    orientation: false,
    motion: false,
    wake: false
  });

  const [deviceInfo, setDeviceInfo] = useState({
    platform: '',
    userAgent: '',
    screenSize: '',
    pixelRatio: 1,
    touchPoints: 0,
    memory: null,
    cores: null
  });

  const [permissions, setPermissions] = useState({});
  const [batteryInfo, setBatteryInfo] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    detectDeviceCapabilities();
    collectDeviceInfo();
    checkPermissions();
    setupDeviceListeners();
    
    return () => {
      cleanupListeners();
    };
  }, []);

  const detectDeviceCapabilities = () => {
    const capabilities = {
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      location: 'geolocation' in navigator,
      share: 'share' in navigator,
      vibration: 'vibrate' in navigator,
      battery: 'getBattery' in navigator,
      network: 'connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator,
      contacts: 'contacts' in navigator && 'ContactsManager' in window,
      clipboard: 'clipboard' in navigator,
      fileSystem: 'showOpenFilePicker' in window,
      bluetooth: 'bluetooth' in navigator,
      nfc: 'NDEFReader' in window,
      orientation: 'DeviceOrientationEvent' in window,
      motion: 'DeviceMotionEvent' in window,
      wake: 'wakeLock' in navigator
    };
    
    setDeviceCapabilities(capabilities);
  };

  const collectDeviceInfo = () => {
    const info = {
      platform: navigator.platform || 'Unknown',
      userAgent: navigator.userAgent,
      screenSize: `${screen.width}x${screen.height}`,
      pixelRatio: window.devicePixelRatio || 1,
      touchPoints: navigator.maxTouchPoints || 0,
      memory: navigator.deviceMemory || null,
      cores: navigator.hardwareConcurrency || null,
      language: navigator.language,
      languages: navigator.languages,
      onLine: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      vendor: navigator.vendor
    };
    
    setDeviceInfo(info);
  };

  const checkPermissions = async () => {
    const permissionsToCheck = [
      'camera',
      'microphone',
      'geolocation',
      'notifications',
      'persistent-storage',
      'ambient-light-sensor',
      'accelerometer',
      'gyroscope',
      'magnetometer'
    ];
    
    const permissionStatus = {};
    
    for (const permission of permissionsToCheck) {
      try {
        const result = await navigator.permissions.query({ name: permission });
        permissionStatus[permission] = result.state;
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissions(prev => ({ ...prev, [permission]: result.state }));
        });
      } catch (error) {
        permissionStatus[permission] = 'not-supported';
      }
    }
    
    setPermissions(permissionStatus);
  };

  const setupDeviceListeners = () => {
    // Battery status
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryInfo({
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        });
        
        battery.addEventListener('levelchange', () => {
          setBatteryInfo(prev => ({ ...prev, level: battery.level }));
        });
        
        battery.addEventListener('chargingchange', () => {
          setBatteryInfo(prev => ({ ...prev, charging: battery.charging }));
        });
      });
    }
    
    // Network information
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      updateNetworkInfo(connection);
      connection.addEventListener('change', () => updateNetworkInfo(connection));
    }
    
    // Device orientation
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
    
    // Device motion
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleDeviceMotion);
    }
    
    // Screen orientation
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }
    
    // Visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Online/offline
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  };

  const updateNetworkInfo = (connection) => {
    setNetworkInfo({
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
      type: connection.type
    });
  };

  const handleDeviceOrientation = (event) => {
    // Handle device orientation data
    const { alpha, beta, gamma } = event;
    window.ServiMapDeviceOrientation = { alpha, beta, gamma };
  };

  const handleDeviceMotion = (event) => {
    // Handle device motion data
    const { acceleration, accelerationIncludingGravity, rotationRate } = event;
    window.ServiMapDeviceMotion = { acceleration, accelerationIncludingGravity, rotationRate };
  };

  const handleOrientationChange = () => {
    const orientation = screen.orientation.type;
    window.ServiMapOrientation = orientation;
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // App is hidden, pause unnecessary operations
      window.ServiMapVisibility = 'hidden';
    } else {
      // App is visible, resume operations
      window.ServiMapVisibility = 'visible';
    }
  };

  const handleOnline = () => {
    window.ServiMapConnection = 'online';
  };

  const handleOffline = () => {
    window.ServiMapConnection = 'offline';
  };

  const cleanupListeners = () => {
    window.removeEventListener('deviceorientation', handleDeviceOrientation);
    window.removeEventListener('devicemotion', handleDeviceMotion);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    
    if (screen.orientation) {
      screen.orientation.removeEventListener('change', handleOrientationChange);
    }
  };

  // Device API functions
  const requestCameraAccess = useCallback(async (options = {}) => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: options.facingMode || 'environment',
          ...options.video
        },
        audio: options.audio || false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      console.error('[Device] Camera access error:', error);
      throw error;
    }
  }, []);

  const requestLocationAccess = useCallback(async (options = {}) => {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: options.highAccuracy !== false,
          timeout: options.timeout || 10000,
          maximumAge: options.maximumAge || 0
        });
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
      };
    } catch (error) {
      console.error('[Device] Location access error:', error);
      throw error;
    }
  }, []);

  const shareContent = useCallback(async (data) => {
    if (!navigator.share) {
      throw new Error('Web Share API not supported');
    }
    
    try {
      await navigator.share({
        title: data.title || 'ServiMap',
        text: data.text || '',
        url: data.url || window.location.href,
        files: data.files
      });
      
      return { success: true };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, reason: 'cancelled' };
      }
      throw error;
    }
  }, []);

  const vibrate = useCallback((pattern = 200) => {
    if (!navigator.vibrate) {
      console.warn('[Device] Vibration API not supported');
      return false;
    }
    
    return navigator.vibrate(pattern);
  }, []);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (err) {
        document.body.removeChild(textArea);
        throw err;
      }
    }
  }, []);

  const readFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      return text;
    } catch (error) {
      console.error('[Device] Clipboard read error:', error);
      throw error;
    }
  }, []);

  const pickFiles = useCallback(async (options = {}) => {
    try {
      const pickerOpts = {
        types: options.types || [
          {
            description: 'Images',
            accept: {
              'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.webp']
            }
          }
        ],
        excludeAcceptAllOption: options.excludeAcceptAllOption || false,
        multiple: options.multiple || false
      };
      
      const fileHandles = await window.showOpenFilePicker(pickerOpts);
      const files = await Promise.all(
        fileHandles.map(handle => handle.getFile())
      );
      
      return files;
    } catch (error) {
      if (error.name === 'AbortError') {
        return [];
      }
      throw error;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      throw new Error('Wake Lock API not supported');
    }
    
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      
      // Re-acquire wake lock on visibility change
      document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
          await navigator.wakeLock.request('screen');
        }
      });
      
      return wakeLock;
    } catch (error) {
      console.error('[Device] Wake lock error:', error);
      throw error;
    }
  }, []);

  const scanQRCode = useCallback(async () => {
    try {
      const stream = await requestCameraAccess({ video: { facingMode: 'environment' } });
      
      // Here you would integrate with a QR code scanning library
      // For now, we just return the stream
      return { stream, message: 'Integrate with QR scanner library' };
    } catch (error) {
      console.error('[Device] QR scan error:', error);
      throw error;
    }
  }, [requestCameraAccess]);

  // Make device integration API available globally
  useEffect(() => {
    window.ServiMapDevice = {
      capabilities: deviceCapabilities,
      info: deviceInfo,
      permissions,
      battery: batteryInfo,
      network: networkInfo,
      requestCamera: requestCameraAccess,
      requestLocation: requestLocationAccess,
      share: shareContent,
      vibrate,
      copyToClipboard,
      readFromClipboard,
      pickFiles,
      requestWakeLock,
      scanQRCode
    };
  }, [deviceCapabilities, deviceInfo, permissions, batteryInfo, networkInfo,
      requestCameraAccess, requestLocationAccess, shareContent, vibrate,
      copyToClipboard, readFromClipboard, pickFiles, requestWakeLock, scanQRCode]);

  // Device integration widget (only in development)
  if (process.env.NODE_ENV === 'development') {
    return <DeviceIntegrationWidget />;
  }

  return null;
};

// Development device integration widget
const DeviceIntegrationWidget = () => {
  const [expanded, setExpanded] = useState(false);

  const testVibration = () => {
    if (window.ServiMapDevice?.vibrate) {
      window.ServiMapDevice.vibrate([200, 100, 200]);
    }
  };

  const testShare = async () => {
    if (window.ServiMapDevice?.share) {
      try {
        await window.ServiMapDevice.share({
          title: 'Test Share',
          text: 'Testing device integration',
          url: window.location.href
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    }
  };

  const capabilities = window.ServiMapDevice?.capabilities || {};
  const enabledCount = Object.values(capabilities).filter(Boolean).length;

  return (
    <div className="fixed bottom-20 left-4 bg-white rounded-lg shadow-xl z-40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="p-3 flex items-center space-x-2 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <Smartphone className="w-5 h-5 text-purple-500" />
        <span className="text-sm font-medium">Device APIs</span>
        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
          {enabledCount}
        </span>
      </button>
      
      {expanded && (
        <div className="p-4 border-t max-w-xs">
          <div className="space-y-2 text-xs">
            {Object.entries(capabilities).map(([key, supported]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}:</span>
                <span className={supported ? 'text-green-500' : 'text-red-500'}>
                  {supported ? 'Yes' : 'No'}
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-3 pt-3 border-t space-y-2">
            <button
              onClick={testVibration}
              className="w-full text-xs bg-purple-100 text-purple-700 py-1 px-2 rounded hover:bg-purple-200 transition-colors"
            >
              Test Vibration
            </button>
            <button
              onClick={testShare}
              className="w-full text-xs bg-purple-100 text-purple-700 py-1 px-2 rounded hover:bg-purple-200 transition-colors"
            >
              Test Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceIntegration;