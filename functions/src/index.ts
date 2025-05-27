
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// --- CONSTANTES ---
const STANDARD_WARRANTY_DAYS = 3; // Días de garantía estándar
const PREMIUM_WARRANTY_DAYS = 7; // Días de garantía premium
const RATING_AND_DISPUTE_WINDOW_DAYS = 3; // Días para calificar o reportar después de confirmación del usuario

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
  | "agendado" // Usuario agenda, pendiente de confirmación del prestador
  | "pendiente_confirmacion" // Usado para Citas, similar a agendado
  | "confirmada_prestador" // Prestador confirma la cita, pendiente de pago
  | "pagada" // Cita pagada (después de confirmación y cobro)
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador"
  | "completado_por_usuario" // Usuario confirma finalización
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "rechazada_prestador" // Prestador rechaza la cita
  | "en_disputa"
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta";

type CitaEstado = ServiceRequestStatus; // Reutilizamos los estados

type PaymentStatus =
  | "pendiente_confirmacion_usuario"
  | "retenido_para_liberacion"
  | "liberado_al_proveedor"
  | "congelado_por_disputa"
  | "reembolsado_parcial"
  | "reembolsado_total"
  | "no_aplica" // Para citas que aún no llegan al punto de cobro
  | "pendiente_cobro" // Cita confirmada por prestador, lista para cobro
  | "procesado_exitosamente" // Cobro de cita realizado
  | "fallido"; // Fallo en el cobro de cita


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

  detallesServicio?: string;
  precio?: number; // Para servicios de precio fijo
  categoria?: string; // Para identificar el tipo de servicio

  fechaServicio?: admin.firestore.Timestamp; // Para servicios agendados
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;

  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  fechaConfirmacion?: admin.firestore.Timestamp; // Confirmación del usuario
  userConfirmedCompletionAt?: admin.firestore.Timestamp;
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
  rating?: number; // Promedio = ratingSum / ratingCount
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
  membresiaActual?: string; // Ej: "premium_mensual"

  confirmacionesCount?: number;
  rechazosCount?: number;
  penalizacionActiva?: {
    tipo: string;
    motivo: string;
    expiraEn: admin.firestore.Timestamp;
  } | null;
  incentivos?: {
    puntosReputacion?: number;
    badges?: string[];
  };
}

interface UserData {
  uid?: string;
  name?: string;
  ratingSumUsuario?: number; // Suma de calificaciones dadas POR este usuario a prestadores
  ratingCountUsuario?: number; // Conteo de calificaciones dadas POR este usuario
  ratingUsuario?: number; // Promedio de calificaciones recibidas POR OTROS (prestadores)
  isPremium?: boolean;
  membresiaActual?: string;

  // Nuevos campos para incentivos por calificar
  serviciosCalificadosCount?: number;
  puntosReputacionUsuario?: number; // Puntos ganados por participar, calificar, etc.
  badgesUsuario?: string[]; // Ej: ["calificador_constante", "experto_en_reseñas"]
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
  fechaHoraSolicitada: admin.firestore.Timestamp; // Campo unificado para fecha y hora
  detallesServicio: string;
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;
  estado: CitaEstado;
  fechaCreacion: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  fechaRechazoPrestador?: admin.firestore.Timestamp;
  ordenCobroId?: string;

  paymentStatus?: PaymentStatus; // Extendiendo PaymentStatus
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;

  fechaCancelacion?: admin.firestore.Timestamp;
  canceladaPor?: string;
  rolCancelador?: "usuario" | "prestador";

  serviceType?: "fixed" | "hourly";
  precioServicio?: number;
  tarifaPorHora?: number;
  duracionHoras?: number;
  montoTotalEstimado?: number;
}

interface NotificacionData {
  id?: string;
  destinatarioId: string;
  rolDestinatario: 'usuario' | 'prestador';
  titulo: string;
  cuerpo: string;
  estadoNotificacion: 'pendiente' | 'leida' | 'procesada_por_trigger';
  fechaCreacion: admin.firestore.Timestamp;
  fechaLectura?: admin.firestore.Timestamp;
  tipoNotificacion: string;
  prioridad: 'alta' | 'normal';
  datosAdicionales?: { [key: string]: any };
  triggerProcesadoEn?: admin.firestore.Timestamp;
}

interface MembresiaData {
  userId: string;
  rol: 'usuario' | 'prestador';
  tipoMembresia: string;
  fechaInicio: admin.firestore.Timestamp;
  fechaExpiracion: admin.firestore.Timestamp;
  estadoMembresia: 'activa' | 'vencida' | 'cancelada' | 'pendiente_pago';
  beneficiosAdicionales?: {
    descuentoComisionPorcentaje?: number;
    prioridadAgenda?: boolean;
    garantiaExtendidaDiasAdicionales?: number;
  };
  stripeSubscriptionId?: string;
  mercadoPagoSubscriptionId?: string;
  ultimoPaymentIntentId?: string;
}

interface MensajeDataFirestore {
  remitenteId: string;
  texto: string;
  timestamp: admin.firestore.Timestamp;
  leido?: boolean;
  moderado?: boolean;
  motivoBloqueo?: string;
  textoOriginal?: string;
}

interface ChatDataFirestore {
  id?: string;
  participantesUids: string[];
  participantesInfo?: {
    [uid: string]: { rol: 'usuario' | 'prestador'; nombre?: string; avatarUrl?: string };
  };
  mensajes?: MensajeDataFirestore[];
  estadoChat: 'activo' | 'archivado_usuario' | 'archivado_prestador' | 'finalizado_por_servicio';
  fechaCreacion: admin.firestore.Timestamp;
  ultimaActualizacion: admin.firestore.Timestamp;
  ultimoMensajeTexto?: string;
  ultimoMensajeTimestamp?: admin.firestore.Timestamp;
  ultimoMensajeRemitenteId?: string;
  conteoNoLeido?: { [uid: string]: number };
  metadataAdicional?: { [key: string]: any };
}


const PLANES_MEMBRESIA: { [key: string]: { duracionMeses: number, beneficios: MembresiaData['beneficiosAdicionales'], precioSimulado: number } } = {
  "premium_mensual_usuario": {
    duracionMeses: 1,
    beneficios: { prioridadAgenda: true, garantiaExtendidaDiasAdicionales: PREMIUM_WARRANTY_DAYS - STANDARD_WARRANTY_DAYS },
    precioSimulado: 10,
  },
  "premium_anual_usuario": {
    duracionMeses: 12,
    beneficios: { prioridadAgenda: true, garantiaExtendidaDiasAdicionales: PREMIUM_WARRANTY_DAYS - STANDARD_WARRANTY_DAYS },
    precioSimulado: 100,
  },
  "premium_mensual_prestador": {
    duracionMeses: 1,
    beneficios: { descuentoComisionPorcentaje: 3 },
    precioSimulado: 20,
  },
  "premium_anual_prestador": {
    duracionMeses: 12,
    beneficios: { descuentoComisionPorcentaje: 3 },
    precioSimulado: 200,
  },
};


