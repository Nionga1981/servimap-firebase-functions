const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { StreamClient } = require('@stream-io/node-sdk');

// Configuración de Stream Video desde variables de entorno
const config = functions.config();
const apiKey = config.stream?.api_key || 't9bm8kwcqcw6';
const apiSecret = config.stream?.secret || 'fzwr9zkd788qmk9n6vutemtn4eyar8a7vv8vk2kf3d75akrbudg69zzyfjeaawf3';
const appId = config.stream?.app_id || '1409820';

// Inicializar cliente de Stream
const streamClient = new StreamClient(apiKey, apiSecret);

/**
 * Crea una videollamada para cotización personalizada
 * Solo prestador y cliente pueden acceder
 */
exports.crearVideollamadaCotizacion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { serviceId, prestadorId, clienteId } = data;
  const usuarioActual = context.auth.uid;

  // Validar que el usuario sea el cliente o el prestador
  if (usuarioActual !== clienteId && usuarioActual !== prestadorId) {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permiso para crear esta videollamada');
  }

  try {
    // Verificar que el servicio existe y requiere cotización
    const serviceRef = admin.firestore().collection('servicios').doc(serviceId);
    const serviceDoc = await serviceRef.get();

    if (!serviceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Servicio no encontrado');
    }

    const serviceData = serviceDoc.data();
    if (!serviceData.requiereCotizacion) {
      throw new functions.https.HttpsError('failed-precondition', 'Este servicio no requiere cotización');
    }

    // Generar ID único para la llamada
    const callId = `cotizacion_${serviceId}_${Date.now()}`;
    const callType = 'default'; // Tipo de llamada 1-a-1

    // Crear la llamada en Stream
    const call = streamClient.video.call(callType, callId);
    
    // Configurar la llamada
    await call.create({
      data: {
        created_by_id: usuarioActual,
        members: [
          { user_id: clienteId, role: 'user' },
          { user_id: prestadorId, role: 'user' }
        ],
        custom: {
          tipo: 'cotizacion',
          serviceId: serviceId,
          createdAt: new Date().toISOString()
        },
        settings_override: {
          recording: {
            mode: 'disabled' // No grabar por privacidad
          },
          transcription: {
            mode: 'disabled'
          },
          limits: {
            max_duration_seconds: 3600 // Máximo 1 hora
          }
        }
      }
    });

    // Generar tokens con expiración de 60 minutos
    const expiration = Math.floor(Date.now() / 1000) + (60 * 60);
    
    const tokenCliente = streamClient.createToken(clienteId, expiration, {
      call_cids: [`${callType}:${callId}`]
    });

    const tokenPrestador = streamClient.createToken(prestadorId, expiration, {
      call_cids: [`${callType}:${callId}`]
    });

    // Actualizar el servicio con la información de la videollamada
    await serviceRef.update({
      videollamadaActiva: true,
      videollamadaURL: `https://app.getstream.io/video/call/${callType}/${callId}`,
      streamCallId: callId,
      streamCallType: callType,
      streamSessionTokenCliente: tokenCliente,
      streamSessionTokenPrestador: tokenPrestador,
      videollamadaIniciadaEn: admin.firestore.FieldValue.serverTimestamp(),
      videollamadaExpiraEn: new Date(expiration * 1000)
    });

    // Enviar notificaciones
    await enviarNotificacionVideollamada(clienteId, prestadorId, 'cotizacion', serviceId);

    console.log(`Videollamada de cotización creada: ${callId}`);

    return {
      success: true,
      callId,
      callType,
      tokenCliente: usuarioActual === clienteId ? tokenCliente : null,
      tokenPrestador: usuarioActual === prestadorId ? tokenPrestador : null,
      url: `https://app.getstream.io/video/call/${callType}/${callId}`,
      expiraEn: new Date(expiration * 1000).toISOString()
    };

  } catch (error) {
    console.error('Error creando videollamada de cotización:', error);
    throw new functions.https.HttpsError('internal', 'Error al crear la videollamada');
  }
});

/**
 * Crea una videollamada para servicio online contratado
 * Solo se activa cuando el servicio está en progreso
 */
