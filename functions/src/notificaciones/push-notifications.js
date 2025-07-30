const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Envía notificaciones push a moderadores cuando hay nuevos elementos para revisar
 */
exports.notificarModeradoresNuevoElemento = functions.firestore
  .document('cola_moderacion/{elementoId}')
  .onCreate(async (snap, context) => {
    const elemento = snap.data();
    const elementoId = context.params.elementoId;

    try {
      // Obtener tokens de FCM de todos los administradores
      const adminsSnapshot = await admin.firestore().collection('admins').get();
      const adminIds = [];
      
      adminsSnapshot.forEach(doc => {
        adminIds.push(doc.id);
      });

      if (adminIds.length === 0) {
        console.log('No hay administradores registrados para notificar');
        return;
      }

      // Obtener tokens FCM de administradores
      const tokens = [];
      for (const adminId of adminIds) {
        const tokensSnapshot = await admin.firestore()
          .collection('usuarios')
          .doc(adminId)
          .collection('fcm_tokens')
          .get();
        
        tokensSnapshot.forEach(tokenDoc => {
          const tokenData = tokenDoc.data();
          if (tokenData.token && tokenData.active) {
            tokens.push(tokenData.token);
          }
        });
      }

      if (tokens.length === 0) {
        console.log('No hay tokens FCM válidos para administradores');
        return;
      }

      // Preparar el mensaje de notificación
      const notificationTitle = getTitleForElementType(elemento.tipo);
      const notificationBody = getBodyForElement(elemento);
      
      const message = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
          icon: '/icons/moderacion.png'
        },
        data: {
          tipo: 'moderacion',
          elementoId: elementoId,
          elementoTipo: elemento.tipo,
          prioridad: elemento.prioridad || 'media',
          clickAction: '/admin-moderacion.html'
        },
        tokens: tokens
      };

      // Enviar notificación
      const response = await admin.messaging().sendMulticast(message);
      
      console.log(`Notificación enviada a ${response.successCount}/${tokens.length} administradores`);

      // Limpiar tokens inválidos
      if (response.failureCount > 0) {
        await cleanupInvalidTokens(response.responses, tokens, adminIds);
      }

      // Registrar notificación en Firestore
      await registrarNotificacionModerador(adminIds, elemento, elementoId);

    } catch (error) {
      console.error('Error enviando notificación a moderadores:', error);
    }
  });

/**
 * Notifica cuando un elemento de moderación cambia de estado
 */
