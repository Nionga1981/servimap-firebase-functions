import { StreamVideoClient, Call } from 'https://unpkg.com/@stream-io/video-client/dist/index.es.js';

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

// Variables globales
let streamClient = null;
let call = null;
let localStream = null;
let remoteStream = null;
let screenStream = null;
let serviceData = null;
let callTimer = null;
let callStartTime = null;

// Obtener parámetros de URL
const urlParams = new URLSearchParams(window.location.search);
const serviceId = urlParams.get('serviceId');
const callType = urlParams.get('type') || 'cotizacion';

// Elementos del DOM
const elements = {
    callType: document.getElementById('callType'),
    callTimer: document.getElementById('callTimer'),
    serviceName: document.getElementById('serviceName'),
    connectionStatus: document.getElementById('connectionStatus'),
    localVideo: document.getElementById('localVideo'),
    remoteVideo: document.getElementById('remoteVideo'),
    remoteVideoContainer: document.getElementById('remoteVideoContainer'),
    videoPlaceholder: document.getElementById('videoPlaceholder'),
    screenShareContainer: document.getElementById('screenShareContainer'),
    screenShareVideo: document.getElementById('screenShareVideo'),
    micBtn: document.getElementById('micBtn'),
    cameraBtn: document.getElementById('cameraBtn'),
    screenBtn: document.getElementById('screenBtn'),
    chatBtn: document.getElementById('chatBtn'),
    endBtn: document.getElementById('endBtn'),
    chatPanel: document.getElementById('chatPanel'),
    closeChatBtn: document.getElementById('closeChatBtn'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput')
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        // Verificar autenticación
        const user = await new Promise((resolve) => {
            auth.onAuthStateChanged(resolve);
        });

        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        if (!serviceId) {
            showError('ID de servicio no proporcionado');
            return;
        }

        // Cargar datos del servicio
        await loadServiceData();

        // Inicializar Stream Video
        await initializeStreamVideo(user);

        // Configurar event listeners
        setupEventListeners();

        // Unirse a la llamada
        await joinCall();

    } catch (error) {
        console.error('Error inicializando:', error);
        showError('Error al inicializar la videollamada');
    }
}

async function loadServiceData() {
    try {
        const serviceDoc = await db.collection('servicios').doc(serviceId).get();
        
        if (!serviceDoc.exists) {
            throw new Error('Servicio no encontrado');
        }

        serviceData = serviceDoc.data();
        
        // Actualizar UI con información del servicio
        elements.serviceName.textContent = serviceData.nombre || 'Servicio';
        elements.callType.textContent = callType === 'cotizacion' ? 'Cotización' : 'Servicio Online';

    } catch (error) {
        console.error('Error cargando servicio:', error);
        throw error;
    }
}

async function initializeStreamVideo(user) {
    try {
        const apiKey = 't9bm8kwcqcw6';
        
        // Obtener token del servicio
        const token = user.uid === serviceData.clienteId 
            ? serviceData.streamSessionTokenCliente 
            : serviceData.streamSessionTokenPrestador;

        if (!token) {
            throw new Error('Token de sesión no disponible');
        }

        // Inicializar cliente de Stream
        streamClient = new StreamVideoClient({
            apiKey,
            user: {
                id: user.uid,
                name: user.displayName || 'Usuario',
                image: user.photoURL
            },
            token
        });

        console.log('Stream Video inicializado');

    } catch (error) {
        console.error('Error inicializando Stream Video:', error);
        throw error;
    }
}

async function joinCall() {
    try {
        updateConnectionStatus('connecting', 'Conectando a la llamada...');

        const callId = serviceData.streamCallId;
        const callTypeStream = serviceData.streamCallType || 'default';

        if (!callId) {
            throw new Error('ID de llamada no disponible');
        }

        // Unirse a la llamada existente
        call = streamClient.call(callTypeStream, callId);
        await call.join();

        // Configurar streams de media
        await setupMediaStreams();

        // Escuchar eventos de la llamada
        setupCallEventListeners();

        updateConnectionStatus('connected', 'Conectado');
        startCallTimer();

    } catch (error) {
        console.error('Error uniéndose a la llamada:', error);
        updateConnectionStatus('error', 'Error al conectar');
        throw error;
    }
}

