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
const functions = firebase.functions();
const storage = firebase.storage();

// Estado del formulario
let currentStep = 1;
const totalSteps = 9;
let formData = {
    nombre: '',
    idiomasDominados: ['español'],
    ubicacion: null,
    // Verificación de identidad
    paisResidencia: '',
    tipoDocumento: '',
    documentoIdentidadUrl: null,
    verificacionEstado: 'pendiente',
    // Servicio
    servicioDescripcion: '',
    categoriaSistema: '',
    serviciosItemizados: [],
    aceptaServiciosEnLinea: false,
    descripcionPerfil: '',
    fotosPortafolio: [],
    videoPresentacion: null,
    documentosVisibles: [],
    diasDisponibles: [],
    horarioDisponible: {},
    disponibilidadActiva: true
};

// Elementos del DOM
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const registroForm = document.getElementById('registroForm');

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);
prevBtn.addEventListener('click', previousStep);
nextBtn.addEventListener('click', nextStep);
submitBtn.addEventListener('click', submitForm);

// Inicializar aplicación
function initializeApp() {
    // Verificar autenticación
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        
        // Cargar nombre del usuario
        document.getElementById('nombre').value = user.displayName || '';
    });

    // Inicializar eventos específicos de cada paso
    initializeStepEvents();
    
    // Mostrar el primer paso
    showStep(1);
}

// Inicializar eventos de los pasos
function initializeStepEvents() {
    // Paso 1: Detectar ubicación
    document.getElementById('detectarUbicacion').addEventListener('click', detectarUbicacion);
    
    // Paso 2: Verificación de identidad
    document.getElementById('documentoIdentidadInput').addEventListener('change', handleDocumentoIdentidadUpload);
    
    // Paso 3: Detectar categoría al escribir
    const servicioDescripcion = document.getElementById('servicioDescripcion');
    let timeoutId;
    servicioDescripcion.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            if (e.target.value.length > 20) {
                detectarCategoria(e.target.value);
            }
        }, 500);
    });
    
    // Paso 4: Servicios itemizados
    document.getElementById('addServiceBtn').addEventListener('click', agregarServicio);
    agregarServicio(); // Agregar el primer servicio por defecto
    
    // Paso 6: Manejo de archivos
    document.getElementById('fotosInput').addEventListener('change', handleFotosUpload);
    document.getElementById('videoInput').addEventListener('change', handleVideoUpload);
    
    // Paso 7: Documentos
    document.getElementById('documentosInput').addEventListener('change', handleDocumentosUpload);
    
    // Paso 8: Días disponibles
    const dayCheckboxes = document.querySelectorAll('.day-checkbox input');
    dayCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateHorarios);
    });
}

// Navegación entre pasos
function showStep(step) {
    // Ocultar todas las secciones
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección actual
    document.querySelector(`[data-section="${step}"]`).classList.add('active');
    
    // Actualizar barra de progreso
    document.querySelectorAll('.progress-step').forEach((progressStep, index) => {
        if (index + 1 < step) {
            progressStep.classList.add('completed');
            progressStep.classList.remove('active');
        } else if (index + 1 === step) {
            progressStep.classList.add('active');
            progressStep.classList.remove('completed');
        } else {
            progressStep.classList.remove('active', 'completed');
        }
    });
    
    // Actualizar botones de navegación
    prevBtn.style.display = step === 1 ? 'none' : 'flex';
    nextBtn.style.display = step === totalSteps ? 'none' : 'flex';
    submitBtn.style.display = step === totalSteps ? 'flex' : 'none';
    
    currentStep = step;
    
    // Si es el último paso, generar vista previa
    if (step === 9) {
        generarVistaPrevia();
    }
}

function previousStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

function nextStep() {
    if (validateCurrentStep()) {
        saveCurrentStepData();
        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        }
    }
}

