
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
  ratingSumUsuario?: number; // Suma de calificaciones recibidas por este usuario (de prestadores)
  ratingCountUsuario?: number; // Conteo de calificaciones recibidas por este usuario
  ratingUsuario?: number; // Promedio de calificaciones recibidas POR OTROS (prestadores)
  isPremium?: boolean;
  membresiaActual?: string;

  // Nuevos campos para incentivos por calificar
  serviciosCalificadosCount?: number;
  puntosReputacionUsuario?: number; // Puntos ganados por participar, calificar, etc.
  badgesUsuario?: string[]; // Ej: ["calificador_constante", "experto_en_reseñas"]
}

interface DocumentoVerificable { // Para el array en el perfil del prestador
  tipoDocumento: string;
  urlDocumento: string;
  descripcion?: string;
  fechaRegistro: admin.firestore.Timestamp;
  estadoVerificacion: "pendiente" | "verificado_ia" | "rechazado_ia" | "verificado_manual" | "rechazado_manual" | "Validado" | "Rechazado por datos sensibles detectados";
  fechaVerificacion?: admin.firestore.Timestamp;
  motivoRechazoIA?: string;
  palabrasClaveDetectadasIA?: string[];
}

// Nueva interfaz para la colección "documentosPrestadores"
interface DocumentoPrestadorData {
  id?: string; // Document ID (usually implicit from Firestore)
  prestadorId: string; // UID of the provider who uploaded
  tipoDocumento: string; // e.g., "identificacion_oficial", "certificado_habilidades"
  urlDocumento: string; // URL from Firebase Storage
  nombreArchivo?: string; // Optional, original file name
  estadoRevision: "pendiente" | "aprobado" | "rechazado";
  fechaSubida: admin.firestore.Timestamp;
  fechaRevision?: admin.firestore.Timestamp;
  revisadoPor?: string; // UID of admin/moderator who reviewed
  comentariosRevisor?: string;
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

  paymentStatus?: PaymentStatus;
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
  // Simulación: en una app real, leerías de Firestore.
  if (userId === "currentUserDemoId") { // Asumimos que este es el UID del usuario premium
    return { uid: userId, name: "Usuario Premium Demo", isPremium: true, membresiaActual: "premium_anual_usuario" };
  }
  if (userId === "standardUserDemoId") {
    return { uid: userId, name: "Usuario Estándar Demo", isPremium: false, membresiaActual: "gratis" };
  }
  // Simulación: Leer de Firestore si no es un mock conocido
  const userRef = db.collection("usuarios").doc(userId); // O la colección que corresponda
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

  // Consultar la membresía del prestador
  // Asumimos que el ID del documento en 'membresias' es el UID del prestador
  const membresiaRef = db.collection("membresias").doc(prestadorId);
  const membresiaDoc = await membresiaRef.get();

  let comisionPorcentaje = COMISION_ESTANDAR_PORCENTAJE;