// --- FUNCIONES EXISTENTES (Resumidas y/o actualizadas) ---

async function getMockUser(userId: string): Promise<UserData | null> {
  if (userId === "currentUserDemoId") {
    return { uid: userId, name: "Usuario Premium Demo", isPremium: true, membresiaActual: "premium_anual_usuario" };
  }
  if (userId === "standardUserDemoId") {
    return { uid: userId, name: "Usuario Estándar Demo", isPremium: false, membresiaActual: "gratis" };
  }
  const userRef = db.collection("usuarios").doc(userId);
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    return userDoc.data() as UserData;
  }
  return null;
}

async function _calcularMontoParaProveedor(servicioId: string, montoTotalServicio: number): Promise<number> {
  functions.logger.info(`[Comisiones] Calculando monto para proveedor del servicio: ${servicioId}, monto total: ${montoTotalServicio}`);
  const COMISION_ESTANDAR_PORCENTAJE = 6;

  const servicioRef = db.collection("servicios").doc(servicioId);
  const servicioDoc = await servicioRef.get();

  if (!servicioDoc.exists) {
    functions.logger.error(`[Comisiones] Servicio ${servicioId} no encontrado.`);
    throw new Error("Servicio no encontrado para calcular comisión.");
  }
  const servicioData = servicioDoc.data() as ServiceData;
  const prestadorId = servicioData.prestadorId;

  const membresiaRef = db.collection("membresias").doc(prestadorId);
  const membresiaDoc = await membresiaRef.get();

  let comisionPorcentaje = COMISION_ESTANDAR_PORCENTAJE;

  if (membresiaDoc.exists) {
    const membresiaData = membresiaDoc.data() as MembresiaData;
    if (membresiaData.estadoMembresia === "activa" && new Date() < membresiaData.fechaExpiracion.toDate()) {
      if (membresiaData.beneficiosAdicionales?.descuentoComisionPorcentaje !== undefined) {
        comisionPorcentaje = membresiaData.beneficiosAdicionales.descuentoComisionPorcentaje;
        functions.logger.info(`[Comisiones] Prestador ${prestadorId} tiene membresía con descuento. Comisión aplicada: ${comisionPorcentaje}%`);
      }
    }
  }

  const montoComision = montoTotalServicio * (comisionPorcentaje / 100);
  const montoParaProveedor = montoTotalServicio - montoComision;

  functions.logger.info(`[Comisiones] Servicio ${servicioId}: Monto Total: ${montoTotalServicio}, Comisión (${comisionPorcentaje}%): ${montoComision}, Monto para Proveedor: ${montoParaProveedor}`);
  return montoParaProveedor;
}

