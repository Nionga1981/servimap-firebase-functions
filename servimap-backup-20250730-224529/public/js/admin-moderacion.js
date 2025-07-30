// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCxmeIPNdlXrNGLVgNVVBDBKYBYocZaSwg",
    authDomain: "servimap-41222.firebaseapp.com",
    projectId: "servimap-41222",
    storageBucket: "servimap-41222.appspot.com",
    messagingSenderId: "851193848422",
    appId: "1:851193848422:web:2a967be90e4f6c31b56b64"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Estado de la aplicación
let currentFilter = 'all';
let moderationItems = [];
let stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
};

// Elementos del DOM
const elements = {
    pendingCount: document.getElementById('pendingCount'),
    identityCount: document.getElementById('identityCount'),
    statPending: document.getElementById('statPending'),
    statApproved: document.getElementById('statApproved'),
    statRejected: document.getElementById('statRejected'),
    statTotal: document.getElementById('statTotal'),
    moderationItems: document.getElementById('moderationItems'),
    detailModal: document.getElementById('detailModal'),
    modalBody: document.getElementById('modalBody')
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        // Verificar autenticación de admin
        const user = await new Promise((resolve) => {
            auth.onAuthStateChanged(resolve);
        });

        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        // Verificar permisos de admin
        const isAdmin = await checkAdminPermissions(user.uid);
        if (!isAdmin) {
            alert('No tienes permisos de administrador');
            window.location.href = '/';
            return;
        }

        // Configurar event listeners
        setupEventListeners();

        // Cargar datos
        await loadStatistics();
        await loadModerationQueue();

        // Configurar actualizaciones en tiempo real
        setupRealtimeListeners();

    } catch (error) {
        console.error('Error inicializando aplicación:', error);
        alert('Error al cargar el panel de administración');
    }
}

async function checkAdminPermissions(uid) {
    try {
        const adminDoc = await db.collection('admins').doc(uid).get();
        return adminDoc.exists;
    } catch (error) {
        console.error('Error verificando permisos:', error);
        return false;
    }
}

function setupEventListeners() {
    // Navegación del sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                switchSection(section);
            }
        });
    });

    // Filtros de la cola de moderación
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.dataset.filter;
            setActiveFilter(filter);
            filterModerationItems(filter);
        });
    });

    // Cerrar modal
    document.querySelector('.close-modal').addEventListener('click', closeModal);

    // Cerrar modal al hacer clic fuera
    elements.detailModal.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) {
            closeModal();
        }
    });
}

function switchSection(section) {
    // Actualizar navegación activa
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Por ahora solo manejamos la cola de moderación
    // En el futuro se pueden agregar más secciones
    if (section === 'queue') {
        loadModerationQueue();
    }
}

function setActiveFilter(filter) {
    currentFilter = filter;
    
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
}