  if (membresiaDoc.exists) {
    const membresiaData = membresiaDoc.data() as MembresiaData;
    if (membresiaData.estadoMembresia === "activa" && new Date() < membresiaData.fechaExpiracion.toDate()) {
      // Priorizar descuento absoluto si existe
      if (membresiaData.beneficiosAdicionales?.descuentoComisionPorcentaje !== undefined) {
        comisionPorcentaje = membresiaData.beneficiosAdicionales.descuentoComisionPorcentaje;
        functions.logger.info(`[Comisiones] Prestador ${prestadorId} tiene membresía con descuento porcentual. Comisión aplicada: ${comisionPorcentaje}%`);
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
  const { rol, tipoMembresiaDeseado } = data; // rol: 'usuario' o 'prestador'

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

  // SIMULACIÓN DE PAGO
  // Aquí iría la lógica para interactuar con Stripe, MercadoPago, etc.
  // Por ahora, asumimos que el pago es exitoso.
  const pagoExitosoSimulado = true; // Cambiar a false para simular fallo
  const paymentIntentIdSimulado = `sim_pi_${Date.now()}`;

  if (!pagoExitosoSimulado) {
    functions.logger.error(`[activarMembresia] SIMULACIÓN: Pago fallido para ${userId}.`);
    throw new functions.https.HttpsError("aborted", "El procesamiento del pago falló (simulado).");
  }
  functions.logger.info(`[activarMembresia] SIMULACIÓN: Pago exitoso para ${userId}. PaymentIntent ID: ${paymentIntentIdSimulado}`);

  // Si el pago fue exitoso:
  const fechaInicio = admin.firestore.Timestamp.now();
  const fechaExpiracionDate = new Date(fechaInicio.toDate().getTime());
  fechaExpiracionDate.setMonth(fechaExpiracionDate.getMonth() + planSeleccionado.duracionMeses);
  const fechaExpiracion = admin.firestore.Timestamp.fromDate(fechaExpiracionDate);

  const membresiaRef = db.collection("membresias").doc(userId); // El ID del documento es el UID del usuario/prestador
  const membresiaData: MembresiaData = {
    userId: userId,
    rol: rol,
    tipoMembresia: tipoMembresiaDeseado,
    fechaInicio: fechaInicio,
    fechaExpiracion: fechaExpiracion,
    estadoMembresia: "activa",
    beneficiosAdicionales: planSeleccionado.beneficios,
    ultimoPaymentIntentId: paymentIntentIdSimulado, // Guardar referencia al pago
    // stripeSubscriptionId: 'sub_xxxx' // Si fuera una suscripción recurrente con Stripe
  };

  try {
    await membresiaRef.set(membresiaData, { merge: true }); // Usar merge para no sobrescribir otros campos si el doc ya existe
    functions.logger.info(`[activarMembresia] Documento de membresía para ${userId} creado/actualizado.`);

    // Actualizar Custom Claims del usuario para acceso rápido a estado premium
    const currentClaims = (await admin.auth().getUser(userId)).customClaims || {};
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims,
      premium: true,
      rol: rol, // Puede ser útil tener el rol en los claims también
      membresiaTipo: tipoMembresiaDeseado,
      membresiaExpiraEpoch: fechaExpiracion.toMillis(), // Útil para reglas de seguridad o cliente
    });
    functions.logger.info(`[activarMembresia] Custom claims actualizados para ${userId}.`);

    // Actualizar el perfil del usuario/prestador para reflejar su membresía
    const perfilCollection = rol === 'usuario' ? "usuarios" : "prestadores";
    const perfilRef = db.collection(perfilCollection).doc(userId);
    await perfilRef.set({
      membresiaActual: tipoMembresiaDeseado,
      isPremium: true, // Redundante si se usa el claim, pero puede ser útil para consultas directas a Firestore
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

      // Estados válidos desde los que el usuario puede confirmar
      // 'pagada' se incluye si el flujo implica pago antes de iniciar el servicio físico.
      // 'confirmada_prestador' es si el prestador confirma pero aún no se ha pagado/iniciado.
      const validPreviousStates: ServiceRequestStatus[] = ["completado_por_prestador", "en_camino_proveedor", "servicio_iniciado", "confirmada_prestador", "pagada"];
      if (!validPreviousStates.includes(servicioData.estado)) {
        functions.logger.warn(`Intento de confirmar servicio ${servicioId} en estado inválido. Estado actual: ${servicioData.estado}`);
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en el estado correcto para ser confirmado por el usuario. Estado actual: ${servicioData.estado}. Debe ser uno de: ${validPreviousStates.join(", ")}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const ratingAndDisputeWindowEndDate = new Date(now.toDate().getTime() + RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(ratingAndDisputeWindowEndDate);

      // Determinar duración de la garantía
      const userProfile = await getMockUser(userId); // Usa tu función getMockUser o lee de Firestore
      let warrantyDays = STANDARD_WARRANTY_DAYS;
      if (userProfile?.isPremium) {
        const membresiaRef = db.collection("membresias").doc(userId);
        const membresiaDoc = await membresiaRef.get(); // Leer dentro de la transacción si es posible o antes
        if (membresiaDoc.exists) {
          const membresiaData = membresiaDoc.data() as MembresiaData;
          if (membresiaData.estadoMembresia === "activa" && membresiaData.beneficiosAdicionales?.garantiaExtendidaDiasAdicionales) {
            warrantyDays = STANDARD_WARRANTY_DAYS + membresiaData.beneficiosAdicionales.garantiaExtendidaDiasAdicionales;
          } else {
            warrantyDays = PREMIUM_WARRANTY_DAYS; // Fallback para premium si no hay detalle específico
          }
        } else {
          warrantyDays = PREMIUM_WARRANTY_DAYS; // Si es premium por claim pero no hay doc de membresía
        }
        functions.logger.info(`[confirmServiceCompletionByUserService] Usuario ${userId} es premium. Garantía de ${warrantyDays} días.`);
      } else {
        functions.logger.info(`[confirmServiceCompletionByUserService] Usuario ${userId} es estándar. Garantía de ${warrantyDays} días.`);
      }
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);


      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now, // Fecha de confirmación del usuario
        userConfirmedCompletionAt: now, // Alias para claridad
        habilitarCalificacion: true,
        paymentStatus: "retenido_para_liberacion", // El pago se retiene
        ratingWindowExpiresAt: ratingWindowExpiresTimestamp,
        warrantyEndDate: warrantyEndDateDt.toISOString().split("T")[0], // Guardar como YYYY-MM-DD
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
        // Opcional: Actualizar habilitarCalificacion a false si ha expirado, aunque la función de daily check también lo haría.
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
      let prestadorName = `Prestador ${servicioData.prestadorId.substring(0, 5)}`; // Nombre por defecto si no existe

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
        name: prestadorName, // Asegurarse que el nombre se guarde/actualice
        uid: servicioData.prestadorId, // Asegurarse que el uid se guarde
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> & { updatedAt: admin.firestore.FieldValue } = {
        calificacionUsuario: nuevaCalificacionUsuario,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Si el prestador ya calificó al usuario, marcar calificación mutua como completa
      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
      }

      // Cambiar estado del servicio y liberar pago si no está en disputa
      if (servicioData.estado !== "en_disputa") {
        servicioUpdate.estado = "cerrado_con_calificacion";
        // Liberar el pago solo si estaba retenido (condición importante)
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
  const usuarioCollectionRef = db.collection("usuarios"); // Asumiendo que tienes una colección "usuarios"

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

      // Verificar que la calificación mutua esté habilitada (el usuario debe haber confirmado)
      if (!servicioData.habilitarCalificacion) {
        throw new functions.https.HttpsError("failed-precondition", "La calificación mutua no está habilitada (el usuario debe confirmar el servicio primero).");
      }
      if (servicioData.calificacionPrestador) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado a este usuario para este servicio.");
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        // Podrías también actualizar habilitarCalificacion a false aquí si ha expirado
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
        // Asegúrate de que estos campos existan en tu interfaz UserData
        newRatingSum = (usuarioData.ratingSumUsuario || 0) + calificacion; // Suma de calificaciones recibidas por el usuario
        newRatingCount = (usuarioData.ratingCountUsuario || 0) + 1; // Conteo de calificaciones recibidas por el usuario
        userName = usuarioData.name || userName;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(usuarioDocRef, {
        uid: servicioData.usuarioId, // Asegurar uid
        name: userName, // Asegurar nombre
        ratingSumUsuario: newRatingSum,
        ratingCountUsuario: newRatingCount,
        ratingUsuario: currentRating, // Este sería el promedio de calificaciones RECIBIDAS por el usuario
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> & { updatedAt: admin.firestore.FieldValue } = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Si el usuario ya calificó al prestador, marcar calificación mutua como completa
      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        // Si la calificación mutua está completa y no hay disputa, cambiar estado del servicio
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

      // Solo se pueden reportar problemas de servicios que el usuario haya confirmado
      if (servicioData.estado !== "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios que hayas confirmado ('completado_por_usuario'). Estado actual: ${servicioData.estado}`);
      }

      // Verificar si la ventana para reportar/calificar ha expirado
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }

      // Verificar si ya existe un reporte activo
      if (servicioData.estado === "en_disputa") {
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo para este servicio.");
      }


      const now = admin.firestore.Timestamp.now();
      const reporteId = db.collection("reportes").doc().id; // Opcional: si tienes una colección separada de reportes

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa", // Congelar el pago
        detallesDisputa: {
          reportadoEn: now,
          detalle: detalleProblema,
          reporteId: reporteId, // Opcional: si se guarda en otra colección
        },
        updatedAt: now,
      });

      // (Opcional) Crear un documento en una colección "reportes"
      // Esta parte es conceptual si no tienes la colección "reportes" aún.
      // const datosReporte = {
      //   servicioId: servicioId,
      //   usuarioId: usuarioId,
      //   prestadorId: servicioData.prestadorId,
      //   motivo: detalleProblema,
      //   fechaReporte: now,
      //   estado: "pendiente", // Estado inicial del reporte
      // };
      // transaction.set(db.collection("reportes").doc(reporteId), datosReporte);


      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID (simulado/interno): ${reporteId}. Pago congelado.`);
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
      .where("usuarioId", "==", usuarioId) // Solo servicios del usuario autenticado
      .where("estado", "==", "completado_por_usuario") // Solo los completados por el usuario
      .orderBy("fechaConfirmacion", "desc") // Opcional: los más recientes primero
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = []; // Usar Partial para devolver solo campos seleccionados
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id, // Incluir el ID del documento
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion,
        detallesServicio: servicio.detallesServicio,
        // ... puedes añadir otros campos que necesites en el frontend
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
    // Usar una transacción para asegurar la atomicidad si el documento del prestador no existe
    await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        // Si el prestador no existe, crearlo con el array de documentos.
        // Puedes añadir otros campos por defecto para un nuevo prestador aquí.
        functions.logger.info(`Documento del prestador ${prestadorId} no encontrado, creando uno nuevo con el documento.`);
        transaction.set(prestadorRef, { documentosVerificables: [nuevoDocumento], uid: prestadorId, name: `Prestador ${prestadorId.substring(0,5)}` /* otros campos default */ });
      } else {
        // Si el prestador existe, añadir el documento al array.
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

export const validateDocumentAndRemoveContactInfo = functions.runWith({
  timeoutSeconds: 120, // Aumentar timeout si Vision API tarda
  memory: "512MB",    // Aumentar memoria si es necesario
}).https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo (Vision API)", { structuredData: true, data });

  // Asegurarse que solo un admin/moderador pueda llamar esta función
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador) ) { // Ajusta los nombres de los claims según tu configuración
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
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : []; // Crear copia para modificar

      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];

      // Solo procesar si está en estado 'pendiente' o si se quiere re-verificar
      // if (documentoAVerificar.estadoVerificacion !== "pendiente" && documentoAVerificar.estadoVerificacion !== "verificado_ia" && documentoAVerificar.estadoVerificacion !== "rechazado_ia") {
      //   throw new functions.https.HttpsError("failed-precondition", `El documento ya tiene un estado de verificación manual: ${documentoAVerificar.estadoVerificacion}`);
      // }

      const urlDocumento = documentoAVerificar.urlDocumento;
      functions.logger.info(`Iniciando análisis de Vision API para documento: ${urlDocumento}`);

      let textoExtraido = "";
      try {
        const [result] = await visionClient.documentTextDetection(urlDocumento);
        textoExtraido = result.fullTextAnnotation?.text?.toLowerCase() || ""; // Convertir a minúsculas para búsqueda insensible
        functions.logger.info(`Texto extraído (primeros 500 chars): ${textoExtraido.substring(0, 500)}`);
      } catch (visionError: any) {
        functions.logger.error("Error de Vision API al procesar el documento:", visionError);
        // Actualizar el estado del documento a un error de IA
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia"; // O un estado específico de error de API
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError.message);
      }

      // Combinar descripción y texto extraído para un análisis más completo
      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      // Expresiones regulares mejoradas
      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(\d{2,3}\)\s?)?(?:[ -]?\d){7,10}/g; // Soporta varios formatos de tel. Mexicanos
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      const phoneMatches = textoParaAnalizar.match(phoneRegex);
      if (phoneMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...phoneMatches.map((m) => `Teléfono: ${m.trim()}`));
      }

      const emailMatches = textoParaAnalizar.match(emailRegex);
      if (emailMatches) {
        datosSensiblesEncontrados = true;
        palabrasDetectadas.push(...emailMatches.map((m) => `Email: ${m.trim()}`));
      }
      
      // Búsqueda de palabras clave prohibidas
      for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
        const palabraRegex = new RegExp(`\\b${palabra.toLowerCase()}\\b`, "g"); // Búsqueda de palabra completa
        if (palabraRegex.test(textoParaAnalizar)) {
          // Evitar duplicados si la regex ya capturó algo similar (ej. "email" y una dirección de email)
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
        nuevoEstado = "Validado"; // Estado que indica que pasó la IA y no se encontraron datos sensibles
        documentos[documentoIndex].motivoRechazoIA = undefined; // Limpiar motivo si fue aprobado
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined; // Limpiar palabras si fue aprobado
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} VALIDADO por IA.`);
      }
      documentos[documentoIndex].estadoVerificacion = nuevoEstado;

      transaction.update(prestadorRef, { documentosVerificables: documentos });

      // (Opcional) Guardar un log de la verificación
      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl: urlDocumento,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentos[documentoIndex].fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length, // Puede ser útil para depurar
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [],
        agenteVerificador: context.auth?.uid || "sistema_ia_callable", // Quien llamó la función
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
  // Verificar si el usuario es premium a través de custom claims
  if (context.auth.token.premium !== true) {
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
      if (servicioData.garantiaSolicitada === true) {
        throw new functions.https.HttpsError("already-exists", "Ya se ha solicitado una garantía para este servicio.");
      }
      
      // Verificar que la fecha actual esté dentro del período de garantía
      const warrantyEndDateString = servicioData.warrantyEndDate; // YYYY-MM-DD
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const warrantyEndDate = new Date(warrantyEndDateString); // Convierte 'YYYY-MM-DD' a Date
      // Ajustar la hora de warrantyEndDate para que sea el final del día
      warrantyEndDate.setHours(23, 59, 59, 999); 
      const currentDate = new Date(); // Fecha y hora actual

      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      const nuevaSolicitudGarantiaRef = garantiasRef.doc(); // Generar un nuevo ID para la garantía
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp, // Cast necesario
        estadoGarantia: "pendiente",
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      // Actualizar el servicio original
      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id, // Guardar el ID de la garantía en el servicio
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
  // Verificar si el usuario es admin o moderador
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Ajusta los nombres de los claims
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

      // Solo se pueden resolver garantías pendientes o en revisión
      const validPreviousStates: GarantiaData["estadoGarantia"][] = ["pendiente", "en_revision"];
      if (!validPreviousStates.includes(garantiaData.estadoGarantia)) {
        throw new functions.https.HttpsError("failed-precondition", `La garantía ya ha sido resuelta o está en un estado inválido (${garantiaData.estadoGarantia}).`);
      }

      const updateGarantiaData: Partial<GarantiaData> = {
        estadoGarantia: decision,
        fechaResolucionGarantia: admin.firestore.Timestamp.now(),
        resolucionDetalles: comentarioResolucion || "", // Usar string vacío si no hay comentario
        resueltaPor: context.auth?.uid, // UID del admin/moderador que resolvió
      };
      transaction.update(garantiaRef, updateGarantiaData);

      // Actualizar el servicio relacionado
      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> = {
        garantiaResultado: decision, // Guardar el resultado en el servicio
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true; // Marcar si se autoriza compensación
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
  .schedule("every 24 hours") // Puedes ajustar esto, ej. "every day 03:00"
  // .timeZone("America/Mexico_City") // Opcional: define tu zona horaria
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = admin.firestore.Timestamp.now();
    // Cambiar de 7 a 3 días según el nuevo requisito
    const windowLimitDate = new Date(now.toDate().getTime() - RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const windowLimitTimestamp = admin.firestore.Timestamp.fromDate(windowLimitDate);

    const serviciosRef = db.collection("servicios");
    const batch = db.batch();
    let processedCount = 0;

    functions.logger.info(`[DailyCheck] Buscando servicios para cierre automático (ventana de ${RATING_AND_DISPUTE_WINDOW_DAYS} días). Límite de fecha para confirmación de usuario: ${windowLimitDate.toISOString()}`);

    // Caso 1: Usuario confirmó, pasaron 3 días, no calificó, no hay disputa
    const querySinAccion = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("userConfirmedCompletionAt", "<=", windowLimitTimestamp); // userConfirmedCompletionAt es la fecha de confirmación

    try {
      const snapshotSinAccion = await querySinAccion.get();
      functions.logger.info(`[DailyCheck] Encontrados ${snapshotSinAccion.size} servicios 'completado_por_usuario' con pago 'retenido' y confirmados hace más de ${RATING_AND_DISPUTE_WINDOW_DAYS} días.`);
      
      snapshotSinAccion.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        functions.logger.log(`[DailyCheck] Procesando servicio para cierre automático (sin acción): ${doc.id}. Estado: ${servicio.estado}, userConfirmedCompletionAt: ${servicio.userConfirmedCompletionAt?.toDate().toISOString()}`);
        
        // Verificar si el usuario no ha calificado Y no hay disputa (estado no es 'en_disputa')
        if (!servicio.calificacionUsuario && servicio.estado !== "en_disputa") {
          functions.logger.info(`[DailyCheck] CERRANDO AUTOMÁTICAMENTE Y LIBERANDO PAGO (sin acción) para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
          batch.update(doc.ref, {
            paymentStatus: "liberado_al_proveedor",
            fechaLiberacionPago: now,
            estado: "cerrado_automaticamente",
            updatedAt: now,
            habilitarCalificacion: false, // Desactivar calificación
          });
          processedCount++;
        } else {
           functions.logger.log(`[DailyCheck] Servicio ${doc.id} no cumple condiciones para cierre automático (ya calificado o en disputa). calificacionUsuario: ${!!servicio.calificacionUsuario}, estado: ${servicio.estado}`);
        }
      });
    } catch (error) {
      functions.logger.error("[DailyCheck] Error consultando servicios para liberación (sin acción):", error);
    }
    
    // Caso 2: Usuario calificó, pero el pago podría seguir retenido (fallback)
    const queryCalificadosPagoRetenido = serviciosRef
        .where("estado", "==", "cerrado_con_calificacion") // Ya fue calificado
        .where("paymentStatus", "==", "retenido_para_liberacion"); // Pero el pago sigue retenido

    try {
        const snapshotCalificados = await queryCalificadosPagoRetenido.get();
        functions.logger.info(`[DailyCheck] Encontrados ${snapshotCalificados.size} servicios 'cerrado_con_calificacion' con pago 'retenido_para_liberacion'.`);

        snapshotCalificados.forEach(doc => {
            const servicio = doc.data() as ServiceData;
            // Si ya está calificado y no en disputa, el pago debería liberarse.
            if (servicio.estado !== "en_disputa") { 
                functions.logger.info(`[DailyCheck] LIBERANDO PAGO (fallback por calificación) para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
                batch.update(doc.ref, {
                    paymentStatus: "liberado_al_proveedor",
                    fechaLiberacionPago: now, // Registrar fecha de esta liberación
                    updatedAt: now,
                    habilitarCalificacion: false, // Asegurar que se desactive
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

  const { isAvailable, location } = data; // location es un objeto { lat: number, lng: number }

  if (typeof isAvailable !== "boolean") {
    functions.logger.error("El parámetro 'isAvailable' debe ser un booleano.", { isAvailable });
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el parámetro 'isAvailable' (booleano).");
  }

  const providerRef = db.collection("prestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();
  const updates: Partial<ProviderData> = { // Usar Partial para actualizaciones selectivas
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
      timestamp: now, // Guardar también el timestamp de la ubicación
    };
  } else {
    // Si se desconecta, borrar la ubicación actual o ponerla a null
    updates.currentLocation = null; // O admin.firestore.FieldValue.delete() para borrar el campo
  }

  try {
    // Usar set con merge: true para crear el documento si no existe, o actualizarlo si existe.
    // Esto es útil si el prestador usa esta función por primera vez.
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
    currentLocation: null, // O admin.firestore.FieldValue.delete()
    lastConnection: now,
  };

  try {
    // Verificar si el documento del prestador existe antes de intentar actualizarlo.
    // Si no existe, se podría crear uno básico o simplemente registrar el intento.
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      functions.logger.warn(`Prestador ${providerId} no encontrado. Se creará perfil básico y se desconectará.`);
      // Opcional: Crear un perfil básico si no existe
      await providerRef.set({
        uid: providerId,
        name: context.auth.token.name || `Prestador ${providerId.substring(0,5)}`, // Usar nombre del token si está disponible
        isAvailable: false,
        currentLocation: null,
        lastConnection: now,
        rating: 0, // Inicializar campos de calificación
        ratingCount: 0,
        ratingSum: 0,
        allowsHourlyServices: false, // Default
        // ... otros campos por defecto
      });
      return { success: true, message: "Perfil no encontrado, se creó y desconectó." };
    }

    // Si el prestador existe, actualizarlo.
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

  // Ejemplo: Solo permitir a un admin llamar esta función (requiere custom claims)
  // if (!context.auth || !context.auth.token.admin) {
  //   throw new functions.https.HttpsError("permission-denied", "No tienes permiso para ejecutar esta función.");
  // }

  // Lista de nombres de funciones exportadas que se esperan en el proyecto
  const NOMBRES_FUNCIONES_ESPERADAS = [
    "confirmServiceCompletionByUserService", "calificarPrestador", "calificarUsuario",
    "reportServiceIssue", "obtenerServiciosCompletados", "registrarDocumentoProfesional",
    "validateDocumentAndRemoveContactInfo", "activarGarantiaPremium", "resolverGarantiaPremium",
    "simulateDailyAutomatedChecks", "updateProviderRealtimeStatus", "disconnectProvider",
    "agendarCitaConPrestador", "cancelarCita", "confirmarCitaPorPrestador", // Cambiado de cancelarCitaAgendada
    "procesarCobroTrasConfirmacion", "reportarProblemaServicio", "crearNotificacion",
    "enviarNotificacionInAppTrigger", "notificarLiberacionPagoAutomatica", "activarMembresia",
    "verificarEstadoFunciones", "iniciarChat", "enviarMensaje", "moderarMensajesChat",
    "evaluarComportamientoPrestadorTrigger", "asignarIncentivoUsuarioTrigger",
    "sugerirPrestadoresInteligente", "mostrarServiciosDestacados",
    "revisarDocumentoPrestador",
    // Añade aquí cualquier otra función que implementes
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";
    
    // Determinar si es un trigger (para logging, no afecta la 'presencia')
    const esTrigger = nombreFuncion.endsWith("Trigger") || nombreFuncion === "simulateDailyAutomatedChecks" || nombreFuncion === "moderarMensajesChat";

    // Considerar una función crítica si no es un trigger y no es la propia función de verificación
    if (!presenteEnCodigo && !esTrigger && nombreFuncion !== "verificarEstadoFunciones") {
      todasLasFuncionesCriticasPresentes = false;
    }

    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada), // 'function' o 'undefined'
      esPubSub: nombreFuncion === "simulateDailyAutomatedChecks", // Ejemplo específico
      esFirestoreTrigger: nombreFuncion.endsWith("Trigger") || nombreFuncion === "moderarMensajesChat", // Ejemplo
      // Datos simulados ya que no podemos consultar GCP desde aquí
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
    serviceType, // 'fixed' o 'hourly'
    precioServicio, // para fixed
    tarifaPorHora, // para hourly
    duracionHoras, // para hourly
  } = data;

  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !detallesServicio || !serviceType) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos (prestadorId, fechaSolicitada, horaSolicitada, detallesServicio, serviceType).");
  }

  if (serviceType === "fixed" && typeof precioServicio !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'precioServicio' para citas de tipo 'fixed'.");
  }
  if (serviceType === "hourly" && (typeof tarifaPorHora !== "number" || typeof duracionHoras !== "number" || duracionHoras <= 0)) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'tarifaPorHora' y 'duracionHoras' válidas para citas de tipo 'hourly'.");
  }


  const prestadorRef = db.collection("prestadores").doc(prestadorId);
  const prestadorDoc = await prestadorRef.get();
  if (!prestadorDoc.exists) {
    throw new functions.https.HttpsError("not-found", `El prestador con ID ${prestadorId} no fue encontrado.`);
  }
  // const prestadorData = prestadorDoc.data() as ProviderData; // Descomentar si necesitas datos del prestador


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
    // Usar Date.UTC para evitar problemas de zona horaria al crear el objeto Date
    const dateObject = new Date(Date.UTC(year, month - 1, day, hour, minute));

    if (isNaN(dateObject.getTime())) {
      throw new Error("Fecha u hora inválida después de la conversión.");
    }
    // Comparar con la hora actual en UTC para ser consistentes
    const nowUtc = new Date(new Date().toISOString().slice(0, -1)); // Obtener Date actual como UTC
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

    // Crear la nueva cita
    let montoTotalEstimado = 0;
    const nuevaCitaData: Partial<CitaData> = { // Usar Partial para construir el objeto gradualmente
      usuarioId: usuarioId,
      prestadorId: prestadorId,
      fechaHoraSolicitada: fechaHoraSolicitadaConvertida,
      detallesServicio: detallesServicio,
      estado: "pendiente_confirmacion", // Estado según tu solicitud
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      serviceType: serviceType,
    };

    if (serviceType === "fixed") {
      nuevaCitaData.precioServicio = precioServicio;
      montoTotalEstimado = precioServicio || 0;
    } else { // hourly
      nuevaCitaData.tarifaPorHora = tarifaPorHora;
      nuevaCitaData.duracionHoras = duracionHoras;
      montoTotalEstimado = (tarifaPorHora || 0) * (duracionHoras || 0);
    }
    nuevaCitaData.montoTotalEstimado = montoTotalEstimado;


    if (ubicacion) nuevaCitaData.ubicacion = ubicacion;
    if (notasAdicionales) nuevaCitaData.notasAdicionales = notasAdicionales;

    const citaRef = await citasRef.add(nuevaCitaData as CitaData); // Cast a CitaData una vez completo
    functions.logger.info(`Cita agendada con ID: ${citaRef.id} por usuario ${usuarioId} para prestador ${prestadorId}. Estado: pendiente_confirmacion.`);

    // Aquí podrías llamar a `crearNotificacion` para notificar al prestador
    // Ejemplo:
    // await crearNotificacion({
    //   destinatarioId: prestadorId,
    //   rolDestinatario: 'prestador',
    //   titulo: 'Nueva Solicitud de Cita',
    //   cuerpo: `Has recibido una nueva solicitud de cita de ${context.auth?.token.name || 'un usuario'} para el ${fechaSolicitada} a las ${horaSolicitada}.`,
    //   tipoNotificacion: 'nueva_solicitud_cita',
    //   prioridad: 'alta',
    //   datosAdicionales: { citaId: citaRef.id }
    // });

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
        // Esto no debería ocurrir debido a la validación de 'rol' anterior
        throw new functions.https.HttpsError("internal", "Rol de cancelador inválido internamente.");
      }
      
      const updateData: Partial<CitaData> & {updatedAt: admin.firestore.FieldValue } = { // Asegurar que updatedAt sea del tipo correcto
        estado: nuevoEstado,
        fechaCancelacion: admin.firestore.FieldValue.serverTimestamp(),
        canceladaPor: canceladorIdAutenticado,
        rolCancelador: rol,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.update(citaRef, updateData);

      functions.logger.info(`Cita ${citaId} cancelada por ${rol} ${canceladorIdAutenticado}.`);
      // SIMULACIÓN: Notificar a la otra parte
      functions.logger.warn(`SIMULACIÓN: Notificar al ${notificarA} ${idNotificado} sobre la cancelación de la cita ${citaId} por el ${rol}.`);
      // Ejemplo de cómo se podría hacer:
      // await crearNotificacion({
      //   destinatarioId: idNotificado,
      //   rolDestinatario: notificarA,
      //   titulo: 'Cita Cancelada',
      //   cuerpo: `La cita para "${citaData.detallesServicio}" del ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()} ha sido cancelada por el ${rol}.`,
      //   tipoNotificacion: `cita_cancelada_por_${rol}`,
      //   prioridad: 'normal',
      //   datosAdicionales: { citaId: citaId }
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
  const { citaId, accion } = data; // accion puede ser "confirmar" o "rechazar"

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

      // Verificar que el prestador autenticado sea el de la cita
      if (citaData.prestadorId !== prestadorIdAutenticado) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para modificar esta cita. No corresponde a tu ID de prestador.");
      }

      // Solo se pueden confirmar/rechazar citas en estado "pendiente_confirmacion"
      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden ${accion} citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}.`);
      }

      const updateData: Partial<CitaData> & { updatedAt: admin.firestore.FieldValue } = { // Asegurar tipo correcto
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
        updateData.paymentStatus = "pendiente_cobro";
        // Simular ID de orden de cobro. En una app real, esto podría venir de Stripe/MercadoPago.
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
      
      // Simular notificación al usuario
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la ${accion} de la cita ${citaId}.`);
      // Ejemplo de cómo se podría hacer:
      // await crearNotificacion({
      //   destinatarioId: citaData.usuarioId,
      //   rolDestinatario: 'usuario',
      //   titulo: tituloNotificacionUsuario,
      //   cuerpo: cuerpoNotificacionUsuario,
      //   tipoNotificacion: tipoNotificacionUsuario,
      //   prioridad: 'alta',
      //   datosAdicionales: { citaId: citaId }
      // });
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

  // Podría ser llamada por el sistema o por un cliente si el flujo lo permite.
  // Si es solo sistema, la autenticación podría ser diferente o no necesaria si se usa App Check.
  if (!context.auth) { // Asumimos que es llamada por un usuario autenticado (o una función con contexto)
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

      // Verificar estado correcto para cobro
      if (citaData.estado !== "confirmada_prestador") {
        throw new functions.https.HttpsError("failed-precondition", `La cita no está en estado 'confirmada_prestador'. Estado actual: ${citaData.estado}.`);
      }
      if (citaData.paymentStatus !== "pendiente_cobro") {
        throw new functions.https.HttpsError("failed-precondition", `El estado del pago no es 'pendiente_cobro'. Estado actual: ${citaData.paymentStatus}.`);
      }

      // Obtener monto a cobrar (ya debería estar en la cita como montoTotalEstimado)
      const montoACobrar = citaData.montoTotalEstimado;
      if (typeof montoACobrar !== "number" || montoACobrar <= 0) {
        functions.logger.error(`Monto total estimado inválido para cita ${citaId}: ${montoACobrar}`);
        throw new functions.https.HttpsError("internal", "Monto total estimado inválido para la cita.");
      }

      // --- SIMULACIÓN DE PROCESAMIENTO DE PAGO ---
      // Aquí iría la integración real con Stripe, MercadoPago, etc.
      // 1. Obtener el paymentMethodId del usuario (si no se tiene ya o se usa uno guardado)
      // 2. Crear o confirmar un PaymentIntent con la pasarela de pagos.
      // const paymentIntent = await stripe.paymentIntents.create({ amount: montoACobrar * 100, currency: 'mxn', ... });
      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Iniciando cobro para cita ${citaId}, Usuario: ${citaData.usuarioId}, Orden ID: ${citaData.ordenCobroId}, Monto: ${montoACobrar}.`);
      const pagoExitosoSimulado = true; // Cambiar a false para simular fallo
      
      if (pagoExitosoSimulado) {
        transaction.update(citaRef, {
          estado: "pagada", // Actualizar estado de la cita
          paymentStatus: "procesado_exitosamente",
          fechaCobro: admin.firestore.Timestamp.now(),
          montoCobrado: montoACobrar,
          updatedAt: admin.firestore.Timestamp.now(),
        });
        functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} procesado exitosamente.`);
        // Notificar a ambas partes
        functions.logger.warn(`[ProcesarCobro] SIMULACIÓN: Notificar a usuario ${citaData.usuarioId} y prestador ${citaData.prestadorId} sobre pago exitoso para cita ${citaId}.`);
        return { success: true, message: `Cobro para la cita ${citaId} procesado exitosamente. El servicio está ahora en estado 'pagada'.` };
      } else {
        functions.logger.error(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} FALLIDO.`);
        transaction.update(citaRef, {
          paymentStatus: "fallido", // Marcar el pago como fallido
          fechaCobro: admin.firestore.Timestamp.now(), // Registrar el intento
          updatedAt: admin.firestore.Timestamp.now(),
        });
        // Notificar al usuario sobre el fallo
        functions.logger.warn(`[ProcesarCobro] SIMULACIÓN: Notificar a usuario ${citaData.usuarioId} sobre fallo en el pago para cita ${citaId}.`);
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

  // Opcional: Autenticación si solo usuarios autenticados pueden crear notificaciones para otros.
  // if (!context.auth) {
  //   throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida para crear notificaciones.");
  // }

  const {
    destinatarioId,
    rolDestinatario, // 'usuario' o 'prestador'
    titulo,
    cuerpo,
    tipoNotificacion, // ej: 'nueva_cita', 'cita_confirmada'
    prioridad,      // 'alta' o 'normal'
    datosAdicionales, // objeto con data extra, ej: { citaId: '123' }
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
    
    // No se retorna la notificación completa aquí, solo la confirmación.
    // El trigger de "enviarNotificacionInAppTrigger" se encargará del siguiente paso.
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

      // Solo procesar si está 'pendiente' (podría haber sido creada por otra función ya 'procesada')
      if (notificacionData.estadoNotificacion !== "pendiente") {
        functions.logger.log(`[Trigger] Notificación ${notificacionId} no está en estado 'pendiente', omitiendo. Estado actual: ${notificacionData.estadoNotificacion}.`);
        return null;
      }

      // SIMULACIÓN DE ENVÍO IN-APP / PREPARACIÓN PARA FCM
      // En una app real, aquí se enviaría un mensaje FCM al dispositivo del destinatario.
      // El mensaje FCM contendría el título, cuerpo, y datosAdicionales para que el cliente
      // sepa cómo mostrar la notificación y qué hacer al hacer clic.
      functions.logger.log(`[Trigger] SIMULACIÓN: Enviando notificación (ej. FCM) para ${notificacionId} a ${notificacionData.destinatarioId}. Título: ${notificacionData.titulo}`);
      
      // Actualizar el estado para indicar que el trigger la procesó.
      // Esto es para evitar que otros procesos o el mismo trigger (si se reconfigura) la reprocesen.
      try {
        await snapshot.ref.update({
          // estadoNotificacion: 'enviada_a_fcm', // O un estado más específico si usas FCM
          estadoNotificacion: 'procesada_por_trigger', // Estado genérico de procesamiento por trigger
          triggerProcesadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`[Trigger] Notificación ${notificacionId} marcada como 'procesada_por_trigger'.`);
      } catch (error) {
        functions.logger.error(`[Trigger] Error al actualizar estado de notificación ${notificacionId}:`, error);
        // Considera si debes reintentar o manejar este error de alguna forma.
      }

      // El cliente frontend escuchará los cambios en 'notificaciones' para el usuario logueado
      // y mostrará la notificación en la UI.
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

    // Condición específica: El servicio se cerró automáticamente y el pago se liberó
    const esLiberacionAutomatica =
      beforeData.estado === "completado_por_usuario" &&
      afterData.estado === "cerrado_automaticamente" &&
      beforeData.paymentStatus === "retenido_para_liberacion" &&
      afterData.paymentStatus === "liberado_al_proveedor" &&
      !afterData.calificacionUsuario; // Importante: solo si no hubo calificación

    if (esLiberacionAutomatica) {
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Detectada liberación automática de pago para servicio ${servicioId}. Preparando notificaciones.`);

      const servicioDetalles = afterData.detallesServicio || "Servicio sin descripción detallada";
      // Intentar obtener una fecha relevante del servicio.
      const fechaServicio = afterData.fechaServicio?.toDate().toLocaleDateString("es-MX") || 
                            afterData.fechaConfirmacion?.toDate().toLocaleDateString("es-MX") || 
                            "Fecha no especificada";
      const montoLiberado = afterData.montoCobrado || (afterData as CitaData).montoTotalEstimado || 0; // Casteo si usas CitaData aquí

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

  // Ordenar UIDs para asegurar una ID de chat consistente
  const participantesUids = [iniciadorId, destinatarioId].sort();
  const chatsRef = db.collection("chats");

  try {
    // Buscar si ya existe un chat entre estos dos participantes
    const q = chatsRef
      .where("participantesUids", "==", participantesUids) // Firestore soporta igualdad en arrays
      .limit(1);
      
    const chatExistenteSnap = await q.get();

    if (!chatExistenteSnap.empty) {
      const chatExistenteDoc = chatExistenteSnap.docs[0];
      functions.logger.info(`Chat encontrado entre ${iniciadorId} y ${destinatarioId}. ID: ${chatExistenteDoc.id}`);
      // Opcional: Aquí podrías actualizar 'ultimaActualizacion' o reabrir un chat archivado si es necesario
      return { success: true, chatId: chatExistenteDoc.id, nuevo: false, message: "Chat encontrado." };
    }

    // Si no existe, crear un nuevo chat
    functions.logger.info(`No se encontró chat. Creando nuevo chat entre ${iniciadorId} y ${destinatarioId}.`);
    
    // Opcional: Obtener información de los perfiles para 'participantesInfo'
    // const iniciadorPerfil = await db.collection("usuarios").doc(iniciadorId).get(); // o 'prestadores'
    // const destinatarioPerfil = await db.collection("usuarios").doc(destinatarioId).get(); // o 'prestadores'
    // const participantesInfo = {
    //   [iniciadorId]: { rol: 'rol_del_iniciador', nombre: iniciadorPerfil.data()?.name },
    //   [destinatarioId]: { rol: 'rol_del_destinatario', nombre: destinatarioPerfil.data()?.name }
    // };

    const nuevoChatData: Omit<ChatDataFirestore, "id" | "mensajes"> = { // Omitir ID, se genera automáticamente
      participantesUids: participantesUids,
      // participantesInfo: participantesInfo, // Descomentar si se implementa
      estadoChat: "activo",
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      conteoNoLeido: { // Inicializar contadores de no leídos
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

      // Verificar que el remitente sea participante del chat
      if (!chatData.participantesUids.includes(remitenteId)) {
        throw new functions.https.HttpsError("permission-denied", "No eres participante de este chat.");
      }
      // Verificar que el chat esté activo
      if (chatData.estadoChat !== "activo") {
        throw new functions.https.HttpsError("failed-precondition", `No se pueden enviar mensajes a un chat que no esté activo. Estado actual: ${chatData.estadoChat}`);
      }

      const nuevoMensaje: MensajeDataFirestore = {
        remitenteId: remitenteId,
        texto: texto, // El texto original antes de la moderación
        timestamp: admin.firestore.Timestamp.now(),
        leido: false, // Por defecto no leído para el destinatario
        // Los campos 'moderado' y 'motivoBloqueo' se añadirían por el trigger de moderación
      };

      // Determinar el ID del destinatario del mensaje
      const destinatarioDelMensajeId = chatData.participantesUids.find(uid => uid !== remitenteId);
      
      const updates: Partial<ChatDataFirestore> & { ultimaActualizacion: admin.firestore.FieldValue } = { // Asegurar tipo correcto
        mensajes: admin.firestore.FieldValue.arrayUnion(nuevoMensaje) as any, // Cast a 'any' es común aquí
        ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
        ultimoMensajeTexto: texto.substring(0, 100), // Snippet del mensaje (sin moderar aún)
        ultimoMensajeTimestamp: nuevoMensaje.timestamp,
        ultimoMensajeRemitenteId: remitenteId,
      };

      // Incrementar contador de no leídos para el destinatario
      if (destinatarioDelMensajeId) {
        updates.conteoNoLeido = {
          ...chatData.conteoNoLeido,
          [destinatarioDelMensajeId]: admin.firestore.FieldValue.increment(1) as any, // Cast a 'any'
        };
      }
      
      transaction.update(chatRef, updates);
      // El trigger 'moderarMensajesChat' se activará después de esta escritura si está configurado para 'onUpdate' en 'chats/{chatId}'
      // o 'onCreate' en 'chats/{chatId}/mensajes/{mensajeId}' si usas subcolección.
    });

    functions.logger.info(`Mensaje enviado por ${remitenteId} al chat ${chatId}. Texto: "${texto.substring(0,30)}..." (pendiente de moderación si aplica)`);
    return { success: true, message: "Mensaje enviado exitosamente." };
  } catch (error: any)
 {
    functions.logger.error(`Error al enviar mensaje al chat ${chatId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al enviar el mensaje.", error.message);
  }
});

// Trigger para moderar mensajes. Escucha en la actualización del documento de CHAT.
exports.moderarMensajesChat = functions.firestore
    .document('chats/{chatId}') // Escucha en el documento de chat
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
        
        // Si el mensaje ya fue moderado (quizás por una ejecución anterior o manualmente), no hacer nada.
        if (nuevoMensaje.moderado === true) {
            functions.logger.log(`[ModerarChat ${chatId}] Mensaje ya marcado como moderado, omitiendo.`);
            return null;
        }

        const mensajeTexto = nuevoMensaje.texto || '';
        const mensajeIdSimulado = `${nuevoMensaje.timestamp.toMillis()}_${nuevoMensaje.remitenteId}`; // ID simulado para logging

        functions.logger.log(`[ModerarChat ${chatId}] Nuevo mensaje detectado (ID simulado ${mensajeIdSimulado}): "${mensajeTexto.substring(0,50)}..."`);

        // Expresiones regulares y palabras clave prohibidas
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
            
            // Crear una copia actualizada del array de mensajes
            const mensajesActualizados = [...afterData.mensajes];
            mensajesActualizados[afterData.mensajes.length - 1] = {
                ...nuevoMensaje,
                texto: '[Mensaje bloqueado por el sistema]', // Reemplazar texto
                moderado: true,
                motivoBloqueo: motivo,
                textoOriginal: mensajeTexto, // Guardar el texto original
            };

            try {
                // Actualizar solo el array de mensajes y los campos relacionados con el último mensaje
                await db.collection('chats').doc(chatId).update({
                    mensajes: mensajesActualizados,
                    ultimoMensajeTexto: '[Mensaje bloqueado por el sistema]', // Actualizar el snippet
                    // No necesitamos actualizar ultimaActualizacion aquí si enviarMensaje ya lo hizo
                });
                functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) actualizado por moderación.`);

            } catch (updateError) {
                functions.logger.error(`[ModerarChat ${chatId}] Error al actualizar mensaje moderado:`, updateError);
            }
        } else {
            functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) pasó la moderación.`);
            // Opcional: si quieres marcar explícitamente que pasó la moderación (aunque no esté bloqueado)
            // Esto podría ser útil para no re-evaluarlo, pero la condición `nuevoMensaje.moderado === true` al inicio ya lo previene.
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

            // Leer el perfil actual para aplicar lógica de penalización
            const prestadorDocSnap = await prestadorRef.get(); // Realizar la lectura fuera del set para evitar problemas en transacciones
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevoRechazosCount = (prestadorDataActual?.rechazosCount || 0) + 1; // Calcular nuevo conteo

            if (nuevoRechazosCount > 0 && nuevoRechazosCount % 3 === 0) { // Penalización cada 3 rechazos
                const fechaExpiracionPenalizacion = new Date();
                fechaExpiracionPenalizacion.setDate(fechaExpiracionPenalizacion.getDate() + 1); // Penalización por 1 día

                actualizacionPrestador.penalizacionActiva = {
                    tipo: "visibilidad_reducida_temporal",
                    motivo: `Rechazos frecuentes de citas (${nuevoRechazosCount} rechazos).`,
                    expiraEn: admin.firestore.Timestamp.fromDate(fechaExpiracionPenalizacion),
                };
                logMessage += ` Aplicando penalización (visibilidad reducida) hasta ${fechaExpiracionPenalizacion.toISOString()}.`;
            }
        }
        // Caso 2: Cita CONFIRMADA por el PRESTADOR
        else if (afterData.estado === "confirmada_prestador" && beforeData.estado !== "confirmada_prestador") {
            logMessage = `[EvaluarComportamiento ${citaId}] Cita confirmada por prestador ${prestadorId}.`;
            actualizacionPrestador.confirmacionesCount = admin.firestore.FieldValue.increment(1) as any;
            
            const prestadorDocSnap = await prestadorRef.get(); // Leer el perfil actual
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevaConfirmacionesCount = (prestadorDataActual?.confirmacionesCount || 0) + 1;

            if (nuevaConfirmacionesCount > 0 && nuevaConfirmacionesCount % 5 === 0) { // Incentivo cada 5 confirmaciones
                if (!actualizacionPrestador.incentivos) actualizacionPrestador.incentivos = {};
                actualizacionPrestador.incentivos.puntosReputacion = admin.firestore.FieldValue.increment(10) as any;
                logMessage += ` Otorgando 10 puntos de reputación. Total puntos: ${(prestadorDataActual?.incentivos?.puntosReputacion || 0) + 10}.`;
            }
        }

        if (Object.keys(actualizacionPrestador).length > 0) {
            (actualizacionPrestador as any).updatedAt = admin.firestore.FieldValue.serverTimestamp(); // Añadir timestamp de actualización
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
                    // let currentPuntosReputacion = 0; // No es necesario leerlo si solo incrementamos

                    if (usuarioDoc.exists) {
                        const usuarioData = usuarioDoc.data() as UserData;
                        currentServiciosCalificados = usuarioData.serviciosCalificadosCount || 0;
                        // currentPuntosReputacion = usuarioData.puntosReputacionUsuario || 0; // No es necesario si solo incrementamos
                        updates = {
                            serviciosCalificadosCount: admin.firestore.FieldValue.increment(1) as any,
                            puntosReputacionUsuario: admin.firestore.FieldValue.increment(5) as any, // Otorgar 5 puntos por calificar
                        };

                        // Lógica de Badges (ejemplo)
                        if ((currentServiciosCalificados + 1) % 5 === 0) { // Cada 5 calificaciones
                            updates.badgesUsuario = admin.firestore.FieldValue.arrayUnion("calificador_bronce") as any; 
                            functions.logger.info(`[asignarIncentivoUsuarioTrigger] Usuario ${afterData.usuarioId} ganó badge 'calificador_bronce'.`);
                        }
                        // Podrías añadir más lógica para otros badges, ej. "experto_en_plomeria" si califica muchos servicios de plomería

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

// --- NUEVA FUNCIÓN ---
export const revisarDocumentoPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando revisarDocumentoPrestador", { structuredData: true, data });

  // Validación de autenticación y rol de administrador/moderador
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permiso para ejecutar esta función.");
  }

  const { documentoId, nuevoEstado, comentariosRevisor } = data; // documentoId es el ID del doc en 'documentosPrestadores'

  if (!documentoId || typeof documentoId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'documentoId'.");
  }
  if (!nuevoEstado || (nuevoEstado !== "aprobado" && nuevoEstado !== "rechazado")) {
    throw new functions.https.HttpsError("invalid-argument", "El 'nuevoEstado' debe ser 'aprobado' o 'rechazado'.");
  }
  if (comentariosRevisor && typeof comentariosRevisor !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'comentariosRevisor' debe ser un string.");
  }

  const docRef = db.collection("documentosPrestadores").doc(documentoId);

  try {
    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists) {
        throw new functions.https.HttpsError("not-found", `Documento con ID ${documentoId} no encontrado en 'documentosPrestadores'.`);
      }
      const docData = docSnap.data() as DocumentoPrestadorData;

      // Opcional: Verificar si el documento ya fue revisado o si está en un estado que no permite esta acción.
      // if (docData.estadoRevision !== "pendiente") {
      //   throw new functions.https.HttpsError("failed-precondition", `El documento ya tiene un estado de revisión: ${docData.estadoRevision}`);
      // }

      const updateData: Partial<DocumentoPrestadorData> = {
        estadoRevision: nuevoEstado,
        fechaRevision: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        revisadoPor: context.auth?.uid, // UID del admin/moderador
        ...(comentariosRevisor && { comentariosRevisor: comentariosRevisor }),
      };

      transaction.update(docRef, updateData);
      functions.logger.info(`Documento ${documentoId} del prestador ${docData.prestadorId} actualizado a estado: ${nuevoEstado} por admin ${context.auth?.uid}.`);

      // Opcional: Notificar al prestador sobre el resultado de la revisión.
      // await crearNotificacion({
      //   destinatarioId: docData.prestadorId,
      //   rolDestinatario: 'prestador',
      //   titulo: `Tu documento "${docData.tipoDocumento}" ha sido ${nuevoEstado}`,
      //   cuerpo: comentariosRevisor ? `Comentarios: ${comentariosRevisor}` : `Tu documento ha sido ${nuevoEstado}.`,
      //   tipoNotificacion: `documento_${nuevoEstado}`,
      //   prioridad: 'normal',
      //   datosAdicionales: { documentoId: documentoId, tipoDocumento: docData.tipoDocumento }
      // });
    });

    return { success: true, message: `Documento ${documentoId} actualizado a estado: ${nuevoEstado}.` };
  } catch (error: any) {
    functions.logger.error(`Error al revisar documento ${documentoId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al revisar el documento.", error.message);
  }
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

export const sugerirPrestadoresInteligente = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando sugerirPrestadoresInteligente", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid; // Usado para futuras personalizaciones

  const {
    categoriaId,
    ubicacionUsuario,
    descripcionServicio, // Para futura IA
    preferenciasUsuario, // { historialCategorias?: string[], prestadoresFavoritos?: string[], prestadoresEvitados?: string[] }
    maxResultados = 10,
  } = data;

  if (!categoriaId || !ubicacionUsuario || !ubicacionUsuario.lat || !ubicacionUsuario.lng) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'categoriaId' y 'ubicacionUsuario' (con lat y lng).");
  }

  const MAX_DISTANCIA_KM = 50; // Configurable: Rango máximo de búsqueda en km
  const WEIGHTS = { // Pesos para el algoritmo de puntuación
    rating: 0.4,
    distance: 0.3,
    availability: 0.15,
    reviewCount: 0.1,
    preference: 0.05, // Peso para preferencias del usuario
  };

  try {
    const prestadoresSnapshot = await db.collection("prestadores").get();
    const todosLosPrestadores = prestadoresSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProviderData & {id: string} ));
    functions.logger.info(`[Sugerir] Total prestadores leídos: ${todosLosPrestadores.length}`);

    let prestadoresFiltrados = todosLosPrestadores.filter((p) => {
      // 1. Filtrar por categoría
      const ofreceCategoria = p.services?.some((s) => s.categoria === categoriaId);
      if (!ofreceCategoria) return false;

      // 2. Filtrar por distancia
      if (p.location) {
        const distancia = calculateDistance(ubicacionUsuario.lat, ubicacionUsuario.lng, p.location.lat, p.location.lng);
        (p as any).distanciaKm = parseFloat(distancia.toFixed(1)); // Añadir distancia para uso posterior
        return distancia <= MAX_DISTANCIA_KM;
      }
      return false; // Si no tiene ubicación, no se puede calcular distancia
    });
    functions.logger.info(`[Sugerir] Prestadores tras filtro de categoría y distancia (${MAX_DISTANCIA_KM}km): ${prestadoresFiltrados.length}`);

    // 3. Simulación de Análisis de Historial de Usuario (Placeholder)
    // En una implementación real, se leería el historial del 'usuarioId'
    functions.logger.info(`[Sugerir] Placeholder: Analizando historial de usuario ${usuarioId} y preferencias:`, preferenciasUsuario);
    const historialCategoriasUsuario = preferenciasUsuario?.historialCategorias || [];
    // const prestadoresFavoritosUsuario = preferenciasUsuario?.prestadoresFavoritos || [];


    // 4. Calcular puntuación para cada prestador
    const prestadoresPuntuados = prestadoresFiltrados.map((p) => {
      let score = 0;
      const pTyped = p as any; // Para acceder a distanciaKm

      // Componente de Calificación
      const ratingScore = (p.rating || 0) * WEIGHTS.rating; // Usar 0 si no hay rating

      // Componente de Distancia (más cerca es mejor, normalizado inversamente)
      // Evitar división por cero si distancia es 0. Usar una distancia mínima pequeña para el cálculo.
      const effectiveDistance = Math.max(0.1, pTyped.distanciaKm || MAX_DISTANCIA_KM); // Usar MAX_DISTANCIA_KM si no hay distanciaKm
      const distanceScore = (1 / effectiveDistance) * MAX_DISTANCIA_KM * WEIGHTS.distance; // Normalizar un poco

      // Componente de Disponibilidad
      const availabilityScore = p.isAvailable ? 1 * WEIGHTS.availability : 0;

      // Componente de Número de Calificaciones (reputación/experiencia)
      // Usar log para que el impacto de muchas calificaciones sea decreciente
      const reviewCountScore = Math.log1p(p.ratingCount || 0) * WEIGHTS.reviewCount;

      // Componente de Preferencia del Usuario (simulado)
      let preferenceBoost = 0;
      if (p.services?.some(s => historialCategoriasUsuario.includes(s.categoria || ""))) {
        preferenceBoost = 0.5; // Pequeño boost si el prestador está en una categoría que el usuario ha usado
      }
      const preferenceScore = preferenceBoost * WEIGHTS.preference;

      // Puntuación Total
      score = ratingScore + distanceScore + availabilityScore + reviewCountScore + preferenceScore;
      
      // (Futuro) Placeholder para IA: Análisis de 'descripcionServicio' vs 'p.especialidades'
      // if (descripcionServicio && p.especialidades) {
      //   const matchScoreIA = await analizarCoincidenciaIA(descripcionServicio, p.especialidades);
      //   score += matchScoreIA * PESO_IA;
      // }
      functions.logger.debug(`[Sugerir] Prestador ${p.id} (${p.name}): Dist ${pTyped.distanciaKm}km, Rating ${p.rating}, Disp ${p.isAvailable}, Revs ${p.ratingCount}. Scores: rating=${ratingScore.toFixed(2)}, dist=${distanceScore.toFixed(2)}, avail=${availabilityScore.toFixed(2)}, revs=${reviewCountScore.toFixed(2)}, pref=${preferenceScore.toFixed(2)}. TOTAL SCORE: ${score.toFixed(2)}`);
      return { ...p, finalScore: score, distanciaKmCalculada: pTyped.distanciaKm };
    });

