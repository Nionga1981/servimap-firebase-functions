
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// --- CONSTANTES ---
const STANDARD_WARRANTY_DAYS = 3;
const PREMIUM_WARRANTY_DAYS = 7;
const RATING_AND_DISPUTE_WINDOW_DAYS = 7;

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
  | "confirmado_proveedor"
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador" // Renamed from completado_proveedor for consistency
  | "completado_por_usuario" // Renamed from finalizado_usuario for consistency
  | "cancelado_usuario"
  | "cancelado_proveedor"
  | "en_disputa"
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta";

type PaymentStatus =
  | "pendiente_confirmacion_usuario"
  | "retenido_para_liberacion"
  | "liberado_al_proveedor"
  | "congelado_por_disputa"
  | "reembolsado_parcial"
  | "reembolsado_total";

interface RatingData {
  calificacion: number;
  comentario?: string;
  fecha: admin.firestore.Timestamp;
}

interface ServiceData {
  id?: string; // ID del documento
  usuarioId: string;
  prestadorId: string;
  estado: ServiceRequestStatus;
  fechaSolicitud: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  // Campos de confirmación y pago
  fechaConfirmacion?: admin.firestore.Timestamp; // Confirmado por el usuario
  habilitarCalificacion?: boolean;
  ratingWindowExpiresAt?: admin.firestore.Timestamp; // Ventana para calificar/disputar
  paymentStatus?: PaymentStatus;
  fechaLiberacionPago?: admin.firestore.Timestamp;
  fechaConfirmacionUsuario?: admin.firestore.Timestamp; // Campo específico para la confirmación del usuario
  userConfirmedCompletionAt?: admin.firestore.Timestamp; // Alias de fechaConfirmacionUsuario para claridad


  // Calificaciones
  calificacionUsuario?: RatingData; // Calificación del usuario al prestador
  calificacionPrestador?: RatingData; // Calificación del prestador al usuario
  mutualRatingCompleted?: boolean;

  // Garantía
  warrantyEndDate?: string; // YYYY-MM-DD
  garantiaSolicitada?: boolean;
  idSolicitudGarantia?: string;
  garantiaResultado?: "aprobada" | "rechazada";
  compensacionAutorizada?: boolean;

  // Disputa
  detallesDisputa?: {
    reportadoEn: admin.firestore.Timestamp;
    detalle: string; // Anteriormente 'motivo' o 'comentarioProblema'
  };
  [key: string]: any; // Permite otros campos si es necesario
}

interface ProviderData {
  uid?: string; // Asegurar que el UID del proveedor esté presente
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
}

interface UserData {
  uid?: string;
  name?: string;
  ratingSumUsuario?: number; // Suma de calificaciones recibidas por el usuario
  ratingCountUsuario?: number; // Conteo de calificaciones recibidas por el usuario
  ratingUsuario?: number; // Promedio de calificación del usuario
  isPremium?: boolean; // Para lógica de garantía
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
  resueltaPor?: string; // UID del admin/moderador
}


// --- FUNCIONES ---

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

      if (servicioData.estado !== "completado_por_prestador") {
        functions.logger.warn(`Intento de confirmar servicio ${servicioId} que no está en estado 'completado_por_prestador'. Estado actual: ${servicioData.estado}`);
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const ratingAndDisputeWindowEndDate = new Date(now.toDate().getTime() + RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(ratingAndDisputeWindowEndDate);

      let warrantyDays = STANDARD_WARRANTY_DAYS;
      // Simulación: Obtener si el usuario es premium. En un caso real, esto podría venir de context.auth.token.premium
      // o consultando el perfil del usuario.
      const userDocRef = db.collection("usuarios").doc(userId); // Asumiendo colección 'usuarios'
      const userDoc = await transaction.get(userDocRef); // Leer dentro de la transacción si es necesario para consistencia
      const userIsPremium = userDoc.exists && (userDoc.data() as UserData).isPremium === true;

      if (userIsPremium) {
        warrantyDays = PREMIUM_WARRANTY_DAYS;
      }
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now, // Fecha de confirmación del usuario
        userConfirmedCompletionAt: now, // Alias para mayor claridad
        habilitarCalificacion: true,
        paymentStatus: "retenido_para_liberacion",
        ratingWindowExpiresAt: ratingWindowExpiresTimestamp,
        warrantyEndDate: warrantyEndDateDt.toISOString().split("T")[0], // Guardar como YYYY-MM-DD
        updatedAt: now,
      });
      functions.logger.info(`Servicio ${servicioId} confirmado por usuario ${userId}. Calificación habilitada, pago retenido, ventana de calificación/disputa y garantía establecidas.`);
    });

    functions.logger.info("Transacción completada exitosamente para confirmServiceCompletionByUserService.");
    return { success: true, message: "Servicio confirmado exitosamente. Ya puedes calificar al prestador y el pago está retenido." };
  } catch (error) {
    functions.logger.error("Error en la transacción de confirmServiceCompletionByUserService:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al confirmar el servicio.", error);
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
      // Permitir calificar si el servicio fue completado_por_usuario, cerrado_automaticamente o cerrado_con_disputa_resuelta
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_automaticamente" && servicioData.estado !== "cerrado_con_disputa_resuelta") {
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en un estado que permita calificación por el usuario. Estado: ${servicioData.estado}`);
      }
      if (!servicioData.habilitarCalificacion) {
        throw new functions.https.HttpsError("failed-precondition", "La calificación para este servicio no está habilitada.");
      }
      if (servicioData.calificacionUsuario) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado este servicio.");
      }
      // Verificar si la ventana de calificación ha expirado
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para calificar este servicio ha expirado.");
      }

      const nuevaCalificacionUsuario: RatingData = {
        calificacion: calificacion,
        fecha: admin.firestore.Timestamp.now(),
        ...(comentario && { comentario: comentario }),
      };

      // Actualizar el documento del prestador
      const prestadorRef = db.collection("prestadores").doc(servicioData.prestadorId);
      const prestadorDoc = await transaction.get(prestadorRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;
      let currentRating = 0;

      if (prestadorDoc.exists) {
        const prestadorData = prestadorDoc.data() as ProviderData;
        newRatingSum = (prestadorData.ratingSum || 0) + calificacion;
        newRatingCount = (prestadorData.ratingCount || 0) + 1;
      }
      currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0; // Evitar NaN y redondear

      transaction.set(prestadorRef, {
        ratingSum: newRatingSum,
        ratingCount: newRatingCount,
        rating: currentRating,
      }, { merge: true });

      // Actualizar el documento del servicio
      let servicioUpdate: Partial<ServiceData> = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Si el prestador ya calificó al usuario, marcar como calificación mutua completa
      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
        servicioUpdate.estado = "cerrado_con_calificacion"; // Opcional: cambiar estado si es relevante
      }

      transaction.update(servicioRef, servicioUpdate);

      functions.logger.info(`Usuario ${userId} calificó servicio ${servicioId} para prestador ${servicioData.prestadorId}.`);
      return { success: true, message: "Calificación registrada exitosamente." };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de calificarPrestador:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación.", error);
  }
});

export const calificarUsuario = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando calificarUsuario", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const prestadorId = context.auth.uid; // El UID del prestador
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
      // Permitir calificar si el servicio está completado_por_usuario, cerrado_automaticamente o cerrado_con_disputa_resuelta
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_automaticamente" && servicioData.estado !== "cerrado_con_disputa_resuelta") {
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en un estado que permita calificación por el prestador. Estado: ${servicioData.estado}`);
      }
      if (!servicioData.habilitarCalificacion) { // El usuario debe haber confirmado primero
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

      // Actualizar el documento del usuario
      const usuarioRef = db.collection("usuarios").doc(servicioData.usuarioId); // Asumiendo una colección 'usuarios'
      const usuarioDoc = await transaction.get(usuarioRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;
      let currentRating = 0;

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1;
      }
      currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      // Asegurar que el documento de usuario exista o crearlo con los campos de calificación
      transaction.set(usuarioRef, {
        uid: servicioData.usuarioId, // Asegurar que el uid está
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: currentRating,
        lastRatedByProviderAt: admin.firestore.FieldValue.serverTimestamp(), // Campo para rastrear la última calificación
      }, { merge: true });


      // Actualizar el documento del servicio
      let servicioUpdate: Partial<ServiceData> = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        servicioUpdate.estado = "cerrado_con_calificacion"; // Opcional: cambiar estado si es relevante
      }
      transaction.update(servicioRef, servicioUpdate);

      functions.logger.info(`Prestador ${prestadorId} calificó al usuario ${servicioData.usuarioId} para el servicio ${servicioId}.`);
      return { success: true, message: "Calificación de usuario registrada exitosamente." };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de calificarUsuario:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación del usuario.", error);
  }
});

export const reportarProblemaServicio = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando reportarProblemaServicio", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo, urlEvidencia } = data; // 'motivo' en lugar de 'detalleProblema'

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
      // Permitir reportar si el servicio está completado por el usuario y dentro de la ventana de calificación/disputa
      if (servicioData.estado !== "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios confirmados por el usuario. Estado actual: ${servicioData.estado}`);
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") {
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa",
        detallesDisputa: {
          reportadoEn: now,
          detalle: motivo, // Usar 'motivo' como el detalle del problema
        },
        updatedAt: now,
      });

      // Crear documento en la colección 'reportes'
      const reporteData: any = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId, // Guardar ID del prestador para referencia
        motivo: motivo,
        fechaReporte: now,
        estado: "pendiente", // Estado inicial del reporte
      };
      if (urlEvidencia) {
        reporteData.urlEvidencia = urlEvidencia;
      }
      const reporteRef = await db.collection("reportes").add(reporteData); // add() genera ID automático

      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Detalles guardados en el servicio y reporte ID: ${reporteRef.id}.`);
      // Simulación de notificación al prestador
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${servicioData.prestadorId} sobre la disputa del servicio ${servicioId}.`);

      return {
        success: true,
        message: "Problema reportado exitosamente. El servicio está ahora en disputa y el pago ha sido congelado.",
        reporteId: reporteRef.id,
      };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de reportarProblemaServicio:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al reportar el problema.", error);
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
      .where("usuarioId", "==", usuarioId) // Solo servicios del usuario autenticado
      .where("estado", "==", "completado_por_usuario")
      .orderBy("fechaConfirmacion", "desc") // Opcional: ordenar por más reciente
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = []; // Usar Partial para seleccionar campos
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id,
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion,
        // Añadir aquí otros campos que desees devolver:
        // descripcion: servicio.descripcion,
        // precio: servicio.precio,
        // etc.
      });
    });
    functions.logger.info(`Encontrados ${serviciosCompletados.length} servicios completados por usuario ${usuarioId}.`);
    return serviciosCompletados;
  } catch (error) {
    functions.logger.error("Error al obtener servicios completados:", error);
    throw new functions.https.HttpsError("internal", "Error al obtener los servicios completados.", error);
  }
});

export const registrarDocumentoProfesional = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando registrarDocumentoProfesional", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const prestadorId = context.auth.uid; // El UID del prestador autenticado
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
    // Usar una transacción para asegurar la atomicidad si se necesita leer antes de escribir,
    // aunque aquí arrayUnion es generalmente seguro por sí mismo.
    // Para consistencia, si la lógica se vuelve más compleja, la transacción es buena.
    await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        // Opción 1: Crear el documento del prestador si no existe
        functions.logger.info(`Documento del prestador ${prestadorId} no encontrado, creando uno nuevo.`);
        transaction.set(prestadorRef, { documentosVerificables: [nuevoDocumento], uid: prestadorId /* otros campos iniciales */ });
      } else {
        // Opción 2: Actualizar el documento existente
        transaction.update(prestadorRef, {
          documentosVerificables: admin.firestore.FieldValue.arrayUnion(nuevoDocumento),
        });
      }
    });

    functions.logger.info(`Documento registrado para prestador ${prestadorId}. Tipo: ${tipoDocumento}`);
    return { success: true, message: "Documento registrado exitosamente. Pendiente de revisión." };
  } catch (error) {
    functions.logger.error(`Error al registrar documento para prestador ${prestadorId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error al registrar el documento.", error);
  }
});


export const validateDocumentAndRemoveContactInfo = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo", { structuredData: true, data });

  // Idealmente, esto sería llamado por un admin o un proceso automatizado, no directamente por el prestador.
  // Se podría añadir una verificación de rol aquí si es necesario.
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Ejemplo de verificación de rol
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
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : []; // Copiar para modificar


      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];

      // Asegurarse de que el documento esté en estado 'pendiente' o algún estado que permita la verificación por IA
      if (documentoAVerificar.estadoVerificacion !== "pendiente" && documentoAVerificar.estadoVerificacion !== "rechazado_ia") { // Permitir re-verificación si fue rechazado por IA
         functions.logger.warn(`Documento ${documentoIndex} para ${prestadorId} no está en estado 'pendiente' o 'rechazado_ia'. Estado actual: ${documentoAVerificar.estadoVerificacion}`);
         // Podrías lanzar un error o simplemente no hacer nada
         // throw new functions.https.HttpsError("failed-precondition", "El documento no está en estado pendiente para verificación por IA.");
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
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError);
      }

      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      // Regex mejoradas
      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(?\d{2,3}\)?\s?)?(?:[ -]?\d){7,10}/g; // Más flexible
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
        if (textoParaAnalizar.includes(palabra.toLowerCase())) {
          // Evitar duplicar si ya fue detectado por regex
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
        nuevoEstado = "Validado"; // Nuevo estado "Validado"
        documentos[documentoIndex].motivoRechazoIA = undefined; // Limpiar motivo si se aprueba
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined; // Limpiar palabras
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
      }
      documentos[documentoIndex].estadoVerificacion = nuevoEstado;

      transaction.update(prestadorRef, { documentosVerificables: documentos });

      // Guardar un log de la verificación
      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl: urlDocumento,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentos[documentoIndex].fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length, // Longitud del texto analizado
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [],
        agenteVerificador: context.auth?.uid || "sistema_ia_callable", // O un identificador específico para esta función
      });

      functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} actualizado a estado: ${nuevoEstado}.`);
      return { success: true, message: mensajeRespuesta, newState: nuevoEstado, palabrasDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [] };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de validateDocumentAndRemoveContactInfo:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al validar el documento.", error);
  }
});

export const activarGarantiaPremium = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando activarGarantiaPremium", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  // Verificar si el usuario es premium a través de custom claims
  if (context.auth.token.premium !== true) { // Asume que tienes un custom claim 'premium'
    throw new functions.https.HttpsError("permission-denied", "Esta función es solo para usuarios premium.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo } = data;

  if (!servicioId || typeof servicioId !== "string" || !motivo || typeof motivo !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo' válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const garantiasRef = db.collection("garantias"); // Colección para las solicitudes de garantía

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
      if (servicioData.estado !== "completado_por_usuario") { // Asegurar que el usuario ya confirmó
        throw new functions.https.HttpsError("failed-precondition", "La garantía solo puede activarse para servicios confirmados por el usuario.");
      }
      if (servicioData.garantiaSolicitada === true) {
        throw new functions.https.HttpsError("already-exists", "Ya se ha solicitado una garantía para este servicio.");
      }

      // Verificar que la fecha actual esté dentro del período de garantía
      const warrantyEndDateString = servicioData.warrantyEndDate; // Ya se calcula en confirmServiceCompletionByUser
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString);
      const currentDate = new Date();
      warrantyEndDate.setHours(23, 59, 59, 999); // Considerar el final del día

      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      // Crear un nuevo documento en la colección 'garantias'
      const nuevaSolicitudGarantiaRef = garantiasRef.doc(); // Genera un ID automático
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId, // Guardar ID del prestador
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.Timestamp.now(),
        estadoGarantia: "pendiente", // Estado inicial de la garantía
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      // Actualizar el servicio original
      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id, // Guardar el ID del doc de garantía
        // Opcional: Cambiar estado del servicio si es necesario (ej. "en_revision_garantia")
        // estado: "en_revision_garantia",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Garantía premium activada para servicio ${servicioId}. Garantía ID: ${nuevaSolicitudGarantiaRef.id}`);
      return {
        success: true,
        message: "Solicitud de garantía premium activada exitosamente.",
        garantiaId: nuevaSolicitudGarantiaRef.id,
        estadoGarantia: "pendiente",
      };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de activarGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al activar la garantía.", error);
  }
});

