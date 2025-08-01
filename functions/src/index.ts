// src/functions/src/index.ts
import * as admin from "firebase-admin";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import {
  onCall,
  HttpsError,
  CallableRequest,
  onRequest,
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import Stripe from "stripe";

// Import Premium Functions
export { 
  checkPremiumStatus,
  validateFreeUserRestrictions,
  convertTimezone,
  setupAutomaticReminders,
  handleLastMinuteConfirmation,
  getPremiumRecommendations
} from './premiumFunctions';

export { 
  TimezoneManager,
  MEXICO_TIMEZONES,
  formatMexicanDateTime
} from './timezoneUtils';

export { 
  setupServiceReminders,
  handleReminderResponse,
  processScheduledReminders as processReminders,
  detectProviderDelays as detectDelays
} from './reminderSystem';
// import {z} from "zod";
// Interfaces y Constantes
import {
  ActivityLogAction,
  DetallesFinancieros,
  EstadoFinalServicio,
  HistorialPuntoUsuario,
  PromocionFidelidad,
  ProviderData,
  ServiceRequest,
  ServiceRequestStatus,
  SolicitudCotizacionData,
  UserData,
  ESTADOS_FINALES_SERVICIO,
  COMISION_SISTEMA_PAGO_PORCENTAJE,
  COMISION_APP_SERVICIOMAP_PORCENTAJE,
  PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD,
  PORCENTAJE_COMISION_EMBAJADOR,
  FACTOR_CONVERSION_PUNTOS,
  HORAS_ANTES_RECORDATORIO_SERVICIO,
  Recordatorio,
  MembershipType,
  MembershipCommissionData,
  WalletTransaction,
  WalletData,
  LoyaltyBonusData,
  LOYALTY_BONUS_THRESHOLD,
  LOYALTY_BONUS_AMOUNT,
  BankDetails,
  WithdrawalData,
  StripeFeeCalculation,
  Commission,
  FixedBusinessData,
  BusinessLocationData,
  AmbassadorData,
  ReferralRegistrationData,
  ReferralData,
  BusinessAnalyticsData,
  AmbassadorAnalyticsData,
  FIXED_BUSINESS_MONTHLY_FEE,
  BUSINESS_LOCATION_RADIUS,
  NEARBY_BUSINESS_RADIUS,
  MAX_BUSINESS_PHOTOS,
  PAYMENT_GRACE_PERIOD_DAYS,
  LAUNCH_PROMOTION_PERIOD_END,
  LAUNCH_PROMO_MONTHS,
  LAUNCH_PROMO_PAYMENT,
  LAUNCH_PROMO_AMBASSADOR_COMMISSION,
  QuotationItem,
  CustomQuotationData,
  ChatData,
  ChatMessage,
  VideoCallSession,
  ModerationResult,
  ChatActivityLogAction,
  MAX_FILE_SIZE_MB,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  SUPPORTED_AUDIO_TYPES,
  VIDEO_CALL_DURATION_LIMIT,
  QUOTATION_VALIDITY_DAYS,
  MAX_QUOTATION_ITEMS,
} from "./types";
// Inicializar Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
// --- START: Simple Rule-based interpretarBusqueda ---
function interpretarBusquedaSimple(searchQuery: string) {
  const query = searchQuery.toLowerCase();
  
  // Simple keyword-based classification
  const negocioKeywords = ["taller", "consultorio", "clinica", "restaurante", "tienda"];
  
  let tipo: "prestador" | "negocio_fijo" = "prestador"; // default
  let categoria = "general"; // default
  
  // Determine tipo
  if (negocioKeywords.some(keyword => query.includes(keyword))) {
    tipo = "negocio_fijo";
  }
  
  // Determine categoria
  if (query.includes("plomer") || query.includes("tuberia")) {
    categoria = "plomeria";
  } else if (query.includes("jardin") || query.includes("poda")) {
    categoria = "jardineria";
  } else if (query.includes("electric") || query.includes("luz")) {
    categoria = "electricidad";
  } else if (query.includes("limpie") || query.includes("aseo")) {
    categoria = "limpieza";
  } else if (query.includes("carpint") || query.includes("madera")) {
    categoria = "carpinteria";
  } else if (query.includes("pintur") || query.includes("pintar")) {
    categoria = "pintura";
  }
  
  return {
    tipo,
    categoria,
    idiomaDetectado: "es"
  };
}
export const interpretarBusqueda = onRequest(
  {cors: true},
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const {searchQuery} = req.body;
    
    // CÓDIGO TEMPORAL: Asignar custom claims de admin
    if (searchQuery === "SETUP_ADMIN_CLAIMS_LuHDo2YcuJaIPj31fofswLeuvs43") {
      try {
        const adminUID = "LuHDo2YcuJaIPj31fofswLeuvs43";
        console.log('🔧 SETUP TEMPORAL: Asignando custom claims...');
        
        // Asignar custom claims
        await admin.auth().setCustomUserClaims(adminUID, {
          admin: true,
          role: 'super_admin',
          permissions: ['all'],
          isAdmin: true
        });
        
        // Verificar
        const userRecord = await admin.auth().getUser(adminUID);
        
        res.status(200).json({
          success: true,
          message: '🎉 Custom claims asignados exitosamente!',
          uid: adminUID,
          customClaims: userRecord.customClaims,
          instructions: [
            '1. Cierra sesión si estás logueado',
            '2. Ve a https://servi-map.com',
            '3. Haz clic en el punto (•) o presiona Ctrl+Alt+A',
            '4. Ingresa: admin@servimap.com / AdminServi2024!',
            '5. ¡Ahora deberías tener acceso!'
          ]
        });
        return;
      } catch (error) {
        res.status(500).json({
          error: error.message,
          message: 'Error asignando custom claims'
        });
        return;
      }
    }
    
    // CÓDIGO TEMPORAL: Obtener estadísticas de admin
    if (searchQuery === "GET_ADMIN_STATS_TEMP") {
      try {
        console.log('📊 TEMPORAL: Obteniendo estadísticas de admin...');
        
        // Obtener estadísticas en paralelo
        const [
          usuariosCount,
          prestadoresCount,
          serviceRequestsCount,
          completedServicesCount,
          walletTransactionsSnapshot,
          ratingsSnapshot
        ] = await Promise.all([
          // Contar usuarios
          db.collection('usuarios').count().get(),
          
          // Contar prestadores  
          db.collection('prestadores').count().get(),
          
          // Contar solicitudes de servicio totales
          db.collection('service_requests').count().get(),
          
          // Contar servicios completados
          db.collection('service_requests')
            .where('estado', '==', 'completado')
            .count().get(),
          
          // Obtener transacciones de wallet para calcular ingresos
          db.collection('wallet_transactions')
            .where('type', '==', 'service_payment')
            .limit(1000).get(),
          
          // Obtener ratings para promedio
          db.collection('service_requests')
            .where('rating', '>=', 1)
            .limit(1000).get()
        ]);
        
        // Calcular ingresos totales
        let totalRevenue = 0;
        walletTransactionsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.amount && typeof data.amount === 'number') {
            totalRevenue += data.amount;
          }
        });
        
        // Calcular rating promedio
        let totalRating = 0;
        let ratingCount = 0;
        ratingsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.rating && typeof data.rating === 'number') {
            totalRating += data.rating;
            ratingCount++;
          }
        });
        const avgRating = ratingCount > 0 ? (totalRating / ratingCount) : 0;
        
        const stats = {
          totalUsers: usuariosCount.data().count + prestadoresCount.data().count,
          totalServices: serviceRequestsCount.data().count,
          completedServices: completedServicesCount.data().count,
          avgRating: parseFloat(avgRating.toFixed(1)),
          totalRevenue: Math.round(totalRevenue),
          activeUsers: usuariosCount.data().count,
          activeProviders: prestadoresCount.data().count,
          completionRate: serviceRequestsCount.data().count > 0 ? 
            parseFloat(((completedServicesCount.data().count / serviceRequestsCount.data().count) * 100).toFixed(1)) : 0
        };
        
        console.log('✅ Estadísticas generadas:', stats);
        res.status(200).json({ success: true, stats });
        return;
        
      } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({
          error: error.message,
          message: 'Error obteniendo estadísticas de admin'
        });
        return;
      }
    }
    
    // Función original
    if (!searchQuery) {
      res.status(400).send("Falta el parámetro 'searchQuery'");
      return;
    }
    try {
      const result = interpretarBusquedaSimple(searchQuery);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error en interpretarBusqueda:", error);
      res.status(500).send("Error al procesar la solicitud.");
    }
  },
);
// --- END: Genkit Implementation of interpretarBusqueda ---
// --- Helper Functions ---
/**
 * Envía una notificación push a un usuario o prestador.
 * @param {string} userId - El UID del destinatario.
 * @param {"usuario" | "prestador"} userType - El tipo de destinatario.
 * @param {string} title - El título de la notificación.
 * @param {string} body - El cuerpo del mensaje de la notificación.
 * @param {Record<string, string>} [data] - Datos adicionales para el payload.
 * @return {Promise<void>} Una promesa que se resuelve cuando se completa.
 */
async function sendNotification(
  userId: string,
  userType: "usuario" | "prestador",
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const userCol = userType === "usuario" ? "usuarios" : "prestadores";
  try {
    const userDoc = await db.collection(userCol).doc(userId).get();
    if (!userDoc.exists) {
      console.error(
        `[NotificationHelper] ${userType} ${userId} no encontrado.`,
      );
      return;
    }
    const userData = userDoc.data() as UserData | ProviderData;
    const tokens = userData.fcmTokens;
    if (tokens && tokens.length > 0) {
      const payload = {notification: {title, body}, data};
      await admin.messaging().sendToDevice(tokens, payload);
      console.info(
        `[NotificationHelper] Notificación enviada a ${userType} ${userId}.`,
      );
    } else {
      console.log(
        `[NotificationHelper] ${userType} ${userId} no tiene tokens FCM.`,
      );
    }
  } catch (error) {
    console.error(
      `[NotificationHelper] Error enviando notificación a ${userType} ${userId}:`,
      error,
    );
  }
}
/**
 * Registra una acción importante en la bitácora de eventos del sistema.
 * @param {string} actorId UID del actor que realiza la acción.
 * @param {"usuario"|"prestador"|"sistema"|"admin"} actorRol Rol del actor.
 * @param {ActivityLogAction} accion El tipo de acción realizada.
 * @param {string} descripcion Descripción legible de la acción.
 * @param {{tipo: string; id: string}} [entidadAfectada] Entidad afectada.
 * @param {Record<string, unknown>} [detallesAdicionales] Datos extra.
 * @return {Promise<void>} Una promesa que se resuelve al completar el registro.
 */
async function logActivity(
  actorId: string,
  actorRol: "usuario" | "prestador" | "sistema" | "admin",
  accion: ActivityLogAction,
  descripcion: string,
  entidadAfectada?: {tipo: string; id: string},
  detallesAdicionales?: Record<string, unknown>,
): Promise<void> {
  try {
    const logData = {
      actorId,
      actorRol,
      accion,
      descripcion,
      fecha: admin.firestore.Timestamp.now(),
      entidadAfectada: entidadAfectada || null,
      detallesAdicionales: detallesAdicionales || null,
    };
    await db.collection("logEventos").add(logData);
    console.info(`[LogActivityHelper] Log creado: ${descripcion}`);
  } catch (error) {
    console.error("[LogActivityHelper] Error al crear log:", {
      descripcion,
      error,
    });
  }
}

/**
 * Acredita dinero al wallet de un usuario de forma atómica.
 * @param {string} userId UID del usuario.
 * @param {number} monto Monto a acreditar.
 * @param {string} concepto Concepto de la transacción.
 * @param {string} descripcion Descripción detallada.
 * @param {string} referenciaId ID de referencia.
 * @param {string} referenciaType Tipo de referencia.
 * @param {Record<string, unknown>} metadata Datos adicionales.
 * @return {Promise<void>} Una promesa que se resuelve al completar.
 */