exports.notificarCambioEstadoModeracion = functions.firestore
  .document('cola_moderacion/{elementoId}')
  .onUpdate(async (change, context) => {
    const datosDespues = change.after.data();
    const datosAntes = change.before.data();
    const elementoId = context.params.elementoId;

    // Solo notificar si cambió el estado
    if (datosAntes.estado === datosDespues.estado) {
      return;
    }

    try {
      // Si hay un usuario asociado (para verificación de identidad, etc.)
      let usuarioId = null;
      if (datosDespues.datos?.usuarioId) {
        usuarioId = datosDespues.datos.usuarioId;
      } else if (datosDespues.datos?.prestadorId) {
        usuarioId = datosDespues.datos.prestadorId;
      }

      if (!usuarioId) {
        console.log('No hay usuario para notificar del cambio de estado');
        return;
      }

      // Obtener tokens FCM del usuario
      const tokensSnapshot = await admin.firestore()
        .collection('usuarios')
        .doc(usuarioId)
        .collection('fcm_tokens')
        .where('active', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        // Intentar en la colección de prestadores
        const prestadorTokensSnapshot = await admin.firestore()
          .collection('prestadores')
          .doc(usuarioId)
          .collection('fcm_tokens')
          .where('active', '==', true)
          .get();

        if (prestadorTokensSnapshot.empty) {
          console.log(`No hay tokens FCM para el usuario ${usuarioId}`);
          return;
        }
      }

      const tokens = [];
      const snapshot = tokensSnapshot.empty ? prestadorTokensSnapshot : tokensSnapshot;
      
      snapshot.forEach(doc => {
        tokens.push(doc.data().token);
      });

      // Preparar mensaje según el estado
      const { title, body } = getNotificationForStateChange(datosDespues.tipo, datosDespues.estado);

      const message = {
        notification: {
          title,
          body,
          icon: '/icons/notification.png'
        },
        data: {
          tipo: 'moderacion_resultado',
          elementoTipo: datosDespues.tipo,
          estado: datosDespues.estado,
          elementoId
        },
        tokens: tokens
      };

      // Enviar notificación
      const response = await admin.messaging().sendMulticast(message);
      
      console.log(`Notificación de estado enviada a usuario ${usuarioId}: ${response.successCount}/${tokens.length}`);

      // Registrar en el historial de notificaciones del usuario
      await admin.firestore().collection('notificaciones').add({
        usuarioId,
        tipo: 'moderacion_resultado',
        titulo: title,
        mensaje: body,
        elementoId,
        elementoTipo: datosDespues.tipo,
        estado: datosDespues.estado,
        leida: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error('Error notificando cambio de estado:', error);
    }
  });

/**
 * Notifica a administradores sobre elementos de alta prioridad
 */
exports.notificarElementoAltaPrioridad = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { elementoId, mensaje } = data;

  try {
    // Verificar que es admin
    const isAdmin = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!isAdmin.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden enviar estas notificaciones');
    }

    // Obtener todos los tokens de administradores
    const adminsSnapshot = await admin.firestore().collection('admins').get();
    const tokens = [];

    for (const adminDoc of adminsSnapshot.docs) {
      const adminId = adminDoc.id;
      if (adminId === context.auth.uid) continue; // No enviarse a sí mismo

      const tokensSnapshot = await admin.firestore()
        .collection('usuarios')
        .doc(adminId)
        .collection('fcm_tokens')
        .where('active', '==', true)
        .get();

      tokensSnapshot.forEach(tokenDoc => {
        tokens.push(tokenDoc.data().token);
      });
    }

    if (tokens.length === 0) {
      return { success: false, message: 'No hay otros administradores para notificar' };
    }

    const notificationMessage = {
      notification: {
        title: '🚨 Moderación: Atención Requerida',
        body: mensaje || 'Un elemento requiere atención inmediata',
        icon: '/icons/alert.png'
      },
      data: {
        tipo: 'moderacion_urgente',
        elementoId,
        prioridad: 'urgente',
        clickAction: '/admin-moderacion.html'
      },
      tokens: tokens
    };

    const response = await admin.messaging().sendMulticast(notificationMessage);
    
    return {
      success: true,
      message: `Notificación enviada a ${response.successCount} administradores`
    };

  } catch (error) {
    console.error('Error enviando notificación de alta prioridad:', error);
    throw new functions.https.HttpsError('internal', 'Error al enviar la notificación');
  }
});

/**
 * Envía resumen diario de moderación a administradores
 */
exports.enviarResumenDiarioModeracion = functions.pubsub
  .schedule('0 8 * * *') // Todos los días a las 8:00 AM
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    try {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      ayer.setHours(0, 0, 0, 0);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // Obtener estadísticas del día anterior
      const moderacionSnapshot = await admin.firestore()
        .collection('cola_moderacion')
        .where('fechaCreacion', '>=', ayer)
        .where('fechaCreacion', '<', hoy)
        .get();

      let procesados = 0;
      let aprobados = 0;
      let rechazados = 0;
      let pendientes = 0;

      moderacionSnapshot.forEach(doc => {
        const data = doc.data();
        procesados++;
        
        if (data.estado === 'aprobado') {
          aprobados++;
        } else if (data.estado === 'rechazado') {
          rechazados++;
        } else if (data.estado === 'pendiente') {
          pendientes++;
        }
      });

      // Obtener pendientes actuales
      const pendientesSnapshot = await admin.firestore()
        .collection('cola_moderacion')
        .where('estado', '==', 'pendiente')
        .get();

      const pendientesActuales = pendientesSnapshot.size;

      // Enviar resumen a administradores
      const adminsSnapshot = await admin.firestore().collection('admins').get();
      const tokens = [];

      for (const adminDoc of adminsSnapshot.docs) {
        const tokensSnapshot = await admin.firestore()
          .collection('usuarios')
          .doc(adminDoc.id)
          .collection('fcm_tokens')
          .where('active', '==', true)
          .get();

        tokensSnapshot.forEach(tokenDoc => {
          tokens.push(tokenDoc.data().token);
        });
      }

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: '📊 Resumen de Moderación',
            body: `Ayer: ${procesados} procesados (${aprobados} ✅, ${rechazados} ❌). Pendientes: ${pendientesActuales}`,
            icon: '/icons/stats.png'
          },
          data: {
            tipo: 'resumen_diario',
            procesados: procesados.toString(),
            aprobados: aprobados.toString(),
            rechazados: rechazados.toString(),
            pendientes: pendientesActuales.toString(),
            clickAction: '/admin-moderacion.html'
          },
          tokens: tokens
        };

        await admin.messaging().sendMulticast(message);
        console.log(`Resumen diario enviado a ${tokens.length} administradores`);
      }

    } catch (error) {
      console.error('Error enviando resumen diario:', error);
    }
  });

