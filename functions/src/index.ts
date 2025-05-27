
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// --- CONSTANTES ---
const STANDARD_WARRANTY_DAYS = 3;
const PREMIUM_WARRANTY_DAYS = 7;
const RATING_AND_DISPUTE_WINDOW_DAYS = 7; // Días para calificar o reportar después de confirmación del usuario

const PALABRAS_CLAVE_PROHIBIDAS_CONTACTO = [
  "teléfono", "telefono", "celular", "móvil", "movil", "whatsapp", "tel:",
  "email", "correo", "e-mail", "@",
  "facebook", "fb.com", "instagram", "twitter", "linkedin", "tiktok",
  "calle", "avenida", "colonia", "barrio", "cp ", "c.p.", "código postal", "codigo postal",
  "apartado postal", "suite", "edificio", "núm.", "no.", "int.", "depto.",
  "contacto", "llámame", "llamame", "escríbeme", "escribeme", "sitio web", "pagina web", "www.", ".com", ".mx", ".net", ".org",
];

// --- INTERFACES ---
type ServiceRequestStatus =
  | "agendado"
  | "pendiente_confirmacion"
  | "confirmada_prestador"
  | "pagada"
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador"
  | "completado_por_usuario"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "rechazada_prestador"
  | "en_disputa"
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta";

type CitaEstado = ServiceRequestStatus; // Reutilizamos los estados para citas

type PaymentStatus =
  | "pendiente_confirmacion_usuario"
  | "retenido_para_liberacion"
  | "liberado_al_proveedor"
  | "congelado_por_disputa"
  | "reembolsado_parcial"
  | "reembolsado_total"
  | "no_aplica"
  | "pendiente_cobro"
  | "procesado_exitosamente"
  | "fallido";


interface RatingData {
  calificacion: number;
  comentario?: string;
  fecha: admin.firestore.Timestamp;
}

interface ServiceData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  estado: ServiceRequestStatus;
  fechaSolicitud: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  fechaServicio?: admin.firestore.Timestamp;
  detallesServicio?: string;
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;

  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  fechaConfirmacion?: admin.firestore.Timestamp;
  habilitarCalificacion?: boolean;
  ratingWindowExpiresAt?: admin.firestore.Timestamp;
  calificacionUsuario?: RatingData;
  calificacionPrestador?: RatingData;
  mutualRatingCompleted?: boolean;

  paymentStatus?: PaymentStatus;
  fechaLiberacionPago?: admin.firestore.Timestamp;
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;
  ordenCobroId?: string;

  warrantyEndDate?: string;
  garantiaSolicitada?: boolean;
  idSolicitudGarantia?: string;
  garantiaResultado?: "aprobada" | "rechazada";
  compensacionAutorizada?: boolean;

  detallesDisputa?: {
    reportadoEn: admin.firestore.Timestamp;
    detalle: string;
    reporteId?: string;
  };
  [key: string]: any;
}

interface ProviderData {
  uid?: string;
  name?: string;
  ratingSum?: number;
  ratingCount?: number;
  rating?: number;
  documentosVerificables?: DocumentoVerificable[];
  isAvailable?: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: admin.firestore.Timestamp;
  } | null;
  lastConnection?: admin.firestore.Timestamp;
  allowsHourlyServices?: boolean;
  hourlyRate?: number;
}

interface UserData {
  uid?: string;
  name?: string;
  ratingSumUsuario?: number;
  ratingCountUsuario?: number;
  ratingUsuario?: number;
  isPremium?: boolean;
}

interface DocumentoVerificable {
  tipoDocumento: string;
  urlDocumento: string;
  descripcion?: string;
  fechaRegistro: admin.firestore.Timestamp;
  estadoVerificacion: "pendiente" | "verificado_ia" | "rechazado_ia" | "verificado_manual" | "rechazado_manual" | "Validado" | "Rechazado por datos sensibles detectados";
  fechaVerificacion?: admin.firestore.Timestamp;
  motivoRechazoIA?: string;
  palabrasClaveDetectadasIA?: string[];
}

interface GarantiaData {
  id?: string;
  servicioId: string;
  usuarioId: string;
  prestadorId: string;
  motivo: string;
  fechaSolicitudGarantia: admin.firestore.Timestamp;
  estadoGarantia: "pendiente" | "en_revision" | "aprobada" | "rechazada";
  fechaResolucionGarantia?: admin.firestore.Timestamp;
  resolucionDetalles?: string;
  resueltaPor?: string;
}

interface CitaData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  fechaHoraSolicitada: admin.firestore.Timestamp;
  detallesServicio: string;
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;
  estado: CitaEstado;
  fechaCreacion: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  ordenCobroId?: string;
  paymentStatus?: PaymentStatus;
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;

  fechaCancelacion?: admin.firestore.Timestamp;
  canceladaPor?: string;
  rolCancelador?: "usuario" | "prestador";

  serviceType: "fixed" | "hourly";
  precioServicio?: number;
  tarifaPorHora?: number;
  duracionHoras?: number;
  montoTotalEstimado?: number;
}

interface NotificacionData {
  id?: string; // Firestore auto-ID
  destinatarioId: string;
  rolDestinatario: 'usuario' | 'prestador';
  titulo: string;
  cuerpo: string;
  estadoNotificacion: 'pendiente' | 'leida';
  fechaCreacion: admin.firestore.Timestamp;
  fechaLectura?: admin.firestore.Timestamp;
  tipoNotificacion: string; // Ej: 'cita_confirmada', 'nuevo_mensaje', etc.
  prioridad: 'alta' | 'normal';
  datosAdicionales?: { [key: string]: any }; // Para IDs de citas, servicios, etc.
}


// --- FUNCIONES EXISTENTES (Resumidas para brevedad) ---

