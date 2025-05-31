
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Intentar importar desde el archivo de interfaces si existe, sino usar definiciones locales.
// import type { ServiceRequest, ServiceRequestStatus, ActivityLogAction, UserData, ProviderData, ServiceData, CitaData, SolicitudCotizacion, SolicitudCotizacionEstado, Chat, MensajeChat } from "./index_interfaces";

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- START: INTERFACES (Definidas localmente para este ejemplo si no se importan) ---
// Es MUCHO MEJOR tener un archivo de interfaces compartido (ej. index_interfaces.ts)
// y que tanto el frontend como las funciones lo usen.
// Estas son versiones simplificadas o que coinciden con src/types/index.ts

export type ServiceRequestStatus =
  | "agendado" | "pendiente_confirmacion" | "confirmada_prestador" | "pagada"
  | "en_camino_proveedor" | "servicio_iniciado" | "completado_por_prestador"
  | "completado_por_usuario" | "cancelada_usuario" | "cancelada_prestador"
  | "rechazada_prestador" | "en_disputa" | "cerrado_automaticamente"
  | "cerrado_con_calificacion" | "cerrado_con_disputa_resuelta";

export interface ServiceRequest { // Usado en solicitudes_servicio
  id: string;
  userId: string; // Debería ser usuarioId para consistencia
  usuarioId: string;
  providerId: string; // Debería ser prestadorId para consistencia
  prestadorId: string;
  status: ServiceRequestStatus;
  createdAt: admin.firestore.Timestamp | number;
  updatedAt?: admin.firestore.Timestamp | number;
  titulo?: string;
  actorDelCambioId?: string;
  actorDelCambioRol?: 'usuario' | 'prestador';
  calificacionUsuario?: any; // Simplificado
  calificacionPrestador?: any; // Simplificado
  // Otros campos relevantes de tu tipo ServiceRequest
  paymentStatus?: string; // Ej: 'retenido_para_liberacion', 'liberado_al_proveedor'
  originatingQuotationId?: string;
}

export interface UserData { // Usado en usuarios
  fcmTokens?: string[];
  // otros campos de usuario
  nombre?: string;
}

export interface ProviderData { // Usado en prestadores
  fcmTokens?: string[];
  // otros campos de prestador
  nombre?: string;
}

export type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador" | "precio_propuesto_al_usuario"
  | "rechazada_prestador" | "aceptada_por_usuario"
  | "rechazada_usuario" | "convertida_a_servicio" | "expirada";