// Funciones auxiliares

function getTitleForElementType(tipo) {
  const titles = {
    'verificacion_identidad': '🔍 Nueva verificación de identidad',
    'contenido_prestador': '📝 Contenido de prestador para revisar',
    'imagen': '🖼️ Imagen reportada',
    'mensaje_chat': '💬 Mensaje de chat reportado'
  };
  return titles[tipo] || '📋 Nuevo elemento para moderar';
}

function getBodyForElement(elemento) {
  switch (elemento.tipo) {
    case 'verificacion_identidad':
      return `Documento ${elemento.datos?.tipoDocumento || 'desconocido'} requiere verificación manual`;
    case 'contenido_prestador':
      return 'Un prestador requiere revisión de contenido';
    case 'imagen':
      return `Imagen en contexto "${elemento.datos?.contexto || 'desconocido'}" reportada`;
    case 'mensaje_chat':
      return 'Mensaje en videollamada requiere revisión';
    default:
      return 'Nuevo elemento requiere moderación';
  }
}

function getNotificationForStateChange(tipo, estado) {
  const tipoLabels = {
    'verificacion_identidad': 'verificación de identidad',
    'contenido_prestador': 'contenido',
    'imagen': 'imagen',
    'mensaje_chat': 'mensaje'
  };

  const tipoLabel = tipoLabels[tipo] || 'elemento';

  if (estado === 'aprobado') {
    return {
      title: '✅ Elemento aprobado',
      body: `Tu ${tipoLabel} ha sido aprobado por el equipo de moderación`
    };
  } else if (estado === 'rechazado') {
    return {
      title: '❌ Elemento rechazado',
      body: `Tu ${tipoLabel} requiere cambios. Revisa los detalles en tu perfil`
    };
  }

  return {
    title: '📋 Estado actualizado',
    body: `El estado de tu ${tipoLabel} ha sido actualizado`
  };
}

async function cleanupInvalidTokens(responses, tokens, adminIds) {
  const batch = admin.firestore().batch();
  
  responses.forEach((response, index) => {
    if (!response.success) {
      const token = tokens[index];
      // Marcar token como inválido en todas las colecciones donde pueda estar
      // Esto es simplificado, en producción se debería hacer una búsqueda más específica
      console.log(`Token inválido encontrado: ${token.substring(0, 20)}...`);
    }
  });

  if (batch._writes && batch._writes.length > 0) {
    await batch.commit();
  }
}

async function registrarNotificacionModerador(adminIds, elemento, elementoId) {
  const batch = admin.firestore().batch();

  adminIds.forEach(adminId => {
    const notifRef = admin.firestore().collection('notificaciones').doc();
    batch.set(notifRef, {
      usuarioId: adminId,
      tipo: 'moderacion_nuevo',
      titulo: getTitleForElementType(elemento.tipo),
      mensaje: getBodyForElement(elemento),
      elementoId,
      elementoTipo: elemento.tipo,
      prioridad: elemento.prioridad || 'media',
      leida: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
}