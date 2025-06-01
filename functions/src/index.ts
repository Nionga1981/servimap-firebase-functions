
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- CONSTANTS FOR LOYALTY PROGRAM ---
const COMISION_PLATAFORMA_PORCENTAJE = 0.06; // 6%
const PORCENTAJE_COMISION_PARA_FONDO_FIDELIDAD = 0.10; // 10% of the 6%
const FACTOR_CONVERSION_PUNTOS = 10; // $10 MXN (o unidad monetaria) por 1 punto

// --- INTERFACES (Ideally from a shared types file) ---
export type ServiceRequestStatus =
  | "agendado" | "pendiente_confirmacion" | "confirmada_prestador" | "pagada"
  | "en_camino_proveedor" | "servicio_iniciado" | "completado_por_prestador"
  | "completado_por_usuario" | "cancelada_usuario" | "cancelada_prestador"
  | "rechazada_prestador" | "en_disputa" | "cerrado_automaticamente"
  | "cerrado_con_calificacion" | "cerrado_con_disputa_resuelta";

export type PaymentStatus =
  | "pendiente_confirmacion_usuario" | "retenido_para_liberacion" | "liberado_al_proveedor"
  | "congelado_por_disputa" | "reembolsado_parcial" | "reembolsado_total"
  | "pendiente_cobro" | "procesado_exitosamente" | "fallido" | "no_aplica";

export interface HistorialPuntoUsuario {
  servicioId?: string;
  promocionId?: string;
  tipo: "ganados" | "canjeados";
  puntos: number;
  fecha: admin.firestore.Timestamp;
  descripcion?: string;
}
export interface UserData {
  fcmTokens?: string[];
  nombre?: string;
  puntosAcumulados?: number;
  historialPuntos?: admin.firestore.FieldValue | HistorialPuntoUsuario[]; // For arrayUnion
  isPremium?: boolean; // Needed for warranty logic, assuming it's here
}

export interface ProviderData {
  fcmTokens?: string[];
  nombre?: string;
}

export interface ServiceRequest {
  id: string;
  usuarioId: string;
  prestadorId: string;
  status: ServiceRequestStatus;
  createdAt: admin.firestore.Timestamp | number;
  updatedAt?: admin.firestore.Timestamp | number;
  titulo?: string;
  actorDelCambioId?: string;
  actorDelCambioRol?: "usuario" | "prestador" | "sistema";
  calificacionUsuario?: any;
  calificacionPrestador?: any;
  paymentStatus?: PaymentStatus;
  originatingQuotationId?: string;
  precio?: number; // Final amount paid by user for the service
  montoCobrado?: number; // Alternative field for final amount
  paymentReleasedToProviderAt?: admin.firestore.Timestamp | number;
}

export type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador" | "precio_propuesto_al_usuario"
  | "rechazada_prestador" | "aceptada_por_usuario"
  | "rechazada_usuario" | "convertida_a_servicio" | "expirada";

export interface SolicitudCotizacionData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  descripcionProblema: string;
  videoUrl?: string;
  estado: SolicitudCotizacionEstado;
  precioSugerido?: number;
  notasPrestador?: string;
  fechaCreacion: admin.firestore.Timestamp;
  fechaRespuestaPrestador?: admin.firestore.Timestamp;
  fechaRespuestaUsuario?: admin.firestore.Timestamp;
  tituloServicio?: string;
}

export interface ChatData {
  id?: string;
  solicitudServicioId: string;
  participantesUids: string[];
  participantesInfo?: {
    [uid: string]: { nombre?: string; rol: "usuario" | "prestador" };
  };
  fechaCreacion: admin.firestore.Timestamp;
  ultimaActualizacion?: admin.firestore.Timestamp;
  ultimoMensaje?: {
    texto: string;
    remitenteId: string;
    timestamp: admin.firestore.Timestamp;
  };
  estadoChat?: "activo" | "archivado_usuario" | "archivado_prestador" | "finalizado_servicio";
  conteoNoLeido?: { [uid: string]: number };
}