export const activarMembresia = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando activarMembresia", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const userId = context.auth.uid;
  const { rol, tipoMembresiaDeseado } = data;

  if (!rol || (rol !== 'usuario' && rol !== 'prestador')) {
    throw new functions.https.HttpsError("invalid-argument", "El rol ('usuario' o 'prestador') es requerido.");
  }
  if (!tipoMembresiaDeseado || typeof tipoMembresiaDeseado !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "El 'tipoMembresiaDeseado' es requerido.");
  }

  const planKey = `${tipoMembresiaDeseado}_${rol}`;
  const planSeleccionado = PLANES_MEMBRESIA[planKey];

  if (!planSeleccionado) {
    throw new functions.https.HttpsError("not-found", `El plan de membresía '${tipoMembresiaDeseado}' para el rol '${rol}' no es válido. Clave buscada: ${planKey}`);
  }

  functions.logger.info(`[activarMembresia] Usuario ${userId} (${rol}) solicitando plan: ${tipoMembresiaDeseado}. Precio Simulado: ${planSeleccionado.precioSimulado}`);

  const pagoExitosoSimulado = true;
  const paymentIntentIdSimulado = `sim_pi_${Date.now()}`;

  if (!pagoExitosoSimulado) {
    functions.logger.error(`[activarMembresia] SIMULACIÓN: Pago fallido para ${userId}.`);
    throw new functions.https.HttpsError("aborted", "El procesamiento del pago falló (simulado).");
  }
  functions.logger.info(`[activarMembresia] SIMULACIÓN: Pago exitoso para ${userId}. PaymentIntent ID: ${paymentIntentIdSimulado}`);

  const fechaInicio = admin.firestore.Timestamp.now();
  const fechaExpiracionDate = new Date(fechaInicio.toDate().getTime());
  fechaExpiracionDate.setMonth(fechaExpiracionDate.getMonth() + planSeleccionado.duracionMeses);
  const fechaExpiracion = admin.firestore.Timestamp.fromDate(fechaExpiracionDate);

  const membresiaRef = db.collection("membresias").doc(userId);
  const membresiaData: MembresiaData = {
    userId: userId,
    rol: rol,
    tipoMembresia: tipoMembresiaDeseado,
    fechaInicio: fechaInicio,
    fechaExpiracion: fechaExpiracion,
    estadoMembresia: "activa",
    beneficiosAdicionales: planSeleccionado.beneficios,
    ultimoPaymentIntentId: paymentIntentIdSimulado,
  };

  try {
    await membresiaRef.set(membresiaData, { merge: true });
    functions.logger.info(`[activarMembresia] Documento de membresía para ${userId} creado/actualizado.`);

    const currentClaims = (await admin.auth().getUser(userId)).customClaims || {};
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims,
      premium: true,
      rol: rol,
      membresiaTipo: tipoMembresiaDeseado,
      membresiaExpiraEpoch: fechaExpiracion.toMillis(),
    });
    functions.logger.info(`[activarMembresia] Custom claims actualizados para ${userId}.`);

    const perfilCollection = rol === 'usuario' ? "usuarios" : "prestadores";
    const perfilRef = db.collection(perfilCollection).doc(userId);
    await perfilRef.set({
      membresiaActual: tipoMembresiaDeseado,
      isPremium: true,
      fechaExpiracionMembresia: fechaExpiracion,
    }, { merge: true });
    functions.logger.info(`[activarMembresia] Perfil en colección '${perfilCollection}' actualizado para ${userId}.`);


    return {
      success: true,
      message: `Membresía '${tipoMembresiaDeseado}' activada exitosamente hasta ${fechaExpiracionDate.toLocaleDateString()}.`,
      membresiaId: membresiaRef.id,
      fechaExpiracion: fechaExpiracion.toDate().toISOString(),
    };
  } catch (error: any) {
    functions.logger.error("[activarMembresia] Error al guardar membresía, custom claims o perfil:", error);
    throw new functions.https.HttpsError("internal", "Error al activar la membresía.", error.message);
  }
});

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

      // const userProfile = await getMockUser(userId); // Usaremos el custom claim
      const userIsPremium = context.auth.token.premium === true;

      let warrantyDays = STANDARD_WARRANTY_DAYS;
      let membresiaData;
      if (userIsPremium) {
        // Opcional: Leer la membresía para beneficios más específicos como días exactos
        const membresiaRef = db.collection("membresias").doc(userId);
        const membresiaDoc = await membresiaRef.get();
        if (membresiaDoc.exists) {
            membresiaData = membresiaDoc.data() as MembresiaData;
            if (membresiaData.beneficiosAdicionales?.garantiaExtendidaDiasAdicionales) {
                warrantyDays = STANDARD_WARRANTY_DAYS + membresiaData.beneficiosAdicionales.garantiaExtendidaDiasAdicionales;
            } else {
                warrantyDays = PREMIUM_WARRANTY_DAYS; // Fallback para premium si no hay detalle específico
            }
        } else {
            warrantyDays = PREMIUM_WARRANTY_DAYS; // Si es premium por claim pero no hay doc de membresía (raro)
        }
        functions.logger.info(`[confirmServiceCompletionByUserService] Usuario ${userId} es premium. Garantía de ${warrantyDays} días.`);
      } else {
        functions.logger.info(`[confirmServiceCompletionByUserService] Usuario ${userId} es estándar. Garantía de ${warrantyDays} días.`);
      }
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now,
        userConfirmedCompletionAt: now,
        habilitarCalificacion: true,
        paymentStatus: "retenido_para_liberacion",
        ratingWindowExpiresAt: ratingWindowExpiresTimestamp,
        warrantyEndDate: warrantyEndDateDt.toISOString().split("T")[0],
        updatedAt: now,
      });
      functions.logger.info(`Servicio ${servicioId} confirmado por usuario ${userId}. Calificación habilitada, pago retenido, ventana de calificación/disputa de ${RATING_AND_DISPUTE_WINDOW_DAYS} días y garantía hasta ${warrantyEndDateDt.toISOString().split("T")[0]} establecidas.`);
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
        transaction.update(servicioRef, { habilitarCalificacion: false });
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
      let prestadorName = `Prestador ${servicioData.prestadorId.substring(0, 5)}`;

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
        rating: currentRating,
        name: prestadorName,
        uid: servicioData.prestadorId,
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> & { updatedAt: admin.firestore.FieldValue } = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
      }

      if (servicioData.estado !== "en_disputa") {
        servicioUpdate.estado = "cerrado_con_calificacion";
        if (servicioData.paymentStatus === "retenido_para_liberacion") {
          functions.logger.info(`[calificarPrestador] Usuario ${userId} calificó servicio ${servicioId}. Liberando pago.`);
          servicioUpdate.paymentStatus = "liberado_al_proveedor";
          servicioUpdate.fechaLiberacionPago = admin.firestore.Timestamp.now();
        }
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
      let userName = `Usuario ${servicioData.usuarioId.substring(0, 5)}`;

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion; // Este debería ser ratingSumRecibidoDelPrestador
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1; // Este debería ser ratingCountRecibidoDelPrestador
        userName = usuarioData.name || userName;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(usuarioDocRef, {
        uid: servicioData.usuarioId,
        name: userName,
        ratingSumUsuario: newRatingSum, // Debería ser un campo como ratingSumRecibido
        ratingCountUsuario: newRatingCount, // Debería ser un campo como ratingCountRecibido
        ratingUsuario: currentRating, // Promedio de calificaciones recibidas
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> & { updatedAt: admin.firestore.FieldValue } = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        if (servicioData.estado !== "en_disputa") {
          servicioUpdate.estado = "cerrado_con_calificacion";
        }
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
  const usuarioId = context.auth.uid;
  const { servicioId, detalleProblema } = data;

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
      const reporteId = db.collection("reportes").doc().id;

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa",
        detallesDisputa: {
          reportadoEn: now,
          detalle: detalleProblema,
          reporteId: reporteId,
        },
        updatedAt: now,
      });

      const datosReporte = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: detalleProblema,
        fechaReporte: now,
        estado: "pendiente",
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

export const validateDocumentAndRemoveContactInfo = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo (simulación IA con Vision API)", { structuredData: true, data });

  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador) ) { // Asumiendo que solo admins/moderadores pueden llamar
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
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia";
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError.message);
      }

      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(\d{2,3}\)\s?)?(?:[ -]?\d){7,10}/g;
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
        const palabraRegex = new RegExp(`\\b${palabra.toLowerCase()}\\b`, "g");
        if (palabraRegex.test(textoParaAnalizar)) {
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
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} RECHAZADO por IA. Palabras: ${palabrasDetectadas.join(", ")}`);
      } else {
        nuevoEstado = "Validado";
        documentos[documentoIndex].motivoRechazoIA = undefined;
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined;
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} VALIDADO por IA.`);
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
      
      const warrantyEndDateString = servicioData.warrantyEndDate;
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString);
      const currentDate = new Date();
      currentDate.setHours(0,0,0,0); 
      warrantyEndDate.setHours(23,59,59,999);

      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      const nuevaSolicitudGarantiaRef = garantiasRef.doc();
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        estadoGarantia: "pendiente",
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Garantía premium activada para servicio ${servicioId}. Garantía ID: ${nuevaSolicitudGarantiaRef.id}`);
      functions.logger.warn(`SIMULACIÓN: Notificar al admin sobre la nueva solicitud de garantía ${nuevaSolicitudGarantiaRef.id}.`);
      
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
      } else {
        servicioUpdateData.compensacionAutorizada = false;
      }
      transaction.update(servicioRef, servicioUpdateData);


      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${garantiaData.usuarioId} y al prestador ${garantiaData.prestadorId} sobre la resolución de la garantía.`);

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
    const windowDays = RATING_AND_DISPUTE_WINDOW_DAYS;
    const windowLimitDate = new Date(now.toDate().getTime() - windowDays * 24 * 60 * 60 * 1000);
    const windowLimitTimestamp = admin.firestore.Timestamp.fromDate(windowLimitDate);

    const serviciosRef = db.collection("servicios");
    const batch = db.batch();
    let processedCount = 0;

    functions.logger.info(`[DailyCheck] Buscando servicios para cierre automático (ventana de ${windowDays} días). Límite de fecha para confirmación de usuario: ${windowLimitDate.toISOString()}`);

    const queryPagosPendientes = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("userConfirmedCompletionAt", "<=", windowLimitTimestamp);

    try {
      const snapshotPagos = await queryPagosPendientes.get();
      functions.logger.info(`[DailyCheck] Encontrados ${snapshotPagos.size} servicios 'completado_por_usuario' con pago 'retenido_para_liberacion' y confirmados hace más de ${windowDays} días.`);
      
      snapshotPagos.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        functions.logger.log(`[DailyCheck] Procesando servicio para cierre automático: ${doc.id}. Estado: ${servicio.estado}, userConfirmedCompletionAt: ${servicio.userConfirmedCompletionAt?.toDate().toISOString()}`);
        
        if (
          !servicio.calificacionUsuario && 
          servicio.estado !== "en_disputa"
        ) {
          functions.logger.info(`[DailyCheck] CERRANDO AUTOMÁTICAMENTE Y LIBERANDO PAGO para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
          batch.update(doc.ref, {
            paymentStatus: "liberado_al_proveedor",
            fechaLiberacionPago: now,
            estado: "cerrado_automaticamente",
            updatedAt: now,
          });
          processedCount++;
        } else {
           functions.logger.log(`[DailyCheck] Servicio ${doc.id} no cumple condiciones para cierre automático (ya calificado o en disputa). calificacionUsuario: ${!!servicio.calificacionUsuario}, estado: ${servicio.estado}`);
        }
      });
    } catch (error) {
      functions.logger.error("[DailyCheck] Error consultando servicios para liberación de pago automática:", error);
    }
    
    const queryCalificadosPagoRetenido = serviciosRef
        .where("estado", "==", "cerrado_con_calificacion")
        .where("paymentStatus", "==", "retenido_para_liberacion");

    try {
        const snapshotCalificados = await queryCalificadosPagoRetenido.get();
        functions.logger.info(`[DailyCheck] Encontrados ${snapshotCalificados.size} servicios 'cerrado_con_calificacion' con pago 'retenido_para_liberacion'.`);

        snapshotCalificados.forEach(doc => {
            const servicio = doc.data() as ServiceData;
            if (servicio.estado !== "en_disputa") {
                functions.logger.info(`[DailyCheck] LIBERANDO PAGO (fallback/barrido) para servicio ya calificado ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
                batch.update(doc.ref, {
                    paymentStatus: "liberado_al_proveedor",
                    fechaLiberacionPago: now,
                    updatedAt: now,
                });
                processedCount++;
            }
        });
    } catch (error) {
        functions.logger.error("[DailyCheck] Error consultando servicios calificados con pago retenido:", error);
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
    updates.currentLocation = null;
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
    "confirmServiceCompletionByUserService", "calificarPrestador", "calificarUsuario",
    "reportServiceIssue", "obtenerServiciosCompletados", "registrarDocumentoProfesional",
    "validateDocumentAndRemoveContactInfo", "activarGarantiaPremium", "resolverGarantiaPremium",
    "simulateDailyAutomatedChecks", "updateProviderRealtimeStatus", "disconnectProvider",
    "agendarCitaConPrestador", "cancelarCita", "confirmarCitaPorPrestador",
    "procesarCobroTrasConfirmacion", "reportarProblemaServicio", "crearNotificacion",
    "enviarNotificacionInAppTrigger", "notificarLiberacionPagoAutomatica", "activarMembresia",
    "verificarEstadoFunciones", "iniciarChat", "enviarMensaje", "moderarMensajesChat",
    "evaluarComportamientoPrestadorTrigger", "asignarIncentivoUsuarioTrigger"
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";
    
    const esTrigger = nombreFuncion.endsWith("Trigger") || nombreFuncion === "simulateDailyAutomatedChecks" || nombreFuncion === "moderarMensajesChat";

    if (!presenteEnCodigo && !esTrigger && nombreFuncion !== "verificarEstadoFunciones") {
      todasLasFuncionesCriticasPresentes = false;
    }

    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada),
      esPubSub: nombreFuncion === "simulateDailyAutomatedChecks",
      esFirestoreTrigger: nombreFuncion.endsWith("Trigger") || nombreFuncion === "moderarMensajesChat",
      estadoDespliegueSimulado: presenteEnCodigo ? "Asumido Habilitada si Presente en código y desplegada" : "Ausente en Código",
      ultimaActualizacionSimulada: "N/D (Consultar en GCP Console)",
      erroresDetectadosSimulado: "N/D (Revisar Cloud Logging y GCP Console)",
    });
    functions.logger.log(`Función '${nombreFuncion}': ${presenteEnCodigo ? 'Presente y exportada' : 'No encontrada o no exportada'}`);
  }

  const resultadoConsolidado = {
    mensaje: "Verificación de estado de funciones completada (basada en exportaciones de código). El estado real de despliegue y errores debe consultarse en Google Cloud Console y Cloud Logging.",
    todasLasFuncionesCriticasPresentes: todasLasFuncionesCriticasPresentes,
    detallePorFuncion: estadoFunciones,
    timestampVerificacion: admin.firestore.Timestamp.now(),
  };

  functions.logger.info("Resultado de la verificación:", resultadoConsolidado);
  return resultadoConsolidado;
});


