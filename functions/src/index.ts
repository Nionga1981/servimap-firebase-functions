
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

type CitaEstado = ServiceRequestStatus;

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

const PLANES_MEMBRESIA: { [key: string]: { duracionMeses: number, beneficios: MembresiaData['beneficiosAdicionales'], precioSimulado: number } } = {
  "premium_mensual_usuario": {
    duracionMeses: 1,
    beneficios: { prioridadAgenda: true, garantiaExtendidaDiasAdicionales: PREMIUM_WARRANTY_DAYS - STANDARD_WARRANTY_DAYS }, // 7 - 3 = 4 días adicionales
    precioSimulado: 10, // USD
  },
  "premium_anual_usuario": {
    duracionMeses: 12,
    beneficios: { prioridadAgenda: true, garantiaExtendidaDiasAdicionales: PREMIUM_WARRANTY_DAYS - STANDARD_WARRANTY_DAYS },
    precioSimulado: 100,
  },
  "premium_mensual_prestador": {
    duracionMeses: 1,
    beneficios: { descuentoComisionPorcentaje: 3 }, // Comisión del 3% en lugar del 6% estándar
    precioSimulado: 20,
  },
  "premium_anual_prestador": {
    duracionMeses: 12,
    beneficios: { descuentoComisionPorcentaje: 3 },
    precioSimulado: 200,
  },
  // Podrías añadir más planes "premium_plus", etc.
};


// --- FUNCIONES EXISTENTES (Resumidas y/o actualizadas) ---

// (Función de ejemplo para obtener datos de usuario, reemplazar con tu lógica real si es necesario)
async function getMockUser(userId: string): Promise<UserData | null> {
  const userRef = db.collection("usuarios").doc(userId);
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    return userDoc.data() as UserData;
  }
  // Simular si no existe, o si es un prestador, consultar 'prestadores'
  if (userId.startsWith("prestador")) {
    const providerRef = db.collection("prestadores").doc(userId);
    const providerDoc = await providerRef.get();
    if (providerDoc.exists) {
      // Adaptar ProviderData a UserData para el campo isPremium
      const providerData = providerDoc.data() as ProviderData;
      return { uid: userId, name: providerData.name, isPremium: providerData.membresiaActual?.includes("premium") };
    }
  }
  return null;
}