// Validación de cada paso
function validateCurrentStep() {
    let isValid = true;
    const errorElements = document.querySelectorAll('.form-error');
    errorElements.forEach(el => el.classList.remove('show'));
    
    switch (currentStep) {
        case 1:
            const nombre = document.getElementById('nombre').value.trim();
            if (!nombre) {
                showError('nombre', 'Por favor ingresa tu nombre completo');
                isValid = false;
            }
            
            const idiomasChecked = document.querySelectorAll('input[type="checkbox"][id^="idioma-"]:checked');
            if (idiomasChecked.length === 0) {
                alert('Debes seleccionar al menos un idioma');
                isValid = false;
            }
            break;
            
        case 2:
            const paisResidencia = document.getElementById('paisResidencia').value;
            const tipoDocumento = document.getElementById('tipoDocumento').value;
            
            if (!paisResidencia) {
                alert('Debes seleccionar tu país de residencia');
                isValid = false;
            }
            if (!tipoDocumento) {
                alert('Debes seleccionar el tipo de documento');
                isValid = false;
            }
            if (!formData.documentoIdentidadUrl) {
                alert('Debes subir tu documento de identidad');
                isValid = false;
            }
            break;

        case 3:
            const descripcion = document.getElementById('servicioDescripcion').value.trim();
            if (!descripcion || descripcion.length < 20) {
                showError('servicioDescripcion', 'La descripción debe tener al menos 20 caracteres');
                isValid = false;
            }
            break;
            
        case 4:
            const servicios = obtenerServiciosItemizados();
            if (servicios.length === 0) {
                alert('Debes agregar al menos un servicio con precio');
                isValid = false;
            }
            
            // Validar que todos los servicios tengan información completa
            for (let i = 0; i < servicios.length; i++) {
                if (!servicios[i].nombre || servicios[i].precio <= 0) {
                    alert(`El servicio ${i + 1} debe tener nombre y precio válido`);
                    isValid = false;
                    break;
                }
            }
            break;
            
        case 5:
            const descripcionPerfil = document.getElementById('descripcionPerfil').value.trim();
            if (!descripcionPerfil || descripcionPerfil.length < 100) {
                showError('descripcionPerfil', 'La descripción debe tener al menos 100 caracteres');
                isValid = false;
            }
            break;
            
        case 6:
            if (formData.fotosPortafolio.length < 3) {
                alert('Debes subir al menos 3 fotos de tu portafolio');
                isValid = false;
            }
            break;
            
        case 8:
            const diasSeleccionados = document.querySelectorAll('.day-checkbox input:checked');
            if (diasSeleccionados.length === 0) {
                alert('Debes seleccionar al menos un día de disponibilidad');
                isValid = false;
            }
            break;
            
        case 9:
            const aceptoTerminos = document.getElementById('aceptoTerminos').checked;
            if (!aceptoTerminos) {
                alert('Debes aceptar los términos y condiciones');
                isValid = false;
            }
            break;
    }
    
    return isValid;
}

// Guardar datos del paso actual
function saveCurrentStepData() {
    switch (currentStep) {
        case 1:
            formData.nombre = document.getElementById('nombre').value.trim();
            formData.idiomasDominados = Array.from(
                document.querySelectorAll('input[type="checkbox"][id^="idioma-"]:checked')
            ).map(cb => cb.value);
            break;
            
        case 2:
            formData.paisResidencia = document.getElementById('paisResidencia').value;
            formData.tipoDocumento = document.getElementById('tipoDocumento').value;
            break;
            
        case 3:
            formData.servicioDescripcion = document.getElementById('servicioDescripcion').value.trim();
            break;
            
        case 4:
            formData.serviciosItemizados = obtenerServiciosItemizados();
            formData.aceptaServiciosEnLinea = document.getElementById('aceptaServiciosEnLinea').checked;
            break;
            
        case 5:
            formData.descripcionPerfil = document.getElementById('descripcionPerfil').value.trim();
            break;
            
        case 8:
            const diasSeleccionados = Array.from(
                document.querySelectorAll('.day-checkbox input:checked')
            ).map(cb => cb.value);
            formData.diasDisponibles = diasSeleccionados;
            
            // Obtener horarios
            const horarios = {};
            diasSeleccionados.forEach(dia => {
                const inicio = document.querySelector(`input[data-dia="${dia}"][data-tipo="inicio"]`);
                const fin = document.querySelector(`input[data-dia="${dia}"][data-tipo="fin"]`);
                if (inicio && fin && inicio.value && fin.value) {
                    horarios[dia] = `${inicio.value}-${fin.value}`;
                }
            });
            formData.horarioDisponible = horarios;
            formData.disponibilidadActiva = document.getElementById('disponibilidadActiva').checked;
            break;
    }
}