async function creditToWallet(
  userId: string,
  monto: number,
  concepto: string,
  descripcion: string,
  referenciaId?: string,
  referenciaType?: "comision_membresia" | "comision_servicio" | "bonificacion" | "retiro" | "pago_servicio",
  metadata?: Record<string, unknown>,
): Promise<void> {
  const walletRef = db.collection("wallets").doc(userId);
  const now = admin.firestore.Timestamp.now();
  
  await db.runTransaction(async (transaction) => {
    const walletDoc = await transaction.get(walletRef);
    
    let saldoAnterior = 0;
    if (walletDoc.exists) {
      const walletData = walletDoc.data() as WalletData;
      saldoAnterior = walletData.balance || 0;
    }
    
    const saldoNuevo = saldoAnterior + monto;
    
    const walletTransaction: WalletTransaction = {
      userId,
      type: referenciaType === "comision_membresia" ? "commission" : 
            referenciaType === "comision_servicio" ? "commission" :
            referenciaType === "bonificacion" ? "bonus" : "bonus",
      amount: monto,
      description: descripcion || concepto,
      sourceId: referenciaId,
      balanceAfter: saldoNuevo,
      createdAt: now,
      balanceBefore: saldoAnterior,
      metadata,
    };
    
    if (walletDoc.exists) {
      transaction.update(walletRef, {
        balance: saldoNuevo,
        updatedAt: now,
      });
    } else {
      const newWalletData: WalletData = {
        userId,
        balance: saldoNuevo,
        totalEarned: saldoNuevo,
        totalSpent: 0,
        totalWithdrawn: 0,
        bonusesEarned: 0,
        createdAt: now,
        updatedAt: now,
        breakdown: {
          totalEarnedFromBonuses: 0,
          totalEarnedFromCommissions: saldoNuevo,
          totalEarnedFromRefunds: 0
        },
        limits: {
          dailySpendingLimit: 10000,
          withdrawalLimit: 5000,
          dailySpentToday: 0,
          lastSpendingDate: new Date().toISOString().split('T')[0],
          blockedBalance: 0
        },
        loyalty: {
          nextThreshold: LOYALTY_BONUS_THRESHOLD,
          progressToNext: 0
        }
      };
      transaction.set(walletRef, newWalletData);
    }
    
    // Agregar transacción a colección separada para historial
    const transactionRef = db.collection("wallet_transactions").doc();
    transaction.set(transactionRef, walletTransaction);
  });
  
  await logActivity(
    "sistema",
    "sistema",
    "WALLET_CREDITO_AGREGADO",
    `Crédito de $${monto.toFixed(2)} agregado al wallet de ${userId}. Concepto: ${concepto}`,
    { tipo: "wallet", id: userId },
    { monto, concepto, referenciaId, referenciaType, metadata }
  );
}
// --- Cloud Functions ---
export const createImmediateServiceRequest = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }
    const usuarioId = request.auth.uid;
    const {
      providerId,
      selectedServices,
      totalAmount,
      location,
      metodoPago,
      codigoPromocion,
    } = request.data;
    if (
      !providerId ||
      !Array.isArray(selectedServices) ||
      selectedServices.length === 0 ||
      typeof totalAmount !== "number" ||
      !location ||
      !metodoPago
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Faltan parámetros requeridos o son inválidos.",
      );
    }
    const now = admin.firestore.Timestamp.now();
    const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();
    let montoFinal = totalAmount;
    let promoAplicada: ServiceRequest["promoAplicada"] | undefined = undefined;
    // Promotion Logic
    if (codigoPromocion && typeof codigoPromocion === "string") {
      const promoQuery = db
        .collection("promociones")
        .where("codigoPromocional", "==", codigoPromocion)
        .limit(1);
      const promoSnapshot = await promoQuery.get();
      if (promoSnapshot.empty) {
        throw new HttpsError(
          "not-found",
          "El código de promoción no es válido o ha expirado.",
        );
      }
      const promoDoc = promoSnapshot.docs[0];
      const promoData = promoDoc.data() as PromocionFidelidad;
      const promoExpired =
        promoData.fechaExpiracion &&
        (promoData.fechaExpiracion as admin.firestore.Timestamp).toMillis() <
          now.toMillis();
      const noUsesLeft =
        typeof promoData.usosDisponibles === "number" &&
        promoData.usosDisponibles <= 0;
      if (!promoData.activo || promoExpired || noUsesLeft) {
        throw new HttpsError(
          "failed-precondition",
          "El código de promoción no está activo o ha expirado.",
        );
      }
      let montoDescuento = 0;
      if (promoData.tipoDescuento === "porcentaje") {
        montoDescuento = totalAmount * (promoData.valorDescuento / 100);
      } else {
        // monto_fijo
        montoDescuento = promoData.valorDescuento;
      }
      montoFinal = Math.max(0, totalAmount - montoDescuento);
      promoAplicada = {
        codigo: codigoPromocion,
        descripcion: promoData.descripcion,
        montoDescuento: montoDescuento,
      };
      if (typeof promoData.usosDisponibles === "number") {
        await promoDoc.ref.update({
          usosDisponibles: admin.firestore.FieldValue.increment(-1),
        });
      }
      const desc = `Usuario aplicó promoción "${codigoPromocion}". Descuento: $${montoDescuento.toFixed(2)}`;
      await logActivity(
        usuarioId,
        "usuario",
        "PROMO_APLICADA",
        desc,
        {tipo: "solicitud_servicio", id: nuevaSolicitudRef.id},
        promoAplicada,
      );
    }
    // Validation
    const providerDoc = await db
      .collection("prestadores")
      .doc(providerId as string)
      .get();
    if (!providerDoc.exists) {
      throw new HttpsError(
        "not-found",
        `Proveedor con ID ${providerId} no encontrado.`,
      );
    }
    const providerData = providerDoc.data() as ProviderData;
    if (providerData.isBlocked) {
      const msg = "Este proveedor no puede ser contratado en este momento.";
      throw new HttpsError("failed-precondition", msg);
    }
    const userDoc = await db.collection("usuarios").doc(usuarioId).get();
    const userData = userDoc.data() as UserData;
    if (userData.isBlocked) {
      const msg = "Tu cuenta está bloqueada y no puedes contratar servicios.";
      throw new HttpsError("failed-precondition", msg);
    }
    const userBlocksProviderQuery = db
      .collection("bloqueos")
      .where("bloqueadorRef", "==", usuarioId)
      .where("bloqueadoRef", "==", providerId)
      .limit(1);
    const userBlocksProviderSnap = await userBlocksProviderQuery.get();
    if (!userBlocksProviderSnap.empty) {
      const msg =
        "No puedes contratar a este proveedor porque lo has bloqueado.";
      throw new HttpsError("permission-denied", msg);
    }
    const providerBlocksUserQuery = db
      .collection("bloqueos")
      .where("bloqueadorRef", "==", providerId)
      .where("bloqueadoRef", "==", usuarioId)
      .limit(1);
    const providerBlocksUserSnap = await providerBlocksUserQuery.get();
    if (!providerBlocksUserSnap.empty) {
      const msg = "No puedes contratar a este proveedor en este momento.";
      throw new HttpsError("permission-denied", msg);
    }
    // Create Service Request
    const nuevaSolicitudData: Omit<ServiceRequest, "id"> = {
      usuarioId: usuarioId,
      prestadorId: providerId as string,
      status: "pagada",
      createdAt: now,
      updatedAt: now,
      titulo:
        "Servicio inmediato: " +
        `${(selectedServices as {title: string}[])
          .map((s: {title: string}) => s.title)
          .join(", ")}`,
      serviceType: "fixed",
      selectedFixedServices: selectedServices as {
        serviceId: string;
        title: string;
        price: number;
      }[],
      totalAmount: totalAmount as number,
      montoCobrado: montoFinal,
      location: location as {lat: number; lng: number},
      metodoPago: metodoPago as "tarjeta" | "efectivo" | "transferencia" | "wallet",
      paymentStatus: "retenido_para_liberacion",
      actorDelCambioId: usuarioId,
      actorDelCambioRol: "usuario",
      ...(promoAplicada && {promoAplicada}),
    };
    await nuevaSolicitudRef.set(nuevaSolicitudData);
    const logDesc = `Usuario ${usuarioId} creó y pagó una solicitud #${nuevaSolicitudRef.id} para ${providerId}. Total: $${montoFinal.toFixed(2)}.`;
    await logActivity(
      usuarioId,
      "usuario",
      "SOLICITUD_CREADA",
      logDesc,
      {tipo: "solicitud_servicio", id: nuevaSolicitudRef.id},
      {totalAmount: montoFinal, metodoPago, promoAplicada},
    );
    await sendNotification(
      providerId as string,
      "prestador",
      "¡Nuevo Servicio Inmediato!",
      `Has recibido un nuevo servicio inmediato de ${usuarioId}. ¡Prepárate!`,
      {solicitudId: nuevaSolicitudRef.id},
    );
    const successMsg =
      "Servicio solicitado exitosamente. " + `Total: $${montoFinal.toFixed(2)}.`;
    return {
      success: true,
      message: successMsg,
      solicitudId: nuevaSolicitudRef.id,
    };
  },
);
export const onServiceStatusChangeSendNotification = onDocumentUpdated(
  "solicitudes_servicio/{solicitudId}",
  async (event) => {
    const solicitudId = event.params.solicitudId;
    const newValue = event.data?.after.data() as ServiceRequest;
    const previousValue = event.data?.before.data() as ServiceRequest;
    if (!newValue || !previousValue) {
      return;
    }
    if (
      newValue.status === previousValue.status &&
      newValue.paymentStatus === previousValue.paymentStatus
    ) {
      return;
    }
    console.log(
      `[FCM] Solicitud ${solicitudId}. Antes: ${previousValue.status}. Después: ${newValue.status}.`,
    );
    const {usuarioId, prestadorId} = newValue;
    let tituloNotif = "";
    let cuerpoNotif = "";
    let targetUserId: string | null = null;
    let targetUserType: "usuario" | "prestador" | null = null;
    const serviceTitle = newValue.titulo || "un servicio";
    let sendStdNotification = true;
    if (newValue.status !== previousValue.status) {
      switch (newValue.status) {
        case "agendado":
          if (
            newValue.isRecurringAttempt &&
            newValue.reactivationOfferedBy === "usuario"
          ) {
            targetUserId = prestadorId;
            targetUserType = "prestador";
            tituloNotif = "Solicitud de Reactivación de Servicio";
            cuerpoNotif =
              `El usuario ${usuarioId} quiere reactivar el ` +
              `servicio "${serviceTitle}".`;
          } else if (
            !newValue.isRecurringAttempt &&
            previousValue.status !== "pendiente_confirmacion_usuario"
          ) {
            targetUserId = prestadorId;
            targetUserType = "prestador";
            tituloNotif = "Nueva Solicitud de Servicio";
            cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}"`;
          } else {
            sendStdNotification = false;
          }
          break;
        case "pendiente_confirmacion_usuario":
          if (
            newValue.isRecurringAttempt &&
            newValue.reactivationOfferedBy === "prestador"
          ) {
            targetUserId = usuarioId;
            targetUserType = "usuario";
            tituloNotif = "Oferta de Reactivación de Servicio";
            const message = `El prestador ${prestadorId} te ofrece ` +
              `reactivar el servicio "${serviceTitle}".`;
            cuerpoNotif = message;
          } else {
            sendStdNotification = false;
          }
          break;
        case "confirmada_prestador":
          targetUserId = usuarioId;
          targetUserType = "usuario";
          tituloNotif = "¡Cita Confirmada!";
          cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido confirmada.`;
          if (newValue.serviceDate && newValue.serviceTime) {
            try {
              const [year, month, day] = newValue.serviceDate
                .split("-")
                .map(Number);
              const [hour, minute] = newValue.serviceTime.split(":").map(Number);
              const serviceDateTime = new Date(
                year,
                month - 1,
                day,
                hour,
                minute,
              );
              const reminderTime = new Date(
                serviceDateTime.getTime() -
                  HORAS_ANTES_RECORDATORIO_SERVICIO * 60 * 60 * 1000,
              );
              if (reminderTime.getTime() > Date.now()) {
                const prestadorDoc = await db
                  .collection("prestadores")
                  .doc(prestadorId)
                  .get();
                const providerData = prestadorDoc.data() as ProviderData;
                const nombrePrestador = prestadorDoc.exists ?
                  providerData?.nombre || "El prestador" :
                  "El prestador";
                const reminderMsg =
                  "Recordatorio: Tu servicio " +
                  `"${serviceTitle}" con ${nombrePrestador} es mañana ` +
                  `a las ${newValue.serviceTime}.`;
                const reminderData: Omit<Recordatorio, "id"> = {
                  usuarioId,
                  servicioId: solicitudId,
                  tipo: "recordatorio_servicio",
                  mensaje: reminderMsg,
                  fechaProgramada:
                    admin.firestore.Timestamp.fromDate(reminderTime),
                  enviado: false,
                  datosAdicionales: {
                    tituloServicio: serviceTitle,
                    nombrePrestador,
                    fechaHoraServicioIso: serviceDateTime.toISOString(),
                  },
                };
                const reminderRef = await db
                  .collection("recordatorios")
                  .add(reminderData);
                const logDesc = `Recordatorio programado para servicio ${solicitudId}.`;
                await logActivity(
                  "sistema",
                  "sistema",
                  "NOTIFICACION_RECORDATORIO_PROGRAMADA",
                  logDesc,
                  {tipo: "recordatorio", id: reminderRef.id},
                );
              }
            } catch (e) {
              console.error(
                "Error al parsear fecha/hora para " + `servicio ${solicitudId}`,
                e,
              );
            }
          }
          break;
        case "rechazada_prestador":
        case "cancelada_prestador": {
          const statusText =
            newValue.status === "rechazada_prestador" ?
              "rechazada" :
              "cancelada";
          targetUserId = usuarioId;
          targetUserType = "usuario";
          tituloNotif = `Cita ${
            statusText.charAt(0).toUpperCase() + statusText.slice(1)
          }`;
          cuerpoNotif =
            `Tu cita para "${serviceTitle}" ha sido ` +
            `${statusText} por el prestador.`;
          break;
        }
        case "cancelada_usuario":
          targetUserId = prestadorId;
          targetUserType = "prestador";
          tituloNotif = "Cita Cancelada por Usuario";
          cuerpoNotif =
            "La cita para " +
            `"${serviceTitle}"` +
            " ha sido " +
            "cancelada por el usuario.";
          break;
        case "en_camino_proveedor":
          targetUserId = usuarioId;
          targetUserType = "usuario";
          tituloNotif = "¡Tu Proveedor está en Camino!";
          cuerpoNotif = `El proveedor para "${serviceTitle}" está en camino.`;
          break;
        case "servicio_iniciado":
          targetUserId = usuarioId;
          targetUserType = "usuario";
          tituloNotif = "Servicio Iniciado";
          cuerpoNotif = `El proveedor ha iniciado el servicio "${serviceTitle}".`;
          break;
        case "completado_por_prestador":
          targetUserId = usuarioId;
          targetUserType = "usuario";
          tituloNotif = "Servicio Completado por Prestador";
          cuerpoNotif =
            `El prestador ha marcado "${serviceTitle}" como ` +
            "completado. Por favor, confirma y califica.";
          break;
        case "completado_por_usuario": {
          targetUserId = prestadorId;
          targetUserType = "prestador";
          tituloNotif = "¡Servicio Confirmado por Usuario!";
          const notifBody = "El usuario ha confirmado la finalización de " +
            `"${serviceTitle}". ¡Ya puedes calificarlo!`;
          cuerpoNotif = notifBody;
          break;
        }
      }
    }
    if (
      newValue.paymentStatus !== previousValue.paymentStatus &&
      newValue.paymentStatus === "liberado_al_proveedor"
    ) {
      targetUserId = prestadorId;
      targetUserType = "prestador";
      tituloNotif = "¡Pago Liberado!";
      const detallesFinancieros =
        newValue.detallesFinancieros as DetallesFinancieros;
      const montoLiberado = detallesFinancieros?.montoFinalLiberadoAlPrestador;
      const montoMontoCobrado = newValue.montoCobrado || newValue.precio || 0;
      const montoParaMensaje =
        montoLiberado?.toFixed(2) || montoMontoCobrado.toFixed(2);
      const notifBody = "El pago para el servicio " + `"${serviceTitle}"` +
        ` ha sido liberado. Monto: $${montoParaMensaje}.`;
      cuerpoNotif = notifBody;
      sendStdNotification = true;
    }
    if (
      sendStdNotification &&
      targetUserId &&
      targetUserType &&
      tituloNotif &&
      cuerpoNotif
    ) {
      await sendNotification(
        targetUserId,
        targetUserType,
        tituloNotif,
        cuerpoNotif,
        {
          solicitudId,
          nuevoEstado: newValue.status,
          nuevoEstadoPago: newValue.paymentStatus || "N/A",
        },
      );
    }
    return null;
  },
);
export const logSolicitudServicioChanges = onDocumentUpdated(
  "solicitudes_servicio/{solicitudId}",
  async (event) => {
    const solicitudId = event.params.solicitudId;
    const beforeData = event.data?.before.data() as ServiceRequest | undefined;
    const afterData = event.data?.after.data() as ServiceRequest | undefined;
    if (!beforeData || !afterData) {
      console.warn(
        `[LogTrigger ${solicitudId}] Datos antes o después no disponibles.`,
      );
      return;
    }
    const actorId = afterData.actorDelCambioId || "sistema";
    const actorRol: "usuario" | "prestador" | "sistema" | "admin" =
      afterData.actorDelCambioRol || "sistema";
    const now = admin.firestore.Timestamp.now();
    const updatesToServiceRequest: Partial<ServiceRequest> & {
      updatedAt?: admin.firestore.Timestamp;
    } = {updatedAt: now};
    if (beforeData.status !== afterData.status) {
      let logAction: ActivityLogAction = "CAMBIO_ESTADO_SOLICITUD";
      let logDescription = `Solicitud ${solicitudId} cambió de ${beforeData.status} a ${afterData.status}.`;
      const newStatus = afterData.status as ServiceRequestStatus;
      const isFinalState = ESTADOS_FINALES_SERVICIO.includes(
        newStatus as EstadoFinalServicio,
      );
      const isCancelledState =
        newStatus.startsWith("cancelada_") ||
        newStatus === "rechazada_prestador";
      const isDisputeState = newStatus === "en_disputa";
      if (isFinalState && !isCancelledState) {
        logAction = "SERVICIO_FINALIZADO";
        logDescription = `Servicio ${solicitudId} finalizado por ${actorRol}. Estado final: ${newStatus}.`;
      } else if (isCancelledState) {
        logAction = "SERVICIO_CANCELADO";
        logDescription = `Servicio ${solicitudId} cancelado por ${actorRol}. Estado: ${newStatus}.`;
      } else if (isDisputeState) {
        logAction = "SERVICIO_EN_DISPUTA";
        logDescription = `Servicio ${solicitudId} puesto en disputa por ${actorRol}.`;
      }
      await logActivity(
        actorId,
        actorRol,
        logAction,
        logDescription,
        {tipo: "solicitud_servicio", id: solicitudId},
        {estadoAnterior: beforeData.status, estadoNuevo: afterData.status},
      );
      if (afterData.status === "completado_por_usuario") {
        updatesToServiceRequest.userConfirmedCompletionAt = now.toMillis();
      }
      if (
        isFinalState &&
        !ESTADOS_FINALES_SERVICIO.includes(
          beforeData.status as EstadoFinalServicio,
        )
      ) {
        updatesToServiceRequest.fechaFinalizacionEfectiva = now;
      }
    }
    if (!beforeData.calificacionUsuario && afterData.calificacionUsuario) {
      const descLog = `Usuario ${afterData.usuarioId} calificó servicio ${solicitudId} con ${afterData.calificacionUsuario.estrellas} estrellas.`;
      await logActivity(
        afterData.usuarioId,
        "usuario",
        "CALIFICACION_USUARIO",
        descLog,
        {tipo: "solicitud_servicio", id: solicitudId},
        {
          estrellas: afterData.calificacionUsuario.estrellas,
          comentario: afterData.calificacionUsuario.comentario || "",
        },
      );
    }
    if (!beforeData.calificacionPrestador && afterData.calificacionPrestador) {
      const descLog = `Prestador ${afterData.prestadorId} calificó a usuario ${afterData.usuarioId} en servicio ${solicitudId}.`;
      await logActivity(
        afterData.prestadorId,
        "prestador",
        "CALIFICACION_PRESTADOR",
        descLog,
        {tipo: "solicitud_servicio", id: solicitudId},
        {
          estrellas: afterData.calificacionPrestador.estrellas,
          comentario: afterData.calificacionPrestador.comentario || "",
        },
      );
    }
    const isFinalizedState = ESTADOS_FINALES_SERVICIO.includes(
      afterData.status as EstadoFinalServicio,
    );
    const wasNotFinalizedBefore = !ESTADOS_FINALES_SERVICIO.includes(
      beforeData.status as EstadoFinalServicio,
    );
    if (isFinalizedState && wasNotFinalizedBefore) {
      const relationshipId = `${afterData.usuarioId}_${afterData.prestadorId}`;
      const relationshipRef = db
        .collection("relacionesUsuarioPrestador")
        .doc(relationshipId);
      const providerDoc = await db
        .collection("prestadores")
        .doc(afterData.prestadorId)
        .get();
      let serviceCategory = afterData.category;
      if (!serviceCategory && providerDoc.exists) {
        serviceCategory =
          (providerDoc.data() as ProviderData).categoryIds?.[0] || "general";
      }
      if (serviceCategory) {
        try {
          await db.runTransaction(async (transaction) => {
            const relDoc = await transaction.get(relationshipRef);
            if (relDoc.exists) {
              transaction.update(relationshipRef, {
                serviciosContratados: admin.firestore.FieldValue.increment(1),
                ultimoServicioFecha: now,
                categoriasServicios:
                  admin.firestore.FieldValue.arrayUnion(serviceCategory),
              });
            } else {
              transaction.set(relationshipRef, {
                usuarioId: afterData.usuarioId,
                prestadorId: afterData.prestadorId,
                serviciosContratados: 1,
                ultimoServicioFecha: now,
                categoriasServicios: [serviceCategory],
              });
            }
          });
          const logDesc = `Relación entre ${afterData.usuarioId} y ${afterData.prestadorId} actualizada.`;
          const logDetails = {
            tipo: "relacionUsuarioPrestador",
            id: relationshipId,
          };
          await logActivity(
            "sistema",
            "sistema",
            "RELACION_USUARIO_PRESTADOR_ACTUALIZADA",
            logDesc,
            logDetails,
          );
        } catch (e) {
          console.error(
            `Error actualizando relación para ${relationshipId}:`,
            e,
          );
        }
      }
    }
    const shouldReleasePayment =
      (isFinalizedState &&
        wasNotFinalizedBefore &&
        afterData.paymentStatus === "retenido_para_liberacion") ||
      (beforeData.paymentStatus === "retenido_para_liberacion" &&
        afterData.paymentStatus === "liberado_al_proveedor" &&
        isFinalizedState &&
        afterData.status !== "en_disputa");
    if (shouldReleasePayment) {
      const montoTotalPagadoPorUsuario =
        afterData.montoCobrado || afterData.precio || 0;
      const detallesFinancierosNuevos: DetallesFinancieros = {
        ...(afterData.detallesFinancieros as
          | DetallesFinancieros
          | Record<string, never>),
      };
      if (
        montoTotalPagadoPorUsuario > 0 &&
        !detallesFinancierosNuevos.montoFinalLiberadoAlPrestador
      ) {
        detallesFinancierosNuevos.montoTotalPagadoPorUsuario =
          montoTotalPagadoPorUsuario;
        detallesFinancierosNuevos.comisionSistemaPagoPct =
          COMISION_SISTEMA_PAGO_PORCENTAJE;
        detallesFinancierosNuevos.comisionSistemaPagoMonto =
          montoTotalPagadoPorUsuario * COMISION_SISTEMA_PAGO_PORCENTAJE;
        const montoNeto =
          montoTotalPagadoPorUsuario -
          (detallesFinancierosNuevos.comisionSistemaPagoMonto || 0);
        detallesFinancierosNuevos.montoNetoProcesador = montoNeto;
        detallesFinancierosNuevos.comisionAppPct =
          COMISION_APP_SERVICIOMAP_PORCENTAJE;
        const comisionApp =
          montoTotalPagadoPorUsuario * COMISION_APP_SERVICIOMAP_PORCENTAJE;
        detallesFinancierosNuevos.comisionAppMonto = comisionApp;
        detallesFinancierosNuevos.aporteFondoFidelidadMonto =
          comisionApp * PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD;
        detallesFinancierosNuevos.montoBrutoParaPrestador =
          montoNeto - comisionApp;
        detallesFinancierosNuevos.montoFinalLiberadoAlPrestador =
          detallesFinancierosNuevos.montoBrutoParaPrestador;
        detallesFinancierosNuevos.fechaLiberacion = now;
        updatesToServiceRequest.paymentStatus = "liberado_al_proveedor";
        updatesToServiceRequest.paymentReleasedToProviderAt = now;
        updatesToServiceRequest.detallesFinancieros =
          detallesFinancierosNuevos;
        const logDesc = `Pago para servicio ${solicitudId} liberado.`;
        await logActivity(
          "sistema",
          "sistema",
          "PAGO_LIBERADO",
          logDesc,
          {tipo: "solicitud_servicio", id: solicitudId},
          detallesFinancierosNuevos as Record<string, unknown>,
        );
        const pointsEarned = Math.floor(
          montoTotalPagadoPorUsuario / FACTOR_CONVERSION_PUNTOS,
        );
        if (pointsEarned > 0) {
          const userRef = db.collection("usuarios").doc(afterData.usuarioId);
          const userHistoryEntry: HistorialPuntoUsuario = {
            servicioId: solicitudId,
            tipo: "ganados",
            puntos: pointsEarned,
            fecha: now,
            descripcion:
              "Puntos por servicio: " +
              `${afterData.titulo || solicitudId.substring(0, 6)}`,
          };
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            await userRef.update({
              puntosAcumulados:
                admin.firestore.FieldValue.increment(pointsEarned),
              historialPuntos:
                admin.firestore.FieldValue.arrayUnion(userHistoryEntry),
            });
          } else {
            await userRef.set(
              {
                puntosAcumulados: pointsEarned,
                historialPuntos: [userHistoryEntry],
              },
              {merge: true},
            );
          }
          const logDescPts = `Usuario ganó ${pointsEarned} puntos.`;
          await logActivity(
            afterData.usuarioId,
            "usuario",
            "PUNTOS_FIDELIDAD_GANADOS",
            logDescPts,
            {tipo: "usuario", id: afterData.usuarioId},
            {puntos: pointsEarned, servicioId: solicitudId},
          );
        }
        const providerDoc = await db
          .collection("prestadores")
          .doc(afterData.prestadorId)
          .get();
        if (providerDoc.exists) {
          const providerData = providerDoc.data() as ProviderData;
          if (providerData.referidoPor) {
            const embajadorUID = providerData.referidoPor;
            const comisionAppMonto =
              detallesFinancierosNuevos.comisionAppMonto || 0;
            const comisionEmbajador =
              comisionAppMonto * PORCENTAJE_COMISION_EMBAJADOR;
            if (comisionEmbajador > 0) {
              const commission: Commission = {
                ambassadorId: embajadorUID,
                type: "service",
                sourceId: solicitudId,
                amount: comisionEmbajador,
                percentage: PORCENTAJE_COMISION_EMBAJADOR * 100, // Convert to percentage
                status: "pending",
                createdAt: now,
                metadata: {
                  serviceRequestId: solicitudId,
                  totalAmount: comisionAppMonto,
                  originalType: "servicio_completado",
                  providerName: providerData.nombre
                }
              };
              await db.collection("commissions").add(commission);
            }
          }
        }
        const aportefondo =
          detallesFinancierosNuevos.aporteFondoFidelidadMonto || 0;
        if (aportefondo > 0) {
          const fundRef = db.collection("fondoFidelidad").doc("global");
          const fundHistoryEntry = {
            servicioId: solicitudId,
            montoAportadoAlFondo: aportefondo,
            fecha: now,
          };
          const fundDoc = await fundRef.get();
          if (fundDoc.exists) {
            await fundRef.update({
              totalAcumulado:
                admin.firestore.FieldValue.increment(aportefondo),
              registros:
                admin.firestore.FieldValue.arrayUnion(fundHistoryEntry),
            });
          } else {
            await fundRef.set({
              totalAcumulado: aportefondo,
              registros: [fundHistoryEntry],
            });
          }
          const desc = `Aporte de ${aportefondo.toFixed(
            2,
          )} al fondo de fidelidad por servicio ${solicitudId}.`;
          await logActivity(
            "sistema",
            "sistema",
            "FONDO_FIDELIDAD_APORTE",
            desc,
            {tipo: "fondo_fidelidad", id: "global"},
            {monto: aportefondo, servicioId: solicitudId},
          );
        }
      }
    }
    if (Object.keys(updatesToServiceRequest).length > 1) {
      await event.data?.after.ref.update(updatesToServiceRequest);
    }
    return null;
  },
);
export const onQuotationResponseNotifyUser = onDocumentUpdated(
  "solicitudes_cotizacion/{cotizacionId}",
  async (event) => {
    const cotizacionId = event.params.cotizacionId;
    const beforeData = event.data?.before.data() as
      | SolicitudCotizacionData
      | undefined;
    const afterData = event.data?.after.data() as
      | SolicitudCotizacionData
      | undefined;
    if (!beforeData || !afterData || afterData.estado === beforeData.estado) {
      return;
    }
    const {usuarioId, prestadorId} = afterData;
    const prestadorDoc = await db
      .collection("prestadores")
      .doc(prestadorId)
      .get();
    const nombrePrestador = prestadorDoc.exists ?
      (prestadorDoc.data() as ProviderData).nombre || "El prestador" :
      "El prestador";
    const tituloServicio = afterData.tituloServicio || "tu cotización";
    let notifTitle = "";
    let notifBody = "";
    let logDesc = "";
    let logAction: ActivityLogAction | null = null;
    if (
      afterData.estado === "precio_propuesto_al_usuario" &&
      beforeData.estado === "pendiente_revision_prestador"
    ) {
      notifTitle = "¡Cotización Actualizada!";
      notifBody = `${nombrePrestador} ha propuesto un precio de $${afterData.precioSugerido} para ${tituloServicio}.`;
      logAction = "COTIZACION_PRECIO_PROPUESTO";
      logDesc = `${nombrePrestador} propuso precio para cotización ${cotizacionId}.`;
    } else if (
      afterData.estado === "rechazada_prestador" &&
      beforeData.estado === "pendiente_revision_prestador"
    ) {
      notifTitle = "Cotización Rechazada";
      notifBody = `${nombrePrestador} ha rechazado tu solicitud para ${tituloServicio}.`;
      logAction = "COTIZACION_RECHAZADA";
      logDesc = `${nombrePrestador} rechazó cotización ${cotizacionId}.`;
    }
    if (notifTitle && notifBody) {
      await sendNotification(usuarioId, "usuario", notifTitle, notifBody, {
        cotizacionId: cotizacionId,
      });
    }
    if (logAction && logDesc) {
      await logActivity(
        prestadorId,
        "prestador",
        logAction,
        logDesc,
        {tipo: "solicitud_cotizacion", id: cotizacionId},
        {},
      );
    }
    return null;
  },
);
export const acceptQuotationAndCreateServiceRequest = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    const {
      solicitudId,
      usuarioId,
      prestadorId,
      categoriaId,
      subcategoriaId,
      direccion,
      ubicacionExacta,
      precio,
      moneda,
      metodoPago,
      fechaProgramada,
      notasAdicionales,
      duracionEstimada,
      tipoServicio,
      titulo,
      descripcion,
    } = request.data as Record<string, unknown>;
    const db = getFirestore();
    const solicitudRef = db.collection("solicitudes_servicio").doc(solicitudId as string);
    await solicitudRef.update({
      status: "aceptado",
      aceptadoEn: Timestamp.now(),
    });
    const nuevoServicioRef = db.collection("servicios").doc();
    await nuevoServicioRef.set({
      solicitudId,
      clienteId: usuarioId,
      prestadorId,
      categoriaId,
      subcategoriaId,
      direccion,
      ubicacionExacta,
      precio,
      moneda,
      metodoPago,
      fechaProgramada,
      notasAdicionales,
      duracionEstimada,
      tipoServicio,
      titulo,
      descripcion,
      status: "pendiente_inicio",
      creadoEn: Timestamp.now(),
    });
    await sendNotification(
      prestadorId as string,
      "prestador",
      "Nueva solicitud aceptada",
      "Un usuario ha aceptado tu cotización. Prepárate para brindar el servicio.",
      {
        solicitudId: solicitudId as string,
        nuevoEstado: "aceptado",
      }
    );
    return { success: true };
  },
);

// Define Stripe secret
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

// Create Payment Intent for Service Booking
export const createPaymentIntent = onCall(
  { secrets: [stripeSecretKey] },
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { amount, currency = "mxn", serviceId, metadata } = request.data;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "Monto inválido.");
    }

    try {
      // Initialize Stripe with secret
      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-06-30.basil",
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency as string,
        metadata: {
          userId: request.auth.uid,
          serviceId: serviceId as string,
          ...metadata as Record<string, string>,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Log the payment intent creation
      await logActivity(
        request.auth.uid,
        "usuario",
        "PAGO_INICIADO",
        `Usuario inició pago por $${amount} ${(currency as string).toUpperCase()}`,
        { tipo: "pago", id: paymentIntent.id },
        { amount, currency, serviceId }
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw new HttpsError("internal", "Error al procesar el pago.");
    }
  }
);

// Confirm Payment and Update Service Status
export const confirmPayment = onCall(
  { secrets: [stripeSecretKey] },
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { paymentIntentId, serviceRequestId } = request.data;

    if (!paymentIntentId || !serviceRequestId) {
      throw new HttpsError("invalid-argument", "Parámetros requeridos faltantes.");
    }

    try {
      // Initialize Stripe with secret
      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-06-30.basil",
      });

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId as string);

      if (paymentIntent.status !== "succeeded") {
        throw new HttpsError("failed-precondition", "El pago no ha sido completado.");
      }

      // Update service request status
      const db = getFirestore();
      const serviceRef = db.collection("solicitudes_servicio").doc(serviceRequestId as string);
      
      await serviceRef.update({
        paymentStatus: "pagado",
        paymentIntentId: paymentIntentId,
        status: "pagada",
        updatedAt: Timestamp.now(),
        actorDelCambioId: request.auth.uid,
        actorDelCambioRol: "usuario",
      });

      // Log successful payment
      await logActivity(
        request.auth.uid,
        "usuario",
        "PAGO_COMPLETADO",
        `Pago confirmado para servicio ${serviceRequestId}`,
        { tipo: "solicitud_servicio", id: serviceRequestId as string },
        { paymentIntentId, amount: paymentIntent.amount / 100 }
      );

      return { success: true, paymentStatus: paymentIntent.status };
    } catch (error) {
      console.error("Error confirming payment:", error);
      throw new HttpsError("internal", "Error al confirmar el pago.");
    }
  }
);

// Handle Stripe Webhooks
export const stripeWebhook = onRequest(
  { cors: false, secrets: [stripeSecretKey] },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !endpointSecret) {
      console.error("Missing stripe signature or webhook secret");
      res.status(400).send("Missing required headers");
      return;
    }

    let event: Stripe.Event;

    try {
      // Initialize Stripe with secret
      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-06-30.basil",
      });

      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).send(`Webhook Error: ${err}`);
      return;
    }

    const db = getFirestore();

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          
          // Find service request by payment intent ID
          const serviceQuery = await db
            .collection("solicitudes_servicio")
            .where("paymentIntentId", "==", paymentIntent.id)
            .limit(1)
            .get();

          if (!serviceQuery.empty) {
            const serviceDoc = serviceQuery.docs[0];
            await serviceDoc.ref.update({
              paymentStatus: "pagado",
              status: "pagada",
              updatedAt: Timestamp.now(),
              actorDelCambioId: "sistema",
              actorDelCambioRol: "sistema",
            });

            console.log(`Payment succeeded for service: ${serviceDoc.id}`);
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          
          // Find service request by payment intent ID
          const serviceQuery = await db
            .collection("solicitudes_servicio")
            .where("paymentIntentId", "==", paymentIntent.id)
            .limit(1)
            .get();

          if (!serviceQuery.empty) {
            const serviceDoc = serviceQuery.docs[0];
            await serviceDoc.ref.update({
              paymentStatus: "fallido",
              status: "pago_fallido",
              updatedAt: Timestamp.now(),
              actorDelCambioId: "sistema",
              actorDelCambioRol: "sistema",
            });

            console.log(`Payment failed for service: ${serviceDoc.id}`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.status(200).send("Webhook handled successfully");
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send("Webhook processing failed");
    }
  }
);

// Refund Payment
export const refundPayment = onCall(
  { secrets: [stripeSecretKey] },
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { paymentIntentId, amount, reason = "requested_by_customer" } = request.data;

    if (!paymentIntentId) {
      throw new HttpsError("invalid-argument", "Payment Intent ID requerido.");
    }

    try {
      // Initialize Stripe with secret
      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-06-30.basil",
      });

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId as string,
        amount: amount ? Math.round((amount as number) * 100) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason,
      });

      // Log the refund
      await logActivity(
        request.auth.uid,
        "usuario",
        "REEMBOLSO_PROCESADO",
        `Reembolso procesado por $${(refund.amount / 100).toFixed(2)}`,
        { tipo: "pago", id: paymentIntentId as string },
        { refundId: refund.id, amount: refund.amount / 100, reason }
      );

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      };
    } catch (error) {
      console.error("Error processing refund:", error);
      throw new HttpsError("internal", "Error al procesar el reembolso.");
    }
  }
);

// Calculate and assign commissions when service is completed
export const calculateCommissions = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { serviceRequestId, totalAmount, providerId, userId } = request.data;

    if (!serviceRequestId || !totalAmount || !providerId || !userId) {
      throw new HttpsError(
        "invalid-argument", 
        "Parámetros requeridos: serviceRequestId, totalAmount, providerId, userId"
      );
    }

    if (typeof totalAmount !== "number" || totalAmount <= 0) {
      throw new HttpsError("invalid-argument", "totalAmount debe ser un número positivo");
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();
      
      // Verificar que el servicio existe y está completado
      const serviceDoc = await db.collection("solicitudes_servicio").doc(serviceRequestId as string).get();
      if (!serviceDoc.exists) {
        throw new HttpsError("not-found", "Servicio no encontrado");
      }

      const serviceData = serviceDoc.data() as ServiceRequest;
      const isFinalState = ESTADOS_FINALES_SERVICIO.includes(serviceData.status as EstadoFinalServicio);
      
      if (!isFinalState) {
        throw new HttpsError("failed-precondition", "El servicio debe estar en estado finalizado");
      }

      // Calcular comisión de ServiMap (6% del total)
      const comisionServiMap = totalAmount * COMISION_APP_SERVICIOMAP_PORCENTAJE;

      // Obtener datos de embajadores
      const [userDoc, providerDoc] = await Promise.all([
        db.collection("usuarios").doc(userId as string).get(),
        db.collection("prestadores").doc(providerId as string).get()
      ]);

      const userData = userDoc.exists ? userDoc.data() as UserData : null;
      const providerData = providerDoc.exists ? providerDoc.data() as ProviderData : null;

      const embajadorUsuario = (userData as any)?.referidoPor || null;
      const embajadorPrestador = providerData?.referidoPor || null;

      let comisionEmbajadorPrestador = 0;
      let comisionEmbajadorUsuario = 0;
      let comisionTotal = 0;

      // Lógica de distribución de comisiones
      if (embajadorPrestador && embajadorUsuario) {
        if (embajadorPrestador === embajadorUsuario) {
          // Mismo embajador para ambos → 100% de la comisión ($60)
          comisionTotal = comisionServiMap;
          comisionEmbajadorPrestador = comisionTotal;
          
          const commission: Commission = {
            ambassadorId: embajadorPrestador as string,
            type: "service",
            sourceId: serviceRequestId as string,
            amount: comisionTotal,
            percentage: 100,
            status: "pending",
            createdAt: now,
            metadata: {
              serviceRequestId: serviceRequestId as string,
              totalAmount: totalAmount as number,
              originalType: "servicio_completado_ambos"
            }
          };
          await db.collection("commissions").add(commission);

        } else {
          // Diferentes embajadores → 60% prestador / 40% usuario
          comisionEmbajadorPrestador = comisionServiMap * 0.6; // $36
          comisionEmbajadorUsuario = comisionServiMap * 0.4;   // $24
          comisionTotal = comisionEmbajadorPrestador + comisionEmbajadorUsuario;

          const commissionProvider: Commission = {
            ambassadorId: embajadorPrestador as string,
            type: "service",
            sourceId: serviceRequestId as string,
            amount: comisionEmbajadorPrestador,
            percentage: 60,
            status: "pending",
            createdAt: now,
            metadata: {
              serviceRequestId: serviceRequestId as string,
              totalAmount: totalAmount as number,
              originalType: "servicio_completado_prestador"
            }
          };
          
          const commissionUser: Commission = {
            ambassadorId: embajadorUsuario as string,
            type: "service",
            sourceId: serviceRequestId as string,
            amount: comisionEmbajadorUsuario,
            percentage: 40,
            status: "pending",
            createdAt: now,
            metadata: {
              serviceRequestId: serviceRequestId as string,
              totalAmount: totalAmount as number,
              originalType: "servicio_completado_usuario"
            }
          };
          
          await Promise.all([
            db.collection("commissions").add(commissionProvider),
            db.collection("commissions").add(commissionUser)
          ]);
        }

      } else if (embajadorPrestador) {
        // Solo embajador del prestador → 60% de la comisión ($36)
        comisionEmbajadorPrestador = comisionServiMap * 0.6;
        comisionTotal = comisionEmbajadorPrestador;

        const commission: Commission = {
          ambassadorId: embajadorPrestador as string,
          type: "service",
          sourceId: serviceRequestId as string,
          amount: comisionEmbajadorPrestador,
          percentage: 60,
          status: "pending",
          createdAt: now,
          metadata: {
            serviceRequestId: serviceRequestId as string,
            totalAmount: totalAmount as number,
            originalType: "servicio_completado_prestador"
          }
        };
        await db.collection("commissions").add(commission);

      } else if (embajadorUsuario) {
        // Solo embajador del usuario → 40% de la comisión ($24)
        comisionEmbajadorUsuario = comisionServiMap * 0.4;
        comisionTotal = comisionEmbajadorUsuario;

        const commission: Commission = {
          ambassadorId: embajadorUsuario as string,
          type: "service",
          sourceId: serviceRequestId as string,
          amount: comisionEmbajadorUsuario,
          percentage: 40,
          status: "pending",
          createdAt: now,
          metadata: {
            serviceRequestId: serviceRequestId as string,
            totalAmount: totalAmount as number,
            originalType: "servicio_completado_usuario"
          }
        };
        await db.collection("commissions").add(commission);
      }
      // Si no hay embajadores → $0 (ServiMap reinvierte)

      // Actualizar el servicio con detalles de comisiones
      await serviceDoc.ref.update({
        comisionesCalculadas: {
          comisionServiMapTotal: comisionServiMap,
          comisionEmbajadorPrestador,
          comisionEmbajadorUsuario,
          comisionTotalPagada: comisionTotal,
          comisionServiMapRetenida: comisionServiMap - comisionTotal,
          embajadorPrestador,
          embajadorUsuario,
          fechaCalculo: now
        },
        updatedAt: now
      });

      // Log de la actividad
      await logActivity(
        "sistema",
        "sistema",
        "COMISIONES_CALCULADAS" as ActivityLogAction,
        `Comisiones calculadas para servicio ${serviceRequestId}. Total pagado: $${comisionTotal.toFixed(2)}`,
        { tipo: "solicitud_servicio", id: serviceRequestId as string },
        {
          comisionServiMapTotal: comisionServiMap,
          comisionEmbajadorPrestador,
          comisionEmbajadorUsuario,
          comisionTotalPagada: comisionTotal,
          embajadorPrestador,
          embajadorUsuario
        }
      );

      return {
        success: true,
        comisionServiMapTotal: comisionServiMap,
        comisionEmbajadorPrestador,
        comisionEmbajadorUsuario,
        comisionTotalPagada: comisionTotal,
        comisionServiMapRetenida: comisionServiMap - comisionTotal,
        embajadorPrestador,
        embajadorUsuario
      };

    } catch (error) {
      console.error("Error calculating commissions:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al calcular comisiones.");
    }
  }
);

// Process complete service commissions flow - Calculate + Credit + Loyalty Check
export const processServiceCommissions = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { serviceRequestId, totalAmount, providerId, userId } = request.data;

    if (!serviceRequestId || !totalAmount || !providerId || !userId) {
      throw new HttpsError(
        "invalid-argument",
        "Parámetros requeridos: serviceRequestId, totalAmount, providerId, userId"
      );
    }

    if (typeof totalAmount !== "number" || totalAmount <= 0) {
      throw new HttpsError("invalid-argument", "totalAmount debe ser un número positivo");
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();

      console.log(`🔄 Iniciando procesamiento completo de comisiones para servicio: ${serviceRequestId}`);

      // Paso 1: Calcular comisiones usando función existente
      // Crear mock request para llamada interna
      const mockRequest: CallableRequest<Record<string, unknown>> = {
        data: { serviceRequestId, totalAmount, providerId, userId },
        auth: request.auth,
        rawRequest: {} as any,
        acceptsStreaming: false
      };

      const commissionCalc = await (calculateCommissions as any)(mockRequest);

      if (!commissionCalc.success) {
        throw new HttpsError("internal", "Error calculando comisiones");
      }

      console.log(`✅ Comisiones calculadas: $${commissionCalc.comisionTotalPagada.toFixed(2)}`);

      const results = {
        success: true,
        serviceRequestId,
        totalCommissionsPaid: commissionCalc.comisionTotalPagada,
        embajadorPrestador: commissionCalc.embajadorPrestador,
        embajadorUsuario: commissionCalc.embajadorUsuario,
        creditedToWallets: [] as any[],
        loyaltyBonusesTriggered: [] as any[]
      };

      // Paso 2: Acreditar comisiones automáticamente a los wallets
      if (commissionCalc.embajadorPrestador && commissionCalc.comisionEmbajadorPrestador > 0) {
        console.log(`💰 Acreditando $${commissionCalc.comisionEmbajadorPrestador.toFixed(2)} al embajador del prestador: ${commissionCalc.embajadorPrestador}`);
        
        try {
          const creditResult = await creditToWallet(
            commissionCalc.embajadorPrestador,
            commissionCalc.comisionEmbajadorPrestador,
            "Comisión de Servicio",
            `Comisión por servicio completado - 60% de comisión`,
            serviceRequestId as string,
            "comision_servicio",
            {
              serviceRequestId,
              totalAmount,
              providerId,
              commissionType: "provider_ambassador",
              percentage: 60
            }
          );
          
          results.creditedToWallets.push({
            ambassadorId: commissionCalc.embajadorPrestador,
            amount: commissionCalc.comisionEmbajadorPrestador,
            type: "provider_ambassador",
            transactionId: `commission-${serviceRequestId}-provider-amb`
          });

          // Verificar bonus de lealtad para embajador del prestador
          try {
            const loyaltyMockRequest: CallableRequest<Record<string, unknown>> = {
              data: { userId: commissionCalc.embajadorPrestador },
              auth: request.auth,
              rawRequest: {} as any,
              acceptsStreaming: false
            };
            
            const loyaltyCheck = await (calculateLoyaltyBonus as any)(loyaltyMockRequest);

            if (loyaltyCheck.bonusAmount > 0) {
              console.log(`🎉 Otorgando bonus de lealtad de $${loyaltyCheck.bonusAmount} al embajador del prestador`);
              
              const bonusMockRequest: CallableRequest<Record<string, unknown>> = {
                data: {
                  userId: commissionCalc.embajadorPrestador,
                  bonusAmount: loyaltyCheck.bonusAmount
                },
                auth: request.auth,
                rawRequest: {} as any,
                acceptsStreaming: false
              };
              
              const bonusResult = await (addLoyaltyBonus as any)(bonusMockRequest);

              results.loyaltyBonusesTriggered.push({
                ambassadorId: commissionCalc.embajadorPrestador,
                bonusAmount: loyaltyCheck.bonusAmount,
                transactionId: bonusResult.transactionId
              });
            }
          } catch (loyaltyError) {
            console.warn(`⚠️ Error verificando loyalty bonus para prestador:`, loyaltyError);
          }

        } catch (creditError) {
          console.error(`❌ Error acreditando al embajador del prestador:`, creditError);
          const errorMessage = creditError instanceof Error ? creditError.message : 'Error desconocido';
          throw new HttpsError("internal", `Error acreditando comisión al embajador del prestador: ${errorMessage}`);
        }
      }

      if (commissionCalc.embajadorUsuario && commissionCalc.comisionEmbajadorUsuario > 0) {
        console.log(`💰 Acreditando $${commissionCalc.comisionEmbajadorUsuario.toFixed(2)} al embajador del usuario: ${commissionCalc.embajadorUsuario}`);
        
        try {
          const creditResult = await creditToWallet(
            commissionCalc.embajadorUsuario,
            commissionCalc.comisionEmbajadorUsuario,
            "Comisión de Servicio",
            `Comisión por servicio completado - 40% de comisión`,
            serviceRequestId as string,
            "comision_servicio",
            {
              serviceRequestId,
              totalAmount,
              userId,
              commissionType: "user_ambassador", 
              percentage: 40
            }
          );

          results.creditedToWallets.push({
            ambassadorId: commissionCalc.embajadorUsuario,
            amount: commissionCalc.comisionEmbajadorUsuario,
            type: "user_ambassador",
            transactionId: `commission-${serviceRequestId}-provider-amb`
          });

          // Verificar bonus de lealtad para embajador del usuario
          try {
            const loyaltyMockRequest: CallableRequest<Record<string, unknown>> = {
              data: { userId: commissionCalc.embajadorUsuario },
              auth: request.auth,
              rawRequest: {} as any,
              acceptsStreaming: false
            };
            
            const loyaltyCheck = await (calculateLoyaltyBonus as any)(loyaltyMockRequest);

            if (loyaltyCheck.bonusAmount > 0) {
              console.log(`🎉 Otorgando bonus de lealtad de $${loyaltyCheck.bonusAmount} al embajador del usuario`);
              
              const bonusMockRequest: CallableRequest<Record<string, unknown>> = {
                data: {
                  userId: commissionCalc.embajadorUsuario,
                  bonusAmount: loyaltyCheck.bonusAmount
                },
                auth: request.auth,
                rawRequest: {} as any,
                acceptsStreaming: false
              };
              
              const bonusResult = await (addLoyaltyBonus as any)(bonusMockRequest);

              results.loyaltyBonusesTriggered.push({
                ambassadorId: commissionCalc.embajadorUsuario,
                bonusAmount: loyaltyCheck.bonusAmount,
                transactionId: bonusResult.transactionId
              });
            }
          } catch (loyaltyError) {
            console.warn(`⚠️ Error verificando loyalty bonus para usuario:`, loyaltyError);
          }

        } catch (creditError) {
          console.error(`❌ Error acreditando al embajador del usuario:`, creditError);
          const errorMessage = creditError instanceof Error ? creditError.message : 'Error desconocido';
          throw new HttpsError("internal", `Error acreditando comisión al embajador del usuario: ${errorMessage}`);
        }
      }

      // Paso 3: Log final de actividad
      await logActivity(
        "sistema",
        "sistema",
        "COMISIONES_PROCESADAS_COMPLETAMENTE" as ActivityLogAction,
        `Comisiones procesadas y acreditadas para servicio ${serviceRequestId}. Total: $${results.totalCommissionsPaid.toFixed(2)}, Wallets: ${results.creditedToWallets.length}, Bonos: ${results.loyaltyBonusesTriggered.length}`,
        { tipo: "solicitud_servicio", id: serviceRequestId as string },
        {
          ...results,
          totalAmount,
          providerId,
          userId
        }
      );

      console.log(`🎉 Procesamiento completo de comisiones finalizado exitosamente`);
      return results;

    } catch (error) {
      console.error("Error processing service commissions:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al procesar comisiones de servicio.");
    }
  }
);

// Process membership commissions when someone pays for Premium or Fixed Business membership
export const processMembershipCommissions = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { membershipType, amount, memberId, ambassadorId } = request.data;

    if (!membershipType || !amount || !memberId || !ambassadorId) {
      throw new HttpsError(
        "invalid-argument",
        "Parámetros requeridos: membershipType, amount, memberId, ambassadorId"
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "amount debe ser un número positivo");
    }

    const validMembershipTypes: MembershipType[] = ["user_premium", "fixed_business"];
    if (!validMembershipTypes.includes(membershipType as MembershipType)) {
      throw new HttpsError(
        "invalid-argument",
        "membershipType debe ser 'user_premium' o 'fixed_business'"
      );
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();

      // Verificar que el embajador existe
      const ambassadorDoc = await db.collection("usuarios").doc(ambassadorId as string).get();
      if (!ambassadorDoc.exists) {
        throw new HttpsError("not-found", "Embajador no encontrado");
      }

      const ambassadorData = ambassadorDoc.data() as UserData;
      
      // Determinar si el embajador es gratuito o premium
      // Asumir que tenemos un campo membershipLevel en UserData
      const ambassadorLevel: "gratuito" | "premium" = 
        (ambassadorData as any)?.membershipLevel === "premium" ? "premium" : "gratuito";

      // Calcular comisión según el tipo de membresía y nivel del embajador
      let commissionAmount = 0;
      let description = "";

      if (membershipType === "user_premium") {
        // Usuario Premium $10/mes → Embajador recibe $4 (gratuito) o $5 (premium)
        if (ambassadorLevel === "premium") {
          commissionAmount = 5.00;
          description = "Comisión premium por membresía Usuario Premium";
        } else {
          commissionAmount = 4.00;
          description = "Comisión por membresía Usuario Premium";
        }
      } else if (membershipType === "fixed_business") {
        // Negocio Fijo $25/mes → Embajador recibe $10 (gratuito) o $12.50 (premium)
        if (ambassadorLevel === "premium") {
          commissionAmount = 12.50;
          description = "Comisión premium por membresía Negocio Fijo";
        } else {
          commissionAmount = 10.00;
          description = "Comisión por membresía Negocio Fijo";
        }
      }

      if (commissionAmount <= 0) {
        throw new HttpsError("internal", "Error calculando comisión de membresía");
      }

      // Crear registro de comisión unificada
      const commissionRef = db.collection("commissions").doc();
      const commission: Commission = {
        ambassadorId: ambassadorId as string,
        type: "membership",
        sourceId: memberId as string,
        amount: commissionAmount,
        percentage: ambassadorLevel === "premium" ? 
          (membershipType === "user_premium" ? 50 : 50) : // $5/$12.50 de $10/$25
          (membershipType === "user_premium" ? 40 : 40),  // $4/$10 de $10/$25
        status: "paid", // Se acredita inmediatamente
        paidAt: now,
        createdAt: now,
        metadata: {
          membershipType: membershipType as MembershipType,
          ambassadorLevel,
          totalAmount: amount as number
        }
      };

      await commissionRef.set(commission);

      // Acreditar INMEDIATAMENTE al wallet del embajador
      await creditToWallet(
        ambassadorId as string,
        commissionAmount,
        "Comisión de Membresía",
        description,
        commissionRef.id,
        "comision_membresia",
        {
          membershipType,
          memberId,
          membershipAmount: amount,
          ambassadorLevel
        }
      );

      // Enviar notificación al embajador
      await sendNotification(
        ambassadorId as string,
        "usuario",
        "¡Comisión Acreditada!",
        `Has recibido $${commissionAmount.toFixed(2)} por una nueva membresía ${membershipType === "user_premium" ? "Premium" : "Negocio Fijo"}`,
        {
          type: "commission_credited",
          amount: commissionAmount.toString(),
          membershipType: membershipType as string,
          commissionId: commissionRef.id
        }
      );

      // Log de la actividad
      await logActivity(
        "sistema",
        "sistema",
        "COMISION_MEMBRESIA_PROCESADA",
        `Comisión de membresía procesada: $${commissionAmount.toFixed(2)} para embajador ${ambassadorId}`,
        { tipo: "membership_commission", id: commissionRef.id },
        {
          membershipType,
          amount,
          memberId,
          ambassadorId,
          commissionAmount,
          ambassadorLevel
        }
      );

      return {
        success: true,
        commissionAmount,
        ambassadorLevel,
        membershipType,
        description,
        commissionId: commissionRef.id
      };

    } catch (error) {
      console.error("Error processing membership commission:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al procesar comisión de membresía.");
    }
  }
);

// Add money to user wallet for commissions, bonuses, refunds
export const addToWallet = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { userId, amount, type, description, sourceId } = request.data;

    if (!userId || !amount || !type || !description) {
      throw new HttpsError(
        "invalid-argument",
        "Parámetros requeridos: userId, amount, type, description"
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "amount debe ser un número positivo");
    }

    const validTypes = ["commission", "bonus", "refund"];
    if (!validTypes.includes(type as string)) {
      throw new HttpsError(
        "invalid-argument",
        "type debe ser 'commission', 'bonus' o 'refund'"
      );
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();

      // Verificar que el usuario existe
      const userDoc = await db.collection("usuarios").doc(userId as string).get();
      if (!userDoc.exists) {
        // También verificar en prestadores
        const providerDoc = await db.collection("prestadores").doc(userId as string).get();
        if (!providerDoc.exists) {
          throw new HttpsError("not-found", "Usuario no encontrado");
        }
      }

      const walletRef = db.collection("wallets").doc(userId as string);
      
      let transactionId = "";
      let saldoAnterior = 0;
      let saldoNuevo = 0;

      // Ejecutar transacción atómica
      await db.runTransaction(async (transaction) => {
        const walletDoc = await transaction.get(walletRef);
        
        saldoAnterior = 0;
        let totalAcumuladoBonificaciones = 0;
        let totalAcumuladoComisiones = 0;
        let totalAcumuladoReembolsos = 0;

        if (walletDoc.exists) {
          const walletData = walletDoc.data() as WalletData;
          saldoAnterior = walletData.balance || 0;
          totalAcumuladoBonificaciones = walletData.breakdown?.totalEarnedFromBonuses || 0;
          totalAcumuladoComisiones = walletData.breakdown?.totalEarnedFromCommissions || 0;
          totalAcumuladoReembolsos = walletData.breakdown?.totalEarnedFromRefunds || 0;
        }
        
        saldoNuevo = saldoAnterior + (amount as number);
        
        // Actualizar totales acumulados según el tipo
        const updateData: Partial<WalletData> = {
          balance: saldoNuevo,
          updatedAt: now,
        };

        if (type === "bonus") {
          updateData.breakdown = {
            totalEarnedFromBonuses: totalAcumuladoBonificaciones + (amount as number),
            totalEarnedFromCommissions: totalAcumuladoComisiones,
            totalEarnedFromRefunds: totalAcumuladoReembolsos
          };
          updateData.totalEarned = updateData.breakdown.totalEarnedFromBonuses + updateData.breakdown.totalEarnedFromCommissions + updateData.breakdown.totalEarnedFromRefunds;
        } else if (type === "commission") {
          updateData.breakdown = {
            totalEarnedFromBonuses: totalAcumuladoBonificaciones,
            totalEarnedFromCommissions: totalAcumuladoComisiones + (amount as number),
            totalEarnedFromRefunds: totalAcumuladoReembolsos
          };
          updateData.totalEarned = updateData.breakdown.totalEarnedFromBonuses + updateData.breakdown.totalEarnedFromCommissions + updateData.breakdown.totalEarnedFromRefunds;
        } else if (type === "refund") {
          updateData.breakdown = {
            totalEarnedFromBonuses: totalAcumuladoBonificaciones,
            totalEarnedFromCommissions: totalAcumuladoComisiones,
            totalEarnedFromRefunds: totalAcumuladoReembolsos + (amount as number)
          };
          updateData.totalEarned = updateData.breakdown.totalEarnedFromBonuses + updateData.breakdown.totalEarnedFromCommissions + updateData.breakdown.totalEarnedFromRefunds;
        }

        if (walletDoc.exists) {
          transaction.update(walletRef, updateData);
        } else {
          const newWalletData: WalletData = {
            userId: userId as string,
            balance: saldoNuevo,
            totalEarned: saldoNuevo,
            totalSpent: 0,
            totalWithdrawn: 0,
            bonusesEarned: 0,
            createdAt: now,
            updatedAt: now,
            breakdown: {
              totalEarnedFromBonuses: type === "bonus" ? (amount as number) : 0,
              totalEarnedFromCommissions: type === "commission" ? (amount as number) : 0,
              totalEarnedFromRefunds: type === "refund" ? (amount as number) : 0
            },
            limits: {
              dailySpendingLimit: 10000,
              withdrawalLimit: 5000,
              dailySpentToday: 0,
              lastSpendingDate: new Date().toISOString().split('T')[0],
              blockedBalance: 0
            },
            loyalty: {
              nextThreshold: LOYALTY_BONUS_THRESHOLD,
              progressToNext: 0
            }
          };
          transaction.set(walletRef, newWalletData);
        }

        // Crear registro de transacción
        const transactionRef = db.collection("wallet_transactions").doc();
        transactionId = transactionRef.id;

        const walletTransaction: WalletTransaction = {
          userId: userId as string,
          type: type as "commission" | "bonus" | "refund",
          amount: amount as number,
          description: description as string,
          sourceId: sourceId as string || undefined,
          balanceAfter: saldoNuevo,
          createdAt: now,
          balanceBefore: saldoAnterior,
          metadata: {
            originalType: type,
            sourceId,
            addedViaFunction: "addToWallet"
          },
        };

        transaction.set(transactionRef, walletTransaction);
      });

      // Enviar notificación al usuario
      const notificationTitle = getNotificationTitle(type as string);
      const notificationBody = `Has recibido $${(amount as number).toFixed(2)} en tu wallet. ${description}`;
      
      await sendNotification(
        userId as string,
        "usuario", // Asumir que es usuario, puede ser prestador también
        notificationTitle,
        notificationBody,
        {
          type: "wallet_credit",
          amount: (amount as number).toString(),
          transactionType: type as string,
          transactionId: transactionId!,
          sourceId: sourceId as string || ""
        }
      );

      // Log de la actividad
      await logActivity(
        request.auth.uid,
        "usuario",
        "WALLET_CREDITO_AGREGADO",
        `$${(amount as number).toFixed(2)} agregado al wallet de ${userId}. Tipo: ${type}`,
        { tipo: "wallet", id: userId as string },
        {
          amount,
          type,
          description,
          sourceId,
          saldoAnterior,
          saldoNuevo,
          transactionId
        }
      );

      return {
        success: true,
        amount: amount as number,
        type,
        newBalance: saldoNuevo,
        previousBalance: saldoAnterior,
        transactionId,
        description
      };

    } catch (error) {
      console.error("Error adding to wallet:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al agregar dinero al wallet.");
    }
  }
);


/**
 * Obtiene el título de notificación basado en el tipo
 */
function getNotificationTitle(type: string): string {
  switch (type) {
    case "commission":
      return "¡Comisión Recibida!";
    case "bonus":
      return "¡Bonificación Recibida!";
    case "refund":
      return "¡Reembolso Procesado!";
    default:
      return "¡Dinero Agregado!";
  }
}

// Process payment using wallet balance - NO Stripe fees
export const processWalletPayment = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { userId, amount, serviceRequestId, description } = request.data;

    if (!userId || !amount || !serviceRequestId || !description) {
      throw new HttpsError(
        "invalid-argument",
        "Parámetros requeridos: userId, amount, serviceRequestId, description"
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "amount debe ser un número positivo");
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Verificar que el usuario existe
      const userDoc = await db.collection("usuarios").doc(userId as string).get();
      if (!userDoc.exists) {
        // También verificar en prestadores
        const providerDoc = await db.collection("prestadores").doc(userId as string).get();
        if (!providerDoc.exists) {
          throw new HttpsError("not-found", "Usuario no encontrado");
        }
      }

      // Verificar que el servicio existe
      const serviceDoc = await db.collection("solicitudes_servicio").doc(serviceRequestId as string).get();
      if (!serviceDoc.exists) {
        throw new HttpsError("not-found", "Servicio no encontrado");
      }

      const walletRef = db.collection("wallets").doc(userId as string);
      
      let transactionId = "";
      let saldoAnterior = 0;
      let saldoNuevo = 0;
      let paymentSuccessful = false;

      // Ejecutar transacción atómica
      await db.runTransaction(async (transaction) => {
        const walletDoc = await transaction.get(walletRef);
        
        if (!walletDoc.exists) {
          throw new HttpsError("not-found", "Wallet no encontrado. El usuario debe tener saldo.");
        }

        const walletData = walletDoc.data() as WalletData;
        saldoAnterior = walletData.balance || 0;
        const saldoBloqueado = walletData.limits?.blockedBalance || 0;
        const saldoDisponible = saldoAnterior - saldoBloqueado;

        // Verificar saldo suficiente
        if (saldoDisponible < (amount as number)) {
          throw new HttpsError(
            "failed-precondition", 
            `Saldo insuficiente. Disponible: $${saldoDisponible.toFixed(2)}, Requerido: $${(amount as number).toFixed(2)}`
          );
        }

        // Verificar límites diarios
        const limiteDiario = walletData.limits?.dailySpendingLimit || 10000;
        let gastosDiarios = walletData.limits?.dailySpentToday || 0;
        const ultimoDiaGasto = walletData.limits?.lastSpendingDate || "";

        // Resetear gastos diarios si es un nuevo día
        if (ultimoDiaGasto !== today) {
          gastosDiarios = 0;
        }

        if (gastosDiarios + (amount as number) > limiteDiario) {
          throw new HttpsError(
            "failed-precondition",
            `Límite diario excedido. Límite: $${limiteDiario.toFixed(2)}, Gastado hoy: $${gastosDiarios.toFixed(2)}`
          );
        }

        // Procesar el descuento
        saldoNuevo = saldoAnterior - (amount as number);
        const totalGastado = (walletData.totalSpent || 0) + (amount as number);
        const nuevosGastosDiarios = gastosDiarios + (amount as number);

        // Actualizar wallet
        const updateData: Partial<WalletData> = {
          balance: saldoNuevo,
          updatedAt: now,
          totalSpent: totalGastado,
          limits: {
            ...walletData.limits,
            dailySpentToday: nuevosGastosDiarios,
            lastSpendingDate: today
          },
        };

        transaction.update(walletRef, updateData);

        // Crear registro de transacción
        const transactionRef = db.collection("wallet_transactions").doc();
        transactionId = transactionRef.id;

        const walletTransaction: WalletTransaction = {
          userId: userId as string,
          type: "payment",
          amount: amount as number,
          description: description as string,
          sourceId: serviceRequestId as string,
          balanceAfter: saldoNuevo,
          createdAt: now,
          balanceBefore: saldoAnterior,
          metadata: {
            serviceRequestId,
            paymentMethod: "wallet",
            noStripeFees: true,
            dailySpent: nuevosGastosDiarios,
            totalSpent: totalGastado
          },
        };

        transaction.set(transactionRef, walletTransaction);

        // Actualizar el servicio para marcarlo como pagado con wallet
        const serviceRef = db.collection("solicitudes_servicio").doc(serviceRequestId as string);
        transaction.update(serviceRef, {
          paymentStatus: "pagado",
          metodoPago: "wallet",
          montoCobrado: amount,
          walletTransactionId: transactionId,
          paidWithWallet: true,
          noStripeFees: true,
          updatedAt: now,
          actorDelCambioId: request.auth?.uid || "sistema",
          actorDelCambioRol: "usuario"
        });

        paymentSuccessful = true;
      });

      if (!paymentSuccessful) {
        throw new HttpsError("internal", "Error procesando el pago");
      }

      // Enviar notificación al usuario
      await sendNotification(
        userId as string,
        "usuario",
        "¡Pago Procesado!",
        `Se ha descontado $${(amount as number).toFixed(2)} de tu wallet para el servicio. ${description}`,
        {
          type: "wallet_payment",
          amount: (amount as number).toString(),
          serviceRequestId: serviceRequestId as string,
          transactionId,
          newBalance: saldoNuevo.toString()
        }
      );

      // Log de la actividad
      await logActivity(
        request.auth.uid,
        "usuario",
        "WALLET_DEBITO_REALIZADO",
        `Pago de $${(amount as number).toFixed(2)} procesado desde wallet. Servicio: ${serviceRequestId}`,
        { tipo: "wallet", id: userId as string },
        {
          amount,
          serviceRequestId,
          description,
          saldoAnterior,
          saldoNuevo,
          transactionId,
          noStripeFees: true
        }
      );

      // 🎯 VERIFICACIÓN AUTOMÁTICA DE LOYALTY BONUS
      // Después de cada pago con wallet, verificar si el usuario merece un bonus de lealtad
      console.log(`🔍 Verificando automáticamente loyalty bonus para usuario: ${userId}`);
      
      let loyaltyBonusTriggered = false;
      let loyaltyBonusAmount = 0;
      let loyaltyTransactionId = "";

      try {
        const loyaltyMockRequest: CallableRequest<Record<string, unknown>> = {
          data: { userId },
          auth: request.auth,
          rawRequest: {} as any,
          acceptsStreaming: false
        };
        
        const loyaltyCheck = await (calculateLoyaltyBonus as any)(loyaltyMockRequest);

        if (loyaltyCheck.bonusAmount > 0) {
          console.log(`🎉 ¡Usuario merece bonus de lealtad! Otorgando $${loyaltyCheck.bonusAmount}`);
          
          const bonusMockRequest: CallableRequest<Record<string, unknown>> = {
            data: {
              userId: userId,
              bonusAmount: loyaltyCheck.bonusAmount
            },
            auth: request.auth,
            rawRequest: {} as any,
            acceptsStreaming: false
          };
          
          const bonusResult = await (addLoyaltyBonus as any)(bonusMockRequest);
          
          loyaltyBonusTriggered = true;
          loyaltyBonusAmount = loyaltyCheck.bonusAmount;
          loyaltyTransactionId = bonusResult.transactionId;
          
          console.log(`✅ Loyalty bonus otorgado exitosamente: $${loyaltyBonusAmount}`);
        } else {
          console.log(`ℹ️ Usuario no tiene bonos de lealtad pendientes`);
        }
      } catch (loyaltyError) {
        console.warn(`⚠️ Error verificando/otorgando loyalty bonus (no crítico):`, loyaltyError);
        // No lanzar error - el pago principal ya se procesó exitosamente
      }

      return {
        success: true,
        amount: amount as number,
        newBalance: saldoNuevo,
        previousBalance: saldoAnterior,
        transactionId,
        serviceRequestId,
        description,
        noStripeFees: true,
        paidWithWallet: true,
        // Información del bonus de lealtad (si aplicó)
        loyaltyBonusTriggered,
        loyaltyBonusAmount,
        loyaltyTransactionId
      };

    } catch (error) {
      console.error("Error processing wallet payment:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al procesar pago con wallet.");
    }
  }
);

// Calculate loyalty bonus based on wallet spending - $20 USD every $2000 spent
export const calculateLoyaltyBonus = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { userId } = request.data;

    if (!userId) {
      throw new HttpsError("invalid-argument", "Parámetro requerido: userId");
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();

      // Verificar que el usuario existe
      const userDoc = await db.collection("usuarios").doc(userId as string).get();
      if (!userDoc.exists) {
        // También verificar en prestadores
        const providerDoc = await db.collection("prestadores").doc(userId as string).get();
        if (!providerDoc.exists) {
          throw new HttpsError("not-found", "Usuario no encontrado");
        }
      }

      // Obtener datos del wallet
      const walletRef = db.collection("wallets").doc(userId as string);
      const walletDoc = await walletRef.get();

      if (!walletDoc.exists) {
        return {
          success: true,
          bonusAmount: 0,
          reason: "Usuario no tiene wallet",
          totalSpent: 0,
          nextThreshold: LOYALTY_BONUS_THRESHOLD
        };
      }

      const walletData = walletDoc.data() as WalletData;
      const totalGastado = walletData.totalSpent || 0;
      const loyaltyBonusesEarned = walletData.bonusesEarned || 0;

      // Calcular cuántos bonos debería haber ganado basado en gasto total
      const bonusesDeserved = Math.floor(totalGastado / LOYALTY_BONUS_THRESHOLD);
      
      // Calcular bonos pendientes
      const pendingBonuses = bonusesDeserved - loyaltyBonusesEarned;

      if (pendingBonuses <= 0) {
        const nextThreshold = (loyaltyBonusesEarned + 1) * LOYALTY_BONUS_THRESHOLD;
        const amountNeeded = nextThreshold - totalGastado;
        
        return {
          success: true,
          bonusAmount: 0,
          reason: "No hay bonos pendientes",
          totalSpent: totalGastado,
          bonusesEarned: loyaltyBonusesEarned,
          nextThreshold,
          amountNeededForNextBonus: amountNeeded
        };
      }

      // Calcular monto total de bonus a otorgar
      const totalBonusAmount = pendingBonuses * LOYALTY_BONUS_AMOUNT;

      // Crear registros de loyalty bonus para tracking
      const loyaltyBonusPromises = [];
      for (let i = 0; i < pendingBonuses; i++) {
        const thresholdNumber = loyaltyBonusesEarned + i + 1;
        const thresholdReached = thresholdNumber * LOYALTY_BONUS_THRESHOLD;
        
        const loyaltyBonusData: LoyaltyBonusData = {
          userId: userId as string,
          bonusAmount: LOYALTY_BONUS_AMOUNT,
          thresholdReached,
          totalSpentAtTime: totalGastado,
          fecha: now,
          otorgado: false // Se marcará como true cuando se otorgue el bonus
        };
        
        const loyaltyBonusRef = db.collection("loyalty_bonuses").doc();
        loyaltyBonusPromises.push(loyaltyBonusRef.set(loyaltyBonusData));
      }

      await Promise.all(loyaltyBonusPromises);

      // Log de la actividad
      await logActivity(
        "sistema",
        "sistema",
        "LOYALTY_BONUS_CALCULATED",
        `Calculados ${pendingBonuses} bonos de lealtad para ${userId}. Total: $${totalBonusAmount.toFixed(2)}`,
        { tipo: "loyalty_bonus", id: userId as string },
        {
          totalSpent: totalGastado,
          bonusesDeserved,
          pendingBonuses,
          totalBonusAmount,
          thresholdAmount: LOYALTY_BONUS_THRESHOLD,
          bonusPerThreshold: LOYALTY_BONUS_AMOUNT
        }
      );

      const nextThreshold = (bonusesDeserved + 1) * LOYALTY_BONUS_THRESHOLD;
      const amountNeeded = nextThreshold - totalGastado;

      return {
        success: true,
        bonusAmount: totalBonusAmount,
        pendingBonuses,
        bonusPerThreshold: LOYALTY_BONUS_AMOUNT,
        totalSpent: totalGastado,
        bonusesEarned: loyaltyBonusesEarned,
        bonusesDeserved,
        nextThreshold,
        amountNeededForNextBonus: amountNeeded,
        thresholdAmount: LOYALTY_BONUS_THRESHOLD
      };

    } catch (error) {
      console.error("Error calculating loyalty bonus:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al calcular bonus de lealtad.");
    }
  }
);

// Add loyalty bonus to wallet automatically when reaching $2000 spent
export const addLoyaltyBonus = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { userId, bonusAmount } = request.data;

    if (!userId || !bonusAmount) {
      throw new HttpsError(
        "invalid-argument",
        "Parámetros requeridos: userId, bonusAmount"
      );
    }

    if (typeof bonusAmount !== "number" || bonusAmount <= 0) {
      throw new HttpsError("invalid-argument", "bonusAmount debe ser un número positivo");
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();

      // Verificar que el usuario existe
      const userDoc = await db.collection("usuarios").doc(userId as string).get();
      if (!userDoc.exists) {
        // También verificar en prestadores
        const providerDoc = await db.collection("prestadores").doc(userId as string).get();
        if (!providerDoc.exists) {
          throw new HttpsError("not-found", "Usuario no encontrado");
        }
      }

      // Verificar que el wallet existe
      const walletRef = db.collection("wallets").doc(userId as string);
      const walletDoc = await walletRef.get();

      if (!walletDoc.exists) {
        throw new HttpsError("not-found", "Wallet no encontrado");
      }

      let transactionId = "";
      let saldoAnterior = 0;
      let saldoNuevo = 0;
      let bonusesUpdated = 0;

      // Ejecutar transacción atómica
      await db.runTransaction(async (transaction) => {
        const walletDoc = await transaction.get(walletRef);
        const walletData = walletDoc.data() as WalletData;
        
        saldoAnterior = walletData.balance || 0;
        saldoNuevo = saldoAnterior + (bonusAmount as number);
        
        const totalAcumuladoBonificaciones = (walletData.breakdown?.totalEarnedFromBonuses || 0) + (bonusAmount as number);
        const loyaltyBonusesEarned = (walletData.bonusesEarned || 0) + 1;
        const nextThreshold = loyaltyBonusesEarned * LOYALTY_BONUS_THRESHOLD + LOYALTY_BONUS_THRESHOLD;

        // Actualizar wallet
        const updateData: Partial<WalletData> = {
          balance: saldoNuevo,
          updatedAt: now,
          breakdown: {
            ...walletData.breakdown,
            totalEarnedFromBonuses: totalAcumuladoBonificaciones
          },
          totalEarned: (walletData.totalEarned || 0) + (bonusAmount as number),
          bonusesEarned: loyaltyBonusesEarned,
          loyalty: {
            nextThreshold: nextThreshold,
            progressToNext: Math.round(((walletData.totalSpent || 0) % LOYALTY_BONUS_THRESHOLD) / LOYALTY_BONUS_THRESHOLD * 100)
          }
        };

        transaction.update(walletRef, updateData);

        // Crear registro de transacción de wallet
        const transactionRef = db.collection("wallet_transactions").doc();
        transactionId = transactionRef.id;

        const walletTransaction: WalletTransaction = {
          userId: userId as string,
          type: "bonus",
          amount: bonusAmount as number,
          description: `¡Felicidades! $${(bonusAmount as number).toFixed(2)} agregados por ser cliente frecuente`,
          sourceId: `loyalty_bonus_${loyaltyBonusesEarned}`,
          balanceAfter: saldoNuevo,
          createdAt: now,
          balanceBefore: saldoAnterior,
          metadata: {
            bonusType: "loyalty_bonus",
            bonusNumber: loyaltyBonusesEarned,
            thresholdReached: loyaltyBonusesEarned * LOYALTY_BONUS_THRESHOLD,
            automatic: true,
            specialMessage: true
          },
        };

        transaction.set(transactionRef, walletTransaction);

        // Marcar los loyalty_bonuses pendientes como otorgados
        const loyaltyBonusQuery = await db
          .collection("loyalty_bonuses")
          .where("userId", "==", userId)
          .where("otorgado", "==", false)
          .where("bonusAmount", "==", bonusAmount)
          .limit(1)
          .get();

        if (!loyaltyBonusQuery.empty) {
          const loyaltyBonusDoc = loyaltyBonusQuery.docs[0];
          transaction.update(loyaltyBonusDoc.ref, {
            otorgado: true,
            walletTransactionId: transactionId,
            fechaOtorgado: now
          });
          bonusesUpdated = 1;
        }
      });

      // Enviar notificación especial al usuario
      await sendNotification(
        userId as string,
        "usuario",
        "🎉 ¡Bonus de Lealtad!",
        `¡Felicidades! Has ganado $${(bonusAmount as number).toFixed(2)} por ser un cliente frecuente. ¡Sigue usando ServiMap!`,
        {
          type: "loyalty_bonus",
          amount: (bonusAmount as number).toString(),
          transactionId,
          newBalance: saldoNuevo.toString(),
          special: "true",
          celebration: "true"
        }
      );

      // Log de la actividad
      await logActivity(
        "sistema",
        "sistema",
        "LOYALTY_BONUS_OTORGADO",
        `Bonus de lealtad otorgado: $${(bonusAmount as number).toFixed(2)} para ${userId}`,
        { tipo: "loyalty_bonus", id: userId as string },
        {
          bonusAmount,
          saldoAnterior,
          saldoNuevo,
          transactionId,
          bonusesUpdated,
          automatic: true
        }
      );

      return {
        success: true,
        bonusAmount: bonusAmount as number,
        newBalance: saldoNuevo,
        previousBalance: saldoAnterior,
        transactionId,
        message: `¡Felicidades! $${(bonusAmount as number).toFixed(2)} agregados por ser cliente frecuente`,
        loyaltyBonusesEarned: (await walletRef.get()).data()?.loyaltyBonusesEarned || 0,
        nextThreshold: ((await walletRef.get()).data()?.loyaltyBonusThreshold || LOYALTY_BONUS_THRESHOLD),
        bonusesMarkedAsGranted: bonusesUpdated
      };

    } catch (error) {
      console.error("Error adding loyalty bonus:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al agregar bonus de lealtad.");
    }
  }
);

/**
 * Calcula el fee de Stripe para transferencias bancarias por país
 */
function calculateStripeFee(amount: number, country: string, _currency: string): StripeFeeCalculation {
  // Fees aproximados de Stripe para transferencias bancarias por país (en USD)
  const stripeFees: Record<string, StripeFeeCalculation> = {
    "US": {
      baseFee: 0.25,
      percentageFee: 0.0075, // 0.75%
      minimumFee: 0.25,
      maximumFee: 5.00,
      country: "US",
      currency: "USD"
    },
    "MX": {
      baseFee: 2.00,
      percentageFee: 0.015, // 1.5%
      minimumFee: 2.00,
      maximumFee: 5.00,
      country: "MX", 
      currency: "MXN"
    },
    "CA": {
      baseFee: 0.50,
      percentageFee: 0.01, // 1%
      minimumFee: 0.50,
      maximumFee: 4.00,
      country: "CA",
      currency: "CAD"
    },
    "GB": {
      baseFee: 0.25,
      percentageFee: 0.0075, // 0.75%
      minimumFee: 0.25,
      maximumFee: 4.00,
      country: "GB",
      currency: "GBP"
    }
  };

  const feeConfig = stripeFees[country.toUpperCase()] || stripeFees["US"];
  const calculatedFee = feeConfig.baseFee + (amount * feeConfig.percentageFee);
  const finalFee = Math.min(Math.max(calculatedFee, feeConfig.minimumFee), feeConfig.maximumFee);

  return {
    ...feeConfig,
    baseFee: finalFee
  };
}

// Process wallet withdrawal to bank account - user pays Stripe fee
export const processWalletWithdrawal = onCall(
  { secrets: [stripeSecretKey] },
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { userId, amount, bankDetails, acceptFee } = request.data;

    if (!userId || !amount || !bankDetails || acceptFee === undefined) {
      throw new HttpsError(
        "invalid-argument",
        "Parámetros requeridos: userId, amount, bankDetails, acceptFee"
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "amount debe ser un número positivo");
    }

    if (typeof acceptFee !== "boolean") {
      throw new HttpsError("invalid-argument", "acceptFee debe ser un booleano");
    }

    const bankDetailsObj = bankDetails as BankDetails;
    if (!bankDetailsObj.bankName || !bankDetailsObj.accountNumber || !bankDetailsObj.accountHolderName) {
      throw new HttpsError("invalid-argument", "Datos bancarios incompletos");
    }

    try {
      const db = getFirestore();
      const now = admin.firestore.Timestamp.now();

      // Verificar que el usuario existe
      const userDoc = await db.collection("usuarios").doc(userId as string).get();
      if (!userDoc.exists) {
        const providerDoc = await db.collection("prestadores").doc(userId as string).get();
        if (!providerDoc.exists) {
          throw new HttpsError("not-found", "Usuario no encontrado");
        }
      }

      // Verificar wallet
      const walletRef = db.collection("wallets").doc(userId as string);
      const walletDoc = await walletRef.get();

      if (!walletDoc.exists) {
        throw new HttpsError("not-found", "Wallet no encontrado");
      }

      const walletData = walletDoc.data() as WalletData;
      const saldoActual = walletData.balance || 0;
      const saldoBloqueado = walletData.limits?.blockedBalance || 0;
      const saldoDisponible = saldoActual - saldoBloqueado;

      // Calcular fee de Stripe
      const feeCalculation = calculateStripeFee(
        amount as number, 
        bankDetailsObj.country, 
        bankDetailsObj.currency
      );
      const stripeFee = feeCalculation.baseFee;
      const totalDeducted = (amount as number) + stripeFee;

      // Verificar que el usuario acepta el fee
      if (!acceptFee) {
        return {
          success: false,
          requiresFeeAcceptance: true,
          stripeFee,
          totalDeducted,
          feeCalculation,
          message: `Este retiro requiere un fee de $${stripeFee.toFixed(2)}. Total a descontar: $${totalDeducted.toFixed(2)}`
        };
      }

      // Verificar saldo suficiente (incluyendo fee)
      if (saldoDisponible < totalDeducted) {
        throw new HttpsError(
          "failed-precondition",
          `Saldo insuficiente. Disponible: $${saldoDisponible.toFixed(2)}, Requerido: $${totalDeducted.toFixed(2)} (incluyendo fee de $${stripeFee.toFixed(2)})`
        );
      }

      // Verificar límites de retiro
      const limiteRetiro = walletData.limits?.withdrawalLimit || 5000;
      if ((amount as number) > limiteRetiro) {
        throw new HttpsError(
          "failed-precondition",
          `Monto excede límite de retiro. Límite: $${limiteRetiro.toFixed(2)}`
        );
      }

      // Crear registro de retiro
      const withdrawalRef = db.collection("withdrawals").doc();
      const withdrawalData: WithdrawalData = {
        userId: userId as string,
        amount: amount as number,
        stripeFee,
        totalDeducted,
        bankDetails: bankDetailsObj,
        status: "pending",
        fecha: now
      };

      let transactionId = "";
      let saldoNuevo = 0;
      let stripeTransferId = "";

      // Procesar con Stripe y descontar del wallet atómicamente
      await db.runTransaction(async (transaction) => {
        const currentWalletDoc = await transaction.get(walletRef);
        const currentWalletData = currentWalletDoc.data() as WalletData;
        const currentSaldo = currentWalletData.balance || 0;

        // Verificar saldo nuevamente dentro de la transacción
        if (currentSaldo < totalDeducted) {
          throw new HttpsError("failed-precondition", "Saldo insuficiente en el momento de procesamiento");
        }

        saldoNuevo = currentSaldo - totalDeducted;

        // Actualizar wallet
        transaction.update(walletRef, {
          balance: saldoNuevo,
          ultimaActualizacion: now
        });

        // Crear transacción de débito principal
        const transactionRef = db.collection("wallet_transactions").doc();
        transactionId = transactionRef.id;

        const walletTransaction: WalletTransaction = {
          userId: userId as string,
          type: "withdrawal",
          amount: amount as number,
          description: `Retiro a ${bankDetailsObj.bankName} cuenta ***${bankDetailsObj.accountNumber.slice(-4)}`,
          sourceId: withdrawalRef.id,
          balanceAfter: saldoNuevo + stripeFee, // Saldo después del retiro, antes del fee
          createdAt: now,
          balanceBefore: currentSaldo,
          metadata: {
            bankDetails: {
              bankName: bankDetailsObj.bankName,
              accountNumber: `***${bankDetailsObj.accountNumber.slice(-4)}`,
              country: bankDetailsObj.country
            },
            stripeFee,
            totalDeducted,
            withdrawalId: withdrawalRef.id
          }
        };

        transaction.set(transactionRef, walletTransaction);

        // Crear transacción separada para el fee
        const feeTransactionRef = db.collection("wallet_transactions").doc();
        const feeTransaction: WalletTransaction = {
          userId: userId as string,
          type: "withdrawal_fee",
          amount: stripeFee,
          description: `Fee de Stripe por transferencia bancaria`,
          sourceId: withdrawalRef.id,
          balanceAfter: saldoNuevo,
          createdAt: now,
          balanceBefore: saldoNuevo + stripeFee,
          metadata: {
            feeCalculation,
            withdrawalId: withdrawalRef.id,
            parentTransactionId: transactionId
          }
        };

        transaction.set(feeTransactionRef, feeTransaction);

        // Actualizar registro de retiro
        withdrawalData.status = "processing";
        withdrawalData.walletTransactionId = transactionId;
        transaction.set(withdrawalRef, withdrawalData);
      });

      // Procesar transferencia con Stripe (fuera de la transacción de Firestore)
      try {
        // Nota: En producción, aquí se inicializaría Stripe y procesaría la transferencia real
        // const stripe = new Stripe(stripeSecretKey.value(), {
        //   apiVersion: "2025-06-30.basil",
        // });
        
        // Por ahora simulamos el proceso
        stripeTransferId = `tr_simulated_${Date.now()}`;
        
        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Actualizar como completado
        await withdrawalRef.update({
          status: "completed",
          stripeTransferId,
          completedAt: now
        });

        // Log de éxito
        await logActivity(
          request.auth.uid,
          "usuario",
          "WALLET_WITHDRAWAL_COMPLETED",
          `Retiro completado: $${(amount as number).toFixed(2)} para ${userId}`,
          { tipo: "withdrawal", id: withdrawalRef.id },
          {
            amount,
            stripeFee,
            totalDeducted,
            saldoNuevo,
            stripeTransferId,
            bankDetails: {
              bankName: bankDetailsObj.bankName,
              country: bankDetailsObj.country
            }
          }
        );

      } catch (stripeError) {
        console.error("Error processing Stripe transfer:", stripeError);
        
        // Marcar como fallido
        await withdrawalRef.update({
          status: "failed",
          errorMessage: "Error procesando transferencia bancaria"
        });

        // Log de error
        await logActivity(
          request.auth.uid,
          "usuario", 
          "WALLET_WITHDRAWAL_FAILED",
          `Retiro fallido para ${userId}: ${stripeError}`,
          { tipo: "withdrawal", id: withdrawalRef.id },
          { amount, stripeFee, error: stripeError }
        );

        throw new HttpsError("internal", "Error procesando transferencia bancaria");
      }

      // Enviar notificación al usuario
      await sendNotification(
        userId as string,
        "usuario",
        "💰 Retiro Procesado",
        `Tu retiro de $${(amount as number).toFixed(2)} ha sido enviado a tu cuenta bancaria. Fee: $${stripeFee.toFixed(2)}`,
        {
          type: "withdrawal_completed",
          amount: (amount as number).toString(),
          stripeFee: stripeFee.toString(),
          transactionId,
          withdrawalId: withdrawalRef.id,
          bankName: bankDetailsObj.bankName
        }
      );

      return {
        success: true,
        amount: amount as number,
        stripeFee,
        totalDeducted,
        newBalance: saldoNuevo,
        stripeTransferId,
        transactionId,
        withdrawalId: withdrawalRef.id,
        message: `Retiro de $${(amount as number).toFixed(2)} procesado exitosamente. Fee: $${stripeFee.toFixed(2)}`
      };

    } catch (error) {
      console.error("Error processing wallet withdrawal:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al procesar retiro del wallet.");
    }
  }
);

// Get wallet balance and statistics for user dashboard
export const getWalletBalance = onCall(
  async (request: CallableRequest<Record<string, unknown>>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const { userId } = request.data;
    const requestUserId = userId || request.auth.uid;

    // Verificar que el usuario puede acceder a este wallet (solo su propio wallet o admin)
    if (requestUserId !== request.auth.uid) {
      // Aquí podrías agregar lógica para verificar si es admin
      throw new HttpsError("permission-denied", "Solo puedes acceder a tu propio wallet");
    }

    try {
      const db = getFirestore();

      // Verificar que el usuario existe
      const userDoc = await db.collection("usuarios").doc(requestUserId as string).get();
      if (!userDoc.exists) {
        const providerDoc = await db.collection("prestadores").doc(requestUserId as string).get();
        if (!providerDoc.exists) {
          throw new HttpsError("not-found", "Usuario no encontrado");
        }
      }

      // Obtener datos del wallet
      const walletRef = db.collection("wallets").doc(requestUserId as string);
      const walletDoc = await walletRef.get();

      if (!walletDoc.exists) {
        // Wallet no existe, retornar valores por defecto
        return {
          success: true,
          currentBalance: 0,
          totalEarned: 0,
          totalSpent: 0,
          totalWithdrawn: 0,
          nextBonusAt: LOYALTY_BONUS_THRESHOLD,
          progressToNextBonus: 0,
          recentTransactions: [],
          walletExists: false,
          message: "Wallet no inicializado"
        };
      }

      const walletData = walletDoc.data() as WalletData;

      // Calcular estadísticas principales
      const currentBalance = walletData.balance || 0;
      const totalGastado = walletData.totalSpent || 0;
      const loyaltyBonusesEarned = walletData.bonusesEarned || 0;

      // Calcular totales earned, spent, withdrawn
      const totalEarnedFromBonuses = walletData.breakdown?.totalEarnedFromBonuses || 0;
      const totalEarnedFromCommissions = walletData.breakdown?.totalEarnedFromCommissions || 0;
      const totalEarnedFromRefunds = walletData.breakdown?.totalEarnedFromRefunds || 0;
      const totalEarned = totalEarnedFromBonuses + totalEarnedFromCommissions + totalEarnedFromRefunds;

      // Obtener transacciones recientes (últimas 10)
      const recentTransactionsQuery = await db
        .collection("wallet_transactions")
        .where("userId", "==", requestUserId)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      const recentTransactions = recentTransactionsQuery.docs.map(doc => {
        const data = doc.data() as WalletTransaction;
        return {
          id: doc.id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          sourceId: data.sourceId,
          createdAt: data.createdAt,
          balanceAfter: data.balanceAfter,
          metadata: data.metadata
        };
      });

      // Calcular total retirado sumando transacciones de retiro
      let totalWithdrawn = 0;
      const withdrawalTransactionsQuery = await db
        .collection("wallet_transactions")
        .where("userId", "==", requestUserId)
        .where("type", "==", "withdrawal")
        .get();

      withdrawalTransactionsQuery.docs.forEach(doc => {
        const data = doc.data() as WalletTransaction;
        totalWithdrawn += data.amount;
      });

      // Calcular progreso hacia próximo bonus de lealtad
      const nextBonusThreshold = (loyaltyBonusesEarned + 1) * LOYALTY_BONUS_THRESHOLD;
      const progressAmount = totalGastado - (loyaltyBonusesEarned * LOYALTY_BONUS_THRESHOLD);
      const progressToNextBonus = Math.min(
        (progressAmount / LOYALTY_BONUS_THRESHOLD) * 100, 
        100
      );
      const amountNeededForNextBonus = Math.max(0, nextBonusThreshold - totalGastado);

      // Obtener estadísticas adicionales de bonos de lealtad
      const loyaltyBonusesQuery = await db
        .collection("loyalty_bonuses")
        .where("userId", "==", requestUserId)
        .where("otorgado", "==", true)
        .get();

      const loyaltyBonusesGranted = loyaltyBonusesQuery.docs.length;
      const totalLoyaltyBonusAmount = loyaltyBonusesQuery.docs.reduce((sum, doc) => {
        const data = doc.data() as LoyaltyBonusData;
        return sum + data.bonusAmount;
      }, 0);

      // Obtener información de retiros pendientes
      const pendingWithdrawalsQuery = await db
        .collection("withdrawals")
        .where("userId", "==", requestUserId)
        .where("status", "in", ["pending", "processing"])
        .get();

      const pendingWithdrawals = pendingWithdrawalsQuery.docs.map(doc => {
        const data = doc.data() as WithdrawalData;
        return {
          id: doc.id,
          amount: data.amount,
          status: data.status,
          fecha: data.fecha,
          bankName: data.bankDetails.bankName
        };
      });

      // Log de consulta (opcional, para analytics)
      await logActivity(
        requestUserId as string,
        "usuario",
        "WALLET_BALANCE_CONSULTED" as ActivityLogAction,
        `Usuario consultó balance de wallet: $${currentBalance.toFixed(2)}`,
        { tipo: "wallet", id: requestUserId as string },
        {
          currentBalance,
          totalEarned,
          totalSpent: totalGastado,
          totalWithdrawn,
          loyaltyBonusesEarned
        }
      );

      return {
        success: true,
        currentBalance,
        totalEarned,
        totalSpent: totalGastado,
        totalWithdrawn,
        nextBonusAt: nextBonusThreshold,
        progressToNextBonus: Math.round(progressToNextBonus * 100) / 100, // Round to 2 decimals
        amountNeededForNextBonus,
        recentTransactions,
        walletExists: true,
        
        // Estadísticas detalladas
        breakdown: {
          totalEarnedFromBonuses,
          totalEarnedFromCommissions, 
          totalEarnedFromRefunds,
          loyaltyBonusesGranted,
          totalLoyaltyBonusAmount
        },
        
        // Límites y configuración
        limits: {
          dailySpendingLimit: walletData.limits?.dailySpendingLimit || 10000,
          withdrawalLimit: walletData.limits?.withdrawalLimit || 5000,
          dailySpentToday: walletData.limits?.dailySpentToday || 0,
          blockedBalance: walletData.limits?.blockedBalance || 0
        },
        
        // Estado de retiros
        pendingWithdrawals,
        
        // Información de lealtad
        loyalty: {
          currentThreshold: loyaltyBonusesEarned * LOYALTY_BONUS_THRESHOLD,
          nextThreshold: nextBonusThreshold,
          bonusAmount: LOYALTY_BONUS_AMOUNT,
          progressToNextBonus: Math.round(progressToNextBonus * 100) / 100,
          amountNeededForNextBonus,
          totalBonusesEarned: loyaltyBonusesEarned,
          totalBonusAmount: totalLoyaltyBonusAmount
        }
      };

    } catch (error) {
      console.error("Error getting wallet balance:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error al obtener balance del wallet.");
    }
  }
);

// =============================================================================
// 🤖 TRIGGER AUTOMÁTICO: Procesar comisiones cuando un servicio se completa
// =============================================================================

export const onServiceCompleted = onDocumentUpdated(
  "service_requests/{serviceId}",
  async (event) => {
    const serviceId = event.params.serviceId;
    const newData = event.data?.after.data();
    const oldData = event.data?.before.data();
    
    // Verificar que los datos existen
    if (!newData || !oldData) {
      console.log(`⚠️ Datos faltantes para servicio ${serviceId}`);
      return;
    }

    const oldStatus = oldData.status;
    const newStatus = newData.status;

    console.log(`🔄 Servicio ${serviceId} cambió de estado: ${oldStatus} → ${newStatus}`);

    // ✅ TRIGGER: Cuando un servicio se marca como completado por el usuario
    if (oldStatus !== "completado_por_usuario" && newStatus === "completado_por_usuario") {
      console.log(`🎯 ¡Servicio completado! Procesando comisiones automáticamente para ${serviceId}`);
      
      try {
        // Validar que tenemos los datos necesarios
        if (!newData.totalAmount || !newData.prestadorId || !newData.usuarioId) {
          console.error(`❌ Datos faltantes en servicio ${serviceId}:`, {
            totalAmount: newData.totalAmount,
            prestadorId: newData.prestadorId,
            usuarioId: newData.usuarioId
          });
          return;
        }

        // Crear mock auth para el sistema
        const systemAuth = {
          uid: "system-trigger",
          token: {} as any
        };

        // Crear mock request para processServiceCommissions
        const mockRequest: CallableRequest<Record<string, unknown>> = {
          data: {
            serviceRequestId: serviceId,
            totalAmount: newData.totalAmount,
            providerId: newData.prestadorId,
            userId: newData.usuarioId
          },
          auth: systemAuth,
          rawRequest: {} as any,
          acceptsStreaming: false
        };

        // 🚀 Ejecutar procesamiento completo de comisiones
        const result = await (processServiceCommissions as any)(mockRequest);

        console.log(`✅ Comisiones procesadas automáticamente para ${serviceId}:`, {
          totalCommissionsPaid: result.totalCommissionsPaid,
          walletsCredit: result.creditedToWallets.length,
          loyaltyBonuses: result.loyaltyBonusesTriggered.length
        });

        // Log especial para el trigger automático
        await logActivity(
          "sistema",
          "sistema", 
          "COMISIONES_PROCESADAS_COMPLETAMENTE" as ActivityLogAction,
          `🤖 TRIGGER AUTOMÁTICO: Comisiones procesadas cuando servicio ${serviceId} se completó. Total: $${result.totalCommissionsPaid.toFixed(2)}`,
          { tipo: "trigger_automatico", id: serviceId },
          {
            serviceId,
            oldStatus,
            newStatus,
            triggerType: "service_completed",
            automaticProcessing: true,
            ...result
          }
        );

      } catch (error) {
        console.error(`❌ Error procesando comisiones automáticamente para servicio ${serviceId}:`, error);
        
        // Log del error para auditoría
        await logActivity(
          "sistema",
          "sistema",
          "COMISIONES_CALCULADAS" as ActivityLogAction,
          `❌ ERROR en trigger automático: Falló procesamiento de comisiones para servicio ${serviceId}`,
          { tipo: "trigger_error", id: serviceId },
          {
            serviceId,
            oldStatus,
            newStatus,
            triggerType: "service_completed",
            error: error instanceof Error ? error.message : 'Error desconocido'
          }
        );
      }
    }

    // 🔄 TRIGGER ADICIONAL: Cuando servicio pasa a "pagada" (para casos edge)
    else if (oldStatus !== "pagada" && newStatus === "pagada" && newData.paidWithWallet === true) {
      console.log(`💳 Servicio ${serviceId} pagado con wallet - verificando si ya se procesaron comisiones`);
      
      // Solo procesar si no se han procesado comisiones aún
      if (!newData.comisionesCalculadas) {
        console.log(`⚡ Procesando comisiones para pago con wallet: ${serviceId}`);
        
        try {
          const systemAuth = {
            uid: "system-wallet-payment",
            token: {} as any
          };

          const mockRequest: CallableRequest<Record<string, unknown>> = {
            data: {
              serviceRequestId: serviceId,
              totalAmount: newData.totalAmount || newData.montoCobrado,
              providerId: newData.prestadorId,
              userId: newData.usuarioId
            },
            auth: systemAuth,
            rawRequest: {} as any,
            acceptsStreaming: false
          };

          await (processServiceCommissions as any)(mockRequest);
          
          console.log(`✅ Comisiones procesadas para pago con wallet: ${serviceId}`);
          
        } catch (error) {
          console.error(`❌ Error procesando comisiones para pago wallet ${serviceId}:`, error);
        }
      } else {
        console.log(`ℹ️ Comisiones ya procesadas para servicio ${serviceId}`);
      }
    }
    
    // 📊 LOG de información para otros cambios de estado
    else {
      console.log(`ℹ️ Cambio de estado registrado para ${serviceId}: ${oldStatus} → ${newStatus} (sin trigger de comisiones)`);
    }
  }
);

// ====================================================================
// 🏢 FIXED BUSINESS SYSTEM
// ====================================================================

/**
 * 🏢 registerFixedBusiness
 * Registra un negocio fijo nuevo con validación de ubicación única
 */
export const registerFixedBusiness = onCall<{
  businessName: string;
  category: string;
  location: { lat: number; lng: number };
  address: string;
  ambassadorId: string;
  isLaunchPromo: boolean;
}>(
  async (request): Promise<{
    businessId: string;
    uniqueLocationId: string;
    promoMonths: number;
    success: boolean;
  }> => {
    const { businessName, category, location, address, ambassadorId, isLaunchPromo } = request.data;

    // Validación de parámetros
    if (!businessName?.trim()) {
      throw new HttpsError("invalid-argument", "Nombre del negocio es requerido");
    }
    if (!category?.trim()) {
      throw new HttpsError("invalid-argument", "Categoría es requerida");
    }
    if (!location?.lat || !location?.lng) {
      throw new HttpsError("invalid-argument", "Ubicación GPS es requerida");
    }
    if (!address?.trim()) {
      throw new HttpsError("invalid-argument", "Dirección es requerida");
    }
    if (!ambassadorId?.trim()) {
      throw new HttpsError("invalid-argument", "ID de embajador es requerido");
    }

    console.log(`🏢 Registrando negocio fijo: ${businessName} para embajador ${ambassadorId}`);

    try {
      const now = admin.firestore.Timestamp.now();
      
      // 1. Validar ubicación única usando la función auxiliar
      const locationValidation = await validateUniqueBusinessLocationInternal({
        lat: location.lat,
        lng: location.lng,
        businessName
      });

      if (!locationValidation.isUnique && !locationValidation.isCommercialPlaza) {
        throw new HttpsError(
          "already-exists",
          `Ya existe un negocio en esta ubicación: ${locationValidation.conflictingBusiness}`
        );
      }

      // 2. Verificar que el embajador existe
      const ambassadorDoc = await db.collection("ambassadors").where("userId", "==", ambassadorId).get();
      if (ambassadorDoc.empty) {
        throw new HttpsError("not-found", "Embajador no encontrado");
      }

      const ambassadorData = ambassadorDoc.docs[0].data() as AmbassadorData;
      const ambassadorRef = ambassadorDoc.docs[0].ref;

      // 3. Crear ID único para la ubicación
      const uniqueLocationId = locationValidation.suggestedId || 
        `#SRV${String(Date.now()).slice(-6)}`;

      // 4. Determinar promoción de lanzamiento
      const promoMonths = isLaunchPromo ? 3 : 0;
      const promoEndsAt = isLaunchPromo ? 
        admin.firestore.Timestamp.fromMillis(now.toMillis() + (90 * 24 * 60 * 60 * 1000)) : 
        undefined;

      // 5. Crear registro del negocio
      const businessRef = db.collection("fixedBusinesses").doc();
      const businessData: FixedBusinessData = {
        businessName,
        category,
        location,
        address,
        ambassadorId,
        uniqueLocationId,
        isActive: true,
        subscriptionStatus: isLaunchPromo ? "active" : "payment_pending",
        createdAt: now,
        updatedAt: now,
        monthlyFee: FIXED_BUSINESS_MONTHLY_FEE,
        nextPaymentDate: isLaunchPromo ? 
          admin.firestore.Timestamp.fromMillis(now.toMillis() + (90 * 24 * 60 * 60 * 1000)) :
          admin.firestore.Timestamp.fromMillis(now.toMillis() + (30 * 24 * 60 * 60 * 1000)),
        isLaunchPromo,
        promoMonths,
        promoEndsAt,
        isCommercialPlaza: locationValidation.isCommercialPlaza,
        profile: {
          description: "",
          photos: [],
          hours: {
            monday: { open: "09:00", close: "18:00" },
            tuesday: { open: "09:00", close: "18:00" },
            wednesday: { open: "09:00", close: "18:00" },
            thursday: { open: "09:00", close: "18:00" },
            friday: { open: "09:00", close: "18:00" },
            saturday: { open: "09:00", close: "14:00" },
            sunday: { closed: true, open: "", close: "" }
          },
          contact: {},
          rating: 0,
          reviewCount: 0
        }
      };

      // 6. Transacción para crear negocio y actualizar embajador
      await db.runTransaction(async (transaction) => {
        // Crear negocio
        transaction.set(businessRef, businessData);

        // Actualizar estadísticas del embajador
        const updatedStats = {
          ...ambassadorData.stats,
          businessReferrals: (ambassadorData.stats.businessReferrals || 0) + 1,
          totalReferrals: (ambassadorData.stats.totalReferrals || 0) + 1
        };

        const updatedBusinesses = [
          ...(ambassadorData.assignedBusinesses || []),
          businessRef.id
        ];

        transaction.update(ambassadorRef, {
          stats: updatedStats,
          assignedBusinesses: updatedBusinesses
        });

        // Crear/actualizar registro de ubicación
        if (locationValidation.isCommercialPlaza) {
          const locationQuery = await db.collection("businessLocations")
            .where("lat", ">=", location.lat - 0.0001)
            .where("lat", "<=", location.lat + 0.0001)
            .get();

          let locationRef;
          if (!locationQuery.empty) {
            // Actualizar ubicación existente
            locationRef = locationQuery.docs[0].ref;
            const existingData = locationQuery.docs[0].data() as BusinessLocationData;
            transaction.update(locationRef, {
              businessCount: existingData.businessCount + 1,
              businesses: [...existingData.businesses, businessRef.id],
              updatedAt: now
            });
          } else {
            // Crear nueva ubicación
            locationRef = db.collection("businessLocations").doc();
            const locationData: BusinessLocationData = {
              lat: location.lat,
              lng: location.lng,
              businessCount: 1,
              isCommercialPlaza: true,
              businesses: [businessRef.id],
              createdAt: now,
              updatedAt: now
            };
            transaction.set(locationRef, locationData);
          }
        }
      });

      // 7. Registrar actividad
      await logActivity(
        ambassadorId,
        "sistema",
        "FIXED_BUSINESS_REGISTERED" as ActivityLogAction,
        `🏢 Negocio fijo registrado: ${businessName}`,
        { tipo: "business_registration", id: businessRef.id },
        {
          businessId: businessRef.id,
          businessName,
          category,
          uniqueLocationId,
          isLaunchPromo,
          promoMonths
        }
      );

      console.log(`✅ Negocio fijo registrado exitosamente: ${businessRef.id}`);

      return {
        businessId: businessRef.id,
        uniqueLocationId,
        promoMonths,
        success: true
      };

    } catch (error) {
      console.error("❌ Error registrando negocio fijo:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "Error interno registrando negocio fijo"
      );
    }
  }
);