export const confirmServiceCompletionByUserService = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando confirmServiceCompletionByUserService", { structuredData: true, data });

  if (!context.auth) {
    functions.logger.error("Usuario no autenticado intentando confirmar servicio.");
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const userId = context.auth.uid;
  const { servicioId } = data;

  if (!servicioId || typeof servicioId !== "string") {
    functions.logger.error("servicioId no proporcionado o inválido.", { servicioId });
    throw new functions.https.HttpsError("invalid-argument", "Se requiere un 'servicioId' válido.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);

  try {
    await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        functions.logger.error(`Servicio con ID ${servicioId} no encontrado.`);
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }

      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.usuarioId !== userId) {
        functions.logger.error(`Usuario ${userId} no autorizado para confirmar servicio ${servicioId}.`);
        throw new functions.https.HttpsError("permission-denied", "No estás autorizado para confirmar este servicio.");
      }

      const validPreviousStates: ServiceRequestStatus[] = ["completado_por_prestador", "en_camino_proveedor", "servicio_iniciado", "confirmada_prestador", "pagada"];
      if (!validPreviousStates.includes(servicioData.estado)) {
        functions.logger.warn(`Intento de confirmar servicio ${servicioId} en estado inválido. Estado actual: ${servicioData.estado}`);
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Debe ser uno de: ${validPreviousStates.join(", ")}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const ratingAndDisputeWindowEndDate = new Date(now.toDate().getTime() + RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(ratingAndDisputeWindowEndDate);

      // Simular obtener el perfil del usuario para saber si es premium
      const userProfileRef = db.collection("usuarios").doc(userId);
      const userProfileDoc = await transaction.get(userProfileRef);
      const userIsPremium = userProfileDoc.exists ? (userProfileDoc.data() as UserData)?.isPremium === true : false;
      
      let warrantyDays = STANDARD_WARRANTY_DAYS;
      if (userIsPremium) {
        warrantyDays = PREMIUM_WARRANTY_DAYS;
      }
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now, // Campo correcto según tu nueva solicitud
        habilitarCalificacion: true,
        paymentStatus: "retenido_para_liberacion",
        ratingWindowExpiresAt: ratingWindowExpiresTimestamp,
        warrantyEndDate: warrantyEndDateDt.toISOString().split("T")[0],
        updatedAt: now,
      });
      functions.logger.info(`Servicio ${servicioId} confirmado por usuario ${userId}. Calificación habilitada, pago retenido, ventana de calificación/disputa y garantía establecidas.`);
    });

    functions.logger.info("Transacción completada exitosamente para confirmServiceCompletionByUserService.");
    return { success: true, message: "Servicio confirmado exitosamente. Ya puedes calificar al prestador y el pago está retenido." };
  } catch (error: any) {
    functions.logger.error("Error en la transacción de confirmServiceCompletionByUserService:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al confirmar el servicio.", error.message);
  }
});

export const calificarPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando calificarPrestador", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const userId = context.auth.uid;
  const { servicioId, calificacion, comentario } = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'servicioId'.");
  }
  if (typeof calificacion !== "number" || calificacion < 1 || calificacion > 5) {
    throw new functions.https.HttpsError("invalid-argument", "La 'calificacion' debe ser un número entre 1 y 5.");
  }
  if (comentario && typeof comentario !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El 'comentario' debe ser un string.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const prestadorCollectionRef = db.collection("prestadores");

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.usuarioId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No puedes calificar este servicio.");
      }
      if (!servicioData.habilitarCalificacion) {
        throw new functions.https.HttpsError("failed-precondition", "La calificación para este servicio no está habilitada.");
      }
      if (servicioData.calificacionUsuario) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado este servicio.");
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para calificar este servicio ha expirado.");
      }

      const nuevaCalificacionUsuario: RatingData = {
        calificacion: calificacion,
        fecha: admin.firestore.Timestamp.now(),
        ...(comentario && { comentario: comentario }),
      };

      const prestadorDocRef = prestadorCollectionRef.doc(servicioData.prestadorId);
      const prestadorDoc = await transaction.get(prestadorDocRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;
      let prestadorName = `Prestador ${servicioData.prestadorId.substring(0,5)}`;

      if (prestadorDoc.exists) {
        const prestadorData = prestadorDoc.data() as ProviderData;
        newRatingSum = (prestadorData.ratingSum || 0) + calificacion;
        newRatingCount = (prestadorData.ratingCount || 0) + 1;
        prestadorName = prestadorData.name || prestadorName;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(prestadorDocRef, {
        ratingSum: newRatingSum,
        ratingCount: newRatingCount,
        rating: currentRating, // Este es el promedioCalificaciones
        name: prestadorName,
        uid: servicioData.prestadorId,
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.Timestamp.now(),
      };
      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
        // Considerar si el estado debe cambiar aquí, por ejemplo a "cerrado_con_calificacion"
        // if (servicioData.estado !== "en_disputa") {
        //   servicioUpdate.estado = "cerrado_con_calificacion";
        // }
      }

      transaction.update(servicioRef, servicioUpdate);

      functions.logger.info(`Usuario ${userId} calificó servicio ${servicioId} para prestador ${servicioData.prestadorId}.`);
      return { success: true, message: "Calificación registrada exitosamente." };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de calificarPrestador:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación.", error.message);
  }
});

export const calificarUsuario = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando calificarUsuario", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const prestadorId = context.auth.uid;
  const { servicioId, calificacion, comentario } = data;

  if (!servicioId || typeof servicioId !== "string" || typeof calificacion !== "number" || calificacion < 1 || calificacion > 5) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'calificacion' (1-5) válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const usuarioCollectionRef = db.collection("usuarios");

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.prestadorId !== prestadorId) {
        throw new functions.https.HttpsError("permission-denied", "No puedes calificar a este usuario para este servicio como prestador.");
      }
      if (!servicioData.habilitarCalificacion) {
        throw new functions.https.HttpsError("failed-precondition", "La calificación mutua no está habilitada (el usuario debe confirmar el servicio primero).");
      }
      if (servicioData.calificacionPrestador) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado a este usuario para este servicio.");
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para calificar a este usuario ha expirado.");
      }

      const nuevaCalificacionPrestador: RatingData = {
        calificacion: calificacion,
        fecha: admin.firestore.Timestamp.now(),
        ...(comentario && { comentario: comentario }),
      };

      const usuarioDocRef = usuarioCollectionRef.doc(servicioData.usuarioId);
      const usuarioDoc = await transaction.get(usuarioDocRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;
      let userName = `Usuario ${servicioData.usuarioId.substring(0,5)}`;

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1;
        userName = usuarioData.name || userName;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(usuarioDocRef, {
        uid: servicioData.usuarioId,
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: currentRating, // Este es el promedioCalificacionesUsuario
        name: userName,
        lastRatedByProviderAt: admin.firestore.Timestamp.now(),
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.Timestamp.now(),
      };
      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        // Considerar si el estado debe cambiar aquí, por ejemplo a "cerrado_con_calificacion"
        // if (servicioData.estado !== "en_disputa") {
        //   servicioUpdate.estado = "cerrado_con_calificacion";
        // }
      }
      transaction.update(servicioRef, servicioUpdate);

      functions.logger.info(`Prestador ${prestadorId} calificó al usuario ${servicioData.usuarioId} para el servicio ${servicioId}.`);
      return { success: true, message: "Calificación de usuario registrada exitosamente." };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de calificarUsuario:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación del usuario.", error.message);
  }
});

