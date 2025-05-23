
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Inicializa Firebase Admin SDK.
// Es importante que esto se haga solo una vez.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Interfaz para los datos del documento de servicio
interface ServiceData {
  estado?: string;
  usuarioId?: string; // ID del usuario que solicitó el servicio
  prestadorId?: string; // ID del proveedor
  habilitarCalificacion?: boolean;
  calificacionUsuario?: {
    calificacion: number;
    comentario?: string;
    fecha: admin.firestore.Timestamp;
  };
  calificacionPrestador?: {
    calificacion: number;
    comentario?: string;
    fecha: admin.firestore.Timestamp;
  };
  mutualRatingCompleted?: boolean; // Se establece a true cuando ambas partes han calificado
  fechaConfirmacion?: admin.firestore.Timestamp;
  paymentStatus?: string;
  ratingWindowExpiresAt?: admin.firestore.Timestamp;
  warrantyEndDate?: admin.firestore.Timestamp;
  garantiaSolicitada?: boolean;
  idSolicitudGarantia?: string;
  garantiaResultado?: "aprobada" | "rechazada"; // Nuevo campo
  compensacionAutorizada?: boolean; // Nuevo campo
}

// Interfaz para los datos de un documento verificable
interface DocumentoVerificable {
  tipoDocumento: string;
  urlDocumento: string;
  descripcion?: string;
  fechaRegistro: admin.firestore.Timestamp;
  estadoVerificacion: "pendiente" | "verificado_ia" | "rechazado_ia" | "verificado_manual" | "rechazado_manual";
  fechaVerificacion?: admin.firestore.Timestamp;
}

// Interfaz para los datos del documento del prestador
interface ProviderData {
  ratingSum?: number;
  ratingCount?: number;
  rating?: number;
  documentosVerificables?: DocumentoVerificable[];
}

// Interfaz para los datos del documento del usuario (en colección 'usuarios')
interface UserData {
  displayName?: string;
  email?: string;
  ratingSumUsuario?: number;
  ratingCountUsuario?: number;
  ratingUsuario?: number;
}

// Interfaz para una solicitud de garantía
interface GarantiaData {
  servicioId: string;
  usuarioId: string;
  prestadorId: string;
  motivo: string;
  fechaSolicitudGarantia: admin.firestore.Timestamp;
  estadoGarantia: "pendiente" | "en_revision" | "aprobada" | "rechazada"; // Estados actualizados
  fechaResolucionGarantia?: admin.firestore.Timestamp;
  resolucionDetalles?: string;
  resueltaPor?: string; // UID del admin/moderador
}


// Interfaz para los datos de entrada de la función confirmServiceCompletionByUserService
interface ConfirmServiceCompletionData {
  servicioId: string;
}

/**
 * Firebase Function (onCall) para que un usuario confirme la finalización de un servicio.
 */
export const confirmServiceCompletionByUserService = functions.https.onCall(
  async (data: ConfirmServiceCompletionData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada mientras el usuario está autenticado."
      );
    }
    const userId = context.auth.uid;
    const { servicioId } = data;

    if (!servicioId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere el argumento 'servicioId'."
      );
    }

    const servicioRef = db.collection("servicios").doc(servicioId);

    try {
      await db.runTransaction(async (transaction) => {
        const servicioDoc = await transaction.get(servicioRef);

        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        if (servicioData.estado !== "completado_por_prestador") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Se esperaba: completado_por_prestador.`
          );
        }

        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "El usuario no está autorizado para confirmar este servicio."
          );
        }

        const updateData: Partial<ServiceData> = { 
          estado: "completado_por_usuario", 
          fechaConfirmacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp, 
          habilitarCalificacion: true, 
          paymentStatus: "retenido_para_liberacion",
          ratingWindowExpiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 días desde ahora
          ),
        };
        
        const isUserPremium = context.auth?.token?.premium === true;
        const STANDARD_WARRANTY_DAYS = 3;
        const PREMIUM_WARRANTY_DAYS = 7;
        
        const warrantyDurationDays = isUserPremium
          ? PREMIUM_WARRANTY_DAYS
          : STANDARD_WARRANTY_DAYS;
        
        updateData.warrantyEndDate = admin.firestore.Timestamp.fromMillis(
            (updateData.fechaConfirmacion as admin.firestore.Timestamp).toMillis() + warrantyDurationDays * 24 * 60 * 60 * 1000
        );

        transaction.update(servicioRef, updateData);
      });

      console.log(
        `Proceso de retención de pago iniciado para el servicio ${servicioId}. El pago se liberará después del período de gracia si no hay reclamos.`
      );

      return {
        success: true,
        message: "Finalización del servicio confirmada exitosamente. Sistema de calificación activado, pago retenido y garantía establecida.",
      };
    } catch (error: any) {
      console.error("Error al confirmar la finalización del servicio:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al procesar la solicitud.",
        error.message 
      );
    }
  }
);


interface CalificarPrestadorData {
  servicioId: string;
  calificacion: number;
  comentario?: string;
}

export const calificarPrestador = functions.https.onCall(
  async (data: CalificarPrestadorData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada mientras el usuario está autenticado."
      );
    }
    const userId = context.auth.uid; 
    const { servicioId, calificacion, comentario } = data;

    if (!servicioId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere el argumento 'servicioId'."
      );
    }
    if (typeof calificacion !== 'number' || calificacion < 1 || calificacion > 5) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La calificación debe ser un número entre 1 y 5."
      );
    }

    const servicioRef = db.collection("servicios").doc(servicioId);

    try {
      await db.runTransaction(async (transaction) => {
        const servicioDoc = await transaction.get(servicioRef);
        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "No estás autorizado para calificar este servicio ya que no lo solicitaste."
          );
        }
        
        if (servicioData.habilitarCalificacion !== true) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "La calificación no está habilitada para este servicio."
          );
        }
        if (servicioData.calificacionUsuario) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Ya has calificado este servicio previamente."
          );
        }

        const nuevaCalificacionParaServicio: NonNullable<ServiceData['calificacionUsuario']> = {
          calificacion: calificacion,
          comentario: comentario || "",
          fecha: admin.firestore.Timestamp.now(),
        };
        
        const updateServicioData: Partial<ServiceData> = {
          calificacionUsuario: nuevaCalificacionParaServicio,
        };

        if (!servicioData.prestadorId) {
            console.error("Error: El servicio no tiene un prestadorId asociado.");
            throw new functions.https.HttpsError("internal", "El servicio no tiene un ID de prestador asociado.");
        }
        const prestadorRef = db.collection("prestadores").doc(servicioData.prestadorId);
        const prestadorDoc = await transaction.get(prestadorRef);

        if (!prestadorDoc.exists) {
          console.error(`Error: No se encontró el prestador con ID ${servicioData.prestadorId}. No se puede actualizar su calificación.`);
          throw new functions.https.HttpsError("not-found", `Prestador con ID ${servicioData.prestadorId} no encontrado.`);
        } else {
          const prestadorData = prestadorDoc.data() as ProviderData;
          const currentRatingSum = prestadorData.ratingSum || 0;
          const currentRatingCount = prestadorData.ratingCount || 0;

          const newRatingSum = currentRatingSum + calificacion;
          const newRatingCount = currentRatingCount + 1;
          const newAverageRating = parseFloat((newRatingSum / newRatingCount).toFixed(2)); 

          transaction.update(prestadorRef, {
            ratingSum: newRatingSum,
            ratingCount: newRatingCount,
            rating: newAverageRating,
          });
        }
        
        if (servicioData.calificacionPrestador) {
          updateServicioData.mutualRatingCompleted = true;
        }

        transaction.update(servicioRef, updateServicioData);
      });

      return {
        success: true,
        message: "Calificación guardada exitosamente.",
      };
    } catch (error: any) {
      console.error("Error al guardar la calificación:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al guardar la calificación.",
        error.message
      );
    }
  }
);


interface CalificarUsuarioData {
  servicioId: string;
  calificacion: number;
  comentario?: string;
}

export const calificarUsuario = functions.https.onCall(
  async (data: CalificarUsuarioData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada mientras el prestador está autenticado."
      );
    }
    const prestadorIdAuth = context.auth.uid; 
    const { servicioId, calificacion, comentario } = data;

    if (!servicioId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere el argumento 'servicioId'."
      );
    }
    if (typeof calificacion !== 'number' || calificacion < 1 || calificacion > 5) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La calificación debe ser un número entre 1 y 5."
      );
    }

    const servicioRef = db.collection("servicios").doc(servicioId);

    try {
      await db.runTransaction(async (transaction) => {
        const servicioDoc = await transaction.get(servicioRef);
        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        if (servicioData.prestadorId !== prestadorIdAuth) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "No estás autorizado para calificar este servicio ya que no lo prestaste."
          );
        }
        
        if (servicioData.habilitarCalificacion !== true) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "La calificación (mutua) no está habilitada para este servicio aún. El usuario debe confirmar primero."
          );
        }

        if (servicioData.calificacionPrestador) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Ya has calificado a este usuario por este servicio previamente."
          );
        }

        const nuevaCalificacionParaServicio: NonNullable<ServiceData['calificacionPrestador']> = {
          calificacion: calificacion,
          comentario: comentario || "",
          fecha: admin.firestore.Timestamp.now(),
        };
        
        const updateServicioData: Partial<ServiceData> = {
          calificacionPrestador: nuevaCalificacionParaServicio,
        };

        if (!servicioData.usuarioId) {
            console.error("Error: El servicio no tiene un usuarioId asociado.");
            throw new functions.https.HttpsError("internal", "El servicio no tiene un ID de usuario asociado.");
        }
        const usuarioRef = db.collection("usuarios").doc(servicioData.usuarioId);
        const usuarioDoc = await transaction.get(usuarioRef);

        const usuarioData = (usuarioDoc.exists ? usuarioDoc.data() : {}) as UserData;
        const currentRatingSum = usuarioData.ratingSumUsuario || 0;
        const currentRatingCount = usuarioData.ratingCountUsuario || 0;

        const newRatingSum = currentRatingSum + calificacion;
        const newRatingCount = currentRatingCount + 1;
        const newAverageRating = parseFloat((newRatingSum / newRatingCount).toFixed(2)); 

        if (usuarioDoc.exists) {
          transaction.update(usuarioRef, {
            ratingSumUsuario: newRatingSum,
            ratingCountUsuario: newRatingCount,
            ratingUsuario: newAverageRating,
          });
        } else {
          // Si el documento del usuario no existe, créalo con los datos de calificación
          transaction.set(usuarioRef, {
            ratingSumUsuario: newRatingSum,
            ratingCountUsuario: newRatingCount,
            ratingUsuario: newAverageRating,
            // Podrías añadir otros campos por defecto aquí si es necesario
            // email: context.auth.token.email, // si está disponible
            // displayName: "Usuario Nuevo" 
          });
        }
        
        if (servicioData.calificacionUsuario) {
          updateServicioData.mutualRatingCompleted = true;
        }

        transaction.update(servicioRef, updateServicioData);
      });

      return {
        success: true,
        message: "Calificación de usuario guardada exitosamente.",
      };
    } catch (error: any) {
      console.error("Error al guardar la calificación del usuario:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al guardar la calificación del usuario.",
        error.message
      );
    }
  }
);


interface ReportarProblemaData {
  servicioId: string;
  motivo: string;
  urlEvidencia?: string;
}

export const reportarProblemaServicio = functions.https.onCall(
  async (data: ReportarProblemaData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
    }
    const usuarioId = context.auth.uid;
    const { servicioId, motivo, urlEvidencia } = data;

    if (!servicioId || !motivo) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren los argumentos 'servicioId' y 'motivo'.");
    }

    try {
      const servicioRef = db.collection("servicios").doc(servicioId);
      const servicioDoc = await servicioRef.get();

      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `El servicio con ID ${servicioId} no fue encontrado.`);
      }
      
      const reporteData: { [key: string]: any } = {
        servicioId: servicioId,
        usuarioId: usuarioId, 
        motivo: motivo,
        fechaReporte: admin.firestore.FieldValue.serverTimestamp(), 
        estado: "pendiente", 
      };

      if (urlEvidencia) {
        reporteData.urlEvidencia = urlEvidencia;
      }

      const reporteRef = await db.collection("reportes").add(reporteData);

      return {
        success: true,
        message: "Problema reportado exitosamente.",
        reporteId: reporteRef.id,
      };
    } catch (error: any) {
      console.error("Error al reportar el problema:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al reportar el problema.",
        error.message
      );
    }
  }
);

export const obtenerServiciosCompletados = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "La función debe ser llamada por un usuario autenticado."
    );
  }
  const usuarioId = context.auth.uid;

  try {
    const querySnapshot = await db
      .collection("servicios")
      .where("usuarioId", "==", usuarioId)
      .where("estado", "==", "completado_por_usuario")
      .orderBy("fechaConfirmacion", "desc") 
      .get();

    const serviciosCompletados: any[] = [];
    querySnapshot.forEach((doc) => {
      serviciosCompletados.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return serviciosCompletados;
  } catch (error: any) {
    console.error("Error al obtener servicios completados:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      "Ocurrió un error interno al obtener los servicios.",
      error.message
    );
  }
});


interface RegistrarDocumentoData {
  tipoDocumento: string;
  urlDocumento: string;
  descripcion?: string;
}

export const registrarDocumentoProfesional = functions.https.onCall(
  async (data: RegistrarDocumentoData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un prestador autenticado.");
    }
    const prestadorId = context.auth.uid; 
    const { tipoDocumento, urlDocumento, descripcion } = data;

    if (!tipoDocumento || !urlDocumento) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren los argumentos 'tipoDocumento' y 'urlDocumento'.");
    }

    try {
      const prestadorRef = db.collection("prestadores").doc(prestadorId);

      const nuevoDocumento: DocumentoVerificable = {
        tipoDocumento: tipoDocumento,
        urlDocumento: urlDocumento,
        descripcion: descripcion || "",
        fechaRegistro: admin.firestore.Timestamp.now(),
        estadoVerificacion: "pendiente",
      };
      
      await prestadorRef.set({
        documentosVerificables: admin.firestore.FieldValue.arrayUnion(nuevoDocumento),
      }, { merge: true });


      return {
        success: true,
        message: "Documento registrado exitosamente. Está pendiente de revisión.",
      };
    } catch (error: any) {
      console.error("Error al registrar el documento profesional:", error);
      if (error.code === 5) { 
         throw new functions.https.HttpsError("not-found", `No se encontró el perfil del prestador con ID ${prestadorId}. Asegúrate de que el perfil exista.`);
      }
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al registrar el documento.",
        error.message
      );
    }
  }
);


interface VerificarDocumentoData {
  prestadorId: string;
  documentoIndex: number; 
}


const PALABRAS_CLAVE_PROHIBIDAS = [
  "teléfono", "telefono", "celular", "whatsapp", "contacto", "contactame", "llámame", "llamame",
  "email", "correo", "@", "facebook", "instagram", "twitter", "linkedin",
  "escríbeme", "escribeme", "sitio web", "pagina web", "url", "http", "https", "www",
];

export const verificarDocumentoProfesional = functions.https.onCall(
  async (data: VerificarDocumentoData, context) => {
     if (!context.auth || context.auth.token.admin !== true ) { // Asumiendo un custom claim 'admin'
       throw new functions.https.HttpsError("permission-denied", "La función debe ser llamada por un usuario autenticado con permisos de administrador.");
     }

    const { prestadorId, documentoIndex } = data;

    if (!prestadorId || typeof documentoIndex !== 'number' || documentoIndex < 0) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren 'prestadorId' y 'documentoIndex' válido.");
    }

    const prestadorRef = db.collection("prestadores").doc(prestadorId);
    let nuevoEstado: DocumentoVerificable["estadoVerificacion"] = "rechazado_ia";
    let palabrasDetectadas: string[] = [];

    try {
      await db.runTransaction(async (transaction) => {
        const prestadorDoc = await transaction.get(prestadorRef);
        if (!prestadorDoc.exists) {
          throw new functions.https.HttpsError("not-found", `El prestador con ID ${prestadorId} no fue encontrado.`);
        }

        const prestadorData = prestadorDoc.data() as ProviderData;
        if (!prestadorData.documentosVerificables || prestadorData.documentosVerificables.length <= documentoIndex) {
          throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango para el prestador ${prestadorId}.`);
        }

        const documentosActuales = [...prestadorData.documentosVerificables];
        const documentoAVerificar = documentosActuales[documentoIndex];

        console.log(`Simulando análisis IA para documento: ${documentoAVerificar.urlDocumento}`);
        const textoAAnalizar = (`${documentoAVerificar.tipoDocumento} ${documentoAVerificar.descripcion || ""}`).toLowerCase();
        
        let seEncontroPalabraProhibida = false;
        for (const palabra of PALABRAS_CLAVE_PROHIBIDAS) {
          if (textoAAnalizar.includes(palabra.toLowerCase())) {
            seEncontroPalabraProhibida = true;
            palabrasDetectadas.push(palabra);
          }
        }

        if (seEncontroPalabraProhibida) {
          nuevoEstado = "rechazado_ia";
          console.log(`IA detectó datos de contacto. Palabras: ${palabrasDetectadas.join(", ")}`);
        } else {
          nuevoEstado = "verificado_ia";
          console.log("IA no detectó datos de contacto. Documento aprobado por IA.");
        }

        documentosActuales[documentoIndex] = {
          ...documentoAVerificar,
          estadoVerificacion: nuevoEstado,
          fechaVerificacion: admin.firestore.Timestamp.now(),
        };

        transaction.update(prestadorRef, { documentosVerificables: documentosActuales });

        const verificacionLogRef = db.collection("verificacionesIA").doc(); 
        transaction.set(verificacionLogRef, {
          prestadorId: prestadorId,
          documentoUrl: documentoAVerificar.urlDocumento,
          documentoTipo: documentoAVerificar.tipoDocumento,
          documentoIndex: documentoIndex,
          fechaVerificacion: admin.firestore.FieldValue.serverTimestamp(),
          resultadoIA: nuevoEstado,
          palabrasClaveDetectadas: palabrasDetectadas.length > 0 ? palabrasDetectadas : null,
          revisadoManualmente: false, 
        });
      });

      return {
        success: true,
        message: `Documento en índice ${documentoIndex} del prestador ${prestadorId} verificado. Nuevo estado: ${nuevoEstado}.`,
        prestadorId: prestadorId,
        documentoIndex: documentoIndex,
        nuevoEstado: nuevoEstado,
      };
    } catch (error: any) {
      console.error("Error al verificar el documento:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al verificar el documento.",
        error.message
      );
    }
  }
);


