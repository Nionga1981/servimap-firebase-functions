const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

// Importar funciones de prestadores
const clasificacion = require('./src/prestadores/clasificacion');
const disponibilidad = require('./src/prestadores/disponibilidad');
const videollamadas = require('./src/videollamadas/stream-video');
const moderacion = require('./src/moderacion/ia-moderador');

// Exportar funciones de clasificación
exports.clasificarCategoriaPorDescripcion = clasificacion.clasificarCategoriaPorDescripcion;
exports.actualizarCategoriaPrestador = clasificacion.actualizarCategoriaPrestador;

// Exportar funciones de disponibilidad
exports.actualizarVisibilidadMapa = disponibilidad.actualizarVisibilidadMapa;
exports.verificarHorariosDisponibilidad = disponibilidad.verificarHorariosDisponibilidad;
exports.toggleDisponibilidad = disponibilidad.toggleDisponibilidad;
exports.obtenerEstadoDisponibilidad = disponibilidad.obtenerEstadoDisponibilidad;

// Exportar funciones de videollamadas
exports.crearVideollamadaCotizacion = videollamadas.crearVideollamadaCotizacion;
exports.crearVideollamadaOnline = videollamadas.crearVideollamadaOnline;
exports.terminarVideollamada = videollamadas.terminarVideollamada;
exports.streamVideoWebhook = videollamadas.streamVideoWebhook;

// Exportar funciones de moderación con IA
exports.moderarMensajeChat = moderacion.moderarMensajeChat;
exports.moderarImagen = moderacion.moderarImagen;
exports.verificarDocumentoIdentidad = moderacion.verificarDocumentoIdentidad;
exports.moderarContenidoPrestador = moderacion.moderarContenidoPrestador;

// Exportar funciones de notificaciones push
const notificaciones = require('./src/notificaciones/push-notifications');
exports.notificarModeradoresNuevoElemento = notificaciones.notificarModeradoresNuevoElemento;
exports.notificarCambioEstadoModeracion = notificaciones.notificarCambioEstadoModeracion;
exports.notificarElementoAltaPrioridad = notificaciones.notificarElementoAltaPrioridad;
exports.enviarResumenDiarioModeracion = notificaciones.enviarResumenDiarioModeracion;

// Función para registrar un nuevo prestador
exports.registrarPrestador = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const uid = context.auth.uid;
  const {
    idiomasDominados,
    descripcionPerfil,
    fotosPortafolio,
    videoPresentacion,
    documentosVisibles,
    serviciosItemizados,
    aceptaServiciosEnLinea,
    ubicacion,
    diasDisponibles,
    horarioDisponible
  } = data;

  try {
    // Validaciones básicas
    if (!serviciosItemizados || serviciosItemizados.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Debe incluir al menos un servicio');
    }

    if (!fotosPortafolio || fotosPortafolio.length < 3) {
      throw new functions.https.HttpsError('invalid-argument', 'Debe incluir al menos 3 fotos de portafolio');
    }

    if (fotosPortafolio.length > 5) {
      throw new functions.https.HttpsError('invalid-argument', 'Máximo 5 fotos de portafolio permitidas');
    }

    // Validar que todos los servicios tengan precio
    for (const servicio of serviciosItemizados) {
      if (!servicio.precio || servicio.precio <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Todos los servicios deben tener precio válido');
      }
    }

    // Clasificar automáticamente la categoría
    const { clasificarPorDescripcion } = require('./src/prestadores/clasificacion');
    const categoria = clasificarPorDescripcion(descripcionPerfil);

    // Crear documento del prestador
    const prestadorData = {
      uid,
      idiomasDominados: idiomasDominados || ['español'],
      descripcionPerfil,
      fotosPortafolio,
      videoPresentacion: videoPresentacion || null,
      documentosVisibles: documentosVisibles || [],
      serviciosItemizados,
      aceptaServiciosEnLinea: aceptaServiciosEnLinea || false,
      ubicacion: ubicacion || null,
      disponibilidadActiva: true,
      diasDisponibles: diasDisponibles || [],
      horarioDisponible: horarioDisponible || {},
      categoriaSistema: categoria.nombre,
      categoriaId: categoria.id,
      categoriaConfianza: categoria.confianza || 'N/A',
      // Campos adicionales
      calificacionPromedio: 0,
      totalServicios: 0,
      totalReseñas: 0,
      verificado: false,
      estadoPrestador: 'activo',
      visibleEnMapa: true,
      fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
      ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };

    // Guardar en Firestore
    await admin.firestore().collection('prestadores').doc(uid).set(prestadorData);

    // Crear perfil público
    await admin.firestore().collection('perfiles_publicos').doc(uid).set({
      nombre: context.auth.token.name || 'Prestador',
      fotoPerfil: context.auth.token.picture || null,
      categoria: categoria.nombre,
      calificacion: 0,
      serviciosActivos: serviciosItemizados.length,
      ubicacion: ubicacion || null
    });

    console.log(`Prestador registrado exitosamente: ${uid}`);

    return {
      success: true,
      prestadorId: uid,
      categoria: categoria.nombre,
      mensaje: 'Registro completado exitosamente'
    };

  } catch (error) {
    console.error('Error registrando prestador:', error);
    throw new functions.https.HttpsError('internal', 'Error al registrar prestador');
  }
});

