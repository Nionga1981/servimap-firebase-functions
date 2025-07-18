
// src/functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
  CallableRequest,
  onRequest,
} from "firebase-functions/v2/https";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {z} from "zod";
import {ai} from "./genkit";

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
} from "./types";

// Inicializar Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- START: Genkit Implementation of interpretarBusqueda ---
const interpretarBusquedaInputSchema = z.object({
  searchQuery: z
    .string()
    .describe("El texto de búsqueda del usuario a analizar."),
});

const interpretarBusquedaOutputSchema = z.object({
  tipo: z
    .enum(["prestador", "negocio_fijo"])
    .describe(
      "El tipo de servicio. 'prestador' para servicios móviles/personas, " +
        "'negocio_fijo' para locales físicos.",
    ),
  categoria: z
    .string()
    .describe(
      "La categoría del servicio en español y minúsculas " +
        "(ej: plomería, electricidad).",
    ),
  idiomaDetectado: z
    .string()
    .describe("El código ISO 639-1 del idioma detectado (ej: es, en)."),
});

const interpretarBusquedaPrompt = ai.definePrompt({
  name: "interpretarBusquedaPrompt",
  input: {schema: interpretarBusquedaInputSchema},
  output: {schema: interpretarBusquedaOutputSchema},
  prompt: `Analiza la siguiente búsqueda de un usuario y clasifícala.
- "tipo": "prestador" si es un servicio móvil o una persona (ej: plomero, jardinero). "negocio_fijo" si es un lugar (ej: taller, consultorio).
- "categoría": Una categoría simple en español y minúsculas (ej: plomería, jardinería).
- "idiomaDetectado": El código ISO 639-1 del idioma.

Texto de búsqueda: {{{searchQuery}}}`,
});

const interpretarBusquedaFlow = ai.defineFlow(
  {
    name: "interpretarBusquedaFlow",
    inputSchema: interpretarBusquedaInputSchema,
    outputSchema: interpretarBusquedaOutputSchema,
  },
  async (input) => {
    const {output} = await interpretarBusquedaPrompt(input);
    if (!output) {
      throw new Error("La respuesta del modelo de IA fue nula.");
    }
    return output;
  },
);

