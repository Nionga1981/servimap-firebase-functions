
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

  fechaServicio?: admin.firestore.Timestamp;
  detallesServicio?: string;
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
  membresiaActual?: string; // Ej: "premium_mensual"

  // Campos para evaluar comportamiento
  confirmacionesCount?: number;
  rechazosCount?: number;
  penalizacionActiva?: {
    tipo: string; // Ej: "visibilidad_reducida", "comision_aumentada"
    motivo: string;
    expiraEn: admin.firestore.Timestamp;
  } | null;
  incentivos?: {
    puntosReputacion?: number;
    badges?: string[]; // Ej: ["puntual", "excelente_servicio"]
  };
}

interface UserData {
  uid?: string;
  name?: string;
  ratingSumUsuario?: number;
  ratingCountUsuario?: number;
  ratingUsuario?: number;
  isPremium?: boolean;
  membresiaActual?: string; // Ej: "premium_mensual"
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

  // Campos de confirmación/rechazo del prestador
  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  fechaRechazoPrestador?: admin.firestore.Timestamp; // Nuevo campo
  ordenCobroId?: string; // Referencia a la orden de pago (simulada)

  // Campos de pago (pueden ser compartidos/similares a ServiceData)
  paymentStatus?: PaymentStatus; // Extendiendo PaymentStatus
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;

  // Campos de cancelación
  fechaCancelacion?: admin.firestore.Timestamp;
  canceladaPor?: string; // UID de quien canceló
  rolCancelador?: "usuario" | "prestador";

  // Campos para diferenciar tipo de servicio y precio
  serviceType: "fixed" | "hourly"; // Indica si la cita es para un servicio de precio fijo o por horas
  precioServicio?: number; // Para tipo 'fixed' (precio del servicio específico si aplica)
  tarifaPorHora?: number; // Para tipo 'hourly' (tarifa del prestador en ese momento)
  duracionHoras?: number; // Para tipo 'hourly'
  montoTotalEstimado?: number; // Calculado (precioFijo o tarifaPorHora * duracion)
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
  userId: string; // UID del usuario o prestador
  rol: 'usuario' | 'prestador';
  tipoMembresia: string; // Ej: "premium_mensual", "premium_anual", "gratis"
  fechaInicio: admin.firestore.Timestamp;
  fechaExpiracion: admin.firestore.Timestamp;
  estadoMembresia: 'activa' | 'vencida' | 'cancelada' | 'pendiente_pago';
  beneficiosAdicionales?: {
    descuentoComisionPorcentaje?: number; // Para prestadores, ej. 3 (para 3%)
    prioridadAgenda?: boolean; // Para usuarios
    garantiaExtendidaDiasAdicionales?: number; // Para usuarios
    // otros beneficios...
  };
  stripeSubscriptionId?: string; // Si usas Stripe para suscripciones
  mercadoPagoSubscriptionId?: string; // Si usas MercadoPago
  ultimoPaymentIntentId?: string; // Para rastrear el último pago
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
  // En una app real, esto consultaría la colección 'usuarios' o 'prestadores' según el rol
  // Por ahora, simularemos con un ID para determinar si es premium
  // (Esta función ya no es tan útil con la colección membresias)
  if (userId === "currentUserDemoId") { // Simula usuario premium
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
  // Podríamos añadir lógica para prestadores si tuvieran un campo 'isPremium' directo
  return null;
}

async function _calcularMontoParaProveedor(servicioId: string, montoTotalServicio: number): Promise<number> {
  functions.logger.info(`[Comisiones] Calculando monto para proveedor del servicio: ${servicioId}, monto total: ${montoTotalServicio}`);
  const COMISION_ESTANDAR_PORCENTAJE = 6;
  // const COMISION_PREMIUM_PRESTADOR_PORCENTAJE = 3; // Se tomará de la membresía

  const servicioRef = db.collection("servicios").doc(servicioId);
  const servicioDoc = await servicioRef.get();

  if (!servicioDoc.exists) {
    functions.logger.error(`[Comisiones] Servicio ${servicioId} no encontrado.`);
    throw new Error("Servicio no encontrado para calcular comisión.");
  }
  const servicioData = servicioDoc.data() as ServiceData;
  const prestadorId = servicioData.prestadorId;

  const membresiaRef = db.collection("membresias").doc(prestadorId); // Asumimos que el ID del documento en membresias es el prestadorId
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
  const { rol, tipoMembresiaDeseado } = data; // ej. tipoMembresiaDeseado = "premium_mensual"

  if (!rol || (rol !== 'usuario' && rol !== 'prestador')) {
    throw new functions.https.HttpsError("invalid-argument", "El rol ('usuario' o 'prestador') es requerido.");
  }
  if (!tipoMembresiaDeseado || typeof tipoMembresiaDeseado !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "El 'tipoMembresiaDeseado' es requerido.");
  }

  const planKey = `${tipoMembresiaDeseado}_${rol}`; // Construye la clave completa
  const planSeleccionado = PLANES_MEMBRESIA[planKey];

  if (!planSeleccionado) {
    throw new functions.https.HttpsError("not-found", `El plan de membresía '${tipoMembresiaDeseado}' para el rol '${rol}' no es válido. Clave buscada: ${planKey}`);
  }

  functions.logger.info(`[activarMembresia] Usuario ${userId} (${rol}) solicitando plan: ${tipoMembresiaDeseado}. Precio Simulado: ${planSeleccionado.precioSimulado}`);

  // --- SIMULACIÓN DE PAGO ---
  functions.logger.info(`[activarMembresia] SIMULACIÓN: Iniciando proceso de pago de ${planSeleccionado.precioSimulado} para ${userId} con Stripe/MercadoPago...`);
  const pagoExitosoSimulado = true; // Cambiar a false para probar el fallo
  const paymentIntentIdSimulado = `sim_pi_${Date.now()}`;

  if (!pagoExitosoSimulado) {
    functions.logger.error(`[activarMembresia] SIMULACIÓN: Pago fallido para ${userId}.`);
    // En un caso real, podrías guardar la membresía como 'pendiente_pago'
    throw new functions.https.HttpsError("aborted", "El procesamiento del pago falló (simulado).");
  }
  functions.logger.info(`[activarMembresia] SIMULACIÓN: Pago exitoso para ${userId}. PaymentIntent ID: ${paymentIntentIdSimulado}`);
  // --- FIN SIMULACIÓN DE PAGO ---

  const fechaInicio = admin.firestore.Timestamp.now();
  const fechaExpiracionDate = new Date(fechaInicio.toDate().getTime());
  fechaExpiracionDate.setMonth(fechaExpiracionDate.getMonth() + planSeleccionado.duracionMeses);
  const fechaExpiracion = admin.firestore.Timestamp.fromDate(fechaExpiracionDate);

  const membresiaRef = db.collection("membresias").doc(userId); // El ID del documento es el UID del usuario/prestador
  const membresiaData: MembresiaData = {
    userId: userId,
    rol: rol,
    tipoMembresia: tipoMembresiaDeseado, // Guarda el tipo base, ej. "premium_mensual"
    fechaInicio: fechaInicio,
    fechaExpiracion: fechaExpiracion,
    estadoMembresia: "activa",
    beneficiosAdicionales: planSeleccionado.beneficios,
    ultimoPaymentIntentId: paymentIntentIdSimulado,
    // stripeSubscriptionId o mercadoPagoSubscriptionId se guardarían aquí si fuera real
  };

  try {
    await membresiaRef.set(membresiaData, { merge: true });
    functions.logger.info(`[activarMembresia] Documento de membresía para ${userId} creado/actualizado.`);

    // Actualizar Custom Claims
    const currentClaims = (await admin.auth().getUser(userId)).customClaims || {};
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims,
      premium: true, // Un claim genérico de premium
      rol: rol, // Guardar el rol en los claims
      membresiaTipo: tipoMembresiaDeseado, // Tipo específico de membresía
      membresiaExpiraEpoch: fechaExpiracion.toMillis(), // Para validaciones rápidas
    });
    functions.logger.info(`[activarMembresia] Custom claims actualizados para ${userId}.`);

    // Actualizar perfil en colección 'usuarios' o 'prestadores'
    const perfilCollection = rol === 'usuario' ? "usuarios" : "prestadores";
    const perfilRef = db.collection(perfilCollection).doc(userId);
    await perfilRef.set({
      membresiaActual: tipoMembresiaDeseado, // Guardar el tipo específico en el perfil
      isPremium: true,
      fechaExpiracionMembresia: fechaExpiracion, // Para consulta/display en el perfil
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

      const userProfile = await getMockUser(userId); // O leer de la colección membresias
      const userIsPremium = context.auth.token.premium === true || userProfile?.isPremium === true;

      let warrantyDays = STANDARD_WARRANTY_DAYS;
      if (userIsPremium) {
        warrantyDays = PREMIUM_WARRANTY_DAYS;
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
        warrantyEndDate: warrantyEndDateDt.toISOString().split("T")[0], // Guardar solo YYYY-MM-DD
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
      // Verificar si la ventana de calificación ha expirado
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        transaction.update(servicioRef, { habilitarCalificacion: false }); // Deshabilitar si ya expiró
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
      let prestadorName = `Prestador ${servicioData.prestadorId.substring(0, 5)}`; // Fallback name

      if (prestadorDoc.exists) {
        const prestadorData = prestadorDoc.data() as ProviderData;
        newRatingSum = (prestadorData.ratingSum || 0) + calificacion;
        newRatingCount = (prestadorData.ratingCount || 0) + 1;
        prestadorName = prestadorData.name || prestadorName; // Usar nombre existente si lo hay
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(prestadorDocRef, {
        ratingSum: newRatingSum,
        ratingCount: newRatingCount,
        rating: currentRating,
        name: prestadorName, // Asegurar que el nombre se guarde/actualice
        uid: servicioData.prestadorId, // Asegurar que el uid se guarde
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.Timestamp.now(),
      };

      // Si el prestador ya calificó al usuario, marcar como calificación mutua completada
      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
      }

      // Si el servicio no está en disputa y el pago estaba retenido, liberarlo.
      if (servicioData.estado !== "en_disputa") {
        servicioUpdate.estado = "cerrado_con_calificacion";
        if (servicioData.paymentStatus === "retenido_para_liberacion") {
          functions.logger.info(`[calificarPrestador] Usuario ${userId} calificó servicio ${servicioId}. Liberando pago.`);
          servicioUpdate.paymentStatus = "liberado_al_proveedor"; // Cambiar estado del pago
          servicioUpdate.fechaLiberacionPago = admin.firestore.Timestamp.now(); // Registrar fecha de liberación
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
  const usuarioCollectionRef = db.collection("usuarios"); // Colección donde se guardan los perfiles de usuarios

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
      if (!servicioData.habilitarCalificacion) { // El usuario debe haber confirmado primero
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
      let userName = `Usuario ${servicioData.usuarioId.substring(0, 5)}`; // Fallback name

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1;
        userName = usuarioData.name || userName;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      // Actualizar o crear el documento del usuario
      transaction.set(usuarioDocRef, {
        uid: servicioData.usuarioId, // Asegurar que el uid se guarde
        name: userName, // Asegurar que el nombre se guarde/actualice
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: currentRating,
        lastRatedByProviderAt: admin.firestore.Timestamp.now(), // Opcional: registrar cuándo fue calificado por última vez
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.Timestamp.now(),
      };

      // Si el usuario ya había calificado al prestador, marcar como calificación mutua completada
      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        // Si ambas partes calificaron y no hay disputa, el servicio se considera cerrado.
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
      // Permitir reportar si el servicio está completado por el usuario Y dentro de la ventana de calificación/disputa
      if (servicioData.estado !== "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios que hayas confirmado ('completado_por_usuario'). Estado actual: ${servicioData.estado}`);
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") { // Ya existe un reporte activo
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      const reporteId = db.collection("reportes").doc().id; // Generar ID para el nuevo reporte

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa", // Congelar el pago
        detallesDisputa: {
          reportadoEn: now,
          detalle: detalleProblema,
          reporteId: reporteId, // Guardar el ID del reporte en el servicio
        },
        updatedAt: now,
      });

      // Opcional: Crear un documento separado en una colección "reportes" (buena práctica)
      const datosReporte = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: detalleProblema,
        fechaReporte: now,
        estado: "pendiente", // Estado inicial del reporte/disputa
      };
      transaction.set(db.collection("reportes").doc(reporteId), datosReporte);


      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteId}. Pago congelado.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${servicioData.prestadorId} y al admin sobre la disputa del servicio ${servicioId}.`);
      // Aquí podrías llamar a `crearNotificacion` para el prestador y el admin.

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
      .orderBy("fechaConfirmacion", "desc") // Ordenar por fecha de confirmación
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = []; // Usar Partial para flexibilidad
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id, // Incluir el ID del documento
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion, // Fecha de confirmación del usuario
        // Añadir más campos si son necesarios para la UI
        detallesServicio: servicio.detallesServicio,
        // por ejemplo:
        // montoCobrado: servicio.montoCobrado,
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
  const prestadorId = context.auth.uid; // El UID del prestador autenticado
  const { tipoDocumento, urlDocumento, descripcion } = data;

  if (!tipoDocumento || typeof tipoDocumento !== "string" || !urlDocumento || typeof urlDocumento !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tipoDocumento' y 'urlDocumento' válidos.");
  }

  const prestadorRef = db.collection("prestadores").doc(prestadorId);

  const nuevoDocumento: DocumentoVerificable = {
    tipoDocumento: tipoDocumento,
    urlDocumento: urlDocumento,
    ...(descripcion && { descripcion: descripcion }), // Añadir descripción solo si existe
    fechaRegistro: admin.firestore.Timestamp.now(),
    estadoVerificacion: "pendiente", // Estado inicial
  };

  try {
    // Usar una transacción para asegurar la atomicidad si el documento del prestador no existe
    await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        // Si el prestador no tiene documento, se puede crear uno básico o lanzar error.
        // Por ahora, crearemos uno básico.
        functions.logger.info(`Documento del prestador ${prestadorId} no encontrado, creando uno nuevo con el documento.`);
        transaction.set(prestadorRef, { documentosVerificables: [nuevoDocumento], uid: prestadorId, name: `Prestador ${prestadorId.substring(0,5)}` });
      } else {
        // Si el prestador existe, añadir el documento al arreglo
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
      throw error; // Re-lanzar errores HttpsError
    }
    throw new functions.https.HttpsError("internal", "Error al registrar el documento.", error.message);
  }
});

export const verificarDocumentoProfesional = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando verificarDocumentoProfesional (simulación IA con Vision API)", { structuredData: true, data });

  // Verificar si el llamador es un administrador o moderador
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
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : []; // Copiar para modificar

      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];

      // Solo procesar si está pendiente o fue rechazado previamente por IA (para permitir re-intentos o revisión manual después de IA)
      const validPreviousStatesForIA: DocumentoVerificable["estadoVerificacion"][] = ["pendiente", "rechazado_ia", "Rechazado por datos sensibles detectados"];
      if (!validPreviousStatesForIA.includes(documentoAVerificar.estadoVerificacion) ) {
        functions.logger.warn(`Documento ${documentoIndex} para ${prestadorId} no está en estado procesable por IA. Estado actual: ${documentoAVerificar.estadoVerificacion}`);
        // Podríamos retornar un éxito falso o un mensaje específico
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
        // Marcar como error de IA y actualizar el documento
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia"; // O un estado específico de error de API
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError.message);
      }

      // Combinar texto para análisis (descripción, tipo, y texto extraído)
      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;

      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      // Detección de números de teléfono (10 dígitos, opcionalmente con +52)
      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(\d{2,3}\)\s?)?(?:[ -]?\d){7,10}/g; // Busca secuencias de 7 a 10 dígitos, con posibles separadores y código de país
      const phoneMatches = textoParaAnalizar.match(phoneRegex);
      if (phoneMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...phoneMatches.map((m) => `Teléfono: ${m.trim()}`));
      }

      // Detección de correos electrónicos
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatches = textoParaAnalizar.match(emailRegex);
      if (emailMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...emailMatches.map((m) => `Email: ${m.trim()}`));
      }
      
      // Detección de palabras clave prohibidas adicionales
      for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
        // Usar word boundaries para evitar falsos positivos (ej. "mail" en "email")
        const palabraRegex = new RegExp(`\\b${palabra.toLowerCase()}\\b`, "g");
        if (palabraRegex.test(textoParaAnalizar)) {
          // Evitar duplicados si ya se detectó por una regex más específica (ej. email)
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
        nuevoEstado = "Rechazado por datos sensibles detectados"; // Nuevo estado más específico
        documentos[documentoIndex].motivoRechazoIA = "Datos de contacto detectados.";
        documentos[documentoIndex].palabrasClaveDetectadasIA = palabrasDetectadas; // Guardar las palabras detectadas
        mensajeRespuesta = "Rechazado: Se detectaron datos de contacto en el documento.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} RECHAZADO por IA. Palabras: ${palabrasDetectadas.join(", ")}`);
      } else {
        // Si no se encontraron datos sensibles, marcar como "Validado"
        // (antes era "verificado_ia", lo cambiamos a "Validado" como estado final positivo de IA)
        nuevoEstado = "Validado";
        documentos[documentoIndex].motivoRechazoIA = undefined; // Limpiar motivo de rechazo
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined; // Limpiar palabras detectadas
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} VALIDADO por IA.`);
      }
      documentos[documentoIndex].estadoVerificacion = nuevoEstado;

      transaction.update(prestadorRef, { documentosVerificables: documentos });

      // Guardar log en la colección de verificaciones (opcional pero útil)
      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl: urlDocumento,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentos[documentoIndex].fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length, // Guardar longitud para referencia
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [], // Guardar si se encontraron
        agenteVerificador: context.auth?.uid || "sistema_ia_callable", // Quién ejecutó esta verificación
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
  if (context.auth.token.premium !== true) { // Verificar si el usuario es premium a través de custom claims
    throw new functions.https.HttpsError("permission-denied", "Esta función es solo para usuarios premium.");
  }

  const usuarioId = context.auth.uid;
  const { servicioId, motivo } = data;

  if (!servicioId || typeof servicioId !== "string" || !motivo || typeof motivo !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo' válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const garantiasRef = db.collection("garantias"); // Nueva colección para solicitudes de garantía

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
      if (servicioData.garantiaSolicitada === true) { // Verificar si ya se solicitó
        throw new functions.https.HttpsError("already-exists", "Ya se ha solicitado una garantía para este servicio.");
      }
      
      // Verificar si la fecha actual está dentro del período de garantía
      const warrantyEndDateString = servicioData.warrantyEndDate;
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString); // 'YYYY-MM-DD'
      const currentDate = new Date();
      currentDate.setHours(0,0,0,0); // Comparar solo fechas
      warrantyEndDate.setHours(23,59,59,999); // Asegurar que cubra todo el día

      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      // Crear nuevo documento en la colección "garantias"
      const nuevaSolicitudGarantiaRef = garantiasRef.doc(); // Firestore generará el ID
      const nuevaGarantiaData: GarantiaData = {
        // id: nuevaSolicitudGarantiaRef.id, // El ID se asigna automáticamente
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        estadoGarantia: "pendiente", // Estado inicial
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      // Actualizar el servicio original
      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id, // Guardar referencia al doc de garantía
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Garantía premium activada para servicio ${servicioId}. Garantía ID: ${nuevaSolicitudGarantiaRef.id}`);
      functions.logger.warn(`SIMULACIÓN: Notificar al admin sobre la nueva solicitud de garantía ${nuevaSolicitudGarantiaRef.id}.`);
      // Aquí podrías llamar a crearNotificacion para el admin.
      
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
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Ejemplo de roles
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

      const validPreviousStates: GarantiaData["estadoGarantia"][] = ["pendiente", "en_revision"];
      if (!validPreviousStates.includes(garantiaData.estadoGarantia)) {
        throw new functions.https.HttpsError("failed-precondition", `La garantía ya ha sido resuelta o está en un estado inválido (${garantiaData.estadoGarantia}).`);
      }

      const updateGarantiaData: Partial<GarantiaData> = {
        estadoGarantia: decision,
        fechaResolucionGarantia: admin.firestore.Timestamp.now(),
        resolucionDetalles: comentarioResolucion || "", // Guardar comentario
        resueltaPor: context.auth?.uid, // Quién resolvió
      };
      transaction.update(garantiaRef, updateGarantiaData);

      // Actualizar el servicio original
      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> = {
        garantiaResultado: decision, // Guardar resultado en el servicio
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true; // Marcar si se autoriza compensación
        functions.logger.info(`Garantía ${garantiaId} aprobada. SIMULACIÓN: Iniciar proceso de compensación/reembolso para servicio ${garantiaData.servicioId}.`);
        // Aquí iría la lógica para iniciar un reembolso, ofrecer un crédito, etc.
      } else { // Si es rechazada
        servicioUpdateData.compensacionAutorizada = false;
      }
      transaction.update(servicioRef, servicioUpdateData);


      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${garantiaData.usuarioId} y al prestador ${garantiaData.prestadorId} sobre la resolución de la garantía.`);
      // Aquí llamarías a crearNotificacion para el usuario y el prestador.

      return { success: true, message: `Solicitud de garantía ${decision} exitosamente.` };
    });
  } catch (error: any) {
    functions.logger.error("Error en la transacción de resolverGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al resolver la garantía.", error.message);
  }
});

export const simulateDailyAutomatedChecks = functions.pubsub
  .schedule("every 24 hours") // Puedes cambiar esto a 'every day 00:00' o similar
  // .timeZone('America/Mexico_City') // Opcional: especifica tu zona horaria
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = admin.firestore.Timestamp.now();
    const windowDays = RATING_AND_DISPUTE_WINDOW_DAYS; // Ahora 3 días
    const windowLimitDate = new Date(now.toDate().getTime() - windowDays * 24 * 60 * 60 * 1000);
    const windowLimitTimestamp = admin.firestore.Timestamp.fromDate(windowLimitDate);

    const serviciosRef = db.collection("servicios");
    const batch = db.batch();
    let processedCount = 0;

    functions.logger.info(`[DailyCheck] Buscando servicios para cierre automático (ventana de ${windowDays} días). Límite de fecha para confirmación de usuario: ${windowLimitDate.toISOString()}`);

    // Caso 1: Servicios completados por usuario, pago retenido, ventana de 3 días expirada, sin calificación
    const queryPagosPendientes = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("userConfirmedCompletionAt", "<=", windowLimitTimestamp); // Confirmado hace 3+ días

    try {
      const snapshotPagos = await queryPagosPendientes.get();
      functions.logger.info(`[DailyCheck] Encontrados ${snapshotPagos.size} servicios 'completado_por_usuario' con pago 'retenido_para_liberacion' y confirmados hace más de ${windowDays} días.`);
      
      snapshotPagos.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        functions.logger.log(`[DailyCheck] Procesando servicio para cierre automático: ${doc.id}. Estado: ${servicio.estado}, userConfirmedCompletionAt: ${servicio.userConfirmedCompletionAt?.toDate().toISOString()}`);
        
        // Asegurarse de que no esté en disputa y que no haya sido calificado por el usuario
        if (
          !servicio.calificacionUsuario && 
          servicio.estado !== "en_disputa" // Doble check, aunque la query principal ya filtra
        ) {
          functions.logger.info(`[DailyCheck] CERRANDO AUTOMÁTICAMENTE Y LIBERANDO PAGO para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
          batch.update(doc.ref, {
            paymentStatus: "liberado_al_proveedor",
            fechaLiberacionPago: now,
            estado: "cerrado_automaticamente", // Nuevo estado para cierre automático
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
    
    // Caso 2: Servicios ya calificados por el usuario, pero pago aún retenido (fallback o barrido)
    // Esto cubre el caso donde la función de calificar no liberó el pago inmediatamente.
    const queryCalificadosPagoRetenido = serviciosRef
        .where("estado", "==", "cerrado_con_calificacion")
        .where("paymentStatus", "==", "retenido_para_liberacion");

    try {
        const snapshotCalificados = await queryCalificadosPagoRetenido.get();
        functions.logger.info(`[DailyCheck] Encontrados ${snapshotCalificados.size} servicios 'cerrado_con_calificacion' con pago 'retenido_para_liberacion'.`);

        snapshotCalificados.forEach(doc => {
            const servicio = doc.data() as ServiceData;
            if (servicio.estado !== "en_disputa") { // Asegurar que no esté en disputa
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
        // Aquí se podrían disparar las notificaciones para cada servicio actualizado en el lote,
        // aunque sería más robusto tener un trigger 'onUpdate' en 'servicios' para eso.
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
  const providerId = context.auth.uid; // Usar el UID del usuario autenticado como providerId

  const { isAvailable, location } = data; // location es { lat: number, lng: number }

  if (typeof isAvailable !== "boolean") {
    functions.logger.error("El parámetro 'isAvailable' debe ser un booleano.", { isAvailable });
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el parámetro 'isAvailable' (booleano).");
  }

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();
  const updates: Partial<ProviderData> = { // Usar Partial para flexibilidad
    isAvailable: isAvailable,
    lastConnection: now,
  };

  if (isAvailable === true) {
    // Si se está marcando como disponible, la ubicación es requerida
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      functions.logger.error("Si 'isAvailable' es true, se requiere un objeto 'location' con 'lat' y 'lng' numéricos.", { location });
      throw new functions.https.HttpsError("invalid-argument", "Se requiere 'location' con 'lat' y 'lng' válidos cuando 'isAvailable' es true.");
    }
    updates.currentLocation = { // Guardar como un mapa de Firestore
      lat: location.lat,
      lng: location.lng,
      timestamp: now, // Guardar también el timestamp de la ubicación
    };
  } else { // Si se está marcando como no disponible
    updates.currentLocation = null; // O admin.firestore.FieldValue.delete() para borrar el campo
  }

  try {
    // Usar set con merge:true para crear el documento si no existe, o actualizarlo si existe.
    // Esto es útil si un proveedor se registra y su primera acción es actualizar su estado.
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
  const providerId = context.auth.uid; // Usar el UID del usuario autenticado

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();

  const updates: Partial<ProviderData> = {
    isAvailable: false,
    currentLocation: null, // O admin.firestore.FieldValue.delete()
    lastConnection: now,
  };

  try {
    // Primero verificar si el documento del prestador existe
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      // Si el documento no existe, podríamos crearlo con el estado desconectado
      // o simplemente registrar un warning y retornar éxito (ya que el estado deseado es "desconectado").
      // Por ahora, lo crearemos si no existe, asumiendo que un proveedor puede desconectarse
      // incluso si su perfil no está completamente llenado o fue creado por otra vía.
      functions.logger.warn(`Prestador ${providerId} no encontrado. Se creará perfil básico y se desconectará.`);
      await providerRef.set({ // Crear con datos básicos si no existe
        uid: providerId,
        name: context.auth.token.name || `Prestador ${providerId.substring(0,5)}`, // Tomar nombre del token si está disponible
        isAvailable: false,
        currentLocation: null,
        lastConnection: now,
        rating: 0, // Valores iniciales
        ratingCount: 0,
        ratingSum: 0,
        allowsHourlyServices: false, // Default
        // otros campos default...
      });
      return { success: true, message: "Perfil no encontrado, se creó y desconectó." };
    }

    // Si el documento existe, actualizarlo
    await providerRef.update(updates);
    functions.logger.info(`Prestador ${providerId} desconectado y ubicación borrada.`);
    return { success: true, message: "Te has desconectado exitosamente." };
  } catch (error: any) {
    functions.logger.error(`Error al desconectar al prestador ${providerId}:`, error);
    throw new functions.https.HttpsError("internal", "Error al desconectar al prestador.", error.message);
  }
});

export const verificarEstadoFunciones = functions.https.onCall(async (data, context) => {
  // Opcional: Verificar si el llamador es un administrador
  // if (!context.auth || !context.auth.token.admin) {
  //   throw new functions.https.HttpsError("permission-denied", "Solo administradores pueden ejecutar esta función.");
  // }
  functions.logger.info("Iniciando verificarEstadoFunciones", { structuredData: true });

  // Lista de nombres de funciones que esperamos encontrar exportadas en este archivo
  const NOMBRES_FUNCIONES_ESPERADAS = [
    "confirmServiceCompletionByUserService",
    "calificarPrestador",
    "calificarUsuario",
    "reportServiceIssue",
    "obtenerServiciosCompletados",
    "registrarDocumentoProfesional",
    "verificarDocumentoProfesional",
    "activarGarantiaPremium",
    "resolverGarantiaPremium",
    "simulateDailyAutomatedChecks", // Pub/Sub
    "updateProviderRealtimeStatus",
    "disconnectProvider",
    "agendarCita", // Nombre anterior, ahora es agendarCitaConPrestador
    "cancelarCita", // Nombre anterior, ahora es cancelarCitaAgendada
    "confirmarCitaPorPrestador",
    "procesarCobroTrasConfirmacion",
    "reportarProblemaServicio", // Similar a reportServiceIssue
    "crearNotificacion",
    "enviarNotificacionInAppTrigger", // Firestore Trigger
    "notificarLiberacionPagoAutomatica", // Firestore Trigger
    "activarMembresia",
    "verificarEstadoFunciones", // Esta misma función
    "iniciarChat",
    "enviarMensaje",
    "moderarMensajesChat", // Firestore Trigger
    "agendarCitaConPrestador", // Nueva función de agendamiento
    // Añadir aquí cualquier nueva función
    "evaluarComportamientoPrestadorTrigger", // Firestore Trigger
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";
    
    // Identificar si es un trigger para no marcarla como ausente si no es callable
    const esTrigger = nombreFuncion.endsWith("Trigger") || nombreFuncion === "simulateDailyAutomatedChecks" || nombreFuncion === "moderarMensajesChat";

    // Consideramos una función crítica si no es un trigger y no es esta misma función de verificación
    if (!presenteEnCodigo && !esTrigger && nombreFuncion !== "verificarEstadoFunciones") {
      todasLasFuncionesCriticasPresentes = false;
    }

    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada), // 'function' o 'undefined'
      esPubSub: nombreFuncion === "simulateDailyAutomatedChecks",
      esFirestoreTrigger: nombreFuncion.endsWith("Trigger") || nombreFuncion === "moderarMensajesChat",
      // Los siguientes son solo placeholders, ya que no podemos obtener el estado real de GCP desde aquí
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
    fechaSolicitada, // Esperado como "YYYY-MM-DD"
    horaSolicitada,   // Esperado como "HH:MM" (ej. "14:30")
    detallesServicio,
    ubicacion, // Opcional: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number }
    notasAdicionales, // Opcional
    serviceType, // 'fixed' o 'hourly'
    precioServicio, // para 'fixed'
    tarifaPorHora, // para 'hourly' (podría tomarse del perfil del prestador)
    duracionHoras, // para 'hourly'
  } = data;

  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !serviceType) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos (prestadorId, fechaSolicitada, horaSolicitada, serviceType).");
  }

  // Validaciones de tipo de servicio
  if (serviceType === "fixed" && typeof precioServicio !== "number" && !detallesServicio) {
    throw new functions.https.HttpsError("invalid-argument", "Para citas de tipo 'fixed', se requiere 'detallesServicio' o un 'precioServicio'.");
  }
  if (serviceType === "hourly" && (typeof tarifaPorHora !== "number" || typeof duracionHoras !== "number" || duracionHoras <= 0)) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tarifaPorHora' y 'duracionHoras' válidas para citas de tipo 'hourly'.");
  }


  // Verificar existencia del prestador
  const prestadorRef = db.collection("prestadores").doc(prestadorId);
  const prestadorDoc = await prestadorRef.get();
  if (!prestadorDoc.exists) {
    throw new functions.https.HttpsError("not-found", `El prestador con ID ${prestadorId} no fue encontrado.`);
  }
  const prestadorData = prestadorDoc.data() as ProviderData;


  // Validar y convertir fecha y hora
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  const regexHora = /^\d{2}:\d{2}$/;

  if (!regexFecha.test(fechaSolicitada) || !regexHora.test(horaSolicitada)) {
    throw new functions.https.HttpsError("invalid-argument", "Formato de fecha (YYYY-MM-DD) u hora (HH:MM) inválido.");
  }

  let fechaHoraSolicitadaConvertida: admin.firestore.Timestamp;
  try {
    // Convertir a objeto Date de JS en UTC para evitar problemas de zona horaria al crear el Timestamp
    const [year, month, day] = fechaSolicitada.split("-").map(Number);
    const [hour, minute] = horaSolicitada.split(":").map(Number);
    // Meses en JS Date son 0-indexados
    const dateObject = new Date(Date.UTC(year, month - 1, day, hour, minute));

    if (isNaN(dateObject.getTime())) {
      throw new Error("Fecha u hora inválida después de la conversión.");
    }
    // Comparar con la hora actual también en UTC
    const nowUtc = new Date(new Date().toISOString().slice(0, -1)); // Obtener UTC actual sin milisegundos
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
    // Verificar conflicto de horario
    const conflictoQuery = citasRef
      .where("prestadorId", "==", prestadorId)
      .where("fechaHoraSolicitada", "==", fechaHoraSolicitadaConvertida)
      .where("estado", "in", ["pendiente_confirmacion", "confirmada_prestador", "pagada", "servicio_iniciado", "en_camino_proveedor"]); // Estados que implican ocupación

    const conflictoSnapshot = await conflictoQuery.get();
    if (!conflictoSnapshot.empty) {
      functions.logger.warn(`Conflicto de horario para prestador ${prestadorId} en ${fechaSolicitada} ${horaSolicitada}. Citas encontradas: ${conflictoSnapshot.size}`);
      throw new functions.https.HttpsError("failed-precondition", "El prestador ya tiene una cita agendada o confirmada en este horario. Por favor, elige otro.");
    }

    let montoTotalEstimado = 0;
    const nuevaCitaData: Partial<CitaData> = { // Usar Partial para construcción incremental
      usuarioId: usuarioId,
      prestadorId: prestadorId,
      fechaHoraSolicitada: fechaHoraSolicitadaConvertida,
      detallesServicio: detallesServicio || (serviceType === "hourly" ? "Servicio por horas" : "Servicio general"),
      estado: "pendiente_confirmacion", // Cambiado de "pendiente"
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      serviceType: serviceType,
    };

    if (serviceType === "fixed") {
      nuevaCitaData.precioServicio = precioServicio;
      montoTotalEstimado = precioServicio || 0; // Asumir 0 si no se provee, o manejar como error antes
    } else { // hourly
      // Si la tarifaPorHora no se envía, tomarla del perfil del prestador
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

    const citaRef = await citasRef.add(nuevaCitaData as CitaData); // Cast a CitaData
    functions.logger.info(`Cita agendada con ID: ${citaRef.id} por usuario ${usuarioId} para prestador ${prestadorId}. Estado: pendiente_confirmacion.`);

    // Simulación de notificación al prestador
    // await crearNotificacion(...)

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

      // Solo se pueden cancelar citas en estado "pendiente_confirmacion"
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
        // Esto no debería ocurrir si la validación de 'rol' al inicio es correcta
        throw new functions.https.HttpsError("internal", "Rol de cancelador inválido internamente.");
      }
      
      const updateData = {
        estado: nuevoEstado,
        fechaCancelacion: admin.firestore.FieldValue.serverTimestamp(),
        canceladaPor: canceladorIdAutenticado,
        rolCancelador: rol,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.update(citaRef, updateData);

      functions.logger.info(`Cita ${citaId} cancelada por ${rol} ${canceladorIdAutenticado}.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al ${notificarA} ${idNotificado} sobre la cancelación de la cita ${citaId} por el ${rol}.`);
      // Aquí podrías llamar a `crearNotificacion`
      // await crearNotificacion({
      //   destinatarioId: idNotificado,
      //   rolDestinatario: notificarA,
      //   titulo: `Cita Cancelada por ${rol === 'usuario' ? 'el Usuario' : 'el Prestador'}`,
      //   cuerpo: `La cita para "${citaData.detallesServicio}" del ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()} ha sido cancelada.`,
      //   tipoNotificacion: 'cita_cancelada',
      //   datosAdicionales: { citaId }
      // });
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

      // Verificar que el prestador autenticado es el prestador de la cita
      if (citaData.prestadorId !== prestadorIdAutenticado) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para modificar esta cita. No corresponde a tu ID de prestador.");
      }

      // Solo se pueden confirmar/rechazar citas en estado "pendiente_confirmacion"
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
        // Preparar para el cobro
        updateData.paymentStatus = "pendiente_cobro"; // Estado para que el sistema intente el cobro
        updateData.ordenCobroId = `sim_orden_${citaId}_${Date.now()}`; // ID de orden simulado
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
      
      // Simulación de Notificación al Usuario
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la ${accion} de la cita ${citaId}.`);
      // En un caso real, llamarías a crearNotificacion aquí:
      // try {
      //   await crearNotificacion({
      //     destinatarioId: citaData.usuarioId,
      //     rolDestinatario: 'usuario',
      //     titulo: tituloNotificacionUsuario,
      //     cuerpo: cuerpoNotificacionUsuario,
      //     tipoNotificacion: tipoNotificacionUsuario,
      //     prioridad: 'alta',
      //     datosAdicionales: { citaId: citaId }
      //   });
      // } catch (notifError) {
      //   functions.logger.error(`Error al crear notificación para usuario ${citaData.usuarioId}:`, notifError);
      // }
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

  // Autenticación: Podría ser llamada por un sistema o por el usuario si el flujo lo requiere.
  // Por ahora, asumimos que si es callable, debe estar autenticado.
  if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (o sistema).");
  }
  // Opcional: Verificar si el llamador es el usuario de la cita o un admin.
  // const llamadorId = context.auth.uid;

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

      // Validaciones
      if (citaData.estado !== "confirmada_prestador") {
        throw new functions.https.HttpsError("failed-precondition", `La cita no está en estado 'confirmada_prestador'. Estado actual: ${citaData.estado}.`);
      }
      if (citaData.paymentStatus !== "pendiente_cobro") {
        throw new functions.https.HttpsError("failed-precondition", `El estado del pago no es 'pendiente_cobro'. Estado actual: ${citaData.paymentStatus}.`);
      }

      // Validar monto a cobrar (debe estar en montoTotalEstimado)
      if (typeof citaData.montoTotalEstimado !== "number" || citaData.montoTotalEstimado <= 0) {
        functions.logger.error(`Monto total estimado inválido para cita ${citaId}: ${citaData.montoTotalEstimado}`);
        throw new functions.https.HttpsError("internal", "Monto total estimado inválido para la cita.");
      }

      // --- SIMULACIÓN DE PROCESAMIENTO DE PAGO ---
      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Iniciando cobro para cita ${citaId}, Usuario: ${citaData.usuarioId}, Orden ID: ${citaData.ordenCobroId}, Monto: ${citaData.montoTotalEstimado}.`);
      // En un sistema real, aquí interactuarías con Stripe, MercadoPago, etc.
      // const paymentIntent = await stripe.paymentIntents.create({ amount: citaData.montoTotalEstimado * 100, currency: 'mxn', ... });
      const pagoExitosoSimulado = true; // Cambiar a false para probar fallos
      
      if (pagoExitosoSimulado) {
        transaction.update(citaRef, {
          estado: "pagada", // Nuevo estado después del pago
          paymentStatus: "procesado_exitosamente", // El pago se procesó bien
          fechaCobro: admin.firestore.Timestamp.now(),
          montoCobrado: citaData.montoTotalEstimado, // Guardar el monto efectivamente cobrado
          updatedAt: admin.firestore.Timestamp.now(),
        });
        functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} procesado exitosamente.`);
        functions.logger.warn(`[ProcesarCobro] SIMULACIÓN: Notificar a usuario ${citaData.usuarioId} y prestador ${citaData.prestadorId} sobre pago exitoso para cita ${citaId}.`);
        // Aquí llamarías a crearNotificacion
        return { success: true, message: `Cobro para la cita ${citaId} procesado exitosamente. El servicio está ahora en estado 'pagada'.` };
      } else {
        functions.logger.error(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} FALLIDO.`);
        transaction.update(citaRef, {
          paymentStatus: "fallido", // Marcar el pago como fallido
          // Podrías añadir un campo para el motivo del fallo si la pasarela lo provee
          fechaCobro: admin.firestore.Timestamp.now(), // Registrar intento de cobro
          updatedAt: admin.firestore.Timestamp.now(),
        });
        // Notificar al usuario sobre el fallo del pago
        throw new functions.https.HttpsError("aborted", "El procesamiento del pago falló (simulado).");
      }
      // --- FIN SIMULACIÓN DE PROCESAMIENTO DE PAGO ---
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
  functions.logger.info("Iniciando reportarProblemaServicio (similar a reportServiceIssue)", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo, urlEvidencia } = data; // Cambiado de detalleProblema a motivo

  if (!servicioId || typeof servicioId !== "string" || !motivo || typeof motivo !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo' válidos.");
  }

  // Asumimos que el reporte es sobre un "servicio" (documento en 'servicios' o 'citas' si se unifican)
  // Por ahora, mantendremos la lógica de "servicios" para esta función,
  // pero podría necesitar adaptarse si las citas son el único flujo que llega a "completado_por_usuario"
  const servicioRef = db.collection("servicios").doc(servicioId); 

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `El servicio con ID ${servicioId} no fue encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData; // Asumiendo que es un ServiceData

      if (servicioData.usuarioId !== usuarioId) {
        throw new functions.https.HttpsError("permission-denied", "No estás autorizado para reportar un problema sobre este servicio.");
      }

      // Estados válidos para reportar un problema. Incluir estados finales donde aún se pueda aplicar garantía/reporte.
      const validReportStates: ServiceRequestStatus[] = ["completado_por_usuario", "cerrado_con_calificacion", "cerrado_automaticamente"];
      if (!validReportStates.includes(servicioData.estado)) {
         throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios en estados como ${validReportStates.join(", ")}. Estado actual: ${servicioData.estado}`);
      }
      
      // Usar ratingWindowExpiresAt como la ventana para reportar problemas también
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date() && servicioData.estado !== "cerrado_automaticamente") {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema ha expirado.");
      }
      if (servicioData.estado === "en_disputa") { // Ya existe un reporte activo
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      const reporteId = db.collection("reportes").doc().id; // ID para el nuevo documento en 'reportes'

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa",
        detallesDisputa: {
          reportadoEn: now,
          detalle: motivo, // Usar 'motivo'
          reporteId: reporteId,
        },
        updatedAt: now,
      });

      // Crear el documento en la colección "reportes"
      const datosReporte: any = { // Definir una interfaz para ReporteData sería bueno
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaReporte: now,
        estado: "pendiente", // Estado inicial del reporte
      };
      if (urlEvidencia) {
        datosReporte.urlEvidencia = urlEvidencia;
      }
      transaction.set(db.collection("reportes").doc(reporteId), datosReporte);

      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteId}. Pago congelado.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${servicioData.prestadorId} y al admin sobre la disputa del servicio ${servicioId}.`);
      // Llamar a crearNotificacion
      
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

  // Descomentar si quieres que solo usuarios autenticados puedan crear notificaciones
  // if (!context.auth) {
  //   throw new functions.https.HttpsError("unauthenticated", "Se requiere autenticación para crear una notificación.");
  // }

  const {
    destinatarioId,
    rolDestinatario, // 'usuario' o 'prestador'
    titulo,
    cuerpo,
    tipoNotificacion, // ej. 'cita_confirmada', 'nuevo_mensaje', etc.
    prioridad, // 'alta' o 'normal'
    datosAdicionales, // objeto opcional con más info, ej. { citaId: 'xyz' }
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

  // Estructura del documento de notificación
  const nuevaNotificacionData: Omit<NotificacionData, "id" | "fechaCreacion" | "triggerProcesadoEn" | "fechaLectura"> = {
    destinatarioId: destinatarioId,
    rolDestinatario: rolDestinatario,
    titulo: titulo,
    cuerpo: cuerpo,
    estadoNotificacion: "pendiente", // Estado inicial
    tipoNotificacion: tipoNotificacion,
    prioridad: prioridadValida,
    ...(datosAdicionales && { datosAdicionales: datosAdicionales }), // Añadir solo si existe
  };

  try {
    const notificacionRef = await db.collection("notificaciones").add({
      ...nuevaNotificacionData,
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(), // Timestamp del servidor
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

      // SIMULACIÓN: Aquí iría la lógica para enviar un mensaje FCM o interactuar con otro sistema de notificaciones.
      // Por ejemplo, podrías construir un payload para FCM:
      // const payload = {
      //   notification: {
      //     title: notificacionData.titulo,
      //     body: notificacionData.cuerpo,
      //   },
      //   data: {
      //     tipoNotificacion: notificacionData.tipoNotificacion,
      //     ...notificacionData.datosAdicionales,
      //     notificacionId: notificacionId,
      //     click_action: 'FLUTTER_NOTIFICATION_CLICK', // Para apps Flutter, o similar
      //   },
      // };
      // const userDeviceToken = await obtenerTokenDelUsuario(notificacionData.destinatarioId);
      // if (userDeviceToken) {
      //   await admin.messaging().sendToDevice(userDeviceToken, payload);
      //   functions.logger.info(`[Trigger] Mensaje FCM enviado para notificación ${notificacionId} a ${notificacionData.destinatarioId}.`);
      // } else {
      //   functions.logger.warn(`[Trigger] No se encontró token de dispositivo para ${notificacionData.destinatarioId} para notificación ${notificacionId}.`);
      // }
      functions.logger.log(`[Trigger] SIMULACIÓN: Enviando notificación (ej. FCM) para ${notificacionId} a ${notificacionData.destinatarioId}. Título: ${notificacionData.titulo}`);
      
      // Actualizar el estado de la notificación para indicar que el trigger la ha procesado
      // (o que se ha enviado a FCM, etc.)
      try {
        await snapshot.ref.update({
          estadoNotificacion: "procesada_por_trigger", // O un estado más específico si envías FCM
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

    // Verificar si es una liberación automática de pago
    const esLiberacionAutomatica =
      beforeData.estado === "completado_por_usuario" && // Antes estaba completado por el usuario
      afterData.estado === "cerrado_automaticamente" && // Ahora está cerrado automáticamente
      beforeData.paymentStatus === "retenido_para_liberacion" && // El pago estaba retenido
      afterData.paymentStatus === "liberado_al_proveedor" && // Ahora el pago está liberado
      !afterData.calificacionUsuario; // Y el usuario no calificó

    if (esLiberacionAutomatica) {
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Detectada liberación automática de pago para servicio ${servicioId}. Preparando notificaciones.`);

      const servicioDetalles = afterData.detallesServicio || "Servicio sin descripción detallada";
      const fechaServicio = afterData.fechaServicio?.toDate().toLocaleDateString("es-MX") || 
                            afterData.fechaConfirmacion?.toDate().toLocaleDateString("es-MX") || 
                            "Fecha no especificada";
      const montoLiberado = afterData.montoCobrado || (afterData as CitaData).montoTotalEstimado || 0; // Ajuste para CitaData si se usa

      // Notificación al Usuario
      try {
        await crearNotificacion({ // Llamada interna simulada
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

      // Notificación al Prestador
      try {
        await crearNotificacion({ // Llamada interna simulada
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

// --- FUNCIONES DE CHAT ---

export const iniciarChat = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando iniciarChat", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const iniciadorId = context.auth.uid;
  const { destinatarioId, metadataAdicional } = data; // metadataAdicional es opcional

  if (!destinatarioId || typeof destinatarioId !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'destinatarioId'.");
  }
  if (iniciadorId === destinatarioId) {
    throw new functions.https.HttpsError("invalid-argument", "No puedes iniciar un chat contigo mismo.");
  }

  const participantesUids = [iniciadorId, destinatarioId].sort(); // Ordenar para consulta consistente
  const chatsRef = db.collection("chats");

  try {
    // Buscar si ya existe un chat activo entre estos dos participantes
    // Podríamos también buscar chats archivados si queremos "reactivarlos"
    const q = chatsRef
      .where("participantesUids", "==", participantesUids)
      // .where("estadoChat", "==", "activo") // Podríamos omitir esto si queremos encontrar también archivados
      .limit(1);
      
    const chatExistenteSnap = await q.get();

    if (!chatExistenteSnap.empty) {
      const chatExistenteDoc = chatExistenteSnap.docs[0];
      const chatExistenteData = chatExistenteDoc.data() as ChatDataFirestore;
      functions.logger.info(`Chat encontrado entre ${iniciadorId} y ${destinatarioId}. ID: ${chatExistenteDoc.id}, Estado: ${chatExistenteData.estadoChat}`);
      
      // Si el chat está archivado por el iniciador, podríamos reactivarlo
      // if (chatExistenteData.estadoChat === `archivado_${context.auth.token.rol}`) { // Necesitaríamos el rol del iniciador
      //   await chatExistenteDoc.ref.update({ estadoChat: 'activo', ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
      //   functions.logger.info(`Chat ${chatExistenteDoc.id} reactivado.`);
      // }
      return { success: true, chatId: chatExistenteDoc.id, nuevo: false, message: "Chat encontrado." };
    }

    // Si no existe, crear uno nuevo
    functions.logger.info(`No se encontró chat. Creando nuevo chat entre ${iniciadorId} y ${destinatarioId}.`);
    
    // Obtener info de los participantes (simulado por ahora, requeriría leer perfiles)
    // const iniciadorInfo = await getParticipantInfo(iniciadorId); // Función auxiliar
    // const destinatarioInfo = await getParticipantInfo(destinatarioId);

    const nuevoChatData: Omit<ChatDataFirestore, "id" | "mensajes"> = {
      participantesUids: participantesUids,
      // participantesInfo: {
      //   [iniciadorId]: iniciadorInfo,
      //   [destinatarioId]: destinatarioInfo,
      // },
      estadoChat: "activo",
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      conteoNoLeido: { // Inicializar conteo de no leídos
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
  // La subcolección de mensajes se manejaría con `chatRef.collection("mensajes").add(...)`
  // Por ahora, lo mantenemos como un array en el documento principal del chat para simplicidad,
  // pero para producción es mejor una subcolección.

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
        // Considerar si se permite enviar mensajes a chats archivados (que los reactivaría)
        throw new functions.https.HttpsError("failed-precondition", `No se pueden enviar mensajes a un chat que no esté activo. Estado actual: ${chatData.estadoChat}`);
      }

      const nuevoMensaje: MensajeDataFirestore = {
        remitenteId: remitenteId,
        texto: texto, // El texto original antes de moderación
        timestamp: admin.firestore.Timestamp.now(), // Usar Timestamp, no serverTimestamp para arrayUnion
        leido: false, // Por defecto no leído
      };

      // Encontrar el ID del destinatario para incrementar su contador de no leídos
      const destinatarioDelMensajeId = chatData.participantesUids.find(uid => uid !== remitenteId);
      
      const updates: Partial<ChatDataFirestore> & { ultimaActualizacion: admin.firestore.FieldValue } = {
        // Esta forma de añadir mensajes a un array tiene limitaciones de tamaño de documento (1MB).
        // Para producción, una subcolección 'mensajes' es preferible.
        mensajes: admin.firestore.FieldValue.arrayUnion(nuevoMensaje) as any, 
        ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
        ultimoMensajeTexto: texto.substring(0, 100), // Snippet del último mensaje
        ultimoMensajeTimestamp: nuevoMensaje.timestamp, // Usar el mismo timestamp
        ultimoMensajeRemitenteId: remitenteId,
      };

      // Incrementar el contador de no leídos del destinatario
      if (destinatarioDelMensajeId) {
        updates.conteoNoLeido = {
          ...chatData.conteoNoLeido, // Mantener los conteos existentes
          [destinatarioDelMensajeId]: admin.firestore.FieldValue.increment(1) as any,
        };
      }
      
      transaction.update(chatRef, updates);
      // Si se usa una subcolección 'mensajes':
      // const mensajeRef = chatRef.collection("mensajes").doc(); // Genera ID
      // transaction.set(mensajeRef, nuevoMensaje);
      // const chatDocUpdates = { ultimaActualizacion, ultimoMensajeTexto, ... };
      // transaction.update(chatRef, chatDocUpdates);
    });

    functions.logger.info(`Mensaje enviado por ${remitenteId} al chat ${chatId}. Texto: "${texto.substring(0,30)}..."`);
    // Aquí se podría disparar una notificación al destinatario.
    // await crearNotificacion({ ... })

    return { success: true, message: "Mensaje enviado exitosamente." };
  } catch (error: any)
 {
    functions.logger.error(`Error al enviar mensaje al chat ${chatId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al enviar el mensaje.", error.message);
  }
});

export const moderarMensajesChat = functions.firestore
    .document('chats/{chatId}') // Escucha actualizaciones en el documento de chat
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
        
        // Si el mensaje ya fue moderado (ej. por una ejecución anterior de este trigger que falló al actualizar), no hacer nada.
        if (nuevoMensaje.moderado === true) {
            functions.logger.log(`[ModerarChat ${chatId}] Mensaje ya marcado como moderado, omitiendo.`);
            return null;
        }

        const mensajeTexto = nuevoMensaje.texto || '';
        const mensajeIdSimulado = `${nuevoMensaje.timestamp.toMillis()}_${nuevoMensaje.remitenteId}`;

        functions.logger.log(`[ModerarChat ${chatId}] Nuevo mensaje detectado (ID simulado ${mensajeIdSimulado}): "${mensajeTexto.substring(0,50)}..."`);

        const regexTelefono = /(\+?\d{1,3}[-.\s]?(\(?\d{1,4}\)?[-.\s]?)*\d{1,4}[-.\s]?\d{1,9})/;
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
            
            // Crear una copia del array de mensajes para modificarlo
            const mensajesActualizados = [...afterData.mensajes];
            mensajesActualizados[afterData.mensajes.length - 1] = {
                ...nuevoMensaje,
                texto: '[Mensaje bloqueado por el sistema]',
                moderado: true,
                motivoBloqueo: motivo,
                textoOriginal: mensajeTexto, // Guardar el texto original para revisión si es necesario
            };

            try {
                // Actualizar solo el array de mensajes en el documento del chat
                await db.collection('chats').doc(chatId).update({
                    mensajes: mensajesActualizados,
                    // Actualizar también el snippet del último mensaje si es necesario
                    ultimoMensajeTexto: '[Mensaje bloqueado por el sistema]',
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                });
                functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) actualizado por moderación.`);

                // Notificar al remitente que su mensaje fue bloqueado
                // await crearNotificacion({
                //   destinatarioId: nuevoMensaje.remitenteId,
                //   rolDestinatario: 'usuario_o_prestador', // Necesitarías el rol del remitente
                //   titulo: "Mensaje Bloqueado",
                //   cuerpo: "Tu reciente mensaje en el chat ha sido bloqueado por contener información sensible.",
                //   tipoNotificacion: "mensaje_chat_bloqueado",
                //   datosAdicionales: { chatId: chatId }
                // });

            } catch (updateError) {
                functions.logger.error(`[ModerarChat ${chatId}] Error al actualizar mensaje moderado:`, updateError);
            }
        } else {
            functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) pasó la moderación.`);
        }
        return null;
    });

// --- FIN FUNCIONES DE CHAT ---

// --- TRIGGER PARA EVALUAR COMPORTAMIENTO DEL PRESTADOR ---
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

            // Simulación de lógica de penalización
            // Leer el conteo actual para tomar una decisión más informada
            const prestadorDocSnap = await prestadorRef.get();
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevoRechazosCount = (prestadorDataActual?.rechazosCount || 0) + 1;

            if (nuevoRechazosCount % 3 === 0) { // Penalización cada 3 rechazos
                const fechaExpiracionPenalizacion = new Date();
                fechaExpiracionPenalizacion.setDate(fechaExpiracionPenalizacion.getDate() + 1); // Penalización por 1 día

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

            if (nuevaConfirmacionesCount % 5 === 0) { // Incentivo cada 5 confirmaciones
                if (!actualizacionPrestador.incentivos) actualizacionPrestador.incentivos = {};
                actualizacionPrestador.incentivos.puntosReputacion = admin.firestore.FieldValue.increment(10) as any;
                logMessage += ` Otorgando 10 puntos de reputación.`;
            }
        }

        if (Object.keys(actualizacionPrestador).length > 0) {
            actualizacionPrestador.updatedAt = admin.firestore.FieldValue.serverTimestamp(); // Siempre actualizar
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

    

    