// Función para actualizar perfil de prestador
exports.actualizarPerfilPrestador = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const uid = context.auth.uid;
  const actualizaciones = data;

  try {
    // Verificar que el prestador existe
    const prestadorRef = admin.firestore().collection('prestadores').doc(uid);
    const prestadorDoc = await prestadorRef.get();

    if (!prestadorDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Prestador no encontrado');
    }

    // Validaciones específicas según los campos actualizados
    if (actualizaciones.serviciosItemizados) {
      for (const servicio of actualizaciones.serviciosItemizados) {
        if (!servicio.precio || servicio.precio <= 0) {
          throw new functions.https.HttpsError('invalid-argument', 'Todos los servicios deben tener precio válido');
        }
      }
    }

    if (actualizaciones.fotosPortafolio) {
      if (actualizaciones.fotosPortafolio.length < 3 || actualizaciones.fotosPortafolio.length > 5) {
        throw new functions.https.HttpsError('invalid-argument', 'Entre 3 y 5 fotos de portafolio requeridas');
      }
    }

    // Agregar timestamp de actualización
    actualizaciones.ultimaActualizacion = admin.firestore.FieldValue.serverTimestamp();

    // Actualizar documento
    await prestadorRef.update(actualizaciones);

    // Actualizar perfil público si es necesario
    const actualizacionesPublicas = {};
    if (actualizaciones.serviciosItemizados) {
      actualizacionesPublicas.serviciosActivos = actualizaciones.serviciosItemizados.length;
    }
    if (actualizaciones.ubicacion) {
      actualizacionesPublicas.ubicacion = actualizaciones.ubicacion;
    }

    if (Object.keys(actualizacionesPublicas).length > 0) {
      await admin.firestore().collection('perfiles_publicos').doc(uid).update(actualizacionesPublicas);
    }

    return {
      success: true,
      mensaje: 'Perfil actualizado correctamente'
    };

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    throw new functions.https.HttpsError('internal', 'Error al actualizar perfil');
  }
});

// Función para obtener prestadores cercanos
exports.obtenerPrestadoresCercanos = functions.https.onCall(async (data, context) => {
  const { ubicacion, radio = 5, categoria } = data;

  if (!ubicacion || !ubicacion.latitude || !ubicacion.longitude) {
    throw new functions.https.HttpsError('invalid-argument', 'Ubicación inválida');
  }

  try {
    // Calcular límites del área de búsqueda
    const lat = ubicacion.latitude;
    const lng = ubicacion.longitude;
    const radioEnGrados = radio / 111; // Aproximadamente 111 km por grado

    let query = admin.firestore()
      .collection('prestadores')
      .where('visibleEnMapa', '==', true)
      .where('disponibilidadActiva', '==', true);

    // Filtrar por categoría si se especifica
    if (categoria) {
      query = query.where('categoriaSistema', '==', categoria);
    }

    const snapshot = await query.get();
    const prestadoresCercanos = [];

    snapshot.forEach(doc => {
      const prestador = doc.data();
      if (prestador.ubicacion) {
        // Calcular distancia
        const distancia = calcularDistancia(
          lat, lng,
          prestador.ubicacion.latitude,
          prestador.ubicacion.longitude
        );

        if (distancia <= radio) {
          prestadoresCercanos.push({
            id: doc.id,
            ...prestador,
            distancia: Math.round(distancia * 100) / 100
          });
        }
      }
    });

    // Ordenar por distancia
    prestadoresCercanos.sort((a, b) => a.distancia - b.distancia);

    return {
      success: true,
      prestadores: prestadoresCercanos,
      total: prestadoresCercanos.length
    };

  } catch (error) {
    console.error('Error obteniendo prestadores cercanos:', error);
    throw new functions.https.HttpsError('internal', 'Error al buscar prestadores');
  }
});

// Función auxiliar para calcular distancia entre dos puntos
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}