// Funciones auxiliares
function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = field.parentElement.querySelector('.form-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
        field.focus();
    }
}

// Detectar ubicación
async function detectarUbicacion() {
    const btn = document.getElementById('detectarUbicacion');
    const status = document.getElementById('ubicacionStatus');
    
    btn.disabled = true;
    status.textContent = 'Detectando ubicación...';
    
    if (!navigator.geolocation) {
        status.textContent = 'La geolocalización no está soportada en tu navegador';
        btn.disabled = false;
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            formData.ubicacion = new firebase.firestore.GeoPoint(
                position.coords.latitude,
                position.coords.longitude
            );
            status.textContent = `Ubicación detectada: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
            status.style.color = 'var(--secondary)';
            btn.disabled = false;
        },
        (error) => {
            status.textContent = 'No se pudo detectar la ubicación. Puedes continuar sin ella.';
            status.style.color = 'var(--danger)';
            btn.disabled = false;
        }
    );
}

// Detectar categoría
async function detectarCategoria(descripcion) {
    try {
        const clasificarFn = functions.httpsCallable('clasificarCategoriaPorDescripcion');
        const result = await clasificarFn({ descripcion });
        
        if (result.data.success) {
            formData.categoriaSistema = result.data.categoria.nombre;
            
            const preview = document.getElementById('categoryPreview');
            const categoryValue = document.getElementById('categoryValue');
            
            categoryValue.textContent = result.data.categoria.nombre;
            preview.classList.add('show');
            
            // Mostrar nivel de confianza si está disponible
            if (result.data.categoria.confianza) {
                const confianzaColor = {
                    'alta': 'var(--secondary)',
                    'media': 'var(--warning)',
                    'baja': 'var(--danger)'
                };
                categoryValue.style.color = confianzaColor[result.data.categoria.confianza] || 'var(--gray-800)';
            }
        }
    } catch (error) {
        console.error('Error detectando categoría:', error);
    }
}

// Servicios itemizados
let serviceCount = 0;

function agregarServicio() {
    serviceCount++;
    const container = document.getElementById('serviciosContainer');
    
    const serviceItem = document.createElement('div');
    serviceItem.className = 'service-item';
    serviceItem.dataset.serviceId = serviceCount;
    
    serviceItem.innerHTML = `
        <div class="service-item-header">
            <span class="service-item-number">Servicio #${serviceCount}</span>
            ${serviceCount > 1 ? `
                <button type="button" class="remove-service" onclick="removerServicio(${serviceCount})">
                    <span class="material-icons">delete</span>
                    Eliminar
                </button>
            ` : ''}
        </div>
        
        <div class="form-group">
            <label class="form-label">
                Nombre del servicio <span class="required">*</span>
            </label>
            <input type="text" class="form-input" id="servicioNombre_${serviceCount}" 
                placeholder="Ej: Consulta psicológica individual" required>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
                <label class="form-label">
                    Precio <span class="required">*</span>
                </label>
                <input type="number" class="form-input" id="servicioPrecio_${serviceCount}" 
                    min="0" step="0.01" placeholder="600" required>
            </div>
            
            <div class="form-group">
                <label class="form-label">
                    Unidad de cobro <span class="required">*</span>
                </label>
                <select class="form-select" id="servicioUnidad_${serviceCount}" required>
                    <option value="por_servicio">Por servicio</option>
                    <option value="por_hora">Por hora</option>
                    <option value="por_dia">Por día</option>
                    <option value="por_proyecto">Por proyecto</option>
                </select>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">
                Tiempo estimado
            </label>
            <input type="text" class="form-input" id="servicioTiempo_${serviceCount}" 
                placeholder="Ej: 1 hora, 30 minutos, 2-3 días">
        </div>
        
        <div class="form-group">
            <label class="form-label">
                Descripción del servicio
            </label>
            <textarea class="form-textarea" id="servicioDescripcionDetalle_${serviceCount}" 
                rows="3" placeholder="Describe qué incluye este servicio..."></textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">
                <input type="checkbox" id="servicioOnline_${serviceCount}">
                Este servicio puede realizarse en línea
            </label>
        </div>
    `;
    
    container.appendChild(serviceItem);
}

function removerServicio(serviceId) {
    const serviceItem = document.querySelector(`[data-service-id="${serviceId}"]`);
    if (serviceItem) {
        serviceItem.remove();
    }
}

function obtenerServiciosItemizados() {
    const servicios = [];
    const serviceItems = document.querySelectorAll('.service-item');
    
    serviceItems.forEach(item => {
        const serviceId = item.dataset.serviceId;
        const nombre = document.getElementById(`servicioNombre_${serviceId}`).value.trim();
        const precio = parseFloat(document.getElementById(`servicioPrecio_${serviceId}`).value) || 0;
        const unidadCobro = document.getElementById(`servicioUnidad_${serviceId}`).value;
        const tiempoEstimado = document.getElementById(`servicioTiempo_${serviceId}`).value.trim();
        const descripcion = document.getElementById(`servicioDescripcionDetalle_${serviceId}`).value.trim();
        const disponibleOnline = document.getElementById(`servicioOnline_${serviceId}`).checked;
        
        if (nombre && precio > 0) {
            servicios.push({
                nombre,
                precio,
                unidadCobro,
                tiempoEstimado,
                descripcion,
                disponibleOnline
            });
        }
    });
    
    return servicios;
}

// Manejo del documento de identidad
async function handleDocumentoIdentidadUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const paisResidencia = document.getElementById('paisResidencia').value;
    const tipoDocumento = document.getElementById('tipoDocumento').value;

    if (!paisResidencia || !tipoDocumento) {
        alert('Primero selecciona el país y tipo de documento');
        event.target.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('El documento excede el tamaño máximo de 10MB');
        return;
    }

    const preview = document.getElementById('documentoIdentidadPreview');
    const estadoDiv = document.getElementById('verificacionEstado');
    
    preview.innerHTML = '<p>Subiendo documento...</p>';
    estadoDiv.style.display = 'none';

    try {
        // Subir a carpeta segura de documentos privados
        const url = await uploadSecureFile(file, 'documentos_identidad');
        formData.documentoIdentidadUrl = url;

        // Mostrar preview
        preview.innerHTML = `
            <div class="success-message">
                <span class="material-icons">description</span>
                <span>Documento subido correctamente</span>
            </div>
        `;

        // Verificar documento con IA
        await verificarDocumentoConIA(url, tipoDocumento, paisResidencia);

    } catch (error) {
        console.error('Error subiendo documento:', error);
        preview.innerHTML = `
            <div class="error-message">
                <span class="material-icons">error</span>
                <span>Error al subir el documento</span>
            </div>
        `;
    }
}

async function verificarDocumentoConIA(imageUrl, tipoDocumento, pais) {
    const estadoDiv = document.getElementById('verificacionEstado');
    
    try {
        estadoDiv.style.display = 'block';
        estadoDiv.innerHTML = `
            <div class="connection-status connecting">
                <span class="loading-spinner"></span>
                <span>Verificando documento con IA...</span>
            </div>
        `;

        const verificarFn = functions.httpsCallable('verificarDocumentoIdentidad');
        const result = await verificarFn({
            imageUrl,
            tipoDocumento,
            pais
        });

        formData.verificacionEstado = result.data.estado;

        // Mostrar resultado
        if (result.data.valido) {
            estadoDiv.innerHTML = `
                <div class="success-message">
                    <span class="material-icons">verified_user</span>
                    <div>
                        <strong>Documento verificado exitosamente</strong>
                        <p>Tu identidad ha sido validada automáticamente.</p>
                    </div>
                </div>
            `;
        } else if (result.data.requiereRevision) {
            estadoDiv.innerHTML = `
                <div class="connection-status" style="background: rgba(245, 158, 11, 0.2); border: 1px solid var(--warning);">
                    <span class="material-icons">pending</span>
                    <div>
                        <strong>Documento en revisión</strong>
                        <p>Nuestro equipo revisará tu documento en las próximas 24 horas.</p>
                    </div>
                </div>
            `;
        } else {
            estadoDiv.innerHTML = `
                <div class="error-message">
                    <span class="material-icons">error</span>
                    <div>
                        <strong>Documento no válido</strong>
                        <p>${result.data.razon || 'El documento no cumple con los requisitos.'}</p>
                        <p>Por favor, sube una imagen más clara o un documento diferente.</p>
                    </div>
                </div>
            `;
            
            // Limpiar el archivo para que puedan subir uno nuevo
            document.getElementById('documentoIdentidadInput').value = '';
            formData.documentoIdentidadUrl = null;
        }

    } catch (error) {
        console.error('Error verificando documento:', error);
        estadoDiv.innerHTML = `
            <div class="error-message">
                <span class="material-icons">error</span>
                <div>
                    <strong>Error en la verificación</strong>
                    <p>Hubo un problema al verificar el documento. Puedes continuar y será revisado manualmente.</p>
                </div>
            </div>
        `;
    }
}

async function uploadSecureFile(file, folder) {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    
    const timestamp = Date.now();
    const fileName = `${user.uid}/${folder}/${timestamp}_${file.name}`;
    const storageRef = storage.ref(`secure/${fileName}`);
    
    const snapshot = await storageRef.put(file);
    const url = await snapshot.ref.getDownloadURL();
    
    return url;
}

// Manejo de archivos públicos
async function handleFotosUpload(event) {
    const files = Array.from(event.target.files);
    const preview = document.getElementById('fotosPreview');
    
    // Validar cantidad total
    if (formData.fotosPortafolio.length + files.length > 5) {
        alert('Máximo 5 fotos permitidas');
        return;
    }
    
    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
            alert(`El archivo ${file.name} excede el tamaño máximo de 5MB`);
            continue;
        }
        
        // Crear preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = createFilePreview(e.target.result, file.name, 'foto');
            preview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
        
        // Subir a Storage
        try {
            const url = await uploadFile(file, 'portafolio');
            formData.fotosPortafolio.push(url);
        } catch (error) {
            console.error('Error subiendo foto:', error);
            alert(`Error al subir ${file.name}`);
        }
    }
}

async function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
        alert('El video excede el tamaño máximo de 50MB');
        return;
    }
    
    const preview = document.getElementById('videoPreview');
    preview.innerHTML = '<p>Subiendo video...</p>';
    
    try {
        const url = await uploadFile(file, 'videos');
        formData.videoPresentacion = url;
        preview.innerHTML = `
            <div class="success-message">
                <span class="material-icons">check_circle</span>
                <span>Video subido correctamente</span>
            </div>
        `;
    } catch (error) {
        console.error('Error subiendo video:', error);
        preview.innerHTML = `
            <div class="error-message">
                <span class="material-icons">error</span>
                <span>Error al subir el video</span>
            </div>
        `;
    }
}

async function handleDocumentosUpload(event) {
    const files = Array.from(event.target.files);
    const preview = document.getElementById('documentosPreview');
    
    for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
            alert(`El archivo ${file.name} excede el tamaño máximo de 10MB`);
            continue;
        }
        
        try {
            const url = await uploadFile(file, 'documentos');
            formData.documentosVisibles.push(url);
            
            const previewItem = document.createElement('div');
            previewItem.className = 'file-preview-item';
            previewItem.innerHTML = `
                <span class="material-icons">description</span>
                <span>${file.name}</span>
            `;
            preview.appendChild(previewItem);
        } catch (error) {
            console.error('Error subiendo documento:', error);
            alert(`Error al subir ${file.name}`);
        }
    }
}

function createFilePreview(src, name, type) {
    const item = document.createElement('div');
    item.className = 'file-preview-item';
    
    if (type === 'foto') {
        item.innerHTML = `
            <img src="${src}" alt="${name}">
            <button type="button" class="file-preview-remove" onclick="removePhoto(this)">
                <span class="material-icons">close</span>
            </button>
        `;
    }
    
    return item;
}

function removePhoto(button) {
    const item = button.parentElement;
    const index = Array.from(item.parentElement.children).indexOf(item);
    formData.fotosPortafolio.splice(index, 1);
    item.remove();
}

async function uploadFile(file, folder) {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    
    const timestamp = Date.now();
    const fileName = `${user.uid}/${folder}/${timestamp}_${file.name}`;
    const storageRef = storage.ref(fileName);
    
    const snapshot = await storageRef.put(file);
    const url = await snapshot.ref.getDownloadURL();
    
    return url;
}

// Horarios
function updateHorarios() {
    const diasSeleccionados = Array.from(
        document.querySelectorAll('.day-checkbox input:checked')
    ).map(cb => cb.value);
    
    const container = document.getElementById('horariosContainer');
    const inputsContainer = document.getElementById('horariosInputs');
    
    if (diasSeleccionados.length > 0) {
        container.style.display = 'block';
        inputsContainer.innerHTML = '';
        
        diasSeleccionados.forEach(dia => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'form-group';
            dayDiv.innerHTML = `
                <label class="form-label">${dia.charAt(0).toUpperCase() + dia.slice(1)}</label>
                <div class="time-inputs">
                    <input type="time" class="form-input" data-dia="${dia}" data-tipo="inicio" value="09:00">
                    <span class="time-separator">a</span>
                    <input type="time" class="form-input" data-dia="${dia}" data-tipo="fin" value="18:00">
                </div>
            `;
            inputsContainer.appendChild(dayDiv);
        });
    } else {
        container.style.display = 'none';
    }
}

// Vista previa final
function generarVistaPrevia() {
    const preview = document.getElementById('profilePreview');
    
    preview.innerHTML = `
        <div class="preview-field">
            <div class="preview-field-label">Nombre</div>
            <div class="preview-field-value">${formData.nombre}</div>
        </div>
        
        <div class="preview-field">
            <div class="preview-field-label">Categoría</div>
            <div class="preview-field-value">${formData.categoriaSistema}</div>
        </div>
        
        <div class="preview-field">
            <div class="preview-field-label">Idiomas</div>
            <div class="preview-field-value">${formData.idiomasDominados.join(', ')}</div>
        </div>
        
        <div class="preview-field">
            <div class="preview-field-label">Servicios</div>
            <div class="preview-field-value">
                ${formData.serviciosItemizados.map(s => 
                    `• ${s.nombre} - $${s.precio} ${s.unidadCobro}`
                ).join('<br>')}
            </div>
        </div>
        
        <div class="preview-field">
            <div class="preview-field-label">Servicios en línea</div>
            <div class="preview-field-value">${formData.aceptaServiciosEnLinea ? 'Sí' : 'No'}</div>
        </div>
        
        <div class="preview-field">
            <div class="preview-field-label">Fotos de portafolio</div>
            <div class="preview-field-value">${formData.fotosPortafolio.length} fotos</div>
        </div>
        
        <div class="preview-field">
            <div class="preview-field-label">Días disponibles</div>
            <div class="preview-field-value">${formData.diasDisponibles.join(', ')}</div>
        </div>
        
        <div class="preview-field">
            <div class="preview-field-label">Estado</div>
            <div class="preview-field-value">${formData.disponibilidadActiva ? 'Activo' : 'Inactivo'}</div>
        </div>
    `;
}

// Enviar formulario
async function submitForm() {
    if (!validateCurrentStep()) return;
    
    saveCurrentStepData();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Publicando perfil...';
    
    try {
        // Llamar a la Cloud Function
        const registrarFn = functions.httpsCallable('registrarPrestador');
        const result = await registrarFn({
            idiomasDominados: formData.idiomasDominados,
            descripcionPerfil: formData.descripcionPerfil,
            fotosPortafolio: formData.fotosPortafolio,
            videoPresentacion: formData.videoPresentacion,
            documentosVisibles: formData.documentosVisibles,
            serviciosItemizados: formData.serviciosItemizados,
            aceptaServiciosEnLinea: formData.aceptaServiciosEnLinea,
            ubicacion: formData.ubicacion,
            diasDisponibles: formData.diasDisponibles,
            horarioDisponible: formData.horarioDisponible
        });
        
        if (result.data.success) {
            // Mostrar mensaje de éxito
            const container = document.querySelector('.container');
            container.innerHTML = `
                <div class="success-message" style="margin-top: 40px;">
                    <span class="material-icons">check_circle</span>
                    <div>
                        <h2>¡Perfil publicado exitosamente!</h2>
                        <p>Tu perfil como prestador ha sido creado y está activo.</p>
                        <p>Categoría asignada: <strong>${result.data.categoria}</strong></p>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 32px;">
                    <a href="/dashboard-prestador.html" class="btn btn-primary">
                        Ir a mi panel
                    </a>
                </div>
            `;
        } else {
            throw new Error('Error al registrar prestador');
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al publicar el perfil. Por favor intenta nuevamente.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-icons">check</span> Publicar perfil';
    }
}