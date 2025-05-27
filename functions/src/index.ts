
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// Interfaces (asegúrate de que estas definiciones sean consistentes con tus tipos de frontend si los tienes)
interface ServiceData {
  id: string; // Aunque el ID es del documento, puede ser útil tenerlo en los datos
  usuarioId: string;
  prestadorId: string;
  estado: ServiceRequestStatus;
  fechaSolicitud: admin.firestore.Timestamp;
  // Campos relacionados con la finalización y pago
  fechaConfirmacion?: admin.firestore.Timestamp; // Confirmado por el usuario
  habilitarCalificacion?: boolean;
  ratingWindowExpiresAt?: admin.firestore.Timestamp;
  paymentStatus?: PaymentStatus;
  fechaLiberacionPago?: admin.firestore.Timestamp; // Nuevo campo
  // Calificaciones
  calificacionUsuario?: RatingData;
  calificacionPrestador?: RatingData;
  mutualRatingCompleted?: boolean;
  // Garantía
  warrantyEndDate?: string; // YYYY-MM-DD
  garantiaSolicitada?: boolean;
  idSolicitudGarantia?: string;
  garantiaResultado?: "aprobada" | "rechazada";
  compensacionAutorizada?: boolean;
  // Otros campos del servicio...
  [key: string]: any; // Para permitir otros campos no estrictamente tipados aquí
}

interface RatingData {
  calificacion: number;
  comentario?: string;
  fecha: admin.firestore.Timestamp;
}

interface ProviderData {
  uid?: string; // ID del prestador
  name?: string;
  ratingSum?: number;
  ratingCount?: number;
  rating?: number;
  documentosVerificables?: DocumentoVerificable[];
  // Otros campos del perfil del prestador
}

interface UserData {
  uid?: string; // ID del usuario
  name?: string;
  ratingSumUsuario?: number;
  ratingCountUsuario?: number;
  ratingUsuario?: number;
  // Otros campos del perfil del usuario
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

type ServiceRequestStatus =
  | "agendado"
  | "confirmado_proveedor"
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador" // Estado que el prestador establece
  | "completado_por_usuario" // Estado que el usuario confirma (anteriormente 'finalizado_usuario')
  | "finalizado_usuario" // Estado que el usuario confirma
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

// Días para garantía estándar y premium
const STANDARD_WARRANTY_DAYS = 3;
const PREMIUM_WARRANTY_DAYS = 7; // Para usuarios premium

// --- Funciones Existentes (confirmServiceCompletionByUserService, etc.) ---
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

      const now = admin.firestore.FieldValue.serverTimestamp();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysFromNow);

      let warrantyDays = STANDARD_WARRANTY_DAYS;
      if (context.auth.token.premium === true) {
        warrantyDays = PREMIUM_WARRANTY_DAYS;
      }
      const warrantyEndDate = new Date();
      warrantyEndDate.setDate(warrantyEndDate.getDate() + warrantyDays);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now,
        habilitarCalificacion: true,
        paymentStatus: "retenido_para_liberacion",
        ratingWindowExpiresAt: ratingWindowExpiresTimestamp,
        warrantyEndDate: warrantyEndDate.toISOString().split("T")[0], // Guardar como YYYY-MM-DD
        updatedAt: now, // Mantener un campo de última actualización
      });
      functions.logger.info(`Servicio ${servicioId} confirmado por usuario ${userId}. Calificación habilitada, pago retenido.`);
    });

    functions.logger.info("Transacción completada exitosamente para confirmServiceCompletionByUserService.");
    return { success: true, message: "Servicio confirmado exitosamente. Ya puedes calificar al prestador." };
  } catch (error) {
    functions.logger.error("Error en la transacción de confirmServiceCompletionByUserService:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al confirmar el servicio.", error);
  }
});

