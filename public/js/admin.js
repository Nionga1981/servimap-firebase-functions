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
    
    console.log('🔧 Intentando login con:', email);
    
    try {
        // Sign in with Firebase Auth
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('✅ Login exitoso, UID:', user.uid);
        console.log('📧 Email:', user.email);
        
        // Check if user is admin
        await checkAdminStatus(user);
        
    } catch (error) {
        console.error('❌ Error de login:', error);
        console.log('Código de error:', error.code);
        console.log('Mensaje:', error.message);
        errorDiv.textContent = getErrorMessage(error.code);
        errorDiv.style.display = 'block';
    }
}

// Check if user has admin privileges
async function checkAdminStatus(user) {
    try {
        console.log('🔍 Verificando permisos de admin para UID:', user.uid);
        
        // Get user's custom claims
        const idTokenResult = await user.getIdTokenResult();
        let isAdmin = idTokenResult.claims.admin || false;
        
        console.log('🔐 Custom claims encontrados:', JSON.stringify(idTokenResult.claims, null, 2));
        console.log('🔐 isAdmin desde custom claims:', isAdmin);
        
        // FALLBACK: If no custom claims, check Firestore document
        if (!isAdmin) {
            console.log('⚠️ No hay custom claims, verificando Firestore...');
            try {
                const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
                console.log('📄 Documento existe en Firestore:', userDoc.exists);
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    console.log('📄 Datos del documento:', JSON.stringify(userData, null, 2));
                    isAdmin = userData.isAdmin === true || userData.role === 'admin';
                    console.log('✅ Verificación de admin via Firestore:', isAdmin);
                }
            } catch (firestoreError) {
                console.log('⚠️ Error verificando Firestore:', firestoreError.message);
            }
        }
        
        console.log('🎯 Resultado final - isAdmin:', isAdmin);
        
        if (isAdmin) {
            console.log('🎉 Usuario es admin, mostrando panel...');
            // User is admin, show admin panel
            hideAdminLogin();
            showAdminPanel();
            loadAdminData();
        } else {
            console.log('❌ Usuario NO es admin');
            // User is not admin
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = 'No tienes permisos de administrador';
            errorDiv.style.display = 'block';
            
            // Sign out non-admin user
            await firebase.auth().signOut();
        }
        
    } catch (error) {
        console.error('❌ Error checking admin status:', error);
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
        console.log('📊 Cargando datos reales del dashboard...');
        
        // Show loading state
        document.getElementById('total-users').textContent = 'Cargando...';
        document.getElementById('total-services').textContent = 'Cargando...';
        document.getElementById('avg-rating').textContent = 'Cargando...';
        document.getElementById('total-revenue').textContent = 'Cargando...';
        
        // Call temporary HTTP endpoint to get admin stats
        try {
            const response = await fetch('https://us-central1-servimap-nyniz.cloudfunctions.net/interpretarBusqueda', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    searchQuery: 'GET_ADMIN_STATS_TEMP'
                })
            });
            
            const result = await response.json();
            const stats = result.stats;
            
            console.log('✅ Estadísticas recibidas:', stats);
            
            // Update UI with real data
            document.getElementById('total-users').textContent = stats.totalUsers.toLocaleString();
            document.getElementById('total-services').textContent = stats.totalServices.toLocaleString();
            document.getElementById('avg-rating').textContent = stats.avgRating.toFixed(1);
            document.getElementById('total-revenue').textContent = `$${stats.totalRevenue.toLocaleString()}`;
            
            // Update additional metrics if elements exist
            const activeUsersEl = document.getElementById('active-users');
            if (activeUsersEl) activeUsersEl.textContent = stats.activeUsers.toLocaleString();
            
            const activeProvidersEl = document.getElementById('active-providers');
            if (activeProvidersEl) activeProvidersEl.textContent = stats.activeProviders.toLocaleString();
            
            const completionRateEl = document.getElementById('completion-rate');
            if (completionRateEl) completionRateEl.textContent = `${stats.completionRate}%`;
            
            const emergencyServicesEl = document.getElementById('emergency-services');
            if (emergencyServicesEl) emergencyServicesEl.textContent = stats.emergencyServices.toLocaleString();
            
        } catch (functionError) {
            console.error('❌ Error calling getAdminStats:', functionError);
            
            // Show error in UI
            document.getElementById('total-users').textContent = 'Error';
            document.getElementById('total-services').textContent = 'Error';
            document.getElementById('avg-rating').textContent = 'Error';
            document.getElementById('total-revenue').textContent = 'Error';
            
            // Show user-friendly error
            alert('Error cargando estadísticas. Verifica tu conexión e inténtalo de nuevo.');
        }
        
    } catch (error) {
        console.error('❌ Error general loading admin data:', error);
    }
}

