
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
  calificacionUsuario?: { // Calificación del usuario hacia el prestador
    calificacion: number;
    comentario?: string;
    fecha: admin.firestore.Timestamp;
  };
  calificacionPrestador?: { // Calificación del prestador hacia el usuario
    calificacion: number;
    comentario?: string;
    fecha: admin.firestore.Timestamp;
  };
  mutualRatingCompleted?: boolean; // Se establece a true cuando ambas partes han calificado
  fechaConfirmacion?: admin.firestore.Timestamp;
  paymentStatus?: string;
  ratingWindowExpiresAt?: admin.firestore.Timestamp;
  warrantyEndDate?: admin.firestore.Timestamp;
  // ... otros campos relevantes
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
  ratingSum?: number; // Suma de todas las calificaciones recibidas
  ratingCount?: number; // Número total de calificaciones recibidas
  rating?: number; // Promedio de calificaciones (calculado)
  documentosVerificables?: DocumentoVerificable[];
  // ... otros campos del prestador
}

// Interfaz para los datos del documento del usuario (en colección 'usuarios')
interface UserData {
  displayName?: string;
  email?: string;
  ratingSumUsuario?: number;  // Suma de calificaciones recibidas como usuario por prestadores
  ratingCountUsuario?: number; // Número de calificaciones recibidas como usuario
  ratingUsuario?: number;     // Promedio de calificación como usuario (calculado)
  // ... otros campos del perfil de usuario
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
    // 1. Verificar autenticación del usuario
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

        // 2. Verificar que el campo `estado` del servicio sea exactamente `completado_por_prestador`.
        if (servicioData.estado !== "completado_por_prestador") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Se esperaba: completado_por_prestador.`
          );
        }

        // 3. Verificar que el ID del usuario que intenta confirmar coincida con el campo `usuarioId` del servicio.
        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "El usuario no está autorizado para confirmar este servicio."
          );
        }

        // 4. Si las verificaciones anteriores se cumplen:
        const updateData: Partial<ServiceData> = { // Usar Partial para mejor tipado
          estado: "completado_por_usuario", // Cambiar el campo `estado` a `completado_por_usuario`.
          fechaConfirmacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp, // Guardar la fecha y hora actual en `fechaConfirmacion`.
          habilitarCalificacion: true, // Activar la bandera `habilitarCalificacion: true`.
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
            Date.now() + warrantyDurationDays * 24 * 60 * 60 * 1000
        );

        transaction.update(servicioRef, updateData);
      });

      console.log(
        `Proceso de retención de pago iniciado para el servicio ${servicioId}. El pago se liberará después del período de gracia si no hay reclamos.`
      );

      return {
        success: true,
        message: "Finalización del servicio confirmada exitosamente. Sistema de calificación activado y pago retenido.",
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


// Interfaz para los datos de entrada de la función calificarPrestador
interface CalificarPrestadorData {
  servicioId: string;
  calificacion: number; // 1 a 5 estrellas
  comentario?: string;
}

/**
 * Firebase Function (onCall) para que un usuario califique a un prestador.
 * Renombrada de rateProviderByUserService a calificarPrestador para consistencia.
 */
export const calificarPrestador = functions.https.onCall(
  async (data: CalificarPrestadorData, context) => {
    // 1. Validar que el usuario está autenticado.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada mientras el usuario está autenticado."
      );
    }
    const userId = context.auth.uid; // UID del usuario que califica
    const { servicioId, calificacion, comentario } = data;

    // Validar entrada
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
        // 2. Buscar el documento del servicio.
        const servicioDoc = await transaction.get(servicioRef);
        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        // Verificar que el usuario actual es quien solicitó el servicio
        if (servicioData.usuarioId !== userId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "No estás autorizado para calificar este servicio ya que no lo solicitaste."
          );
        }
        
        // 3. Verificar que habilitarCalificacion sea true y que no exista calificación previa del usuario.
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

        // 4. Guardar la calificación dentro del documento del servicio.
        const nuevaCalificacionParaServicio: NonNullable<ServiceData['calificacionUsuario']> = {
          calificacion: calificacion,
          comentario: comentario || "",
          fecha: admin.firestore.Timestamp.now(),
        };
        
        const updateServicioData: Partial<ServiceData> = {
          calificacionUsuario: nuevaCalificacionParaServicio,
        };

        // 5. Actualizar el promedio general del prestador en la colección `prestadores`.
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
        
        // Verificar si la otra parte ya calificó para marcar mutualRatingCompleted
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


// Interfaz para los datos de entrada de la función calificarUsuario
interface CalificarUsuarioData {
  servicioId: string;
  calificacion: number; // 1 a 5 estrellas
  comentario?: string;
}

/**
 * Firebase Function (onCall) para que un prestador califique a un usuario.
 */
export const calificarUsuario = functions.https.onCall(
  async (data: CalificarUsuarioData, context) => {
    // 1. Validar que el usuario (prestador) está autenticado.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "La función debe ser llamada mientras el prestador está autenticado."
      );
    }
    const prestadorIdAuth = context.auth.uid; // UID del prestador que califica
    const { servicioId, calificacion, comentario } = data;

    // Validar entrada
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
        // 2. Buscar el documento del servicio.
        const servicioDoc = await transaction.get(servicioRef);
        if (!servicioDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `El servicio con ID ${servicioId} no fue encontrado.`
          );
        }

        const servicioData = servicioDoc.data() as ServiceData;

        // 3. Verificar que el prestador autenticado es quien realizó el servicio.
        if (servicioData.prestadorId !== prestadorIdAuth) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "No estás autorizado para calificar este servicio ya que no lo prestaste."
          );
        }
        
        // Verificar que el servicio esté en un estado que permita la calificación por parte del prestador.
        // (Ej: el usuario ya confirmó la finalización).
        // La bandera 'habilitarCalificacion' es establecida por el usuario al confirmar.
        if (servicioData.habilitarCalificacion !== true) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "La calificación (mutua) no está habilitada para este servicio aún. El usuario debe confirmar primero."
          );
        }

        // Verificar que no exista calificación previa del prestador para este servicio.
        if (servicioData.calificacionPrestador) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Ya has calificado a este usuario por este servicio previamente."
          );
        }

        // 4. Guardar la calificación dentro del documento del servicio.
        const nuevaCalificacionParaServicio: NonNullable<ServiceData['calificacionPrestador']> = {
          calificacion: calificacion,
          comentario: comentario || "",
          fecha: admin.firestore.Timestamp.now(),
        };
        
        const updateServicioData: Partial<ServiceData> = {
          calificacionPrestador: nuevaCalificacionParaServicio,
        };

        // 5. Actualizar el promedio general del usuario en la colección `usuarios`.
        if (!servicioData.usuarioId) {
            console.error("Error: El servicio no tiene un usuarioId asociado.");
            throw new functions.https.HttpsError("internal", "El servicio no tiene un ID de usuario asociado.");
        }
        const usuarioRef = db.collection("usuarios").doc(servicioData.usuarioId);
        const usuarioDoc = await transaction.get(usuarioRef);

        // Si el documento del usuario no existe, se puede crear con la primera calificación.
        // O se puede optar por lanzar un error si se espera que el usuario ya exista.
        // Por ahora, crearemos/actualizaremos.
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
          // Si el usuario no existe, creamos el documento.
          // Aquí podrías querer añadir otros campos iniciales para el perfil del usuario.
          transaction.set(usuarioRef, {
            ratingSumUsuario: newRatingSum,
            ratingCountUsuario: newRatingCount,
            ratingUsuario: newAverageRating,
            // fechaCreacion: admin.firestore.FieldValue.serverTimestamp(), // Ejemplo
          });
        }
        
        // Verificar si la otra parte (usuario) ya calificó para marcar mutualRatingCompleted
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

/**
 * Firebase Function (onCall) para que un usuario reporte un problema con un servicio.
 */
export const reportarProblemaServicio = functions.https.onCall(
  async (data: ReportarProblemaData, context) => {
    // 1. Validar que el usuario está autenticado.
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
    }
    const usuarioId = context.auth.uid;
    const { servicioId, motivo, urlEvidencia } = data;

    // 2. Validar parámetros recibidos.
    if (!servicioId || !motivo) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren los argumentos 'servicioId' y 'motivo'.");
    }

    try {
      // 3. Verificar que el servicio exista.
      const servicioRef = db.collection("servicios").doc(servicioId);
      const servicioDoc = await servicioRef.get();

      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `El servicio con ID ${servicioId} no fue encontrado.`);
      }
      
      // Opcional: Verificar que el usuario que reporta es el 'usuarioId' del servicio.
      // const servicioData = servicioDoc.data() as ServiceData;
      // if (servicioData.usuarioId !== usuarioId) {
      //   throw new functions.https.HttpsError("permission-denied", "No estás autorizado para reportar un problema sobre este servicio.");
      // }

      // 4. Crear un nuevo documento en la colección `reportes`.
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

/**
 * Firebase Function (onCall) para obtener los servicios completados por el usuario.
 */
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

/**
 * Firebase Function (onCall) para que un prestador registre un documento profesional.
 */
export const registrarDocumentoProfesional = functions.https.onCall(
  async (data: RegistrarDocumentoData, context) => {
    // 1. Validar que el usuario (prestador) está autenticado.
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un prestador autenticado.");
    }
    const prestadorId = context.auth.uid; // El UID del prestador autenticado
    const { tipoDocumento, urlDocumento, descripcion } = data;

    // 2. Validar parámetros recibidos.
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

      await prestadorRef.update({
        documentosVerificables: admin.firestore.FieldValue.arrayUnion(nuevoDocumento),
      });

      return {
        success: true,
        message: "Documento registrado exitosamente. Está pendiente de revisión.",
      };
    } catch (error: any) {
      console.error("Error al registrar el documento profesional:", error);
      if (error.code === 5) { 
         throw new functions.https.HttpsError("not-found", `No se encontró el perfil del prestador con ID ${prestadorId}.`);
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


/**
 * Firebase Function (onCall) para simular la verificación de un documento profesional.
 */
export const verificarDocumentoProfesional = functions.https.onCall(
  async (data: VerificarDocumentoData, context) => {
     if (!context.auth ) { 
       throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
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

    