export const rateProviderByUserService = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando rateProviderByUserService", { structuredData: true, data });
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
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_automaticamente" && servicioData.estado !== "cerrado_con_disputa_resuelta") {
        throw new functions.https.HttpsError("failed-precondition", "El servicio no está en un estado que permita calificación por el usuario.");
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
      };
      if (comentario) {
        nuevaCalificacionUsuario.comentario = comentario;
      }

      const prestadorRef = db.collection("prestadores").doc(servicioData.prestadorId);
      const prestadorDoc = await transaction.get(prestadorRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;

      if (prestadorDoc.exists) {
        const prestadorData = prestadorDoc.data() as ProviderData;
        newRatingSum = (prestadorData.ratingSum || 0) + calificacion;
        newRatingCount = (prestadorData.ratingCount || 0) + 1;
      }

      const newAverageRating = newRatingCount > 0 ? newRatingSum / newRatingCount : 0;

      transaction.update(servicioRef, {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Si el proveedor también calificó, marcamos la calificación mutua
        ...(servicioData.calificacionPrestador && { mutualRatingCompleted: true, estado: "cerrado_con_calificacion" }),
      });

      if (prestadorDoc.exists) {
        transaction.update(prestadorRef, {
          ratingSum: newRatingSum,
          ratingCount: newRatingCount,
          rating: parseFloat(newAverageRating.toFixed(2)), // Guardar con 2 decimales
        });
      } else {
        // Esto es menos probable si el prestadorId en el servicio es válido
        transaction.set(prestadorRef, {
          ratingSum: newRatingSum,
          ratingCount: newRatingCount,
          rating: parseFloat(newAverageRating.toFixed(2)),
        });
      }
      functions.logger.info(`Usuario ${userId} calificó servicio ${servicioId} para prestador ${servicioData.prestadorId}.`);
      return { success: true, message: "Calificación registrada exitosamente." };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de rateProviderByUserService:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación.", error);
  }
});