async function setupMediaStreams() {
    try {
        // Obtener stream local
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        elements.localVideo.srcObject = localStream;

        // Publicar stream en la llamada
        await call.camera.enable();
        await call.microphone.enable();

    } catch (error) {
        console.error('Error configurando media:', error);
        // Continuar sin video/audio si hay error
    }
}

function setupCallEventListeners() {
    // Participante se une
    call.on('call.session_participant_joined', (event) => {
        console.log('Participante se unió:', event.participant);
        handleParticipantJoined(event.participant);
    });

    // Participante se va
    call.on('call.session_participant_left', (event) => {
        console.log('Participante salió:', event.participant);
        handleParticipantLeft(event.participant);
    });

    // Track agregado
    call.on('call.track_added', (event) => {
        console.log('Track agregado:', event);
        handleTrackAdded(event);
    });

    // Llamada terminada
    call.on('call.ended', () => {
        console.log('Llamada terminada');
        handleCallEnded();
    });

    // Mensajes de chat
    call.on('call.message_new', (event) => {
        handleNewMessage(event.message);
    });
}

function handleParticipantJoined(participant) {
    if (participant.userId !== auth.currentUser.uid) {
        elements.videoPlaceholder.style.display = 'none';
        elements.remoteVideoContainer.style.display = 'block';
    }
}

function handleParticipantLeft(participant) {
    if (participant.userId !== auth.currentUser.uid) {
        elements.videoPlaceholder.style.display = 'flex';
        elements.remoteVideoContainer.style.display = 'none';
        elements.remoteVideo.srcObject = null;
    }
}

function handleTrackAdded(event) {
    const { track, participant } = event;
    
    if (participant.userId === auth.currentUser.uid) {
        return; // Es nuestro propio track
    }

    if (track.kind === 'video') {
        if (participant.isScreenSharing) {
            // Es compartir pantalla
            elements.screenShareContainer.style.display = 'flex';
            elements.screenShareVideo.srcObject = new MediaStream([track]);
        } else {
            // Es video de cámara
            if (!remoteStream) {
                remoteStream = new MediaStream();
                elements.remoteVideo.srcObject = remoteStream;
            }
            remoteStream.addTrack(track);
        }
    } else if (track.kind === 'audio' && remoteStream) {
        remoteStream.addTrack(track);
    }
}

function handleCallEnded() {
    updateConnectionStatus('error', 'Llamada finalizada');
    setTimeout(() => {
        window.location.href = `/servicio-detalle.html?id=${serviceId}`;
    }, 2000);
}

function setupEventListeners() {
    // Control de micrófono
    elements.micBtn.addEventListener('click', toggleMicrophone);
    
    // Control de cámara
    elements.cameraBtn.addEventListener('click', toggleCamera);
    
    // Compartir pantalla
    elements.screenBtn.addEventListener('click', toggleScreenShare);
    
    // Chat
    elements.chatBtn.addEventListener('click', () => {
        elements.chatPanel.classList.add('open');
    });
    
    elements.closeChatBtn.addEventListener('click', () => {
        elements.chatPanel.classList.remove('open');
    });
    
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            sendMessage(e.target.value.trim());
            e.target.value = '';
        }
    });
    
    // Terminar llamada
    elements.endBtn.addEventListener('click', endCall);
}

async function toggleMicrophone() {
    try {
        const isEnabled = await call.microphone.toggle();
        
        if (isEnabled) {
            elements.micBtn.classList.add('active');
            elements.micBtn.querySelector('.material-icons').textContent = 'mic';
        } else {
            elements.micBtn.classList.remove('active');
            elements.micBtn.querySelector('.material-icons').textContent = 'mic_off';
        }
    } catch (error) {
        console.error('Error toggling microphone:', error);
    }
}

async function toggleCamera() {
    try {
        const isEnabled = await call.camera.toggle();
        
        if (isEnabled) {
            elements.cameraBtn.classList.add('active');
            elements.cameraBtn.querySelector('.material-icons').textContent = 'videocam';
            elements.localVideo.style.display = 'block';
        } else {
            elements.cameraBtn.classList.remove('active');
            elements.cameraBtn.querySelector('.material-icons').textContent = 'videocam_off';
            elements.localVideo.style.display = 'none';
        }
    } catch (error) {
        console.error('Error toggling camera:', error);
    }
}