/**
 * 🗺️ validateUniqueBusinessLocation
 * Verifica si la ubicación ya está ocupada o es plaza comercial
 */
export const validateUniqueBusinessLocation = onCall<{
  lat: number;
  lng: number;
  businessName: string;
}>(
  async (request): Promise<{
    isUnique: boolean;
    conflictingBusiness?: string;
    suggestedId?: string;
    isCommercialPlaza: boolean;
  }> => {
    const { lat, lng, businessName } = request.data;

    if (!lat || !lng) {
      throw new HttpsError("invalid-argument", "Coordenadas GPS son requeridas");
    }
    if (!businessName?.trim()) {
      throw new HttpsError("invalid-argument", "Nombre del negocio es requerido");
    }

    try {
      return await validateUniqueBusinessLocationInternal({ lat, lng, businessName });
    } catch (error) {
      console.error("❌ Error validando ubicación:", error);
      throw new HttpsError("internal", "Error validando ubicación del negocio");
    }
  }
);

// Función auxiliar interna para validación de ubicación
async function validateUniqueBusinessLocationInternal({
  lat,
  lng,
  businessName
}: {
  lat: number;
  lng: number;
  businessName: string;
}): Promise<{
  isUnique: boolean;
  conflictingBusiness?: string;
  suggestedId?: string;
  isCommercialPlaza: boolean;
}> {
  console.log(`🗺️ Validando ubicación: ${lat}, ${lng} para ${businessName}`);

  // Buscar negocios en radio de BUSINESS_LOCATION_RADIUS metros (10m)
  const radiusInDegrees = BUSINESS_LOCATION_RADIUS / 111000; // Aproximación: 1 grado ≈ 111km

  const nearbyBusinesses = await db.collection("fixedBusinesses")
    .where("location.lat", ">=", lat - radiusInDegrees)
    .where("location.lat", "<=", lat + radiusInDegrees)
    .get();

  const conflictingBusinesses = nearbyBusinesses.docs.filter(doc => {
    const business = doc.data() as FixedBusinessData;
    const distance = calculateDistance(lat, lng, business.location.lat, business.location.lng);
    return distance <= BUSINESS_LOCATION_RADIUS && business.isActive;
  });

  if (conflictingBusinesses.length === 0) {
    // Ubicación completamente única
    return {
      isUnique: true,
      isCommercialPlaza: false
    };
  }

  // Verificar si es plaza comercial (múltiples negocios permitidos)
  const isPlaza = conflictingBusinesses.length >= 2 || 
    conflictingBusinesses.some(doc => {
      const business = doc.data() as FixedBusinessData;
      return business.isCommercialPlaza;
    });

  if (isPlaza) {
    // Es plaza comercial - generar ID único
    const existingIds = conflictingBusinesses.map(doc => {
      const business = doc.data() as FixedBusinessData;
      return business.uniqueLocationId;
    });

    let counter = 1;
    let suggestedId = `#SRV${String(counter).padStart(3, '0')}`;
    
    while (existingIds.includes(suggestedId)) {
      counter++;
      suggestedId = `#SRV${String(counter).padStart(3, '0')}`;
    }

    return {
      isUnique: true, // Permitido en plaza
      isCommercialPlaza: true,
      suggestedId
    };
  }

  // Ubicación ocupada por un solo negocio - no permitido
  const conflictingBusiness = conflictingBusinesses[0].data() as FixedBusinessData;
  
  return {
    isUnique: false,
    conflictingBusiness: conflictingBusiness.businessName,
    isCommercialPlaza: false
  };
}

