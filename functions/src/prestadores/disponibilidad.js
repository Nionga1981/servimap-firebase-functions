const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Actualiza la visibilidad del prestador en el mapa según su disponibilidad
 * Trigger: cuando cambia el campo 'disponibilidadActiva'
 */
exports.actualizarVisibilidadMapa = functions.firestore
  .document('prestadores/{prestadorId}')
  .onUpdate(async (change, context) => {
    const prestadorId = context.params.prestadorId;
    const datosAntes = change.before.data();
    const datosDespues = change.after.data();

    // Solo procesar si cambió la disponibilidad
    if (datosAntes.disponibilidadActiva === datosDespues.disponibilidadActiva) {
      return null;
    }

    try {
      const updates = {
        visibleEnMapa: datosDespues.disponibilidadActiva,
        ultimaActualizacionDisponibilidad: admin.firestore.FieldValue.serverTimestamp()
      };

      // Si está inactivo, también actualizar estado
      if (!datosDespues.disponibilidadActiva) {
        updates.estadoPrestador = 'inactivo';
        updates.motivoInactividad = 'disponibilidad_desactivada';
      } else {
        updates.estadoPrestador = 'activo';
        updates.motivoInactividad = null;
      }

      await change.after.ref.update(updates);

      // Actualizar índice de búsqueda geográfica si existe
      await actualizarIndiceGeografico(prestadorId, datosDespues);

      console.log(`Visibilidad actualizada para prestador ${prestadorId}: ${datosDespues.disponibilidadActiva ? 'visible' : 'oculto'}`);

    } catch (error) {
      console.error(`Error actualizando visibilidad para prestador ${prestadorId}:`, error);
      throw error;
    }
  });

/**
 * Verifica y actualiza la disponibilidad según horarios configurados
 * Se ejecuta cada 15 minutos
 */
exports.verificarHorariosDisponibilidad = functions.pubsub
  .schedule('every 15 minutes')
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const ahora = new Date();
    const diaActual = obtenerDiaEnEspanol(ahora.getDay());
    const horaActual = ahora.getHours();
    const minutosActuales = ahora.getMinutes();

    try {
      // Obtener prestadores con horarios configurados
      const prestadoresSnapshot = await admin.firestore()
        .collection('prestadores')
        .where('diasDisponibles', 'array-contains', diaActual)
        .where('disponibilidadAutomatica', '==', true)
        .get();

      const batch = admin.firestore().batch();
      let actualizaciones = 0;

      for (const doc of prestadoresSnapshot.docs) {
        const prestador = doc.data();
        const horarioHoy = prestador.horarioDisponible?.[diaActual];

        if (horarioHoy) {
          const { horaInicio, horaFin } = parsearHorario(horarioHoy);
          const estaEnHorario = verificarSiEstaEnHorario(
            horaActual, 
            minutosActuales, 
            horaInicio, 
            horaFin
          );

          // Solo actualizar si el estado cambió
          if (prestador.disponibilidadActiva !== estaEnHorario) {
            batch.update(doc.ref, {
              disponibilidadActiva: estaEnHorario,
              ultimaVerificacionHorario: admin.firestore.FieldValue.serverTimestamp()
            });
            actualizaciones++;
          }
        }
      }

      if (actualizaciones > 0) {
        await batch.commit();
        console.log(`Disponibilidad actualizada para ${actualizaciones} prestadores`);
      }

    } catch (error) {
      console.error('Error verificando horarios de disponibilidad:', error);
      throw error;
    }
  });

/**
 * Permite a los prestadores activar/desactivar disponibilidad manualmente
 */
exports.toggleDisponibilidad = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const uid = context.auth.uid;
  const { disponible, motivoPausa } = data;

  try {
    const prestadorRef = admin.firestore().collection('prestadores').doc(uid);
    const prestadorDoc = await prestadorRef.get();

    if (!prestadorDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Prestador no encontrado');
    }

    const updates = {
      disponibilidadActiva: disponible,
      ultimoCambioManual: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!disponible && motivoPausa) {
      updates.motivoPausa = motivoPausa;
      updates.inicioPausa = admin.firestore.FieldValue.serverTimestamp();
    } else if (disponible) {
      updates.motivoPausa = null;
      updates.inicioPausa = null;
    }

    await prestadorRef.update(updates);

    // Registrar en historial
    await registrarCambioDisponibilidad(uid, disponible, motivoPausa);

    return {
      success: true,
      disponibilidadActiva: disponible,
      mensaje: disponible ? 'Ahora estás disponible' : 'Tu disponibilidad ha sido pausada'
    };

  } catch (error) {
    console.error('Error toggling disponibilidad:', error);
    throw new functions.https.HttpsError('internal', 'Error al actualizar disponibilidad');
  }
});