    // 5. Ordenar por puntuación final (descendente)
    prestadoresPuntuados.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    // 6. Seleccionar y formatear los mejores resultados
    const resultadosFinales = prestadoresPuntuados
      .slice(0, maxResultados)
      .map((p): PrestadorSugerido => ({ // Asegurar que el tipo de retorno coincida con PrestadorSugerido
        prestadorId: p.id,
        nombre: p.name || "Nombre no disponible",
        rating: p.rating || 0,
        ratingCount: p.ratingCount || 0,
        distanciaKm: p.distanciaKmCalculada,
        isAvailable: p.isAvailable || false,
        especialidades: p.especialidades,
        score: parseFloat((p.finalScore || 0).toFixed(2)),
        avatarUrl: p.avatarUrl,
      }));
    
    functions.logger.info(`[Sugerir] Total prestadores sugeridos: ${resultadosFinales.length}`);
    return resultadosFinales;
  } catch (error: any) {
    functions.logger.error("Error en sugerirPrestadoresInteligente:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al obtener sugerencias de prestadores.", error.message);
  }
});

export const mostrarServiciosDestacados = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando mostrarServiciosDestacados", { structuredData: true });

  // No requiere autenticación ya que los destacados suelen ser públicos
  const now = admin.firestore.Timestamp.now();

  try {
    let query = db.collection("serviciosDestacados")
      .where("fechaInicio", "<=", now)
      .where("fechaFin", ">=", now);

    // Ordenar por prioridad (menor número es mayor prioridad) y luego por fecha de inicio más reciente
    query = query.orderBy("prioridad", "asc").orderBy("fechaInicio", "desc");

    const snapshot = await query.get();
    const destacados: any[] = []; // Usar 'any' o un tipo específico para el cliente
    snapshot.forEach((doc) => {
      const docData = doc.data();
      destacados.push({
        id: doc.id,
        ...docData,
        // Convertir Timestamps a strings ISO para el cliente si es necesario
        fechaInicio: (docData.fechaInicio as admin.firestore.Timestamp).toDate().toISOString(),
        fechaFin: (docData.fechaFin as admin.firestore.Timestamp).toDate().toISOString(),
      });
    });

    functions.logger.info(`Encontrados ${destacados.length} servicios destacados activos.`);
    return destacados;
  } catch (error: any) {
    functions.logger.error("Error al obtener servicios destacados:", error);
    throw new functions.https.HttpsError("internal", "No se pudieron obtener los servicios destacados.", error.message);
  }
});
// --- FIN FUNCIONES EXISTENTES ---