export const reportServiceIssue = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando reportServiceIssue", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid; // El usuario autenticado es quien reporta
  const { servicioId, detalleProblema } = data;

  if (!servicioId || typeof servicioId !== "string" || !detalleProblema || typeof detalleProblema !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'detalleProblema' válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  // const reporteCollectionRef = db.collection("reportes"); // Colección de reclamos como pediste

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `El servicio con ID ${servicioId} no fue encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.usuarioId !== usuarioId) {
        throw new functions.https.HttpsError("permission-denied", "No estás autorizado para reportar un problema sobre este servicio (no eres el solicitante).");
      }
      if (servicioData.estado !== "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios que hayas confirmado ('completado_por_usuario'). Estado actual: ${servicioData.estado}`);
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") {
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      const reporteId = db.collection("reportes").doc().id; // Generar ID para el reporte

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa",
        detallesDisputa: {
          reportadoEn: now,
          detalle: detalleProblema,
          reporteId: reporteId, // Guardar ID del documento en "reportes"
        },
        updatedAt: now,
      });

      // Crear el documento en la colección 'reportes'
      const datosReporte = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: detalleProblema, // Puedes tener campos más específicos si lo necesitas
        fechaReporte: now,
        estado: "pendiente", // Estado inicial del reporte en la colección 'reportes'
      };
      transaction.set(db.collection("reportes").doc(reporteId), datosReporte);


      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteId}. Pago congelado.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${servicioData.prestadorId} y al admin sobre la disputa del servicio ${servicioId}.`);

      return {
        success: true,
        message: "Problema reportado exitosamente. El servicio está ahora en disputa y el pago ha sido congelado.",
        reporteId: reporteId,
      };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de reportServiceIssue:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al reportar el problema.", error.message);
  }
});

export const obtenerServiciosCompletados = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando obtenerServiciosCompletados", { structuredData: true });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;

  try {
    const querySnapshot = await db
      .collection("servicios")
      .where("usuarioId", "==", usuarioId)
      .where("estado", "==", "completado_por_usuario")
      .orderBy("fechaConfirmacion", "desc")
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = [];
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id,
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion,
        detallesServicio: servicio.detallesServicio,
      });
    });
    functions.logger.info(`Encontrados ${serviciosCompletados.length} servicios completados por usuario ${usuarioId}.`);
    return serviciosCompletados;
  } catch (error: any) {
    functions.logger.error("Error al obtener servicios completados:", error);
    throw new functions.https.HttpsError("internal", "Error al obtener los servicios completados.", error.message);
  }
});

export const registrarDocumentoProfesional = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando registrarDocumentoProfesional", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const prestadorId = context.auth.uid;
  const { tipoDocumento, urlDocumento, descripcion } = data;

  if (!tipoDocumento || typeof tipoDocumento !== "string" || !urlDocumento || typeof urlDocumento !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tipoDocumento' y 'urlDocumento' válidos.");
  }

  const prestadorRef = db.collection("prestadores").doc(prestadorId);

  const nuevoDocumento: DocumentoVerificable = {
    tipoDocumento: tipoDocumento,
    urlDocumento: urlDocumento,
    ...(descripcion && { descripcion: descripcion }),
    fechaRegistro: admin.firestore.Timestamp.now(),
    estadoVerificacion: "pendiente",
  };

  try {
    await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        functions.logger.info(`Documento del prestador ${prestadorId} no encontrado, creando uno nuevo con el documento.`);
        transaction.set(prestadorRef, { documentosVerificables: [nuevoDocumento], uid: prestadorId, name: `Prestador ${prestadorId.substring(0,5)}` });
      } else {
        transaction.update(prestadorRef, {
          documentosVerificables: admin.firestore.FieldValue.arrayUnion(nuevoDocumento),
        });
      }
    });

    functions.logger.info(`Documento registrado para prestador ${prestadorId}. Tipo: ${tipoDocumento}`);
    return { success: true, message: "Documento registrado exitosamente. Pendiente de revisión." };
  } catch (error: any) {
    functions.logger.error(`Error al registrar documento para prestador ${prestadorId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error al registrar el documento.", error.message);
  }
});

