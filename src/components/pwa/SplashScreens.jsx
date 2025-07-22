import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const SplashScreens = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Iniciando ServiMap...');

  useEffect(() => {
    // Check if we should show splash screen
    const shouldShowSplash = checkSplashConditions();
    
    if (shouldShowSplash) {
      initializeSplashScreen();
      preloadCriticalAssets();
    } else {
      setShowSplash(false);
    }
  }, []);

  const checkSplashConditions = () => {
    // Don't show splash if:
    // 1. User has seen it recently (within last hour)
    const lastSplash = localStorage.getItem('servimap_last_splash');
    if (lastSplash) {
      const timeSinceLastSplash = Date.now() - parseInt(lastSplash);
      if (timeSinceLastSplash < 3600000) { // 1 hour
        return false;
      }
    }

    // 2. App is already loaded (for PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      const isFirstLaunch = !localStorage.getItem('servimap_pwa_launched');
      if (!isFirstLaunch) {
        return false;
      }
    }

    // 3. User has disabled splash
    if (localStorage.getItem('servimap_disable_splash') === 'true') {
      return false;
    }

    return true;
  };

  const initializeSplashScreen = () => {
    // Set up splash screen
    document.body.style.overflow = 'hidden';
    
    // Mark splash as shown
    localStorage.setItem('servimap_last_splash', Date.now().toString());
    
    // For PWA, mark as launched
    if (window.matchMedia('(display-mode: standalone)').matches) {
      localStorage.setItem('servimap_pwa_launched', 'true');
    }

    // Set up progress simulation
    simulateProgress();
  };

  const simulateProgress = () => {
    const messages = [
      { progress: 10, message: 'Cargando recursos...' },
      { progress: 25, message: 'Conectando con servicios...' },
      { progress: 40, message: 'Verificando ubicación...' },
      { progress: 60, message: 'Cargando proveedores cercanos...' },
      { progress: 80, message: 'Preparando experiencia personalizada...' },
      { progress: 95, message: 'Casi listo...' },
      { progress: 100, message: '¡Bienvenido a ServiMap!' }
    ];

    let currentIndex = 0;
    
    const updateProgress = () => {
      if (currentIndex < messages.length) {
        const { progress, message } = messages[currentIndex];
        setLoadingProgress(progress);
        setLoadingMessage(message);
        currentIndex++;
        
        if (currentIndex < messages.length) {
          setTimeout(updateProgress, 300 + Math.random() * 200);
        } else {
          // Complete loading
          setTimeout(() => {
            hideSplashScreen();
          }, 500);
        }
      }
    };

    updateProgress();
  };

  const preloadCriticalAssets = async () => {
    const criticalAssets = [
      '/icons/icon-192x192.png',
      '/icons/icon-512x512.png',
      '/static/js/main.chunk.js',
      '/static/css/main.css'
    ];

    const preloadPromises = criticalAssets.map(asset => {
      return new Promise((resolve) => {
        if (asset.endsWith('.js')) {
          const script = document.createElement('script');
          script.src = asset;
          script.onload = resolve;
          script.onerror = resolve;
          document.head.appendChild(script);
        } else if (asset.endsWith('.css')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = asset;
          link.onload = resolve;
          link.onerror = resolve;
          document.head.appendChild(link);
        } else if (asset.match(/\.(png|jpg|jpeg|webp)$/)) {
          const img = new Image();
          img.src = asset;
          img.onload = resolve;
          img.onerror = resolve;
        } else {
          fetch(asset)
            .then(resolve)
            .catch(resolve);
        }
      });
    });

    try {
      await Promise.all(preloadPromises);
    } catch (error) {
      console.error('[Splash] Error preloading assets:', error);
    }
  };

  const hideSplashScreen = () => {
    // Animate out
    const splashElement = document.getElementById('servimap-splash');
    if (splashElement) {
      splashElement.style.opacity = '0';
      splashElement.style.transform = 'scale(1.1)';
      
      setTimeout(() => {
        setShowSplash(false);
        document.body.style.overflow = '';
      }, 300);
    }
  };

  if (!showSplash) {
    return null;
  }

  return (
    <div
      id="servimap-splash"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 transition-all duration-300"
    >
      <div className="text-center text-white px-8">
        {/* Logo */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 mx-auto bg-white rounded-2xl shadow-2xl flex items-center justify-center transform rotate-3 transition-transform hover:rotate-6">
            <span className="text-4xl font-bold text-blue-500">SM</span>
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-400 rounded-full animate-ping"></div>
        </div>

        {/* App name */}
        <h1 className="text-4xl font-bold mb-2 animate-fade-in">ServiMap</h1>
        <p className="text-lg text-blue-100 mb-8 animate-fade-in-delay">
          Servicios a domicilio
        </p>

        {/* Loading indicator */}
        <div className="mb-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin" />
        </div>

        {/* Progress bar */}
        <div className="w-64 mx-auto mb-4">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>

        {/* Loading message */}
        <p className="text-sm text-blue-100 animate-pulse">
          {loadingMessage}
        </p>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-float"></div>
      <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl animate-float-delay"></div>
      <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-blue-300/20 rounded-full blur-xl animate-float-reverse"></div>
      
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay {
          0% { opacity: 0; transform: translateY(20px); }
          50% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes float-delay {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
        
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(20px); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in-delay 1.2s ease-out;
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-float-delay {
          animation: float-delay 8s ease-in-out infinite;
        }
        
        .animate-float-reverse {
          animation: float-reverse 7s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

// Splash screen for app updates
export const UpdateSplashScreen = ({ version, features }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600">
      <div className="text-center text-white px-8 max-w-md">
        {/* Update icon */}
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-white rounded-full flex items-center justify-center shadow-2xl">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>

        {/* Update message */}
        <h2 className="text-3xl font-bold mb-4">¡ServiMap se actualizó!</h2>
        <p className="text-lg mb-2">Versión {version}</p>

        {/* New features */}
        {features && features.length > 0 && (
          <div className="mt-6 text-left">
            <p className="text-sm font-semibold mb-2">Novedades:</p>
            <ul className="text-sm space-y-1">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-green-300">•</span>
                  <span className="text-white/90">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Loading skeleton for lazy loaded components
export const ComponentSplashScreen = ({ componentName }) => {
  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-gray-50 rounded-lg">
      <div className="text-center">
        <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-600">Cargando {componentName}...</p>
      </div>
    </div>
  );
};

// Minimal splash for fast connections
export const MinimalSplashScreen = () => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-xl flex items-center justify-center animate-bounce">
          <span className="text-2xl font-bold text-white">SM</span>
        </div>
        <div className="flex space-x-1 justify-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreens;