/**
 * ServiMap Landing Page JavaScript
 * Modern, optimized, and accessible interactions
 */

// ==================== GLOBALS & CONSTANTS ====================
const CONSTANTS = {
    SCROLL_THRESHOLD: 100,
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 300,
    API_BASE_URL: 'https://us-central1-servimap-nyniz.cloudfunctions.net',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

const STATE = {
    isMenuOpen: false,
    currentTab: 'client',
    isSearching: false,
    userLocation: null,
    searchTimeout: null
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Debounce function to limit function calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for scroll events
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Cargando...') {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        const loadingText = overlay.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

/**
 * Show error message
 */
function showError(message, element = null) {
    if (element) {
        element.style.display = 'block';
        element.textContent = message;
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    } else {
        console.error(message);
        // Could integrate with a toast system here
    }
}

/**
 * Animate element into view
 */
function animateOnScroll() {
    const elements = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => observer.observe(el));
}

// ==================== NAVIGATION ====================

/**
 * Initialize navigation functionality
 */
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect on navbar
    const handleScroll = throttle(() => {
        if (window.scrollY > CONSTANTS.SCROLL_THRESHOLD) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
    }, 100);

    window.addEventListener('scroll', handleScroll);

    // Mobile menu toggle
    navToggle?.addEventListener('click', toggleMobileMenu);
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (STATE.isMenuOpen && !navMenu?.contains(e.target) && !navToggle?.contains(e.target)) {
            closeMobileMenu();
        }
    });

    // Smooth scroll for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 80; // Account for fixed navbar
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                    closeMobileMenu();
                    updateActiveLink(link);
                }
            }
        });
    });

    // Update active link on scroll
    window.addEventListener('scroll', throttle(updateActiveNavigation, 100));
}

/**
 * Toggle mobile menu
 */
function toggleMobileMenu() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    
    STATE.isMenuOpen = !STATE.isMenuOpen;
    
    navMenu?.classList.toggle('active');
    navToggle?.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = STATE.isMenuOpen ? 'hidden' : 'auto';
}

/**
 * Close mobile menu
 */
function closeMobileMenu() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    
    STATE.isMenuOpen = false;
    navMenu?.classList.remove('active');
    navToggle?.classList.remove('active');
    document.body.style.overflow = 'auto';
}

/**
 * Update active navigation link
 */
function updateActiveNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let currentSection = '';
    const scrollPosition = window.scrollY + 100;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            currentSection = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
}

/**
 * Update active link manually
 */
function updateActiveLink(activeLink) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    activeLink.classList.add('active');
}

// ==================== SEARCH FUNCTIONALITY ====================

/**
 * Get current location
 */
async function getCurrentLocation() {
    const locationInput = document.getElementById('location-search');
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showError('Geolocalización no disponible en este navegador');
        return;
    }

    // Show loading state
    if (locationBtn) {
        locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        locationBtn.disabled = true;
    }

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            });
        });

        const { latitude, longitude } = position.coords;
        STATE.userLocation = { lat: latitude, lng: longitude };

        // Reverse geocoding to get address
        const address = await reverseGeocode(latitude, longitude);
        if (locationInput && address) {
            locationInput.value = address;
            locationInput.dispatchEvent(new Event('input')); // Trigger any input handlers
        }

    } catch (error) {
        console.error('Error getting location:', error);
        let errorMessage = 'No se pudo obtener la ubicación';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Permiso de ubicación denegado';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Ubicación no disponible';
                break;
            case error.TIMEOUT:
                errorMessage = 'Tiempo de espera agotado';
                break;
        }
        
        showError(errorMessage);
    } finally {
        // Reset button state
        if (locationBtn) {
            locationBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
            locationBtn.disabled = false;
        }
    }
}

/**
 * Reverse geocoding using a service
 */