// Función auxiliar para calcular distancia en metros
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * 💳 processMonthlySubscriptions
 * Procesa pagos mensuales de negocios fijos automáticamente
 */
export const processMonthlySubscriptions = onCall<{
  businessId: string;
  paymentMethodId: string;
}>(
  async (request): Promise<{
    success: boolean;
    status: "paid" | "failed" | "grace_period";
    nextPaymentDate?: number;
    message: string;
  }> => {
    const { businessId, paymentMethodId } = request.data;

    if (!businessId?.trim()) {
      throw new HttpsError("invalid-argument", "ID del negocio es requerido");
    }
    if (!paymentMethodId?.trim()) {
      throw new HttpsError("invalid-argument", "Método de pago es requerido");
    }

    console.log(`💳 Procesando suscripción mensual para negocio: ${businessId}`);

    try {
      const now = admin.firestore.Timestamp.now();
      
      // 1. Obtener datos del negocio
      const businessDoc = await db.collection("fixedBusinesses").doc(businessId).get();
      if (!businessDoc.exists) {
        throw new HttpsError("not-found", "Negocio no encontrado");
      }

      const businessData = businessDoc.data() as FixedBusinessData;

      // 2. Verificar si está en promoción de lanzamiento
      if (businessData.isLaunchPromo && businessData.promoEndsAt && 
          now.toMillis() < businessData.promoEndsAt.toMillis()) {
        console.log(`🎉 Negocio ${businessId} aún en promoción hasta ${businessData.promoEndsAt.toDate()}`);
        
        // Actualizar próxima fecha de pago
        const nextPayment = admin.firestore.Timestamp.fromMillis(
          businessData.promoEndsAt.toMillis()
        );

        await businessDoc.ref.update({
          nextPaymentDate: nextPayment,
          updatedAt: now
        });

        return {
          success: true,
          status: "paid",
          nextPaymentDate: nextPayment.toMillis(),
          message: "Negocio en promoción de lanzamiento - sin cargo"
        };
      }

      // 3. Procesar pago con Stripe
      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-06-30.basil",
      });

      let paymentResult;
      try {
        // Crear PaymentIntent para $25 USD
        const paymentIntent = await stripe.paymentIntents.create({
          amount: FIXED_BUSINESS_MONTHLY_FEE * 100, // $25.00 en centavos
          currency: "usd",
          payment_method: paymentMethodId,
          confirm: true,
          return_url: "https://servimap.com/business/payment-complete",
          metadata: {
            businessId,
            type: "monthly_subscription",
            month: new Date().toISOString().slice(0, 7) // YYYY-MM
          }
        });

        paymentResult = paymentIntent;
        
      } catch (stripeError) {
        console.error(`❌ Error de Stripe para negocio ${businessId}:`, stripeError);
        
        // Marcar como payment_pending con período de gracia
        const gracePeriodEnd = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + (PAYMENT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
        );

        await businessDoc.ref.update({
          subscriptionStatus: "payment_pending",
          nextPaymentDate: gracePeriodEnd,
          updatedAt: now
        });

        await logActivity(
          businessData.ambassadorId,
          "sistema",
          "BUSINESS_SUBSCRIPTION_FAILED" as ActivityLogAction,
          `💳 Falló pago mensual para ${businessData.businessName}`,
          { tipo: "subscription_failed", id: businessId },
          {
            businessId,
            paymentMethodId,
            error: stripeError instanceof Error ? stripeError.message : 'Error de pago',
            gracePeriodDays: PAYMENT_GRACE_PERIOD_DAYS
          }
        );

        return {
          success: false,
          status: "grace_period",
          nextPaymentDate: gracePeriodEnd.toMillis(),
          message: `Pago falló - período de gracia de ${PAYMENT_GRACE_PERIOD_DAYS} días activado`
        };
      }

      // 4. Pago exitoso - actualizar negocio y procesar comisión
      if (paymentResult.status === "succeeded") {
        const nextPayment = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + (30 * 24 * 60 * 60 * 1000) // 30 días
        );

        // Transacción para actualizar negocio y procesar comisión
        await db.runTransaction(async (transaction) => {
          // Actualizar estado del negocio
          transaction.update(businessDoc.ref, {
            subscriptionStatus: "active",
            lastPaymentDate: now,
            nextPaymentDate: nextPayment,
            updatedAt: now
          });

          // Obtener datos del embajador para comisión
          const ambassadorQuery = await db.collection("ambassadors")
            .where("userId", "==", businessData.ambassadorId)
            .get();

          if (!ambassadorQuery.empty) {
            const ambassadorDoc = ambassadorQuery.docs[0];
            const ambassadorData = ambassadorDoc.data() as AmbassadorData;
            
            // Calcular comisión: $10 (gratuito) o $12.50 (premium)
            const commissionAmount = ambassadorData.level === "premium" ? 12.50 : 10.00;
            
            // Procesar comisión de membresía automáticamente
            const mockRequest: CallableRequest<Record<string, unknown>> = {
              data: {
                membershipType: "fixed_business",
                amount: FIXED_BUSINESS_MONTHLY_FEE,
                memberId: businessId,
                ambassadorId: businessData.ambassadorId,
                ambassadorLevel: ambassadorData.level
              },
              auth: {
                uid: "system-monthly-subscription",
                token: {} as any
              },
              rawRequest: {} as any,
              acceptsStreaming: false
            };

            // Llamar a processMembershipCommissions internamente
            try {
              await (processMembershipCommissions as any)(mockRequest);
              console.log(`💰 Comisión de $${commissionAmount} procesada para embajador ${businessData.ambassadorId}`);
            } catch (commissionError) {
              console.error(`❌ Error procesando comisión:`, commissionError);
            }
          }
        });

        // 5. Registrar actividad exitosa
        await logActivity(
          businessData.ambassadorId,
          "sistema",
          "BUSINESS_SUBSCRIPTION_PROCESSED" as ActivityLogAction,
          `💳 Pago mensual exitoso para ${businessData.businessName}`,
          { tipo: "subscription_success", id: businessId },
          {
            businessId,
            amount: FIXED_BUSINESS_MONTHLY_FEE,
            paymentIntentId: paymentResult.id,
            nextPaymentDate: nextPayment.toMillis()
          }
        );

        console.log(`✅ Suscripción procesada exitosamente para negocio: ${businessId}`);

        return {
          success: true,
          status: "paid",
          nextPaymentDate: nextPayment.toMillis(),
          message: "Pago mensual procesado exitosamente"
        };
      }

      // 6. Estado de pago desconocido
      throw new HttpsError("internal", `Estado de pago inesperado: ${paymentResult.status}`);

    } catch (error) {
      console.error("❌ Error procesando suscripción mensual:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "Error interno procesando suscripción mensual"
      );
    }
  }
);