export interface SolicitudCotizacionData { // Usado en solicitudes_cotizacion
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

export interface ChatData { // Usado en chats
  id?: string;
  solicitudServicioId: string;
  participantesUids: string[];
  participantesInfo?: {
    [uid: string]: { nombre?: string; rol: 'usuario' | 'prestador' };
  };
  fechaCreacion: admin.firestore.Timestamp;
  ultimaActualizacion?: admin.firestore.Timestamp;
  ultimoMensaje?: {
    texto: string;
    remitenteId: string;
    timestamp: admin.firestore.Timestamp;
  };
  // mensajes (subcolección)
}

export type ActivityLogAction =
  | 'CAMBIO_ESTADO_SOLICITUD' | 'CALIFICACION_USUARIO' | 'CALIFICACION_PRESTADOR'
  | 'SOLICITUD_CREADA' | 'PAGO_RETENIDO' | 'PAGO_LIBERADO'
  | 'GARANTIA_ACTIVADA' | 'INICIO_SESION' | 'CIERRE_SESION'
  | 'CONFIG_CAMBIADA' | 'COTIZACION_CREADA' | 'COTIZACION_PRECIO_PROPUESTO'
  | 'COTIZACION_ACEPTADA_USUARIO' | 'COTIZACION_RECHAZADA' | 'CHAT_CREADO';

// --- END: INTERFACES ---


// --- Helper para enviar notificaciones (reutilizable) ---
async function sendNotification(userId: string, userType: "usuario" | "prestador", title: string, body: string, data?: { [key: string]: string }) {
  const userCol = userType === "usuario" ? "usuarios" : "prestadores";
  const userDoc = await db.collection(userCol).doc(userId).get();
  if (!userDoc.exists) {
    functions.logger.error(`[NotificationHelper] ${userType} ${userId} no encontrado.`);
    return;
  }
  const userData = (userType === "usuario" ? userDoc.data() as UserData : userDoc.data() as ProviderData);
  const tokens = userData.fcmTokens;

  if (tokens && tokens.length > 0) {
    const payload = { notification: { title, body }, data };
    try {
      await admin.messaging().sendToDevice(tokens, payload);
      functions.logger.info(`[NotificationHelper] Notificación enviada a ${userType} ${userId}.`);
    } catch (error) {
      functions.logger.error(`[NotificationHelper] Error enviando notificación a ${userType} ${userId}:`, error);
      // Considerar limpiar tokens inválidos aquí
    }
  } else {
    functions.logger.log(`[NotificationHelper] ${userType} ${userId} no tiene tokens FCM.`);
  }
}

// --- Helper para crear logs de actividad (reutilizable) ---
async function logActivity(
  actorId: string,
  actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin',
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


// --- FCM TRIGGER PARA CAMBIOS DE ESTADO DE SERVICIO (EXISTENTE, adaptado) ---
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

    if (newValue.status === previousValue.status) {
      // functions.logger.log(`[FCM Trigger ${solicitudId}] Estado no cambió (${newValue.status}), no se envía notificación.`);
      return null;
    }
    
    functions.logger.log(`[FCM Trigger ${solicitudId}] Estado cambiado de ${previousValue.status} a ${newValue.status}. Preparando notificación.`);

    const usuarioId = newValue.usuarioId;
    const prestadorId = newValue.prestadorId;
    let tituloNotif = "";
    let cuerpoNotif = "";
    let targetUserId: string | null = null;
    let targetUserType: 'usuario' | 'prestador' | null = null;

    const serviceTitle = newValue.titulo || "un servicio";

    // Notificaciones de cambios de estado de servicio
    switch (newValue.status) {
      case "agendado": // Usuario agenda, notificar al prestador
        targetUserId = prestadorId;
        targetUserType = "prestador";
        tituloNotif = "Nueva Solicitud de Servicio";
        cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}".`;
        break;
      case "confirmada_prestador": // Prestador confirma, notificar al usuario
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = "¡Cita Confirmada!";
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido confirmada por el prestador.`;
        break;
      case "rechazada_prestador":
      case "cancelada_prestador":
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = `Cita ${newValue.status === "rechazada_prestador" ? "Rechazada" : "Cancelada"}`;
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido ${newValue.status === "rechazada_prestador" ? "rechazada" : "cancelada"} por el prestador.`;
        break;
      case "cancelada_usuario": // Usuario cancela, notificar al prestador
        targetUserId = prestadorId;
        targetUserType = "prestador";
        tituloNotif = "Cita Cancelada por Usuario";
        cuerpoNotif = `La cita para "${serviceTitle}" ha sido cancelada por el usuario.`;
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
        cuerpoNotif = `El prestador ha marcado "${serviceTitle}" como completado. Por favor, confirma y califica.`;
        break;
      case "completado_por_usuario":
        targetUserId = prestadorId;
        targetUserType = "prestador";
        tituloNotif = "¡Servicio Confirmado por Usuario!";
        cuerpoNotif = `El usuario ha confirmado la finalización de "${serviceTitle}". ¡Ya puedes calificarlo!`;
        break;
      default:
        functions.logger.log(`[FCM Trigger ${solicitudId}] Estado ${newValue.status} no maneja notificación específica por ahora.`);
        return null;
    }

    if (targetUserId && targetUserType) {
      await sendNotification(targetUserId, targetUserType, tituloNotif, cuerpoNotif, { solicitudId, nuevoEstado: newValue.status });
    } else {
      functions.logger.log(`[FCM Trigger ${solicitudId}] No se definió destinatario para el estado ${newValue.status}.`);
    }
    return null;
  });

