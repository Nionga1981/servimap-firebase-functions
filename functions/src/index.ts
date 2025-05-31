
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { ServiceRequest, ServiceRequestStatus, ActivityLogAction, UserData, ProviderData, ServiceData, CitaData } from "./index_interfaces"; // Asegúrate que este path sea correcto o define las interfaces aquí


// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
// const visionClient = new ImageAnnotatorClient(); // Comentado si no se usa en este archivo directamente

// --- INTERFACES (Copiadas de la app o un archivo compartido si es posible) ---
// Es mejor tener un archivo de interfaces compartido, pero para este ejemplo, las duplicaré/simplificaré.
// Asegúrate que ServiceRequest, ServiceRequestStatus, ActivityLogAction, UserData, ProviderData, CitaData
// estén definidas aquí o importadas de un archivo como './index_interfaces.ts'
// Por ejemplo, en un archivo index_interfaces.ts podrías tener:
/*
export type ServiceRequestStatus =
  | "agendado" | "pendiente_confirmacion" | "confirmada_prestador" | "pagada"
  | "en_camino_proveedor" | "servicio_iniciado" | "completado_por_prestador"
  | "completado_por_usuario" | "cancelada_usuario" | "cancelada_prestador"
  | "rechazada_prestador" | "en_disputa" | "cerrado_automaticamente"
  | "cerrado_con_calificacion" | "cerrado_con_disputa_resuelta";

export interface ServiceRequest {
  id: string;
  userId: string;
  providerId: string;
  status: ServiceRequestStatus;
  createdAt: admin.firestore.Timestamp | number;
  updatedAt?: admin.firestore.Timestamp | number;
  titulo?: string;
  // ...otros campos relevantes
  // Para la lógica de actor en el log:
  actorDelCambioId?: string; // Quién hizo el último cambio manual (usuarioId o prestadorId)
  actorDelCambioRol?: 'usuario' | 'prestador';
}
// Y así para las otras interfaces...
*/


// --- START: Funciones importadas de otros archivos (mantener) ---
// Ejemplo: export { activarMembresia } from "./activarMembresia";
// Si tienes estas funciones en otros archivos, mantenlas exportadas.
// ... (tus otras exportaciones de funciones callable y triggers)
// --- END: Funciones importadas de otros archivos ---


// --- TRIGGER FCM PARA CAMBIOS DE ESTADO DE SERVICIO (EXISTENTE) ---
export const onServiceStatusChangeSendNotification = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const newValue = change.after.data() as ServiceData | CitaData; // Usar ServiceData o CitaData según corresponda
    const previousValue = change.before.data() as ServiceData | CitaData;
    const solicitudId = context.params.solicitudId;

    if (!newValue || !previousValue) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] No new or previous data, exiting.`);
      return null;
    }

    if (newValue.estado === previousValue.estado) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] Estado no cambió (${newValue.estado}), no se envía notificación.`);
      return null;
    }
    
    functions.logger.log(`[FCM Trigger ${solicitudId}] Estado cambiado de ${previousValue.estado} a ${newValue.estado}. Preparando notificación.`);

    const usuarioId = newValue.usuarioId;
    const prestadorId = newValue.prestadorId;
    let tituloNotif = "";
    let cuerpoNotif = "";
    let targetUserId: string | null = null;
    let targetUserType: 'usuario' | 'prestador' | null = null;

    const serviceTitle = newValue.titulo || (newValue as ServiceData).detallesServicio || "un servicio";

    switch (newValue.estado) {
      case "agendado":
        targetUserId = prestadorId;
        targetUserType = "prestador";
        tituloNotif = "Nueva Solicitud de Servicio";
        cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}".`;
        break;
      case "confirmada_prestador":
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = "¡Cita Confirmada!";
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido confirmada por el prestador.`;
        break;
      case "rechazada_prestador":
      case "cancelada_prestador":
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = `Cita ${newValue.estado === "rechazada_prestador" ? "Rechazada" : "Cancelada"}`;
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido ${newValue.estado === "rechazada_prestador" ? "rechazada" : "cancelada"} por el prestador.`;
        break;
      case "cancelada_usuario":
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
        functions.logger.log(`[FCM Trigger ${solicitudId}] Estado ${newValue.estado} no maneja notificación específica por ahora.`);
        return null;
    }

    if (!targetUserId || !targetUserType) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] No se definió destinatario para el estado ${newValue.estado}.`);
      return null;
    }

    const recipientCollection = targetUserType === "usuario" ? "usuarios" : "prestadores";
    const recipientDoc = await db.collection(recipientCollection).doc(targetUserId).get();

    if (!recipientDoc.exists) {
      functions.logger.error(`[FCM Trigger ${solicitudId}] Documento del destinatario ${targetUserType} ${targetUserId} no encontrado.`);
      return null;
    }

    const recipientData = (targetUserType === "usuario" ? recipientDoc.data() as UserData : recipientDoc.data() as ProviderData);
    const tokens = recipientData.fcmTokens;

    if (!tokens || tokens.length === 0) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] El destinatario ${targetUserType} ${targetUserId} no tiene tokens FCM registrados.`);
      return null;
    }

    const payload: admin.messaging.MessagingPayload = {
      notification: {
        title: tituloNotif,
        body: cuerpoNotif,
      },
      data: { 
        solicitudId: solicitudId,
        nuevoEstado: newValue.estado,
        tipoNotificacion: `SERVICIO_${newValue.estado.toUpperCase()}`,
      },
    };

    try {
      const response = await admin.messaging().sendToDevice(tokens, payload);
      functions.logger.log(`[FCM Trigger ${solicitudId}] Notificación enviada exitosamente a ${response.successCount} tokens para ${targetUserType} ${targetUserId}.`);
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          functions.logger.error(
            `[FCM Trigger ${solicitudId}] Falla al enviar notificación al token ${tokens[index]}:`,
            error
          );
          // Lógica para limpiar tokens inválidos/caducados (ejemplo)
          // if (error.code === "messaging/invalid-registration-token" ||
          //     error.code === "messaging/registration-token-not-registered") {
          //   db.collection(recipientCollection).doc(targetUserId).update({
          //     fcmTokens: admin.firestore.FieldValue.arrayRemove(tokens[index])
          //   });
          // }
        }
      });
    } catch (error) {
      functions.logger.error(`[FCM Trigger ${solicitudId}] Error al enviar notificación FCM a ${targetUserType} ${targetUserId}:`, error);
    }
    return null;
  });