export const resolverGarantiaPremium = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando resolverGarantiaPremium", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  // Asegurar que solo admins o moderadores puedan ejecutar esto (ejemplo con custom claims)
  if (!(context.auth.token.admin === true || context.auth.token.moderador === true)) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permisos para resolver garantías.");
  }

  const { garantiaId, decision, comentarioResolucion } = data; // decision: "aprobada" o "rechazada"
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

      // Actualizar el documento del servicio original
      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> = {
        garantiaResultado: decision,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Opcional: cambiar el estado del servicio si la garantía se resuelve
        // Por ejemplo, si la garantía fue rechazada y el servicio estaba en disputa,
        // podría volver a un estado finalizado o cerrado.
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true;
        // Aquí se podría cambiar paymentStatus a 'reembolsado_parcial' o 'reembolsado_total'
        // dependiendo de la política de compensación. Por ahora, solo se marca.
      } else { // rechazada
        servicioUpdateData.compensacionAutorizada = false;
        // Si la garantía se rechaza, y el pago estaba congelado, se podría liberar al proveedor.
        // Esto dependerá de si la disputa/garantía era la única razón para la retención.
        const servicioDoc = await transaction.get(servicioRef); // Leer el servicio dentro de la transacción
        if (servicioDoc.exists) {
          const servicioDataOriginal = servicioDoc.data() as ServiceData;
          if (servicioDataOriginal.paymentStatus === "congelado_por_disputa") {
            // Si la garantía se rechaza, el pago retenido por esta disputa/garantía se vuelve a 'retenido_para_liberacion'
            // para que el cron job lo procese.
            servicioUpdateData.paymentStatus = "retenido_para_liberacion";
            // Si el servicio estaba "en_disputa" únicamente por la garantía, se cierra.
            if (servicioDataOriginal.estado === "en_disputa") {
                servicioUpdateData.estado = "cerrado_con_disputa_resuelta";
            }
          }
        }
      }
      transaction.update(servicioRef, servicioUpdateData);

      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      // Aquí también se deberían enviar notificaciones al usuario y al prestador.
      return { success: true, message: `Solicitud de garantía ${decision} exitosamente.` };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de resolverGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al resolver la garantía.", error);
  }
});