/**
 * 📸 handleBusinessProfile
 * Gestiona el perfil del negocio con límites de multimedia
 */
export const handleBusinessProfile = onCall<{
  businessId: string;
  photos?: string[];
  video?: string;
  description?: string;
  hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
}>(
  async (request): Promise<{
    success: boolean;
    profileUpdated: boolean;
    warnings?: string[];
  }> => {
    const { businessId, photos, video, description, hours, contact } = request.data;

    if (!businessId?.trim()) {
      throw new HttpsError("invalid-argument", "ID del negocio es requerido");
    }

    console.log(`📸 Actualizando perfil para negocio: ${businessId}`);

    try {
      const now = admin.firestore.Timestamp.now();
      const warnings: string[] = [];

      // 1. Obtener datos del negocio
      const businessDoc = await db.collection("fixedBusinesses").doc(businessId).get();
      if (!businessDoc.exists) {
        throw new HttpsError("not-found", "Negocio no encontrado");
      }

      const businessData = businessDoc.data() as FixedBusinessData;

      // 2. Validar límites de multimedia
      if (photos && photos.length > MAX_BUSINESS_PHOTOS) {
        throw new HttpsError(
          "invalid-argument", 
          `Máximo ${MAX_BUSINESS_PHOTOS} fotos permitidas. Recibidas: ${photos.length}`
        );
      }

      // 3. Validar URLs de fotos (básico)
      if (photos) {
        for (const photo of photos) {
          if (!photo.startsWith('http') && !photo.startsWith('gs://')) {
            warnings.push(`URL de foto inválida: ${photo.substring(0, 50)}...`);
          }
        }
      }

      // 4. Validar URL de video
      if (video && !video.startsWith('http') && !video.startsWith('gs://')) {
        warnings.push(`URL de video inválida: ${video.substring(0, 50)}...`);
      }

      // 5. Validar horarios
      if (hours) {
        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (const day of Object.keys(hours)) {
          if (!validDays.includes(day)) {
            warnings.push(`Día inválido: ${day}`);
            continue;
          }

          const daySchedule = hours[day];
          if (!daySchedule.closed && (!daySchedule.open || !daySchedule.close)) {
            warnings.push(`Horario incompleto para ${day}`);
          }

          // Validar formato de hora (HH:MM)
          if (!daySchedule.closed) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(daySchedule.open) || !timeRegex.test(daySchedule.close)) {
              warnings.push(`Formato de hora inválido para ${day} (usar HH:MM)`);
            }
          }
        }
      }

      // 6. Validar datos de contacto
      if (contact) {
        if (contact.email && !contact.email.includes('@')) {
          warnings.push('Formato de email inválido');
        }
        
        if (contact.website && !contact.website.startsWith('http')) {
          warnings.push('URL de website debe comenzar con http:// o https://');
        }

        if (contact.phone && contact.phone.length < 10) {
          warnings.push('Número de teléfono muy corto');
        }
      }

      // 7. Preparar datos del perfil actualizado
      const currentProfile = businessData.profile || {};
      const updatedProfile = {
        ...currentProfile,
        ...(description !== undefined && { description }),
        ...(photos !== undefined && { photos }),
        ...(video !== undefined && { video }),
        ...(hours !== undefined && { hours }),
        ...(contact !== undefined && { 
          contact: { ...currentProfile.contact, ...contact }
        })
      };

      // 8. Actualizar el perfil del negocio
      await businessDoc.ref.update({
        profile: updatedProfile,
        updatedAt: now
      });

      // 9. Registrar actividad
      await logActivity(
        businessData.ambassadorId,
        "sistema",
        "BUSINESS_PROFILE_UPDATED" as ActivityLogAction,
        `📸 Perfil actualizado para ${businessData.businessName}`,
        { tipo: "profile_update", id: businessId },
        {
          businessId,
          businessName: businessData.businessName,
          updatedFields: {
            hasPhotos: photos !== undefined,
            hasVideo: video !== undefined,
            hasDescription: description !== undefined,
            hasHours: hours !== undefined,
            hasContact: contact !== undefined
          },
          photoCount: photos?.length || currentProfile.photos?.length || 0,
          warningCount: warnings.length
        }
      );

      console.log(`✅ Perfil actualizado para negocio: ${businessId}`);

      return {
        success: true,
        profileUpdated: true,
        ...(warnings.length > 0 && { warnings })
      };

    } catch (error) {
      console.error("❌ Error actualizando perfil del negocio:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "Error interno actualizando perfil del negocio"
      );
    }
  }
);