export type ActivityLogAction =
  | "CAMBIO_ESTADO_SOLICITUD" | "CALIFICACION_USUARIO" | "CALIFICACION_PRESTADOR"
  | "SOLICITUD_CREADA" | "PAGO_RETENIDO" | "PAGO_LIBERADO"
  | "GARANTIA_ACTIVADA" | "INICIO_SESION" | "CIERRE_SESION"
  | "CONFIG_CAMBIADA" | "COTIZACION_CREADA" | "COTIZACION_PRECIO_PROPUESTO"
  | "COTIZACION_ACEPTADA_USUARIO" | "COTIZACION_RECHAZADA" | "CHAT_CREADO"
  | "PUNTOS_FIDELIDAD_GANADOS" | "PUNTOS_FIDELIDAD_CANJEADOS" | "FONDO_FIDELIDAD_APORTE";

export interface PromocionFidelidad {
  id?: string;
  descripcion: string;
  puntosRequeridos: number;
  tipoDescuento: "porcentaje" | "monto_fijo";
  valorDescuento: number;
  activo: boolean;
  codigoPromocional?: string;
  usosDisponibles?: admin.firestore.FieldValue | number; // For FieldValue.increment(-1)
  fechaExpiracion?: admin.firestore.Timestamp;
  serviciosAplicables?: string[];
}

// --- Helper para enviar notificaciones ---
async function sendNotification(userId: string, userType: "usuario" | "prestador", title: string, body: string, data?: { [key: string]: string }) {
  const userCol = userType === "usuario" ? "usuarios" : "prestadores";
  const userDoc = await db.collection(userCol).doc(userId).get();
  if (!userDoc.exists) {
    functions.logger.error(`[NotificationHelper] ${userType} ${userId} no encontrado.`);
    return;
  }
  const userData = userDoc.data() as (UserData | ProviderData); // Adjust type based on collection
  const tokens = (userData as UserData).fcmTokens || (userData as ProviderData).fcmTokens;

  if (tokens && tokens.length > 0) {
    const payload = { notification: { title, body }, data };
    try {
      await admin.messaging().sendToDevice(tokens, payload);
      functions.logger.info(`[NotificationHelper] Notificación enviada a ${userType} ${userId}.`);
    } catch (error) {
      functions.logger.error(`[NotificationHelper] Error enviando notificación a ${userType} ${userId}:`, error);
    }
  } else {
    functions.logger.log(`[NotificationHelper] ${userType} ${userId} no tiene tokens FCM.`);
  }
}

// --- Helper para crear logs de actividad ---
async function logActivity(
  actorId: string,
  actorRol: "usuario" | "prestador" | "sistema" | "admin",
  accion: ActivityLogAction,
  descripcion: string,
  entidadAfectada?: { tipo: string; id: string },
  detallesAdicionales?: Record<string, any>
) {
  try {
    await db.collection("logs_actividad").add({
      actorId,
      actorRol,
      accion,
      descripcion,
      fecha: admin.firestore.Timestamp.now(),
      entidadAfectada: entidadAfectada || null,
      detallesAdicionales: detallesAdicionales || null,
    });
    functions.logger.info(`[LogActivityHelper] Log creado: ${descripcion}`);
  } catch (error) {
    functions.logger.error(`[LogActivityHelper] Error al crear log: ${descripcion}`, error);
  }
}