async function loadStatistics() {
    try {
        // Obtener estadísticas del día actual
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Consultar elementos pendientes
        const pendingQuery = await db.collection('cola_moderacion')
            .where('estado', '==', 'pendiente')
            .get();
        
        stats.pending = pendingQuery.size;

        // Consultar elementos procesados hoy
        const processedTodayQuery = await db.collection('cola_moderacion')
            .where('fechaCreacion', '>=', today)
            .get();

        let approvedToday = 0;
        let rejectedToday = 0;
        let totalToday = 0;

        processedTodayQuery.forEach(doc => {
            const data = doc.data();
            totalToday++;
            
            if (data.estado === 'aprobado') {
                approvedToday++;
            } else if (data.estado === 'rechazado') {
                rejectedToday++;
            }
        });

        stats.approved = approvedToday;
        stats.rejected = rejectedToday;
        stats.total = totalToday;

        // Actualizar UI
        updateStatsUI();

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function updateStatsUI() {
    elements.statPending.textContent = stats.pending;
    elements.statApproved.textContent = stats.approved;
    elements.statRejected.textContent = stats.rejected;
    elements.statTotal.textContent = stats.total;
    
    elements.pendingCount.textContent = stats.pending;
    
    // Contador específico para verificaciones de identidad
    const identityCount = moderationItems.filter(item => 
        item.tipo === 'verificacion_identidad' && item.estado === 'pendiente'
    ).length;
    elements.identityCount.textContent = identityCount;
}

async function loadModerationQueue() {
    try {
        elements.moderationItems.innerHTML = `
            <div class="loading">
                <span class="loading-spinner"></span>
                Cargando elementos de moderación...
            </div>
        `;

        // Obtener elementos de la cola de moderación
        const querySnapshot = await db.collection('cola_moderacion')
            .orderBy('fechaCreacion', 'desc')
            .limit(50)
            .get();

        moderationItems = [];
        querySnapshot.forEach(doc => {
            moderationItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Renderizar elementos
        renderModerationItems(moderationItems);

    } catch (error) {
        console.error('Error cargando cola de moderación:', error);
        elements.moderationItems.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">error</span>
                <p>Error al cargar los elementos de moderación</p>
            </div>
        `;
    }
}

function filterModerationItems(filter) {
    let filteredItems = moderationItems;

    if (filter !== 'all') {
        if (filter === 'alta') {
            filteredItems = moderationItems.filter(item => item.prioridad === 'alta');
        } else {
            filteredItems = moderationItems.filter(item => item.tipo === filter);
        }
    }

    renderModerationItems(filteredItems);
}

function renderModerationItems(items) {
    if (items.length === 0) {
        elements.moderationItems.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">check_circle</span>
                <p>No hay elementos que requieran moderación</p>
            </div>
        `;
        return;
    }

    const itemsHTML = items.map(item => createModerationItemHTML(item)).join('');
    elements.moderationItems.innerHTML = itemsHTML;

    // Agregar event listeners para las acciones
    setupItemEventListeners();
}

function createModerationItemHTML(item) {
    const typeLabels = {
        'verificacion_identidad': 'Verificación',
        'contenido_prestador': 'Contenido',
        'imagen': 'Imagen',
        'mensaje_chat': 'Mensaje'
    };

    const priorityClass = item.prioridad || 'media';
    const typeClass = item.tipo;
    const createdDate = item.fechaCreacion?.toDate?.() || new Date();

    let previewContent = '';
    let description = 'Sin descripción disponible';

    // Generar contenido específico según el tipo
    switch (item.tipo) {
        case 'verificacion_identidad':
            description = `Documento ${item.datos?.tipoDocumento || 'desconocido'} de ${item.datos?.pais || 'país desconocido'}`;
            previewContent = '<span class="material-icons">assignment_ind</span>';
            break;
        case 'contenido_prestador':
            description = 'Contenido de prestador requiere revisión manual';
            previewContent = '<span class="material-icons">person</span>';
            break;
        case 'imagen':
            description = `Imagen ${item.datos?.contexto || 'sin contexto'}`;
            if (item.datos?.imageUrl) {
                previewContent = `<img src="${item.datos.imageUrl}" alt="Preview" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                 <span class="material-icons" style="display:none;">image</span>`;
            } else {
                previewContent = '<span class="material-icons">image</span>';
            }
            break;
        case 'mensaje_chat':
            description = item.datos?.mensaje?.substring(0, 100) + '...' || 'Mensaje de chat';
            previewContent = '<span class="material-icons">chat</span>';
            break;
    }

    return `
        <div class="moderation-item" data-item-id="${item.id}">
            <div class="item-preview">
                ${previewContent}
            </div>
            <div class="item-content">
                <div class="item-header">
                    <div>
                        <span class="item-type ${typeClass}">${typeLabels[item.tipo] || item.tipo}</span>
                        <span class="item-priority ${priorityClass}">${item.prioridad || 'media'}</span>
                    </div>
                </div>
                <div class="item-description">${description}</div>
                <div class="item-details">
                    <div class="item-detail">
                        <span class="material-icons">schedule</span>
                        <span>${formatDate(createdDate)}</span>
                    </div>
                    ${item.datos?.usuarioId ? `
                        <div class="item-detail">
                            <span class="material-icons">person</span>
                            <span>Usuario: ${item.datos.usuarioId.substring(0, 8)}...</span>
                        </div>
                    ` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn btn-view" onclick="viewItemDetails('${item.id}')">
                        <span class="material-icons">visibility</span>
                        Ver detalles
                    </button>
                    <button class="btn btn-approve" onclick="approveItem('${item.id}')">
                        <span class="material-icons">check</span>
                        Aprobar
                    </button>
                    <button class="btn btn-reject" onclick="rejectItem('${item.id}')">
                        <span class="material-icons">close</span>
                        Rechazar
                    </button>
                </div>
            </div>
        </div>
    `;
}

function setupItemEventListeners() {
    // Los event listeners se manejan directamente en el HTML con onclick
    // para simplicidad, pero en producción se debería usar addEventListener
}

async function viewItemDetails(itemId) {
    const item = moderationItems.find(i => i.id === itemId);
    if (!item) return;

    const modalContent = createDetailModalContent(item);
    elements.modalBody.innerHTML = modalContent;
    elements.detailModal.classList.add('show');
}

function createDetailModalContent(item) {
    let content = `
        <div class="detail-section">
            <div class="detail-label">Tipo de elemento</div>
            <div class="detail-value">${item.tipo}</div>
        </div>
        
        <div class="detail-section">
            <div class="detail-label">Prioridad</div>
            <div class="detail-value">${item.prioridad || 'media'}</div>
        </div>
        
        <div class="detail-section">
            <div class="detail-label">Fecha de creación</div>
            <div class="detail-value">${formatDate(item.fechaCreacion?.toDate?.() || new Date())}</div>
        </div>
    `;

    // Agregar contenido específico según el tipo
    switch (item.tipo) {
        case 'verificacion_identidad':
            content += `
                <div class="detail-section">
                    <div class="detail-label">País</div>
                    <div class="detail-value">${item.datos?.pais || 'No especificado'}</div>
                </div>
                <div class="detail-section">
                    <div class="detail-label">Tipo de documento</div>
                    <div class="detail-value">${item.datos?.tipoDocumento || 'No especificado'}</div>
                </div>
                <div class="detail-section">
                    <div class="detail-label">Razón de revisión</div>
                    <div class="detail-value">${item.datos?.razon || 'Revisión manual requerida'}</div>
                </div>
            `;
            break;
            
        case 'imagen':
            content += `
                <div class="detail-section">
                    <div class="detail-label">Contexto</div>
                    <div class="detail-value">${item.datos?.contexto || 'Sin contexto'}</div>
                </div>
                <div class="detail-section">
                    <div class="detail-label">Razón</div>
                    <div class="detail-value">${item.datos?.razon || 'Revisión requerida'}</div>
                </div>
                ${item.datos?.imageUrl ? `
                    <div class="detail-section">
                        <div class="detail-label">Imagen</div>
                        <img src="${item.datos.imageUrl}" alt="Imagen a moderar" class="image-preview">
                    </div>
                ` : ''}
            `;
            break;
            
        case 'mensaje_chat':
            content += `
                <div class="detail-section">
                    <div class="detail-label">Mensaje original</div>
                    <div class="detail-value">${item.datos?.mensaje || 'No disponible'}</div>
                </div>
                <div class="detail-section">
                    <div class="detail-label">Servicio ID</div>
                    <div class="detail-value">${item.datos?.serviceId || 'No disponible'}</div>
                </div>
                <div class="detail-section">
                    <div class="detail-label">Razón</div>
                    <div class="detail-value">${item.datos?.razon || 'Contenido inapropiado detectado'}</div>
                </div>
            `;
            break;
            
        case 'contenido_prestador':
            content += `
                <div class="detail-section">
                    <div class="detail-label">Prestador ID</div>
                    <div class="detail-value">${item.datos?.prestadorId || 'No disponible'}</div>
                </div>
                <div class="detail-section">
                    <div class="detail-label">Resultados de moderación</div>
                    <div class="detail-value">
                        ${item.datos?.resultados ? 
                            item.datos.resultados.map(r => 
                                `${r.tipo}: ${r.resultado.aprobado ? 'Aprobado' : 'Rechazado'} - ${r.resultado.razon || 'Sin razón'}`
                            ).join('<br>') 
                            : 'No disponible'}
                    </div>
                </div>
            `;
            break;
    }

    return content;
}

async function approveItem(itemId) {
    if (!confirm('¿Estás seguro de que quieres aprobar este elemento?')) {
        return;
    }

    try {
        await db.collection('cola_moderacion').doc(itemId).update({
            estado: 'aprobado',
            revisadoPor: auth.currentUser.uid,
            fechaRevision: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Actualizar UI
        await loadModerationQueue();
        await loadStatistics();
        
        showNotification('Elemento aprobado correctamente', 'success');

    } catch (error) {
        console.error('Error aprobando elemento:', error);
        showNotification('Error al aprobar el elemento', 'error');
    }
}

async function rejectItem(itemId) {
    const razon = prompt('Razón del rechazo (opcional):');
    
    if (!confirm('¿Estás seguro de que quieres rechazar este elemento?')) {
        return;
    }

    try {
        await db.collection('cola_moderacion').doc(itemId).update({
            estado: 'rechazado',
            razonRechazo: razon || 'Sin razón especificada',
            revisadoPor: auth.currentUser.uid,
            fechaRevision: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Actualizar UI
        await loadModerationQueue();
        await loadStatistics();
        
        showNotification('Elemento rechazado', 'success');

    } catch (error) {
        console.error('Error rechazando elemento:', error);
        showNotification('Error al rechazar el elemento', 'error');
    }
}

function closeModal() {
    elements.detailModal.classList.remove('show');
}

function setupRealtimeListeners() {
    // Escuchar cambios en la cola de moderación
    db.collection('cola_moderacion')
        .where('estado', '==', 'pendiente')
        .onSnapshot((snapshot) => {
            if (!snapshot.metadata.hasPendingWrites) {
                loadModerationQueue();
                loadStatistics();
            }
        });
}

function formatDate(date) {
    if (!date) return 'Fecha no disponible';
    
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
        return 'Hace menos de 1 hora';
    } else if (diffHours < 24) {
        return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
        return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else {
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function showNotification(message, type = 'info') {
    // Crear una notificación temporal
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--secondary)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 1001;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Eliminar después de 3 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Hacer funciones globales para usar en onclick
window.viewItemDetails = viewItemDetails;
window.approveItem = approveItem;
window.rejectItem = rejectItem;