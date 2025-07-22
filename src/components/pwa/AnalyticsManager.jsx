import React, { useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, Clock } from 'lucide-react';

const AnalyticsManager = () => {
  useEffect(() => {
    initializeAnalytics();
    trackPWAMetrics();
    setupEventListeners();
    monitorPerformance();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeAnalytics = () => {
    // Initialize Google Analytics 4
    if (typeof gtag === 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX', {
        send_page_view: false,
        custom_map: {
          dimension1: 'user_type',
          dimension2: 'pwa_installed',
          dimension3: 'offline_capable',
          dimension4: 'device_category'
        }
      });
    }

    // Initialize custom analytics
    window.ServiMapAnalytics = {
      track: trackEvent,
      trackPage: trackPageView,
      trackUser: trackUserProperties,
      trackTiming: trackTiming,
      trackException: trackException,
      trackPWA: trackPWAEvent
    };
  };

  const trackPWAMetrics = () => {
    // Track if app is installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://');
    
    trackEvent('pwa_status', {
      installed: isInstalled,
      platform: detectPlatform(),
      entry_point: getEntryPoint()
    });

    // Track service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        trackEvent('service_worker_status', {
          active: !!registration.active,
          waiting: !!registration.waiting,
          installing: !!registration.installing
        });
      });
    }

    // Track offline capability
    trackEvent('offline_capability', {
      supported: 'serviceWorker' in navigator,
      online: navigator.onLine,
      connection_type: getConnectionType()
    });

    // Track notification permission
    if ('Notification' in window) {
      trackEvent('notification_permission', {
        status: Notification.permission
      });
    }
  };

  const setupEventListeners = () => {
    // Track app visibility
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Track online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Track PWA install
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Track page lifecycle
    if ('onfreeze' in document) {
      document.addEventListener('freeze', handleFreeze);
      document.addEventListener('resume', handleResume);
    }

    // Track errors
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Track user engagement
    trackEngagement();
  };

  const monitorPerformance = () => {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      // LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        trackTiming('lcp', lastEntry.renderTime || lastEntry.loadTime);
      });
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('[Analytics] LCP observer not supported');
      }

      // FID
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'first-input') {
            trackTiming('fid', entry.processingStart - entry.startTime);
          }
        });
      });
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('[Analytics] FID observer not supported');
      }

      // CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        trackTiming('cls', clsValue * 1000); // Convert to ms
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('[Analytics] CLS observer not supported');
      }
    }

    // Track page load metrics
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navTiming = performance.getEntriesByType('navigation')[0];
        if (navTiming) {
          trackTiming('page_load', navTiming.loadEventEnd - navTiming.fetchStart);
          trackTiming('dom_ready', navTiming.domContentLoadedEventEnd - navTiming.fetchStart);
          trackTiming('ttfb', navTiming.responseStart - navTiming.fetchStart);
        }
      }, 0);
    });
  };

  const trackEngagement = () => {
    let startTime = Date.now();
    let totalTime = 0;
    let isActive = true;

    // Track time on page
    const updateEngagementTime = () => {
      if (isActive) {
        totalTime += Date.now() - startTime;
      }
      startTime = Date.now();
    };

    // Track when user becomes inactive
    let inactivityTimer;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      if (!isActive) {
        isActive = true;
        startTime = Date.now();
      }
      
      inactivityTimer = setTimeout(() => {
        isActive = false;
        updateEngagementTime();
      }, 30000); // 30 seconds of inactivity
    };

    // Track user interactions
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    // Send engagement time before page unload
    window.addEventListener('beforeunload', () => {
      updateEngagementTime();
      trackEvent('engagement_time', {
        total_time: totalTime,
        page_url: window.location.pathname
      });
    });

    resetInactivityTimer();
  };

  // Event tracking functions
  const trackEvent = useCallback((eventName, parameters = {}) => {
    try {
      // Add common parameters
      const enhancedParams = {
        ...parameters,
        timestamp: new Date().toISOString(),
        session_id: getSessionId(),
        user_id: getUserId(),
        device_type: detectDeviceType(),
        is_pwa: isPWA(),
        is_online: navigator.onLine
      };

      // Send to Google Analytics
      if (typeof gtag !== 'undefined') {
        gtag('event', eventName, enhancedParams);
      }

      // Send to custom analytics endpoint
      sendToAnalyticsEndpoint('event', {
        name: eventName,
        parameters: enhancedParams
      });

      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Event:', eventName, enhancedParams);
      }
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error);
    }
  }, []);

  const trackPageView = useCallback((pagePath, pageTitle) => {
    try {
      const pageData = {
        page_path: pagePath || window.location.pathname,
        page_title: pageTitle || document.title,
        page_location: window.location.href,
        referrer: document.referrer
      };

      if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', pageData);
      }

      sendToAnalyticsEndpoint('pageview', pageData);
    } catch (error) {
      console.error('[Analytics] Error tracking page view:', error);
    }
  }, []);

  const trackUserProperties = useCallback((properties) => {
    try {
      if (typeof gtag !== 'undefined') {
        gtag('set', 'user_properties', properties);
      }

      sendToAnalyticsEndpoint('user', properties);
    } catch (error) {
      console.error('[Analytics] Error tracking user properties:', error);
    }
  }, []);

  const trackTiming = useCallback((timingCategory, timingValue, timingLabel) => {
    try {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'timing_complete', {
          name: timingCategory,
          value: Math.round(timingValue),
          event_category: 'Performance',
          event_label: timingLabel
        });
      }

      sendToAnalyticsEndpoint('timing', {
        category: timingCategory,
        value: timingValue,
        label: timingLabel
      });
    } catch (error) {
      console.error('[Analytics] Error tracking timing:', error);
    }
  }, []);

  const trackException = useCallback((description, fatal = false) => {
    try {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'exception', {
          description: description,
          fatal: fatal
        });
      }

      sendToAnalyticsEndpoint('exception', {
        description,
        fatal,
        stack_trace: new Error().stack
      });
    } catch (error) {
      console.error('[Analytics] Error tracking exception:', error);
    }
  }, []);

  const trackPWAEvent = useCallback((action, label, value) => {
    trackEvent('pwa_interaction', {
      action,
      label,
      value,
      category: 'PWA'
    });
  }, [trackEvent]);

  // Event handlers
  const handleVisibilityChange = () => {
    trackEvent('visibility_change', {
      visibility_state: document.visibilityState,
      hidden: document.hidden
    });
  };

  const handleOnline = () => {
    trackEvent('connection_change', {
      status: 'online',
      connection_type: getConnectionType()
    });
  };

  const handleOffline = () => {
    trackEvent('connection_change', {
      status: 'offline'
    });
  };

  const handleAppInstalled = () => {
    trackEvent('pwa_installed', {
      platform: detectPlatform(),
      install_source: getInstallSource()
    });
  };

  const handleFreeze = () => {
    trackEvent('page_lifecycle', {
      state: 'frozen'
    });
  };

  const handleResume = () => {
    trackEvent('page_lifecycle', {
      state: 'resumed'
    });
  };

  const handleError = (event) => {
    trackException(`${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, false);
  };

  const handleUnhandledRejection = (event) => {
    trackException(`Unhandled Promise Rejection: ${event.reason}`, false);
  };

  // Utility functions
  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('servimap_session_id');
    if (!sessionId) {
      sessionId = generateUUID();
      sessionStorage.setItem('servimap_session_id', sessionId);
    }
    return sessionId;
  };

  const getUserId = () => {
    // Get from auth context or localStorage
    return localStorage.getItem('servimap_user_id') || 'anonymous';
  };

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    if (userAgent.includes('windows')) return 'windows';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
    return 'unknown';
  };

  const detectDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const isPWA = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  };

  const getConnectionType = () => {
    if ('connection' in navigator && navigator.connection.effectiveType) {
      return navigator.connection.effectiveType;
    }
    return 'unknown';
  };

  const getEntryPoint = () => {
    const referrer = document.referrer;
    if (!referrer) return 'direct';
    if (referrer.includes('google')) return 'google';
    if (referrer.includes('facebook')) return 'facebook';
    if (referrer.includes('twitter')) return 'twitter';
    return 'other';
  };

  const getInstallSource = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('utm_source') || 'organic';
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const sendToAnalyticsEndpoint = async (type, data) => {
    try {
      const payload = {
        type,
        data,
        timestamp: Date.now(),
        session_id: getSessionId(),
        user_id: getUserId()
      };

      // Use sendBeacon for reliability
      if ('sendBeacon' in navigator) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics', blob);
      } else {
        // Fallback to fetch
        fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {
          // Store in localStorage for retry
          const pendingAnalytics = JSON.parse(localStorage.getItem('servimap_pending_analytics') || '[]');
          pendingAnalytics.push(payload);
          if (pendingAnalytics.length > 100) {
            pendingAnalytics.shift(); // Remove oldest
          }
          localStorage.setItem('servimap_pending_analytics', JSON.stringify(pendingAnalytics));
        });
      }
    } catch (error) {
      console.error('[Analytics] Error sending to endpoint:', error);
    }
  };

  const cleanup = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('appinstalled', handleAppInstalled);
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    
    if ('onfreeze' in document) {
      document.removeEventListener('freeze', handleFreeze);
      document.removeEventListener('resume', handleResume);
    }
  };

  // Analytics dashboard component (only in development)
  if (process.env.NODE_ENV === 'development') {
    return <AnalyticsDashboard />;
  }

  return null;
};

// Development analytics dashboard
const AnalyticsDashboard = () => {
  const [metrics, setMetrics] = useState({
    events: [],
    pageViews: 0,
    errors: 0,
    performance: {}
  });

  useEffect(() => {
    // Override console methods to capture analytics in dev
    const originalLog = console.log;
    console.log = (...args) => {
      if (args[0] === '[Analytics]') {
        setMetrics(prev => ({
          ...prev,
          events: [...prev.events.slice(-9), { time: new Date(), data: args }]
        }));
      }
      originalLog.apply(console, args);
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  return (
    <div className="fixed bottom-20 left-4 bg-white rounded-lg shadow-xl p-4 max-w-xs z-40">
      <div className="flex items-center space-x-2 mb-3">
        <BarChart3 className="w-5 h-5 text-purple-500" />
        <h3 className="font-semibold text-gray-900">Analytics Debug</h3>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Events:</span>
          <span className="font-medium">{metrics.events.length}</span>
        </div>
        
        <div className="max-h-32 overflow-y-auto border-t pt-2">
          {metrics.events.map((event, index) => (
            <div key={index} className="text-gray-500 truncate">
              {new Date(event.time).toLocaleTimeString()}: {event.data.slice(1).join(' ')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsManager;