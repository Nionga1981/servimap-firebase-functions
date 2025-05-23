
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
        const updateData: { [key: string]: any } = {
          estado: "completado_por_usuario", // Cambiar el campo `estado` a `completado_por_usuario`.
          fechaConfirmacion: admin.firestore.FieldValue.serverTimestamp(), // Guardar la fecha y hora actual en `fechaConfirmacion`.
          habilitarCalificacion: true, // Activar la bandera `habilitarCalificacion: true`.
          paymentStatus: "retenido_para_liberacion",
          ratingWindowExpiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 días desde ahora
          ),
        };
        
        // Lógica de garantía (ejemplo, basada en custom claims)
        const isUserPremium = context.auth?.token?.premium === true; // Asume que tienes un custom claim 'premium'
        const standardWarrantyDays = 3;
        const premiumWarrantyDays = 7; 
        const warrantyDurationDays = isUserPremium
          ? premiumWarrantyDays
          : standardWarrantyDays;
        
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
        const nuevaCalificacionParaServicio: ServiceData['calificacionUsuario'] = {
          calificacion: calificacion,
          comentario: comentario || "",
          fecha: admin.firestore.Timestamp.now(),
        };
        
        const updateServicioData: { [key: string]: any } = {
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
          // Podrías decidir si lanzar un error aquí o continuar solo guardando la calificación en el servicio.
          // Por ahora, la transacción fallará si el prestador no existe, lo cual es un comportamiento razonable.
          throw new functions.https.HttpsError("not-found", `Prestador con ID ${servicioData.prestadorId} no encontrado.`);
        } else {
          const prestadorData = prestadorDoc.data() as ProviderData;
          const currentRatingSum = prestadorData.ratingSum || 0;
          const currentRatingCount = prestadorData.ratingCount || 0;

          const newRatingSum = currentRatingSum + calificacion;
          const newRatingCount = currentRatingCount + 1;
          // Usar parseFloat y toFixed para asegurar que el promedio se guarde con máximo 2 decimales
          const newAverageRating = parseFloat((newRatingSum / newRatingCount).toFixed(2)); 

          transaction.update(prestadorRef, {
            ratingSum: newRatingSum,
            ratingCount: newRatingCount,
            rating: newAverageRating, // Este es el promedioCalificaciones
          });
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
    // Podrías añadir validaciones más específicas para tipoDocumento o formato de URL si es necesario.

    try {
      const prestadorRef = db.collection("prestadores").doc(prestadorId);

      // 3. Crear el objeto del nuevo documento.
      const nuevoDocumento: DocumentoVerificable = {
        tipoDocumento: tipoDocumento,
        urlDocumento: urlDocumento,
        descripcion: descripcion || "",
        fechaRegistro: admin.firestore.Timestamp.now(), // Timestamp del servidor
        estadoVerificacion: "pendiente", // Estado inicial
      };

      // 4. Usar FieldValue.arrayUnion para añadir el nuevo documento al arreglo.
      // Esto evita duplicados si se intentara añadir el mismo objeto exacto.
      // Si el campo 'documentosVerificables' no existe, se creará.
      await prestadorRef.update({
        documentosVerificables: admin.firestore.FieldValue.arrayUnion(nuevoDocumento),
      });

      // 5. Devolver un mensaje de confirmación.
      return {
        success: true,
        message: "Documento registrado exitosamente. Está pendiente de revisión.",
      };
    } catch (error: any) {
      console.error("Error al registrar el documento profesional:", error);
      // Podrías verificar si el error es porque el documento del prestador no existe.
      if (error.code === 5) { // Código para NOT_FOUND
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

// Interfaz para datos de entrada de la función de verificación de documentos
interface VerificarDocumentoData {
  prestadorId: string;
  documentoIndex: number; // Índice del documento en el array documentosVerificables
}

// Palabras clave prohibidas para la simulación de IA
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
    // Validar que quien llama es un admin (o una función interna con permisos)
    // Para este ejemplo, se podría requerir un custom claim de admin
    // if (!context.auth || !context.auth.token.admin) {
    //   throw new functions.https.HttpsError("permission-denied", "Solo los administradores pueden verificar documentos.");
    // }
     if (!context.auth ) { // Por ahora, solo autenticado
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

        // SIMULACIÓN DE ANÁLISIS CON IA
        // En una app real, aquí llamarías a una API de IA (ej. Cloud Vision API para OCR y luego NLP, o Genkit)
        // Para la simulación, solo revisamos la descripción y tipo por palabras clave.
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

        // Actualizar el documento específico en el array
        documentosActuales[documentoIndex] = {
          ...documentoAVerificar,
          estadoVerificacion: nuevoEstado,
          fechaVerificacion: admin.firestore.Timestamp.now(),
        };

        transaction.update(prestadorRef, { documentosVerificables: documentosActuales });

        // (Opcional) Registrar en la colección verificacionesIA
        const verificacionLogRef = db.collection("verificacionesIA").doc(); // Generar ID automático
        transaction.set(verificacionLogRef, {
          prestadorId: prestadorId,
          documentoUrl: documentoAVerificar.urlDocumento,
          documentoTipo: documentoAVerificar.tipoDocumento,
          documentoIndex: documentoIndex,
          fechaVerificacion: admin.firestore.FieldValue.serverTimestamp(),
          resultadoIA: nuevoEstado,
          palabrasClaveDetectadas: palabrasDetectadas.length > 0 ? palabrasDetectadas : null,
          revisadoManualmente: false, // Inicialmente no revisado manualmente
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
// Agrega otras funciones aquí si es necesario.