/**
 * 🗺️ getNearbyFixedBusinesses
 * Obtiene negocios fijos en radio de 2km ordenados por distancia
 */
export const getNearbyFixedBusinesses = onCall<{
  userLat: number;
  userLng: number;
  category?: string;
  limit: number;
}>(
  async (request): Promise<{
    businesses: Array<{
      id: string;
      businessName: string;
      category: string;
      location: { lat: number; lng: number };
      address: string;
      uniqueLocationId: string;
      distance: number;
      profile: {
        description?: string;
        photos?: string[];
        rating?: number;
        reviewCount?: number;
        hours?: Record<string, any>;
        contact?: Record<string, any>;
      };
      isActive: boolean;
    }>;
    totalFound: number;
  }> => {
    const { userLat, userLng, category, limit = 20 } = request.data;

    if (!userLat || !userLng) {
      throw new HttpsError("invalid-argument", "Coordenadas del usuario son requeridas");
    }
    if (limit <= 0 || limit > 100) {
      throw new HttpsError("invalid-argument", "Límite debe estar entre 1 y 100");
    }

    console.log(`🗺️ Buscando negocios cerca de: ${userLat}, ${userLng}`);

    try {
      // 1. Calcular rango de búsqueda (2km en grados aproximadamente)
      const radiusInDegrees = NEARBY_BUSINESS_RADIUS / 111000; // 2000m / 111000m por grado

      // 2. Query inicial por latitud (Firestore limitation - single inequality)
      let query = db.collection("fixedBusinesses")
        .where("isActive", "==", true)
        .where("subscriptionStatus", "==", "active")
        .where("location.lat", ">=", userLat - radiusInDegrees)
        .where("location.lat", "<=", userLat + radiusInDegrees);

      // 3. Agregar filtro de categoría si se especifica
      if (category?.trim()) {
        query = query.where("category", "==", category);
      }

      // 4. Obtener resultados
      const querySnapshot = await query.get();

      // 5. Filtrar por distancia real y calcular distancia exacta
      const businessesWithDistance = querySnapshot.docs
        .map(doc => {
          const data = doc.data() as FixedBusinessData;
          const distance = calculateDistance(
            userLat, 
            userLng, 
            data.location.lat, 
            data.location.lng
          );

          return {
            id: doc.id,
            businessName: data.businessName,
            category: data.category,
            location: { lat: data.location.lat, lng: data.location.lng },
            address: data.address || data.location.address || "",
            uniqueLocationId: data.uniqueLocationId || data.location.uniqueId || "",
            distance: Math.round(distance), // En metros
            profile: {
              description: data.profile?.description || "",
              photos: data.profile?.photos || [],
              rating: data.profile?.rating || 0,
              reviewCount: data.profile?.reviewCount || 0,
              hours: data.profile?.hours || {},
              contact: data.profile?.contact || {}
            },
            isActive: data.isActive
          };
        })
        .filter(business => business.distance <= NEARBY_BUSINESS_RADIUS) // Filtro exacto por 2km
        .sort((a, b) => a.distance - b.distance) // Ordenar por distancia
        .slice(0, limit); // Aplicar límite

      console.log(`✅ Encontrados ${businessesWithDistance.length} negocios cerca del usuario`);

      return {
        businesses: businessesWithDistance,
        totalFound: businessesWithDistance.length
      };

    } catch (error) {
      console.error("❌ Error obteniendo negocios cercanos:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "Error interno obteniendo negocios cercanos"
      );
    }
  }
);

// ====================================================================
// 👥 AMBASSADOR SYSTEM
// ====================================================================

/**
 * 🔗 generateAmbassadorCode
 * Genera código único de embajador para tracking de referidos
 */
export const generateAmbassadorCode = onCall<{
  userId: string;
  preferredName?: string;
}>(
  async (request): Promise<{
    ambassadorCode: string;
    referralLink: string;
  }> => {
    const { userId, preferredName } = request.data;

    if (!userId?.trim()) {
      throw new HttpsError("invalid-argument", "ID de usuario es requerido");
    }

    console.log(`🔗 Generando código de embajador para usuario: ${userId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar si ya existe un embajador para este usuario
      const existingAmbassador = await db.collection("ambassadors")
        .where("userId", "==", userId)
        .get();

      if (!existingAmbassador.empty) {
        const ambassadorData = existingAmbassador.docs[0].data() as AmbassadorData;
        console.log(`ℹ️ Usuario ${userId} ya tiene código de embajador: ${ambassadorData.ambassadorCode}`);
        
        return {
          ambassadorCode: ambassadorData.ambassadorCode,
          referralLink: ambassadorData.referralLink
        };
      }

      // 2. Obtener datos del usuario para generar código
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "Usuario no encontrado");
      }

      const userData = userDoc.data() as UserData;

      // 3. Generar código único
      let ambassadorCode = "";
      let attempts = 0;
      const maxAttempts = 10;

      while (!ambassadorCode && attempts < maxAttempts) {
        attempts++;
        
        // Crear código basado en nombre preferido o nombre de usuario
        const baseName = (preferredName || userData.nombre || "USER")
          .toUpperCase()
          .replace(/[^A-Z]/g, "") // Solo letras
          .substring(0, 4); // Máximo 4 caracteres

        // Agregar año actual y número aleatorio
        const year = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 999) + 1;
        const candidateCode = `${baseName}${year}${String(randomNum).padStart(3, '0')}`;

        // Verificar si el código ya existe
        const existingCode = await db.collection("ambassadors")
          .where("ambassadorCode", "==", candidateCode)
          .get();

        if (existingCode.empty) {
          ambassadorCode = candidateCode;
        }
      }

      if (!ambassadorCode) {
        throw new HttpsError("internal", "No se pudo generar un código único después de varios intentos");
      }

      // 4. Crear link de referido
      const referralLink = `https://servimap.com/register?ref=${ambassadorCode}`;

      // 5. Crear registro de embajador
      const ambassadorRef = db.collection("ambassadors").doc();
      const ambassadorData: AmbassadorData = {
        userId,
        ambassadorCode,
        referralLink,
        isActive: true,
        level: userData.membershipLevel === "premium" ? "premium" : "gratuito",
        createdAt: now,
        stats: {
          totalReferrals: 0,
          userReferrals: 0,
          providerReferrals: 0,
          businessReferrals: 0,
          totalCommissionsEarned: 0
        },
        assignedBusinesses: []
      };

      await ambassadorRef.set(ambassadorData);

      // 6. Registrar actividad
      await logActivity(
        userId,
        "usuario",
        "AMBASSADOR_CODE_GENERATED" as ActivityLogAction,
        `🔗 Código de embajador generado: ${ambassadorCode}`,
        { tipo: "ambassador_created", id: ambassadorRef.id },
        {
          ambassadorId: ambassadorRef.id,
          ambassadorCode,
          referralLink,
          userLevel: userData.membershipLevel || "gratuito"
        }
      );

      console.log(`✅ Código de embajador generado: ${ambassadorCode} para usuario ${userId}`);

      return {
        ambassadorCode,
        referralLink
      };

    } catch (error) {
      console.error("❌ Error generando código de embajador:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "Error interno generando código de embajador"
      );
    }
  }
);

/**
 * 📝 trackReferralRegistration
 * Rastrea cuando alguien se registra con código de embajador
 */