export const agendarCitaConPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando agendarCitaConPrestador", { structuredData: true, data });

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

  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !serviceType) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos (prestadorId, fechaSolicitada, horaSolicitada, serviceType).");
  }

  if (serviceType === "fixed" && typeof precioServicio !== "number" && !detallesServicio) {
    throw new functions.https.HttpsError("invalid-argument", "Para citas de tipo 'fixed', se requiere 'detallesServicio' o un 'precioServicio'.");
  }
  if (serviceType === "hourly" && (typeof tarifaPorHora !== "number" || typeof duracionHoras !== "number" || duracionHoras <= 0)) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tarifaPorHora' y 'duracionHoras' válidas para citas de tipo 'hourly'.");
  }


  const prestadorRef = db.collection("prestadores").doc(prestadorId);
  const prestadorDoc = await prestadorRef.get();
  if (!prestadorDoc.exists) {
    throw new functions.https.HttpsError("not-found", `El prestador con ID ${prestadorId} no fue encontrado.`);
  }
  const prestadorData = prestadorDoc.data() as ProviderData;


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
      functions.logger.warn(`Conflicto de horario para prestador ${prestadorId} en ${fechaSolicitada} ${horaSolicitada}. Citas encontradas: ${conflictoSnapshot.size}`);
      throw new functions.https.HttpsError("failed-precondition", "El prestador ya tiene una cita agendada o confirmada en este horario. Por favor, elige otro.");
    }

    let montoTotalEstimado = 0;
    const nuevaCitaData: Partial<CitaData> = {
      usuarioId: usuarioId,
      prestadorId: prestadorId,
      fechaHoraSolicitada: fechaHoraSolicitadaConvertida,
      detallesServicio: detallesServicio || (serviceType === "hourly" ? "Servicio por horas" : "Servicio general"),
      estado: "pendiente_confirmacion",
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      serviceType: serviceType,
    };

    if (serviceType === "fixed") {
      nuevaCitaData.precioServicio = precioServicio;
      montoTotalEstimado = precioServicio || 0;
    } else { // hourly
      const tarifaFinal = tarifaPorHora ?? prestadorData.hourlyRate;
      if (typeof tarifaFinal !== 'number' || tarifaFinal <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "No se pudo determinar una tarifa por hora válida para el servicio.");
      }
      nuevaCitaData.tarifaPorHora = tarifaFinal;
      nuevaCitaData.duracionHoras = duracionHoras;
      montoTotalEstimado = tarifaFinal * duracionHoras!;
    }
    nuevaCitaData.montoTotalEstimado = montoTotalEstimado;


    if (ubicacion) nuevaCitaData.ubicacion = ubicacion;
    if (notasAdicionales) nuevaCitaData.notasAdicionales = notasAdicionales;

    const citaRef = await citasRef.add(nuevaCitaData as CitaData);
    functions.logger.info(`Cita agendada con ID: ${citaRef.id} por usuario ${usuarioId} para prestador ${prestadorId}. Estado: pendiente_confirmacion.`);

    return { success: true, message: "Tu cita ha sido solicitada. El prestador confirmará su disponibilidad pronto.", citaId: citaRef.id };
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
  const canceladorIdAutenticado = context.auth.uid;
  const { citaId, rol } = data;

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
      let notificarA: "usuario" | "prestador";
      let idNotificado: string;

      if (rol === "usuario") {
        if (citaData.usuarioId !== canceladorIdAutenticado) {
          throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita como usuario.");
        }
        nuevoEstado = "cancelada_usuario";
        notificarA = "prestador";
        idNotificado = citaData.prestadorId;
      } else if (rol === "prestador") {
        if (citaData.prestadorId !== canceladorIdAutenticado) {
          throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita como prestador.");
        }
        nuevoEstado = "cancelada_prestador";
        notificarA = "usuario";
        idNotificado = citaData.usuarioId;
      } else {
        throw new functions.https.HttpsError("internal", "Rol de cancelador inválido internamente.");
      }
      
      const updateData: Partial<CitaData> & {updatedAt: admin.firestore.FieldValue } = {
        estado: nuevoEstado,
        fechaCancelacion: admin.firestore.FieldValue.serverTimestamp(),
        canceladaPor: canceladorIdAutenticado,
        rolCancelador: rol,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.update(citaRef, updateData);

      functions.logger.info(`Cita ${citaId} cancelada por ${rol} ${canceladorIdAutenticado}.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al ${notificarA} ${idNotificado} sobre la cancelación de la cita ${citaId} por el ${rol}.`);
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
  const { citaId, accion } = data; // accion: "confirmar" o "rechazar"

  if (!citaId || typeof citaId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'citaId'.");
  }
  if (!accion || (accion !== "confirmar" && accion !== "rechazar")) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere una 'accion' válida ('confirmar' o 'rechazar').");
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
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para modificar esta cita. No corresponde a tu ID de prestador.");
      }

      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden ${accion} citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}.`);
      }

      const updateData: Partial<CitaData> & { updatedAt: admin.firestore.FieldValue } = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      let mensajeExito = "";
      let tipoNotificacionUsuario = "";
      let tituloNotificacionUsuario = "";
      let cuerpoNotificacionUsuario = "";


      if (accion === "confirmar") {
        updateData.estado = "confirmada_prestador";
        updateData.fechaConfirmacionPrestador = admin.firestore.FieldValue.serverTimestamp();
        updateData.paymentStatus = "pendiente_cobro";
        updateData.ordenCobroId = `sim_orden_${citaId}_${Date.now()}`;
        mensajeExito = "Cita confirmada exitosamente. El cobro al usuario está pendiente.";

        tipoNotificacionUsuario = "cita_confirmada_prestador";
        tituloNotificacionUsuario = "¡Cita Confirmada!";
        cuerpoNotificacionUsuario = `El prestador ha confirmado tu cita para "${citaData.detallesServicio}" el ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()} a las ${citaData.fechaHoraSolicitada.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Se procesará el cobro.`;

        functions.logger.info(`Cita ${citaId} confirmada por prestador ${prestadorIdAutenticado}. Usuario a notificar: ${citaData.usuarioId}. PaymentStatus: pendiente_cobro.`);
      } else { // accion === "rechazar"
        updateData.estado = "rechazada_prestador";
        updateData.fechaRechazoPrestador = admin.firestore.FieldValue.serverTimestamp();
        mensajeExito = "Cita rechazada exitosamente.";
        
        tipoNotificacionUsuario = "cita_rechazada_prestador";
        tituloNotificacionUsuario = "Cita Rechazada";
        cuerpoNotificacionUsuario = `Lamentablemente, el prestador ha rechazado tu cita para "${citaData.detallesServicio}" el ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()}.`;

        functions.logger.info(`Cita ${citaId} rechazada por prestador ${prestadorIdAutenticado}. Usuario a notificar: ${citaData.usuarioId}.`);
      }
      
      transaction.update(citaRef, updateData);
      
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la ${accion} de la cita ${citaId}.`);
    });

    return { success: true, message: `Acción '${accion}' realizada con éxito para la cita.` };
  } catch (error: any) {
    functions.logger.error(`Error en la transacción de confirmarCitaPorPrestador (accion: ${accion}):`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Error interno al ${accion} la cita.`, error.message);
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

      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Iniciando cobro para cita ${citaId}, Usuario: ${citaData.usuarioId}, Orden ID: ${citaData.ordenCobroId}, Monto: ${citaData.montoTotalEstimado}.`);
      const pagoExitosoSimulado = true;
      
      if (pagoExitosoSimulado) {
        transaction.update(citaRef, {
          estado: "pagada",
          paymentStatus: "procesado_exitosamente",
          fechaCobro: admin.firestore.Timestamp.now(),
          montoCobrado: citaData.montoTotalEstimado,
          updatedAt: admin.firestore.Timestamp.now(),
        });
        functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} procesado exitosamente.`);
        functions.logger.warn(`[ProcesarCobro] SIMULACIÓN: Notificar a usuario ${citaData.usuarioId} y prestador ${citaData.prestadorId} sobre pago exitoso para cita ${citaId}.`);
        return { success: true, message: `Cobro para la cita ${citaId} procesado exitosamente. El servicio está ahora en estado 'pagada'.` };
      } else {
        functions.logger.error(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} FALLIDO.`);
        transaction.update(citaRef, {
          paymentStatus: "fallido",
          fechaCobro: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });
        throw new functions.https.HttpsError("aborted", "El procesamiento del pago falló (simulado).");
      }
    });
  } catch (error: any) {
    functions.logger.error(`Error en la transacción de procesarCobroTrasConfirmacion para cita ${citaId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al procesar el cobro de la cita.", error.message);
  }
});

export const crearNotificacion = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando crearNotificacion", { structuredData: true, data });

  const {
    destinatarioId,
    rolDestinatario,
    titulo,
    cuerpo,
    tipoNotificacion,
    prioridad,
    datosAdicionales,
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

  const nuevaNotificacionData: Omit<NotificacionData, "id" | "fechaCreacion" | "triggerProcesadoEn" | "fechaLectura"> = {
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
      ...nuevaNotificacionData,
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.info(`Notificación creada con ID: ${notificacionRef.id} para ${rolDestinatario} ${destinatarioId}`);
    
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

export const enviarNotificacionInAppTrigger = functions.firestore
    .document("notificaciones/{notificacionId}")
    .onCreate(async (snapshot, context) => {
      const notificacionId = context.params.notificacionId;
      const notificacionData = snapshot.data() as NotificacionData;

      functions.logger.info(`[Trigger] Nueva notificación ${notificacionId} detectada para ${notificacionData.rolDestinatario} ${notificacionData.destinatarioId}.`);

      if (notificacionData.estadoNotificacion !== "pendiente") {
        functions.logger.log(`[Trigger] Notificación ${notificacionId} no está en estado 'pendiente', omitiendo. Estado actual: ${notificacionData.estadoNotificacion}.`);
        return null;
      }

      functions.logger.log(`[Trigger] SIMULACIÓN: Enviando notificación (ej. FCM) para ${notificacionId} a ${notificacionData.destinatarioId}. Título: ${notificacionData.titulo}`);
      
      try {
        await snapshot.ref.update({
          estadoNotificacion: "procesada_por_trigger",
          triggerProcesadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`[Trigger] Notificación ${notificacionId} marcada como 'procesada_por_trigger'.`);
      } catch (error) {
        functions.logger.error(`[Trigger] Error al actualizar estado de notificación ${notificacionId}:`, error);
      }
      return null;
    });

export const notificarLiberacionPagoAutomatica = functions.firestore
  .document("servicios/{servicioId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() as ServiceData | undefined;
    const afterData = change.after.data() as ServiceData | undefined;
    const servicioId = context.params.servicioId;

    functions.logger.info(`[notificarLiberacionPagoAutomatica] Servicio ${servicioId} actualizado.`);

    if (!beforeData || !afterData) {
      functions.logger.warn(`[notificarLiberacionPagoAutomatica] Datos antes o después no disponibles para servicio ${servicioId}.`);
      return null;
    }

    const esLiberacionAutomatica =
      beforeData.estado === "completado_por_usuario" &&
      afterData.estado === "cerrado_automaticamente" &&
      beforeData.paymentStatus === "retenido_para_liberacion" &&
      afterData.paymentStatus === "liberado_al_proveedor" &&
      !afterData.calificacionUsuario;

    if (esLiberacionAutomatica) {
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Detectada liberación automática de pago para servicio ${servicioId}. Preparando notificaciones.`);

      const servicioDetalles = afterData.detallesServicio || "Servicio sin descripción detallada";
      const fechaServicio = afterData.fechaServicio?.toDate().toLocaleDateString("es-MX") || 
                            afterData.fechaConfirmacion?.toDate().toLocaleDateString("es-MX") || 
                            "Fecha no especificada";
      const montoLiberado = afterData.montoCobrado || (afterData as CitaData).montoTotalEstimado || 0;

      try {
        await crearNotificacion({
          destinatarioId: afterData.usuarioId,
          rolDestinatario: 'usuario',
          titulo: "Pago Liberado Automáticamente",
          cuerpo: `El pago para tu servicio "${servicioDetalles}" del ${fechaServicio} ha sido liberado automáticamente al prestador tras ${RATING_AND_DISPUTE_WINDOW_DAYS} días sin reclamos. Monto: $${montoLiberado.toFixed(2)}.`,
          tipoNotificacion: 'pago_liberado_auto_usuario',
          prioridad: 'normal',
          datosAdicionales: { servicioId: servicioId }
        });
        functions.logger.info(`[notificarLiberacionPagoAutomatica] Notificación de liberación automática enviada al usuario ${afterData.usuarioId} para servicio ${servicioId}.`);
      } catch (error) {
        functions.logger.error(`[notificarLiberacionPagoAutomatica] Error al enviar notificación al usuario ${afterData.usuarioId}:`, error);
      }

      try {
        await crearNotificacion({
          destinatarioId: afterData.prestadorId,
          rolDestinatario: 'prestador',
          titulo: "¡Pago Recibido!",
          cuerpo: `El pago por el servicio "${servicioDetalles}" del ${fechaServicio} ha sido liberado a tu cuenta. Monto: $${montoLiberado.toFixed(2)}.`,
          tipoNotificacion: 'pago_recibido_auto_prestador',
          prioridad: 'normal',
          datosAdicionales: { servicioId: servicioId }
        });
        functions.logger.info(`[notificarLiberacionPagoAutomatica] Notificación de pago recibido enviada al prestador ${afterData.prestadorId} para servicio ${servicioId}.`);
      } catch (error) {
        functions.logger.error(`[notificarLiberacionPagoAutomatica] Error al enviar notificación al prestador ${afterData.prestadorId}:`, error);
      }
    } else {
      functions.logger.log(`[notificarLiberacionPagoAutomatica] La actualización del servicio ${servicioId} no coincide con los criterios de liberación automática de pago. Estado antes: ${beforeData.estado}, después: ${afterData.estado}. PaymentStatus antes: ${beforeData.paymentStatus}, después: ${afterData.paymentStatus}. CalificaciónUsuario: ${!!afterData.calificacionUsuario}`);
    }
    return null;
  });