export const verificarDocumentoProfesional = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando verificarDocumentoProfesional (antes validateDocumentAndRemoveContactInfo)", { structuredData: true, data });

  // En un sistema real, esta función debería ser llamada por un admin o un proceso automatizado.
  // Por ahora, la dejamos callable pero podrías restringirla a roles específicos.
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Ejemplo de restricción de rol
     throw new functions.https.HttpsError("permission-denied", "Solo administradores o moderadores pueden ejecutar esta función.");
  }

  const { prestadorId, documentoIndex } = data;

  if (!prestadorId || typeof prestadorId !== "string" || typeof documentoIndex !== "number" || documentoIndex < 0) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'prestadorId' y 'documentoIndex' válidos.");
  }

  const prestadorRef = db.collection("prestadores").doc(prestadorId);

  try {
    return await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Prestador con ID ${prestadorId} no encontrado.`);
      }
      const prestadorData = prestadorDoc.data() as ProviderData;
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : [];

      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];
      const validPreviousStatesForIA: DocumentoVerificable["estadoVerificacion"][] = ["pendiente", "rechazado_ia", "Rechazado por datos sensibles detectados"];
      if (!validPreviousStatesForIA.includes(documentoAVerificar.estadoVerificacion) ) {
         functions.logger.warn(`Documento ${documentoIndex} para ${prestadorId} no está en estado procesable por IA. Estado actual: ${documentoAVerificar.estadoVerificacion}`);
         return { success: false, message: `El documento ya fue procesado manualmente o validado por IA. Estado actual: ${documentoAVerificar.estadoVerificacion}` };
      }

      const urlDocumento = documentoAVerificar.urlDocumento;
      functions.logger.info(`Iniciando análisis de Vision API para documento: ${urlDocumento}`);
      let textoExtraido = "";
      try {
        const [result] = await visionClient.documentTextDetection(urlDocumento);
        textoExtraido = result.fullTextAnnotation?.text?.toLowerCase() || "";
        functions.logger.info(`Texto extraído (primeros 500 chars): ${textoExtraido.substring(0, 500)}`);
      } catch (visionError: any) {
        functions.logger.error("Error de Vision API al procesar el documento:", visionError);
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia";
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError.message);
      }

      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(?\d{2,3}\)?\s?)?(?:[ -]?\d){7,10}/g; // Ajustada para números de 10 dígitos, opcionalmente con +52
      const phoneMatches = textoParaAnalizar.match(phoneRegex);
      if (phoneMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...phoneMatches.map((m) => `Teléfono: ${m.trim()}`));
      }

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatches = textoParaAnalizar.match(emailRegex);
      if (emailMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...emailMatches.map((m) => `Email: ${m.trim()}`));
      }
      
      for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
          // Usar una expresión regular para buscar la palabra completa y evitar subcadenas
          // \b asegura que sea una palabra completa
          const palabraRegex = new RegExp(`\\b${palabra.toLowerCase()}\\b`, "g");
          if (palabraRegex.test(textoParaAnalizar)) {
            // Asegurarse de no añadir duplicados si ya fue detectado por regex de email/teléfono
            if (!palabrasDetectadas.some(pd => pd.toLowerCase().includes(palabra.toLowerCase()))) {
                datosSensiblesEncontrados = true;
                palabrasDetectadas.push(`Palabra clave: ${palabra}`);
            }
          }
      }

      documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
      let nuevoEstado: DocumentoVerificable["estadoVerificacion"];
      let mensajeRespuesta: string;

      if (datosSensiblesEncontrados) {
        nuevoEstado = "Rechazado por datos sensibles detectados";
        documentos[documentoIndex].motivoRechazoIA = "Datos de contacto detectados.";
        documentos[documentoIndex].palabrasClaveDetectadasIA = palabrasDetectadas;
        mensajeRespuesta = "Rechazado: Se detectaron datos de contacto en el documento.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} RECHAZADO. Palabras: ${palabrasDetectadas.join(", ")}`);
      } else {
        nuevoEstado = "Validado"; // Anteriormente "verificado_ia"
        documentos[documentoIndex].motivoRechazoIA = undefined;
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined;
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} VALIDADO.`);
      }
      documentos[documentoIndex].estadoVerificacion = nuevoEstado;

      transaction.update(prestadorRef, { documentosVerificables: documentos });

      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl: urlDocumento,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentos[documentoIndex].fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length,
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [],
        agenteVerificador: context.auth?.uid || "sistema_ia_callable",
      });

      functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} actualizado a estado: ${nuevoEstado}.`);
      return { success: true, message: mensajeRespuesta, newState: nuevoEstado, palabrasDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [] };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de verificarDocumentoProfesional:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al validar el documento.", error.message);
  }
});

export const activarGarantiaPremium = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando activarGarantiaPremium", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  if (context.auth.token.premium !== true) { // Asumiendo un custom claim 'premium'
    throw new functions.https.HttpsError("permission-denied", "Esta función es solo para usuarios premium.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo } = data;

  if (!servicioId || typeof servicioId !== "string" || !motivo || typeof motivo !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo' válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const garantiasRef = db.collection("garantias");

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.usuarioId !== usuarioId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el propietario de este servicio.");
      }
      if (servicioData.estado !== "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", "La garantía solo puede activarse para servicios confirmados por el usuario.");
      }
      if (servicioData.garantiaSolicitada === true) {
        throw new functions.https.HttpsError("already-exists", "Ya se ha solicitado una garantía para este servicio.");
      }
      const warrantyEndDateString = servicioData.warrantyEndDate;
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString);
      const currentDate = new Date();
      warrantyEndDate.setHours(23, 59, 59, 999); 
      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      const nuevaSolicitudGarantiaRef = garantiasRef.doc();
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.Timestamp.now(),
        estadoGarantia: "pendiente",
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      functions.logger.info(`Garantía premium activada para servicio ${servicioId}. Garantía ID: ${nuevaSolicitudGarantiaRef.id}`);
      return {
        success: true,
        message: "Solicitud de garantía premium activada exitosamente.",
        garantiaId: nuevaSolicitudGarantiaRef.id,
        estadoGarantia: "pendiente",
      };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de activarGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al activar la garantía.", error.message);
  }
});

export const resolverGarantiaPremium = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando resolverGarantiaPremium", { structuredData: true, data });
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permisos para resolver garantías.");
  }

  const { garantiaId, decision, comentarioResolucion } = data;
  if (!garantiaId || typeof garantiaId !== "string" || !decision || (decision !== "aprobada" && decision !== "rechazada")) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'garantiaId' y una 'decision' válida ('aprobada' o 'rechazada').");
  }

  const garantiaRef = db.collection("garantias").doc(garantiaId);

  try {
    return await db.runTransaction(async (transaction) => {
      const garantiaDoc = await transaction.get(garantiaRef);
      if (!garantiaDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Solicitud de garantía con ID ${garantiaId} no encontrada.`);
      }
      const garantiaData = garantiaDoc.data() as GarantiaData;

      const validPreviousStates: GarantiaData["estadoGarantia"][] = ["pendiente", "en_revision"];
      if (!validPreviousStates.includes(garantiaData.estadoGarantia)) {
        throw new functions.https.HttpsError("failed-precondition", `La garantía ya ha sido resuelta o está en un estado inválido (${garantiaData.estadoGarantia}).`);
      }

      const updateGarantiaData: Partial<GarantiaData> = {
        estadoGarantia: decision,
        fechaResolucionGarantia: admin.firestore.Timestamp.now(),
        resolucionDetalles: comentarioResolucion || "",
        resueltaPor: context.auth?.uid,
      };
      transaction.update(garantiaRef, updateGarantiaData);

      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> = {
        garantiaResultado: decision,
        updatedAt: admin.firestore.Timestamp.now(),
      };
      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true;
        functions.logger.info(`Garantía ${garantiaId} aprobada. SIMULACIÓN: Iniciar proceso de compensación/reembolso para servicio ${garantiaData.servicioId}.`);
      } else { // rechazada
        servicioUpdateData.compensacionAutorizada = false;
      }
      transaction.update(servicioRef, servicioUpdateData);

      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      return { success: true, message: `Solicitud de garantía ${decision} exitosamente.` };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de resolverGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al resolver la garantía.", error.message);
  }
});

export const simulateDailyAutomatedChecks = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = admin.firestore.Timestamp.now();
    const sevenDaysAgo = new Date(now.toDate().getTime() - RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const serviciosRef = db.collection("servicios");
    const batch = db.batch();
    let processedCount = 0;

    // Caso 1: Liberar pagos de servicios completados por usuario sin reclamo ni calificación después de la ventana
    const queryPagosPendientes = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("fechaConfirmacion", "<=", admin.firestore.Timestamp.fromDate(sevenDaysAgo)); // Confirmado hace 7 días o más

    try {
      const snapshotPagos = await queryPagosPendientes.get();
      snapshotPagos.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        functions.logger.log(`[DailyCheck] Servicio para liberación de pago: ${doc.id}. Estado: ${servicio.estado}, Fecha Confirmación: ${servicio.fechaConfirmacion?.toDate()}`);
        
        // Doble chequeo implícito por la consulta, pero explícito no daña.
        if (servicio.estado === "completado_por_usuario" && servicio.paymentStatus === "retenido_para_liberacion") {
          functions.logger.info(`[DailyCheck] SIMULACIÓN: Liberando pago para proveedor ${servicio.prestadorId} del servicio ${doc.id}.`);
          batch.update(doc.ref, {
            paymentStatus: "liberado_al_proveedor",
            fechaLiberacionPago: now,
            estado: "cerrado_automaticamente",
            updatedAt: now,
          });
          processedCount++;
        }
      });
    } catch (error) {
      functions.logger.error("[DailyCheck] Error consultando servicios para liberación de pago automática:", error);
    }
    
    // Caso 2: Cerrar servicios ya calificados (mutualRatingCompleted) si el pago ya fue liberado (por ej. si hubo disputa resuelta)
    // y la ventana de calificación ya expiró (para asegurar consistencia del estado)
    const queryCalificados = serviciosRef
      .where("mutualRatingCompleted", "==", true)
      .where("estado", "in", ["completado_por_usuario", "cerrado_con_disputa_resuelta"]) // Estados donde pudo haber calificación
      .where("ratingWindowExpiresAt", "<=", now);
      
    try {
      const snapshotCalificados = await queryCalificados.get();
      snapshotCalificados.forEach(doc => {
        const servicio = doc.data() as ServiceData;
         functions.logger.log(`[DailyCheck] Servicio calificado para posible cierre final: ${doc.id}. Estado actual: ${servicio.estado}`);
        // Si ya está cerrado_con_calificacion, no hacer nada.
        // Si el pago está liberado, y el estado no es ya cerrado_con_calificacion, actualizarlo.
        if (servicio.estado !== "cerrado_con_calificacion" && servicio.paymentStatus === "liberado_al_proveedor") {
          batch.update(doc.ref, {
            estado: "cerrado_con_calificacion", // O mantener cerrado_con_disputa_resuelta si es el caso y es más específico.
            updatedAt: now,
          });
          processedCount++;
          functions.logger.info(`[DailyCheck] Servicio ${doc.id} calificado y con pago liberado, cambiando estado a cerrado_con_calificacion.`);
        } else if (servicio.paymentStatus === "retenido_para_liberacion" && servicio.estado === "cerrado_con_calificacion") {
            // Caso donde ambos calificaron, pero el pago aun no se liberó por la ventana.
            // Este caso es similar al "Caso 1" pero específico para cuando hay calificación mutua.
             functions.logger.info(`[DailyCheck] SIMULACIÓN: Liberando pago para proveedor ${servicio.prestadorId} del servicio ${doc.id} (calificado mutuamente, ventana expirada).`);
            batch.update(doc.ref, {
                paymentStatus: "liberado_al_proveedor",
                fechaLiberacionPago: now,
                updatedAt: now,
            });
            processedCount++;
        }
      });
    } catch (error) {
       functions.logger.error("[DailyCheck] Error consultando servicios calificados para cierre:", error);
    }


    if (processedCount > 0) {
      try {
        await batch.commit();
        functions.logger.info(`[DailyCheck] Lote de ${processedCount} actualizaciones de servicios completado.`);
      } catch (error) {
        functions.logger.error("[DailyCheck] Error al ejecutar el batch de actualizaciones diarias:", error);
      }
    } else {
      functions.logger.info("[DailyCheck] No se realizaron actualizaciones de servicios en este ciclo.");
    }
    return null;
  });

export const updateProviderRealtimeStatus = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando updateProviderRealtimeStatus", { structuredData: true, data });

  if (!context.auth) {
    functions.logger.error("Usuario no autenticado intentando actualizar estado.");
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const providerId = context.auth.uid;

  const { isAvailable, location } = data;

  if (typeof isAvailable !== "boolean") {
    functions.logger.error("El parámetro 'isAvailable' debe ser un booleano.", { isAvailable });
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el parámetro 'isAvailable' (booleano).");
  }

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();
  const updates: Partial<ProviderData> = {
    isAvailable: isAvailable,
    lastConnection: now,
  };

  if (isAvailable === true) {
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      functions.logger.error("Si 'isAvailable' es true, se requiere un objeto 'location' con 'lat' y 'lng' numéricos.", { location });
      throw new functions.https.HttpsError("invalid-argument", "Se requiere 'location' con 'lat' y 'lng' válidos cuando 'isAvailable' es true.");
    }
    updates.currentLocation = {
      lat: location.lat,
      lng: location.lng,
      timestamp: now,
    };
  } else {
    updates.currentLocation = null; // O admin.firestore.FieldValue.delete() para borrar el campo
  }

  try {
    await providerRef.set(updates, { merge: true });
    functions.logger.info(`Estado de prestador ${providerId} actualizado exitosamente a ${isAvailable ? "disponible" : "no disponible"}.`);
    return { success: true, message: `Estado actualizado a ${isAvailable ? "disponible" : "no disponible"}.` };
  } catch (error: any) {
    functions.logger.error(`Error al actualizar estado para prestador ${providerId}:`, error);
    throw new functions.https.HttpsError("internal", "Error al actualizar el estado del prestador.", error.message);
  }
});

export const disconnectProvider = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando disconnectProvider", { structuredData: true });

  if (!context.auth) {
    functions.logger.error("Usuario no autenticado intentando desconectarse.");
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const providerId = context.auth.uid;

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();

  const updates: Partial<ProviderData> = {
    isAvailable: false,
    currentLocation: null,
    lastConnection: now,
  };

  try {
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      functions.logger.warn(`Prestador ${providerId} no encontrado. Se creará perfil básico y se desconectará.`);
      await providerRef.set({
        uid: providerId,
        name: context.auth.token.name || `Prestador ${providerId.substring(0,5)}`,
        isAvailable: false,
        currentLocation: null,
        lastConnection: now,
        rating: 0,
        ratingCount: 0,
        ratingSum: 0,
        allowsHourlyServices: false,
      });
      return { success: true, message: "Perfil no encontrado, se creó y desconectó." };
    }
    await providerRef.update(updates);
    functions.logger.info(`Prestador ${providerId} desconectado y ubicación borrada.`);
    return { success: true, message: "Te has desconectado exitosamente." };
  } catch (error: any) {
    functions.logger.error(`Error al desconectar al prestador ${providerId}:`, error);
    throw new functions.https.HttpsError("internal", "Error al desconectar al prestador.", error.message);
  }
});

export const verificarEstadoFunciones = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando verificarEstadoFunciones", { structuredData: true });

  const NOMBRES_FUNCIONES_ESPERADAS = [
    "confirmServiceCompletionByUserService",
    "calificarPrestador",
    "calificarUsuario",
    "reportServiceIssue",
    "obtenerServiciosCompletados",
    "registrarDocumentoProfesional",
    "verificarDocumentoProfesional", // Renombrado de validateDocumentAndRemoveContactInfo
    "activarGarantiaPremium",
    "resolverGarantiaPremium",
    "simulateDailyAutomatedChecks",
    "updateProviderRealtimeStatus",
    "disconnectProvider",
    "agendarCita",
    "cancelarCita",
    "confirmarCitaPorPrestador",
    "procesarCobroTrasConfirmacion",
    "verificarEstadoFunciones",
    "reportarProblemaServicio", // alias de reportServiceIssue (considerar unificar)
    "crearNotificacion", // Nueva función
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";
    if (!presenteEnCodigo && nombreFuncion !== "simulateDailyAutomatedChecks") {
      todasLasFuncionesCriticasPresentes = false;
    }
    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada),
      esPubSub: nombreFuncion === "simulateDailyAutomatedChecks",
      estadoDespliegueSimulado: presenteEnCodigo ? "Asumido Habilitada si Presente en código y desplegada" : "Ausente en Código",
      ultimaActualizacionSimulada: "N/D (Consultar en GCP Console)",
      erroresDetectadosSimulado: "N/D (Revisar Cloud Logging y GCP Console)",
    });
    functions.logger.log(`Función '${nombreFuncion}': ${presenteEnCodigo ? 'Presente y exportada' : 'No encontrada o no exportada'}`);
  }

  const resultadoConsolidado = {
    mensaje: "Verificación de estado de funciones completada (basada en exportaciones de código).",
    todasLasFuncionesCriticasPresentes: todasLasFuncionesCriticasPresentes,
    detallePorFuncion: estadoFunciones,
    timestampVerificacion: admin.firestore.Timestamp.now(),
  };

  functions.logger.info("Resultado de la verificación:", resultadoConsolidado);
  return resultadoConsolidado;
});

export const agendarCita = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando agendarCita", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para agendar una cita.");
  }
  const usuarioId = context.auth.uid;
  const {
    prestadorId,
    fechaSolicitada, // YYYY-MM-DD
    horaSolicitada,   // HH:MM
    detallesServicio,
    ubicacion,
    notasAdicionales,
    serviceType,
    precioServicio,
    tarifaPorHora,
    duracionHoras,
  } = data;

  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !detallesServicio || !serviceType) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos (prestadorId, fechaSolicitada, horaSolicitada, detallesServicio, serviceType).");
  }
  if (serviceType === "fixed" && typeof precioServicio !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'precioServicio' para citas de tipo 'fixed'.");
  }
  if (serviceType === "hourly" && (typeof tarifaPorHora !== "number" || typeof duracionHoras !== "number" || duracionHoras <= 0)) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tarifaPorHora' y 'duracionHoras' válidas para citas de tipo 'hourly'.");
  }

  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  const regexHora = /^\d{2}:\d{2}$/;
  if (!regexFecha.test(fechaSolicitada) || !regexHora.test(horaSolicitada)) {
    throw new functions.https.HttpsError("invalid-argument", "Formato de fecha (YYYY-MM-DD) u hora (HH:MM) inválido.");
  }

  let fechaHoraSolicitadaConvertida: admin.firestore.Timestamp;
  try {
    const [year, month, day] = fechaSolicitada.split("-").map(Number);
    const [hour, minute] = horaSolicitada.split(":").map(Number);
    const dateObject = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (isNaN(dateObject.getTime())) {
      throw new Error("Fecha u hora inválida después de la conversión.");
    }
    const nowUtc = new Date(new Date().toISOString().slice(0, -1));
    if (dateObject < nowUtc) {
      throw new functions.https.HttpsError("invalid-argument", "No puedes agendar una cita en una fecha u hora pasada.");
    }
    fechaHoraSolicitadaConvertida = admin.firestore.Timestamp.fromDate(dateObject);
  } catch (e: any) {
    functions.logger.error("Error al convertir fecha/hora:", e.message);
    throw new functions.https.HttpsError("invalid-argument", `Error procesando fecha y hora: ${e.message}`);
  }

  const citasRef = db.collection("citas");

  try {
    const conflictoQuery = citasRef
      .where("prestadorId", "==", prestadorId)
      .where("fechaHoraSolicitada", "==", fechaHoraSolicitadaConvertida)
      .where("estado", "in", ["pendiente_confirmacion", "confirmada_prestador", "pagada", "servicio_iniciado", "en_camino_proveedor"]);

    const conflictoSnapshot = await conflictoQuery.get();
    if (!conflictoSnapshot.empty) {
      functions.logger.warn(`Conflicto de horario para prestador ${prestadorId} en ${fechaSolicitada} ${horaSolicitada}.`);
      throw new functions.https.HttpsError("failed-precondition", "El prestador ya tiene una cita agendada o confirmada en este horario. Por favor, elige otro.");
    }

    let montoTotalEstimado = 0;
    if (serviceType === "fixed") {
      montoTotalEstimado = precioServicio as number;
    } else if (serviceType === "hourly") {
      montoTotalEstimado = (tarifaPorHora as number) * (duracionHoras as number);
    }

    const nuevaCitaData: Partial<CitaData> = {
      usuarioId: usuarioId,
      prestadorId: prestadorId,
      fechaHoraSolicitada: fechaHoraSolicitadaConvertida,
      detallesServicio: detallesServicio,
      estado: "pendiente_confirmacion",
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      serviceType: serviceType,
      montoTotalEstimado: montoTotalEstimado,
    };

    if (serviceType === "fixed") {
      nuevaCitaData.precioServicio = precioServicio;
    } else { // hourly
      nuevaCitaData.tarifaPorHora = tarifaPorHora;
      nuevaCitaData.duracionHoras = duracionHoras;
    }

    if (ubicacion) nuevaCitaData.ubicacion = ubicacion;
    if (notasAdicionales) nuevaCitaData.notasAdicionales = notasAdicionales;

    const citaRef = await citasRef.add(nuevaCitaData);
    functions.logger.info(`Cita agendada con ID: ${citaRef.id} por usuario ${usuarioId} para prestador ${prestadorId}.`);
    functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${prestadorId} sobre la nueva cita ${citaRef.id}.`);

    return { success: true, message: "Cita agendada exitosamente. Esperando confirmación del prestador.", citaId: citaRef.id };
  } catch (error: any) {
    functions.logger.error("Error al agendar cita:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al agendar la cita.", error.message);
  }
});

export const cancelarCita = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando cancelarCita", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para cancelar una cita.");
  }
  const canceladorId = context.auth.uid;
  const { citaId, rol } = data; // rol: "usuario" o "prestador"

  if (!citaId || typeof citaId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'citaId'.");
  }
  if (!rol || (rol !== "usuario" && rol !== "prestador")) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere un 'rol' válido ('usuario' o 'prestador').");
  }

  const citaRef = db.collection("citas").doc(citaId);

  try {
    await db.runTransaction(async (transaction) => {
      const citaDoc = await transaction.get(citaRef);
      if (!citaDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Cita con ID ${citaId} no encontrada.`);
      }
      const citaData = citaDoc.data() as CitaData;

      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden cancelar citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}`);
      }

      let nuevoEstado: CitaEstado;

      if (rol === "usuario" && citaData.usuarioId === canceladorId) {
        nuevoEstado = "cancelada_usuario";
      } else if (rol === "prestador" && citaData.prestadorId === canceladorId) {
        nuevoEstado = "cancelada_prestador";
      } else {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita con el rol especificado o no eres el propietario/prestador asignado.");
      }
      
      transaction.update(citaRef, {
        estado: nuevoEstado,
        fechaCancelacion: admin.firestore.FieldValue.serverTimestamp(),
        canceladaPor: canceladorId,
        rolCancelador: rol,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Cita ${citaId} cancelada por ${rol} ${canceladorId}.`);
      if (rol === "usuario") {
        functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${citaData.prestadorId} sobre la cancelación de la cita ${citaId} por el usuario.`);
      } else { // rol === "prestador"
        functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la cancelación de la cita ${citaId} por el prestador.`);
      }
    });
    return { success: true, message: "Cita cancelada exitosamente." };
  } catch (error: any) {
    functions.logger.error("Error en la transacción de cancelarCita:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al cancelar la cita.", error.message);
  }
});


export const confirmarCitaPorPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando confirmarCitaPorPrestador", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para confirmar una cita (prestador).");
  }
  const prestadorIdAutenticado = context.auth.uid;
  const { citaId } = data;

  if (!citaId || typeof citaId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'citaId'.");
  }

  const citaRef = db.collection("citas").doc(citaId);

  try {
    await db.runTransaction(async (transaction) => {
      const citaDoc = await transaction.get(citaRef);
      if (!citaDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Cita con ID ${citaId} no encontrada.`);
      }
      const citaData = citaDoc.data() as CitaData;

      if (citaData.prestadorId !== prestadorIdAutenticado) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para confirmar esta cita. No corresponde a tu ID de prestador.");
      }
      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden confirmar citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}.`);
      }

      const ordenCobroIdSimulada = `orden_${citaId}_${Date.now()}`;
      functions.logger.info(`SIMULACIÓN: Generando orden de cobro para cita ${citaId}. ID Orden: ${ordenCobroIdSimulada}. Usuario a cobrar: ${citaData.usuarioId}. Monto estimado: ${citaData.montoTotalEstimado}`);
      
      transaction.update(citaRef, {
        estado: "confirmada_prestador",
        paymentStatus: "pendiente_cobro",
        fechaConfirmacionPrestador: admin.firestore.FieldValue.serverTimestamp(),
        ordenCobroId: ordenCobroIdSimulada,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Cita ${citaId} confirmada por prestador ${prestadorIdAutenticado}. Usuario a notificar: ${citaData.usuarioId}. PaymentStatus: pendiente_cobro.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la confirmación de la cita ${citaId} y que el cobro se procesará.`);
    });

    return { success: true, message: "Cita confirmada exitosamente. El cobro al usuario está pendiente de procesamiento." };
  } catch (error: any) {
    functions.logger.error("Error en la transacción de confirmarCitaPorPrestador:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al confirmar la cita.", error.message);
  }
});

export const procesarCobroTrasConfirmacion = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando procesarCobroTrasConfirmacion", { structuredData: true, data });

  if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (o sistema).");
  }

  const { citaId } = data;
  if (!citaId || typeof citaId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'citaId'.");
  }

  const citaRef = db.collection("citas").doc(citaId);

  try {
    return await db.runTransaction(async (transaction) => {
      const citaDoc = await transaction.get(citaRef);
      if (!citaDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Cita con ID ${citaId} no encontrada.`);
      }
      const citaData = citaDoc.data() as CitaData;

      if (citaData.estado !== "confirmada_prestador") {
        throw new functions.https.HttpsError("failed-precondition", `La cita no está en estado 'confirmada_prestador'. Estado actual: ${citaData.estado}.`);
      }
      if (citaData.paymentStatus !== "pendiente_cobro") {
        throw new functions.https.HttpsError("failed-precondition", `El estado del pago no es 'pendiente_cobro'. Estado actual: ${citaData.paymentStatus}.`);
      }
      if (typeof citaData.montoTotalEstimado !== "number" || citaData.montoTotalEstimado <= 0) {
        functions.logger.error(`Monto total estimado inválido para cita ${citaId}: ${citaData.montoTotalEstimado}`);
        throw new functions.https.HttpsError("internal", "Monto total estimado inválido para la cita.");
      }

      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Iniciando cobro para cita ${citaId}, Orden ID: ${citaData.ordenCobroId}, Monto: ${citaData.montoTotalEstimado}.`);
      
      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} procesado exitosamente.`);
      
      transaction.update(citaRef, {
        estado: "pagada",
        paymentStatus: "procesado_exitosamente",
        fechaCobro: admin.firestore.Timestamp.now(),
        montoCobrado: citaData.montoTotalEstimado,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      
      functions.logger.warn(`[ProcesarCobro] SIMULACIÓN: Notificar a usuario ${citaData.usuarioId} y prestador ${citaData.prestadorId} sobre pago exitoso para cita ${citaId}.`);

      return { success: true, message: `Cobro para la cita ${citaId} procesado exitosamente. El servicio está ahora en estado 'pagada'.` };
    });
  } catch (error: any) {
    functions.logger.error(`Error en la transacción de procesarCobroTrasConfirmacion para cita ${citaId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al procesar el cobro de la cita.", error.message);
  }
});

export const reportarProblemaServicio = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando reportarProblemaServicio", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo, urlEvidencia } = data;

  if (!servicioId || typeof servicioId !== "string" || !motivo || typeof motivo !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo' válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `El servicio con ID ${servicioId} no fue encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.usuarioId !== usuarioId) {
        throw new functions.https.HttpsError("permission-denied", "No estás autorizado para reportar un problema sobre este servicio.");
      }
      if (servicioData.estado !== "completado_por_usuario") {
         throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios que hayas confirmado ('completado_por_usuario'). Estado actual: ${servicioData.estado}`);
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") {
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      const reporteId = db.collection("reportes").doc().id; // Generar ID para el reporte

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa",
        detallesDisputa: {
          reportadoEn: now,
          detalle: motivo, // Usamos 'motivo' como el 'detalleProblema'
          reporteId: reporteId,
        },
        updatedAt: now,
      });

      const datosReporte: any = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaReporte: now,
        estado: "pendiente",
      };
      if (urlEvidencia) {
        datosReporte.urlEvidencia = urlEvidencia;
      }
      transaction.set(db.collection("reportes").doc(reporteId), datosReporte);

      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteId}. Pago congelado.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${servicioData.prestadorId} y al admin sobre la disputa del servicio ${servicioId}.`);

      return {
        success: true,
        message: "Problema reportado exitosamente. El servicio está ahora en disputa y el pago ha sido congelado.",
        reporteId: reporteId,
      };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de reportarProblemaServicio:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al reportar el problema.", error.message);
  }
});


export const crearNotificacion = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando crearNotificacion", { structuredData: true, data });

  // Opcional: Validar si el llamador tiene permisos para crear notificaciones,
  // o si es una función interna del backend, esta validación podría ser diferente.
  // if (!context.auth) {
  //   throw new functions.https.HttpsError("unauthenticated", "Se requiere autenticación para crear una notificación.");
  // }

  const {
    destinatarioId,
    rolDestinatario,
    titulo,
    cuerpo,
    tipoNotificacion,
    prioridad, // Opcional, default a 'normal'
    datosAdicionales, // Opcional
  } = data;

  if (!destinatarioId || !rolDestinatario || !titulo || !cuerpo || !tipoNotificacion) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Faltan parámetros requeridos: destinatarioId, rolDestinatario, titulo, cuerpo, tipoNotificacion."
    );
  }

  if (rolDestinatario !== "usuario" && rolDestinatario !== "prestador") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "El campo 'rolDestinatario' debe ser 'usuario' o 'prestador'."
    );
  }

  const prioridadValida = prioridad === "alta" || prioridad === "normal" ? prioridad : "normal";

  const nuevaNotificacion: Omit<NotificacionData, "id" | "fechaCreacion"> = {
    destinatarioId: destinatarioId,
    rolDestinatario: rolDestinatario,
    titulo: titulo,
    cuerpo: cuerpo,
    estadoNotificacion: "pendiente",
    tipoNotificacion: tipoNotificacion,
    prioridad: prioridadValida,
    ...(datosAdicionales && { datosAdicionales: datosAdicionales }),
  };

  try {
    const notificacionRef = await db.collection("notificaciones").add({
      ...nuevaNotificacion,
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.info(`Notificación creada con ID: ${notificacionRef.id} para ${rolDestinatario} ${destinatarioId}`);
    
    // Aquí, en un futuro, podrías añadir la lógica para enviar Push Notifications (FCM)
    // o correos electrónicos basados en esta notificación.
    // Ejemplo:
    // if (prioridadValida === 'alta') {
    //   await enviarPushNotification(destinatarioId, titulo, cuerpo);
    // }

    return {
      success: true,
      message: "Notificación registrada exitosamente.",
      notificacionId: notificacionRef.id,
    };
  } catch (error: any) {
    functions.logger.error("Error al crear la notificación en Firestore:", error);
    throw new functions.https.HttpsError("internal", "No se pudo registrar la notificación.", error.message);
  }
});

// ... (resto de las funciones existentes sin cambios)