interface ActivarGarantiaData {
  servicioId: string;
  motivo: string;
}

export const activarGarantiaPremium = functions.https.onCall(
  async (data: ActivarGarantiaData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
    }
    const usuarioId = context.auth.uid;

    if (context.auth.token.premium !== true) {
      throw new functions.https.HttpsError("permission-denied", "Esta función solo está disponible para usuarios premium.");
    }

    const { servicioId, motivo } = data;
    if (!servicioId || !motivo) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo'.");
    }

    const servicioRef = db.collection("servicios").doc(servicioId);
    const garantiasCollectionRef = db.collection("garantias");

    try {
      const resultadoTransaccion = await db.runTransaction(async (transaction) => {
        const servicioDoc = await transaction.get(servicioRef);
        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
        }

        const servicioData = servicioDoc.data() as ServiceData;

        if (servicioData.usuarioId !== usuarioId) {
          throw new functions.https.HttpsError("permission-denied", "No estás autorizado para solicitar garantía sobre este servicio.");
        }

        if (servicioData.estado !== "completado_por_usuario") {
          throw new functions.https.HttpsError("failed-precondition", `El servicio no está en estado 'completado_por_usuario' (estado actual: ${servicioData.estado}).`);
        }

        if (servicioData.garantiaSolicitada === true) {
          throw new functions.https.HttpsError("failed-precondition", "Ya se ha solicitado una garantía para este servicio.");
        }
        
        if (!servicioData.warrantyEndDate || !servicioData.warrantyEndDate.toMillis) {
             throw new functions.https.HttpsError("internal", "No se pudo determinar la fecha de fin de garantía para esta solicitud.");
        }
        const now = admin.firestore.Timestamp.now();
        if (now.toMillis() > servicioData.warrantyEndDate.toMillis()) {
          const fechaFinGarantiaStr = new Date(servicioData.warrantyEndDate.toMillis()).toLocaleDateString('es-ES');
          throw new functions.https.HttpsError("failed-precondition", `El período de garantía para este servicio finalizó el ${fechaFinGarantiaStr}.`);
        }
        
        const nuevaSolicitudGarantiaRef = garantiasCollectionRef.doc(); 
        const nuevaGarantiaData: GarantiaData = {
          servicioId: servicioId,
          usuarioId: usuarioId,
          prestadorId: servicioData.prestadorId || "desconocido",
          motivo: motivo,
          fechaSolicitudGarantia: now,
          estadoGarantia: "pendiente",
        };
        transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

        transaction.update(servicioRef, {
          garantiaSolicitada: true,
          idSolicitudGarantia: nuevaSolicitudGarantiaRef.id,
        });

        return {
          success: true,
          message: "Solicitud de garantía registrada exitosamente. Estado: pendiente.",
          garantiaId: nuevaSolicitudGarantiaRef.id,
          estadoGarantia: "pendiente",
        };
      });
      return resultadoTransaccion;
    } catch (error: any) {
      console.error("Error al activar la garantía:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al procesar la solicitud de garantía.",
        error.message
      );
    }
  }
);

