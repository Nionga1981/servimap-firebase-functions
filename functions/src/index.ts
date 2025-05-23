
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializa Firebase Admin SDK.
// Es importante que esto se haga solo una vez.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Interfaz para los datos del documento de servicio
interface ServiceData {
  estado?: string;
  usuarioId?: string; // ID del usuario que solicitó el servicio
  prestadorId?: string; // ID del proveedor
  habilitarCalificacion?: boolean;
  calificacionUsuario?: RatingData; // Para verificar si ya calificó
  fechaConfirmacion?: admin.firestore.Timestamp;
  paymentStatus?: string;
  ratingWindowExpiresAt?: admin.firestore.Timestamp;
  warrantyEndDate?: admin.firestore.Timestamp;
  // ... otros campos relevantes
}

// Interfaz para los datos de una calificación
interface RatingData {
  rating: number;
  comment?: string;
  date: admin.firestore.Timestamp;
  userId: string;
}

// Interfaz para los datos del documento del prestador
interface ProviderData {
  ratingSum?: number;
  ratingCount?: number;
  rating?: number;
  // ... otros campos del prestador
}

// Interfaz para los datos de entrada de la función confirmServiceCompletionByUserService
interface ConfirmServiceCompletionData {
  servicioId: string; // Renombrado desde solicitudId para consistencia
}

/**
 * Firebase Function (onCall) para que un usuario confirme la finalización de un servicio.
 */
