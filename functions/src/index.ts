
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
  servicioId: string;
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

        if (servicioData.estado !== "completado_por_prestador") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Se esperaba: completado_por_prestador.`
          );
        }

        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "El usuario no está autorizado para confirmar este servicio."
          );
        }

        const updateData: { [key: string]: any } = {
          estado: "completado_por_usuario",
          fechaConfirmacion: admin.firestore.FieldValue.serverTimestamp(),
          habilitarCalificacion: true,
          paymentStatus: "retenido_para_liberacion",
          ratingWindowExpiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 días desde ahora
          ),
        };

        // Lógica de garantía
        const isUserPremium = context.auth?.token?.premium === true;
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

      console.log(
        `Proceso de retención de pago iniciado para el servicio ${servicioId}. El pago se liberará después del período de gracia si no hay reclamos.`
      );

      return {
        success: true,
        message: "Finalización del servicio confirmada exitosamente. Sistema de calificación activado, pago retenido y garantía aplicada.",
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

        // Validar que la ventana de calificación no haya expirado (si aplica)
        // Este chequeo es importante si el flag habilitarCalificacion se maneja por separado
        // o si puede haber un desfase. Si confirmServiceCompletionByUserService lo maneja bien,
        // este chequeo podría ser redundante.
        // if (servicioData.ratingWindowExpiresAt && admin.firestore.Timestamp.now() > servicioData.ratingWindowExpiresAt) {
        //   throw new functions.https.HttpsError(
        //     "failed-precondition",
        //     "La ventana para calificar este servicio ha expirado."
        //   );
        // }


        // 4. Guardar la calificación dentro del documento del servicio.
        const nuevaCalificacionUsuario: RatingData = {
          rating: calificacion,
          comment: comentario || "",
          date: admin.firestore.Timestamp.now(),
          userId: userId,
        };
        
        const updateServicioData: { [key: string]: any } = {
          calificacionUsuario: nuevaCalificacionUsuario,
          // Opcional: deshabilitar más calificaciones para este servicio por este usuario
          // habilitarCalificacion: false, // o un campo como 'calificacionUsuarioRealizada: true'
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

