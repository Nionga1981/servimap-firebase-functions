// ==================== ADMIN AUTHENTICATION & FUNCTIONALITY ====================

// Elements
const loadingScreen = document.getElementById('loading-screen');
const accessDenied = document.getElementById('access-denied');
const adminPanel = document.getElementById('admin-panel');
const adminEmail = document.getElementById('admin-email');
const logoutBtn = document.getElementById('logout-btn');

// Navigation elements
const navItems = document.querySelectorAll('.admin-nav__item');
const navLinks = document.querySelectorAll('.admin-nav__link');
const sections = document.querySelectorAll('.admin-section');

// Initialize Firebase Auth
let auth = null;
let db = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined') {
            clearInterval(checkFirebase);
            initializeFirebase();
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
        if (!auth) {
            showAccessDenied('Error al cargar Firebase. Por favor, recarga la página.');
        }
    }, 5000);
});

// Initialize Firebase
function initializeFirebase() {
    try {
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Check authentication state
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in
                await checkAdminRole(user);
            } else {
                // No user signed in
                showAccessDenied('Debes iniciar sesión para acceder al panel de administración.');
            }
        });
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showAccessDenied('Error al inicializar la aplicación.');
    }
}

// Check if user has admin role
async function checkAdminRole(user) {
    try {
        // First, try to get user document from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            if (userData.rol === 'admin' || userData.role === 'admin') {
                // User is admin
                showAdminPanel(user);
            } else {
                // User exists but is not admin
                showAccessDenied('No tienes permisos de administrador.');
            }
        } else {
            // User document doesn't exist, check if it's a known admin email
            const adminEmails = ['fernandobillard@gmail.com']; // Add admin emails here
            
            if (adminEmails.includes(user.email)) {
                // Create admin user document
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    rol: 'admin',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showAdminPanel(user);
            } else {
                showAccessDenied('No tienes permisos de administrador.');
            }
        }
    } catch (error) {
        console.error('Error checking admin role:', error);
        showAccessDenied('Error al verificar permisos.');
    }
}

// Show admin panel
function showAdminPanel(user) {
    loadingScreen.style.display = 'none';
    accessDenied.style.display = 'none';
    adminPanel.style.display = 'block';
    
    // Set user email in header
    adminEmail.textContent = user.email;
    
    // Load dashboard data
    loadDashboardData();
    
    // Initialize navigation
    initializeNavigation();
}

// Show access denied screen
function showAccessDenied(message) {
    loadingScreen.style.display = 'none';
    adminPanel.style.display = 'none';
    accessDenied.style.display = 'flex';
    
    if (message) {
        const infoElement = document.querySelector('.access-denied__info');
        infoElement.textContent = message;
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Get users count
        const usersSnapshot = await db.collection('users').get();
        updateStatNumber('users', usersSnapshot.size);
        
        // Get providers count
        const providersSnapshot = await db.collection('users')
            .where('tipoUsuario', '==', 'prestador')
            .get();
        updateStatNumber('providers', providersSnapshot.size);
        
        // Get business count
        const businessSnapshot = await db.collection('negocios').get();
        updateStatNumber('business', businessSnapshot.size);
        
        // Get transactions (this month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const transactionsSnapshot = await db.collection('pagos')
            .where('fecha', '>=', startOfMonth)
            .get();
        updateStatNumber('transactions', transactionsSnapshot.size);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Update stat number with animation
function updateStatNumber(type, value) {
    const statElements = document.querySelectorAll('.stat-number');
    let element;
    
    switch(type) {
        case 'users':
            element = statElements[0];
            break;
        case 'providers':
            element = statElements[1];
            break;
        case 'business':
            element = statElements[2];
            break;
        case 'transactions':
            element = statElements[3];
            break;
    }
    
    if (element) {
        animateNumber(element, value);
    }
}

// Animate number
function animateNumber(element, target) {
    const duration = 1000;
    const increment = target / (duration / 16);
    let current = 0;
    
    const updateNumber = () => {
        current += increment;
        if (current < target) {
            element.textContent = Math.floor(current).toLocaleString();
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = target.toLocaleString();
        }
    };
    
    updateNumber();
}

// Initialize navigation
function initializeNavigation() {
    navLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(item => item.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked item
            navItems[index].classList.add('active');
            
            // Show corresponding section
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

// Logout functionality
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = '/';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error al cerrar sesión. Por favor, intenta de nuevo.');
        }
    });
}

// Helper function to format dates
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}