/**
 * Obtiene el estado de disponibilidad actual de un prestador
 */
exports.obtenerEstadoDisponibilidad = functions.https.onCall(async (data, context) => {
  const { prestadorId } = data;

  try {
    const prestadorDoc = await admin.firestore()
      .collection('prestadores')
      .doc(prestadorId)
      .get();

    if (!prestadorDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Prestador no encontrado');
    }

    const prestador = prestadorDoc.data();
    const ahora = new Date();
    const diaActual = obtenerDiaEnEspanol(ahora.getDay());

    const estado = {
      disponibleAhora: prestador.disponibilidadActiva || false,
      visibleEnMapa: prestador.visibleEnMapa || false,
      motivoPausa: prestador.motivoPausa || null,
      horarioHoy: prestador.horarioDisponible?.[diaActual] || null,
      diasDisponibles: prestador.diasDisponibles || [],
      disponibilidadAutomatica: prestador.disponibilidadAutomatica || false
    };

    // Si tiene horario automático, verificar si debería estar disponible
    if (estado.disponibilidadAutomatica && estado.horarioHoy) {
      const { horaInicio, horaFin } = parsearHorario(estado.horarioHoy);
      estado.deberiaEstarDisponible = verificarSiEstaEnHorario(
        ahora.getHours(),
        ahora.getMinutes(),
        horaInicio,
        horaFin
      );
    }

    return estado;

  } catch (error) {
    console.error('Error obteniendo estado de disponibilidad:', error);
    throw new functions.https.HttpsError('internal', 'Error al obtener estado');
  }
});

// Funciones auxiliares

function obtenerDiaEnEspanol(numeroDia) {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return dias[numeroDia];
}

function parsearHorario(horarioString) {
  // Formato esperado: "9-18" o "9:00-18:30"
  const [inicio, fin] = horarioString.split('-');
  const [horaInicio, minutosInicio = 0] = inicio.split(':').map(Number);
  const [horaFin, minutosFin = 0] = fin.split(':').map(Number);
  
  return {
    horaInicio: { hora: horaInicio, minutos: minutosInicio },
    horaFin: { hora: horaFin, minutos: minutosFin }
  };
}

function verificarSiEstaEnHorario(horaActual, minutosActuales, horaInicio, horaFin) {
  const tiempoActual = horaActual * 60 + minutosActuales;
  const tiempoInicio = horaInicio.hora * 60 + horaInicio.minutos;
  const tiempoFin = horaFin.hora * 60 + horaFin.minutos;
  
  return tiempoActual >= tiempoInicio && tiempoActual <= tiempoFin;
}

async function actualizarIndiceGeografico(prestadorId, datosPrestador) {
  if (!datosPrestador.ubicacion) return;

  try {
    const indiceRef = admin.firestore()
      .collection('indices_geograficos')
      .doc(prestadorId);

    if (datosPrestador.disponibilidadActiva && datosPrestador.visibleEnMapa) {
      await indiceRef.set({
        prestadorId,
        ubicacion: datosPrestador.ubicacion,
        categoria: datosPrestador.categoriaSistema,
        actualizado: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await indiceRef.delete();
    }
  } catch (error) {
    console.error('Error actualizando índice geográfico:', error);
  }
}

async function registrarCambioDisponibilidad(prestadorId, disponible, motivo) {
  try {
    await admin.firestore()
      .collection('historial_disponibilidad')
      .add({
        prestadorId,
        disponible,
        motivo: motivo || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        tipo: 'manual'
      });
  } catch (error) {
    console.error('Error registrando cambio de disponibilidad:', error);
  }
}