// Admin action functions
async function viewUsers() {
    try {
        console.log('👥 Obteniendo lista de usuarios...');
        
        const getUsersFunction = firebase.functions().httpsCallable('getUsers');
        const result = await getUsersFunction({ limit: 100, type: 'all' });
        
        const users = result.data.users;
        console.log('✅ Usuarios obtenidos:', users.length);
        
        // Create a simple table to display users
        let usersList = 'USUARIOS DEL SISTEMA:\n\n';
        users.forEach((user, index) => {
            usersList += `${index + 1}. ${user.nombre || user.email || 'Sin nombre'} (${user.type})\n`;
        });
        
        alert(usersList);
        
    } catch (error) {
        console.error('❌ Error obteniendo usuarios:', error);
        alert('Error al obtener la lista de usuarios. Verifica los permisos.');
    }
}

function moderateContent() {
    // This could redirect to the existing moderation panel
    window.open('/admin-moderacion.html', '_blank');
}

async function viewAnalytics() {
    try {
        console.log('📈 Obteniendo reporte de analytics...');
        
        const getAnalyticsFunction = firebase.functions().httpsCallable('getAnalyticsReport');
        const result = await getAnalyticsFunction({ dateRange: 30 });
        
        const analytics = result.data.analytics;
        console.log('✅ Analytics obtenidos:', analytics);
        
        let analyticsReport = `REPORTE DE ANALYTICS (Últimos ${analytics.dateRange} días):\n\n`;
        analyticsReport += `📊 Total Servicios: ${analytics.totalServices}\n`;
        analyticsReport += `💰 Ingresos Totales: $${analytics.totalRevenue.toLocaleString()}\n`;
        analyticsReport += `👥 Usuarios Activos: ${analytics.activeUsers}\n`;
        analyticsReport += `🏆 Top Prestadores: ${analytics.topProviders.length}\n\n`;
        
        if (analytics.topProviders.length > 0) {
            analyticsReport += 'TOP PRESTADORES:\n';
            analytics.topProviders.slice(0, 5).forEach((provider, index) => {
                analyticsReport += `${index + 1}. ID: ${provider.providerId} - ${provider.completedServices} servicios\n`;
            });
        }
        
        alert(analyticsReport);
        
    } catch (error) {
        console.error('❌ Error obteniendo analytics:', error);
        alert('Error al obtener analytics. Verifica los permisos.');
    }
}

async function exportData() {
    try {
        console.log('📥 Exportando datos del sistema...');
        
        const exportFunction = firebase.functions().httpsCallable('exportSystemData');
        const result = await exportFunction({ 
            format: 'json', 
            collections: ['usuarios', 'prestadores', 'service_requests'] 
        });
        
        const exportData = result.data;
        console.log('✅ Datos exportados:', exportData);
        
        // Create a downloadable JSON file
        const dataStr = JSON.stringify(exportData.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `servimap-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`Datos exportados exitosamente.\nArchivo: servimap-export-${new Date().toISOString().split('T')[0]}.json`);
        
    } catch (error) {
        console.error('❌ Error exportando datos:', error);
        alert('Error al exportar datos. Verifica los permisos.');
    }
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