export const onServiceStatusChangeSendNotification = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const newValue = change.after.data() as ServiceRequest;
    const previousValue = change.before.data() as ServiceRequest;
    const solicitudId = context.params.solicitudId;

    if (!newValue || !previousValue) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] No new or previous data, exiting.`);
      return null;
    }
    if (newValue.status === previousValue.status) return null;
    
    functions.logger.log(`[FCM Trigger ${solicitudId}] Estado cambiado de ${previousValue.status} a ${newValue.status}.`);

    const usuarioId = newValue.usuarioId;
    const prestadorId = newValue.prestadorId;
    let tituloNotif = "";
    let cuerpoNotif = "";
    let targetUserId: string | null = null;
    let targetUserType: "usuario" | "prestador" | null = null;
    const serviceTitle = newValue.titulo || "un servicio";

    switch (newValue.status) {
      case "agendado":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "Nueva Solicitud de Servicio"; cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}".`;
        break;
      case "confirmada_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "¡Cita Confirmada!"; cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido confirmada.`;
        break;
      case "rechazada_prestador": case "cancelada_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = `Cita ${newValue.status === "rechazada_prestador" ? "Rechazada" : "Cancelada"}`;
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido ${newValue.status === "rechazada_prestador" ? "rechazada" : "cancelada"} por el prestador.`;
        break;
      case "cancelada_usuario":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "Cita Cancelada por Usuario"; cuerpoNotif = `La cita para "${serviceTitle}" ha sido cancelada por el usuario.`;
        break;
      case "en_camino_proveedor":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "¡Tu Proveedor está en Camino!"; cuerpoNotif = `El proveedor para "${serviceTitle}" está en camino.`;
        break;
      case "servicio_iniciado":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "Servicio Iniciado"; cuerpoNotif = `El proveedor ha iniciado el servicio "${serviceTitle}".`;
        break;
      case "completado_por_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "Servicio Completado por Prestador"; cuerpoNotif = `El prestador ha marcado "${serviceTitle}" como completado. Por favor, confirma y califica.`;
        break;
      case "completado_por_usuario":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "¡Servicio Confirmado por Usuario!"; cuerpoNotif = `El usuario ha confirmado la finalización de "${serviceTitle}". ¡Ya puedes calificarlo!`;
        break;
      case "cerrado_con_calificacion":
      case "cerrado_automaticamente":
        if (newValue.paymentStatus === "liberado_al_proveedor" && previousValue.paymentStatus !== "liberado_al_proveedor") {
          targetUserId = prestadorId; targetUserType = "prestador";
          tituloNotif = "¡Pago Liberado!"; cuerpoNotif = `El pago para el servicio "${serviceTitle}" ha sido liberado.`;
        }
        break;
      default: return null;
    }

    if (targetUserId && targetUserType) {
      await sendNotification(targetUserId, targetUserType, tituloNotif, cuerpoNotif, { solicitudId, nuevoEstado: newValue.status });
    }
    return null;
  });

export const logSolicitudServicioChanges = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const solicitudId = context.params.solicitudId;
    const beforeData = change.before.data() as ServiceRequest | undefined;
    const afterData = change.after.data() as ServiceRequest | undefined;

    if (!beforeData || !afterData) {
      functions.logger.warn(`[LogTrigger ${solicitudId}] Datos antes o después no disponibles.`);
      return null;
    }

    let actorId = afterData.actorDelCambioId || "sistema";
    let actorRol: "usuario" | "prestador" | "sistema" | "admin" = afterData.actorDelCambioRol || "sistema";
    
    const now = admin.firestore.Timestamp.now();

    if (beforeData.status !== afterData.status) {
      if (!afterData.actorDelCambioId) { /* Basic actor inference if not provided */ }
      const descLog = `Solicitud ${solicitudId} cambió de ${beforeData.status} a ${afterData.status} por ${actorRol} ${actorId}.`;
      await logActivity(actorId, actorRol, "CAMBIO_ESTADO_SOLICITUD", descLog, { tipo: "solicitud_servicio", id: solicitudId }, { estadoAnterior: beforeData.status, estadoNuevo: afterData.status });
    }

    if (!beforeData.calificacionUsuario && afterData.calificacionUsuario) {
      const descLog = `Usuario ${afterData.usuarioId} calificó servicio ${solicitudId} (Prestador: ${afterData.prestadorId}) con ${afterData.calificacionUsuario.estrellas} estrellas.`;
      await logActivity(afterData.usuarioId, "usuario", "CALIFICACION_USUARIO", descLog, { tipo: "solicitud_servicio", id: solicitudId }, { estrellas: afterData.calificacionUsuario.estrellas, comentario: afterData.calificacionUsuario.comentario || "" });
    }

    if (!beforeData.calificacionPrestador && afterData.calificacionPrestador) {
      const descLog = `Prestador ${afterData.prestadorId} calificó a usuario ${afterData.usuarioId} en servicio ${solicitudId} con ${afterData.calificacionPrestador.estrellas} estrellas.`;
      await logActivity(afterData.prestadorId, "prestador", "CALIFICACION_PRESTADOR", descLog, { tipo: "solicitud_servicio", id: solicitudId }, { estrellas: afterData.calificacionPrestador.estrellas, comentario: afterData.calificacionPrestador.comentario || "" });
    }

    // --- Loyalty Program Logic ---
    const isFinalizedState = (afterData.status === "cerrado_con_calificacion" || afterData.status === "cerrado_automaticamente");
    const wasNotFinalizedBefore = (beforeData.status !== "cerrado_con_calificacion" && beforeData.status !== "cerrado_automaticamente");
    const paymentReleased = afterData.paymentStatus === "liberado_al_proveedor"; // Or a similar "paid_out" status

    if (isFinalizedState && wasNotFinalizedBefore && paymentReleased) {
      const serviceAmount = afterData.precio || afterData.montoCobrado || 0; // Ensure this field reflects the final amount
      if (serviceAmount > 0) {
        // 1. Award points to user
        const pointsEarned = Math.floor(serviceAmount / FACTOR_CONVERSION_PUNTOS);
        if (pointsEarned > 0) {
          const userRef = db.collection("usuarios").doc(afterData.usuarioId);
          const userHistoryEntry: HistorialPuntoUsuario = {
            servicioId: solicitudId,
            tipo: "ganados",
            puntos: pointsEarned,
            fecha: now,
            descripcion: `Puntos por servicio: ${afterData.titulo || solicitudId.substring(0, 6)}`,
          };
          await userRef.set({
            puntosAcumulados: admin.firestore.FieldValue.increment(pointsEarned),
            historialPuntos: admin.firestore.FieldValue.arrayUnion(userHistoryEntry),
          }, { merge: true });
          await logActivity(afterData.usuarioId, "usuario", "PUNTOS_FIDELIDAD_GANADOS", `Usuario ganó ${pointsEarned} puntos por servicio ${solicitudId}.`, { tipo: "usuario", id: afterData.usuarioId }, { puntos: pointsEarned, servicioId });
        }

        // 2. Contribute to loyalty fund
        const platformCommission = serviceAmount * COMISION_PLATAFORMA_PORCENTAJE;
        const fundContribution = platformCommission * PORCENTAJE_COMISION_PARA_FONDO_FIDELIDAD;
        if (fundContribution > 0) {
          const fundRef = db.collection("fondoFidelidad").doc("global");
          const fundHistoryEntry = {
            servicioId: solicitudId,
            montoServicio: serviceAmount,
            comisionPlataformaCalculada: platformCommission,
            montoAportadoAlFondo: fundContribution,
            fecha: now,
          };
          await fundRef.set({
            totalAcumulado: admin.firestore.FieldValue.increment(fundContribution),
            registros: admin.firestore.FieldValue.arrayUnion(fundHistoryEntry), // Consider subcollection for scale
          }, { merge: true });
          await logActivity("sistema", "sistema", "FONDO_FIDELIDAD_APORTE", `Aporte de ${fundContribution.toFixed(2)} al fondo de fidelidad por servicio ${solicitudId}.`, { tipo: "fondo_fidelidad", id: "global" }, { monto: fundContribution, servicioId });
        }
      }
    }
    return null;
  });


export const onQuotationResponseNotifyUser = functions.firestore
  .document("solicitudes_cotizacion/{cotizacionId}")
  .onUpdate(async (change, context) => {
    const cotizacionId = context.params.cotizacionId;
    const beforeData = change.before.data() as SolicitudCotizacionData | undefined;
    const afterData = change.after.data() as SolicitudCotizacionData | undefined;

    if (!beforeData || !afterData) return null;

    const usuarioId = afterData.usuarioId;
    const prestadorId = afterData.prestadorId;
    const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
    const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData).nombre || "El prestador" : "El prestador";
    const tituloServicio = afterData.tituloServicio || "tu cotización";
    let notifTitle = ""; let notifBody = ""; let logDesc = ""; let logAction: ActivityLogAction | null = null;

    if (afterData.estado !== beforeData.estado) {
      if (afterData.estado === "precio_propuesto_al_usuario" && beforeData.estado === "pendiente_revision_prestador") {
        notifTitle = "¡Cotización Actualizada!";
        notifBody = `${nombrePrestador} ha propuesto un precio de $${afterData.precioSugerido} para ${tituloServicio}. Revisa y acepta o rechaza.`;
        logAction = "COTIZACION_PRECIO_PROPUESTO";
        logDesc = `${nombrePrestador} (ID: ${prestadorId}) propuso precio $${afterData.precioSugerido} para cotización ${cotizacionId} de usuario ${usuarioId}.`;
      } else if (afterData.estado === "rechazada_prestador" && beforeData.estado === "pendiente_revision_prestador") {
        notifTitle = "Cotización Rechazada";
        notifBody = `${nombrePrestador} ha tenido que rechazar tu solicitud de cotización para ${tituloServicio}. ${afterData.notasPrestador || ""}`;
        logAction = "COTIZACION_RECHAZADA";
        logDesc = `${nombrePrestador} (ID: ${prestadorId}) rechazó cotización ${cotizacionId}. Motivo: ${afterData.notasPrestador || "No especificado"}`;
      }
    }
    if (notifTitle && notifBody) await sendNotification(usuarioId, "usuario", notifTitle, notifBody, { cotizacionId: cotizacionId, nuevoEstado: afterData.estado });
    if (logAction && logDesc) await logActivity(prestadorId, "prestador", logAction, logDesc, { tipo: "solicitud_cotizacion", id: cotizacionId }, { precioSugerido: afterData.precioSugerido, notasPrestador: afterData.notasPrestador });
    return null;
  });

export const acceptQuotationAndCreateServiceRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  const usuarioId = context.auth.uid;
  const { cotizacionId } = data;
  if (!cotizacionId || typeof cotizacionId !== "string") throw new functions.https.HttpsError("invalid-argument", "Se requiere 'cotizacionId'.");

  const cotizacionRef = db.collection("solicitudes_cotizacion").doc(cotizacionId);
  try {
    return await db.runTransaction(async (transaction) => {
      const cotizacionDoc = await transaction.get(cotizacionRef);
      if (!cotizacionDoc.exists) throw new functions.https.HttpsError("not-found", `Cotización ${cotizacionId} no encontrada.`);
      const cotizacionData = cotizacionDoc.data() as SolicitudCotizacionData;

      if (cotizacionData.usuarioId !== usuarioId) throw new functions.https.HttpsError("permission-denied", "No eres el propietario.");
      if (cotizacionData.estado !== "precio_propuesto_al_usuario") throw new functions.https.HttpsError("failed-precondition", `Estado inválido: ${cotizacionData.estado}`);
      if (typeof cotizacionData.precioSugerido !== "number" || cotizacionData.precioSugerido <= 0) throw new functions.https.HttpsError("failed-precondition", "Precio sugerido inválido.");

      const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();
      const ahora = admin.firestore.Timestamp.now();
      const nuevaSolicitudData: Omit<ServiceRequest, "id"> = {
        usuarioId: usuarioId, prestadorId: cotizacionData.prestadorId, status: "confirmada_prestador",
        createdAt: ahora, updatedAt: ahora, titulo: cotizacionData.tituloServicio || `Servicio de cotización ${cotizacionId.substring(0,5)}`,
        // @ts-ignore
        precio: cotizacionData.precioSugerido, paymentStatus: "pendiente_cobro", originatingQuotationId: cotizacionId,
      };
      transaction.set(nuevaSolicitudRef, nuevaSolicitudData);
      transaction.update(cotizacionRef, { estado: "convertida_a_servicio", fechaRespuestaUsuario: ahora });

      await logActivity(usuarioId, "usuario", "COTIZACION_ACEPTADA_USUARIO", `Usuario aceptó cotización ${cotizacionId}. Nueva solicitud ID: ${nuevaSolicitudRef.id}.`, { tipo: "solicitud_cotizacion", id: cotizacionId }, { nuevaSolicitudServicioId: nuevaSolicitudRef.id, precioAceptado: cotizacionData.precioSugerido });
      await sendNotification(cotizacionData.prestadorId, "prestador", "¡Cotización Aceptada!", `Usuario aceptó tu cotización de $${cotizacionData.precioSugerido} para "${cotizacionData.tituloServicio || 'el servicio'}".`, { solicitudId: nuevaSolicitudRef.id, cotizacionId: cotizacionId });
      return { success: true, message: "Cotización aceptada y servicio creado.", servicioId: nuevaSolicitudRef.id };
    });
  } catch (error: any) {
    functions.logger.error(`Error al aceptar cotización ${cotizacionId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar.", error.message);
  }
});

