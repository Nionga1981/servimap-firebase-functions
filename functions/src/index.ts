
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializa Firebase Admin SDK.
// Es importante que esto se haga solo una vez.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Interfaz para los datos del documento de servicio/solicitud
interface ServiceData {
  estado?: string;
  usuarioId?: string;
  prestadorId?: string; // ID del proveedor
  // ... otros campos relevantes del documento de servicio/solicitud
}

// Interfaz para los datos de entrada de la función
interface ConfirmServiceCompletionData {
  servicioId: string; // ID del documento en la colección "servicios"
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

    // Usamos el servicioId para referenciar el documento en la colección "servicios"
    const servicioRef = db.collection("servicios").doc(servicioId);

    try {
      // Usar una transacción para asegurar la atomicidad de las operaciones
      await db.runTransaction(async (transaction) => {
        const servicioDoc = await transaction.get(servicioRef);

        // Verificar que el documento del servicio existe
        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        // Comprobar que el estado actual del servicio sea "completado_por_prestador"
        if (servicioData.estado !== "completado_por_prestador") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Se esperaba: completado_por_prestador.`
          );
        }

        // Validar que quien confirma es el mismo usuario que solicitó el servicio
        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "El usuario no está autorizado para confirmar este servicio."
          );
        }

        // Si las verificaciones se cumplen, actualizar el documento
        const updateData: { [key: string]: any } = {
          estado: "completado_por_usuario", // Cambiado según la solicitud
          fechaConfirmacion: admin.firestore.FieldValue.serverTimestamp(), // Registrar fecha de confirmación
          habilitarCalificacion: true, // Activar bandera para calificación
          paymentStatus: "retenido_para_liberacion", // Estado de pago después de confirmación del usuario
          // Inicia la ventana de 7 días para calificación/reclamo.
          ratingWindowExpiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ),
        };

        // Aplicar lógica de garantía (se mantiene la simulación de premium)
        const isUserPremium = context.auth.token.premium === true; // Asumiendo un custom claim 'premium'
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

      // Simulación de llamada a otra función que libere el pago retenido al prestador
      // La liberación real del pago se manejaría en la tarea programada que verifica
      // si han pasado los 7 días sin reclamos.
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
        throw error; // Re-lanzar errores HttpsError para que el cliente los reciba correctamente
      }
      // Para otros errores, devolver un error genérico
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al procesar la solicitud.",
        error.message 
      );
    }
  }
);

// Podrías tener otras funciones aquí, por ejemplo:
// export const releasePaymentToProvider = functions.https.onCall(async (data, context) => { ... }); // Para liberación explícita
// export const handleNewRating = functions.firestore.document('servicios/{servicioId}/calificaciones/{calificacionId}').onCreate(async (snap, context) => { ... });
// export const dailyAutomatedChecks = functions.pubsub.schedule('every 24 hours').onRun(async (context) => { ... }); // Para la liberación automática de pagos
    