interface ResolverGarantiaData {
  garantiaId: string;
  decision: "aprobada" | "rechazada";
  comentarioResolucion?: string;
}

export const resolverGarantiaPremium = functions.https.onCall(
  async (data: ResolverGarantiaData, context) => {
    // 1. Verificar autenticación y rol de administrador/moderador
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
    }
    // Asumimos un custom claim 'admin' o 'moderador'. Ajusta según tu implementación.
    const isAdmin = context.auth.token.admin === true;
    const isModerador = context.auth.token.moderador === true; 
    if (!isAdmin && !isModerador) {
      throw new functions.https.HttpsError("permission-denied", "No tienes permisos para resolver garantías.");
    }

    // 2. Recibir parámetros
    const { garantiaId, decision, comentarioResolucion } = data;
    if (!garantiaId || !decision || (decision !== "aprobada" && decision !== "rechazada")) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren 'garantiaId' y una 'decision' válida ('aprobada' o 'rechazada').");
    }

    const garantiaRef = db.collection("garantias").doc(garantiaId);
    const adminUid = context.auth.uid;

    try {
      await db.runTransaction(async (transaction) => {
        const garantiaDoc = await transaction.get(garantiaRef);

        // 3. Verificar que el documento de la garantía existe y su estado sea "pendiente"
        if (!garantiaDoc.exists) {
          throw new functions.https.HttpsError("not-found", `Solicitud de garantía con ID ${garantiaId} no encontrada.`);
        }
        const garantiaData = garantiaDoc.data() as GarantiaData;
        if (garantiaData.estadoGarantia !== "pendiente" && garantiaData.estadoGarantia !== "en_revision") { // Permitir resolver si está 'en_revision' también
          throw new functions.https.HttpsError("failed-precondition", `La garantía no está en estado 'pendiente' o 'en_revision'. Estado actual: ${garantiaData.estadoGarantia}.`);
        }

        // 4. Actualizar el documento de garantía
        const updateGarantia: Partial<GarantiaData> = {
          estadoGarantia: decision, // "aprobada" o "rechazada"
          fechaResolucionGarantia: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
          resolucionDetalles: comentarioResolucion || "",
          resueltaPor: adminUid,
        };
        transaction.update(garantiaRef, updateGarantia);

        // 5. Si la garantía fue "aprobada", actualizar el documento del servicio relacionado
        if (decision === "aprobada") {
          if (!garantiaData.servicioId) {
            console.warn(`La garantía ${garantiaId} no tiene un servicioId asociado. No se puede actualizar el servicio.`);
            // Podrías lanzar un error o solo loggear, dependiendo de tu lógica de negocio.
          } else {
            const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
            const updateServicio: Partial<ServiceData> = {
              garantiaResultado: "aprobada",
              compensacionAutorizada: true, // Opcional, según tu lógica de compensación
              // Podrías cambiar el estado del servicio principal aquí también si es necesario.
              // estado: "garantia_resuelta"
            };
            transaction.update(servicioRef, updateServicio);
            console.log(`Servicio ${garantiaData.servicioId} actualizado por garantía aprobada.`);
          }
        } else { // Si es rechazada
             if (garantiaData.servicioId) {
                const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
                transaction.update(servicioRef, { garantiaResultado: "rechazada" });
             }
        }
      });

      // 6. Retornar mensaje confirmando la resolución
      return {
        success: true,
        message: `Solicitud de garantía ${garantiaId} ha sido resuelta como '${decision}'.`,
      };
    } catch (error: any) {
      console.error("Error al resolver la garantía:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Ocurrió un error interno al procesar la resolución de la garantía.",
        error.message
      );
    }
  }
);

