// ==================== ADMIN FUNCTIONALITY ====================

// Show admin login modal
function showAdminLogin() {
    document.getElementById('admin-login-modal').style.display = 'flex';
}

// Hide admin login modal
function hideAdminLogin() {
    document.getElementById('admin-login-modal').style.display = 'none';
    document.getElementById('login-error').style.display = 'none';
}

// Initialize Firebase Auth listener
document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is available
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                checkAdminStatus(user);
            }
        });
    }
    
    // Admin login form handler
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleAdminLogin);
    }
});

// Handle admin login
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        // Sign in with Firebase Auth
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Check if user is admin
        await checkAdminStatus(user);
        
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = getErrorMessage(error.code);
        errorDiv.style.display = 'block';
    }
}

// Check if user has admin privileges
async function checkAdminStatus(user) {
    try {
        // Get user's custom claims
        const idTokenResult = await user.getIdTokenResult();
        const isAdmin = idTokenResult.claims.admin || false;
        
        if (isAdmin) {
            // User is admin, show admin panel
            hideAdminLogin();
            showAdminPanel();
            loadAdminData();
        } else {
            // User is not admin
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = 'No tienes permisos de administrador';
            errorDiv.style.display = 'block';
            
            // Sign out non-admin user
            await firebase.auth().signOut();
        }
        
    } catch (error) {
        console.error('Error checking admin status:', error);
        const errorDiv = document.getElementById('login-error');
        errorDiv.textContent = 'Error al verificar permisos';
        errorDiv.style.display = 'block';
    }
}

// Show admin panel
function showAdminPanel() {
    document.getElementById('admin-panel').style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

// Hide admin panel
function hideAdminPanel() {
    document.getElementById('admin-panel').style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scroll
}

// Logout function
async function logout() {
    try {
        await firebase.auth().signOut();
        hideAdminPanel();
        
        // Reset form
        document.getElementById('admin-email').value = '';
        document.getElementById('admin-password').value = '';
        
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Load admin dashboard data
async function loadAdminData() {
    try {
        // Simulate loading admin stats (replace with actual Firebase calls)
        document.getElementById('total-users').textContent = 'Cargando...';
        document.getElementById('total-services').textContent = 'Cargando...';
        document.getElementById('avg-rating').textContent = 'Cargando...';
        document.getElementById('total-revenue').textContent = 'Cargando...';
        
        // Call your Cloud Functions to get real data
        // Example:
        // const statsResponse = await fetch('/api/admin/stats');
        // const stats = await statsResponse.json();
        
        // For now, show sample data
        setTimeout(() => {
            document.getElementById('total-users').textContent = '1,234';
            document.getElementById('total-services').textContent = '567';
            document.getElementById('avg-rating').textContent = '4.8';
            document.getElementById('total-revenue').textContent = '$12,345';
        }, 1000);
        
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Admin action functions
function viewUsers() {
    alert('Funcionalidad de ver usuarios en desarrollo. Se integrará con las Cloud Functions existentes.');
}

function moderateContent() {
    // This could redirect to the existing moderation panel
    window.open('/admin-moderacion.html', '_blank');
}

function viewAnalytics() {
    alert('Funcionalidad de analytics en desarrollo. Se integrará con el sistema de reportes existente.');
}

function exportData() {
    alert('Funcionalidad de exportar datos en desarrollo.');
}

function systemSettings() {
    alert('Configuración del sistema en desarrollo.');
}

function systemLogs() {
    alert('Logs del sistema en desarrollo. Se integrará con Firebase Functions logs.');
}

// Helper function to get user-friendly error messages
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'Usuario no encontrado';
        case 'auth/wrong-password':
            return 'Contraseña incorrecta';
        case 'auth/invalid-email':
            return 'Email inválido';
        case 'auth/too-many-requests':
            return 'Demasiados intentos. Intenta más tarde';
        default:
            return 'Error de autenticación';
    }
}

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const modal = document.getElementById('admin-login-modal');
    if (e.target === modal) {
        hideAdminLogin();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // ESC to close modal
    if (e.key === 'Escape') {
        hideAdminLogin();
    }
    
    // Ctrl+Alt+A to open admin login (hidden shortcut)
    if (e.ctrlKey && e.altKey && e.key === 'a') {
        showAdminLogin();
    }
});