import React, { useEffect, useState, useCallback } from 'react';
import { Eye, Ear, Hand, Zap, Settings, Check } from 'lucide-react';

const AccessibilityEnhancer = () => {
  const [accessibilitySettings, setAccessibilitySettings] = useState({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: false,
    focusIndicators: true,
    alternativeText: true,
    colorBlindSupport: false,
    voiceCommands: false,
    tapTargetSize: false
  });

  const [userPreferences, setUserPreferences] = useState({
    fontSize: 'normal',
    colorScheme: 'auto',
    animationLevel: 'normal',
    soundFeedback: false,
    hapticFeedback: true,
    autoPlay: false
  });

  const [accessibilityScore, setAccessibilityScore] = useState(0);
  const [showA11yPanel, setShowA11yPanel] = useState(false);

  useEffect(() => {
    initializeAccessibility();
    loadUserPreferences();
    detectSystemPreferences();
    setupA11yListeners();
    implementA11yFeatures();
    
    return () => {
      cleanupA11yListeners();
    };
  }, []);

  const initializeAccessibility = () => {
    // Set page language
    if (!document.documentElement.lang) {
      document.documentElement.lang = 'es-MX';
    }
    
    // Add aria-live region for announcements
    createAriaLiveRegion();
    
    // Setup skip links
    createSkipLinks();
    
    // Initialize focus management
    initializeFocusManagement();
    
    // Setup keyboard navigation
    setupKeyboardNavigation();
    
    // Add ARIA landmarks
    addAriaLandmarks();
    
    // Setup heading hierarchy
    validateHeadingHierarchy();
  };

  const loadUserPreferences = () => {
    const stored = localStorage.getItem('servimap_accessibility_settings');
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        setAccessibilitySettings(settings);
        applyAccessibilitySettings(settings);
      } catch (error) {
        console.error('[A11y] Error loading settings:', error);
      }
    }
  };

  const detectSystemPreferences = () => {
    // Detect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAccessibilitySettings(prev => ({ ...prev, reducedMotion: true }));
    }
    
    // Detect prefers-color-scheme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    
    if (prefersDark) {
      setUserPreferences(prev => ({ ...prev, colorScheme: 'dark' }));
    } else if (prefersLight) {
      setUserPreferences(prev => ({ ...prev, colorScheme: 'light' }));
    }
    
    // Detect high contrast preference
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    if (prefersHighContrast) {
      setAccessibilitySettings(prev => ({ ...prev, highContrast: true }));
    }
    
    // Detect transparency preference
    const prefersReducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
    if (prefersReducedTransparency) {
      document.documentElement.classList.add('reduced-transparency');
    }
  };

  const setupA11yListeners = () => {
    // Listen for media query changes
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    highContrastQuery.addEventListener('change', handleHighContrastChange);
    
    // Listen for keyboard events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);
    
    // Listen for screen reader detection
    detectScreenReader();
  };

  const cleanupA11yListeners = () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('focus', handleFocus, true);
    document.removeEventListener('blur', handleBlur, true);
  };

  const handleReducedMotionChange = (e) => {
    setAccessibilitySettings(prev => ({ ...prev, reducedMotion: e.matches }));
    applyReducedMotion(e.matches);
  };

  const handleHighContrastChange = (e) => {
    setAccessibilitySettings(prev => ({ ...prev, highContrast: e.matches }));
    applyHighContrast(e.matches);
  };

  const handleKeyDown = (e) => {
    // Handle keyboard navigation
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
      setAccessibilitySettings(prev => ({ ...prev, keyboardNavigation: true }));
    }
    
    // Accessibility shortcuts
    if (e.altKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          toggleHighContrast();
          break;
        case '2':
          e.preventDefault();
          toggleLargeText();
          break;
        case '3':
          e.preventDefault();
          toggleReducedMotion();
          break;
        case 'a':
          e.preventDefault();
          setShowA11yPanel(true);
          break;
      }
    }
    
    // Escape key to close modals
    if (e.key === 'Escape') {
      closeAllModals();
    }
  };

  const handleFocus = (e) => {
    // Announce focus changes to screen readers
    const element = e.target;
    const ariaLabel = element.getAttribute('aria-label');
    const textContent = element.textContent?.trim();
    
    if (ariaLabel || textContent) {
      announceToScreenReader(`Enfocado: ${ariaLabel || textContent}`);
    }
  };

  const handleBlur = (e) => {
    // Remove keyboard navigation class when not using keyboard
    if (!e.relatedTarget) {
      document.body.classList.remove('keyboard-navigation');
    }
  };

  const detectScreenReader = () => {
    // Detect if screen reader is being used
    let isScreenReader = false;
    
    // Check for common screen reader patterns
    const testDiv = document.createElement('div');
    testDiv.setAttribute('aria-hidden', 'true');
    testDiv.style.position = 'absolute';
    testDiv.style.left = '-10000px';
    testDiv.textContent = 'Screen reader test';
    document.body.appendChild(testDiv);
    
    setTimeout(() => {
      if (testDiv.offsetHeight > 0 || testDiv.offsetWidth > 0) {
        isScreenReader = true;
        setAccessibilitySettings(prev => ({ ...prev, screenReader: true }));
      }
      document.body.removeChild(testDiv);
    }, 100);
  };

  const implementA11yFeatures = () => {
    // Add focus indicators
    addFocusIndicators();
    
    // Enhance form accessibility
    enhanceFormAccessibility();
    
    // Add button accessibility
    enhanceButtonAccessibility();
    
    // Add image accessibility
    enhanceImageAccessibility();
    
    // Add table accessibility
    enhanceTableAccessibility();
    
    // Add modal accessibility
    enhanceModalAccessibility();
    
    // Calculate accessibility score
    calculateAccessibilityScore();
  };

  const createAriaLiveRegion = () => {
    let liveRegion = document.getElementById('aria-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
  };

  const createSkipLinks = () => {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Saltar al contenido principal';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      border-radius: 4px;
      z-index: 10000;
      transition: top 0.3s;
    `;
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  };

  const addAriaLandmarks = () => {
    // Add main landmark
    const main = document.querySelector('main') || document.querySelector('#main-content');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
    }
    
    // Add navigation landmarks
    const navs = document.querySelectorAll('nav');
    navs.forEach(nav => {
      if (!nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby')) {
        nav.setAttribute('aria-label', 'Navegación');
      }
    });
    
    // Add complementary landmarks
    const asides = document.querySelectorAll('aside');
    asides.forEach(aside => {
      if (!aside.getAttribute('role')) {
        aside.setAttribute('role', 'complementary');
      }
    });
  };

  const validateHeadingHierarchy = () => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const issues = [];
    let lastLevel = 0;
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (index === 0 && level !== 1) {
        issues.push('La página debe comenzar con un h1');
      }
      
      if (level > lastLevel + 1) {
        issues.push(`Salto de nivel de encabezado: ${heading.tagName} después de h${lastLevel}`);
      }
      
      lastLevel = level;
    });
    
    if (issues.length > 0) {
      console.warn('[A11y] Heading hierarchy issues:', issues);
    }
  };

  const initializeFocusManagement = () => {
    let focusedElementBeforeModal = null;
    
    window.ServiMapA11y = {
      trapFocus: (container) => {
        const focusableElements = container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (e) => {
          if (e.key === 'Tab') {
            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
              }
            }
          }
        };
        
        container.addEventListener('keydown', handleTabKey);
        firstElement?.focus();
        
        return () => {
          container.removeEventListener('keydown', handleTabKey);
        };
      },
      
      saveLastFocus: () => {
        focusedElementBeforeModal = document.activeElement;
      },
      
      restoreLastFocus: () => {
        if (focusedElementBeforeModal) {
          focusedElementBeforeModal.focus();
          focusedElementBeforeModal = null;
        }
      }
    };
  };

  const setupKeyboardNavigation = () => {
    // Add keyboard support for custom components
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      
      // Handle custom dropdowns
      if (target.getAttribute('role') === 'button' && target.getAttribute('aria-expanded')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          target.click();
        }
      }
      
      // Handle tab panels
      if (target.getAttribute('role') === 'tab') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const tabs = Array.from(target.parentElement.querySelectorAll('[role="tab"]'));
          const currentIndex = tabs.indexOf(target);
          const nextIndex = e.key === 'ArrowRight' 
            ? (currentIndex + 1) % tabs.length 
            : (currentIndex - 1 + tabs.length) % tabs.length;
          tabs[nextIndex].focus();
          tabs[nextIndex].click();
        }
      }
    });
  };

  const addFocusIndicators = () => {
    const style = document.createElement('style');
    style.textContent = `
      .keyboard-navigation *:focus {
        outline: 2px solid #3B82F6 !important;
        outline-offset: 2px !important;
      }
      
      .skip-link:focus {
        outline: 2px solid #fff !important;
      }
      
      .focus-visible {
        outline: 2px solid #3B82F6 !important;
        outline-offset: 2px !important;
      }
    `;
    document.head.appendChild(style);
  };

  const enhanceFormAccessibility = () => {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      // Add form labels
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        const label = form.querySelector(`label[for="${input.id}"]`);
        if (!label && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
          const placeholder = input.getAttribute('placeholder');
          if (placeholder) {
            input.setAttribute('aria-label', placeholder);
          }
        }
        
        // Add required indicator
        if (input.hasAttribute('required')) {
          input.setAttribute('aria-required', 'true');
        }
        
        // Add error handling
        input.addEventListener('invalid', (e) => {
          const errorMessage = e.target.validationMessage;
          announceToScreenReader(`Error: ${errorMessage}`);
        });
      });
    });
  };

  const enhanceButtonAccessibility = () => {
    const buttons = document.querySelectorAll('button, [role="button"]');
    
    buttons.forEach(button => {
      // Ensure buttons have accessible names
      if (!button.textContent.trim() && 
          !button.getAttribute('aria-label') && 
          !button.getAttribute('aria-labelledby')) {
        const icon = button.querySelector('svg, i');
        if (icon) {
          button.setAttribute('aria-label', 'Botón');
        }
      }
      
      // Add loading state
      const originalClick = button.onclick;
      button.onclick = function(e) {
        if (this.disabled || this.getAttribute('aria-busy') === 'true') {
          e.preventDefault();
          return;
        }
        
        if (originalClick) {
          this.setAttribute('aria-busy', 'true');
          const result = originalClick.call(this, e);
          
          if (result instanceof Promise) {
            result.finally(() => {
              this.setAttribute('aria-busy', 'false');
            });
          } else {
            setTimeout(() => {
              this.setAttribute('aria-busy', 'false');
            }, 100);
          }
        }
      };
    });
  };

  const enhanceImageAccessibility = () => {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      // Add alt text for decorative images
      if (!img.getAttribute('alt')) {
        if (img.getAttribute('role') === 'presentation' || 
            img.classList.contains('decorative')) {
          img.setAttribute('alt', '');
        } else {
          img.setAttribute('alt', 'Imagen');
        }
      }
      
      // Handle broken images
      img.addEventListener('error', () => {
        img.setAttribute('aria-label', 'Imagen no disponible');
      });
    });
  };

  const enhanceTableAccessibility = () => {
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      // Add table caption if missing
      if (!table.querySelector('caption') && !table.getAttribute('aria-label')) {
        table.setAttribute('aria-label', 'Tabla de datos');
      }
      
      // Ensure headers are properly associated
      const headers = table.querySelectorAll('th');
      headers.forEach((header, index) => {
        if (!header.id) {
          header.id = `header-${Date.now()}-${index}`;
        }
      });
      
      const cells = table.querySelectorAll('td');
      cells.forEach(cell => {
        const headerCell = cell.parentElement.cells[0];
        if (headerCell && headerCell.tagName === 'TH' && !cell.getAttribute('headers')) {
          cell.setAttribute('headers', headerCell.id);
        }
      });
    });
  };

  const enhanceModalAccessibility = () => {
    const modals = document.querySelectorAll('[role="dialog"], .modal');
    
    modals.forEach(modal => {
      // Add aria-modal
      modal.setAttribute('aria-modal', 'true');
      
      // Add focus management
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const isVisible = modal.style.display !== 'none' && 
                            !modal.hidden && 
                            modal.offsetParent !== null;
            
            if (isVisible && !modal.dataset.focusTrapped) {
              window.ServiMapA11y?.saveLastFocus();
              const cleanup = window.ServiMapA11y?.trapFocus(modal);
              modal.dataset.focusTrapped = 'true';
              modal.dataset.cleanup = cleanup;
            } else if (!isVisible && modal.dataset.focusTrapped) {
              modal.dataset.cleanup?.();
              window.ServiMapA11y?.restoreLastFocus();
              modal.dataset.focusTrapped = 'false';
            }
          }
        });
      });
      
      observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    });
  };

  const applyAccessibilitySettings = (settings) => {
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.classList.toggle('large-text', settings.largeText);
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    document.documentElement.classList.toggle('screen-reader', settings.screenReader);
    document.documentElement.classList.toggle('tap-target-large', settings.tapTargetSize);
    
    // Apply focus indicators
    if (settings.focusIndicators) {
      document.documentElement.classList.add('enhanced-focus');
    }
    
    // Save settings
    localStorage.setItem('servimap_accessibility_settings', JSON.stringify(settings));
  };

  const toggleHighContrast = () => {
    const newValue = !accessibilitySettings.highContrast;
    setAccessibilitySettings(prev => ({ ...prev, highContrast: newValue }));
    applyHighContrast(newValue);
    announceToScreenReader(`Alto contraste ${newValue ? 'activado' : 'desactivado'}`);
  };

  const toggleLargeText = () => {
    const newValue = !accessibilitySettings.largeText;
    setAccessibilitySettings(prev => ({ ...prev, largeText: newValue }));
    applyLargeText(newValue);
    announceToScreenReader(`Texto grande ${newValue ? 'activado' : 'desactivado'}`);
  };

  const toggleReducedMotion = () => {
    const newValue = !accessibilitySettings.reducedMotion;
    setAccessibilitySettings(prev => ({ ...prev, reducedMotion: newValue }));
    applyReducedMotion(newValue);
    announceToScreenReader(`Movimiento reducido ${newValue ? 'activado' : 'desactivado'}`);
  };

  const applyHighContrast = (enabled) => {
    document.documentElement.classList.toggle('high-contrast', enabled);
  };

  const applyLargeText = (enabled) => {
    document.documentElement.classList.toggle('large-text', enabled);
  };

  const applyReducedMotion = (enabled) => {
    document.documentElement.classList.toggle('reduced-motion', enabled);
  };

  const announceToScreenReader = (message) => {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  };

  const closeAllModals = () => {
    const modals = document.querySelectorAll('[role="dialog"]:not([hidden]), .modal:not([hidden])');
    modals.forEach(modal => {
      const closeButton = modal.querySelector('[aria-label*="cerrar"], [aria-label*="close"], .close');
      if (closeButton) {
        closeButton.click();
      }
    });
  };

  const calculateAccessibilityScore = () => {
    const checks = [
      document.documentElement.lang !== '',
      document.querySelector('h1') !== null,
      document.getElementById('aria-live-region') !== null,
      document.querySelector('.skip-link') !== null,
      document.querySelectorAll('img[alt]').length > 0,
      document.querySelectorAll('button[aria-label]').length > 0,
      document.querySelectorAll('[role]').length > 0
    ];
    
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    setAccessibilityScore(score);
  };

  // Accessibility panel component
  const AccessibilityPanel = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" role="dialog" aria-labelledby="a11y-title">
        <div className="p-6">
          <h2 id="a11y-title" className="text-xl font-bold mb-4">Configuración de Accesibilidad</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Alto contraste</span>
              </label>
              <button
                onClick={toggleHighContrast}
                className={`w-12 h-6 rounded-full ${accessibilitySettings.highContrast ? 'bg-blue-500' : 'bg-gray-300'}`}
                aria-pressed={accessibilitySettings.highContrast}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${accessibilitySettings.highContrast ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>Texto grande</span>
              </label>
              <button
                onClick={toggleLargeText}
                className={`w-12 h-6 rounded-full ${accessibilitySettings.largeText ? 'bg-blue-500' : 'bg-gray-300'}`}
                aria-pressed={accessibilitySettings.largeText}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${accessibilitySettings.largeText ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <Hand className="w-5 h-5" />
                <span>Reducir movimiento</span>
              </label>
              <button
                onClick={toggleReducedMotion}
                className={`w-12 h-6 rounded-full ${accessibilitySettings.reducedMotion ? 'bg-blue-500' : 'bg-gray-300'}`}
                aria-pressed={accessibilitySettings.reducedMotion}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${accessibilitySettings.reducedMotion ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">Atajos de teclado:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>Alt + 1: Alto contraste</li>
              <li>Alt + 2: Texto grande</li>
              <li>Alt + 3: Reducir movimiento</li>
              <li>Alt + A: Abrir panel</li>
            </ul>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowA11yPanel(false)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Accessibility floating button */}
      <button
        onClick={() => setShowA11yPanel(true)}
        className="fixed bottom-4 left-4 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 z-40"
        aria-label="Abrir configuración de accesibilidad"
        title="Configuración de accesibilidad (Alt + A)"
      >
        <Settings className="w-6 h-6" />
      </button>
      
      {/* Accessibility panel */}
      {showA11yPanel && <AccessibilityPanel />}
      
      {/* Development accessibility monitor */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 left-4 bg-white rounded-lg shadow-xl p-3 max-w-xs z-40">
          <div className="flex items-center space-x-2 mb-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="font-semibold">A11y Score</span>
            <span className={`ml-auto text-lg font-bold ${
              accessibilityScore >= 80 ? 'text-green-500' : 
              accessibilityScore >= 60 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {accessibilityScore}%
            </span>
          </div>
          <div className="text-xs text-gray-600">
            <p>Atajos: Alt+1/2/3, Alt+A</p>
            <p>Tab para navegación</p>
          </div>
        </div>
      )}
      
      {/* CSS for accessibility features */}
      <style jsx global>{`
        .high-contrast {
          filter: contrast(150%) brightness(1.2);
        }
        
        .large-text {
          font-size: 1.2em !important;
        }
        
        .large-text * {
          font-size: inherit !important;
        }
        
        .reduced-motion * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
        
        .tap-target-large button,
        .tap-target-large a,
        .tap-target-large [role="button"] {
          min-height: 44px !important;
          min-width: 44px !important;
        }
        
        .enhanced-focus *:focus {
          outline: 3px solid #3B82F6 !important;
          outline-offset: 2px !important;
        }
        
        .reduced-transparency {
          --tw-bg-opacity: 1 !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        
        @media (prefers-contrast: high) {
          * {
            filter: contrast(150%);
          }
        }
      `}</style>
    </>
  );
};

export default AccessibilityEnhancer;