
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializa Firebase Admin SDK.
// Es importante que esto se haga solo una vez.
// Si tienes otras funciones, esta inicialización puede estar en un archivo compartido.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

interface ServiceRequestData {
  estado?: string;
  usuarioId?: string;
  prestadorId?: string; // ID del proveedor
  monto?: number; // Monto del servicio para el pago
  // ... otros campos de la solicitud
}

interface ConfirmServiceCompletionData {
  solicitudId: string;
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
    const { solicitudId } = data;

    if (!solicitudId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere el argumento 'solicitudId'."
      );
    }

    const solicitudRef = db.collection("solicitudes").doc(solicitudId);

    try {
      // Usar una transacción para asegurar la atomicidad de las operaciones
      await db.runTransaction(async (transaction) => {
        const solicitudDoc = await transaction.get(solicitudRef);

        if (!solicitudDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `La solicitud con ID ${solicitudId} no fue encontrada.`
          );
        }

        const solicitudData = solicitudDoc.data() as ServiceRequestData;

        // 2. Verificar que el estado del servicio sea 'completado_por_prestador'
        if (solicitudData.estado !== "completado_por_prestador") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `La solicitud no está en el estado correcto para ser confirmada por el usuario. Estado actual: ${solicitudData.estado}. Se esperaba: completado_por_prestador.`
          );
        }

        // 3. Verificar que el ID del usuario coincida con el 'usuarioId' de la solicitud
        if (solicitudData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "El usuario no está autorizado para confirmar esta solicitud."
          );
        }

        // 4. Si las verificaciones se cumplen, actualizar el documento
        const updateData: { [key: string]: any } = {
          estado: "completado_por_usuario", // Cambiado según la solicitud
          fechaConfirmacion: admin.firestore.FieldValue.serverTimestamp(), // Cambiado según la solicitud
          habilitarCalificacion: true,
          paymentStatus: "retenido_para_liberacion", // Estado de pago después de confirmación del usuario
          // Inicia la ventana de 7 días para calificación/reclamo.
          ratingWindowExpiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ),
        };

        // Aplicar garantía
        // Suponiendo que tenemos acceso a la información de si el usuario es premium.
        const isUserPremium = context.auth.token.premium === true; // Asumiendo un custom claim 'premium'
        const standardWarrantyDays = 3;
        const premiumWarrantyDays = 7; // O 15/30 según lo requieras para garantía extendida
        const warrantyDurationDays = isUserPremium
          ? premiumWarrantyDays
          : standardWarrantyDays;
        
        updateData.warrantyEndDate = admin.firestore.Timestamp.fromMillis(
            Date.now() + warrantyDurationDays * 24 * 60 * 60 * 1000
        );

        transaction.update(solicitudRef, updateData);
      });

      // 5. Simulación de llamada a otra función que libere el pago retenido al prestador
      // La liberación real del pago se manejaría en la tarea programada que verifica
      // si han pasado los 7 días sin reclamos.
      console.log(
        `Proceso de retención de pago iniciado para la solicitud ${solicitudId}. El pago se liberará después del período de gracia si no hay reclamos.`
      );

      return {
        success: true,
        message: "Finalización del servicio confirmada exitosamente. Sistema de calificación activado, pago retenido y garantía aplicada.",
      };
    } catch (error) {
      console.error("Error al confirmar la finalización del servicio:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error; // Re-lanzar errores HttpsError para que el cliente los reciba correctamente
      }
      // Para otros errores, devolver un error genérico
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al procesar la solicitud.",
        (error as Error).message // Incluir mensaje original para depuración en logs
      );
    }
  }
);

// Podrías tener otras funciones aquí, por ejemplo:
// export const releasePaymentToProvider = functions.https.onCall(async (data, context) => { ... }); // Para liberación explícita
// export const handleNewRating = functions.firestore.document('solicitudes/{solicitudId}/calificaciones/{calificacionId}').onCreate(async (snap, context) => { ... });
// export const dailyAutomatedChecks = functions.pubsub.schedule('every 24 hours').onRun(async (context) => { ... }); // Para la liberación automática de pagos
    

    