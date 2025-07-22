import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Monitor, Tablet } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [deviceType, setDeviceType] = useState('desktop');
  const [installMetrics, setInstallMetrics] = useState({
    promptShown: 0,
    promptAccepted: 0,
    promptDismissed: 0,
    installSuccess: 0
  });

  useEffect(() => {
    detectDeviceType();
    trackUserInteractions();
    checkInstallationStatus();
    setupPWAListeners();
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const detectDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;
    
    if (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)) {
      if (width < 768) {
        setDeviceType('mobile');
      } else {
        setDeviceType('tablet');
      }
    } else {
      setDeviceType('desktop');
    }
  };

  const trackUserInteractions = () => {
    const storedCount = localStorage.getItem('servimap_interaction_count');
    const currentCount = storedCount ? parseInt(storedCount) : 0;
    setInteractionCount(currentCount);

    const incrementInteraction = () => {
      const newCount = currentCount + 1;
      setInteractionCount(newCount);
      localStorage.setItem('servimap_interaction_count', newCount.toString());
      
      // Show prompt after 3 interactions (intelligent timing)
      if (newCount >= 3 && !isInstalled && deferredPrompt && !localStorage.getItem('servimap_install_dismissed')) {
        const lastShown = localStorage.getItem('servimap_last_prompt_shown');
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (!lastShown || (now - parseInt(lastShown)) > twentyFourHours) {
          setTimeout(() => setShowPrompt(true), 1000);
          localStorage.setItem('servimap_last_prompt_shown', now.toString());
          updateMetrics('promptShown');
        }
      }
    };

    // Track meaningful interactions
    const meaningfulEvents = ['click', 'scroll', 'keydown', 'touchstart'];
    meaningfulEvents.forEach(event => {
      document.addEventListener(event, incrementInteraction, { once: true });
    });
  };

  const checkInstallationStatus = () => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if running in PWA mode
    if (window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Check for installed web app
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then(apps => {
        if (apps.length > 0) {
          setIsInstalled(true);
        }
      });
    }
  };

  const setupPWAListeners = () => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
  };

  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
    console.log('[PWA] Install prompt available');
  };

  const handleAppInstalled = () => {
    setIsInstalled(true);
    setShowPrompt(false);
    setDeferredPrompt(null);
    updateMetrics('installSuccess');
    
    // Show success message
    showInstallSuccessMessage();
    
    console.log('[PWA] App installed successfully');
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      showManualInstallInstructions();
      return;
    }

    try {
      updateMetrics('promptAccepted');
      
      const result = await deferredPrompt.prompt();
      console.log('[PWA] Install prompt result:', result.outcome);
      
      if (result.outcome === 'accepted') {
        setShowPrompt(false);
        updateMetrics('installSuccess');
      } else {
        updateMetrics('promptDismissed');
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      showManualInstallInstructions();
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    updateMetrics('promptDismissed');
    localStorage.setItem('servimap_install_dismissed', 'true');
    
    // Don't show again for 7 days
    const dismissUntil = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('servimap_dismiss_until', dismissUntil.toString());
  };

  const updateMetrics = (action) => {
    const newMetrics = { ...installMetrics };
    newMetrics[action]++;
    setInstallMetrics(newMetrics);
    
    // Send analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install_' + action, {
        event_category: 'PWA',
        event_label: deviceType,
        value: newMetrics[action]
      });
    }
  };

  const showInstallSuccessMessage = () => {
    const message = document.createElement('div');
    message.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in';
    message.innerHTML = `
      <div class="flex items-center space-x-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
        <span>¡ServiMap instalado exitosamente!</span>
      </div>
    `;
    
    document.body.appendChild(message);
    setTimeout(() => {
      message.remove();
    }, 5000);
  };

  const showManualInstallInstructions = () => {
    const instructions = getInstallInstructions();
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">Instalar ServiMap</h3>
          <button class="text-gray-500 hover:text-gray-700" onclick="this.closest('.fixed').remove()">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="space-y-3 text-sm text-gray-600">
          ${instructions.map(step => `<div class="flex items-start space-x-2">
            <span class="text-blue-500 font-semibold">${step.step}.</span>
            <span>${step.text}</span>
          </div>`).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  const getInstallInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome') && deviceType === 'desktop') {
      return [
        { step: 1, text: 'Haz clic en el icono de menú (⋮) en la esquina superior derecha' },
        { step: 2, text: 'Selecciona "Instalar ServiMap..."' },
        { step: 3, text: 'Confirma la instalación' }
      ];
    }
    
    if (userAgent.includes('safari') && deviceType === 'mobile') {
      return [
        { step: 1, text: 'Toca el botón de compartir (□↗) en la parte inferior' },
        { step: 2, text: 'Selecciona "Añadir a pantalla de inicio"' },
        { step: 3, text: 'Toca "Añadir" para confirmar' }
      ];
    }
    
    if (userAgent.includes('firefox')) {
      return [
        { step: 1, text: 'Haz clic en el menú (☰) en la esquina superior derecha' },
        { step: 2, text: 'Selecciona "Instalar esta aplicación"' },
        { step: 3, text: 'Confirma la instalación' }
      ];
    }
    
    return [
      { step: 1, text: 'Busca la opción "Instalar app" en el menú de tu navegador' },
      { step: 2, text: 'También puedes añadir esta página a tu pantalla de inicio' },
      { step: 3, text: 'Disfruta de ServiMap como una app nativa' }
    ];
  };

  const getDeviceIcon = () => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-8 h-8 text-blue-500" />;
      case 'tablet':
        return <Tablet className="w-8 h-8 text-blue-500" />;
      default:
        return <Monitor className="w-8 h-8 text-blue-500" />;
    }
  };

  const getInstallBenefits = () => {
    const baseBenefits = [
      'Acceso rápido desde tu pantalla de inicio',
      'Funciona sin conexión a internet',
      'Notificaciones push en tiempo real',
      'Mejor rendimiento y velocidad'
    ];
    
    const deviceSpecificBenefits = {
      mobile: [
        'Experiencia completa en pantalla',
        'Integración con funciones del teléfono',
        'Menos consumo de batería'
      ],
      tablet: [
        'Interfaz optimizada para tablet',
        'Modo landscape mejorado',
        'Multitarea eficiente'
      ],
      desktop: [
        'Ventana independiente',
        'Atajos de teclado',
        'Integración con sistema operativo'
      ]
    };
    
    return [...baseBenefits, ...deviceSpecificBenefits[deviceType]];
  };

  // Don't show if already installed or recently dismissed
  if (isInstalled || !showPrompt) {
    return null;
  }

  const dismissUntil = localStorage.getItem('servimap_dismiss_until');
  if (dismissUntil && Date.now() < parseInt(dismissUntil)) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-4">
            {getDeviceIcon()}
            <div>
              <h2 className="text-xl font-bold">Instala ServiMap</h2>
              <p className="text-blue-100 text-sm">Experiencia de app nativa</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <img 
                src="/icons/icon-192x192.png" 
                alt="ServiMap" 
                className="w-16 h-16 mx-auto rounded-lg shadow-md"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div 
                className="w-16 h-16 mx-auto bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xl hidden"
              >
                SM
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Por qué instalar ServiMap?
            </h3>
          </div>

          {/* Benefits */}
          <div className="space-y-2 mb-6">
            {getInstallBenefits().slice(0, 4).map((benefit, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                <span className="text-sm text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Install metrics (for analytics) */}
          <div className="text-xs text-gray-500 mb-6 text-center">
            Únete a miles de usuarios que ya tienen ServiMap instalado
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleInstallClick}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105"
            >
              <Download className="w-5 h-5" />
              <span>Instalar ahora</span>
            </button>
            
            <button
              onClick={handleDismiss}
              className="w-full bg-gray-100 text-gray-700 py-2 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Tal vez después
            </button>
          </div>

          {/* Small print */}
          <div className="text-xs text-gray-400 text-center mt-4">
            La instalación es gratuita y puedes desinstalar en cualquier momento
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PWAInstallPrompt;