exports.crearVideollamadaOnline = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { serviceId } = data;
  const usuarioActual = context.auth.uid;

  try {
    // Verificar el servicio
    const serviceRef = admin.firestore().collection('servicios').doc(serviceId);
    const serviceDoc = await serviceRef.get();

    if (!serviceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Servicio no encontrado');
    }

    const serviceData = serviceDoc.data();
    
    // Validaciones
    if (!serviceData.disponibleOnline) {
      throw new functions.https.HttpsError('failed-precondition', 'Este servicio no está disponible online');
    }

    if (serviceData.estado !== 'en_progreso') {
      throw new functions.https.HttpsError('failed-precondition', 'El servicio debe estar en progreso para iniciar videollamada');
    }

    // Verificar que el usuario sea parte del servicio
    if (usuarioActual !== serviceData.clienteId && usuarioActual !== serviceData.prestadorId) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permiso para esta videollamada');
    }

    // Generar ID único para la llamada
    const callId = `servicio_${serviceId}_${Date.now()}`;
    const callType = 'default';

    // Crear la llamada en Stream
    const call = streamClient.video.call(callType, callId);
    
    await call.create({
      data: {
        created_by_id: usuarioActual,
        members: [
          { user_id: serviceData.clienteId, role: 'user' },
          { user_id: serviceData.prestadorId, role: 'user' }
        ],
        custom: {
          tipo: 'servicio_online',
          serviceId: serviceId,
          servicioNombre: serviceData.nombre || 'Servicio Online',
          createdAt: new Date().toISOString()
        },
        settings_override: {
          recording: {
            mode: 'available', // Grabación disponible si el usuario lo desea
            audio_only: false,
            quality: 'full-hd'
          },
          transcription: {
            mode: 'disabled'
          },
          limits: {
            max_duration_seconds: 7200 // Máximo 2 horas
          },
          backstage: {
            enabled: true // Permite sala de espera
          }
        }
      }
    });

    // Generar tokens con expiración de 2 horas
    const expiration = Math.floor(Date.now() / 1000) + (2 * 60 * 60);
    
    const tokenCliente = streamClient.createToken(serviceData.clienteId, expiration, {
      call_cids: [`${callType}:${callId}`]
    });

    const tokenPrestador = streamClient.createToken(serviceData.prestadorId, expiration, {
      call_cids: [`${callType}:${callId}`]
    });

    // Actualizar el servicio
    await serviceRef.update({
      videollamadaActiva: true,
      videollamadaURL: `https://app.getstream.io/video/call/${callType}/${callId}`,
      streamCallId: callId,
      streamCallType: callType,
      streamSessionTokenCliente: tokenCliente,
      streamSessionTokenPrestador: tokenPrestador,
      videollamadaIniciadaEn: admin.firestore.FieldValue.serverTimestamp(),
      videollamadaExpiraEn: new Date(expiration * 1000)
    });

    // Registrar en historial
    await registrarEventoVideollamada(serviceId, 'iniciada', usuarioActual);

    // Enviar notificaciones
    await enviarNotificacionVideollamada(
      serviceData.clienteId, 
      serviceData.prestadorId, 
      'servicio_online', 
      serviceId
    );

    console.log(`Videollamada de servicio online creada: ${callId}`);

    return {
      success: true,
      callId,
      callType,
      token: usuarioActual === serviceData.clienteId ? tokenCliente : tokenPrestador,
      url: `https://app.getstream.io/video/call/${callType}/${callId}`,
      expiraEn: new Date(expiration * 1000).toISOString(),
      tipoUsuario: usuarioActual === serviceData.clienteId ? 'cliente' : 'prestador'
    };

  } catch (error) {
    console.error('Error creando videollamada online:', error);
    throw new functions.https.HttpsError('internal', 'Error al crear la videollamada');
  }
});

/**
 * Termina una videollamada activa
 */
exports.terminarVideollamada = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { serviceId } = data;
  const usuarioActual = context.auth.uid;

  try {
    const serviceRef = admin.firestore().collection('servicios').doc(serviceId);
    const serviceDoc = await serviceRef.get();

    if (!serviceDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Servicio no encontrado');
    }

    const serviceData = serviceDoc.data();

    // Verificar permisos
    if (usuarioActual !== serviceData.clienteId && usuarioActual !== serviceData.prestadorId) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes permiso para terminar esta videollamada');
    }

    if (!serviceData.videollamadaActiva) {
      throw new functions.https.HttpsError('failed-precondition', 'No hay videollamada activa');
    }

    // Terminar la llamada en Stream
    if (serviceData.streamCallId && serviceData.streamCallType) {
      try {
        const call = streamClient.video.call(serviceData.streamCallType, serviceData.streamCallId);
        await call.endCall();
      } catch (streamError) {
        console.error('Error terminando llamada en Stream:', streamError);
      }
    }

    // Actualizar el servicio
    await serviceRef.update({
      videollamadaActiva: false,
      videollamadaURL: null,
      streamCallId: null,
      streamCallType: null,
      streamSessionTokenCliente: null,
      streamSessionTokenPrestador: null,
      videollamadaFinalizadaEn: admin.firestore.FieldValue.serverTimestamp(),
      videollamadaTerminadaPor: usuarioActual
    });

    // Registrar evento
    await registrarEventoVideollamada(serviceId, 'terminada', usuarioActual);

    console.log(`Videollamada terminada para servicio: ${serviceId}`);

    return {
      success: true,
      mensaje: 'Videollamada terminada correctamente'
    };

  } catch (error) {
    console.error('Error terminando videollamada:', error);
    throw new functions.https.HttpsError('internal', 'Error al terminar la videollamada');
  }
});