export const simulateDailyAutomatedChecks = functions.pubsub
  .schedule("every 24 hours") // Puedes cambiar esto a "every day 00:00" por ejemplo
  // .timeZone("America/Mexico_City") // Opcional: especifica tu zona horaria
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = admin.firestore.Timestamp.now();
    const sevenDaysAgo = new Date(now.toDate().getTime() - RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const serviciosRef = db.collection("servicios");

    // Query para servicios que el usuario confirmó (estado: completado_por_usuario),
    // el pago está retenido (paymentStatus: retenido_para_liberacion),
    // y la ventana para calificar/disputar (ratingWindowExpiresAt) ha pasado.
    const query = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("ratingWindowExpiresAt", "<=", now);

    const snapshot = await query.get();

    if (snapshot.empty) {
      functions.logger.info("No hay servicios que cumplan los criterios para cierre automático y liberación de pago.");
      return null;
    }

    const batch = db.batch();
    let processedCount = 0;

    snapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      functions.logger.log(`Revisando servicio ID: ${doc.id} para posible liberación automática de pago.`);

      // La consulta ya asegura las condiciones principales.
      // Si llegamos aquí, el servicio fue confirmado por el usuario, el pago está retenido,
      // y la ventana de 7 días para disputas/calificaciones ha pasado.
      // No es necesario verificar explícitamente que no esté en disputa porque si lo estuviera,
      // el estado no sería "completado_por_usuario" y/o el paymentStatus no sería "retenido_para_liberacion".

      batch.update(doc.ref, {
        paymentStatus: "liberado_al_proveedor",
        fechaLiberacionPago: now,
        estado: "cerrado_automaticamente", // Se cierra automáticamente
        updatedAt: now,
      });
      processedCount++;
      functions.logger.log(`Programado para liberación de pago y cierre automático: Servicio ID ${doc.id}`);
      // Aquí se debería notificar al prestador que su pago ha sido liberado.
    });

    if (processedCount > 0) {
      try {
        await batch.commit();
        functions.logger.info(`Lote de ${processedCount} actualizaciones de liberación de pago/cierre automático completado.`);
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

  const { isAvailable, location } = data; // location es opcional { lat: number, lng: number }

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
      timestamp: now, // Guardar timestamp de la ubicación
    };
    functions.logger.info(`Prestador ${providerId} marcándose como DISPONIBLE en`, location);
  } else { // isAvailable === false
    updates.currentLocation = null; // O admin.firestore.FieldValue.delete() para eliminar el campo
    functions.logger.info(`Prestador ${providerId} marcándose como NO DISPONIBLE.`);
  }

  try {
    // Verificar si el documento del prestador existe antes de actualizarlo
    // O usar set con merge:true para crearlo si no existe (depende de tu flujo de creación de prestadores)
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists && isAvailable) { // Solo intentar crear si se está marcando como disponible y no existe
        functions.logger.info(`Documento del prestador ${providerId} no existe, creando uno nuevo.`);
        await providerRef.set({ ...updates, uid: providerId, name: context.auth.token.name || "Nuevo Prestador" }); // Ejemplo de nombre
    } else if (providerDoc.exists) {
        await providerRef.update(updates);
    } else if (!providerDoc.exists && !isAvailable) {
        functions.logger.warn(`Prestador ${providerId} no existe y se está intentando marcar como no disponible. No se realiza ninguna acción.`);
         return { success: false, message: "El perfil del prestador no existe." };
    }

    functions.logger.info(`Estado de prestador ${providerId} actualizado exitosamente.`);
    return { success: true, message: `Estado actualizado a ${isAvailable ? "disponible" : "no disponible"}.` };
  } catch (error) {
    functions.logger.error(`Error al actualizar estado para prestador ${providerId}:`, error);
    throw new functions.https.HttpsError("internal", "Error al actualizar el estado del prestador.", error);
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
    currentLocation: null, // O admin.firestore.FieldValue.delete()
    lastConnection: now,
  };

  try {
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      functions.logger.warn(`Prestador ${providerId} no encontrado. No se puede desconectar.`);
      // Opcionalmente, podrías crear el documento aquí si tiene sentido en tu flujo,
      // o simplemente devolver un error/mensaje.
      // Por ahora, solo logueamos y devolvemos un mensaje de éxito indicando que no se hizo nada.
      return { success: true, message: "Perfil del prestador no encontrado, no se realizó ninguna acción." };
    }

    await providerRef.update(updates);
    functions.logger.info(`Prestador ${providerId} desconectado y ubicación borrada.`);
    return { success: true, message: "Te has desconectado exitosamente." };
  } catch (error) {
    functions.logger.error(`Error al desconectar al prestador ${providerId}:`, error);
    throw new functions.https.HttpsError("internal", "Error al desconectar al prestador.", error);
  }
});

//