// (Función de ejemplo para calcular comisiones, NO ES UNA CLOUD FUNCTION EXPORTADA)
async function _calcularMontoParaProveedor(servicioId: string, montoTotalServicio: number): Promise<number> {
  functions.logger.info(`[Comisiones] Calculando monto para proveedor del servicio: ${servicioId}, monto total: ${montoTotalServicio}`);
  const COMISION_ESTANDAR_PORCENTAJE = 6; // 6%
  const COMISION_PREMIUM_PRESTADOR_PORCENTAJE = 3; // 3%

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
      if (membresiaData.tipoMembresia.includes("premium")) { // Chequeo simple
        comisionPorcentaje = membresiaData.beneficiosAdicionales?.descuentoComisionPorcentaje ?? COMISION_PREMIUM_PRESTADOR_PORCENTAJE;
        functions.logger.info(`[Comisiones] Prestador ${prestadorId} tiene membresía premium activa. Comisión aplicada: ${comisionPorcentaje}%`);
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
  const { rol, tipoMembresiaDeseado } = data; // Ej: 'premium_mensual_usuario', 'premium_mensual_prestador'

  if (!rol || (rol !== 'usuario' && rol !== 'prestador')) {
    throw new functions.https.HttpsError("invalid-argument", "El rol ('usuario' o 'prestador') es requerido.");
  }
  if (!tipoMembresiaDeseado || typeof tipoMembresiaDeseado !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "El 'tipoMembresiaDeseado' es requerido.");
  }

  const planSeleccionado = PLANES_MEMBRESIA[`${tipoMembresiaDeseado}_${rol}`] || PLANES_MEMBRESIA[tipoMembresiaDeseado];


  if (!planSeleccionado) {
    throw new functions.https.HttpsError("not-found", `El plan de membresía '${tipoMembresiaDeseado}' para el rol '${rol}' no es válido.`);
  }

  functions.logger.info(`[activarMembresia] Usuario ${userId} (${rol}) solicitando plan: ${tipoMembresiaDeseado}. Precio Simulado: ${planSeleccionado.precioSimulado}`);

  // --- 1. Simulación de Procesamiento de Pago ---
  functions.logger.info(`[activarMembresia] SIMULACIÓN: Iniciando proceso de pago de ${planSeleccionado.precioSimulado} para ${userId} con Stripe/MercadoPago...`);
  const pagoExitosoSimulado = true; // En un caso real, esto vendría de la pasarela.
  const paymentIntentIdSimulado = `sim_pi_${Date.now()}`;

  if (!pagoExitosoSimulado) {
    functions.logger.error(`[activarMembresia] SIMULACIÓN: Pago fallido para ${userId}.`);
    // Podrías guardar un registro de intento de pago fallido aquí.
    throw new functions.https.HttpsError("aborted", "El procesamiento del pago falló (simulado).");
  }
  functions.logger.info(`[activarMembresia] SIMULACIÓN: Pago exitoso para ${userId}. PaymentIntent ID: ${paymentIntentIdSimulado}`);


  // --- 2. Calcular Fechas de Membresía ---
  const fechaInicio = admin.firestore.Timestamp.now();
  const fechaExpiracionDate = new Date(fechaInicio.toDate().getTime());
  fechaExpiracionDate.setMonth(fechaExpiracionDate.getMonth() + planSeleccionado.duracionMeses);
  const fechaExpiracion = admin.firestore.Timestamp.fromDate(fechaExpiracionDate);

  // --- 3. Crear/Actualizar Documento de Membresía ---
  const membresiaRef = db.collection("membresias").doc(userId);
  const membresiaData: MembresiaData = {
    userId: userId,
    rol: rol,
    tipoMembresia: tipoMembresiaDeseado, // Guardamos el tipo solicitado
    fechaInicio: fechaInicio,
    fechaExpiracion: fechaExpiracion,
    estadoMembresia: "activa",
    beneficiosAdicionales: planSeleccionado.beneficios,
    ultimoPaymentIntentId: paymentIntentIdSimulado,
    // stripeSubscriptionId o mercadoPagoSubscriptionId se guardarían si fueran suscripciones reales
  };

  try {
    await membresiaRef.set(membresiaData, { merge: true }); // merge:true para actualizar si ya existe
    functions.logger.info(`[activarMembresia] Documento de membresía para ${userId} creado/actualizado.`);

    // --- 4. Actualizar Custom Claims del Usuario ---
    const currentClaims = (await admin.auth().getUser(userId)).customClaims || {};
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims, // Conservar claims existentes
      premium: true,
      rol: rol, // Asegurar que el rol esté en los claims
      membresiaTipo: tipoMembresiaDeseado,
      membresiaExpiraEpoch: fechaExpiracion.toMillis(), // Guardar como ms para comparaciones fáciles
    });
    functions.logger.info(`[activarMembresia] Custom claims actualizados para ${userId}.`);

    // --- 5. Actualizar perfil del usuario/prestador (opcional pero útil) ---
    const perfilCollection = rol === 'usuario' ? "usuarios" : "prestadores";
    const perfilRef = db.collection(perfilCollection).doc(userId);
    await perfilRef.set({
      membresiaActual: tipoMembresiaDeseado,
      isPremium: true, // Para redundancia y facilidad de consulta
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
    functions.logger.error("[activarMembresia] Error al guardar membresía o custom claims:", error);
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

      const userProfile = await getMockUser(userId); // Simulación para obtener si es premium
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
        name: prestadorName, // Asegurar que el nombre no se borre
        uid: servicioData.prestadorId, // Asegurar que el UID no se borre
      }, { merge: true });


      const servicioUpdate: Partial<ServiceData> = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
        // Si la calificación mutua se completa, y no hay disputa, se podría considerar liberar el pago aquí
        // Pero es más seguro que lo maneje el job programado o una función específica de resolución de disputas/finalización
      }

      // Cambiar estado a 'cerrado_con_calificacion' si no está en disputa
      if (servicioData.estado !== "en_disputa") {
        servicioUpdate.estado = "cerrado_con_calificacion";
         // Si la calificación se hace y no hay disputa, y el pago estaba retenido, se libera.
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
      let userName = `Usuario ${servicioData.usuarioId.substring(0, 5)}`;

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1;
        userName = usuarioData.name || userName;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(usuarioDocRef, {
        uid: servicioData.usuarioId, // Asegurar que el UID no se borre
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: currentRating,
        name: userName, // Asegurar que el nombre no se borre
        lastRatedByProviderAt: admin.firestore.Timestamp.now(), // Campo opcional para auditoría
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.Timestamp.now(),
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
      const reporteId = db.collection("reportes").doc().id; // Generar ID para el reporte

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa", // Congelar el pago
        detallesDisputa: {
          reportadoEn: now,
          detalle: detalleProblema,
          reporteId: reporteId, // Guardar el ID del reporte en la colección 'reportes'
        },
        updatedAt: now,
      });

      // Crear el documento en la colección 'reportes'
      const datosReporte = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId, // Guardar el ID del prestador para referencia
        motivo: detalleProblema, // Usar detalleProblema como el motivo principal
        fechaReporte: now,
        estado: "pendiente", // Estado inicial del reporte
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
      .where("usuarioId", "==", usuarioId) // Solo los del usuario
      .where("estado", "==", "completado_por_usuario") // Solo los completados por el usuario
      .orderBy("fechaConfirmacion", "desc") // Opcional: más recientes primero
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = []; // Usar Partial para devolver solo campos seleccionados
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id,
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion, // Este es userConfirmedCompletionAt renombrado
        detallesServicio: servicio.detallesServicio,
        // Puedes añadir más campos si son necesarios en el frontend
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
    estadoVerificacion: "pendiente", // Estado inicial
  };

  try {
    await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        // Si el prestador no existe, podrías crearlo aquí o lanzar un error.
        // Por ahora, asumimos que el perfil del prestador ya existe o se crea en otro flujo.
        // Aquí, para simplificar, se creará si no existe.
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
  functions.logger.info("Iniciando verificarDocumentoProfesional (simulación IA)", { structuredData: true, data });

  // Validación de rol (ej. solo admin/moderador)
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Ajusta 'admin'/'moderador' a tus custom claims
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
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : []; // Copia para modificar

      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];
      // Solo procesar si está pendiente o fue rechazado previamente por IA (para reintentos)
      const validPreviousStatesForIA: DocumentoVerificable["estadoVerificacion"][] = ["pendiente", "rechazado_ia", "Rechazado por datos sensibles detectados"];
      if (!validPreviousStatesForIA.includes(documentoAVerificar.estadoVerificacion) ) {
         functions.logger.warn(`Documento ${documentoIndex} para ${prestadorId} no está en estado procesable por IA. Estado actual: ${documentoAVerificar.estadoVerificacion}`);
         return { success: false, message: `El documento ya fue procesado manualmente o validado por IA. Estado actual: ${documentoAVerificar.estadoVerificacion}` };
      }


      // --- Simulación de Extracción de Texto con Google Vision API ---
      const urlDocumento = documentoAVerificar.urlDocumento;
      functions.logger.info(`Iniciando análisis de Vision API para documento: ${urlDocumento}`);
      let textoExtraido = "";
      try {
        // La opción documentTextDetection es buena para PDFs y imágenes con mucho texto.
        // Para imágenes simples, textDetection podría ser suficiente.
        const [result] = await visionClient.documentTextDetection(urlDocumento);
        textoExtraido = result.fullTextAnnotation?.text?.toLowerCase() || ""; // Convertir a minúsculas para facilitar la búsqueda
        functions.logger.info(`Texto extraído (primeros 500 chars): ${textoExtraido.substring(0, 500)}`);
      } catch (visionError: any) {
        functions.logger.error("Error de Vision API al procesar el documento:", visionError);
        // Marcar como error de IA y continuar para que no se reintente indefinidamente
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia"; // O un estado "error_ia"
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError.message);
      }
      // --- Fin Simulación de Extracción de Texto ---

      // Combinar descripción, tipo y texto extraído para el análisis
      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      // Expresiones regulares más robustas
      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(\d{2,3}\)\s?)?(?:[ -]?\d){7,10}/g; // Ejemplo para México, ajustar según necesidad
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
      
      // Búsqueda de palabras clave prohibidas
      for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
          // Usar word boundaries para evitar coincidencias parciales (ej. "calle" en "callejón")
          const palabraRegex = new RegExp(`\\b${palabra.toLowerCase()}\\b`, "g");
          if (palabraRegex.test(textoParaAnalizar)) {
            // Evitar duplicados si ya fue detectado por regex más específicas
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
        documentos[documentoIndex].palabrasClaveDetectadasIA = palabrasDetectadas; // Guardar qué se detectó
        mensajeRespuesta = "Rechazado: Se detectaron datos de contacto en el documento.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} RECHAZADO por IA. Palabras: ${palabrasDetectadas.join(", ")}`);
      } else {
        nuevoEstado = "Validado"; // O "verificado_ia" si quieres diferenciarlo de una validación manual
        documentos[documentoIndex].motivoRechazoIA = undefined; // Limpiar motivo anterior
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined; // Limpiar palabras anteriores
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} VALIDADO por IA.`);
      }
      documentos[documentoIndex].estadoVerificacion = nuevoEstado;

      transaction.update(prestadorRef, { documentosVerificables: documentos });

      // Registrar en colección de auditoría
      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl: urlDocumento,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentos[documentoIndex].fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length, // Para tener idea de cuánto se analizó
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [],
        agenteVerificador: context.auth?.uid || "sistema_ia_callable", // Quién o qué ejecutó la verificación
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
  // Verificar si el usuario es premium usando custom claims
  if (context.auth.token.premium !== true) { // Asume que tienes un custom claim 'premium'
    throw new functions.https.HttpsError("permission-denied", "Esta función es solo para usuarios premium.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo } = data;

  if (!servicioId || typeof servicioId !== "string" || !motivo || typeof motivo !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'servicioId' y 'motivo' válidos.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const garantiasRef = db.collection("garantias"); // Nueva colección para las solicitudes de garantía

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
      
      // Verificar que esté dentro del período de garantía
      const warrantyEndDateString = servicioData.warrantyEndDate; // Debe estar en formato YYYY-MM-DD
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString);
      const currentDate = new Date();
      warrantyEndDate.setHours(23, 59, 59, 999); // Asegurar que cubra todo el día
      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      // Crear documento en la colección 'garantias'
      const nuevaSolicitudGarantiaRef = garantiasRef.doc(); // Firestore genera un ID automático
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId, // Guardar ID del prestador para referencia
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        estadoGarantia: "pendiente", // Estado inicial
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      // Actualizar el servicio
      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id, // Guardar referencia al doc de garantía
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
  // Verificar rol de admin/moderador
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Ajusta tus custom claims
    throw new functions.https.HttpsError("permission-denied", "No tienes permisos para resolver garantías.");
  }

  const { garantiaId, decision, comentarioResolucion } = data; // 'decision' puede ser "aprobada" o "rechazada"
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
        servicioUpdateData.compensacionAutorizada = true; // O la lógica que corresponda
        functions.logger.info(`Garantía ${garantiaId} aprobada. SIMULACIÓN: Iniciar proceso de compensación/reembolso para servicio ${garantiaData.servicioId}.`);
      } else { // Si es rechazada
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
  .schedule("every 24 hours") // Puedes ajustar la frecuencia
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

    // Caso 1: Servicios completados por usuario, pago retenido, sin calificación ni disputa después de 3 días
    const queryPagosPendientes = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("userConfirmedCompletionAt", "<=", windowLimitTimestamp); // Confirmados hace 3+ días

    try {
      const snapshotPagos = await queryPagosPendientes.get();
      functions.logger.info(`[DailyCheck] Encontrados ${snapshotPagos.size} servicios 'completado_por_usuario' con pago 'retenido_para_liberacion' y confirmados hace más de ${windowDays} días.`);
      
      snapshotPagos.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        functions.logger.log(`[DailyCheck] Procesando servicio para cierre automático: ${doc.id}. Estado: ${servicio.estado}, userConfirmedCompletionAt: ${servicio.userConfirmedCompletionAt?.toDate().toISOString()}`);
        
        // Doble chequeo: no calificado y no en disputa
        if (
          !servicio.calificacionUsuario && 
          servicio.estado !== "en_disputa" // Asegurarse que no haya una disputa activa
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
    
    // Caso 2: Servicios ya calificados, pero pago aún retenido (fallback o barrido)
    const queryCalificadosPagoRetenido = serviciosRef
        .where("estado", "==", "cerrado_con_calificacion") // Ya fue calificado
        .where("paymentStatus", "==", "retenido_para_liberacion");

    try {
        const snapshotCalificados = await queryCalificadosPagoRetenido.get();
        functions.logger.info(`[DailyCheck] Encontrados ${snapshotCalificados.size} servicios 'cerrado_con_calificacion' con pago 'retenido_para_liberacion'.`);

        snapshotCalificados.forEach(doc => {
            const servicio = doc.data() as ServiceData;
            // Solo liberar si no entró en disputa después de calificar (aunque es un caso raro)
            if (servicio.estado !== "en_disputa") { 
                functions.logger.info(`[DailyCheck] LIBERANDO PAGO (fallback/barrido) para servicio ya calificado ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
                batch.update(doc.ref, {
                    paymentStatus: "liberado_al_proveedor",
                    fechaLiberacionPago: now, // Actualizar fecha de liberación si no se hizo antes
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
  const providerId = context.auth.uid; // El ID del proveedor es el UID del usuario autenticado

  const { isAvailable, location } = data; // location es { lat: number, lng: number }

  if (typeof isAvailable !== "boolean") {
    functions.logger.error("El parámetro 'isAvailable' debe ser un booleano.", { isAvailable });
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el parámetro 'isAvailable' (booleano).");
  }

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();
  const updates: Partial<ProviderData> = { // Usar Partial para actualizaciones flexibles
    isAvailable: isAvailable,
    lastConnection: now,
  };

  if (isAvailable === true) {
    // Si se está marcando como disponible, la ubicación es requerida
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      functions.logger.error("Si 'isAvailable' es true, se requiere un objeto 'location' con 'lat' y 'lng' numéricos.", { location });
      throw new functions.https.HttpsError("invalid-argument", "Se requiere 'location' con 'lat' y 'lng' válidos cuando 'isAvailable' es true.");
    }
    updates.currentLocation = {
      lat: location.lat,
      lng: location.lng,
      timestamp: now, // Guardar timestamp de la ubicación
    };
  } else {
    // Si se está marcando como no disponible, borrar la ubicación actual
    updates.currentLocation = null; // O admin.firestore.FieldValue.delete() para borrar el campo
  }

  try {
    // Usar set con merge:true para crear el documento si no existe, o actualizarlo si existe.
    // Esto es útil si es la primera vez que el proveedor actualiza su estado.
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
  const providerId = context.auth.uid; // El ID del proveedor es el UID del usuario autenticado

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();

  const updates: Partial<ProviderData> = {
    isAvailable: false,
    currentLocation: null, // Borrar la ubicación actual
    lastConnection: now,
  };

  try {
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      // Si el perfil del prestador no existe, podríamos crearlo aquí con estado desconectado
      // o simplemente registrar un warning si se espera que siempre exista.
      functions.logger.warn(`Prestador ${providerId} no encontrado. Se creará perfil básico y se desconectará.`);
      // Crear un perfil básico si no existe
      await providerRef.set({ 
        uid: providerId, // Importante para futuras referencias
        name: context.auth.token.name || `Prestador ${providerId.substring(0,5)}`, // Nombre de Firebase Auth o genérico
        isAvailable: false,
        currentLocation: null,
        lastConnection: now,
        rating: 0, // Inicializar campos de rating
        ratingCount: 0,
        ratingSum: 0,
        allowsHourlyServices: false, // Valor por defecto
        // Otros campos por defecto que necesites para un prestador
      });
      return { success: true, message: "Perfil no encontrado, se creó y desconectó." };
    }

    // Si existe, solo actualiza
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
  // Opcional: Verificar rol de admin si esta función es sensible
  // if (!context.auth || !context.auth.token.admin) {
  //   throw new functions.https.HttpsError("permission-denied", "No tienes permiso para esta acción.");
  // }

  const NOMBRES_FUNCIONES_ESPERADAS = [
    "confirmServiceCompletionByUserService", // Callable
    "calificarPrestador",                  // Callable
    "calificarUsuario",                    // Callable
    "reportServiceIssue",                  // Callable
    "obtenerServiciosCompletados",         // Callable
    "registrarDocumentoProfesional",       // Callable
    "verificarDocumentoProfesional",       // Callable
    "activarGarantiaPremium",              // Callable
    "resolverGarantiaPremium",             // Callable
    "simulateDailyAutomatedChecks",        // PubSub (Programada)
    "updateProviderRealtimeStatus",        // Callable
    "disconnectProvider",                  // Callable
    "agendarCita",                         // Callable
    "cancelarCita",                       // Callable (reemplaza cancelarCitaAgendada)
    "confirmarCitaPorPrestador",           // Callable
    "procesarCobroTrasConfirmacion",       // Callable
    "reportarProblemaServicio",            // Callable (Duplicado? o renombrar la anterior 'reportServiceIssue')
    "crearNotificacion",                   // Callable
    "enviarNotificacionInAppTrigger",      // Firestore Trigger
    "notificarLiberacionPagoAutomatica",   // Firestore Trigger
    "activarMembresia",                    // Callable
    "verificarEstadoFunciones",            // Callable (esta misma)
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";
    
    // Considerar "críticas" solo las callables o las que esperas que siempre estén
    if (!presenteEnCodigo && 
        nombreFuncion !== "simulateDailyAutomatedChecks" && // PubSub
        nombreFuncion !== "enviarNotificacionInAppTrigger" && // Firestore Trigger
        nombreFuncion !== "notificarLiberacionPagoAutomatica" && // Firestore Trigger
        nombreFuncion !== "verificarEstadoFunciones") { // Esta misma función
      todasLasFuncionesCriticasPresentes = false;
    }

    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada), // 'function' o 'undefined'
      esPubSub: nombreFuncion === "simulateDailyAutomatedChecks",
      esFirestoreTrigger: nombreFuncion === "enviarNotificacionInAppTrigger" || nombreFuncion === "notificarLiberacionPagoAutomatica",
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
    ubicacion, // Objeto con tipo, direccion, lat, lng
    notasAdicionales,
    serviceType, // 'fixed' o 'hourly'
    precioServicio, // Para tipo 'fixed'
    tarifaPorHora, // Para tipo 'hourly'
    duracionHoras, // Para tipo 'hourly'
  } = data;

  // Validaciones básicas de parámetros
  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !detallesServicio || !serviceType) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos (prestadorId, fechaSolicitada, horaSolicitada, detallesServicio, serviceType).");
  }
  if (serviceType === "fixed" && typeof precioServicio !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'precioServicio' para citas de tipo 'fixed'.");
  }
  if (serviceType === "hourly" && (typeof tarifaPorHora !== "number" || typeof duracionHoras !== "number" || duracionHoras <= 0)) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tarifaPorHora' y 'duracionHoras' válidas para citas de tipo 'hourly'.");
  }


  // Validar formato de fecha y hora
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  const regexHora = /^\d{2}:\d{2}$/;

  if (!regexFecha.test(fechaSolicitada) || !regexHora.test(horaSolicitada)) {
    throw new functions.https.HttpsError("invalid-argument", "Formato de fecha (YYYY-MM-DD) u hora (HH:MM) inválido.");
  }

  let fechaHoraSolicitadaConvertida: admin.firestore.Timestamp;
  try {
    const [year, month, day] = fechaSolicitada.split("-").map(Number);
    const [hour, minute] = horaSolicitada.split(":").map(Number);
    // Crear fecha en UTC para evitar problemas de zona horaria en el servidor
    const dateObject = new Date(Date.UTC(year, month - 1, day, hour, minute)); 
    if (isNaN(dateObject.getTime())) {
      throw new Error("Fecha u hora inválida después de la conversión.");
    }
    // Validar que no sea en el pasado (comparando con la hora actual también en UTC)
    const nowUtc = new Date(new Date().toISOString().slice(0,-1)); // Obtener UTC actual
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
      // Considerar citas que no estén canceladas o rechazadas
      .where("estado", "in", ["pendiente_confirmacion", "confirmada_prestador", "pagada", "servicio_iniciado", "en_camino_proveedor"]); 

    const conflictoSnapshot = await conflictoQuery.get();
    if (!conflictoSnapshot.empty) {
      functions.logger.warn(`Conflicto de horario para prestador ${prestadorId} en ${fechaSolicitada} ${horaSolicitada}. Citas encontradas: ${conflictoSnapshot.size}`);
      throw new functions.https.HttpsError("failed-precondition", "El prestador ya tiene una cita agendada o confirmada en este horario. Por favor, elige otro.");
    }

    let montoTotalEstimado = 0;
    if (serviceType === "fixed") {
      montoTotalEstimado = precioServicio as number;
    } else if (serviceType === "hourly") {
      montoTotalEstimado = (tarifaPorHora as number) * (duracionHoras as number);
    }

    const nuevaCitaData: Partial<CitaData> = { // Usar Partial para construir el objeto gradualmente
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
    // Aquí podrías llamar a `crearNotificacion`

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
  const canceladorId = context.auth.uid; // Quien llama a la función
  const { citaId, rol } = data; // rol: 'usuario' o 'prestador'

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

      // Solo se pueden cancelar citas pendientes de confirmación
      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden cancelar citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}`);
      }

      let nuevoEstado: CitaEstado;
      let notificarA: "usuario" | "prestador";
      let idNotificado: string;

      if (rol === "usuario" && citaData.usuarioId === canceladorId) {
        nuevoEstado = "cancelada_usuario";
        notificarA = "prestador";
        idNotificado = citaData.prestadorId;
      } else if (rol === "prestador" && citaData.prestadorId === canceladorId) {
        nuevoEstado = "cancelada_prestador";
        notificarA = "usuario";
        idNotificado = citaData.usuarioId;
      } else {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita con el rol especificado o no eres el propietario/prestador asignado.");
      }
      
      transaction.update(citaRef, {
        estado: nuevoEstado,
        fechaCancelacion: admin.firestore.FieldValue.serverTimestamp(),
        canceladaPor: canceladorId,
        rolCancelador: rol, // Guardar quién y con qué rol canceló
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Cita ${citaId} cancelada por ${rol} ${canceladorId}.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al ${notificarA} ${idNotificado} sobre la cancelación de la cita ${citaId} por el ${rol}.`);
      // Aquí podrías llamar a `crearNotificacion`
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
  const prestadorIdAutenticado = context.auth.uid; // El prestador que llama a la función
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

      // Validar que el prestador autenticado es el asignado a la cita
      if (citaData.prestadorId !== prestadorIdAutenticado) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para confirmar esta cita. No corresponde a tu ID de prestador.");
      }

      // Validar que la cita esté en estado 'pendiente_confirmacion'
      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden confirmar citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}.`);
      }

      // Simular generación de orden de cobro
      const ordenCobroIdSimulada = `orden_${citaId}_${Date.now()}`;
      functions.logger.info(`SIMULACIÓN: Generando orden de cobro para cita ${citaId}. ID Orden: ${ordenCobroIdSimulada}. Usuario a cobrar: ${citaData.usuarioId}. Monto estimado: ${citaData.montoTotalEstimado}`);
      
      transaction.update(citaRef, {
        estado: "confirmada_prestador",
        paymentStatus: "pendiente_cobro", // Estado del pago, listo para ser procesado
        fechaConfirmacionPrestador: admin.firestore.FieldValue.serverTimestamp(),
        ordenCobroId: ordenCobroIdSimulada, // Guardar ID simulado
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Cita ${citaId} confirmada por prestador ${prestadorIdAutenticado}. Usuario a notificar: ${citaData.usuarioId}. PaymentStatus: pendiente_cobro.`);
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la confirmación de la cita ${citaId} y que el cobro se procesará.`);
      // Aquí llamarías a `crearNotificacion` para el usuario
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

  // Podría ser llamada por un sistema o un usuario admin/backend, o incluso el cliente si el flujo lo permite.
  // Por ahora, se asume que el contexto de autenticación podría no ser el del usuario final.
  if (!context.auth) { // O una verificación de rol más específica si es una función interna.
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

      // Validar que la cita esté en el estado correcto para procesar el cobro
      if (citaData.estado !== "confirmada_prestador") {
        throw new functions.https.HttpsError("failed-precondition", `La cita no está en estado 'confirmada_prestador'. Estado actual: ${citaData.estado}.`);
      }
      if (citaData.paymentStatus !== "pendiente_cobro") {
        throw new functions.https.HttpsError("failed-precondition", `El estado del pago no es 'pendiente_cobro'. Estado actual: ${citaData.paymentStatus}.`);
      }

      // Validar que haya un monto a cobrar
      if (typeof citaData.montoTotalEstimado !== "number" || citaData.montoTotalEstimado <= 0) {
        functions.logger.error(`Monto total estimado inválido para cita ${citaId}: ${citaData.montoTotalEstimado}`);
        throw new functions.https.HttpsError("internal", "Monto total estimado inválido para la cita.");
      }

      // --- Simulación de Interacción con Pasarela de Pagos ---
      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Iniciando cobro para cita ${citaId}, Usuario: ${citaData.usuarioId}, Orden ID: ${citaData.ordenCobroId}, Monto: ${citaData.montoTotalEstimado}.`);
      // Aquí iría la lógica real para interactuar con Stripe, MercadoPago, etc.
      // const paymentResult = await miPasarelaDePago.charge(citaData.usuarioId, citaData.montoTotalEstimado, citaData.ordenCobroId);
      const pagoExitosoSimulado = true; // Asumir éxito para la simulación
      // --- Fin Simulación ---
      
      if (pagoExitosoSimulado) {
        transaction.update(citaRef, {
          estado: "pagada", // La cita ahora está pagada
          paymentStatus: "procesado_exitosamente",
          fechaCobro: admin.firestore.Timestamp.now(),
          montoCobrado: citaData.montoTotalEstimado, // Guardar el monto final cobrado
          updatedAt: admin.firestore.Timestamp.now(),
        });
        functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} procesado exitosamente.`);
        functions.logger.warn(`[ProcesarCobro] SIMULACIÓN: Notificar a usuario ${citaData.usuarioId} y prestador ${citaData.prestadorId} sobre pago exitoso para cita ${citaId}.`);
        // Aquí llamarías a `crearNotificacion` para ambas partes
        return { success: true, message: `Cobro para la cita ${citaId} procesado exitosamente. El servicio está ahora en estado 'pagada'.` };
      } else {
        functions.logger.error(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} FALLIDO.`);
        transaction.update(citaRef, {
          paymentStatus: "fallido",
          fechaCobro: admin.firestore.Timestamp.now(), // Registrar intento de cobro
          updatedAt: admin.firestore.Timestamp.now(),
        });
        // Notificar al usuario sobre el fallo del pago y posiblemente al admin.
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