async function reverseGeocode(lat, lng) {
    try {
        // Using a free geocoding service (you might want to use Google Maps API in production)
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`);
        const data = await response.json();
        
        if (data && data.city) {
            return `${data.city}, ${data.principalSubdivision || data.countryName}`;
        }
        
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Fallback to coordinates
    } catch (error) {
        console.error('Geocoding error:', error);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

/**
 * Perform search
 */
async function performSearch() {
    const serviceInput = document.getElementById('service-search');
    const locationInput = document.getElementById('location-search');
    
    const service = serviceInput?.value?.trim();
    const location = locationInput?.value?.trim();
    
    if (!service) {
        showError('Por favor ingresa el servicio que buscas');
        serviceInput?.focus();
        return;
    }
    
    if (!location) {
        showError('Por favor ingresa tu ubicación');
        locationInput?.focus();
        return;
    }

    // Show loading
    showLoading('Buscando profesionales...');
    
    try {
        // Simulate API call (replace with actual API endpoint)
        const searchParams = new URLSearchParams({
            service: service,
            location: location,
            lat: STATE.userLocation?.lat || '',
            lng: STATE.userLocation?.lng || ''
        });

        // Redirect to search results or open modal
        // For now, we'll just show a success message
        setTimeout(() => {
            hideLoading();
            openClientModal();
        }, 1500);
        
    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        showError('Error en la búsqueda. Inténtalo de nuevo.');
    }
}

/**
 * Search by category
 */
function searchCategory(category) {
    const serviceInput = document.getElementById('service-search');
    if (serviceInput) {
        serviceInput.value = category;
        serviceInput.focus();
    }
}

// ==================== TAB FUNCTIONALITY ====================

/**
 * Show tab content
 */
function showTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    activeBtn?.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const activeContent = document.getElementById(`tab-${tabName}`);
    activeContent?.classList.add('active');
    
    STATE.currentTab = tabName;
}

// ==================== MODAL FUNCTIONALITY ====================

/**
 * Open modal
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus first input
        const firstInput = modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

/**
 * Close modal
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        
        // Clear form inputs
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.type !== 'submit' && input.type !== 'button') {
                input.value = '';
            }
        });
        
        // Hide error messages
        const errorElements = modal.querySelectorAll('.error-message');
        errorElements.forEach(error => error.style.display = 'none');
    }
}

/**
 * Open client modal
 */
function openClientModal() {
    openModal('client-modal');
}

/**
 * Open provider modal
 */
function openProviderModal() {
    openModal('provider-modal');
}

/**
 * Redirect to provider signup
 */
function redirectToProviderSignup() {
    // You can replace this with the actual signup URL
    window.open('/provider-signup', '_blank');
}

/**
 * Open provider signup modal
 */
function openProviderSignup() {
    openProviderModal();
}

/**
 * View all services
 */
function viewAllServices() {
    // Scroll to services section or open services modal
    const servicesSection = document.getElementById('servicios');
    if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==================== ADMIN FUNCTIONALITY ====================

/**
 * Show admin login modal
 */
function showAdminLogin() {
    openModal('admin-login-modal');
}

/**
 * Initialize admin login form
 */
function initAdminLogin() {
    const form = document.getElementById('admin-login-form');
    const errorElement = document.getElementById('login-error');
    
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('admin-email')?.value;
        const password = document.getElementById('admin-password')?.value;
        
        if (!email || !password) {
            showError('Por favor completa todos los campos', errorElement);
            return;
        }
        
        showLoading('Verificando credenciales...');
        
        try {
            // Use Firebase Auth or your authentication system
            if (typeof firebase !== 'undefined' && firebase.auth) {
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Check if user is admin
                const token = await user.getIdTokenResult();
                if (token.claims.admin) {
                    // Redirect to admin panel
                    window.location.href = '/admin.html';
                } else {
                    throw new Error('No tienes permisos de administrador');
                }
            } else {
                throw new Error('Firebase no está disponible');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError(error.message || 'Error de autenticación', errorElement);
        } finally {
            hideLoading();
        }
    });
}

// ==================== PERFORMANCE OPTIMIZATIONS ====================

/**
 * Lazy load images
 */
function initLazyLoading() {
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
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

/**
 * Preload critical resources
 */
function preloadCriticalResources() {
    const criticalImages = [
        '/images/hero-illustration.svg',
        '/images/app-preview.png',
        '/images/logo.svg'
    ];

    criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });
}

// ==================== ANALYTICS & TRACKING ====================

/**
 * Track user interactions
 */
function trackEvent(eventName, properties = {}) {
    // Integrate with your analytics service (Google Analytics, Mixpanel, etc.)
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, properties);
    }
    
    console.log('Event tracked:', eventName, properties);
}

/**
 * Track CTA clicks
 */
function trackCTAClick(ctaType, location) {
    trackEvent('cta_click', {
        type: ctaType,
        location: location,
        timestamp: new Date().toISOString()
    });
}

// ==================== INITIALIZATION ====================

/**
 * Initialize all functionality when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Core functionality
    initNavigation();
    initAdminLogin();
    initLazyLoading();
    animateOnScroll();
    preloadCriticalResources();
    
    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                closeModal(activeModal.id);
            }
        }
    });
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    
    // Add smooth scroll behavior for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Initialize search functionality
    const searchBtn = document.querySelector('.search-btn');
    searchBtn?.addEventListener('click', performSearch);
    
    // Add enter key support for search
    const searchInputs = document.querySelectorAll('#service-search, #location-search');
    searchInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    });
    
    // Track page load
    trackEvent('page_view', {
        page: 'landing',
        referrer: document.referrer,
        user_agent: navigator.userAgent
    });
    
    console.log('ServiMap Landing Page initialized successfully');
});

// ==================== SERVICE WORKER REGISTRATION ====================

/**
 * Register service worker for PWA functionality
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker registered successfully:', registration.scope);
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    });
}

// ==================== ERROR HANDLING ====================

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    trackEvent('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

/**
 * Unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    trackEvent('promise_rejection', {
        reason: event.reason?.toString() || 'Unknown error'
    });
});

// ==================== EXPORTS FOR TESTING ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        performSearch,
        getCurrentLocation,
        showTab,
        openModal,
        closeModal,
        trackEvent
    };
}