export const confirmServiceCompletionByUserService = functions.https.onCall(
  async (data: ConfirmServiceCompletionData, context) => {
    // 1. Verificar autenticación del usuario
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada mientras el usuario está autenticado."
      );
    }
    const userId = context.auth.uid;
    const { servicioId } = data;

    if (!servicioId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere el argumento 'servicioId'."
      );
    }

    const servicioRef = db.collection("servicios").doc(servicioId);

    try {
      await db.runTransaction(async (transaction) => {
        const servicioDoc = await transaction.get(servicioRef);

        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        // 2. Verificar que el campo `estado` del servicio sea exactamente `completado_por_prestador`.
        if (servicioData.estado !== "completado_por_prestador") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Se esperaba: completado_por_prestador.`
          );
        }

        // 3. Verificar que el ID del usuario que intenta confirmar coincida con el campo `usuarioId` del servicio.
        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "El usuario no está autorizado para confirmar este servicio."
          );
        }

        // 4. Si las verificaciones anteriores se cumplen:
        const updateData: { [key: string]: any } = {
          estado: "completado_por_usuario", // Cambiar el campo `estado` a `completado_por_usuario`.
          fechaConfirmacion: admin.firestore.FieldValue.serverTimestamp(), // Guardar la fecha y hora actual en `fechaConfirmacion`.
          habilitarCalificacion: true, // Activar la bandera `habilitarCalificacion: true`.
          paymentStatus: "retenido_para_liberacion",
          ratingWindowExpiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 días desde ahora
          ),
        };
        
        // Lógica de garantía (ejemplo, basada en custom claims)
        const isUserPremium = context.auth?.token?.premium === true; // Asume que tienes un custom claim 'premium'
        const standardWarrantyDays = 3;
        const premiumWarrantyDays = 7; 
        const warrantyDurationDays = isUserPremium
          ? premiumWarrantyDays
          : standardWarrantyDays;
        
        updateData.warrantyEndDate = admin.firestore.Timestamp.fromMillis(
            Date.now() + warrantyDurationDays * 24 * 60 * 60 * 1000
        );

        transaction.update(servicioRef, updateData);
      });

      // Simulación de llamada a otra función para liberar el pago (o marcar para liberación)
      // Esta lógica sería más compleja en un sistema real y podría involucrar una tarea programada.
      console.log(
        `Proceso de retención de pago iniciado para el servicio ${servicioId}. El pago se liberará después del período de gracia si no hay reclamos.`
      );

      return {
        success: true,
        message: "Finalización del servicio confirmada exitosamente. Sistema de calificación activado y pago retenido.",
      };
    } catch (error: any) {
      console.error("Error al confirmar la finalización del servicio:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al procesar la solicitud.",
        error.message 
      );
    }
  }
);


// Interfaz para los datos de entrada de la función rateProviderByUserService
interface RateProviderData {
  servicioId: string;
  calificacion: number; // 1 a 5 estrellas
  comentario?: string;
}

/**
 * Firebase Function (onCall) para que un usuario califique a un prestador.
 */
export const rateProviderByUserService = functions.https.onCall(
  async (data: RateProviderData, context) => {
    // 1. Validar que el usuario está autenticado.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada mientras el usuario está autenticado."
      );
    }
    const userId = context.auth.uid;
    const { servicioId, calificacion, comentario } = data;

    // Validar entrada
    if (!servicioId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere el argumento 'servicioId'."
      );
    }
    if (typeof calificacion !== 'number' || calificacion < 1 || calificacion > 5) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La calificación debe ser un número entre 1 y 5."
      );
    }

    const servicioRef = db.collection("servicios").doc(servicioId);

    try {
      await db.runTransaction(async (transaction) => {
        // 2. Buscar el documento del servicio.
        const servicioDoc = await transaction.get(servicioRef);
        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        // Verificar que el usuario actual es quien solicitó el servicio
        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "No estás autorizado para calificar este servicio."
          );
        }
        
        // 3. Verificar que habilitarCalificacion sea true y que no exista calificación previa.
        if (servicioData.habilitarCalificacion !== true) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "La calificación no está habilitada para este servicio."
          );
        }
        if (servicioData.calificacionUsuario) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Ya has calificado este servicio previamente."
          );
        }

        // 4. Guardar la calificación dentro del documento del servicio.
        const nuevaCalificacionUsuario: RatingData = {
          rating: calificacion,
          comment: comentario || "",
          date: admin.firestore.Timestamp.now(),
          userId: userId, // Opcional: redundante si el campo es calificacionUsuario
        };
        
        const updateServicioData: { [key: string]: any } = {
          calificacionUsuario: nuevaCalificacionUsuario,
          // Opcional: deshabilitar más calificaciones para este servicio por este usuario
          // habilitarCalificacion: false, 
        };


        // 5. Actualizar el promedio general del prestador en la colección `prestadores`.
        if (!servicioData.prestadorId) {
            console.error("Error: El servicio no tiene un prestadorId asociado.");
            throw new functions.https.HttpsError("internal", "El servicio no tiene un ID de prestador asociado.");
        }
        const prestadorRef = db.collection("prestadores").doc(servicioData.prestadorId);
        const prestadorDoc = await transaction.get(prestadorRef);

        if (!prestadorDoc.exists) {
          console.error(`Error: No se encontró el prestador con ID ${servicioData.prestadorId}. No se puede actualizar su calificación.`);
          // Decidir si esto debe ser un error fatal para la calificación o solo un warning.
          // Por ahora, permitiremos que la calificación se guarde en el servicio, pero no se actualizará el prestador.
        } else {
          const prestadorData = prestadorDoc.data() as ProviderData;
          const currentRatingSum = prestadorData.ratingSum || 0;
          const currentRatingCount = prestadorData.ratingCount || 0;

          const newRatingSum = currentRatingSum + calificacion;
          const newRatingCount = currentRatingCount + 1;
          const newAverageRating = parseFloat((newRatingSum / newRatingCount).toFixed(2)); // Asegurar 2 decimales

          transaction.update(prestadorRef, {
            ratingSum: newRatingSum,
            ratingCount: newRatingCount,
            rating: newAverageRating,
          });
        }
        
        // Actualizar el documento del servicio
        transaction.update(servicioRef, updateServicioData);

      });

      return {
        success: true,
        message: "Calificación guardada exitosamente.",
      };
    } catch (error: any) {
      console.error("Error al guardar la calificación:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al guardar la calificación.",
        error.message
      );
    }
  }
);

interface ReportarProblemaData {
  servicioId: string;
  motivo: string;
  urlEvidencia?: string;
}

/**
 * Firebase Function (onCall) para que un usuario reporte un problema con un servicio.
 */
export const reportarProblemaServicio = functions.https.onCall(
  async (data: ReportarProblemaData, context) => {
    // 1. Validar que el usuario está autenticado.
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
    }
    const usuarioId = context.auth.uid;
    const { servicioId, motivo, urlEvidencia } = data;

    // 2. Validar parámetros recibidos.
    if (!servicioId || !motivo) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren los argumentos 'servicioId' y 'motivo'.");
    }

    try {
      // 3. Verificar que el servicio exista.
      const servicioRef = db.collection("servicios").doc(servicioId);
      const servicioDoc = await servicioRef.get();

      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `El servicio con ID ${servicioId} no fue encontrado.`);
      }
      
      // Opcional: Verificar que el usuario que reporta es el 'usuarioId' del servicio.
      // const servicioData = servicioDoc.data() as ServiceData;
      // if (servicioData.usuarioId !== usuarioId) {
      //   throw new functions.https.HttpsError("permission-denied", "No estás autorizado para reportar un problema sobre este servicio.");
      // }

      // 4. Crear un nuevo documento en la colección `reportes`.
      const reporteData: { [key: string]: any } = {
        servicioId: servicioId,
        usuarioId: usuarioId, // UID del usuario autenticado
        motivo: motivo,
        fechaReporte: admin.firestore.FieldValue.serverTimestamp(), // Timestamp del servidor
        estado: "pendiente", // Estado inicial del reporte
      };

      if (urlEvidencia) {
        // Validar que urlEvidencia sea una URL válida si es necesario.
        // Por simplicidad, aquí solo la añadimos si existe.
        reporteData.urlEvidencia = urlEvidencia;
      }

      const reporteRef = await db.collection("reportes").add(reporteData);

      // Opcional: podrías actualizar el estado del servicio a "en_disputa" aquí también.
      // await servicioRef.update({ estado: "en_disputa", paymentStatus: "congelado_por_disputa" });

      // 5. Devolver un mensaje de confirmación con el ID del reporte creado.
      return {
        success: true,
        message: "Problema reportado exitosamente.",
        reporteId: reporteRef.id,
      };
    } catch (error: any) {
      console.error("Error al reportar el problema:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al reportar el problema.",
        error.message
      );
    }
  }
);

/**
 * Firebase Function (onCall) para obtener los servicios completados por el usuario.
 */
export const obtenerServiciosCompletados = functions.https.onCall(async (data, context) => {
  // 1. Validar que el usuario esté autenticado.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "La función debe ser llamada por un usuario autenticado."
    );
  }
  const usuarioId = context.auth.uid;

  try {
    // 2. Hacer una consulta a la colección `servicios` en Firestore.
    // 3. Recuperar todos los documentos cuyo campo `estado` sea igual a "completado_por_usuario"
    //    Y que pertenezcan al usuario autenticado.
    const querySnapshot = await db
      .collection("servicios")
      .where("usuarioId", "==", usuarioId)
      .where("estado", "==", "completado_por_usuario")
      .orderBy("fechaConfirmacion", "desc") // Opcional: ordenar por fecha de confirmación
      .get();

    const serviciosCompletados: any[] = [];
    querySnapshot.forEach((doc) => {
      serviciosCompletados.push({
        id: doc.id,
        ...doc.data(),
        // Puedes transformar las fechas de Timestamp a string si es necesario para el cliente.
        // fechaConfirmacion: doc.data().fechaConfirmacion?.toDate().toISOString(), 
      });
    });

    // 4. Devolver un arreglo JSON con los datos de cada documento.
    return serviciosCompletados;
  } catch (error: any) {
    console.error("Error al obtener servicios completados:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      "Ocurrió un error interno al obtener los servicios.",
      error.message
    );
  }
});

```