export const onServiceConfirmedCreateChatRoom = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const solicitudId = context.params.solicitudId;
    const afterData = change.after.data() as ServiceRequest | undefined;
    const beforeData = change.before.data() as ServiceRequest | undefined;
    if (!afterData || !beforeData) return null;

    const chatTriggerStatus: ServiceRequestStatus = "confirmada_prestador";
    if (afterData.status === chatTriggerStatus && beforeData.status !== chatTriggerStatus) {
      functions.logger.info(`[ChatCreate ${solicitudId}] Creando sala de chat.`);
      const usuarioId = afterData.usuarioId; const prestadorId = afterData.prestadorId;
      const chatDocRef = db.collection("chats").doc(solicitudId);
      try {
        const chatDoc = await chatDocRef.get();
        if (chatDoc.exists) { functions.logger.info(`Chat ${solicitudId} ya existe.`); return null; }

        const usuarioInfoDoc = await db.collection("usuarios").doc(usuarioId).get();
        const prestadorInfoDoc = await db.collection("prestadores").doc(prestadorId).get();
        const ahora = admin.firestore.Timestamp.now();
        const nuevoChatData: ChatData = {
          solicitudServicioId: solicitudId, participantesUids: [usuarioId, prestadorId].sort(),
          participantesInfo: {
            [usuarioId]: { nombre: (usuarioInfoDoc.data() as UserData)?.nombre || `Usuario ${usuarioId.substring(0,5)}`, rol: "usuario" },
            [prestadorId]: { nombre: (prestadorInfoDoc.data() as ProviderData)?.nombre || `Prestador ${prestadorId.substring(0,5)}`, rol: "prestador" },
          },
          fechaCreacion: ahora, ultimaActualizacion: ahora, estadoChat: "activo", conteoNoLeido: { [usuarioId]: 0, [prestadorId]: 0 }
        };
        await chatDocRef.set(nuevoChatData);
        await logActivity("sistema", "sistema", "CHAT_CREADO", `Chat creado para solicitud ${solicitudId}.`, { tipo: "chat", id: solicitudId }, { solicitudServicioId: solicitudId });
        const serviceTitle = afterData.titulo || "el servicio";
        await sendNotification(usuarioId, "usuario", "Chat Habilitado", `Ya puedes chatear sobre "${serviceTitle}".`, { chatId: solicitudId, solicitudId: solicitudId });
        await sendNotification(prestadorId, "prestador", "Chat Habilitado", `Ya puedes chatear sobre "${serviceTitle}".`, { chatId: solicitudId, solicitudId: solicitudId });
      } catch (error) { functions.logger.error(`[ChatCreate ${solicitudId}] Error:`, error); }
    }
    return null;
  });