// --- NUEVO TRIGGER PARA LOGS DE ACTIVIDAD ---
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

    const logs_actividad_ref = db.collection("logs_actividad");
    const now = admin.firestore.Timestamp.now();
    let actorId: string = "sistema"; // Por defecto, si no podemos determinar el actor
    let actorRol: "usuario" | "prestador" | "sistema" | "admin" = "sistema";
    let logEntryNeeded = false;
    let descripcionLog = "";
    const detallesAdicionales: Record<string, any> = {
        solicitudId: solicitudId,
        estadoAnterior: beforeData.status,
        estadoNuevo: afterData.status,
    };

    // 1. Cambio de Estado
    if (beforeData.status !== afterData.status) {
      logEntryNeeded = true;
      descripcionLog = `Solicitud ${solicitudId} cambió de estado: ${beforeData.status} -> ${afterData.status}.`;

      // Determinar el actor basado en la transición de estado
      // Esta lógica puede necesitar ajustes basados en cómo tu app realmente establece quién hace el cambio.
      // Si tienes un campo 'actorDelCambioId' en 'solicitudes_servicio' que se actualiza con cada cambio manual, úsalo.
      if (afterData.status === "confirmada_prestador" || afterData.status === "rechazada_prestador" || afterData.status === "en_camino_proveedor" || afterData.status === "servicio_iniciado" || afterData.status === "completado_por_prestador") {
        actorId = afterData.providerId;
        actorRol = "prestador";
      } else if (afterData.status === "cancelada_usuario" || afterData.status === "completado_por_usuario") {
        actorId = afterData.userId;
        actorRol = "usuario";
      } else if (afterData.status === "cancelada_prestador") {
        actorId = afterData.providerId;
        actorRol = "prestador";
      } else if (afterData.status === "cerrado_automaticamente") {
        actorId = "sistema";
        actorRol = "sistema";
        descripcionLog = `Solicitud ${solicitudId} cerrada automáticamente por sistema. Estado anterior: ${beforeData.status}.`;
      }
      // Considerar otros estados y quién los gatilla.
      
      // Si el actor es 'sistema' pero el cambio fue gatillado por un 'updatedAt' cercano al 'now',
      // podría ser que una función callable hizo el cambio. Necesitarías pasar el actorId a esa función.
      // Para simplificar, si no es un estado automático claro, asumimos el actor del 'updatedAt'
      // Esto es una heurística y puede no ser 100% preciso sin más contexto.
      // Si `afterData.actorDelCambioId` y `afterData.actorDelCambioRol` existen, úsalos:
      // if (afterData.actorDelCambioId && afterData.actorDelCambioRol) {
      //   actorId = afterData.actorDelCambioId;
      //   actorRol = afterData.actorDelCambioRol;
      // }
    }

    // 2. Creación de Calificación (detectado por la presencia nueva de la calificación)
    // Calificación de Usuario
    if (!beforeData.calificacionUsuario && afterData.calificacionUsuario) {
        logEntryNeeded = true;
        descripcionLog = `Usuario ${afterData.userId} calificó servicio ${solicitudId} (Prestador: ${afterData.providerId}) con ${afterData.calificacionUsuario.estrellas} estrellas.`;
        actorId = afterData.userId;
        actorRol = "usuario";
        detallesAdicionales.calificacionUsuario = afterData.calificacionUsuario;
        
        await logs_actividad_ref.add({
            actorId: actorId,
            actorRol: actorRol,
            accion: "CALIFICACION_USUARIO" as ActivityLogAction,
            descripcion: descripcionLog,
            fecha: now,
            entidadAfectada: { tipo: "solicitud_servicio", id: solicitudId },
            detallesAdicionales: { estrellas: afterData.calificacionUsuario.estrellas, comentario: afterData.calificacionUsuario.comentario || "" },
        });
        logEntryNeeded = false; // Ya creamos el log específico para esto
    }

    // Calificación de Prestador
    if (!beforeData.calificacionPrestador && afterData.calificacionPrestador) {
        logEntryNeeded = true;
        descripcionLog = `Prestador ${afterData.providerId} calificó a usuario ${afterData.userId} en servicio ${solicitudId} con ${afterData.calificacionPrestador.estrellas} estrellas.`;
        actorId = afterData.providerId;
        actorRol = "prestador";
        detallesAdicionales.calificacionPrestador = afterData.calificacionPrestador;

         await logs_actividad_ref.add({
            actorId: actorId,
            actorRol: actorRol,
            accion: "CALIFICACION_PRESTADOR" as ActivityLogAction,
            descripcion: descripcionLog,
            fecha: now,
            entidadAfectada: { tipo: "solicitud_servicio", id: solicitudId },
            detallesAdicionales: { estrellas: afterData.calificacionPrestador.estrellas, comentario: afterData.calificacionPrestador.comentario || "" },
        });
        logEntryNeeded = false; // Ya creamos el log específico para esto
    }

    // Si hubo un cambio de estado genérico y no se ha logueado ya por calificación
    if (logEntryNeeded && beforeData.status !== afterData.status) {
      try {
        await logs_actividad_ref.add({
          actorId: actorId,
          actorRol: actorRol,
          accion: "CAMBIO_ESTADO_SOLICITUD" as ActivityLogAction,
          descripcion: descripcionLog,
          fecha: now,
          entidadAfectada: { tipo: "solicitud_servicio", id: solicitudId },
          detallesAdicionales: detallesAdicionales,
        });
        functions.logger.info(`[LogTrigger ${solicitudId}] Log de cambio de estado creado: ${descripcionLog}`);
      } catch (error) {
        functions.logger.error(`[LogTrigger ${solicitudId}] Error al crear log de actividad:`, error);
      }
    } else if (!logEntryNeeded && beforeData.status !== afterData.status) {
        functions.logger.info(`[LogTrigger ${solicitudId}] Cambio de estado ${beforeData.status} -> ${afterData.status} no requirió log genérico (probablemente logueado específicamente).`);
    } else if (!logEntryNeeded && beforeData.status === afterData.status) {
        // functions.logger.info(`[LogTrigger ${solicitudId}] No hubo cambio de estado ni se detectó evento de calificación nuevo relevante para logging general.`);
    }


    // Futuro: Detectar cambios en otros campos críticos si es necesario.
    // ej: if (beforeData.paymentStatus !== afterData.paymentStatus) { ... }
    // ej: if (beforeData.garantiaActiva !== afterData.garantiaActiva && afterData.garantiaActiva === true) { ... }

    return null;
  });

// Puedes añadir más triggers para otras colecciones o eventos si es necesario.
// Ejemplo: un trigger para `logs_autenticacion` cuando se crea un usuario o inicia sesión,
// pero eso normalmente se maneja con triggers de Authentication.

// No olvides exportar aquí todas tus funciones callable, pubsub, etc.
// que ya tenías, si es que las eliminaste de este archivo y las moviste a otros.
// Si este es tu único archivo index.ts, todas las exportaciones van aquí.
export {
    // ... (tus otras funciones exportadas aquí)
}

    