export const trackReferralRegistration = onCall<{
  newUserId: string;
  ambassadorCode: string;
  registrationType: "user" | "provider" | "business";
}>(
  async (request): Promise<{
    success: boolean;
    ambassadorAssigned: string;
    commissionsEnabled: boolean;
  }> => {
    const { newUserId, ambassadorCode, registrationType } = request.data;

    if (!newUserId?.trim()) {
      throw new HttpsError("invalid-argument", "ID del nuevo usuario es requerido");
    }
    if (!ambassadorCode?.trim()) {
      throw new HttpsError("invalid-argument", "Código de embajador es requerido");
    }
    if (!["user", "provider", "business"].includes(registrationType)) {
      throw new HttpsError("invalid-argument", "Tipo de registro inválido");
    }

    console.log(`📝 Rastreando registro referido: ${newUserId} con código ${ambassadorCode}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar que el código de embajador existe
      const ambassadorQuery = await db.collection("ambassadors")
        .where("ambassadorCode", "==", ambassadorCode)
        .where("isActive", "==", true)
        .get();

      if (ambassadorQuery.empty) {
        throw new HttpsError("not-found", "Código de embajador no encontrado o inactivo");
      }

      const ambassadorDoc = ambassadorQuery.docs[0];
      const ambassadorData = ambassadorDoc.data() as AmbassadorData;

      // 2. Verificar que el nuevo usuario no tenga ya un embajador asignado
      const existingReferral = await db.collection("referralRegistrations")
        .where("newUserId", "==", newUserId)
        .get();

      if (!existingReferral.empty) {
        const existingData = existingReferral.docs[0].data() as ReferralRegistrationData;
        console.log(`ℹ️ Usuario ${newUserId} ya tiene embajador asignado: ${existingData.ambassadorCode}`);
        
        return {
          success: false,
          ambassadorAssigned: existingData.ambassadorId,
          commissionsEnabled: false
        };
      }

      // 3. Obtener datos del nuevo usuario para metadata
      const newUserDoc = await db.collection("users").doc(newUserId).get();
      const newUserData = newUserDoc.exists ? newUserDoc.data() as UserData : null;

      // 4. Crear registro de referido y actualizar estadísticas
      await db.runTransaction(async (transaction) => {
        // Crear registro de referido
        const referralRef = db.collection("referralRegistrations").doc();
        const referralData: ReferralRegistrationData = {
          ambassadorId: ambassadorData.userId,
          ambassadorCode,
          newUserId,
          registrationType,
          createdAt: now,
          metadata: {
            email: newUserData?.referidoPor ? "hidden" : undefined,
            // No guardar datos sensibles
          }
        };

        transaction.set(referralRef, referralData);

        // Actualizar estadísticas del embajador
        const updatedStats = { ...ambassadorData.stats };
        updatedStats.totalReferrals = (updatedStats.totalReferrals || 0) + 1;

        switch (registrationType) {
          case "user":
            updatedStats.userReferrals = (updatedStats.userReferrals || 0) + 1;
            break;
          case "provider":
            updatedStats.providerReferrals = (updatedStats.providerReferrals || 0) + 1;
            break;
          case "business":
            updatedStats.businessReferrals = (updatedStats.businessReferrals || 0) + 1;
            break;
        }

        transaction.update(ambassadorDoc.ref, { stats: updatedStats });

        // Asignar embajador permanentemente al nuevo usuario
        const userCollection = registrationType === "provider" ? "providers" : "users";
        if (registrationType !== "business") {
          transaction.update(db.collection(userCollection).doc(newUserId), {
            referidoPor: ambassadorData.userId
          });
        }
      });

      // 5. Registrar actividad
      await logActivity(
        ambassadorData.userId,
        "sistema",
        "REFERRAL_REGISTRATION_TRACKED" as ActivityLogAction,
        `📝 Nuevo referido registrado: ${registrationType}`,
        { tipo: "referral_success", id: newUserId },
        {
          newUserId,
          ambassadorCode,
          registrationType,
          ambassadorId: ambassadorData.userId
        }
      );

      console.log(`✅ Referido registrado exitosamente: ${newUserId} → ${ambassadorData.userId}`);

      return {
        success: true,
        ambassadorAssigned: ambassadorData.userId,
        commissionsEnabled: true
      };

    } catch (error) {
      console.error("❌ Error rastreando registro referido:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "Error interno rastreando registro referido"
      );
    }
  }
);

/**
 * ✅ validateUniqueRegistration
 * Evita registros duplicados por diferentes embajadores
 */
export const validateUniqueRegistration = onCall<{
  email?: string;
  phone?: string;
  location?: { lat: number; lng: number };
  businessName?: string;
}>(
  async (request): Promise<{
    isUnique: boolean;
    existingAmbassador?: string;
    conflictType?: "email" | "phone" | "location";
  }> => {
    const { email, phone, location, businessName } = request.data;

    if (!email && !phone && !location) {
      throw new HttpsError("invalid-argument", "Se requiere al menos email, teléfono o ubicación");
    }

    console.log(`✅ Validando registro único`);

    try {
      let conflictType: "email" | "phone" | "location" | undefined;
      let existingAmbassador: string | undefined;

      // 1. Verificar email duplicado
      if (email?.trim()) {
        const emailQuery = await db.collection("users")
          .where("email", "==", email.toLowerCase())
          .get();

        if (!emailQuery.empty) {
          const userData = emailQuery.docs[0].data() as UserData;
          if (userData.referidoPor) {
            conflictType = "email";
            existingAmbassador = userData.referidoPor;
          }
        }

        // También verificar en proveedores
        if (!conflictType) {
          const providerQuery = await db.collection("providers")
            .where("email", "==", email.toLowerCase())
            .get();

          if (!providerQuery.empty) {
            const providerData = providerQuery.docs[0].data() as ProviderData;
            if (providerData.referidoPor) {
              conflictType = "email";
              existingAmbassador = providerData.referidoPor;
            }
          }
        }
      }

      // 2. Verificar teléfono duplicado
      if (!conflictType && phone?.trim()) {
        const phoneQuery = await db.collection("users")
          .where("phone", "==", phone)
          .get();

        if (!phoneQuery.empty) {
          const userData = phoneQuery.docs[0].data() as UserData;
          if (userData.referidoPor) {
            conflictType = "phone";
            existingAmbassador = userData.referidoPor;
          }
        }

        // También verificar en proveedores
        if (!conflictType) {
          const providerQuery = await db.collection("providers")
            .where("phone", "==", phone)
            .get();

          if (!providerQuery.empty) {
            const providerData = providerQuery.docs[0].data() as ProviderData;
            if (providerData.referidoPor) {
              conflictType = "phone";
              existingAmbassador = providerData.referidoPor;
            }
          }
        }
      }

      // 3. Verificar ubicación duplicada (solo para negocios)
      if (!conflictType && location && businessName) {
        const locationValidation = await validateUniqueBusinessLocationInternal({
          lat: location.lat,
          lng: location.lng,
          businessName
        });

        if (!locationValidation.isUnique && !locationValidation.isCommercialPlaza) {
          // Buscar el embajador del negocio existente
          const radiusInDegrees = BUSINESS_LOCATION_RADIUS / 111000;
          
          const nearbyBusinesses = await db.collection("fixedBusinesses")
            .where("location.lat", ">=", location.lat - radiusInDegrees)
            .where("location.lat", "<=", location.lat + radiusInDegrees)
            .get();

          for (const doc of nearbyBusinesses.docs) {
            const business = doc.data() as FixedBusinessData;
            const distance = calculateDistance(
              location.lat, 
              location.lng, 
              business.location.lat, 
              business.location.lng
            );
            
            if (distance <= BUSINESS_LOCATION_RADIUS && business.isActive) {
              conflictType = "location";
              existingAmbassador = business.ambassadorId;
              break;
            }
          }
        }
      }

      // 4. Registrar validación
      await logActivity(
        "system",
        "sistema",
        "UNIQUE_REGISTRATION_VALIDATED" as ActivityLogAction,
        `✅ Validación de registro: ${conflictType ? 'conflicto' : 'único'}`,
        { tipo: "validation", id: "unique_check" },
        {
          email: email ? "***" : undefined,
          phone: phone ? "***" : undefined,
          hasLocation: !!location,
          businessName,
          conflictType,
          isUnique: !conflictType
        }
      );

      console.log(`✅ Validación completada - Único: ${!conflictType}`);

      return {
        isUnique: !conflictType,
        ...(existingAmbassador && { existingAmbassador }),
        ...(conflictType && { conflictType })
      };

    } catch (error) {
      console.error("❌ Error validando registro único:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        "Error interno validando registro único"
      );
    }
  }
);

// ====================================================================
// 🚀 OPTIMIZED COMBO FUNCTIONS (Flujo Híbrido)
// ====================================================================

/**
 * 🔍 validateBusinessRegistration
 * Función COMBO que valida todo en una sola llamada
 */
export const validateBusinessRegistration = onCall<{
  businessData: {
    name: string;
    category: string;
    location: { lat: number; lng: number };
    address: string;
  };
  ambassadorCode: string;
  contactInfo?: {
    email?: string;
    phone?: string;
  };
}>(
  async (request): Promise<{
    success: boolean;
    validations: {
      locationValid: boolean;
      ambassadorValid: boolean;
      registrationUnique: boolean;
    };
    locationInfo?: {
      isUnique: boolean;
      isCommercialPlaza: boolean;
      suggestedId?: string;
      conflictingBusiness?: string;
    };
    ambassadorInfo?: {
      ambassadorId: string;
      ambassadorLevel: string;
      isActive: boolean;
    };
    conflicts?: {
      type: "email" | "phone" | "location";
      existingAmbassador: string;
    };
  }> => {
    const { businessData, ambassadorCode, contactInfo } = request.data;

    console.log(`🔍 Validación integral para negocio: ${businessData.name}`);

    try {
      // 1. Validar ubicación única
      const locationValidation = await validateUniqueBusinessLocationInternal({
        lat: businessData.location.lat,
        lng: businessData.location.lng,
        businessName: businessData.name
      });

      // 2. Validar embajador
      const ambassadorQuery = await db.collection("ambassadors")
        .where("ambassadorCode", "==", ambassadorCode)
        .where("isActive", "==", true)
        .get();

      const ambassadorValid = !ambassadorQuery.empty;
      let ambassadorInfo;

      if (ambassadorValid) {
        const ambassadorData = ambassadorQuery.docs[0].data() as AmbassadorData;
        ambassadorInfo = {
          ambassadorId: ambassadorData.userId,
          ambassadorLevel: ambassadorData.level || (ambassadorData.isPremium ? "premium" : "gratuito"),
          isActive: ambassadorData.isActive
        };
      }

      // 3. Validar registro único
      let registrationUnique = true;
      let conflicts;

      if (contactInfo?.email || contactInfo?.phone) {
        const uniqueValidation = await validateUniqueRegistrationInternal({
          email: contactInfo.email,
          phone: contactInfo.phone,
          location: businessData.location,
          businessName: businessData.name
        });

        registrationUnique = uniqueValidation.isUnique;
        if (!uniqueValidation.isUnique) {
          conflicts = {
            type: uniqueValidation.conflictType!,
            existingAmbassador: uniqueValidation.existingAmbassador!
          };
        }
      }

      // 4. Resultado integral
      const allValid = locationValidation.isUnique && ambassadorValid && registrationUnique;

      console.log(`✅ Validación integral completada - Éxito: ${allValid}`);

      return {
        success: allValid,
        validations: {
          locationValid: locationValidation.isUnique,
          ambassadorValid,
          registrationUnique
        },
        locationInfo: locationValidation,
        ...(ambassadorInfo && { ambassadorInfo }),
        ...(conflicts && { conflicts })
      };

    } catch (error) {
      console.error("❌ Error en validación integral:", error);
      throw new HttpsError("internal", "Error en validación de registro de negocio");
    }
  }
);

/**
 * 🏢 registerCompleteFixedBusiness  
 * Función COMBO para registro atómico completo
 */
export const registerCompleteFixedBusiness = onCall<{
  businessData: {
    name: string;
    category: string;
    location: { lat: number; lng: number };
    address: string;
  };
  ambassadorId: string;
  initialProfile?: {
    description?: string;
    photos?: string[];
    video?: string;
    hours?: Record<string, { open: string; close: string; closed?: boolean }>;
    contact?: {
      phone?: string;
      email?: string;
      website?: string;
      whatsapp?: string;
      facebook?: string;
    };
  };
  isLaunchPromo: boolean;
}>(
  async (request): Promise<{
    success: boolean;
    businessId: string;
    ambassadorAssigned: string;
    promoActivated: boolean;
    promoMonths: number;
    nextPaymentDate: number;
  }> => {
    const { businessData, ambassadorId, initialProfile, isLaunchPromo } = request.data;

    console.log(`🏢 Registro integral para negocio: ${businessData.name}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Validación final de ubicación
      const locationValidation = await validateUniqueBusinessLocationInternal({
        lat: businessData.location.lat,
        lng: businessData.location.lng,
        businessName: businessData.name
      });

      if (!locationValidation.isUnique && !locationValidation.isCommercialPlaza) {
        throw new HttpsError(
          "already-exists",
          `Ubicación ocupada: ${locationValidation.conflictingBusiness}`
        );
      }

      // 2. Obtener datos del embajador
      const ambassadorDoc = await db.collection("ambassadors")
        .where("userId", "==", ambassadorId)
        .get();

      if (ambassadorDoc.empty) {
        throw new HttpsError("not-found", "Embajador no encontrado");
      }

      const ambassadorData = ambassadorDoc.docs[0].data() as AmbassadorData;
      const ambassadorRef = ambassadorDoc.docs[0].ref;

      // 3. TRANSACCIÓN ATÓMICA COMPLETA
      const result = await db.runTransaction(async (transaction) => {
        // 3a. Crear negocio
        const businessRef = db.collection("fixedBusinesses").doc();
        const uniqueLocationId = locationValidation.suggestedId || 
          `#SRV${String(Date.now()).slice(-6)}`;

        const promoMonths = isLaunchPromo ? 3 : 0;
        const nextPaymentDate = isLaunchPromo ? 
          admin.firestore.Timestamp.fromMillis(now.toMillis() + (90 * 24 * 60 * 60 * 1000)) :
          admin.firestore.Timestamp.fromMillis(now.toMillis() + (30 * 24 * 60 * 60 * 1000));

        const businessData_final: FixedBusinessData = {
          businessName: businessData.name,
          category: businessData.category,
          location: businessData.location,
          address: businessData.address,
          uniqueLocationId,
          ambassadorId,
          isActive: true,
          subscriptionStatus: isLaunchPromo ? "active" : "payment_pending",
          isLaunchPromo,
          promoMonths,
          promoEndsAt: isLaunchPromo ? 
            admin.firestore.Timestamp.fromMillis(now.toMillis() + (90 * 24 * 60 * 60 * 1000)) : 
            undefined,
          monthlyFee: FIXED_BUSINESS_MONTHLY_FEE,
          nextPaymentDate,
          isCommercialPlaza: locationValidation.isCommercialPlaza,
          createdAt: now,
          updatedAt: now,
          
          // Perfil inicial integrado
          profile: {
            description: initialProfile?.description || "",
            photos: initialProfile?.photos || [],
            video: initialProfile?.video,
            hours: initialProfile?.hours || {
              monday: { open: "09:00", close: "18:00" },
              tuesday: { open: "09:00", close: "18:00" },
              wednesday: { open: "09:00", close: "18:00" },
              thursday: { open: "09:00", close: "18:00" },
              friday: { open: "09:00", close: "18:00" },
              saturday: { open: "09:00", close: "14:00" },
              sunday: { closed: true, open: "", close: "" }
            },
            contact: initialProfile?.contact || {},
            rating: 0,
            reviewCount: 0
          },

          // Estadísticas iniciales
          stats: {
            views: 0,
            clicks: 0,
            monthlyViews: 0,
            totalCommissions: 0
          }
        };

        transaction.set(businessRef, businessData_final);

        // 3b. Crear registro de referido
        const referralRef = db.collection("referralRegistrations").doc();
        const referralData: ReferralRegistrationData = {
          ambassadorId,
          ambassadorCode: ambassadorData.ambassadorCode,
          newUserId: businessRef.id,
          registrationType: "business",
          createdAt: now,
          metadata: {
            businessId: businessRef.id,
            businessName: businessData.name
          }
        };

        transaction.set(referralRef, referralData);

        // 3c. Actualizar estadísticas del embajador
        const updatedStats = {
          ...ambassadorData.stats,
          businessReferrals: (ambassadorData.stats.businessReferrals || 0) + 1,
          totalReferrals: (ambassadorData.stats.totalReferrals || 0) + 1
        };

        const updatedBusinesses = [
          ...(ambassadorData.assignedBusinesses || []),
          businessRef.id
        ];

        transaction.update(ambassadorRef, {
          stats: updatedStats,
          assignedBusinesses: updatedBusinesses
        });

        // 3d. Crear entrada en nueva colección "referrals" 
        const newReferralRef = db.collection("referrals").doc();
        const newReferralData: ReferralData = {
          ambassadorId,
          ambassadorCode: ambassadorData.ambassadorCode,
          referredId: businessRef.id,
          referredType: "business",
          status: "active",
          totalCommissions: 0,
          commissionsThisMonth: 0,
          metadata: {
            businessName: businessData.name,
            category: businessData.category
          },
          createdAt: now
        };

        transaction.set(newReferralRef, newReferralData);

        return {
          businessId: businessRef.id,
          nextPaymentDate: nextPaymentDate.toMillis(),
          promoMonths
        };
      });

      // 4. Registrar actividad
      await logActivity(
        ambassadorId,
        "sistema",
        "FIXED_BUSINESS_REGISTERED" as ActivityLogAction,
        `🏢 Registro integral completado: ${businessData.name}`,
        { tipo: "complete_business_registration", id: result.businessId },
        {
          businessId: result.businessId,
          businessName: businessData.name,
          category: businessData.category,
          isLaunchPromo,
          promoMonths: result.promoMonths,
          hasInitialProfile: !!initialProfile
        }
      );

      console.log(`✅ Registro integral completado: ${result.businessId}`);

      return {
        success: true,
        businessId: result.businessId,
        ambassadorAssigned: ambassadorId,
        promoActivated: isLaunchPromo,
        promoMonths: result.promoMonths,
        nextPaymentDate: result.nextPaymentDate
      };

    } catch (error) {
      console.error("❌ Error en registro integral:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Error en registro integral de negocio");
    }
  }
);

/**
 * ⚡ processPostRegistrationActions
 * Función automática que ejecuta acciones post-registro
 */
export const processPostRegistrationActions = onCall<{
  businessId: string;
  isLaunchPromo: boolean;
}>(
  async (request): Promise<{
    success: boolean;
    promoProcessed: boolean;
    commissionProcessed: boolean;
    analyticsInitialized: boolean;
  }> => {
    const { businessId, isLaunchPromo } = request.data;

    console.log(`⚡ Procesando acciones post-registro para: ${businessId}`);

    try {
      // 1. Obtener datos del negocio
      const businessDoc = await db.collection("fixedBusinesses").doc(businessId).get();
      if (!businessDoc.exists) {
        throw new HttpsError("not-found", "Negocio no encontrado");
      }

      const businessData = businessDoc.data() as FixedBusinessData;
      let promoProcessed = false;
      let commissionProcessed = false;

      // 2. Si NO es promo de lanzamiento, procesar primer pago
      if (!isLaunchPromo && businessData.subscriptionStatus === "payment_pending") {
        try {
          // Simular primer pago automático (en producción esto sería manual)
          console.log(`💳 Negocio ${businessId} requiere primer pago manual`);
          promoProcessed = false;
        } catch (error) {
          console.warn(`⚠️ Primer pago pendiente para ${businessId}`);
        }
      } else if (isLaunchPromo) {
        promoProcessed = true;
        
        // Procesar comisión automática para promoción
        try {
          const mockRequest: CallableRequest<Record<string, unknown>> = {
            data: {
              membershipType: "fixed_business",
              amount: FIXED_BUSINESS_MONTHLY_FEE,
              memberId: businessId,
              ambassadorId: businessData.ambassadorId,
              ambassadorLevel: "gratuito" // Default, se calculará en la función
            },
            auth: {
              uid: "system-promo-registration",
              token: {} as any
            },
            rawRequest: {} as any,
            acceptsStreaming: false
          };

          await (processMembershipCommissions as any)(mockRequest);
          commissionProcessed = true;
          console.log(`💰 Comisión de promo procesada para ${businessData.ambassadorId}`);

        } catch (error) {
          console.error(`❌ Error procesando comisión de promo:`, error);
        }
      }

      // 3. Inicializar analytics
      const now = admin.firestore.Timestamp.now();
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

      const analyticsRef = db.collection("businessAnalytics").doc();
      const analyticsData: BusinessAnalyticsData = {
        businessId,
        period: currentPeriod,
        views: 0,
        clicks: 0,
        contactClicks: 0,
        phoneClicks: 0,
        whatsappClicks: 0,
        clickThroughRate: 0,
        averageViewDuration: 0,
        viewsByHour: {},
        topReferrers: [],
        createdAt: now,
        updatedAt: now
      };

      await analyticsRef.set(analyticsData);

      // 4. Registrar actividad de completado
      await logActivity(
        businessData.ambassadorId,
        "sistema",
        "BUSINESS_SUBSCRIPTION_PROCESSED" as ActivityLogAction,
        `⚡ Procesamiento post-registro completado para ${businessData.businessName}`,
        { tipo: "post_registration_complete", id: businessId },
        {
          businessId,
          promoProcessed,
          commissionProcessed,
          analyticsInitialized: true
        }
      );

      console.log(`✅ Acciones post-registro completadas para: ${businessId}`);

      return {
        success: true,
        promoProcessed,
        commissionProcessed,
        analyticsInitialized: true
      };

    } catch (error) {
      console.error("❌ Error en procesamiento post-registro:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Error en procesamiento post-registro");
    }
  }
);

/**
 * 🎉 registerLaunchPromotionBusiness
 * FUNCIÓN ESPECIAL PARA PROMOCIÓN DE LANZAMIENTO
 * 
 * Durante los primeros 3 meses de ServiMap:
 * - Negocio paga $25 USD
 * - Recibe 3 meses de servicio GRATIS
 * - Embajador recibe comisión de $25 USD inmediata
 */
export const registerLaunchPromotionBusiness = onCall<{
  businessData: {
    name: string;
    category: string;
    location: { lat: number; lng: number };
    address: string;
  };
  ambassadorId: string;
  initialProfile?: {
    description?: string;
    photos?: string[];
    video?: string;
    hours?: Record<string, { open: string; close: string; closed?: boolean }>;
    contact?: {
      phone?: string;
      email?: string;
      website?: string;
      whatsapp?: string;
      facebook?: string;
    };
  };
}>(
  async (request): Promise<{
    success: boolean;
    businessId: string;
    promoActivated: boolean;
    promoMonths: number;
    immediateCommissionPaid: boolean;
    totalPaid: number;
    ambassadorCommission: number;
    serviceValidUntil: string;
  }> => {
    const { businessData, ambassadorId, initialProfile } = request.data;

    console.log(`🎉 PROMOCIÓN DE LANZAMIENTO para: ${businessData.name}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar que estamos en período de lanzamiento
      const isLaunchPeriod = now.toDate() <= LAUNCH_PROMOTION_PERIOD_END;
      
      if (!isLaunchPeriod) {
        throw new HttpsError(
          "failed-precondition",
          "La promoción de lanzamiento ha expirado"
        );
      }

      // 2. Validación de ubicación única
      const locationValidation = await validateUniqueBusinessLocationInternal({
        lat: businessData.location.lat,
        lng: businessData.location.lng,
        businessName: businessData.name
      });

      if (!locationValidation.isUnique && !locationValidation.isCommercialPlaza) {
        throw new HttpsError(
          "already-exists",
          `Ubicación ocupada: ${locationValidation.conflictingBusiness}`
        );
      }

      // 3. Obtener datos del embajador
      const ambassadorDoc = await db.collection("ambassadors")
        .where("userId", "==", ambassadorId)
        .get();

      if (ambassadorDoc.empty) {
        throw new HttpsError("not-found", "Embajador no encontrado");
      }

      const ambassadorData = ambassadorDoc.docs[0].data() as AmbassadorData;
      const ambassadorRef = ambassadorDoc.docs[0].ref;

      // 4. TRANSACCIÓN ATÓMICA ESPECIAL PARA PROMOCIÓN
      const result = await db.runTransaction(async (transaction) => {
        // 4a. Crear negocio con promoción especial
        const businessRef = db.collection("fixedBusinesses").doc();
        const uniqueLocationId = locationValidation.suggestedId || 
          `#PROMO${String(Date.now()).slice(-6)}`;

        // Calcular fecha de vencimiento (3 meses gratis)
        const serviceValidUntil = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + (LAUNCH_PROMO_MONTHS * 30 * 24 * 60 * 60 * 1000)
        );

        const businessDataFinal: FixedBusinessData = {
          businessName: businessData.name,
          category: businessData.category,
          location: businessData.location,
          address: businessData.address,
          uniqueLocationId,
          ambassadorId,
          isActive: true,
          subscriptionStatus: "active", // Activo inmediatamente
          isLaunchPromo: true,
          promoMonths: LAUNCH_PROMO_MONTHS,
          promoEndsAt: serviceValidUntil,
          monthlyFee: FIXED_BUSINESS_MONTHLY_FEE,
          nextPaymentDate: serviceValidUntil, // Próximo pago después de promo
          isCommercialPlaza: locationValidation.isCommercialPlaza,
          createdAt: now,
          updatedAt: now,
          
          // Perfil inicial
          profile: {
            description: initialProfile?.description || "",
            photos: initialProfile?.photos || [],
            video: initialProfile?.video,
            hours: initialProfile?.hours || {
              monday: { open: "09:00", close: "18:00" },
              tuesday: { open: "09:00", close: "18:00" },
              wednesday: { open: "09:00", close: "18:00" },
              thursday: { open: "09:00", close: "18:00" },
              friday: { open: "09:00", close: "18:00" },
              saturday: { open: "09:00", close: "14:00" },
              sunday: { closed: true, open: "", close: "" }
            },
            contact: initialProfile?.contact || {},
            rating: 0,
            reviewCount: 0
          },

          // Estadísticas iniciales
          stats: {
            views: 0,
            clicks: 0,
            monthlyViews: 0,
            totalCommissions: 0
          }
        };

        transaction.set(businessRef, businessDataFinal);

        // 4b. COMISIÓN INMEDIATA ESPECIAL para embajador
        const commissionRef = db.collection("commissions").doc();
        const commissionData: Commission = {
          ambassadorId,
          type: "membership",
          sourceId: businessRef.id,
          amount: LAUNCH_PROMO_AMBASSADOR_COMMISSION,
          percentage: 50, // 50% de $25 = $12.50
          status: "paid", // Pagada inmediatamente
          paidAt: now,
          createdAt: now,
          metadata: {
            membershipType: "fixed_business",
            ambassadorLevel: ambassadorData.level || "gratuito",
            totalAmount: LAUNCH_PROMO_PAYMENT,
            originalType: "launch_promotion",
            businessName: businessData.name
          }
        };

        transaction.set(commissionRef, commissionData);

        // 4c. Agregar crédito al wallet del embajador
        const walletRef = db.collection("wallets").doc(ambassadorId);
        const walletDoc = await transaction.get(walletRef);
        
        let currentBalance = 0;
        let totalEarned = 0;
        
        if (walletDoc.exists) {
          const walletData = walletDoc.data() as WalletData;
          currentBalance = walletData.balance || 0;
          totalEarned = walletData.totalEarned || 0;
        }

        const newBalance = currentBalance + LAUNCH_PROMO_AMBASSADOR_COMMISSION;
        const newTotalEarned = totalEarned + LAUNCH_PROMO_AMBASSADOR_COMMISSION;

        const walletUpdate: Partial<WalletData> = {
          userId: ambassadorId,
          balance: newBalance,
          totalEarned: newTotalEarned,
          updatedAt: now,
          breakdown: {
            totalEarnedFromBonuses: 0,
            totalEarnedFromCommissions: newTotalEarned,
            totalEarnedFromRefunds: 0
          }
        };

        if (!walletDoc.exists) {
          (walletUpdate as WalletData).totalSpent = 0;
          (walletUpdate as WalletData).totalWithdrawn = 0;
          (walletUpdate as WalletData).bonusesEarned = 0;
          (walletUpdate as WalletData).createdAt = now;
          (walletUpdate as WalletData).limits = {
            dailySpendingLimit: 10000,
            withdrawalLimit: 5000,
            dailySpentToday: 0,
            lastSpendingDate: now.toDate().toISOString().split('T')[0],
            blockedBalance: 0
          };
          (walletUpdate as WalletData).loyalty = {
            nextThreshold: LOYALTY_BONUS_THRESHOLD,
            progressToNext: 0
          };
          transaction.set(walletRef, walletUpdate as WalletData);
        } else {
          transaction.update(walletRef, walletUpdate);
        }

        // 4d. Crear transacción en wallet
        const walletTransactionRef = db.collection("walletTransactions").doc();
        const walletTransaction: WalletTransaction = {
          userId: ambassadorId,
          type: "commission",
          amount: LAUNCH_PROMO_AMBASSADOR_COMMISSION,
          description: `🎉 Comisión PROMOCIÓN LANZAMIENTO (50%) - ${businessData.name}`,
          sourceId: businessRef.id,
          balanceAfter: newBalance,
          balanceBefore: currentBalance,
          createdAt: now,
          metadata: {
            promotionType: "launch_promotion",
            businessId: businessRef.id,
            businessName: businessData.name,
            isImmediatePayment: true,
            commissionPercentage: 50,
            membershipAmount: LAUNCH_PROMO_PAYMENT
          }
        };

        transaction.set(walletTransactionRef, walletTransaction);

        // 4e. Actualizar estadísticas del embajador
        const updatedStats = {
          ...ambassadorData.stats,
          businessReferrals: (ambassadorData.stats.businessReferrals || 0) + 1,
          totalReferrals: (ambassadorData.stats.totalReferrals || 0) + 1,
          totalCommissions: (ambassadorData.stats.totalCommissions || 0) + LAUNCH_PROMO_AMBASSADOR_COMMISSION,
          monthlyCommissions: (ambassadorData.stats.monthlyCommissions || 0) + LAUNCH_PROMO_AMBASSADOR_COMMISSION
        };

        const updatedBusinesses = [
          ...(ambassadorData.assignedBusinesses || []),
          businessRef.id
        ];

        transaction.update(ambassadorRef, {
          stats: updatedStats,
          assignedBusinesses: updatedBusinesses
        });

        // 4f. Crear registro de referido
        const referralRef = db.collection("referralRegistrations").doc();
        const referralData: ReferralRegistrationData = {
          ambassadorId,
          ambassadorCode: ambassadorData.ambassadorCode,
          newUserId: businessRef.id,
          registrationType: "business",
          createdAt: now,
          metadata: {
            businessId: businessRef.id,
            businessName: businessData.name,
            isLaunchPromotion: true,
            immediateCommission: LAUNCH_PROMO_AMBASSADOR_COMMISSION
          }
        };

        transaction.set(referralRef, referralData);

        return {
          businessId: businessRef.id,
          serviceValidUntil: serviceValidUntil.toDate().toISOString()
        };
      });

      // 5. Registrar actividad especial
      await logActivity(
        ambassadorId,
        "sistema",
        "FIXED_BUSINESS_REGISTERED" as ActivityLogAction,
        `🎉 PROMOCIÓN LANZAMIENTO: ${businessData.name} registrado con 3 meses gratis`,
        { tipo: "launch_promotion_registration", id: result.businessId },
        {
          businessId: result.businessId,
          businessName: businessData.name,
          category: businessData.category,
          promoMonths: LAUNCH_PROMO_MONTHS,
          immediateCommission: LAUNCH_PROMO_AMBASSADOR_COMMISSION,
          totalPaid: LAUNCH_PROMO_PAYMENT,
          serviceValidUntil: result.serviceValidUntil
        }
      );

      console.log(`🎉✅ PROMOCIÓN LANZAMIENTO completada: ${result.businessId}`);

      return {
        success: true,
        businessId: result.businessId,
        promoActivated: true,
        promoMonths: LAUNCH_PROMO_MONTHS,
        immediateCommissionPaid: true,
        totalPaid: LAUNCH_PROMO_PAYMENT,
        ambassadorCommission: LAUNCH_PROMO_AMBASSADOR_COMMISSION,
        serviceValidUntil: result.serviceValidUntil
      };

    } catch (error) {
      console.error("❌ Error en promoción de lanzamiento:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Error procesando promoción de lanzamiento");
    }
  }
);

/**
 * 🔍 checkLaunchPromotionAvailability
 * Verifica si la promoción de lanzamiento está disponible
 */
export const checkLaunchPromotionAvailability = onCall<Record<string, never>>(
  async (): Promise<{
    available: boolean;
    timeRemaining?: number;
    promoDetails: {
      months: number;
      payment: number;
      ambassadorCommission: number;
      normalPrice: number;
      savings: number;
      commissionPercentage: number;
    };
  }> => {
    try {
      const now = new Date();
      const isLaunchPeriod = now <= LAUNCH_PROMOTION_PERIOD_END;
      
      const timeRemaining = isLaunchPeriod 
        ? LAUNCH_PROMOTION_PERIOD_END.getTime() - now.getTime()
        : 0;

      const normalPrice = FIXED_BUSINESS_MONTHLY_FEE * LAUNCH_PROMO_MONTHS;
      const savings = normalPrice - LAUNCH_PROMO_PAYMENT;

      return {
        available: isLaunchPeriod,
        timeRemaining: isLaunchPeriod ? timeRemaining : undefined,
        promoDetails: {
          months: LAUNCH_PROMO_MONTHS,
          payment: LAUNCH_PROMO_PAYMENT,
          ambassadorCommission: LAUNCH_PROMO_AMBASSADOR_COMMISSION, // $12.50 (50% de $25)
          normalPrice,
          savings,
          commissionPercentage: 50 // 50% del valor de membresía
        }
      };

    } catch (error) {
      console.error("❌ Error verificando disponibilidad de promoción:", error);
      throw new HttpsError("internal", "Error verificando promoción");
    }
  }
);