export const canjearPuntosPromocion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida para canjear puntos.");
  }
  const usuarioId = context.auth.uid;
  const { promocionId } = data;

  if (!promocionId || typeof promocionId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'promocionId'.");
  }

  const usuarioRef = db.collection("usuarios").doc(usuarioId);
  const promocionRef = db.collection("promociones").doc(promocionId);
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const usuarioDoc = await transaction.get(usuarioRef);
      const promocionDoc = await transaction.get(promocionRef);

      if (!usuarioDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      }
      if (!promocionDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Promoción ${promocionId} no encontrada.`);
      }

      const usuarioData = usuarioDoc.data() as UserData;
      const promocionData = promocionDoc.data() as PromocionFidelidad;

      if (!promocionData.activo) {
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción no está activa.");
      }
      if (promocionData.fechaExpiracion && promocionData.fechaExpiracion.toMillis() < now.toMillis()) {
        transaction.update(promocionRef, { activo: false }); // Desactivar si ya expiró
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción ha expirado.");
      }
      if (typeof promocionData.usosDisponibles === "number" && promocionData.usosDisponibles <= 0) {
        transaction.update(promocionRef, { activo: false }); // Desactivar si se agotó
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción se ha agotado.");
      }
      if ((usuarioData.puntosAcumulados || 0) < promocionData.puntosRequeridos) {
        throw new functions.https.HttpsError("failed-precondition", `No tienes suficientes puntos. Necesitas ${promocionData.puntosRequeridos}, tienes ${usuarioData.puntosAcumulados || 0}.`);
      }

      // Actualizar usuario
      const historialCanje: HistorialPuntoUsuario = {
        promocionId: promocionId,
        tipo: "canjeados",
        puntos: -promocionData.puntosRequeridos, // Puntos gastados son negativos
        fecha: now,
        descripcion: `Canje de promoción: ${promocionData.descripcion}`,
      };
      transaction.update(usuarioRef, {
        puntosAcumulados: admin.firestore.FieldValue.increment(-promocionData.puntosRequeridos),
        historialPuntos: admin.firestore.FieldValue.arrayUnion(historialCanje),
      });

      // Actualizar promoción (si tiene usos limitados)
      if (typeof promocionData.usosDisponibles === "number") {
        transaction.update(promocionRef, {
          usosDisponibles: admin.firestore.FieldValue.increment(-1),
        });
      }
      
      await logActivity(usuarioId, "usuario", "PUNTOS_FIDELIDAD_CANJEADOS", `Usuario canjeó ${promocionData.puntosRequeridos} puntos por promoción '${promocionData.descripcion}'.`, { tipo: "promocion_fidelidad", id: promocionId }, { puntosGastados: promocionData.puntosRequeridos, promocionId });

      return {
        success: true,
        message: `¡Promoción "${promocionData.descripcion}" canjeada exitosamente!`,
        descuentoAplicable: {
            tipo: promocionData.tipoDescuento,
            valor: promocionData.valorDescuento,
            codigo: promocionData.codigoPromocional, // Si existe
        },
      };
    });
  } catch (error: any) {
    functions.logger.error(`Error al canjear puntos para promoción ${promocionId} por usuario ${usuarioId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar el canje de puntos.", error.message);
  }
});