export const reportarProblemaServicio = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando reportarProblemaServicio", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;
  const { servicioId, motivo, urlEvidencia } = data; // 'motivo' es el 'detalleProblema'

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

      // Verificar que el servicio esté en un estado desde el cual se pueda reportar un problema
      // (ej. después de que el usuario lo haya confirmado)
      if (servicioData.estado !== "completado_por_usuario") {
         throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios que hayas confirmado ('completado_por_usuario'). Estado actual: ${servicioData.estado}`);
      }
      // Verificar que esté dentro de la ventana para reportar (ej. ratingWindowExpiresAt)
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") {
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }


      const now = admin.firestore.Timestamp.now();
      const reporteId = db.collection("reportes").doc().id; // ID para el nuevo documento en 'reportes'

      // Actualizar el servicio
      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa",
        detallesDisputa: {
          reportadoEn: now,
          detalle: motivo, // Usamos 'motivo' como el detalle del problema
          reporteId: reporteId, // Enlazar con el documento en la colección 'reportes'
        },
        updatedAt: now,
      });

      // Crear documento en la colección "reportes"
      const datosReporte: any = { // Usar 'any' temporalmente o crear una interfaz ReporteData
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId, // Incluir para referencia del admin
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
      // Aquí llamarías a `crearNotificacion` para el prestador y/o admin
      
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

  // Autenticación opcional: Depende de si esta función es llamada solo por backend o también por clientes.
  // if (!context.auth) {
  //   throw new functions.https.HttpsError("unauthenticated", "Se requiere autenticación para crear una notificación.");
  // }

  const {
    destinatarioId,
    rolDestinatario, // 'usuario' o 'prestador'
    titulo,
    cuerpo,
    tipoNotificacion, // ej: 'cita_confirmada', 'nuevo_mensaje', etc.
    prioridad, // 'alta' o 'normal'
    datosAdicionales, // objeto opcional con IDs, etc.
  } = data;

  // Validaciones básicas
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

  const nuevaNotificacionData: Omit<NotificacionData, "id" | "fechaCreacion" | "triggerProcesadoEn"> = { // Omitir campos autogenerados o de trigger
    destinatarioId: destinatarioId,
    rolDestinatario: rolDestinatario,
    titulo: titulo,
    cuerpo: cuerpo,
    estadoNotificacion: "pendiente", // Estado inicial
    tipoNotificacion: tipoNotificacion,
    prioridad: prioridadValida,
    ...(datosAdicionales && { datosAdicionales: datosAdicionales }),
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

      // Solo procesar si está 'pendiente' para evitar bucles si la función se re-trigger por su propia actualización
      if (notificacionData.estadoNotificacion !== "pendiente") {
        functions.logger.log(`[Trigger] Notificación ${notificacionId} no está en estado 'pendiente', omitiendo. Estado actual: ${notificacionData.estadoNotificacion}.`);
        return null;
      }

      // SIMULACIÓN: Aquí iría la lógica para enviar una notificación Push con FCM
      // o para notificar a un sistema de mensajería en tiempo real si lo tuvieras.
      functions.logger.log(`[Trigger] SIMULACIÓN: Enviando notificación (ej. FCM) para ${notificacionId} a ${notificacionData.destinatarioId}. Título: ${notificacionData.titulo}`);
      // Ejemplo de payload FCM (conceptual):
      // const payload = {
      //   notification: {
      //     title: notificacionData.titulo,
      //     body: notificacionData.cuerpo,
      //   },
      //   data: {
      //     tipoNotificacion: notificacionData.tipoNotificacion,
      //     ...notificacionData.datosAdicionales,
      //     notificacionId: notificacionId,
      //   },
      //   // token: tokenDelDispositivoDelDestinatario (necesitarías obtenerlo de Firestore/DB)
      // };
      // await admin.messaging().send(payload);

      // Actualizar la notificación para indicar que el trigger la procesó
      try {
        await snapshot.ref.update({
          estadoNotificacion: "procesada_por_trigger", // O un estado más específico como 'fcm_enviado'
          triggerProcesadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`[Trigger] Notificación ${notificacionId} marcada como 'procesada_por_trigger'.`);
      } catch (error) {
        functions.logger.error(`[Trigger] Error al actualizar estado de notificación ${notificacionId}:`, error);
        // Considerar reintentos o manejo de errores más robusto
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
      functions.logger.warn("[notificarLiberacionPagoAutomatica] Datos antes o después no disponibles para servicio ${servicioId}.");
      return null;
    }

    // Verificar la transición específica de estado y paymentStatus
    const esLiberacionAutomatica =
      beforeData.estado === "completado_por_usuario" &&
      afterData.estado === "cerrado_automaticamente" &&
      beforeData.paymentStatus === "retenido_para_liberacion" &&
      afterData.paymentStatus === "liberado_al_proveedor" &&
      !afterData.calificacionUsuario; // Asegura que no hubo calificación del usuario

    if (esLiberacionAutomatica) {
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Detectada liberación automática de pago para servicio ${servicioId}. Preparando notificaciones.`);

      const servicioDetalles = afterData.detallesServicio || "Servicio sin descripción detallada";
      const fechaServicio = afterData.fechaServicio?.toDate().toLocaleDateString("es-MX") || 
                            afterData.fechaConfirmacion?.toDate().toLocaleDateString("es-MX") || 
                            "Fecha no especificada";
      const montoLiberado = afterData.montoCobrado || afterData.montoTotalEstimado || 0;

      // Notificación al Usuario
      try {
        await crearNotificacion({ // Llama a la función callable internamente
          destinatarioId: afterData.usuarioId,
          rolDestinatario: 'usuario',
          titulo: "Pago Liberado Automáticamente",
          cuerpo: `El pago para tu servicio "${servicioDetalles}" del ${fechaServicio} ha sido liberado automáticamente al prestador tras 3 días sin reclamos. Monto: $${montoLiberado.toFixed(2)}.`,
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
        await crearNotificacion({ // Llama a la función callable internamente
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

        