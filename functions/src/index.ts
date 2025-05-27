
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
  | "completado_por_prestador"
  | "completado_por_usuario" // Anteriormente 'finalizado_usuario'
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
    // Podrías añadir más campos como 'evidenciaUrlDisputa'
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
  resueltaPor?: string;
}


// --- FUNCIONES ---

export const confirmServiceCompletionByUserService = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando confirmServiceCompletionByUserService", { structuredData: true, data });

  if (!context.auth) {
    functions.logger.error("Usuario no autenticado intentando confirmar servicio.");
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const userId = context.auth.uid;
  const { servicioId } = data; // El ID de la solicitud/servicio ahora se espera como 'servicioId'

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

      const now = admin.firestore.Timestamp.now(); // Para usar consistentemente
      const ratingAndDisputeWindowEndDate = new Date(now.toDate().getTime() + RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(ratingAndDisputeWindowEndDate);

      let warrantyDays = STANDARD_WARRANTY_DAYS;
      // Simular obtención de estado premium del usuario (en real, leerías el doc del usuario o un custom claim)
      const userIsPremium = context.auth.token.premium === true; // Asume que tienes un custom claim 'premium'
      if (userIsPremium) {
        warrantyDays = PREMIUM_WARRANTY_DAYS;
      }
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now, // Fecha de confirmación del usuario
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
      // Permitir calificar si el servicio está completado por el usuario O si se cerró automáticamente y la ventana no ha expirado
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_automaticamente" && servicioData.estado !== "cerrado_con_disputa_resuelta") {
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en un estado que permita calificación por el usuario. Estado: ${servicioData.estado}`);
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
      let currentRating = 0;

      if (prestadorDoc.exists) {
        const prestadorData = prestadorDoc.data() as ProviderData;
        newRatingSum = (prestadorData.ratingSum || 0) + calificacion;
        newRatingCount = (prestadorData.ratingCount || 0) + 1;
      }
      currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      let servicioUpdate: Partial<ServiceData> = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
        servicioUpdate.estado = "cerrado_con_calificacion";
      }
      
      transaction.update(servicioRef, servicioUpdate);

      transaction.set(prestadorRef, {
        ratingSum: newRatingSum,
        ratingCount: newRatingCount,
        rating: currentRating,
      }, { merge: true });
      
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
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_automaticamente" && servicioData.estado !== "cerrado_con_disputa_resuelta") {
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en un estado que permita calificación por el prestador. Estado: ${servicioData.estado}`);
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

      let servicioUpdate: Partial<ServiceData> = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        servicioUpdate.estado = "cerrado_con_calificacion";
      }
      transaction.update(servicioRef, servicioUpdate);

      transaction.set(usuarioRef, {
        uid: servicioData.usuarioId, // Asegurar que el uid está
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: currentRating,
        lastRatedByProviderAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      functions.logger.info(`Prestador ${prestadorId} calificó al usuario ${servicioData.usuarioId} para el servicio ${servicioId}.`);
      return { success: true, message: "Calificación de usuario registrada exitosamente." };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de calificarUsuario:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación del usuario.", error);
  }
});

