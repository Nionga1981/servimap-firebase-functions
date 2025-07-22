import React, { useEffect, useState, useCallback } from 'react';
import { Zap, TrendingUp, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

const PerformanceOptimizer = () => {
  const [metrics, setMetrics] = useState({
    lcp: null,     // Largest Contentful Paint
    fid: null,     // First Input Delay  
    cls: null,     // Cumulative Layout Shift
    fcp: null,     // First Contentful Paint
    ttfb: null,    // Time to First Byte
    tti: null      // Time to Interactive
  });
  
  const [optimizations, setOptimizations] = useState({
    lazyLoading: false,
    codeSlitting: false,
    imageOptimization: false,
    prefetching: false,
    serviceWorker: false,
    compression: false
  });

  const [performanceScore, setPerformanceScore] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    initPerformanceMonitoring();
    applyOptimizations();
    monitorPerformance();
  }, []);

  const initPerformanceMonitoring = () => {
    // Initialize performance observer
    if ('PerformanceObserver' in window) {
      // Monitor LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        setMetrics(prev => ({ ...prev, lcp: lastEntry.renderTime || lastEntry.loadTime }));
      });
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('[Performance] LCP observer not supported');
      }

      // Monitor FID
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'first-input') {
            setMetrics(prev => ({ ...prev, fid: entry.processingStart - entry.startTime }));
          }
        });
      });
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('[Performance] FID observer not supported');
      }

      // Monitor CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            setMetrics(prev => ({ ...prev, cls: clsValue }));
          }
        }
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('[Performance] CLS observer not supported');
      }
    }

    // Get navigation timing metrics
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navTiming = performance.getEntriesByType('navigation')[0];
      if (navTiming) {
        setMetrics(prev => ({
          ...prev,
          ttfb: navTiming.responseStart - navTiming.fetchStart,
          fcp: navTiming.domContentLoadedEventEnd - navTiming.fetchStart
        }));
      }
    }

    // Monitor Time to Interactive
    if ('PerformanceLongTaskTiming' in window) {
      const ttiObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry.duration > 50) {
          setMetrics(prev => ({ ...prev, tti: performance.now() }));
        }
      });
      
      try {
        ttiObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('[Performance] TTI observer not supported');
      }
    }
  };

  const applyOptimizations = () => {
    // Enable lazy loading for images
    enableLazyLoading();
    
    // Setup intersection observer for components
    setupIntersectionObserver();
    
    // Enable resource prefetching
    enablePrefetching();
    
    // Check service worker
    checkServiceWorker();
    
    // Monitor bundle size
    monitorBundleSize();
  };

  const enableLazyLoading = () => {
    // Native lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => {
      img.loading = 'lazy';
      img.src = img.dataset.src;
    });
    
    // Intersection Observer for advanced lazy loading
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      document.querySelectorAll('img.lazy').forEach(img => {
        imageObserver.observe(img);
      });
    }
    
    setOptimizations(prev => ({ ...prev, lazyLoading: true }));
  };

  const setupIntersectionObserver = () => {
    // Lazy load components
    const componentObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const componentName = element.dataset.component;
          
          if (componentName) {
            // Dynamic import of component
            import(`../${componentName}`).then(module => {
              console.log(`[Performance] Lazy loaded component: ${componentName}`);
            });
          }
        }
      });
    }, {
      rootMargin: '100px'
    });

    document.querySelectorAll('[data-component]').forEach(element => {
      componentObserver.observe(element);
    });
  };

  const enablePrefetching = () => {
    // Prefetch critical resources
    const criticalResources = [
      '/api/user/profile',
      '/api/services/categories',
      '/static/js/main.chunk.js',
      '/static/css/main.css'
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      document.head.appendChild(link);
    });

    // DNS prefetch for external domains
    const externalDomains = [
      'https://fonts.googleapis.com',
      'https://www.google-analytics.com',
      'https://firebaseapp.com'
    ];

    externalDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });

    // Preconnect to critical origins
    const criticalOrigins = [
      'https://fonts.gstatic.com',
      'https://www.googletagmanager.com'
    ];

    criticalOrigins.forEach(origin => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    setOptimizations(prev => ({ ...prev, prefetching: true }));
  };

  const checkServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.active) {
          setOptimizations(prev => ({ ...prev, serviceWorker: true }));
        }
      });
    }
  };

  const monitorBundleSize = () => {
    // Check if code splitting is enabled
    if (window.__webpack_require__) {
      setOptimizations(prev => ({ ...prev, codeSlitting: true }));
    }

    // Check compression
    fetch(window.location.href, { method: 'HEAD' })
      .then(response => {
        const encoding = response.headers.get('content-encoding');
        if (encoding && (encoding.includes('gzip') || encoding.includes('br'))) {
          setOptimizations(prev => ({ ...prev, compression: true }));
        }
      });
  };

  const monitorPerformance = () => {
    // Calculate performance score
    const calculateScore = () => {
      const scores = {
        lcp: metrics.lcp ? (metrics.lcp < 2500 ? 100 : metrics.lcp < 4000 ? 50 : 0) : null,
        fid: metrics.fid ? (metrics.fid < 100 ? 100 : metrics.fid < 300 ? 50 : 0) : null,
        cls: metrics.cls ? (metrics.cls < 0.1 ? 100 : metrics.cls < 0.25 ? 50 : 0) : null,
        fcp: metrics.fcp ? (metrics.fcp < 1800 ? 100 : metrics.fcp < 3000 ? 50 : 0) : null,
        ttfb: metrics.ttfb ? (metrics.ttfb < 800 ? 100 : metrics.ttfb < 1800 ? 50 : 0) : null
      };

      const validScores = Object.values(scores).filter(s => s !== null);
      if (validScores.length > 0) {
        const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        setPerformanceScore(Math.round(avgScore));
        generateRecommendations(scores);
      }
    };

    // Update score every 5 seconds
    setInterval(calculateScore, 5000);
  };

  const generateRecommendations = (scores) => {
    const recs = [];

    if (scores.lcp < 100) {
      recs.push({
        metric: 'LCP',
        issue: 'El contenido principal tarda mucho en cargar',
        solution: 'Optimiza imágenes y reduce el tamaño de los recursos críticos'
      });
    }

    if (scores.fid < 100) {
      recs.push({
        metric: 'FID',
        issue: 'La página responde lentamente a las interacciones',
        solution: 'Reduce el JavaScript del hilo principal y usa web workers'
      });
    }

    if (scores.cls < 100) {
      recs.push({
        metric: 'CLS',
        issue: 'El diseño se mueve mientras carga',
        solution: 'Define dimensiones para imágenes y evita insertar contenido dinámico'
      });
    }

    if (scores.fcp < 100) {
      recs.push({
        metric: 'FCP',
        issue: 'El primer contenido tarda en aparecer',
        solution: 'Reduce el CSS crítico y optimiza las fuentes'
      });
    }

    if (scores.ttfb < 100) {
      recs.push({
        metric: 'TTFB',
        issue: 'El servidor responde lentamente',
        solution: 'Usa CDN y optimiza la respuesta del servidor'
      });
    }

    setRecommendations(recs);
  };

  // Image optimization utilities
  const optimizeImage = useCallback((src, options = {}) => {
    const { width, height, quality = 85, format = 'webp' } = options;
    
    // Use image optimization service
    const params = new URLSearchParams({
      url: src,
      w: width,
      h: height,
      q: quality,
      fm: format
    });

    return `/api/optimize-image?${params.toString()}`;
  }, []);

  // Resource hints API
  const addResourceHint = useCallback((url, hint = 'prefetch') => {
    const link = document.createElement('link');
    link.rel = hint;
    link.href = url;
    
    if (hint === 'preload') {
      link.as = 'fetch';
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  }, []);

  // Performance mark API
  const performanceMark = useCallback((markName) => {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(markName);
    }
  }, []);

  const performanceMeasure = useCallback((measureName, startMark, endMark) => {
    if ('performance' in window && 'measure' in performance) {
      try {
        performance.measure(measureName, startMark, endMark);
        const measure = performance.getEntriesByName(measureName)[0];
        console.log(`[Performance] ${measureName}: ${measure.duration}ms`);
        return measure.duration;
      } catch (error) {
        console.error('[Performance] Measure error:', error);
      }
    }
  }, []);

  // Debounce utility for performance
  const debounce = useCallback((func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }, []);

  // Throttle utility for performance
  const throttle = useCallback((func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }, []);

  // Request idle callback wrapper
  const requestIdleCallback = useCallback((callback) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback);
    } else {
      setTimeout(callback, 1);
    }
  }, []);

  // Make performance utilities available globally
  useEffect(() => {
    window.PerformanceOptimizer = {
      optimizeImage,
      addResourceHint,
      performanceMark,
      performanceMeasure,
      debounce,
      throttle,
      requestIdleCallback,
      metrics,
      score: performanceScore
    };
  }, [optimizeImage, addResourceHint, performanceMark, performanceMeasure, 
      debounce, throttle, requestIdleCallback, metrics, performanceScore]);

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getMetricStatus = (metric, value) => {
    const thresholds = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 800, poor: 1800 },
      tti: { good: 3500, poor: 7300 }
    };

    const threshold = thresholds[metric];
    if (!threshold || !value) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  };

  // Performance monitoring widget (only in development)
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 bg-white rounded-lg shadow-xl p-4 max-w-sm z-40">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900">Performance</h3>
        </div>
        {performanceScore !== null && (
          <div className={`text-2xl font-bold ${getScoreColor(performanceScore)}`}>
            {performanceScore}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="space-y-2 mb-4">
        {Object.entries(metrics).map(([key, value]) => {
          const status = getMetricStatus(key, value);
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 uppercase">{key}</span>
              <span className={`font-medium ${
                status === 'good' ? 'text-green-500' : 
                status === 'needs-improvement' ? 'text-yellow-500' : 
                status === 'poor' ? 'text-red-500' : 'text-gray-400'
              }`}>
                {value !== null ? `${Math.round(value)}ms` : '-'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Optimizations */}
      <div className="border-t pt-3 mb-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Optimizations</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(optimizations).map(([key, enabled]) => (
            <div key={key} className="flex items-center space-x-1">
              {enabled ? (
                <CheckCircle className="w-3 h-3 text-green-500" />
              ) : (
                <Loader className="w-3 h-3 text-gray-400" />
              )}
              <span className="text-gray-600">{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border-t pt-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
          <div className="space-y-2">
            {recommendations.slice(0, 2).map((rec, index) => (
              <div key={index} className="text-xs">
                <div className="flex items-start space-x-1">
                  <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5" />
                  <div>
                    <span className="font-medium">{rec.metric}:</span>
                    <span className="text-gray-600 ml-1">{rec.issue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceOptimizer;