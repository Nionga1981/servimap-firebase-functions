
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
  | "agendado" // Solicitud de servicio/cita creada por el usuario, pendiente de confirmación del proveedor
  | "pendiente_confirmacion" // Alias para cita agendada, pendiente de confirmación del prestador
  | "confirmada_prestador" // Prestador ha confirmado la cita/servicio
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador" // Prestador marca como completado
  | "completado_por_usuario" // Usuario confirma finalización
  | "cancelado_usuario"
  | "cancelada_usuario" // Para citas
  | "cancelado_proveedor"
  | "cancelada_prestador" // Para citas
  | "rechazada_prestador" // Para citas
  | "en_disputa"
  | "cerrado_automaticamente" // Cerrado por sistema tras ventana de calificación/disputa
  | "cerrado_con_calificacion" // Calificación mutua o una parte calificó y expiró ventana
  | "cerrado_con_disputa_resuelta";

type CitaEstado = ServiceRequestStatus; // Reutilizamos los estados

type PaymentStatus =
  | "pendiente_confirmacion_usuario"
  | "retenido_para_liberacion"
  | "liberado_al_proveedor"
  | "congelado_por_disputa"
  | "reembolsado_parcial"
  | "reembolsado_total"
  | "no_aplica"; // Para citas que aún no llegan al punto de pago

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
  fechaSolicitud: admin.firestore.Timestamp; // Fecha de creación de la solicitud de servicio
  updatedAt?: admin.firestore.Timestamp;

  // Campos para servicios/citas agendadas
  fechaServicio?: admin.firestore.Timestamp; // Fecha y hora del servicio agendado
  detallesServicio?: string;
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;

  // Flujo de finalización y calificación
  fechaConfirmacionPrestador?: admin.firestore.Timestamp; // Cuando el prestador marca completado
  fechaConfirmacion?: admin.firestore.Timestamp; // Cuando el usuario confirma completado (anteriormente userConfirmedCompletionAt)
  habilitarCalificacion?: boolean;
  ratingWindowExpiresAt?: admin.firestore.Timestamp; // Ventana para calificar/disputar
  calificacionUsuario?: RatingData; // Calificación del usuario al prestador
  calificacionPrestador?: RatingData; // Calificación del prestador al usuario
  mutualRatingCompleted?: boolean;

  // Pagos
  paymentStatus?: PaymentStatus;
  fechaLiberacionPago?: admin.firestore.Timestamp;
  ordenCobroId?: string; // ID de la orden de cobro o PaymentIntent

  // Garantía
  warrantyEndDate?: string; // YYYY-MM-DD
  garantiaSolicitada?: boolean;
  idSolicitudGarantia?: string;
  garantiaResultado?: "aprobada" | "rechazada";
  compensacionAutorizada?: boolean;

  // Disputas
  detallesDisputa?: {
    reportadoEn: admin.firestore.Timestamp;
    detalle: string;
    // Podríamos añadir más campos aquí como estadoDisputa, resueltaPor, etc.
  };
  [key: string]: any;
}

interface ProviderData {
  uid?: string;
  name?: string;
  ratingSum?: number; // Suma de todas las calificaciones recibidas
  ratingCount?: number; // Número total de calificaciones recibidas
  rating?: number; // Promedio: ratingSum / ratingCount
  documentosVerificables?: DocumentoVerificable[];
  isAvailable?: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: admin.firestore.Timestamp;
  } | null;
  lastConnection?: admin.firestore.Timestamp;
  // Campos para servicios por hora
  allowsHourlyServices?: boolean;
  hourlyRate?: number;
}

interface UserData {
  uid?: string;
  name?: string;
  ratingSumUsuario?: number; // Suma de calificaciones recibidas por el usuario
  ratingCountUsuario?: number; // Número de calificaciones recibidas por el usuario
  ratingUsuario?: number; // Promedio del usuario
  isPremium?: boolean;
  // Otros campos del perfil de usuario
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
  servicioId: string; // ID del documento en la colección 'servicios'
  usuarioId: string;
  prestadorId: string;
  motivo: string;
  fechaSolicitudGarantia: admin.firestore.Timestamp;
  estadoGarantia: "pendiente" | "en_revision" | "aprobada" | "rechazada";
  fechaResolucionGarantia?: admin.firestore.Timestamp;
  resolucionDetalles?: string;
  resueltaPor?: string; // UID del admin/moderador
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
  ordenCobroId?: string; // Para simular la referencia a una orden de pago
}


// --- FUNCIONES EXISTENTES (Resumidas para brevedad, sin cambios internos) ---

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

      if (servicioData.estado !== "completado_por_prestador" && servicioData.estado !== "confirmada_prestador" && servicioData.estado !== "servicio_iniciado") {
        functions.logger.warn(`Intento de confirmar servicio ${servicioId} en estado inválido. Estado actual: ${servicioData.estado}`);
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Debe ser 'completado_por_prestador', 'confirmada_prestador' o 'servicio_iniciado'.`);
      }

      const now = admin.firestore.Timestamp.now();
      const ratingAndDisputeWindowEndDate = new Date(now.toDate().getTime() + RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(ratingAndDisputeWindowEndDate);

      const userDocRef = db.collection("usuarios").doc(userId);
      const userDoc = await transaction.get(userDocRef);
      const userIsPremium = userDoc.exists ? (userDoc.data() as UserData)?.isPremium === true : false;

      let warrantyDays = STANDARD_WARRANTY_DAYS;
      if (userIsPremium) {
        warrantyDays = PREMIUM_WARRANTY_DAYS;
      }
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now, // Campo principal para fecha de confirmación por el usuario
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

      const prestadorRef = db.collection("prestadores").doc(servicioData.prestadorId);
      const prestadorDoc = await transaction.get(prestadorRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;

      if (prestadorDoc.exists) {
        const prestadorData = prestadorDoc.data() as ProviderData;
        newRatingSum = (prestadorData.ratingSum || 0) + calificacion;
        newRatingCount = (prestadorData.ratingCount || 0) + 1;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(prestadorRef, {
        ratingSum: newRatingSum,
        ratingCount: newRatingCount,
        rating: currentRating,
        // Si el documento no existe, también se pueden establecer otros campos por defecto aquí
        name: prestadorDoc.exists ? (prestadorDoc.data() as ProviderData).name : `Prestador ${servicioData.prestadorId.substring(0,5)}`,
        uid: servicioData.prestadorId,
      }, { merge: true });

      let servicioUpdate: Partial<ServiceData> = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.Timestamp.now(),
      };
      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
        servicioUpdate.estado = "cerrado_con_calificacion";
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
        throw new functions.https.HttpsError("failed-precondition", "La calificación mutua para este servicio no está habilitada (el usuario debe confirmar primero).");
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

      const usuarioRef = db.collection("usuarios").doc(servicioData.usuarioId);
      const usuarioDoc = await transaction.get(usuarioRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(usuarioRef, {
        uid: servicioData.usuarioId, // Asegurar que el uid se guarde si es un nuevo documento
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: currentRating,
        lastRatedByProviderAt: admin.firestore.Timestamp.now(),
        name: usuarioDoc.exists ? (usuarioDoc.data() as UserData).name : `Usuario ${servicioData.usuarioId.substring(0,5)}`,
      }, { merge: true });

      let servicioUpdate: Partial<ServiceData> = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.Timestamp.now(),
      };
      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        servicioUpdate.estado = "cerrado_con_calificacion";
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
  if (urlEvidencia && typeof urlEvidencia !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'urlEvidencia' debe ser un string válido si se proporciona.");
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
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios cuyo estado sea 'completado_por_usuario'. Estado actual: ${servicioData.estado}`);
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") { // Ya existe un reporte activo
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa", // Congelar el pago
        detallesDisputa: {
          reportadoEn: now,
          detalle: motivo,
        },
        updatedAt: now,
      });

      // Crear documento en la colección "reportes" (o "reclamos")
      const reporteData: any = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo, // El motivo original del reporte
        fechaReporte: now,
        estado: "pendiente", // Estado inicial del reporte
      };
      if (urlEvidencia) {
        reporteData.urlEvidencia = urlEvidencia;
      }
      const reporteRef = await db.collection("reportes").add(reporteData); // Usar "reportes" como nombre de colección

      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteRef.id}. Pago congelado.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${servicioData.prestadorId} sobre la disputa del servicio ${servicioId}.`);

      return {
        success: true,
        message: "Problema reportado exitosamente. El servicio está ahora en disputa y el pago ha sido congelado.",
        reporteId: reporteRef.id,
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

export const obtenerServiciosCompletados = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando obtenerServiciosCompletados", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;

  try {
    const querySnapshot = await db
      .collection("servicios")
      .where("usuarioId", "==", usuarioId)
      .where("estado", "==", "completado_por_usuario")
      .orderBy("fechaConfirmacion", "desc") // Usar fechaConfirmacion
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = []; // Usar Partial para flexibilidad
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id,
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion,
        // Puedes añadir otros campos que quieras devolver, por ejemplo:
        // detallesServicio: servicio.detallesServicio,
        // totalEstimado: servicio.totalEstimado, // Si es relevante para esta vista
        // calificacionUsuario: servicio.calificacionUsuario,
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
  if (descripcion && typeof descripcion !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "La 'descripcion' debe ser un string.");
  }

  const prestadorRef = db.collection("prestadores").doc(prestadorId);

  const nuevoDocumento: DocumentoVerificable = {
    tipoDocumento: tipoDocumento,
    urlDocumento: urlDocumento,
    descripcion: descripcion || "",
    fechaRegistro: admin.firestore.Timestamp.now(),
    estadoVerificacion: "pendiente", // Estado inicial
  };

  try {
    await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        // Si el prestador no existe, podríamos crearlo con este documento o lanzar un error.
        // Por ahora, asumimos que el prestador se crea en otro flujo, o lo creamos aquí.
        functions.logger.info(`Documento del prestador ${prestadorId} no encontrado, creando uno nuevo.`);
        transaction.set(prestadorRef, { documentosVerificables: [nuevoDocumento], uid: prestadorId /* otros campos por defecto */ });
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

export const validateDocumentAndRemoveContactInfo = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo", { structuredData: true, data });

  // Verificación de roles (admin o moderador)
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Asume que tienes estos custom claims
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
      // Asegurar que documentosVerificables sea un array, incluso si está vacío o no existe
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : [];


      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];

      // Permitir re-verificación si fue rechazado por IA, o si está pendiente
      if (documentoAVerificar.estadoVerificacion !== "pendiente" && documentoAVerificar.estadoVerificacion !== "rechazado_ia" && documentoAVerificar.estadoVerificacion !== "Rechazado por datos sensibles detectados") {
        functions.logger.warn(`Documento ${documentoIndex} para ${prestadorId} no está en estado 'pendiente' o 'rechazado_ia'. Estado actual: ${documentoAVerificar.estadoVerificacion}`);
        // Podrías lanzar un error aquí si no quieres permitir re-verificación de otros estados.
        // throw new functions.https.HttpsError("failed-precondition", `El documento no puede ser verificado. Estado actual: ${documentoAVerificar.estadoVerificacion}`);
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
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia"; // O un estado más genérico de error de sistema
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError);
      }

      // Combinar descripción, tipo de documento y texto extraído para el análisis
      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      // Regex para teléfonos (considerando +52 y variaciones de 10 dígitos)
      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(?\d{2,3}\)?\s?)?(?:[ -]?\d){7,10}/g;
      const phoneMatches = textoParaAnalizar.match(phoneRegex);
      if (phoneMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...phoneMatches.map((m) => `Teléfono: ${m.trim()}`));
      }

      // Regex para emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatches = textoParaAnalizar.match(emailRegex);
      if (emailMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...emailMatches.map((m) => `Email: ${m.trim()}`));
      }

      // Búsqueda de palabras clave prohibidas (direcciones, etc.)
      // Evitar añadir duplicados si ya fueron detectados por regex de teléfono/email
      for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
        if (textoParaAnalizar.includes(palabra.toLowerCase())) {
          // Verificamos que no esté ya incluida por las regex de teléfono o email
          if (!phoneMatches?.some((pm) => pm.includes(palabra)) && !emailMatches?.some((em) => em.includes(palabra))) {
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
        documentos[documentoIndex].palabrasClaveDetectadasIA = palabrasDetectadas; // Guardar palabras detectadas
        mensajeRespuesta = "Rechazado: Se detectaron datos de contacto en el documento.";
      } else {
        nuevoEstado = "Validado"; // Estado de validación exitosa por IA
        documentos[documentoIndex].motivoRechazoIA = undefined; // Limpiar motivo de rechazo previo
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined; // Limpiar palabras detectadas previas
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
      }
      documentos[documentoIndex].estadoVerificacion = nuevoEstado;

      transaction.update(prestadorRef, { documentosVerificables: documentos });

      // Registrar la verificación en una colección de logs
      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl: urlDocumento,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentos[documentoIndex].fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length, // Para tener una idea del tamaño del texto
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [],
        agenteVerificador: context.auth?.uid || "sistema_ia_callable", // Quién llamó a la función
      });

      functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} actualizado a estado: ${nuevoEstado}.`);
      return { success: true, message: mensajeRespuesta, newState: nuevoEstado, palabrasDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [] };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de validateDocumentAndRemoveContactInfo:", error);
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
  // Verificar si el usuario es premium usando custom claims
  if (context.auth.token.premium !== true) {
    throw new functions.https.HttpsError("permission-denied", "Esta función es solo para usuarios premium.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo } = data;

  if (!servicioId || typeof servicioId !== "string" || !motivo || typeof motivo !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo' válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const garantiasRef = db.collection("garantias"); // Referencia a la colección 'garantias'

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
      // El usuario debe haber confirmado la finalización del servicio
      if (servicioData.estado !== "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", "La garantía solo puede activarse para servicios confirmados por el usuario.");
      }
      if (servicioData.garantiaSolicitada === true) {
        throw new functions.https.HttpsError("already-exists", "Ya se ha solicitado una garantía para este servicio.");
      }

      // Verificar que la fecha actual esté dentro del período de garantía
      const warrantyEndDateString = servicioData.warrantyEndDate;
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString);
      const currentDate = new Date();
      warrantyEndDate.setHours(23, 59, 59, 999); // Asegurar que cubra todo el día

      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      // Crear nuevo documento en 'garantias'
      const nuevaSolicitudGarantiaRef = garantiasRef.doc(); // Genera un ID automático
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.Timestamp.now(),
        estadoGarantia: "pendiente",
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      // Actualizar el servicio original
      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id, // Guardar el ID de la solicitud de garantía
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
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  // Verificar rol de admin o moderador
  if (!(context.auth.token.admin === true || context.auth.token.moderador === true)) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permisos para resolver garantías.");
  }

  const { garantiaId, decision, comentarioResolucion } = data; // decision: 'aprobada' o 'rechazada'
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

      if (garantiaData.estadoGarantia !== "pendiente" && garantiaData.estadoGarantia !== "en_revision") {
        throw new functions.https.HttpsError("failed-precondition", `La garantía ya ha sido resuelta o está en un estado inválido (${garantiaData.estadoGarantia}).`);
      }

      const updateGarantiaData: Partial<GarantiaData> = {
        estadoGarantia: decision,
        fechaResolucionGarantia: admin.firestore.Timestamp.now(),
        resolucionDetalles: comentarioResolucion || "",
        resueltaPor: context.auth?.uid, // UID del admin/moderador
      };
      transaction.update(garantiaRef, updateGarantiaData);

      // Actualizar el servicio original
      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> = {
        garantiaResultado: decision,
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true; // O la lógica de compensación que definas
        // Aquí podrías interactuar con el sistema de pagos para iniciar un reembolso parcial/total si es necesario.
        functions.logger.info(`Garantía ${garantiaId} aprobada. SIMULACIÓN: Iniciar proceso de compensación/reembolso para servicio ${garantiaData.servicioId}.`);
      } else { // rechazada
        servicioUpdateData.compensacionAutorizada = false;
        // Si la garantía es rechazada y el pago estaba congelado por una disputa relacionada,
        // se podría considerar volver a 'retenido_para_liberacion' si la disputa original se resuelve
        // o si la garantía era el único motivo del bloqueo.
        // Esto depende de cómo se relacione el flujo de disputas con el de garantías.
        // Por ahora, solo actualizamos el resultado de la garantía.
        const servicioDoc = await transaction.get(servicioRef);
        if (servicioDoc.exists) {
          const servicioDataOriginal = servicioDoc.data() as ServiceData;
          // Si el pago estaba congelado (podría ser por esta garantía o una disputa previa)
          // y la garantía es rechazada, ¿qué hacemos con el pago?
          // Podríamos volver a 'retenido_para_liberacion' si la disputa se cierra con esto.
          // O si el estado era 'en_disputa' y la garantía rechazada cierra esa disputa.
          if (servicioDataOriginal.paymentStatus === "congelado_por_disputa") {
            // Esta lógica es compleja y depende del flujo general de disputas
            // Por ahora, un ejemplo simple:
            // servicioUpdateData.paymentStatus = "retenido_para_liberacion";
            if (servicioDataOriginal.estado === "en_disputa") {
                // servicioUpdateData.estado = "cerrado_con_disputa_resuelta"; // Asumiendo que esto resuelve la disputa
            }
          }
        }
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
  // .timeZone("America/Mexico_City") // Opcional: Especificar zona horaria
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = admin.firestore.Timestamp.now();
    const sevenDaysAgo = admin.firestore.Timestamp.fromDate(
      new Date(now.toDate().getTime() - RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    );

    const serviciosRef = db.collection("servicios");
    const batch = db.batch();
    let processedCount = 0;

    // Caso 1: Servicios completados por usuario, pago retenido, y ha pasado la ventana de 7 días sin acción
    const queryPagosPendientes = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("fechaConfirmacion", "<=", sevenDaysAgo); // fechaConfirmacion es cuando el usuario confirmó

    try {
      const snapshotPagos = await queryPagosPendientes.get();
      snapshotPagos.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        functions.logger.log(`Revisando servicio ID: ${doc.id} para posible liberación de pago automática.`);
        // Adicionalmente, nos aseguramos que no esté en disputa aunque el estado principal sea 'completado_por_usuario'
        if (servicio.estado !== "en_disputa") {
          functions.logger.info(`SIMULACIÓN: Liberando pago para el proveedor ${servicio.prestadorId} del servicio ${doc.id}.`);
          batch.update(doc.ref, {
            paymentStatus: "liberado_al_proveedor",
            fechaLiberacionPago: now,
            estado: "cerrado_automaticamente", // Cerrado automáticamente
            updatedAt: now,
          });
          processedCount++;
        }
      });
    } catch (error) {
      functions.logger.error("Error consultando servicios para liberación de pago:", error);
    }

    // Caso 2: Servicios que fueron calificados por una o ambas partes, el pago está retenido, y la ventana de calificación expiró.
    // Esto es para asegurar que los pagos se liberen si, por ejemplo, solo una parte calificó y la otra no lo hizo antes de que expirara la ventana.
    const queryCalificadosVentanaExpirada = serviciosRef
      .where("estado", "==", "cerrado_con_calificacion") // Ya tiene al menos una calificación
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("ratingWindowExpiresAt", "<=", now); // La ventana de calificación ha expirado

    try {
        const snapshotCalificados = await queryCalificadosVentanaExpirada.get();
        snapshotCalificados.forEach((doc) => {
            const servicio = doc.data() as ServiceData;
            functions.logger.log(`Revisando servicio calificado ID: ${doc.id} para liberación de pago post-ventana.`);
             if (servicio.estado !== "en_disputa") { // Doble chequeo
                functions.logger.info(`SIMULACIÓN: Liberando pago para el proveedor ${servicio.prestadorId} del servicio calificado ${doc.id} (ventana expirada).`);
                batch.update(doc.ref, {
                    paymentStatus: "liberado_al_proveedor",
                    fechaLiberacionPago: now,
                    // El estado ya es "cerrado_con_calificacion", no se cambia
                    updatedAt: now,
                });
                processedCount++;
            }
        });
    } catch (error) {
        functions.logger.error("Error consultando servicios calificados para liberación de pago:", error);
    }


    if (processedCount > 0) {
      try {
        await batch.commit();
        functions.logger.info(`Lote de ${processedCount} actualizaciones de liberación de pago/cierre completado.`);
      } catch (error) {
        functions.logger.error("Error al ejecutar el batch de liberación de pago:", error);
      }
    } else {
      functions.logger.info("No se realizaron actualizaciones de liberación de pago en este ciclo.");
    }
    return null;
  });

export const updateProviderRealtimeStatus = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando updateProviderRealtimeStatus", { structuredData: true, data });

  if (!context.auth) {
    functions.logger.error("Usuario no autenticado intentando actualizar estado.");
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const providerId = context.auth.uid; // El ID del prestador es el UID del usuario autenticado

  const { isAvailable, location } = data; // location es { lat: number, lng: number }

  if (typeof isAvailable !== "boolean") {
    functions.logger.error("El parámetro 'isAvailable' debe ser un booleano.", { isAvailable });
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el parámetro 'isAvailable' (booleano).");
  }

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();
  const updates: Partial<ProviderData> = { // Usar Partial para actualizaciones
    isAvailable: isAvailable,
    lastConnection: now,
  };

  if (isAvailable === true) {
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      functions.logger.error("Si 'isAvailable' es true, se requiere un objeto 'location' con 'lat' y 'lng' numéricos.", { location });
      throw new functions.https.HttpsError("invalid-argument", "Se requiere 'location' con 'lat' y 'lng' válidos cuando 'isAvailable' es true.");
    }
    updates.currentLocation = { // Guardar como objeto con lat, lng y timestamp
      lat: location.lat,
      lng: location.lng,
      timestamp: now,
    };
    functions.logger.info(`Prestador ${providerId} marcándose como DISPONIBLE en`, location);
  } else { // isAvailable es false
    updates.currentLocation = null; // O admin.firestore.FieldValue.delete() para borrar el campo
    functions.logger.info(`Prestador ${providerId} marcándose como NO DISPONIBLE.`);
  }

  try {
    // Usar set con merge:true para crear el documento si no existe, o actualizarlo si existe.
    // Esto es útil si el prestador actualiza su estado por primera vez.
    await providerRef.set(updates, { merge: true });
    functions.logger.info(`Estado de prestador ${providerId} actualizado exitosamente.`);
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
  const providerId = context.auth.uid; // El ID del prestador es el UID del usuario autenticado

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();

  const updates: Partial<ProviderData> = {
    isAvailable: false,
    currentLocation: null, // Borrar la ubicación actual
    lastConnection: now,
  };

  try {
    // Usar update aquí, asumiendo que el prestador ya existe.
    // Si podría no existir, set con merge:true sería más seguro.
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      functions.logger.warn(`Prestador ${providerId} no encontrado. No se puede desconectar. Creando perfil básico.`);
      // Opcional: Crear el perfil si no existe y se intenta desconectar
      await providerRef.set({
        uid: providerId,
        name: context.auth.token.name || `Prestador ${providerId.substring(0,5)}`,
        isAvailable: false,
        currentLocation: null,
        lastConnection: now,
        rating: 0,
        ratingCount: 0,
        ratingSum: 0,
        allowsHourlyServices: false, // Valor por defecto
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

  // Opcional: Verificación de rol admin
  // if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) {
  //   throw new functions.https.HttpsError("permission-denied", "No tienes permisos para ejecutar esta acción.");
  // }

  const NOMBRES_FUNCIONES_ESPERADAS = [
    "confirmServiceCompletionByUserService",
    "calificarPrestador",
    "calificarUsuario",
    "reportarProblemaServicio",
    "obtenerServiciosCompletados",
    "registrarDocumentoProfesional",
    "validateDocumentAndRemoveContactInfo",
    "activarGarantiaPremium",
    "resolverGarantiaPremium",
    "simulateDailyAutomatedChecks", // PubSub, pero se verifica su exportación
    "updateProviderRealtimeStatus",
    "disconnectProvider",
    "agendarCita", // Nueva
    "cancelarCitaAgendada", // Nueva
    "confirmarCitaPorPrestador", // Nueva
    "verificarEstadoFunciones", // La propia función
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";

    if (!presenteEnCodigo) {
      todasLasFuncionesCriticasPresentes = false;
    }

    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada), // 'function' o 'undefined'
      // Simulaciones - En un sistema real, esto vendría de GCP o monitoreo
      estadoDespliegueSimulado: presenteEnCodigo ? "Asumido Habilitada si Presente" : "Ausente en Código",
      ultimaActualizacionSimulada: "N/D (Consultar en GCP Console)",
      erroresDetectadosSimulado: "N/D (Revisar Cloud Logging y GCP Console)",
    });

    functions.logger.log(`Función '${nombreFuncion}': ${presenteEnCodigo ? 'Presente y exportada' : 'No encontrada o no exportada'}`);
  }

  const resultadoConsolidado = {
    mensaje: "Verificación de estado de funciones completada (simulada).",
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
  const { prestadorId, fechaSolicitada, horaSolicitada, detallesServicio, ubicacion, notasAdicionales } = data;

  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !detallesServicio) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos (prestadorId, fechaSolicitada, horaSolicitada, detallesServicio).");
  }

  // Validar formato de fecha YYYY-MM-DD y hora HH:MM
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  const regexHora = /^\d{2}:\d{2}$/;
  if (!regexFecha.test(fechaSolicitada) || !regexHora.test(horaSolicitada)) {
    throw new functions.https.HttpsError("invalid-argument", "Formato de fecha (YYYY-MM-DD) u hora (HH:MM) inválido.");
  }

  let fechaHoraSolicitadaConvertida: admin.firestore.Timestamp;
  try {
    // Combinar fecha y hora y convertir a Timestamp. Firestore maneja esto en UTC.
    const [year, month, day] = fechaSolicitada.split("-").map(Number);
    const [hour, minute] = horaSolicitada.split(":").map(Number);
    const dateObject = new Date(year, month - 1, day, hour, minute); // Mes es 0-indexado

    if (isNaN(dateObject.getTime())) {
      throw new Error("Fecha u hora inválida después de la conversión.");
    }
    if (dateObject < new Date()) {
      throw new functions.https.HttpsError("invalid-argument", "No puedes agendar una cita en una fecha u hora pasada.");
    }
    fechaHoraSolicitadaConvertida = admin.firestore.Timestamp.fromDate(dateObject);
  } catch (e: any) {
    functions.logger.error("Error al convertir fecha/hora:", e.message);
    throw new functions.https.HttpsError("invalid-argument", `Error procesando fecha y hora: ${e.message}`);
  }

  const citasRef = db.collection("citas");

  try {
    // Verificar si el prestador ya tiene una cita en ese horario
    const conflictoQuery = citasRef
      .where("prestadorId", "==", prestadorId)
      .where("fechaHoraSolicitada", "==", fechaHoraSolicitadaConvertida)
      .where("estado", "in", ["pendiente_confirmacion", "confirmada_prestador", "servicio_iniciado"]); // Estados que indican ocupado

    const conflictoSnapshot = await conflictoQuery.get();
    if (!conflictoSnapshot.empty) {
      functions.logger.warn(`Conflicto de horario para prestador ${prestadorId} en ${fechaSolicitada} ${horaSolicitada}.`);
      throw new functions.https.HttpsError("already-exists", "El prestador ya tiene una cita agendada en este horario. Por favor, elige otro.");
    }

    const nuevaCitaData: Partial<CitaData> = { // Usar Partial para mejor manejo de campos opcionales
      usuarioId: usuarioId,
      prestadorId: prestadorId,
      fechaHoraSolicitada: fechaHoraSolicitadaConvertida,
      detallesServicio: detallesServicio,
      estado: "pendiente_confirmacion",
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };

    if (ubicacion) nuevaCitaData.ubicacion = ubicacion;
    if (notasAdicionales) nuevaCitaData.notasAdicionales = notasAdicionales;

    const citaRef = await citasRef.add(nuevaCitaData);
    functions.logger.info(`Cita agendada con ID: ${citaRef.id} por usuario ${usuarioId} para prestador ${prestadorId}.`);

    // Aquí podrías añadir lógica para notificar al prestador sobre la nueva solicitud de cita.
    functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${prestadorId} sobre la nueva cita ${citaRef.id}.`);

    return { success: true, message: "Cita agendada exitosamente. Esperando confirmación del prestador.", citaId: citaRef.id };
  } catch (error: any) {
    functions.logger.error("Error al agendar cita:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al agendar la cita.", error.message);
  }
});

export const cancelarCitaAgendada = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando cancelarCitaAgendada", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para cancelar una cita.");
  }
  const usuarioId = context.auth.uid;
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

      if (citaData.usuarioId !== usuarioId) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita.");
      }
      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden cancelar citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}`);
      }

      transaction.update(citaRef, {
        estado: "cancelada_usuario",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Cita ${citaId} cancelada por usuario ${usuarioId}.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${citaData.prestadorId} sobre la cancelación de la cita ${citaId}.`);
    });
    return { success: true, message: "Cita cancelada exitosamente." };
  } catch (error: any) {
    functions.logger.error("Error en la transacción de cancelarCitaAgendada:", error);
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
  const { citaId } = data; // Se espera el ID de la cita

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

      // Simulación de generación de orden de cobro
      const ordenCobroIdSimulada = `orden_${citaId}_${Date.now()}`;
      functions.logger.info(`SIMULACIÓN: Generando orden de cobro para cita ${citaId}. ID Orden: ${ordenCobroIdSimulada}. Usuario a cobrar: ${citaData.usuarioId}.`);
      // En un sistema real, aquí interactuarías con Stripe, MercadoPago, etc.
      // para crear un PaymentIntent o una autorización de pago.

      transaction.update(citaRef, {
        estado: "confirmada_prestador",
        fechaConfirmacionPrestador: admin.firestore.FieldValue.serverTimestamp(),
        ordenCobroId: ordenCobroIdSimulada, // Guardar la referencia a la orden de cobro
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Cita ${citaId} confirmada por prestador ${prestadorIdAutenticado}. Usuario a notificar: ${citaData.usuarioId}.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la confirmación de la cita ${citaId}.`);
    });

    return { success: true, message: "Cita confirmada exitosamente y orden de cobro generada (simulada)." };
  } catch (error: any) {
    functions.logger.error("Error en la transacción de confirmarCitaPorPrestador:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al confirmar la cita.", error.message);
  }
});

//

    