export const iniciarChat = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando iniciarChat", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const iniciadorId = context.auth.uid;
  const { destinatarioId, metadataAdicional } = data;

  if (!destinatarioId || typeof destinatarioId !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'destinatarioId'.");
  }
  if (iniciadorId === destinatarioId) {
    throw new functions.https.HttpsError("invalid-argument", "No puedes iniciar un chat contigo mismo.");
  }

  const participantesUids = [iniciadorId, destinatarioId].sort();
  const chatsRef = db.collection("chats");

  try {
    const q = chatsRef
      .where("participantesUids", "==", participantesUids)
      .limit(1);
      
    const chatExistenteSnap = await q.get();

    if (!chatExistenteSnap.empty) {
      const chatExistenteDoc = chatExistenteSnap.docs[0];
      functions.logger.info(`Chat encontrado entre ${iniciadorId} y ${destinatarioId}. ID: ${chatExistenteDoc.id}`);
      return { success: true, chatId: chatExistenteDoc.id, nuevo: false, message: "Chat encontrado." };
    }

    functions.logger.info(`No se encontró chat. Creando nuevo chat entre ${iniciadorId} y ${destinatarioId}.`);
    
    const nuevoChatData: Omit<ChatDataFirestore, "id" | "mensajes"> = {
      participantesUids: participantesUids,
      estadoChat: "activo",
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      conteoNoLeido: {
        [iniciadorId]: 0,
        [destinatarioId]: 0,
      },
      ...(metadataAdicional && { metadataAdicional: metadataAdicional }),
    };

    const nuevoChatRef = await chatsRef.add(nuevoChatData);
    functions.logger.info(`Nuevo chat creado con ID: ${nuevoChatRef.id}`);
    return { success: true, chatId: nuevoChatRef.id, nuevo: true, message: "Chat iniciado exitosamente." };

  } catch (error: any) {
    functions.logger.error("Error en iniciarChat:", error);
    throw new functions.https.HttpsError("internal", "Error al iniciar o encontrar el chat.", error.message);
  }
});