// --- TRIGGER PARA LOGS DE ACTIVIDAD (EXISTENTE, adaptado) ---
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

    let actorId: string = afterData.actorDelCambioId || "sistema";
    let actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin' = afterData.actorDelCambioRol || "sistema";
    
    const detallesAdicionales: Record<string, any> = {
        solicitudId: solicitudId,
        estadoAnterior: beforeData.status,
        estadoNuevo: afterData.status,
    };

    if (beforeData.status !== afterData.status) {
      // Determinar actor si no viene explícito (fallback)
      if (!afterData.actorDelCambioId) {
        if (afterData.status === "confirmada_prestador" || afterData.status === "rechazada_prestador" || afterData.status === "en_camino_proveedor" || afterData.status === "servicio_iniciado" || afterData.status === "completado_por_prestador" || afterData.status === "cancelada_prestador") {
            actorId = afterData.prestadorId;
            actorRol = "prestador";
        } else if (afterData.status === "cancelada_usuario" || afterData.status === "completado_por_usuario") {
            actorId = afterData.usuarioId;
            actorRol = "usuario";
        } else if (afterData.status === "cerrado_automaticamente") {
            actorId = "sistema";
            actorRol = "sistema";
        }
      }
      const descLog = `Solicitud ${solicitudId} cambió de estado por ${actorRol} ${actorId}: ${beforeData.status} -> ${afterData.status}.`;
      await logActivity(actorId, actorRol, "CAMBIO_ESTADO_SOLICITUD", descLog, { tipo: "solicitud_servicio", id: solicitudId }, detallesAdicionales);
    }

    if (!beforeData.calificacionUsuario && afterData.calificacionUsuario) {
      const descLog = `Usuario ${afterData.usuarioId} calificó servicio ${solicitudId} (Prestador: ${afterData.prestadorId}) con ${afterData.calificacionUsuario.estrellas} estrellas.`;
      await logActivity(afterData.usuarioId, "usuario", "CALIFICACION_USUARIO", descLog, { tipo: "solicitud_servicio", id: solicitudId }, { estrellas: afterData.calificacionUsuario.estrellas, comentario: afterData.calificacionUsuario.comentario || "" });
    }

    if (!beforeData.calificacionPrestador && afterData.calificacionPrestador) {
      const descLog = `Prestador ${afterData.prestadorId} calificó a usuario ${afterData.usuarioId} en servicio ${solicitudId} con ${afterData.calificacionPrestador.estrellas} estrellas.`;
      await logActivity(afterData.prestadorId, "prestador", "CALIFICACION_PRESTADOR", descLog, { tipo: "solicitud_servicio", id: solicitudId }, { estrellas: afterData.calificacionPrestador.estrellas, comentario: afterData.calificacionPrestador.comentario || "" });
    }
    return null;
  });


// --- NUEVAS FUNCIONES Y TRIGGERS ---

/**
 * Trigger para notificar al usuario cuando un prestador responde a una solicitud de cotización.
 */
export const onQuotationResponseNotifyUser = functions.firestore
  .document("solicitudes_cotizacion/{cotizacionId}")
  .onUpdate(async (change, context) => {
    const cotizacionId = context.params.cotizacionId;
    const beforeData = change.before.data() as SolicitudCotizacionData | undefined;
    const afterData = change.after.data() as SolicitudCotizacionData | undefined;

    if (!beforeData || !afterData) {
      functions.logger.warn(`[QuotationNotify ${cotizacionId}] Datos antes o después no disponibles.`);
      return null;
    }

    const usuarioId = afterData.usuarioId;
    const prestadorId = afterData.prestadorId;
    const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
    const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData).nombre || "El prestador" : "El prestador";
    const tituloServicio = afterData.tituloServicio || "tu cotización";

    let notifTitle = "";
    let notifBody = "";
    let logDesc = "";
    let logAction: ActivityLogAction | null = null;

    // Si el estado cambió Y fue el prestador quien lo cambió (ej. de "pendiente_revision_prestador" a "precio_propuesto_al_usuario")
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
        logDesc = `${nombrePrestador} (ID: ${prestadorId}) rechazó cotización ${cotizacionId} de usuario ${usuarioId}. Motivo: ${afterData.notasPrestador || "No especificado"}`;
      }
    }

    if (notifTitle && notifBody) {
      await sendNotification(usuarioId, "usuario", notifTitle, notifBody, { cotizacionId: cotizacionId, nuevoEstado: afterData.estado });
    }
    if (logAction && logDesc) {
      await logActivity(prestadorId, "prestador", logAction, logDesc, { tipo: "solicitud_cotizacion", id: cotizacionId }, { precioSugerido: afterData.precioSugerido, notasPrestador: afterData.notasPrestador });
    }

    return null;
  });