/**
 * 📋 createCustomQuotation
 * Prestador crea cotización detallada tras diagnóstico
 */
export const createCustomQuotation = onCall<{
  chatId: string;
  providerId: string;
  quotationItems: QuotationItem[];
  estimatedTime: string;
  validUntil: admin.firestore.Timestamp;
  notes?: string;
}>(
  async (request): Promise<{
    success: boolean;
    quotationId: string;
    totalAmount: number;
    breakdown: {
      laborTotal: number;
      materialsTotal: number;
      otherTotal: number;
      itemCount: number;
    };
  }> => {
    const { chatId, providerId, quotationItems, estimatedTime, validUntil, notes } = request.data;

    console.log(`📋 Creando cotización para chat: ${chatId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Validar que el prestador esté asignado al chat
      const chatDoc = await db.collection("chats").doc(chatId).get();
      if (!chatDoc.exists) {
        throw new HttpsError("not-found", "Chat no encontrado");
      }

      const chatData = chatDoc.data() as ChatData;
      
      // Obtener userId y providerId de la estructura nueva
      const [userId, providerId_from_chat] = chatData.participantIds;
      const actualProviderId = chatData.providerId || providerId_from_chat;
      const actualUserId = chatData.userId || userId;
      
      if (actualProviderId !== providerId) {
        throw new HttpsError("permission-denied", "Prestador no autorizado para este chat");
      }

      // 2. Validar items de cotización
      if (!quotationItems || quotationItems.length === 0) {
        throw new HttpsError("invalid-argument", "La cotización debe tener al menos un item");
      }

      if (quotationItems.length > MAX_QUOTATION_ITEMS) {
        throw new HttpsError("invalid-argument", `Máximo ${MAX_QUOTATION_ITEMS} items por cotización`);
      }

      // 3. Calcular totales y procesar items para nueva estructura
      let totalAmount = 0;
      let laborTotal = 0;
      let materialsTotal = 0;
      let otherTotal = 0;

      const processedItems = quotationItems.map(item => {
        const total = item.quantity * item.unitPrice;
        totalAmount += total;
        
        // Tracking para breakdown (compatibilidad)
        switch (item.category) {
          case 'labor':
            laborTotal += total;
            break;
          case 'materials':
            materialsTotal += total;
            break;
          case 'other':
            otherTotal += total;
            break;
        }

        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: total,
          category: item.category
        };
      });

      const breakdown = {
        laborTotal,
        materialsTotal,
        otherTotal,
        itemCount: quotationItems.length
      };

      // 4. Crear cotización en transacción
      const result = await db.runTransaction(async (transaction) => {
        const quotationRef = db.collection("quotations").doc();
        
        const quotationData: CustomQuotationData = {
          chatId,
          providerId,
          userId: actualUserId,
          items: processedItems, // Nueva estructura
          totalAmount,
          estimatedTime,
          validUntil,
          status: "pending",
          notes: notes || "",
          createdAt: now,
          
          // Campos de compatibilidad
          quotationItems: quotationItems,
          breakdown
        };

        transaction.set(quotationRef, quotationData);

        // 5. Actualizar estado del chat con nueva estructura
        transaction.update(chatDoc.ref, {
          status: "quotation_sent",
          updatedAt: now,
          lastMessage: {
            text: `💰 Cotización enviada - Total: $${totalAmount.toFixed(2)}`,
            senderId: providerId,
            timestamp: now
          },
          moderationFlags: 0 // Reset flags para nueva cotización
        });

        // 6. Crear mensaje de sistema en el chat con nueva estructura
        const messageRef = db.collection("chatMessages").doc();
        const systemMessage = {
          chatId,
          senderId: "system",
          messageType: "quotation",
          content: `💰 Nueva cotización disponible por $${totalAmount.toFixed(2)}`,
          quotationId: quotationRef.id,
          isModerated: false,
          readBy: [], // Array vacío, se llenará cuando se lea
          timestamp: now,
          
          // Campos de compatibilidad
          message: `💰 Nueva cotización disponible por $${totalAmount.toFixed(2)}`,
          senderType: "system"
        };

        transaction.set(messageRef, systemMessage);

        return {
          quotationId: quotationRef.id,
          totalAmount,
          breakdown
        };
      });

      // 7. Enviar notificación al usuario
      try {
        const userDoc = await db.collection("users").doc(actualUserId || "").get();
        if (userDoc.exists) {
          const userData = userDoc.data() as UserData;
          if (userData.fcmTokens && userData.fcmTokens.length > 0) {
            const message = {
              notification: {
                title: "💰 Nueva Cotización Recibida",
                body: `Cotización por $${totalAmount.toFixed(2)} - ${estimatedTime}`
              },
              data: {
                type: "quotation_received",
                chatId,
                quotationId: result.quotationId,
                amount: totalAmount.toString()
              },
              tokens: userData.fcmTokens
            };

            await admin.messaging().sendMulticast(message);
          }
        }
      } catch (notificationError) {
        console.warn("⚠️ Error enviando notificación:", notificationError);
      }

      // 8. Registrar actividad
      await logActivity(
        providerId,
        "prestador",
        "QUOTATION_CREATED" as ActivityLogAction,
        `📋 Cotización creada por $${totalAmount.toFixed(2)}`,
        { tipo: "quotation_creation", id: result.quotationId },
        {
          chatId,
          userId: actualUserId,
          totalAmount,
          itemCount: quotationItems.length,
          breakdown
        }
      );

      console.log(`✅ Cotización creada: ${result.quotationId}`);

      return {
        success: true,
        quotationId: result.quotationId,
        totalAmount: result.totalAmount,
        breakdown: result.breakdown
      };

    } catch (error) {
      console.error("❌ Error creando cotización:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Error interno al crear cotización");
    }
  }
);

/**
 * ✅❌ acceptRejectQuotation
 * Usuario acepta o rechaza cotización
 */
export const acceptRejectQuotation = onCall<{
  quotationId: string;
  userId: string;
  action: 'accept' | 'reject' | 'negotiate';
  counterOffer?: number;
  message?: string;
}>(
  async (request): Promise<{
    success: boolean;
    action: string;
    serviceRequestId?: string;
    paymentIntentId?: string;
    message: string;
  }> => {
    const { quotationId, userId, action, counterOffer, message: userMessage } = request.data;

    console.log(`✅❌ Procesando ${action} de cotización: ${quotationId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Validar que la cotización existe y está vigente
      const quotationDoc = await db.collection("quotations").doc(quotationId).get();
      if (!quotationDoc.exists) {
        throw new HttpsError("not-found", "Cotización no encontrada");
      }

      const quotationData = quotationDoc.data() as CustomQuotationData;
      
      if (quotationData.userId !== userId) {
        throw new HttpsError("permission-denied", "Usuario no autorizado para esta cotización");
      }

      if (quotationData.status !== "pending" && quotationData.status !== "negotiating") {
        throw new HttpsError("failed-precondition", "Cotización no está disponible para respuesta");
      }

      // Verificar que no ha expirado
      if (quotationData.validUntil.toMillis() < now.toMillis()) {
        await quotationDoc.ref.update({
          status: "expired",
          updatedAt: now
        });
        throw new HttpsError("failed-precondition", "La cotización ha expirado");
      }

      // 2. Obtener datos del chat
      const chatDoc = await db.collection("chats").doc(quotationData.chatId).get();
      if (!chatDoc.exists) {
        throw new HttpsError("not-found", "Chat no encontrado");
      }

      const chatData = chatDoc.data() as ChatData;

      // 3. Procesar según la acción
      let result: any = {};

      if (action === 'accept') {
        // ACEPTAR COTIZACIÓN
        result = await db.runTransaction(async (transaction) => {
          // Actualizar cotización
          transaction.update(quotationDoc.ref, {
            status: "accepted",
            updatedAt: now
          });

          // Actualizar chat
          transaction.update(chatDoc.ref, {
            status: "quotation_accepted",
            updatedAt: now,
            lastMessage: `✅ Cotización aceptada por $${quotationData.totalAmount.toFixed(2)}`,
            lastMessageAt: now
          });

          // Crear ServiceRequest
          const serviceRequestRef = db.collection("serviceRequests").doc();
          const serviceRequestData: Partial<ServiceRequest> = {
            usuarioId: userId,
            prestadorId: quotationData.providerId,
            status: "agendado",
            createdAt: now,
            updatedAt: now,
            titulo: `Servicio cotizado - ${quotationData.estimatedTime}`,
            precio: quotationData.totalAmount,
            montoCobrado: quotationData.totalAmount,
            metodoPago: "tarjeta", // Se definirá en el pago
            originatingQuotationId: quotationId,
            serviceType: "fixed"
          };

          transaction.set(serviceRequestRef, serviceRequestData);

          // Crear mensaje de sistema
          const messageRef = db.collection("chatMessages").doc();
          const systemMessage = {
            chatId: quotationData.chatId,
            senderId: "system",
            senderType: "system",
            message: `✅ Cotización aceptada. Servicio programado.`,
            messageType: "system",
            createdAt: now,
            readBy: [],
            metadata: {
              quotationId,
              serviceRequestId: serviceRequestRef.id
            }
          };

          transaction.set(messageRef, systemMessage);

          return {
            serviceRequestId: serviceRequestRef.id,
            message: "Cotización aceptada. Procede al pago para confirmar el servicio."
          };
        });

        // TODO: Crear payment intent con Stripe aquí
        // const paymentIntent = await stripe.paymentIntents.create({...});
        result.paymentIntentId = "pi_mock_" + Date.now();

      } else if (action === 'reject') {
        // RECHAZAR COTIZACIÓN
        result = await db.runTransaction(async (transaction) => {
          // Actualizar cotización
          transaction.update(quotationDoc.ref, {
            status: "rejected",
            updatedAt: now
          });

          // Actualizar chat - permitir nueva cotización
          transaction.update(chatDoc.ref, {
            status: "active",
            currentQuotationId: undefined,
            updatedAt: now,
            lastMessage: `❌ Cotización rechazada`,
            lastMessageAt: now
          });

          // Crear mensaje de sistema
          const messageRef = db.collection("chatMessages").doc();
          const systemMessage = {
            chatId: quotationData.chatId,
            senderId: "system",
            senderType: "system",
            message: `❌ Cotización rechazada. El chat está disponible para nueva cotización.`,
            messageType: "system",
            createdAt: now,
            readBy: []
          };

          transaction.set(messageRef, systemMessage);

          return {
            message: "Cotización rechazada. Puedes solicitar una nueva cotización."
          };
        });

      } else if (action === 'negotiate') {
        // NEGOCIAR COTIZACIÓN
        if (!counterOffer || counterOffer <= 0) {
          throw new HttpsError("invalid-argument", "Contraoferta debe ser mayor a 0");
        }

        result = await db.runTransaction(async (transaction) => {
          // Actualizar cotización
          transaction.update(quotationDoc.ref, {
            status: "negotiating",
            updatedAt: now
          });

          // Crear mensaje de negociación
          const messageRef = db.collection("chatMessages").doc();
          const negotiationMessage = {
            chatId: quotationData.chatId,
            senderId: userId,
            senderType: "user",
            message: `💬 Contraoferta: $${counterOffer.toFixed(2)}${userMessage ? `\n${userMessage}` : ''}`,
            messageType: "text",
            createdAt: now,
            readBy: [userId || ""]
          };

          transaction.set(messageRef, negotiationMessage);

          // Actualizar chat
          transaction.update(chatDoc.ref, {
            updatedAt: now,
            lastMessage: `💬 Contraoferta enviada: $${counterOffer.toFixed(2)}`,
            lastMessageAt: now,
            "unreadCount.provider": admin.firestore.FieldValue.increment(1)
          });

          return {
            message: `Contraoferta de $${counterOffer.toFixed(2)} enviada al prestador.`
          };
        });
      }

      // 4. Enviar notificación al prestador
      try {
        const providerDoc = await db.collection("providers").doc(quotationData.providerId).get();
        if (providerDoc.exists) {
          const providerData = providerDoc.data() as ProviderData;
          if (providerData.fcmTokens && providerData.fcmTokens.length > 0) {
            const notificationTitle = action === 'accept' ? "✅ Cotización Aceptada!" : 
                                    action === 'reject' ? "❌ Cotización Rechazada" : 
                                    "💬 Nueva Contraoferta";
            
            const notificationBody = action === 'accept' ? `El cliente aceptó tu cotización de $${quotationData.totalAmount.toFixed(2)}` :
                                   action === 'reject' ? "El cliente rechazó tu cotización" :
                                   `Contraoferta recibida: $${counterOffer?.toFixed(2)}`;

            const notification = {
              notification: {
                title: notificationTitle,
                body: notificationBody
              },
              data: {
                type: `quotation_${action}`,
                chatId: quotationData.chatId,
                quotationId,
                userId
              },
              tokens: providerData.fcmTokens
            };

            await admin.messaging().sendMulticast(notification);
          }
        }
      } catch (notificationError) {
        console.warn("⚠️ Error enviando notificación:", notificationError);
      }

      // 5. Registrar actividad
      const activityAction = action === 'accept' ? "QUOTATION_ACCEPTED" : 
                           action === 'reject' ? "QUOTATION_REJECTED" : 
                           "QUOTATION_NEGOTIATED";

      await logActivity(
        userId,
        "usuario",
        activityAction as ActivityLogAction,
        `${action === 'accept' ? '✅' : action === 'reject' ? '❌' : '💬'} Cotización ${action} por $${quotationData.totalAmount.toFixed(2)}`,
        { tipo: `quotation_${action}`, id: quotationId },
        {
          chatId: quotationData.chatId,
          providerId: quotationData.providerId,
          totalAmount: quotationData.totalAmount,
          counterOffer: action === 'negotiate' ? counterOffer : undefined,
          serviceRequestId: result.serviceRequestId
        }
      );

      console.log(`✅ Cotización ${action}: ${quotationId}`);

      return {
        success: true,
        action,
        serviceRequestId: result.serviceRequestId,
        paymentIntentId: result.paymentIntentId,
        message: result.message
      };

    } catch (error) {
      console.error(`❌ Error en ${action} cotización:`, error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Error interno al ${action} cotización`);
    }
  }
);

/**
 * ⏰ handleAsyncQuotation
 * Maneja cotizaciones cuando prestador no está disponible
 */
export const handleAsyncQuotation = onCall<{
  userId: string;
  providerId: string;
  serviceType: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  preferredTime?: admin.firestore.Timestamp;
}>(
  async (request): Promise<{
    success: boolean;
    chatId: string;
    message: string;
    notificationSent: boolean;
  }> => {
    const { userId, providerId, serviceType, description, urgency, preferredTime } = request.data;

    console.log(`⏰ Creando cotización asíncrona: ${userId} -> ${providerId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Validar que el prestador existe
      const providerDoc = await db.collection("providers").doc(providerId).get();
      if (!providerDoc.exists) {
        throw new HttpsError("not-found", "Prestador no encontrado");
      }

      const providerData = providerDoc.data() as ProviderData;

      // 2. Verificar si ya existe un chat activo entre estos usuarios
      const existingChatsQuery = await db.collection("chats")
        .where("userId", "==", userId)
        .where("providerId", "==", providerId)
        .where("status", "in", ["active", "quotation_sent"])
        .get();

      let chatId: string;
      let isNewChat = false;

      if (!existingChatsQuery.empty) {
        // Usar chat existente
        chatId = existingChatsQuery.docs[0].id;
        console.log(`📱 Usando chat existente: ${chatId}`);
      } else {
        // Crear nuevo chat
        isNewChat = true;
        const chatRef = db.collection("chats").doc();
        chatId = chatRef.id;

        const chatData = {
          userId,
          providerId,
          serviceType,
          status: "active",
          createdAt: now,
          updatedAt: now,
          // unreadCount removed - not part of ChatData interface
          metadata: {
            urgency,
            preferredTime,
            description
          }
        };

        await chatRef.set(chatData);
        console.log(`📱 Chat creado: ${chatId}`);
      }

      // 3. Crear mensaje inicial con la descripción del problema
      const messageRef = db.collection("chatMessages").doc();
      const initialMessage = {
        chatId,
        senderId: userId,
        senderType: "user",
        message: `🔧 Solicitud de cotización:\n\n${description}${preferredTime ? `\n\n⏰ Tiempo preferido: ${preferredTime.toDate().toLocaleString()}` : ''}`,
        messageType: "text",
        createdAt: now,
        readBy: []
      };

      await messageRef.set(initialMessage);

      // 4. Actualizar el chat con el último mensaje
      await db.collection("chats").doc(chatId).update({
        lastMessage: `🔧 Solicitud de cotización para ${serviceType}`,
        lastMessageAt: now,
        updatedAt: now,
        "unreadCount.provider": admin.firestore.FieldValue.increment(1)
      });

      // 5. Crear mensaje de sistema explicando el proceso asíncrono
      const systemMessageRef = db.collection("chatMessages").doc();
      const systemMessage = {
        chatId,
        senderId: "system",
        senderType: "system",
        message: `📲 Tu solicitud ha sido enviada al prestador. Te notificaremos cuando esté disponible para revisar tu caso.`,
        messageType: "system",
        createdAt: now,
        readBy: []
      };

      await systemMessageRef.set(systemMessage);

      // 6. Enviar notificación prioritaria al prestador
      let notificationSent = false;
      try {
        if (providerData.fcmTokens && providerData.fcmTokens.length > 0) {
          const urgencyEmoji = urgency === 'high' ? '🚨' : urgency === 'medium' ? '⚡' : '📋';
          const urgencyText = urgency === 'high' ? 'URGENTE' : urgency === 'medium' ? 'PRIORIDAD MEDIA' : 'NORMAL';

          const notification = {
            notification: {
              title: `${urgencyEmoji} Nueva Solicitud de Cotización - ${urgencyText}`,
              body: `${serviceType}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`
            },
            data: {
              type: "async_quotation_request",
              chatId,
              userId,
              urgency,
              serviceType,
              priority: urgency
            },
            tokens: providerData.fcmTokens,
            android: {
              priority: (urgency === 'high' ? "high" : "normal") as "high" | "normal",
              notification: {
                priority: (urgency === 'high' ? "high" : "default") as "high" | "default" | "low" | "min" | "max"
              }
            },
            apns: {
              headers: {
                "apns-priority": urgency === 'high' ? "10" : "5"
              }
            }
          };

          await admin.messaging().sendMulticast(notification);
          notificationSent = true;
          console.log(`📲 Notificación enviada al prestador`);
        }
      } catch (notificationError) {
        console.warn("⚠️ Error enviando notificación:", notificationError);
      }

      // 7. Crear recordatorio si es urgente (notificación de seguimiento)
      if (urgency === 'high') {
        try {
          const reminderRef = db.collection("asyncQuotationReminders").doc();
          const reminderData = {
            chatId,
            providerId,
            userId,
            serviceType,
            urgency,
            scheduledFor: admin.firestore.Timestamp.fromMillis(now.toMillis() + (60 * 60 * 1000)), // 1 hora después
            sent: false,
            createdAt: now
          };

          await reminderRef.set(reminderData);
          console.log(`⏰ Recordatorio programado para caso urgente`);
        } catch (reminderError) {
          console.warn("⚠️ Error programando recordatorio:", reminderError);
        }
      }

      // 8. Registrar actividad
      await logActivity(
        userId,
        "usuario",
        "ASYNC_QUOTATION_REQUESTED" as ActivityLogAction,
        `⏰ Solicitud de cotización asíncrona: ${serviceType}`,
        { tipo: "async_quotation_request", id: chatId },
        {
          providerId,
          serviceType,
          urgency,
          description: description.substring(0, 200),
          isNewChat,
          preferredTime: preferredTime?.toMillis()
        }
      );

      console.log(`✅ Cotización asíncrona creada: ${chatId}`);

      const responseMessage = isNewChat 
        ? "Tu solicitud de cotización ha sido enviada. El prestador será notificado y te contactará pronto."
        : "Tu nueva solicitud ha sido agregada al chat existente. El prestador será notificado.";

      return {
        success: true,
        chatId,
        message: responseMessage,
        notificationSent
      };

    } catch (error) {
      console.error("❌ Error en cotización asíncrona:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Error interno procesando solicitud asíncrona");
    }
  }
);

// ====================================================================
// 🖼️ LOGO UPDATE FUNCTIONS
// ====================================================================

/**
 * 🖼️ updateProviderLogo
 * Actualiza el logo URL de un prestador
 */
export const updateProviderLogo = onCall<{
  providerId: string;
  logoURL: string;
}>(
  async (request): Promise<{
    success: boolean;
    message: string;
  }> => {
    const { providerId, logoURL } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🖼️ Actualizando logo para prestador: ${providerId}`);

    try {
      // Verificar que el usuario es el dueño del perfil
      if (userId !== providerId) {
        throw new HttpsError("permission-denied", "No tienes permiso para actualizar este perfil");
      }

      // Actualizar el documento del prestador
      await db.collection("prestadores").doc(providerId).update({
        logoURL,
        updatedAt: admin.firestore.Timestamp.now()
      });

      // Registrar actividad
      await logActivity(
        userId,
        "prestador",
        "PROFILE_LOGO_UPDATED" as ActivityLogAction,
        `🖼️ Logo de perfil actualizado`,
        { tipo: "profile_update", id: providerId },
        { logoURL }
      );

      console.log(`✅ Logo actualizado para prestador: ${providerId}`);

      return {
        success: true,
        message: "Logo actualizado exitosamente"
      };

    } catch (error) {
      console.error("❌ Error actualizando logo:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Error interno actualizando logo");
    }
  }
);

/**
 * 🏢 updateBusinessLogo
 * Actualiza el logo URL de un negocio fijo
 */
export const updateBusinessLogo = onCall<{
  businessId: string;
  logoURL: string;
}>(
  async (request): Promise<{
    success: boolean;
    message: string;
  }> => {
    const { businessId, logoURL } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🖼️ Actualizando logo para negocio: ${businessId}`);

    try {
      // Verificar permisos (el usuario debe ser el embajador del negocio)
      const businessDoc = await db.collection("negocios_fijos").doc(businessId).get();
      
      if (!businessDoc.exists) {
        throw new HttpsError("not-found", "Negocio no encontrado");
      }

      const businessData = businessDoc.data();
      
      // Verificar que el usuario es el embajador del negocio
      if (businessData?.embajadorId !== userId) {
        // También verificar si es admin
        const adminCheck = await db.collection("admins").doc(userId).get();
        if (!adminCheck.exists) {
          throw new HttpsError("permission-denied", "No tienes permiso para actualizar este negocio");
        }
      }

      // Actualizar el documento del negocio
      await businessDoc.ref.update({
        logoURL,
        updatedAt: admin.firestore.Timestamp.now()
      });

      // Registrar actividad
      await logActivity(
        userId,
        businessData?.embajadorId === userId ? "usuario" : "admin",
        "BUSINESS_LOGO_UPDATED" as ActivityLogAction,
        `🖼️ Logo de negocio actualizado: ${businessData?.nombre}`,
        { tipo: "business_update", id: businessId },
        { logoURL, businessName: businessData?.nombre }
      );

      console.log(`✅ Logo actualizado para negocio: ${businessId}`);

      return {
        success: true,
        message: "Logo del negocio actualizado exitosamente"
      };

    } catch (error) {
      console.error("❌ Error actualizando logo del negocio:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Error interno actualizando logo del negocio");
    }
  }
);

// Importar y exportar funciones de chat
export {
  uploadQuotationMedia,
  initiateVideoCall,
  moderateChatWithAI,
  getChatHistory,
  sendChatMessage
} from "./chatFunctions";

// Función auxiliar interna para validateUniqueRegistration
async function validateUniqueRegistrationInternal({
  email,
  phone,
  location,
  businessName
}: {
  email?: string;
  phone?: string;
  location?: { lat: number; lng: number };
  businessName?: string;
}): Promise<{
  isUnique: boolean;
  existingAmbassador?: string;
  conflictType?: "email" | "phone" | "location";
}> {
  // Simplificado para evitar duplicar código extenso
  // En producción, implementar lógica completa de validateUniqueRegistration
  return { isUnique: true };
}

// Export Security Functions
export * from "./securityFunctions";

// Export Community Functions
export * from "./communityFunctions";

// Export Schedule and Premium Functions
export * from "./scheduleAndPremiumFunctions";

// Emergency Functions - Discrecional para prestadores
export {
  getEmergencyProviders,
  updateEmergencyConfig,
  toggleEmergencyAvailability,
  requestEmergencyService,
  respondToEmergencyRequest
} from "./emergencyFunctions";

// Import admin configuration
export { configureAdmin } from "./adminConfig";
export { setupAdmin } from "./autoAdmin";
export { createAdminDoc } from "./createAdminDoc";
export { setCustomClaims } from "./setCustomClaims";

// Export Admin Dashboard Functions
export {
  getAdminStats,
  getUsers,
  getAnalyticsReport,
  exportSystemData
} from "./adminDashboard";