export const enviarMensaje = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando enviarMensaje", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const remitenteId = context.auth.uid;
  const { chatId, texto } = data;

  if (!chatId || typeof chatId !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'chatId'.");
  }
  if (!texto || typeof texto !== 'string' || texto.trim() === "") {
    throw new functions.https.HttpsError("invalid-argument", "El 'texto' del mensaje no puede estar vacío.");
  }

  const chatRef = db.collection("chats").doc(chatId);

  try {
    await db.runTransaction(async (transaction) => {
      const chatDoc = await transaction.get(chatRef);
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Chat con ID ${chatId} no encontrado.`);
      }
      const chatData = chatDoc.data() as ChatDataFirestore;

      if (!chatData.participantesUids.includes(remitenteId)) {
        throw new functions.https.HttpsError("permission-denied", "No eres participante de este chat.");
      }
      if (chatData.estadoChat !== "activo") {
        throw new functions.https.HttpsError("failed-precondition", `No se pueden enviar mensajes a un chat que no esté activo. Estado actual: ${chatData.estadoChat}`);
      }

      const nuevoMensaje: MensajeDataFirestore = {
        remitenteId: remitenteId,
        texto: texto,
        timestamp: admin.firestore.Timestamp.now(),
        leido: false,
      };

      const destinatarioDelMensajeId = chatData.participantesUids.find(uid => uid !== remitenteId);
      
      const updates: Partial<ChatDataFirestore> & { ultimaActualizacion: admin.firestore.FieldValue } = {
        mensajes: admin.firestore.FieldValue.arrayUnion(nuevoMensaje) as any, 
        ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
        ultimoMensajeTexto: texto.substring(0, 100),
        ultimoMensajeTimestamp: nuevoMensaje.timestamp,
        ultimoMensajeRemitenteId: remitenteId,
      };

      if (destinatarioDelMensajeId) {
        updates.conteoNoLeido = {
          ...chatData.conteoNoLeido,
          [destinatarioDelMensajeId]: admin.firestore.FieldValue.increment(1) as any,
        };
      }
      
      transaction.update(chatRef, updates);
    });

    functions.logger.info(`Mensaje enviado por ${remitenteId} al chat ${chatId}. Texto: "${texto.substring(0,30)}..."`);
    return { success: true, message: "Mensaje enviado exitosamente." };
  } catch (error: any)
 {
    functions.logger.error(`Error al enviar mensaje al chat ${chatId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al enviar el mensaje.", error.message);
  }
});

exports.moderarMensajesChat = functions.firestore
    .document('chats/{chatId}') // MODIFICADO: Escuchar en el documento de chat, no subcolección
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data() as ChatDataFirestore | undefined;
        const afterData = change.after.data() as ChatDataFirestore | undefined;
        const chatId = context.params.chatId;

        if (!beforeData || !afterData || !afterData.mensajes || !beforeData.mensajes) {
            functions.logger.log(`[ModerarChat ${chatId}] Datos incompletos o sin campo 'mensajes', omitiendo.`);
            return null;
        }
        
        // Solo actuar si se añadió un nuevo mensaje
        if (afterData.mensajes.length <= beforeData.mensajes.length) {
            functions.logger.log(`[ModerarChat ${chatId}] No hay nuevos mensajes o se eliminó un mensaje, omitiendo.`);
            return null;
        }
        
        const nuevoMensaje = afterData.mensajes[afterData.mensajes.length - 1];
        
        // Si el mensaje ya fue moderado, no hacer nada.
        if (nuevoMensaje.moderado === true) {
            functions.logger.log(`[ModerarChat ${chatId}] Mensaje ya marcado como moderado, omitiendo.`);
            return null;
        }

        const mensajeTexto = nuevoMensaje.texto || '';
        const mensajeIdSimulado = `${nuevoMensaje.timestamp.toMillis()}_${nuevoMensaje.remitenteId}`; // ID simulado para logging

        functions.logger.log(`[ModerarChat ${chatId}] Nuevo mensaje detectado (ID simulado ${mensajeIdSimulado}): "${mensajeTexto.substring(0,50)}..."`);

        const regexTelefono = /(\+?\d{1,3}[-.\s]?(\(?\d{1,4}\)?[-.\s]?)*\d{1,4}[-.\s]?\d{1,9})/; // Mejorada
        const regexEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
        const regexPalabrasClaveContacto = new RegExp(PALABRAS_CLAVE_PROHIBIDAS_CONTACTO.map(kw => `\\b${kw}\\b`).join("|"), "i");


        let mensajeBloqueado = false;
        let motivo = "";

        if (regexTelefono.test(mensajeTexto)) {
            mensajeBloqueado = true;
            motivo = "Posible número de teléfono detectado.";
        } else if (regexEmail.test(mensajeTexto)) {
            mensajeBloqueado = true;
            motivo = "Posible correo electrónico detectado.";
        } else if (regexPalabrasClaveContacto.test(mensajeTexto.toLowerCase())) {
            mensajeBloqueado = true;
            motivo = "Posible intento de compartir datos de contacto o enlaces externos.";
        }

        if (mensajeBloqueado) {
            functions.logger.warn(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) será MODERADO. Motivo: ${motivo}. Texto original: "${mensajeTexto}"`);
            
            const mensajesActualizados = [...afterData.mensajes];
            mensajesActualizados[afterData.mensajes.length - 1] = {
                ...nuevoMensaje,
                texto: '[Mensaje bloqueado por el sistema]',
                moderado: true,
                motivoBloqueo: motivo,
                textoOriginal: mensajeTexto, 
            };

            try {
                await db.collection('chats').doc(chatId).update({
                    mensajes: mensajesActualizados,
                    ultimoMensajeTexto: '[Mensaje bloqueado por el sistema]', // Actualizar el snippet
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                });
                functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) actualizado por moderación.`);

            } catch (updateError) {
                functions.logger.error(`[ModerarChat ${chatId}] Error al actualizar mensaje moderado:`, updateError);
            }
        } else {
            functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) pasó la moderación.`);
            // Si no está bloqueado y no ha sido marcado como moderado, marcarlo como tal
            // Esto es para evitar que la función se dispare de nuevo por su propia actualización
            // si solo actualizáramos el timestamp o algo así.
            // Sin embargo, con la lógica actual, solo actuamos si !nuevoMensaje.moderado,
            // y no hacemos nada si pasa la moderación, por lo que no se necesita este update.
        }
        return null;
    });

export const evaluarComportamientoPrestadorTrigger = functions.firestore
    .document('citas/{citaId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data() as CitaData | undefined;
        const afterData = change.after.data() as CitaData | undefined;
        const citaId = context.params.citaId;

        if (!beforeData || !afterData) {
            functions.logger.warn(`[EvaluarComportamiento ${citaId}] Datos antes o después no disponibles.`);
            return null;
        }

        const prestadorId = afterData.prestadorId;
        if (!prestadorId) {
            functions.logger.error(`[EvaluarComportamiento ${citaId}] No se encontró prestadorId en la cita.`);
            return null;
        }

        const prestadorRef = db.collection("prestadores").doc(prestadorId);
        let actualizacionPrestador: Partial<ProviderData> = {};
        let logMessage = "";

        // Caso 1: Cita RECHAZADA por el PRESTADOR
        if (afterData.estado === "rechazada_prestador" && beforeData.estado !== "rechazada_prestador") {
            logMessage = `[EvaluarComportamiento ${citaId}] Cita rechazada por prestador ${prestadorId}.`;
            actualizacionPrestador.rechazosCount = admin.firestore.FieldValue.increment(1) as any;

            const prestadorDocSnap = await prestadorRef.get();
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevoRechazosCount = (prestadorDataActual?.rechazosCount || 0) + 1;

            if (nuevoRechazosCount % 3 === 0) { 
                const fechaExpiracionPenalizacion = new Date();
                fechaExpiracionPenalizacion.setDate(fechaExpiracionPenalizacion.getDate() + 1);

                actualizacionPrestador.penalizacionActiva = {
                    tipo: "visibilidad_reducida_temporal",
                    motivo: "Rechazos frecuentes de citas.",
                    expiraEn: admin.firestore.Timestamp.fromDate(fechaExpiracionPenalizacion),
                };
                logMessage += ` Aplicando penalización (visibilidad reducida) hasta ${fechaExpiracionPenalizacion.toISOString()}.`;
            }
        }
        // Caso 2: Cita CONFIRMADA por el PRESTADOR
        else if (afterData.estado === "confirmada_prestador" && beforeData.estado !== "confirmada_prestador") {
            logMessage = `[EvaluarComportamiento ${citaId}] Cita confirmada por prestador ${prestadorId}.`;
            actualizacionPrestador.confirmacionesCount = admin.firestore.FieldValue.increment(1) as any;
            
            const prestadorDocSnap = await prestadorRef.get();
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevaConfirmacionesCount = (prestadorDataActual?.confirmacionesCount || 0) + 1;

            if (nuevaConfirmacionesCount % 5 === 0) {
                if (!actualizacionPrestador.incentivos) actualizacionPrestador.incentivos = {};
                actualizacionPrestador.incentivos.puntosReputacion = admin.firestore.FieldValue.increment(10) as any;
                logMessage += ` Otorgando 10 puntos de reputación.`;
            }
        }

        if (Object.keys(actualizacionPrestador).length > 0) {
            (actualizacionPrestador as any).updatedAt = admin.firestore.FieldValue.serverTimestamp();
            try {
                await prestadorRef.set(actualizacionPrestador, { merge: true });
                functions.logger.info(logMessage + " Perfil del prestador actualizado.");
            } catch (error) {
                functions.logger.error(`[EvaluarComportamiento ${citaId}] Error al actualizar perfil del prestador ${prestadorId}:`, error);
            }
        } else {
            functions.logger.log(`[EvaluarComportamiento ${citaId}] No se requieren acciones para el prestador ${prestadorId} basadas en el cambio de estado de la cita.`);
        }

        return null;
    });

// --- NUEVA FUNCIÓN ---
export const asignarIncentivoUsuarioTrigger = functions.firestore
    .document('servicios/{servicioId}')
    .onUpdate(async (change, context) => {
        const servicioId = context.params.servicioId;
        const beforeData = change.before.data() as ServiceData | undefined;
        const afterData = change.after.data() as ServiceData | undefined;

        functions.logger.info(`[asignarIncentivoUsuarioTrigger] Servicio ${servicioId} actualizado.`);

        if (!beforeData || !afterData) {
            functions.logger.warn(`[asignarIncentivoUsuarioTrigger] Datos antes o después no disponibles para servicio ${servicioId}.`);
            return null;
        }

        // Verificar si se acaba de añadir una calificación de usuario
        const ratingJustAdded = !beforeData.calificacionUsuario && !!afterData.calificacionUsuario;

        if (ratingJustAdded && afterData.usuarioId) {
            functions.logger.info(`[asignarIncentivoUsuarioTrigger] Calificación de usuario detectada para servicio ${servicioId} por usuario ${afterData.usuarioId}. Asignando incentivos.`);
            
            const usuarioRef = db.collection("usuarios").doc(afterData.usuarioId);

            try {
                await db.runTransaction(async (transaction) => {
                    const usuarioDoc = await transaction.get(usuarioRef);
                    let updates: Partial<UserData> = {};
                    let currentServiciosCalificados = 0;
                    let currentPuntosReputacion = 0;

                    if (usuarioDoc.exists) {
                        const usuarioData = usuarioDoc.data() as UserData;
                        currentServiciosCalificados = usuarioData.serviciosCalificadosCount || 0;
                        currentPuntosReputacion = usuarioData.puntosReputacionUsuario || 0;
                        updates = {
                            serviciosCalificadosCount: admin.firestore.FieldValue.increment(1) as any,
                            puntosReputacionUsuario: admin.firestore.FieldValue.increment(5) as any, // Otorgar 5 puntos por calificar
                        };

                        // Lógica de Badges (ejemplo)
                        if ((currentServiciosCalificados + 1) % 5 === 0) { // Cada 5 calificaciones
                            updates.badgesUsuario = admin.firestore.FieldValue.arrayUnion("calificador_bronce") as any; // O un badge más específico
                            functions.logger.info(`[asignarIncentivoUsuarioTrigger] Usuario ${afterData.usuarioId} ganó badge 'calificador_bronce'.`);
                        }

                    } else {
                        // Si el usuario no existe, crearlo con los incentivos iniciales
                        updates = {
                            uid: afterData.usuarioId,
                            name: `Usuario ${afterData.usuarioId.substring(0,5)}`, // Nombre por defecto
                            serviciosCalificadosCount: 1,
                            puntosReputacionUsuario: 5,
                            badgesUsuario: [], // Inicializar
                        };
                        functions.logger.info(`[asignarIncentivoUsuarioTrigger] Creando perfil para usuario ${afterData.usuarioId} con incentivos iniciales.`);
                    }
                    
                    transaction.set(usuarioRef, updates, { merge: true });
                });

                functions.logger.info(`[asignarIncentivoUsuarioTrigger] Incentivos asignados exitosamente al usuario ${afterData.usuarioId} por calificar servicio ${servicioId}.`);

            } catch (error) {
                functions.logger.error(`[asignarIncentivoUsuarioTrigger] Error al asignar incentivos al usuario ${afterData.usuarioId}:`, error);
            }

        } else {
            if (!afterData.calificacionUsuario) {
                functions.logger.log(`[asignarIncentivoUsuarioTrigger] No hay calificación de usuario en afterData para servicio ${servicioId}.`);
            } else if (beforeData.calificacionUsuario && afterData.calificacionUsuario && 
                       beforeData.calificacionUsuario.fecha.isEqual(afterData.calificacionUsuario.fecha)) {
                functions.logger.log(`[asignarIncentivoUsuarioTrigger] La calificación de usuario no es nueva para servicio ${servicioId}.`);
            } else {
                 functions.logger.log(`[asignarIncentivoUsuarioTrigger] No se cumplen condiciones para incentivo en servicio ${servicioId}. RatingJustAdded: ${ratingJustAdded}, UsuarioId: ${afterData.usuarioId}`);
            }
        }
        return null;
    });
// --- FIN FUNCIONES EXISTENTES ---
        
// La función filtrarPrestadoresAvanzado está incompleta y necesita ser definida o eliminada.
// Por ahora, la comentaré para evitar errores de despliegue si no está completamente implementada.
/*
export const filtrarPrestadoresAvanzado = functions.https.onCall(async (data, context) => {
  // Lógica de la función aquí...
  functions.logger.info("FiltrarPrestadoresAvanzado llamada con:", data);
  // Implementación pendiente
  return { message: "Función filtrarPrestadoresAvanzado no implementada completamente." };
});
*/

    

    