export const reportServiceIssue = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando reportServiceIssue", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, detalleProblema } = data; // Cambiado 'motivo' a 'detalleProblema'

  if (!servicioId || typeof servicioId !== "string" || !detalleProblema || typeof detalleProblema !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'detalleProblema' válidos.");
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
          detalle: detalleProblema, // Usar 'detalle' para el campo en Firestore
        },
        updatedAt: now,
      });

      // Simulación de creación de documento en 'reportes' si aún se desea, aunque el nuevo requisito es guardar en 'servicios'
      // const reporteRef = db.collection("reportes").doc(); // Generar ID automático
      // transaction.set(reporteRef, {
      //   servicioId: servicioId,
      //   usuarioId: usuarioId,
      //   prestadorId: servicioData.prestadorId,
      //   motivo: detalleProblema, // Usar detalleProblema
      //   fechaReporte: now,
      //   estado: "pendiente",
      // });
      // functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID (simulado): ${reporteRef.id}`);
      
      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Detalles guardados en el servicio.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${servicioData.prestadorId} sobre la disputa del servicio ${servicioId}.`);


      return {
        success: true,
        message: "Problema reportado exitosamente. El servicio está ahora en disputa y el pago ha sido congelado.",
        // reporteId: reporteRef.id, // Si se crea en 'reportes'
      };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de reportServiceIssue:", error);
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
      .where("usuarioId", "==", usuarioId)
      .where("estado", "==", "completado_por_usuario")
      .orderBy("fechaConfirmacion", "desc")
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = []; // Usar Partial para seleccionar campos
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id,
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion,
        // Añade aquí otros campos que quieras devolver para esta vista resumida
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
  const prestadorId = context.auth.uid;
  const { tipoDocumento, urlDocumento, descripcion } = data;

  if (!tipoDocumento || typeof tipoDocumento !== "string" || !urlDocumento || typeof urlDocumento !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tipoDocumento' y 'urlDocumento'.");
  }

  const prestadorRef = db.collection("prestadores").doc(prestadorId);

  const nuevoDocumento: DocumentoVerificable = {
    tipoDocumento: tipoDocumento,
    urlDocumento: urlDocumento,
    descripcion: descripcion || "",
    fechaRegistro: admin.firestore.Timestamp.now(),
    estadoVerificacion: "pendiente",
  };

  try {
    // Asegurarse de que el documento del prestador exista o crearlo
    await transaction.set(prestadorRef, { 
        documentosVerificables: admin.firestore.FieldValue.arrayUnion(nuevoDocumento) 
    }, { merge: true });

    functions.logger.info(`Documento registrado para prestador ${prestadorId}. Tipo: ${tipoDocumento}`);
    return { success: true, message: "Documento registrado exitosamente. Pendiente de revisión." };
  } catch (error) {
    functions.logger.error(`Error al registrar documento para prestador ${prestadorId}:`, error);
    throw new functions.https.HttpsError("internal", "Error al registrar el documento.", error);
  }
});


export const validateDocumentAndRemoveContactInfo = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo", { structuredData: true, data });

  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Asumiendo roles de admin/moderador
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
      const urlDocumento = documentoAVerificar.urlDocumento;

      functions.logger.info(`Iniciando análisis de Vision API para documento: ${urlDocumento}`);
      let textoExtraido = "";
      try {
        const [result] = await visionClient.documentTextDetection(urlDocumento);
        textoExtraido = result.fullTextAnnotation?.text?.toLowerCase() || "";
        functions.logger.info(`Texto extraído (primeros 500 chars): ${textoExtraido.substring(0, 500)}`);
      } catch (visionError: any) {
        functions.logger.error("Error de Vision API al procesar el documento:", visionError);
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia"; // Marcar como error de IA
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError);
      }
      
      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\s?\d[ -]?){10}/g; // Mejorada para espacios/guiones
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
           // Evitar duplicar con regex, pero asegurar que se detecten palabras clave de dirección
          if (!phoneMatches?.some(pm => pm.includes(palabra)) && !emailMatches?.some(em => em.includes(palabra))) {
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
      } else {
        nuevoEstado = "Validado"; // Cambiado de verificado_ia para seguir tu último request
        documentos[documentoIndex].motivoRechazoIA = undefined; 
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined;
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
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
  if (context.auth.token.premium !== true) { // Verifica el custom claim 'premium'
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
      warrantyEndDate.setHours(23, 59, 59, 999); // Considerar el final del día

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
        estado: "en_disputa", // O un estado específico como 'garantia_solicitada'
        paymentStatus: "congelado_por_disputa",
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
  if (!(context.auth.token.admin === true || context.auth.token.moderador === true)) {
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

      if (garantiaData.estadoGarantia !== "pendiente" && garantiaData.estadoGarantia !== "en_revision") {
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
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        estado: "cerrado_con_disputa_resuelta", // Un estado final después de la resolución de garantía/disputa
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true;
        // Lógica de reembolso/liberación de pago parcial si es necesario aquí
        // El paymentStatus podría cambiar a 'reembolsado_parcial' o 'reembolsado_total'
      } else { // rechazada
        servicioUpdateData.compensacionAutorizada = false;
        // Si la garantía se rechaza, y el pago estaba congelado, se podría liberar al proveedor.
        // Esto dependerá de si la disputa/garantía era la única razón para la retención.
        const servicioDoc = await transaction.get(servicioRef);
        if (servicioDoc.exists) {
            const servicioDataOriginal = servicioDoc.data() as ServiceData;
            if (servicioDataOriginal.paymentStatus === "congelado_por_disputa") {
                servicioUpdateData.paymentStatus = "retenido_para_liberacion"; // Para que el cron job lo procese
            }
        }
      }
      transaction.update(servicioRef, servicioUpdateData);

      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      return { success: true, message: `Solicitud de garantía ${decision} exitosamente.` };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de resolverGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al resolver la garantía.", error);
  }
});


export const simulateDailyAutomatedChecks = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = admin.firestore.Timestamp.now();
    const sevenDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(
      new Date(now.toDate().getTime() - RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    );

    const serviciosRef = db.collection("servicios");
    const snapshot = await serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("fechaConfirmacion", "<=", sevenDaysAgoTimestamp) // Solo los que tienen 7+ días desde confirmación
      .get();

    if (snapshot.empty) {
      functions.logger.info("No hay servicios que cumplan los criterios para revisión automática de pago.");
      return null;
    }

    const batch = db.batch();
    let SUCESS_COUNTER = 0;

    snapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      functions.logger.log(`Revisando servicio ID: ${doc.id} para posible liberación automática.`, servicio);
      
      // Doble chequeo, aunque la consulta ya debería cubrir esto.
      // Asegurar que no esté en disputa (estado no es "en_disputa")
      // El estado "completado_por_usuario" implica que no está en disputa activa en ese momento.
      // Si se hubiera abierto una disputa, el estado cambiaría.

      // Si ratingWindowExpiresAt ya pasó (lo cual debe ser el caso si fechaConfirmacion es <= sevenDaysAgoTimestamp)
      // y no hay disputa, se procede.
      if (servicio.ratingWindowExpiresAt && servicio.ratingWindowExpiresAt <= now) {
        functions.logger.info(`Servicio ID: ${doc.id} cumple condiciones para liberación de pago.`);
        batch.update(doc.ref, {
          paymentStatus: "liberado_al_proveedor",
          fechaLiberacionPago: now,
          estado: "cerrado_automaticamente",
          updatedAt: now,
        });
        SUCESS_COUNTER++;
        functions.logger.log(`Programado para liberación de pago y cierre: Servicio ID ${doc.id}`);
      } else {
        functions.logger.log(`Servicio ID: ${doc.id} aún no cumple los 7 días desde la confirmación, o ratingWindowExpiresAt no ha pasado.`);
      }
    });

    if (SUCESS_COUNTER > 0) {
        await batch.commit();
        functions.logger.info(`Lote de ${SUCESS_COUNTER} actualizaciones de servicios completado.`);
    } else {
        functions.logger.info("No se realizaron actualizaciones de liberación de pago en este ciclo.");
    }
    return null;
  });