/**
 * Función Callable para que el usuario acepte una cotización con precio.
 * Esto crea una solicitud de servicio.
 */
export const acceptQuotationAndCreateServiceRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;
  const { cotizacionId } = data;

  if (!cotizacionId || typeof cotizacionId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'cotizacionId'.");
  }

  const cotizacionRef = db.collection("solicitudes_cotizacion").doc(cotizacionId);

  try {
    return await db.runTransaction(async (transaction) => {
      const cotizacionDoc = await transaction.get(cotizacionRef);
      if (!cotizacionDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Cotización ${cotizacionId} no encontrada.`);
      }
      const cotizacionData = cotizacionDoc.data() as SolicitudCotizacionData;

      if (cotizacionData.usuarioId !== usuarioId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el propietario de esta cotización.");
      }
      if (cotizacionData.estado !== "precio_propuesto_al_usuario") {
        throw new functions.https.HttpsError("failed-precondition", `La cotización no está en estado 'precio_propuesto_al_usuario'. Estado actual: ${cotizacionData.estado}`);
      }
      if (typeof cotizacionData.precioSugerido !== "number" || cotizacionData.precioSugerido <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "La cotización no tiene un precio sugerido válido.");
      }

      // Crear la nueva solicitud de servicio
      const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc(); // Firestore genera ID
      const ahora = admin.firestore.Timestamp.now();

      const nuevaSolicitudData: Omit<ServiceRequest, "id"> = { // Asegurar que los campos coincidan con tu tipo ServiceRequest
        usuarioId: usuarioId,
        prestadorId: cotizacionData.prestadorId,
        status: "confirmada_prestador", // El proveedor ya aceptó al dar precio, usuario acepta ahora.
        createdAt: ahora,
        updatedAt: ahora,
        titulo: cotizacionData.tituloServicio || `Servicio de cotización ${cotizacionId.substring(0,5)}`,
        // @ts-ignore // Ignorar error de TS si ServiceRequest no tiene todos estos campos exactamente (ajustar según definición)
        detallesServicio: cotizacionData.descripcionProblema,
        precio: cotizacionData.precioSugerido,
        // tipoServicio: 'fijo_cotizado', // Podrías añadir un tipo específico
        paymentStatus: "pendiente_cobro", // O 'retenido_para_liberacion' si el pago se hace inmediatamente
        originatingQuotationId: cotizacionId, // Enlazar a la cotización original
        // ... otros campos necesarios para tu ServiceRequest
      };
      transaction.set(nuevaSolicitudRef, nuevaSolicitudData);

      // Actualizar estado de la cotización
      transaction.update(cotizacionRef, {
        estado: "convertida_a_servicio",
        fechaRespuestaUsuario: ahora,
      });

      await logActivity(
        usuarioId, "usuario", "COTIZACION_ACEPTADA_USUARIO",
        `Usuario ${usuarioId} aceptó cotización ${cotizacionId} (Prestador: ${cotizacionData.prestadorId}). Nueva solicitud de servicio ID: ${nuevaSolicitudRef.id}.`,
        { tipo: "solicitud_cotizacion", id: cotizacionId },
        { nuevaSolicitudServicioId: nuevaSolicitudRef.id, precioAceptado: cotizacionData.precioSugerido }
      );

      // Notificar al prestador
      await sendNotification(
        cotizacionData.prestadorId, "prestador",
        "¡Cotización Aceptada!",
        `El usuario ha aceptado tu cotización de $${cotizacionData.precioSugerido} para "${cotizacionData.tituloServicio || 'el servicio'}". Se ha creado una nueva solicitud de servicio.`,
        { solicitudId: nuevaSolicitudRef.id, cotizacionId: cotizacionId }
      );

      return { success: true, message: "Cotización aceptada y solicitud de servicio creada.", servicioId: nuevaSolicitudRef.id };
    });
  } catch (error: any) {
    functions.logger.error(`Error al aceptar cotización ${cotizacionId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la aceptación de la cotización.", error.message);
  }
});


/**
 * Trigger para crear una sala de chat cuando una solicitud de servicio es confirmada.
 */
export const onServiceConfirmedCreateChatRoom = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const solicitudId = context.params.solicitudId;
    const afterData = change.after.data() as ServiceRequest | undefined;
    const beforeData = change.before.data() as ServiceRequest | undefined;

    if (!afterData || !beforeData) {
      functions.logger.warn(`[ChatCreate ${solicitudId}] Datos no disponibles.`);
      return null;
    }

    // Estado que consideramos "confirmado" para iniciar chat.
    // Podría ser 'confirmada_prestador' (si el usuario aún debe pagar) o 'pagada'.
    // Usemos 'confirmada_prestador' como el punto donde la coordinación puede empezar.
    const chatTriggerStatus: ServiceRequestStatus = "confirmada_prestador";

    if (afterData.status === chatTriggerStatus && beforeData.status !== chatTriggerStatus) {
      functions.logger.info(`[ChatCreate ${solicitudId}] Servicio confirmado. Creando/Verificando sala de chat.`);

      const usuarioId = afterData.usuarioId;
      const prestadorId = afterData.prestadorId;
      const chatDocRef = db.collection("chats").doc(solicitudId); // Usar solicitudId como ID del chat

      try {
        const chatDoc = await chatDocRef.get();
        if (chatDoc.exists) {
          functions.logger.info(`[ChatCreate ${solicitudId}] Sala de chat ya existe.`);
          return null; // Ya existe, no hacer nada
        }

        const usuarioInfoDoc = await db.collection("usuarios").doc(usuarioId).get();
        const prestadorInfoDoc = await db.collection("prestadores").doc(prestadorId).get();

        const nuevoChatData: ChatData = {
          solicitudServicioId: solicitudId,
          participantesUids: [usuarioId, prestadorId].sort(), // Guardar ordenado para consultas
          participantesInfo: {
            [usuarioId]: {
              nombre: (usuarioInfoDoc.data() as UserData)?.nombre || `Usuario ${usuarioId.substring(0,5)}`,
              rol: 'usuario',
            },
            [prestadorId]: {
              nombre: (prestadorInfoDoc.data() as ProviderData)?.nombre || `Prestador ${prestadorId.substring(0,5)}`,
              rol: 'prestador',
            },
          },
          fechaCreacion: admin.firestore.Timestamp.now(),
          ultimaActualizacion: admin.firestore.Timestamp.now(),
          estadoChat: "activo",
          conteoNoLeido: { [usuarioId]: 0, [prestadorId]: 0 }
        };

        await chatDocRef.set(nuevoChatData);
        functions.logger.info(`[ChatCreate ${solicitudId}] Sala de chat creada exitosamente.`);

        await logActivity(
            "sistema", "sistema", "CHAT_CREADO",
            `Sala de chat creada para solicitud ${solicitudId} entre usuario ${usuarioId} y prestador ${prestadorId}.`,
            { tipo: "chat", id: solicitudId }, // Usando solicitudId como ID del chat
            { solicitudServicioId: solicitudId }
        );

        // Notificar a ambos
        const serviceTitle = afterData.titulo || "el servicio";
        await sendNotification(usuarioId, "usuario", "Chat Habilitado", `Ya puedes chatear con el prestador sobre "${serviceTitle}".`, { chatId: solicitudId, solicitudId: solicitudId });
        await sendNotification(prestadorId, "prestador", "Chat Habilitado", `Ya puedes chatear con el usuario sobre "${serviceTitle}".`, { chatId: solicitudId, solicitudId: solicitudId });

      } catch (error) {
        functions.logger.error(`[ChatCreate ${solicitudId}] Error al crear sala de chat:`, error);
      }
    }
    return null;
  });


// Exportar otras funciones si las tienes...
export {
    // ... (tus otras funciones exportadas aquí, si las moviste)
}