async function toggleScreenShare() {
    try {
        if (call.screenShare.isEnabled) {
            await call.screenShare.disable();
            elements.screenBtn.classList.remove('active');
            elements.screenBtn.querySelector('.material-icons').textContent = 'screen_share';
        } else {
            await call.screenShare.enable();
            elements.screenBtn.classList.add('active');
            elements.screenBtn.querySelector('.material-icons').textContent = 'stop_screen_share';
        }
    } catch (error) {
        console.error('Error compartiendo pantalla:', error);
        alert('No se pudo compartir la pantalla');
    }
}

async function sendMessage(text) {
    try {
        // Moderar mensaje antes de enviarlo
        const moderarFn = functions.httpsCallable('moderarMensajeChat');
        const moderationResult = await moderarFn({
            mensaje: text,
            serviceId: serviceId
        });

        if (!moderationResult.data.aprobado) {
            // Mostrar mensaje de moderación al usuario
            showModerationMessage(moderationResult.data.razon);
            return;
        }

        // Si está aprobado, enviar el mensaje
        const mensajeAprobado = moderationResult.data.mensajeModificado || text;
        
        await call.sendMessage({
            text: mensajeAprobado,
            custom: {
                timestamp: new Date().toISOString(),
                original: text !== mensajeAprobado ? text : undefined
            }
        });
        
        // Agregar mensaje propio a la UI
        addMessageToUI({
            text: mensajeAprobado,
            user: {
                id: auth.currentUser.uid,
                name: 'Tú'
            }
        });
        
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        showModerationMessage('Error al enviar el mensaje');
    }
}

function showModerationMessage(razon) {
    const messagesContainer = elements.chatMessages;
    const moderationEl = document.createElement('div');
    moderationEl.className = 'message system-message';
    moderationEl.style.cssText = `
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid var(--danger);
        color: var(--danger);
        text-align: center;
        margin: 8px 0;
    `;
    
    moderationEl.innerHTML = `
        <span class="material-icons" style="font-size: 16px; vertical-align: middle;">warning</span>
        <span style="margin-left: 8px;">${razon}</span>
    `;
    
    messagesContainer.appendChild(moderationEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Eliminar el mensaje después de 5 segundos
    setTimeout(() => {
        if (moderationEl.parentNode) {
            moderationEl.remove();
        }
    }, 5000);
}

function handleNewMessage(message) {
    if (message.user.id !== auth.currentUser.uid) {
        addMessageToUI(message);
    }
}

function addMessageToUI(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.user.id === auth.currentUser.uid ? 'own' : 'other'}`;
    
    messageEl.innerHTML = `
        <div class="message-author">${message.user.name || 'Usuario'}</div>
        <div class="message-text">${message.text}</div>
    `;
    
    elements.chatMessages.appendChild(messageEl);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function endCall() {
    if (confirm('¿Estás seguro de que quieres terminar la llamada?')) {
        try {
            // Llamar a Cloud Function para terminar la videollamada
            const terminarFn = functions.httpsCallable('terminarVideollamada');
            await terminarFn({ serviceId });
            
            // Salir de la llamada
            if (call) {
                await call.leave();
            }
            
            // Redirigir
            window.location.href = `/servicio-detalle.html?id=${serviceId}`;
            
        } catch (error) {
            console.error('Error terminando llamada:', error);
            alert('Error al terminar la llamada');
        }
    }
}

function updateConnectionStatus(status, message) {
    const statusEl = elements.connectionStatus;
    
    statusEl.className = `connection-status ${status}`;
    statusEl.innerHTML = `
        ${status === 'connecting' ? '<span class="loading-spinner"></span>' : ''}
        ${status === 'connected' ? '<span class="material-icons">check_circle</span>' : ''}
        ${status === 'error' ? '<span class="material-icons">error</span>' : ''}
        <span>${message}</span>
    `;
    
    if (status === 'connected') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

function startCallTimer() {
    callStartTime = Date.now();
    
    callTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        elements.callTimer.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function showError(message) {
    updateConnectionStatus('error', message);
}