/**
 * Webhook para recibir eventos de Stream Video
 */
exports.streamVideoWebhook = functions.https.onRequest(async (req, res) => {
  // Verificar método
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Verificar firma del webhook (en producción)
  // const signature = req.headers['x-stream-signature'];
  // if (!verifyWebhookSignature(req.body, signature)) {
  //   res.status(401).send('Unauthorized');
  //   return;
  // }

  try {
    const { type, call, user, created_at } = req.body;

    console.log(`Evento de Stream recibido: ${type}`);

    switch (type) {
      case 'call.ended':
        await manejarLlamadaTerminada(call);
        break;
      
      case 'call.session_participant_joined':
        await manejarParticipanteUnido(call, user);
        break;
      
      case 'call.session_participant_left':
        await manejarParticipanteSalio(call, user);
        break;
      
      case 'call.recording_ready':
        await manejarGrabacionLista(call);
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook de Stream:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Funciones auxiliares

async function enviarNotificacionVideollamada(clienteId, prestadorId, tipo, serviceId) {
  try {
    const batch = admin.firestore().batch();

    // Notificación para cliente
    const notifClienteRef = admin.firestore().collection('notificaciones').doc();
    batch.set(notifClienteRef, {
      usuarioId: clienteId,
      tipo: 'videollamada_disponible',
      titulo: tipo === 'cotizacion' ? 'Videollamada de cotización lista' : 'Videollamada de servicio disponible',
      mensaje: tipo === 'cotizacion' 
        ? 'El prestador está listo para discutir tu cotización por videollamada'
        : 'Tu servicio online está listo para comenzar',
      serviceId,
      leida: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notificación para prestador
    const notifPrestadorRef = admin.firestore().collection('notificaciones').doc();
    batch.set(notifPrestadorRef, {
      usuarioId: prestadorId,
      tipo: 'videollamada_disponible',
      titulo: tipo === 'cotizacion' ? 'Cliente esperando cotización' : 'Servicio online listo',
      mensaje: tipo === 'cotizacion'
        ? 'Un cliente está esperando tu cotización por videollamada'
        : 'Tu cliente está listo para el servicio online',
      serviceId,
      leida: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    console.error('Error enviando notificaciones:', error);
  }
}

async function registrarEventoVideollamada(serviceId, evento, usuarioId) {
  try {
    await admin.firestore().collection('eventos_videollamadas').add({
      serviceId,
      evento,
      usuarioId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error registrando evento de videollamada:', error);
  }
}

async function manejarLlamadaTerminada(call) {
  if (!call.custom?.serviceId) return;

  try {
    const serviceRef = admin.firestore().collection('servicios').doc(call.custom.serviceId);
    await serviceRef.update({
      videollamadaActiva: false,
      videollamadaDuracion: call.duration || 0,
      videollamadaFinalizadaEn: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error manejando llamada terminada:', error);
  }
}

async function manejarParticipanteUnido(call, user) {
  if (!call.custom?.serviceId) return;

  await registrarEventoVideollamada(
    call.custom.serviceId, 
    'participante_unido', 
    user.id
  );
}

async function manejarParticipanteSalio(call, user) {
  if (!call.custom?.serviceId) return;

  await registrarEventoVideollamada(
    call.custom.serviceId, 
    'participante_salio', 
    user.id
  );
}

async function manejarGrabacionLista(call) {
  if (!call.custom?.serviceId || !call.recording) return;

  try {
    const serviceRef = admin.firestore().collection('servicios').doc(call.custom.serviceId);
    await serviceRef.update({
      grabacionDisponible: true,
      grabacionURL: call.recording.url,
      grabacionDuracion: call.recording.duration
    });
  } catch (error) {
    console.error('Error guardando información de grabación:', error);
  }
}