export const calificarUsuario = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando calificarUsuario", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const prestadorId = context.auth.uid; // UID del prestador autenticado
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
  let usuarioIdParaActualizar: string | null = null;

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.prestadorId !== prestadorId) {
        throw new functions.https.HttpsError("permission-denied", "No puedes calificar este servicio como prestador.");
      }
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_automaticamente" && servicioData.estado !== "cerrado_con_disputa_resuelta") {
        throw new functions.https.HttpsError("failed-precondition", "El servicio no está en un estado que permita calificación por el prestador.");
      }
      if (!servicioData.habilitarCalificacion) {
        throw new functions.https.HttpsError("failed-precondition", "La calificación mutua para este servicio no está habilitada (el usuario debe confirmar primero).");
      }
      if (servicioData.calificacionPrestador) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado a este usuario para este servicio.");
      }
      // Verificar si la ventana de calificación ha expirado
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para calificar a este usuario ha expirado.");
      }

      usuarioIdParaActualizar = servicioData.usuarioId;

      const nuevaCalificacionPrestador: RatingData = {
        calificacion: calificacion,
        fecha: admin.firestore.Timestamp.now(),
      };
      if (comentario) {
        nuevaCalificacionPrestador.comentario = comentario;
      }

      const usuarioRef = db.collection("usuarios").doc(usuarioIdParaActualizar);
      const usuarioDoc = await transaction.get(usuarioRef);
      let newRatingSum = calificacion;
      let newRatingCount = 1;

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1;
      }
      const newAverageRating = newRatingCount > 0 ? newRatingSum / newRatingCount : 0;

      transaction.update(servicioRef, {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(servicioData.calificacionUsuario && { mutualRatingCompleted: true, estado: "cerrado_con_calificacion" }),
      });

      // Actualizar o crear el documento del usuario
      transaction.set(usuarioRef, {
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: parseFloat(newAverageRating.toFixed(2)),
        lastRatedByProviderAt: admin.firestore.FieldValue.serverTimestamp(), // Campo opcional
      }, { merge: true }); // merge: true para crear si no existe, o actualizar si existe


      functions.logger.info(`Prestador ${prestadorId} calificó servicio ${servicioId} para usuario ${usuarioIdParaActualizar}.`);
      return { success: true, message: "Calificación de usuario registrada exitosamente." };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de calificarUsuario:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación del usuario.", error);
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
    throw new functions.https.HttpsError("invalid-argument", "La 'urlEvidencia' debe ser un string.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const reporteData: any = {
    servicioId: servicioId,
    usuarioId: usuarioId,
    motivo: motivo,
    fechaReporte: admin.firestore.FieldValue.serverTimestamp(),
    estado: "pendiente", // Estado inicial del reporte
  };
  if (urlEvidencia) {
    reporteData.urlEvidencia = urlEvidencia;
  }

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
      // Verificar si la ventana para reportar/calificar ha expirado
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") {
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }

      // Actualizar el servicio a estado "en_disputa"
      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        disputeDetails: { // Guardar info básica de la disputa en el servicio
          reportedAt: admin.firestore.FieldValue.serverTimestamp(),
          reason: motivo.substring(0, 200), // Guardar un resumen
        },
      });

      // Crear el documento en la colección "reportes"
      const reporteRef = db.collection("reportes").doc(); // Generar ID automático
      transaction.set(reporteRef, {
        ...reporteData,
        prestadorId: servicioData.prestadorId, // Guardar también el ID del prestador
      });

      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteRef.id}`);
      return {
        success: true,
        message: "Problema reportado exitosamente. Nos pondremos en contacto.",
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
      .where("usuarioId", "==", usuarioId)
      .where("estado", "==", "completado_por_usuario")
      .orderBy("fechaConfirmacion", "desc") // Ordenar por fecha de confirmación más reciente
      .get();

    const serviciosCompletados: any[] = [];
    querySnapshot.forEach((doc) => {
      const servicio = doc.data();
      // Asegurarse de que fechaConfirmacion sea un Timestamp antes de convertir
      const fechaConfirmacion = servicio.fechaConfirmacion instanceof admin.firestore.Timestamp ?
                                servicio.fechaConfirmacion.toDate().toISOString() :
                                servicio.fechaConfirmacion; // O algún valor por defecto/manejo de error

      serviciosCompletados.push({
        id: doc.id,
        prestadorId: servicio.prestadorId,
        estado: servicio.estado,
        fechaConfirmacion: fechaConfirmacion,
        habilitarCalificacion: servicio.habilitarCalificacion || false,
        calificacionUsuario: servicio.calificacionUsuario || null,
        // Añade aquí otros campos que quieras devolver
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

  if (!tipoDocumento || typeof tipoDocumento !== "string" ||
      !urlDocumento || typeof urlDocumento !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tipoDocumento' y 'urlDocumento'.");
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
    estadoVerificacion: "pendiente",
  };

  try {
    await prestadorRef.update({
      documentosVerificables: admin.firestore.FieldValue.arrayUnion(nuevoDocumento),
      // También podrías querer actualizar un campo 'ultimoDocumentoSubidoAt' o similar
    });
    functions.logger.info(`Documento registrado para prestador ${prestadorId}. Tipo: ${tipoDocumento}`);
    return { success: true, message: "Documento registrado exitosamente. Pendiente de revisión." };
  } catch (error) {
    functions.logger.error(`Error al registrar documento para prestador ${prestadorId}:`, error);
    // Si el documento del prestador no existe, update fallará. Podrías usar .set con {merge: true}
    // o verificar primero si el documento existe y crearlo si no.
    // Por simplicidad, asumimos que el perfil del prestador ya existe.
    throw new functions.https.HttpsError("internal", "Error al registrar el documento.", error);
  }
});

const PALABRAS_CLAVE_PROHIBIDAS_CONTACTO = [
  "teléfono", "telefono", "celular", "móvil", "movil", "whatsapp", "tel:",
  "email", "correo", "e-mail", "@",
  "facebook", "fb.com", "instagram", "twitter", "linkedin", "tiktok",
  "calle", "avenida", "colonia", "barrio", "cp ", "c.p.", "código postal", "codigo postal",
  "apartado postal", "suite", "edificio", "núm.", "no.", "int.", "depto.",
  "contacto", "llámame", "llamame", "escríbeme", "escribeme", "sitio web", "pagina web", "www.", ".com", ".mx", ".net", ".org",
];

export const validateDocumentAndRemoveContactInfo = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo", { structuredData: true, data });

  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) {
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
      const documentos = prestadorData.documentosVerificables || [];

      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = { ...documentos[documentoIndex] }; // Copiar para modificar
      const urlDocumento = documentoAVerificar.urlDocumento;

      functions.logger.info(`Iniciando análisis de Vision API para documento: ${urlDocumento}`);
      let textoExtraido = "";
      try {
        const [result] = await visionClient.documentTextDetection(urlDocumento);
        textoExtraido = result.fullTextAnnotation?.text?.toLowerCase() || "";
        functions.logger.info(`Texto extraído (primeros 500 chars): ${textoExtraido.substring(0, 500)}`);
      } catch (visionError) {
        functions.logger.error("Error de Vision API al procesar el documento:", visionError);
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError);
      }

      // Combinar descripción y tipo del documento para el análisis de palabras clave
      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      // Detección de números de teléfono (10 dígitos, opcionalmente con +52 y separadores)
      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\s?\d){10}/g;
      const phoneMatches = textoParaAnalizar.match(phoneRegex);
      if (phoneMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...phoneMatches.map((m) => `Teléfono: ${m.trim()}`));
        functions.logger.warn("Detección de teléfono:", phoneMatches);
      }

      // Detección de correos electrónicos
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatches = textoParaAnalizar.match(emailRegex);
      if (emailMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...emailMatches.map((m) => `Email: ${m.trim()}`));
        functions.logger.warn("Detección de email:", emailMatches);
      }

      // Detección de palabras clave de direcciones
      for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
        if (textoParaAnalizar.includes(palabra.toLowerCase())) {
          if (!["teléfono", "telefono", "celular", "móvil", "movil", "whatsapp", "tel:", "email", "correo", "e-mail", "@"].includes(palabra.toLowerCase())) { // Evitar duplicar con regex
            datosSensiblesEncontrados = true;
            palabrasDetectadas.push(`Palabra clave: ${palabra}`);
            functions.logger.warn("Detección de palabra clave de dirección/contacto:", palabra);
          }
        }
      }

      documentoAVerificar.fechaVerificacion = admin.firestore.Timestamp.now();
      let nuevoEstado: DocumentoVerificable["estadoVerificacion"];
      let mensajeRespuesta: string;

      if (datosSensiblesEncontrados) {
        nuevoEstado = "Rechazado por datos sensibles detectados";
        documentoAVerificar.estadoVerificacion = nuevoEstado;
        documentoAVerificar.motivoRechazoIA = "Datos de contacto detectados.";
        documentoAVerificar.palabrasClaveDetectadasIA = palabrasDetectadas;
        mensajeRespuesta = "Rechazado por datos sensibles detectados.";
      } else {
        nuevoEstado = "Validado";
        documentoAVerificar.estadoVerificacion = nuevoEstado;
        documentoAVerificar.motivoRechazoIA = ""; // Limpiar motivo si fue aprobado
        documentoAVerificar.palabrasClaveDetectadasIA = [];
        mensajeRespuesta = "Validado correctamente.";
      }

      documentos[documentoIndex] = documentoAVerificar; // Actualizar el documento en la copia del array
      transaction.update(prestadorRef, { documentosVerificables: documentos });

      // Registrar en la colección de auditoría/logs
      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentoAVerificar.fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length, // Para tener una idea del tamaño del texto
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [],
        agenteVerificador: context.auth?.uid || "sistema_ia",
      });

      functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} actualizado a estado: ${nuevoEstado}.`);
      return { success: true, message: mensajeRespuesta, newState: nuevoEstado };
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
  if (context.auth.token.premium !== true) {
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

      // Verificar el período de garantía
      const warrantyEndDateString = servicioData.warrantyEndDate;
      if (!warrantyEndDateString) {
          throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString);
      const currentDate = new Date();

      // Ajuste para que la comparación de fechas sea correcta (el final del día de la garantía)
      warrantyEndDate.setHours(23, 59, 59, 999);

      if (currentDate > warrantyEndDate) {
          throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      // Crear la solicitud de garantía
      const nuevaSolicitudGarantiaRef = garantiasRef.doc(); // Firestore genera el ID
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.Timestamp.now(),
        estadoGarantia: "pendiente",
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      // Actualizar el servicio
      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id,
        estado: "en_disputa", // Cambiar estado del servicio a "en_disputa" o "garantia_activada"
        paymentStatus: "congelado_por_disputa", // Congelar pago
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Garantía premium activada para servicio ${servicioId} por usuario ${usuarioId}. Garantía ID: ${nuevaSolicitudGarantiaRef.id}`);
      return {
        success: true,
        message: "Solicitud de garantía premium activada exitosamente.",
        garantiaId: nuevaSolicitudGarantiaRef.id,
        estadoGarantia: "pendiente",
      };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de activarGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al activar la garantía.", error);
  }
});

export const resolverGarantiaPremium = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando resolverGarantiaPremium", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  // Verificar si el usuario es admin o moderador (ajusta los nombres de los claims según tu configuración)
  if (!(context.auth.token.admin === true || context.auth.token.moderador === true)) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permisos para resolver garantías.");
  }

  const { garantiaId, decision, comentarioResolucion } = data;
  if (!garantiaId || typeof garantiaId !== "string" ||
      !decision || (decision !== "aprobada" && decision !== "rechazada")) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'garantiaId' y una 'decision' válida ('aprobada' o 'rechazada').");
  }
  if (comentarioResolucion && typeof comentarioResolucion !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El 'comentarioResolucion' debe ser un string.");
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

      // Actualizar el servicio original
      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> = {
        garantiaResultado: decision,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true;
        // Aquí podrías añadir lógica adicional, como iniciar un reembolso,
        // o cambiar el estado del servicio a algo como "compensacion_pendiente".
        // Por ahora, solo marcamos que la compensación está autorizada.
        // El pago seguiría "congelado_por_disputa" o cambiaría según tu lógica de reembolso.
        servicioUpdateData.estado = "cerrado_con_disputa_resuelta"; // o un estado específico de garantía
      } else { // rechazada
        servicioUpdateData.compensacionAutorizada = false;
        // Si se rechaza la garantía, se podría considerar liberar el pago al prestador si estaba congelado solo por esto.
        // O cambiar el estado del servicio a "cerrado_con_disputa_resuelta".
        const servicioDoc = await transaction.get(servicioRef);
        if (servicioDoc.exists) {
            const servicioData = servicioDoc.data() as ServiceData;
            if (servicioData.paymentStatus === "congelado_por_disputa") {
                // Si estaba congelado por esta disputa/garantía, y se rechaza,
                // se podría liberar el pago si no hay otros problemas.
                // Esta lógica puede ser compleja y depender de otros factores.
                // Por ahora, solo actualizamos el resultado de la garantía.
                // La liberación del pago se manejaría por otro proceso o la función de cierre automático.
                 servicioUpdateData.estado = "cerrado_con_disputa_resuelta";
                 // Si se rechaza, y el pago estaba congelado, se podría cambiar a retenido_para_liberacion
                 // para que el cron job lo recoja si ya pasaron los 7 días.
                 servicioUpdateData.paymentStatus = "retenido_para_liberacion";
            } else {
                 servicioUpdateData.estado = "cerrado_con_disputa_resuelta";
            }
        }
      }
      transaction.update(servicioRef, servicioUpdateData);

      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      return { success: true, message: `Solicitud de garantía ${decision} exitosamente.` };
    });
  } catch (error) {
    functions.logger.error("Error en la transacción de resolverGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al resolver la garantía.", error);
  }
});


// --- NUEVA FUNCIÓN PROGRAMADA ---
export const simulateDailyAutomatedChecks = functions.pubsub
  .schedule("every 24 hours")
  // .timeZone("America/Mexico_City") // Opcional: especifica tu zona horaria
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const serviciosRef = db.collection("servicios");
    const snapshot = await serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .get();

    if (snapshot.empty) {
      functions.logger.info("No hay servicios que cumplan los criterios para revisión automática de pago.");
      return null;
    }

    const batch = db.batch();
    let SUCESS_COUNTER = 0;

    snapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      functions.logger.log(`Revisando servicio ID: ${doc.id}`, servicio);

      // Verificar que fechaConfirmacion exista y sea un Timestamp
      if (!servicio.fechaConfirmacion || !(servicio.fechaConfirmacion instanceof admin.firestore.Timestamp)) {
        functions.logger.warn(`Servicio ID: ${doc.id} no tiene fechaConfirmacion válida o no es un Timestamp.`);
        return; // Saltar este documento
      }
      const fechaConfirmacionDate = servicio.fechaConfirmacion.toDate();

      // Verificar si han pasado 7 días y no está en disputa
      // El estado "en_disputa" se verifica implícitamente porque la consulta base es "completado_por_usuario"
      // pero una doble verificación no hace daño si la lógica de estados es compleja.
      // El filtro principal ya nos da "completado_por_usuario", lo que implica que no está "en_disputa".
      if (fechaConfirmacionDate <= sevenDaysAgo) {
        functions.logger.info(`Servicio ID: ${doc.id} cumple condiciones para liberación de pago.`);
        batch.update(doc.ref, {
          paymentStatus: "liberado_al_proveedor",
          fechaLiberacionPago: admin.firestore.FieldValue.serverTimestamp(),
          estado: "cerrado_automaticamente", // Cambiar estado a cerrado
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        SUCESS_COUNTER++;
        functions.logger.log(`Programado para liberación de pago y cierre: Servicio ID ${doc.id}`);
      } else {
        functions.logger.log(`Servicio ID: ${doc.id} aún no cumple los 7 días desde la confirmación.`);
      }
    });

    if (SUCESS_COUNTER > 0) {
        await batch.commit();
        functions.logger.info(`Lote de ${SUCESS_COUNTER} actualizaciones de servicios completado.`);
    } else {
        functions.logger.info("No se realizaron actualizaciones en este ciclo.");
    }
    return null;
  });

    