export const interpretarBusqueda = onRequest(
  {cors: true},
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const {searchQuery} = req.body;
    if (!searchQuery) {
      res.status(400).send("Falta el parámetro 'searchQuery'");
      return;
    }

    try {
      const result = await interpretarBusquedaFlow({searchQuery});
      res.status(200).json(result);
    } catch (error) {
      console.error("Error en el flujo de interpretarBusqueda:", error);
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
        case "completado_por_usuario":
          targetUserId = prestadorId;
          targetUserType = "prestador";
          tituloNotif = "¡Servicio Confirmado por Usuario!";
          const notifBody = "El usuario ha confirmado la finalización de " +
            `"${serviceTitle}". ¡Ya puedes calificarlo!`;
          cuerpoNotif = notifBody;
          break;
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
          detallesFinancierosNuevos,
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
              await db.collection("comisiones").add({
                idUsuarioGanador: embajadorUID,
                tipo: "servicio_completado",
                monto: comisionEmbajador,
                detalle: `Comisión por servicio de ${providerData.nombre}`,
                fecha: now,
                referenciaID: solicitudId,
              });
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
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }
    const usuarioId = request.auth.uid;
    const {cotizacionId} = request.data;
    if (!cotizacionId || typeof cotizacionId !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere 'cotizacionId'.",
      );
    }

    const cotizacionRef = db
      .collection("solicitudes_cotizacion")
      .doc(cotizacionId);
    try {
      return await db.runTransaction(async (transaction) => {
        const cotizacionDoc = await transaction.get(cotizacionRef);
        if (!cotizacionDoc.exists) {
          throw new HttpsError(
            "not-found",
            `Cotización ${cotizacionId} no encontrada.`,
          );
        }
        const cotizacionData =
          cotizacionDoc.data() as SolicitudCotizacionData;

        if (cotizacionData.usuarioId !== usuarioId) {
          throw new HttpsError("permission-denied", "No eres el propietario.");
        }
        if (cotizacionData.estado !== "precio_propuesto_al_usuario") {
          throw new HttpsError("failed-precondition", "Estado inválido.");
        }
        if (
          typeof cotizacionData.precioSugerido !== "number" ||
          cotizacionData.precioSugerido <= 0
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Precio sugerido inválido.",
          );
        }

        const {prestadorId} = cotizacionData;
        const [prestadorDoc, usuarioDoc] = await Promise.all([
          transaction.get(db.collection("prestadores").doc(prestadorId)),
          transaction.get(db.collection("usuarios").doc(usuarioId)),
        ]);
        if (!prestadorDoc.exists || prestadorDoc.data()?.isBlocked) {
          throw new HttpsError(
            "failed-precondition",
            "Este proveedor no puede ser contratado.",
          );
        }
        if (usuarioDoc.data()?.isBlocked) {
          throw new HttpsError(
            "failed-precondition",
            "Tu cuenta está bloqueada.",
          );
        }

        const userBlocksProviderQuery = db
          .collection("bloqueos")
          .where("bloqueadorRef", "==", usuarioId)
          .where("bloqueadoRef", "==", prestadorId)
          .limit(1);
        const userBlocksProviderSnap = await transaction.get(
          userBlocksProviderQuery,
        );
        if (!userBlocksProviderSnap.empty) {
          const msg =
            "No puedes contratar a este proveedor porque lo has bloqueado.";
          throw new HttpsError("permission-denied", msg);
        }
        const providerBlocksUserQuery = db
          .collection("bloqueos")
          .where("bloqueadorRef", "==", prestadorId)
          .where("bloqueadoRef", "==", usuarioId)
          .limit(1);
        const providerBlocksUserSnap = await transaction.get(
          providerBlocksUserQuery,
        );
        if (!providerBlocksUserSnap.empty) {
          throw new HttpsError(
            "permission-denied",
            "No puedes contratar a este proveedor.",
          );
        }

        const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();
        const ahora = admin.firestore.Timestamp.now();
        const tomorrow = new Date(ahora.toDate());
        tomorrow.setDate(tomorrow.getDate() + 1);
        const serviceDateStr =
          `${tomorrow.getFullYear()}-` +
          `${(tomorrow.getMonth() + 1).toString().padStart(2, "0")}-` +
          `${tomorrow.getDate().toString().padStart(2, "0")}`;

        const nuevaSolicitudData: Omit<ServiceRequest, "id"> = {
          usuarioId: usuarioId,
          prestadorId: prestadorId,
          status: "confirmada_prestador",
          createdAt: ahora,
          updatedAt: ahora,
          titulo: cotizacionData.tituloServicio || "Servicio de cotización",
          precio: cotizacionData.precioSugerido,
          montoCobrado: cotizacionData.precioSugerido,
          paymentStatus: "retenido_para_liberacion",
          originatingQuotationId: cotizacionId,
          actorDelCambioId: usuarioId,
          actorDelCambioRol: "usuario",
          serviceDate: serviceDateStr,
          serviceTime: "10:00",
          serviceType: "fixed",
        };
        transaction.set(nuevaSolicitudRef, nuevaSolicitudData);
        transaction.update(cotizacionRef, {
          estado: "convertida_a_servicio",
          fechaRespuestaUsuario: ahora,
        });

        const logDesc = `Usuario aceptó cotización ${cotizacionId}. Nueva solicitud ID: ${nuevaSolicitudRef.id}.`;
        await logActivity(
          usuarioId,
          "usuario",
          "COTIZACION_ACEPTADA_USUARIO",
          logDesc,
          {tipo: "solicitud_cotizacion", id: cotizacionId},
          {},
        );
        const notifBody =
          "El usuario ha aceptado tu cotización y se ha generado una nueva solicitud de servicio.";
        await sendNotification(
          prestadorId,
          "prestador",
          "¡Cotización Aceptada!",
          notifBody,
          {solicitudId: nuevaSolicitudRef.id, cotizacionId},
        );
        return {
          success: true,
          message: "Cotización aceptada y servicio creado.",
          servicioId: nuevaSolicitudRef.id,
        };
      });
    } catch (error: any) {
      const httpsError = error as HttpsError;
      console.error(
        `Error al aceptar cotización ${cotizacionId}:`,
        httpsError,
      );
      if (httpsError.code) {
        throw httpsError;
      }
      throw new HttpsError(
        "internal",
        "Error al procesar.",
        (httpsError as Error).message,
      );
    }
  },
);
