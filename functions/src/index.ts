
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// --- CONSTANTES ---
const STANDARD_WARRANTY_DAYS = 3; // Días de garantía estándar
const PREMIUM_WARRANTY_DAYS = 7; // Días de garantía premium
const RATING_AND_DISPUTE_WINDOW_DAYS = 3; // Cambiado a 3 días

const PALABRAS_CLAVE_PROHIBIDAS_CONTACTO = [
  "teléfono", "telefono", "celular", "móvil", "movil", "whatsapp", "tel:",
  "email", "correo", "e-mail", "@",
  "facebook", "fb.com", "instagram", "twitter", "linkedin", "tiktok",
  "calle", "avenida", "colonia", "barrio", "cp ", "c.p.", "código postal", "codigo postal",
  "apartado postal", "suite", "edificio", "núm.", "no.", "int.", "depto.",
  "contacto", "llámame", "llamame", "escríbeme", "escribeme", "sitio web", "pagina web", "www.", ".com", ".mx", ".net", ".org",
];

// Helper para categorías dentro de las funciones (evita dependencia de src/lib)
const SERVICE_CATEGORIES_FUNCTIONS = [
  { id: 'plumbing', name: 'Plomería' },
  { id: 'electrical', name: 'Electricidad' },
  { id: 'cleaning', name: 'Limpieza' },
  { id: 'tutoring', name: 'Tutoría' },
  { id: 'gardening', name: 'Jardinería' },
  { id: 'design', name: 'Diseño Gráfico' },
  { id: 'handyman', name: 'Manitas' },
  { id: 'consulting', name: 'Consultoría' },
  { id: 'it_support', name: 'Soporte TI' },
  { id: 'child_care', name: 'Cuidado de Niños' },
  { id: 'doctors', name: 'Doctores' },
  { id: 'nurses', name: 'Enfermeras' },
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

interface ServiceDataFirebase { // Renombrado para evitar colisión con tipo Service en frontend
  id?: string; // No usualmente almacenado aquí, sino el ID del doc
  title: string;
  description: string;
  price: number;
  category: string;
  providerId: string; // UID del proveedor
  imageUrl?: string;
}

interface ServiceData { // Interfaz para la colección `servicios`
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
  avatarUrl?: string;
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
  services?: ServiceDataFirebase[]; // Para sugerirPrestadoresInteligente y para obtener categoría principal
  specialties?: string[];
}

interface UserData {
  uid?: string;
  name?: string;
  ratingSumUsuario?: number;
  ratingCountUsuario?: number;
  ratingUsuario?: number;
  isPremium?: boolean;
  membresiaActual?: string;

  serviciosCalificadosCount?: number;
  puntosReputacionUsuario?: number;
  badgesUsuario?: string[];
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

interface DocumentoPrestadorData {
  id?: string;
  prestadorId: string;
  tipoDocumento: string;
  urlDocumento: string;
  nombreArchivo?: string;
  estadoRevision: "pendiente" | "aprobado" | "rechazado";
  fechaSubida: admin.firestore.Timestamp;
  fechaRevision?: admin.firestore.Timestamp;
  revisadoPor?: string;
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
  fechaHoraSolicitada: admin.firestore.Timestamp;
  detallesServicio: string;
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;
  estado: CitaEstado;
  fechaCreacion: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  fechaRechazoPrestador?: admin.firestore.Timestamp;
  ordenCobroId?: string;

  paymentStatus?: PaymentStatus; // Reutilizado de ServiceRequest
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

type EstadoContrato = 'pendiente_aceptacion_usuario' | 'pendiente_aceptacion_prestador' | 'aceptado_ambos' | 'rechazado_usuario' | 'rechazado_prestador' | 'cancelado_sistema';

interface ContratoServicioData {
  id?: string;
  referenciaId: string;
  tipoReferencia: 'servicio' | 'cita';
  usuarioId: string;
  prestadorId: string;
  fechaCreacionContrato: admin.firestore.Timestamp;
  textoContrato: string;
  estadoContrato: EstadoContrato;
  fechaAceptacionUsuario?: admin.firestore.Timestamp;
  fechaAceptacionPrestador?: admin.firestore.Timestamp;
  fechaRechazoUsuario?: admin.firestore.Timestamp;
  fechaRechazoPrestador?: admin.firestore.Timestamp;
  infoServicioOriginal?: {
    detalles?: string;
    fechaHora?: admin.firestore.Timestamp;
    monto?: number;
    ubicacion?: any;
  };
  updatedAt: admin.firestore.Timestamp;
}

interface SugerirPrestadoresInput {
  categoriaId: string;
  ubicacionUsuario: { lat: number; lng: number };
  descripcionServicio?: string;
  preferenciasUsuario?: {
    historialCategorias?: string[];
    prestadoresFavoritos?: string[];
    prestadoresEvitados?: string[];
  };
  maxResultados?: number;
  distanciaMaximaKm?: number;
  disponibilidad?: 'disponibles_ahora' | 'todos';
  calificacionMinima?: number;
  precioMaximo?: number;
  ordenarPor?: 'calificacion_desc' | 'precio_asc' | 'precio_desc';
}

interface PrestadorSugerido {
  prestadorId: string;
  nombre: string;
  rating: number;
  ratingCount: number;
  distanciaKm?: number;
  isAvailable: boolean;
  especialidades?: string[];
  score?: number;
  avatarUrl?: string;
  sortPrice?: number;
}

interface ServicioDestacadoData {
  id?: string;
  servicioId: string;
  prestadorId: string;
  descripcionPromocional: string;
  fechaInicio: admin.firestore.Timestamp;
  fechaFin: admin.firestore.Timestamp;
  prioridad?: number;
  urlImagenPromocional?: string;
  urlVideoPromocional?: string;
}

type EstadoSolicitudSoporte = 'pendiente' | 'en_proceso' | 'esperando_respuesta_usuario' | 'resuelto' | 'cerrado';

interface SoporteTicketData {
  id?: string;
  solicitanteId: string;
  rolSolicitante: 'usuario' | 'prestador';
  tipoSoporte: string;
  mensaje: string;
  estadoSolicitud: EstadoSolicitudSoporte;
  fechaCreacion: admin.firestore.Timestamp;
  referenciaId?: string;
  historialConversacion?: {
    remitenteId: string;
    mensaje: string;
    timestamp: admin.firestore.Timestamp;
  }[];
  asignadoA?: string;
  respuestaSoporte?: string;
  fechaRespuestaSoporte?: admin.firestore.Timestamp;
  fechaCierre?: admin.firestore.Timestamp;
  prioridadTicket?: 'baja' | 'normal' | 'alta' | 'urgente';
  adjuntosUrls?: string[];
}

interface TraduccionDataFirestore {
  [key: string]: string | admin.firestore.Timestamp | undefined;
  fechaUltimaActualizacion: admin.firestore.Timestamp;
}

interface UbicacionPrestadorData {
  lat: number;
  lng: number;
  timestamp: admin.firestore.Timestamp;
}

interface CoberturaZone {
  id: string;
  nombre: string;
  centro: { lat: number; lng: number };
  radioKm: number;
}

interface ValidacionCoberturaData {
  usuarioId?: string;
  direccionTexto?: string;
  coordenadasAnalizadas: { lat: number; lng: number };
  estaEnCobertura: boolean;
  zonaId?: string;
  mensajeResultado: string;
  fechaValidacion: admin.firestore.Timestamp;
}

interface ValidacionConPrestadoresData {
  usuarioId?: string;
  direccionTexto?: string;
  coordenadasAnalizadas: { lat: number; lng: number };
  estaEnCobertura: boolean;
  zonaId?: string;
  mensajeResultado: string;
  prestadoresSugeridosIds?: string[];
  filtrosAplicados: any;
  fechaValidacion: admin.firestore.Timestamp;
}

interface PrestadorSugeridoConDistancia {
  id: string;
  nombre?: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  esPremium: boolean;
  distanciaKm?: number;
  lat: number;
  lng: number;
  categoriaPrincipal?: string; // Nombre de la categoría principal
  isAvailable?: boolean;
}

interface PrestadorMapaPopupData {
  id: string;
  nombre?: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  categoriaPrincipal?: string; // Nombre de la categoría principal
  enlacePerfil: string;
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
        functions.logger.info(`[Comisiones] Prestador ${prestadorId} tiene membresía con descuento porcentual. Comisión aplicada: ${comisionPorcentaje}%`);
      }
    }
  }

  const montoComision = montoTotalServicio * (comisionPorcentaje / 100);
  const montoParaProveedor = montoTotalServicio - montoComision;

  functions.logger.info(`[Comisiones] Servicio ${servicioId}: Monto Total: ${montoTotalServicio}, Comisión (${comisionPorcentaje}%): ${montoComision}, Monto para Proveedor: ${montoParaProveedor}`);
  return montoParaProveedor;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- CLOUD FUNCTIONS ---

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

  const planKey = `${tipoMembresiaDeseado}_${rol}`; // Ajuste para que coincida con las claves de PLANES_MEMBRESIA
  const planSeleccionado = PLANES_MEMBRESIA[tipoMembresiaDeseado]; // Modificado para buscar por clave directa

  if (!planSeleccionado) {
    // Ajuste en el mensaje de error para reflejar cómo se busca ahora
    throw new functions.https.HttpsError("not-found", `El plan de membresía '${tipoMembresiaDeseado}' no es válido. Clave buscada: ${tipoMembresiaDeseado}`);
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
      premium: tipoMembresiaDeseado.startsWith("premium"), // Set premium to true if it's any premium plan
      rol: rol,
      membresiaTipo: tipoMembresiaDeseado,
      membresiaExpiraEpoch: fechaExpiracion.toMillis(),
    });
    functions.logger.info(`[activarMembresia] Custom claims actualizados para ${userId}.`);

    const perfilCollection = rol === 'usuario' ? "usuarios" : "prestadores";
    const perfilRef = db.collection(perfilCollection).doc(userId);
    await perfilRef.set({
      membresiaActual: tipoMembresiaDeseado,
      isPremium: tipoMembresiaDeseado.startsWith("premium"),
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

      if (servicioData.estado !== "completado_por_prestador") {
          functions.logger.warn(`Intento de confirmar servicio ${servicioId} en estado inválido. Estado actual: ${servicioData.estado}`);
          throw new functions.https.HttpsError("failed-precondition", `El servicio debe estar en estado 'completado_por_prestador' para ser confirmado por el usuario. Estado actual: ${servicioData.estado}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const ratingAndDisputeWindowEndDate = new Date(now.toDate().getTime() + RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(ratingAndDisputeWindowEndDate);
      
      let warrantyDays = STANDARD_WARRANTY_DAYS;
      const userProfile = await getMockUser(userId); 

      if (userProfile?.isPremium) {
        const membresiaRef = db.collection("membresias").doc(userId);
        // Idealmente, la transacción debería leer la membresía si es crítica para la lógica
        const membresiaDoc = await transaction.get(membresiaRef); 

        if (membresiaDoc.exists) {
            const membresiaData = membresiaDoc.data() as MembresiaData;
            if (membresiaData.estadoMembresia === "activa" && membresiaData.beneficiosAdicionales?.garantiaExtendidaDiasAdicionales) {
                warrantyDays = STANDARD_WARRANTY_DAYS + membresiaData.beneficiosAdicionales.garantiaExtendidaDiasAdicionales;
            } else if (membresiaData.estadoMembresia === "activa") { // Si es premium pero sin beneficio específico de días extra, usa PREMIUM_WARRANTY_DAYS
                 warrantyDays = PREMIUM_WARRANTY_DAYS; // 7 días
            }
        } else if (context.auth?.token.premium) { // Fallback al claim si no hay doc de membresía (o si es más rápido)
            warrantyDays = PREMIUM_WARRANTY_DAYS; // 7 días
        }
      }
      
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario",
        fechaConfirmacion: now, // Usar el timestamp del servidor 'now'
        userConfirmedCompletionAt: now,
        habilitarCalificacion: true,
        paymentStatus: "retenido_para_liberacion",
        ratingWindowExpiresAt: ratingWindowExpiresTimestamp,
        warrantyEndDate: warrantyEndDateDt.toISOString().split("T")[0], // Guardar como YYYY-MM-DD
        updatedAt: now,
      });
      functions.logger.info(`Servicio ${servicioId} confirmado por usuario ${userId}. Estado: completado_por_usuario. Calificación habilitada, pago retenido, ventana de calificación/disputa de ${RATING_AND_DISPUTE_WINDOW_DAYS} días y garantía (${warrantyDays} días) hasta ${warrantyEndDateDt.toISOString().split("T")[0]} establecidas.`);
    });

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

      if (prestadorDoc.exists) {
        const prestadorData = prestadorDoc.data() as ProviderData;
        newRatingSum = (prestadorData.ratingSum || 0) + calificacion;
        newRatingCount = (prestadorData.ratingCount || 0) + 1;
      }
      const currentRating = newRatingCount > 0 ? parseFloat((newRatingSum / newRatingCount).toFixed(2)) : 0;

      transaction.set(prestadorDocRef, { // Usar set con merge:true para crear si no existe
        uid: servicioData.prestadorId, // Asegurar que el UID se guarde
        name: prestadorDoc.exists() ? (prestadorDoc.data() as ProviderData).name : `Prestador ${servicioData.prestadorId.substring(0,5)}`, // Nombre por defecto
        ratingSum: newRatingSum,
        ratingCount: newRatingCount,
        rating: currentRating,
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
        // La liberación de pago se maneja en simulateDailyAutomatedChecks o al resolver disputa
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
  const usuarioCollectionRef = db.collection("usuarios"); // Asume una colección "usuarios"

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
         // Considerar si los prestadores también tienen ventana de tiempo, o si pueden calificar después
        throw new functions.https.HttpsError("failed-precondition", "El período para calificar a este usuario ha expirado.");
      }


      const nuevaCalificacionPrestador: RatingData = {
        calificacion: calificacion,
        fecha: admin.firestore.Timestamp.now(),
        ...(comentario && { comentario: comentario }),
      };

      const usuarioDocRef = usuarioCollectionRef.doc(servicioData.usuarioId);
      const usuarioDoc = await transaction.get(usuarioDocRef);
      let newRatingSumUsuario = calificacion;
      let newRatingCountUsuario = 1;
      let userName = `Usuario ${servicioData.usuarioId.substring(0, 5)}`; // Nombre por defecto

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSumUsuario = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCountUsuario = (usuarioData.ratingCountUsuario || 0) + 1;
        userName = usuarioData.name || userName;
      }
      const currentRatingUsuario = newRatingCountUsuario > 0 ? parseFloat((newRatingSumUsuario / newRatingCountUsuario).toFixed(2)) : 0;

      transaction.set(usuarioDocRef, { // Usar set con merge:true para crear si no existe
        uid: servicioData.usuarioId, // Asegurar que el UID se guarde
        name: userName,
        ratingSumUsuario: newRatingSumUsuario,
        ratingCountUsuario: newRatingCountUsuario,
        ratingUsuario: currentRatingUsuario, // Promedio de calificaciones recibidas POR el usuario
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> & { updatedAt: admin.firestore.FieldValue } = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (servicioData.calificacionUsuario) { // Si el usuario ya calificó al prestador
        servicioUpdate.mutualRatingCompleted = true;
        if (servicioData.estado !== "en_disputa") { // Solo cerrar si no está en disputa
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
        throw new functions.https.HttpsError("permission-denied", "No estás autorizado para reportar un problema sobre este servicio.");
      }

      // Solo se puede reportar si el usuario ya confirmó Y está dentro de la ventana de calificación/disputa
      if (servicioData.estado !== "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios que hayas confirmado ('completado_por_usuario'). Estado actual: ${servicioData.estado}`);
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema o calificar este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") { // Ya hay un reporte activo
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
          reporteId: reporteId, // Enlazar al nuevo documento en 'reportes'
        },
        updatedAt: now,
      });

      // Crear un documento en la colección "reportes"
       const datosReporte = {
         servicioId: servicioId,
         usuarioId: usuarioId,
         prestadorId: servicioData.prestadorId,
         motivo: detalleProblema,
         fechaReporte: now,
         estado: "pendiente_revision_admin", // Estado inicial del reporte en sí
       };
       transaction.set(db.collection("reportes").doc(reporteId), datosReporte);


      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteId}. Pago congelado.`);
      // SIMULACIÓN: Notificar al prestador y al admin. En una app real, esto llamaría a crearNotificacion.
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
      .where("usuarioId", "==", usuarioId) // Asegurar que solo obtiene los del usuario
      .where("estado", "==", "completado_por_usuario") // Estado específico
      .orderBy("fechaConfirmacion", "desc") // Opcional: más recientes primero
      .get();

    const serviciosCompletados: Partial<ServiceData>[] = []; // Devolver solo algunos campos
    querySnapshot.forEach((doc) => {
      const servicio = doc.data() as ServiceData;
      serviciosCompletados.push({
        id: doc.id, // Incluir el ID del documento
        estado: servicio.estado,
        prestadorId: servicio.prestadorId,
        fechaConfirmacion: servicio.fechaConfirmacion,
        detallesServicio: servicio.detallesServicio, // o el campo relevante
        // Añadir más campos según sea necesario para la UI
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
  const prestadorId = context.auth.uid; // El prestador solo puede registrar documentos para sí mismo.
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
    // Usar una transacción para asegurar que el documento del prestador exista o se cree
    await db.runTransaction(async (transaction) => {
      const prestadorDoc = await transaction.get(prestadorRef);
      if (!prestadorDoc.exists) {
        // Si el prestador no tiene perfil, se podría crear uno básico aquí o devolver error.
        // Por ahora, creamos uno si no existe, asumiendo que al menos el UID es válido.
        functions.logger.info(`Documento del prestador ${prestadorId} no encontrado, creando uno nuevo con el documento.`);
        transaction.set(prestadorRef, { 
            documentosVerificables: [nuevoDocumento], 
            uid: prestadorId, // Importante para consistencia
            name: context.auth.token.name || `Prestador ${prestadorId.substring(0,5)}`, // Usar nombre del token si está disponible
            isAvailable: false, // Valores por defecto
            rating: 0, ratingCount: 0, ratingSum: 0
            // ... otros campos por defecto para un nuevo prestador
        });
      } else {
        // Si el prestador existe, añade el documento al array
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
  timeoutSeconds: 120, // Aumentar timeout por si la llamada a Vision API tarda
  memory: "512MB",    // Aumentar memoria si es necesario para Vision API
}).https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo (Vision API)", { structuredData: true, data });

  // Solo administradores o moderadores pueden ejecutar esta función
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador) ) { // Asumiendo que tienes un claim 'admin' o 'moderador'
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
      // Crear una copia mutable del array para modificarla
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : []; 

      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];
      const urlDocumento = documentoAVerificar.urlDocumento;
      functions.logger.info(`Iniciando análisis de Vision API para documento: ${urlDocumento}`);

      let textoExtraido = "";
      try {
        // Usar documentTextDetection para mejor extracción en documentos
        const [result] = await visionClient.documentTextDetection(urlDocumento);
        textoExtraido = result.fullTextAnnotation?.text?.toLowerCase() || ""; // Convertir a minúsculas para la búsqueda
        functions.logger.info(`Texto extraído (primeros 500 chars): ${textoExtraido.substring(0, 500)}`);
      } catch (visionError: any) {
        functions.logger.error("Error de Vision API al procesar el documento:", visionError);
        // Marcar el documento como fallido si Vision API falla
        documentos[documentoIndex].estadoVerificacion = "rechazado_ia"; // Nuevo estado
        documentos[documentoIndex].motivoRechazoIA = `Error de Vision API: ${visionError.message || "Desconocido"}`;
        documentos[documentoIndex].fechaVerificacion = admin.firestore.Timestamp.now();
        transaction.update(prestadorRef, { documentosVerificables: documentos });
        throw new functions.https.HttpsError("internal", "Error al analizar el documento con Vision API.", visionError.message);
      }

      // Combinar descripción, tipo y texto extraído para el análisis
      const textoParaAnalizar = `${documentoAVerificar.descripcion?.toLowerCase() || ""} ${documentoAVerificar.tipoDocumento?.toLowerCase() || ""} ${textoExtraido}`;
      let datosSensiblesEncontrados = false;
      const palabrasDetectadas: string[] = [];

      // Expresiones regulares mejoradas
      const phoneRegex = /(?:(?:\+|00)52\s?)?(?:\(\d{2,3}\)\s?)?(?:[ -]?\d){7,10}/g; // Para México, más flexible
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
      
      // Búsqueda de palabras clave
      for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
        // Usar \b para asegurar que se busca la palabra completa y no subcadenas
        const palabraRegex = new RegExp(`\\b${palabra.toLowerCase()}\\b`, "g"); 
        if (palabraRegex.test(textoParaAnalizar)) {
          // Evitar duplicados si ya se detectó por regex más específico (ej. @ para email)
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
        nuevoEstado = "Validado"; // Anteriormente "verificado_ia"
        documentos[documentoIndex].motivoRechazoIA = undefined; // Limpiar si se aprueba
        documentos[documentoIndex].palabrasClaveDetectadasIA = undefined; // Limpiar si se aprueba
        mensajeRespuesta = "Validado correctamente: No se detectaron datos de contacto.";
        functions.logger.info(`Documento ${documentoIndex} para prestador ${prestadorId} VALIDADO por IA.`);
      }
      documentos[documentoIndex].estadoVerificacion = nuevoEstado;

      transaction.update(prestadorRef, { documentosVerificables: documentos });

      // Loguear el resultado de la verificación
      await db.collection("verificacionesIA").add({
        prestadorId,
        documentoUrl: urlDocumento,
        documentoTipo: documentoAVerificar.tipoDocumento,
        documentoIndex,
        fechaVerificacion: documentos[documentoIndex].fechaVerificacion,
        resultadoIA: nuevoEstado,
        textoAnalizadoLength: textoParaAnalizar.length, // Útil para saber si se extrajo texto
        palabrasClaveDetectadas: datosSensiblesEncontrados ? palabrasDetectadas : [],
        agenteVerificador: context.auth?.uid || "sistema_ia_callable", // Quién ejecutó la función
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
   // Asumimos que el claim 'premium' se establece al activar la membresía
  if (context.auth.token.premium !== true) {
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
      if (servicioData.estado !== "completado_por_usuario") { // Solo para servicios confirmados por el usuario
        throw new functions.https.HttpsError("failed-precondition", "La garantía solo puede activarse para servicios confirmados por el usuario.");
      }
      if (servicioData.garantiaSolicitada === true) {
        throw new functions.https.HttpsError("already-exists", "Ya se ha solicitado una garantía para este servicio.");
      }
      
      const warrantyEndDateString = servicioData.warrantyEndDate; // YYYY-MM-DD
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      // Convertir YYYY-MM-DD a objeto Date, considerando el final del día.
      const [year, month, day] = warrantyEndDateString.split('-').map(Number);
      const warrantyEndDate = new Date(year, month - 1, day, 23, 59, 59, 999); // Ajustar a la zona horaria si es necesario
      
      const currentDate = new Date(); // Fecha actual

      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      // Crear nuevo documento en la colección "garantias"
      const nuevaSolicitudGarantiaRef = garantiasRef.doc(); // Firestore genera un ID automáticamente
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.Timestamp.now(), // Usar Timestamp de Firestore
        estadoGarantia: "pendiente",
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      // Actualizar el documento del servicio para marcar que se solicitó garantía
      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id, // Guardar el ID de la solicitud de garantía
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Garantía premium activada para servicio ${servicioId}. Garantía ID: ${nuevaSolicitudGarantiaRef.id}`);
      // SIMULACIÓN: Notificar al admin sobre la nueva solicitud de garantía.
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
  // Solo administradores o moderadores pueden ejecutar esta función
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) { // Ajusta los nombres de los claims según tu configuración
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

      // Verificar que la garantía esté en un estado que permita resolución
      const validPreviousStates: GarantiaData["estadoGarantia"][] = ["pendiente", "en_revision"];
      if (!validPreviousStates.includes(garantiaData.estadoGarantia)) {
        throw new functions.https.HttpsError("failed-precondition", `La garantía ya ha sido resuelta o está en un estado inválido (${garantiaData.estadoGarantia}).`);
      }

      // Actualizar el documento de garantía
      const updateGarantiaData: Partial<GarantiaData> = {
        estadoGarantia: decision,
        fechaResolucionGarantia: admin.firestore.Timestamp.now(),
        resolucionDetalles: comentarioResolucion || "", // Guardar comentario si existe
        resueltaPor: context.auth?.uid, // UID del admin/moderador que resolvió
      };
      transaction.update(garantiaRef, updateGarantiaData);

      // Actualizar el servicio original si la garantía fue aprobada
      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> = {
        garantiaResultado: decision as "aprobada" | "rechazada", // Cast a los tipos esperados
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true; // Marcar que se autorizó compensación
        // Aquí iría la lógica para el reembolso/crédito si aplica
        functions.logger.info(`Garantía ${garantiaId} aprobada. SIMULACIÓN: Iniciar proceso de compensación/reembolso para servicio ${garantiaData.servicioId}.`);
      } else { // decision === "rechazada"
        servicioUpdateData.compensacionAutorizada = false;
      }
      transaction.update(servicioRef, servicioUpdateData);


      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      // SIMULACIÓN: Notificar al usuario y prestador sobre la resolución.
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
    const threeDaysAgo = new Date(now.toDate().getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 días atrás
    const threeDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(threeDaysAgo);

    const serviciosRef = db.collection("servicios");
    const batch = db.batch();
    let processedCount = 0;

    functions.logger.info(`[DailyCheck] Buscando servicios para cierre automático (ventana de 3 días). Límite para confirmación de usuario: ${threeDaysAgo.toISOString()}`);

    // CASO 1: Servicios completados por usuario, pago retenido, sin acción por >3 días
    const querySinAccion = serviciosRef
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("userConfirmedCompletionAt", "<=", threeDaysAgoTimestamp); 
      // El campo es fechaConfirmacion si así lo llamaste, o userConfirmedCompletionAt

    try {
      const snapshotSinAccion = await querySinAccion.get();
      functions.logger.info(`[DailyCheck] Encontrados ${snapshotSinAccion.size} servicios 'completado_por_usuario' con pago 'retenido' y confirmados hace más de 3 días.`);
      
      snapshotSinAccion.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        functions.logger.log(`[DailyCheck] Procesando servicio para cierre automático (sin acción): ${doc.id}. Estado: ${servicio.estado}, userConfirmedCompletionAt: ${servicio.userConfirmedCompletionAt?.toDate().toISOString()}`);
        
        // Asegurarse que no haya sido calificado por el usuario y no esté en disputa (el estado ya filtra esto)
        if (!servicio.calificacionUsuario && servicio.estado === "completado_por_usuario") {
          functions.logger.info(`[DailyCheck] CERRANDO AUTOMÁTICAMENTE Y LIBERANDO PAGO (sin acción) para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
          batch.update(doc.ref, {
            paymentStatus: "liberado_al_proveedor",
            fechaLiberacionPago: now,
            estado: "cerrado_automaticamente",
            updatedAt: now,
            habilitarCalificacion: false, // Desactivar calificación después de la ventana
          });
          processedCount++;
        } else {
           functions.logger.log(`[DailyCheck] Servicio ${doc.id} no cumple condiciones para cierre automático (ya calificado o estado no es completado_por_usuario). calificacionUsuario: ${!!servicio.calificacionUsuario}, estado: ${servicio.estado}`);
        }
      });
    } catch (error) {
      functions.logger.error("[DailyCheck] Error consultando servicios para liberación (sin acción):", error);
    }
    
    // CASO 2: Servicios calificados por el usuario, pero pago aún retenido (como un barrido/fallback)
    // Esto cubre el punto 5 de tu solicitud: "Si el usuario califica dentro de los 3 días, el pago se libera en ese momento."
    // La función `calificarPrestador` debería haber intentado liberar el pago.
    // Esta parte de `simulateDailyAutomatedChecks` actúa como un seguro si esa liberación no ocurrió.
    const queryCalificadosPagoRetenido = serviciosRef
        .where("estado", "==", "cerrado_con_calificacion") // Usuario ya calificó
        .where("paymentStatus", "==", "retenido_para_liberacion"); 

    try {
        const snapshotCalificados = await queryCalificadosPagoRetenido.get();
        functions.logger.info(`[DailyCheck] Encontrados ${snapshotCalificados.size} servicios 'cerrado_con_calificacion' con pago 'retenido_para_liberacion'.`);

        snapshotCalificados.forEach(doc => {
            const servicio = doc.data() as ServiceData;
            // Solo liberar si no está en disputa (aunque "cerrado_con_calificacion" ya implica que no lo está)
            if (servicio.estado !== "en_disputa") { 
                functions.logger.info(`[DailyCheck] LIBERANDO PAGO (fallback por calificación) para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
                batch.update(doc.ref, {
                    paymentStatus: "liberado_al_proveedor",
                    fechaLiberacionPago: now, // Usar el timestamp actual del servidor
                    updatedAt: now,
                    habilitarCalificacion: false, // Desactivar si la ventana ya pasó (aunque calificarPrestador ya debería haberlo hecho)
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
  const providerId = context.auth.uid; // El ID del prestador se toma del usuario autenticado

  const { isAvailable, ubicacion } = data; // Renombrado de 'location' a 'ubicacion' para consistencia

  if (typeof isAvailable !== "boolean") {
    functions.logger.error("El parámetro 'isAvailable' debe ser un booleano.", { isAvailable });
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el parámetro 'isAvailable' (booleano).");
  }

  const providerRef = db.collection("prestadores").doc(providerId);
  const ubicacionPrestadorRef = db.collection("ubicacionesPrestadores").doc(providerId); // Referencia a la nueva colección
  
  const now = admin.firestore.Timestamp.now();
  const updatesPrestador: Partial<ProviderData> = { // Actualizaciones para la colección 'prestadores'
    isAvailable: isAvailable,
    lastConnection: now,
  };
  let updatesUbicacion: Partial<UbicacionPrestadorData> | null = null; // Actualizaciones para 'ubicacionesPrestadores'

  if (isAvailable === true) {
    if (!ubicacion || typeof ubicacion.lat !== "number" || typeof ubicacion.lng !== "number") {
      functions.logger.error("Si 'isAvailable' es true, se requiere un objeto 'ubicacion' con 'lat' y 'lng' numéricos.", { ubicacion });
      throw new functions.https.HttpsError("invalid-argument", "Se requiere 'ubicacion' con 'lat' y 'lng' válidos cuando 'isAvailable' es true.");
    }
    updatesPrestador.currentLocation = { // En el perfil principal del prestador
      lat: ubicacion.lat,
      lng: ubicacion.lng,
      timestamp: now, 
    };
    updatesUbicacion = { // En la colección dedicada 'ubicacionesPrestadores'
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        timestamp: now,
    };
  } else {
    updatesPrestador.currentLocation = null; // Borrar o poner a null en el perfil principal
    // Para 'ubicacionesPrestadores', podrías borrar el documento o marcarlo como inactivo.
    // Por simplicidad, si se desconecta, también podríamos poner su ubicación a null o mantener la última conocida.
    // Para este caso, si se desconecta, actualizaremos el timestamp pero mantendremos la última lat/lng.
    // Opcionalmente, se podría borrar el documento de 'ubicacionesPrestadores' o añadir un campo 'isActive'.
    // Por ahora, solo actualizamos el timestamp en 'ubicacionesPrestadores' si existe, o la creamos vacía.
    // Mejor: si se desconecta, no necesitamos actualizar 'ubicacionesPrestadores' activamente,
    // ya que el filtro en 'obtenerUbicacionesCercanas' revisará 'prestadores.isAvailable'.
  }

  try {
    const batch = db.batch();
    batch.set(providerRef, updatesPrestador, { merge: true }); // Actualiza o crea si no existe (merge)

    if (updatesUbicacion) { // Si está disponible y hay ubicación
        batch.set(ubicacionPrestadorRef, updatesUbicacion, { merge: true }); // Actualiza o crea
    } else if (!isAvailable) {
        // Si se está desconectando, podríamos optar por eliminar el documento de ubicación en tiempo real
        // O simplemente no actualizarlo y confiar en `prestadores.isAvailable` para los filtros
        // Por ahora, si se desconecta, no modificamos 'ubicacionesPrestadores' salvo que quieras borrarlo:
        // batch.delete(ubicacionPrestadorRef); // Descomentar si quieres borrarlo al desconectar
    }

    await batch.commit();
    
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
  const providerId = context.auth.uid; // El ID del prestador se toma del usuario autenticado

  const providerRef = db.collection("prestadores").doc(providerId);
  const ubicacionPrestadorRef = db.collection("ubicacionesPrestadores").doc(providerId);
  const now = admin.firestore.Timestamp.now();

  const updates: Partial<ProviderData> = {
    isAvailable: false,
    currentLocation: null, // Borrar o poner a null en el perfil principal
    lastConnection: now,
  };

  try {
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      // Si el prestador no tiene perfil, se podría crear uno básico
      functions.logger.warn(`Prestador ${providerId} no encontrado. Creando perfil básico y desconectando.`);
      // Es preferible que el perfil ya exista, pero como fallback:
      await providerRef.set({
        uid: providerId,
        name: context.auth.token.name || `Prestador ${providerId.substring(0,5)}`, // Usar nombre del token si está
        isAvailable: false,
        currentLocation: null,
        lastConnection: now,
        rating: 0, // Valores por defecto
        ratingCount: 0,
        ratingSum: 0,
        allowsHourlyServices: false, // Asumir por defecto
        // ... otros campos por defecto
      });
      // Opcionalmente, borrar el documento de 'ubicacionesPrestadores' si existiera
      // await ubicacionPrestadorRef.delete(); // Descomentar si es la lógica deseada
      return { success: true, message: "Perfil no encontrado, se creó y desconectó." };
    }

    const batch = db.batch();
    batch.update(providerRef, updates);
    // Opcionalmente, borrar el documento de 'ubicacionesPrestadores'
    // batch.delete(ubicacionPrestadorRef); // Descomentar si es la lógica deseada
    // O actualizarlo con un timestamp pero sin lat/lng activas:
    // batch.set(ubicacionPrestadorRef, { timestamp: now, lat: null, lng: null }, { merge: true });
    
    await batch.commit();

    functions.logger.info(`Prestador ${providerId} desconectado y ubicación borrada del perfil principal.`);
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
    "evaluarComportamientoPrestadorTrigger", "asignarIncentivoUsuarioTrigger",
    "sugerirPrestadoresInteligente", "mostrarServiciosDestacados",
    "revisarDocumentoPrestador", "gestionarContratoServicio", "crearSolicitudSoporte",
    "obtenerTraduccion", "actualizarUbicacionPrestador", "obtenerUbicacionesCercanas",
    "validarCoberturaServicio", "validarCoberturaYObtenerPrestadoresCercanos",
    "obtenerDetallesPrestadorParaPopup"
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";
    
    const esTrigger = nombreFuncion.endsWith("Trigger") || 
                      nombreFuncion === "simulateDailyAutomatedChecks" || 
                      nombreFuncion === "moderarMensajesChat";

    if (!presenteEnCodigo && !esTrigger && nombreFuncion !== "verificarEstadoFunciones") {
      todasLasFuncionesCriticasPresentes = false;
    }

    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada), 
      esPubSub: nombreFuncion === "simulateDailyAutomatedChecks", 
      esFirestoreTrigger: esTrigger, 
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
    ubicacion, // Objeto { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number }
    notasAdicionales,
    serviceType = 'fixed', // por defecto 'fixed' si no se especifica.
    precioServicio, // para fixed
    tarifaPorHora,  // para hourly
    duracionHoras,  // para hourly
  } = data;

  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !detallesServicio ) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos (prestadorId, fechaSolicitada, horaSolicitada, detallesServicio).");
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

  // Validación de formato de fecha y hora
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  const regexHora = /^\d{2}:\d{2}$/;

  if (!regexFecha.test(fechaSolicitada) || !regexHora.test(horaSolicitada)) {
    throw new functions.https.HttpsError("invalid-argument", "Formato de fecha (YYYY-MM-DD) u hora (HH:MM) inválido.");
  }

  let fechaHoraSolicitadaConvertida: admin.firestore.Timestamp;
  try {
    // Convertir YYYY-MM-DD HH:MM a objeto Date y luego a Timestamp de Firestore
    // Asumir que la hora es local al servidor de Firebase (usualmente UTC) o ajustar según sea necesario.
    const [year, month, day] = fechaSolicitada.split("-").map(Number);
    const [hour, minute] = horaSolicitada.split(":").map(Number);
    // Para UTC:
    const dateObject = new Date(Date.UTC(year, month - 1, day, hour, minute));
    // Si necesitas una zona horaria específica, deberías manejarla aquí o asumir que el cliente la envía en UTC.

    if (isNaN(dateObject.getTime())) {
      throw new Error("Fecha u hora inválida después de la conversión.");
    }
    // Verificar que la cita no sea en el pasado (considerando UTC del servidor)
    const nowUtc = new Date(new Date().toISOString().slice(0,-1)); // Hora actual en UTC
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
    // Verificar conflicto de horario (Requisito 5)
    const conflictoQuery = citasRef
      .where("prestadorId", "==", prestadorId)
      .where("fechaHoraSolicitada", "==", fechaHoraSolicitadaConvertida)
      // Considerar solo citas que no estén canceladas o rechazadas como conflicto
      .where("estado", "in", ["pendiente_confirmacion", "confirmada_prestador", "pagada", "servicio_iniciado", "en_camino_proveedor"]);

    const conflictoSnapshot = await conflictoQuery.get();
    if (!conflictoSnapshot.empty) {
      functions.logger.warn(`Conflicto de horario para prestador ${prestadorId} en ${fechaSolicitada} ${horaSolicitada}. Citas encontradas: ${conflictoSnapshot.size}`);
      throw new functions.https.HttpsError("failed-precondition", "El prestador ya tiene una cita agendada o confirmada en este horario. Por favor, elige otro.");
    }
    
    let montoTotalEstimado = 0;
    if (serviceType === 'fixed' && typeof precioServicio === 'number') {
        montoTotalEstimado = precioServicio;
    } else if (serviceType === 'hourly' && typeof tarifaPorHora === 'number' && typeof duracionHoras === 'number') {
        montoTotalEstimado = tarifaPorHora * duracionHoras;
    }


    // Crear el nuevo documento de cita
    const nuevaCitaData: Omit<CitaData, "id" | "updatedAt"> = { // Excluir id y updatedAt que se añaden automáticamente o por el sistema
      usuarioId: usuarioId,
      prestadorId: prestadorId,
      fechaHoraSolicitada: fechaHoraSolicitadaConvertida,
      detallesServicio: detallesServicio,
      estado: "pendiente_confirmacion", // Estado inicial
      fechaCreacion: admin.firestore.Timestamp.now(), // Timestamp de creación
      serviceType: serviceType as 'fixed' | 'hourly',
      // Campos opcionales
      ...(ubicacion && { ubicacion: ubicacion }),
      ...(notasAdicionales && { notasAdicionales: notasAdicionales }),
      // Campos específicos del tipo de servicio
      ...(serviceType === 'fixed' && { precioServicio: precioServicio }),
      ...(serviceType === 'hourly' && { tarifaPorHora: tarifaPorHora, duracionHoras: duracionHoras }),
      ...(montoTotalEstimado > 0 && { montoTotalEstimado: montoTotalEstimado }),

    };

    const citaRef = await citasRef.add(nuevaCitaData);
    functions.logger.info(`Cita agendada con ID: ${citaRef.id} por usuario ${usuarioId} para prestador ${prestadorId}. Estado: pendiente_confirmacion.`);

    // SIMULACIÓN: Notificar al prestador sobre la nueva solicitud de cita.
    // Aquí llamarías a `crearNotificacion`
    functions.logger.warn(`SIMULACIÓN: Notificar al prestador ${prestadorId} sobre la nueva solicitud de cita ${citaRef.id}.`);

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
  const canceladorIdAutenticado = context.auth.uid; // UID de quien llama a la función
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

      // Solo se pueden cancelar citas que estén pendientes de confirmación por el prestador
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
        // Esto no debería ocurrir si la validación de rol anterior es correcta
        throw new functions.https.HttpsError("internal", "Rol de cancelador inválido internamente.");
      }
      
      // Actualizar el documento de la cita
      const updateData: Partial<CitaData> & {updatedAt: admin.firestore.FieldValue } = { // Especificar tipo para updatedAt
        estado: nuevoEstado,
        fechaCancelacion: admin.firestore.Timestamp.now(), // Usar Timestamp en lugar de FieldValue
        canceladaPor: canceladorIdAutenticado,
        rolCancelador: rol as 'usuario' | 'prestador',
        updatedAt: admin.firestore.Timestamp.now(), // Usar Timestamp en lugar de FieldValue
      };
      transaction.update(citaRef, updateData);

      functions.logger.info(`Cita ${citaId} cancelada por ${rol} ${canceladorIdAutenticado}.`);
      // SIMULACIÓN: Notificar a la otra parte.
      functions.logger.warn(`SIMULACIÓN: Notificar al ${notificarA} ${idNotificado} sobre la cancelación de la cita ${citaId} por el ${rol}.`);
      // Aquí llamarías a `crearNotificacion`
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

      // Verificar que el prestador autenticado es el dueño de la cita
      if (citaData.prestadorId !== prestadorIdAutenticado) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para modificar esta cita. No corresponde a tu ID de prestador.");
      }

      // Verificar que la cita esté en estado "pendiente_confirmacion"
      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden ${accion} citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const updateData: Partial<CitaData> & { updatedAt: admin.firestore.Timestamp } = { // Especificar que updatedAt es Timestamp
        updatedAt: now,
      };
      let mensajeExito = "";
      let tipoNotificacionUsuario = "";
      let tituloNotificacionUsuario = "";
      let cuerpoNotificacionUsuario = "";


      if (accion === "confirmar") {
        updateData.estado = "confirmada_prestador";
        updateData.fechaConfirmacionPrestador = now;
        // Paso importante: Marcar el estado del pago como pendiente de cobro.
        // El cobro real se haría en una función separada o en un paso siguiente.
        updateData.paymentStatus = "pendiente_cobro";
        updateData.ordenCobroId = `sim_orden_${citaId}_${Date.now()}`; // ID de orden de cobro simulado
        mensajeExito = "Cita confirmada exitosamente. El cobro al usuario está pendiente.";

        tipoNotificacionUsuario = "cita_confirmada_prestador";
        tituloNotificacionUsuario = "¡Cita Confirmada!";
        cuerpoNotificacionUsuario = `El prestador ha confirmado tu cita para "${citaData.detallesServicio}" el ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()} a las ${citaData.fechaHoraSolicitada.toDate().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}. Se procesará el cobro.`;

        functions.logger.info(`Cita ${citaId} confirmada por prestador ${prestadorIdAutenticado}. Usuario a notificar: ${citaData.usuarioId}. PaymentStatus: pendiente_cobro.`);
      } else { // accion === "rechazar"
        updateData.estado = "rechazada_prestador";
        updateData.fechaRechazoPrestador = now;
        mensajeExito = "Cita rechazada exitosamente.";
        
        tipoNotificacionUsuario = "cita_rechazada_prestador";
        tituloNotificacionUsuario = "Cita Rechazada";
        cuerpoNotificacionUsuario = `Lamentablemente, el prestador ha rechazado tu cita para "${citaData.detallesServicio}" el ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()}.`;

        functions.logger.info(`Cita ${citaId} rechazada por prestador ${prestadorIdAutenticado}. Usuario a notificar: ${citaData.usuarioId}.`);
      }
      
      transaction.update(citaRef, updateData);
      
      // SIMULACIÓN: Notificar al usuario. En una app real, esto llamaría a crearNotificacion
      // Esta es una llamada simulada, crearNotificacion no es una función local de este scope
      // Debería ser una llamada a la Cloud Function 'crearNotificacion' si la tienes,
      // o manejar la lógica de creación de notificación aquí.
      // Por ahora, un log.
      functions.logger.warn(`SIMULACIÓN: Notificar al usuario ${citaData.usuarioId} sobre la ${accion} de la cita ${citaId}. Título: ${tituloNotificacionUsuario}, Cuerpo: ${cuerpoNotificacionUsuario}`);
      // Ejemplo de cómo se podría llamar si crearNotificacion fuera una función helper aquí mismo o importada:
      // await crearNotificacionInterna({
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

  // Podrías requerir un rol de admin/sistema para llamar a esta función si no es parte de otro flujo
  // o si la llamas directamente desde el cliente, asegurar la autenticación.
  if (!context.auth) { // Asumimos que el cliente (o una función de sistema) puede llamarla.
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

      // Verificar que la cita esté en estado 'confirmada_prestador' y 'paymentStatus' sea 'pendiente_cobro'
      if (citaData.estado !== "confirmada_prestador") {
        throw new functions.https.HttpsError("failed-precondition", `La cita no está en estado 'confirmada_prestador'. Estado actual: ${citaData.estado}.`);
      }
      // O permitir reintentos si falló
      if (citaData.paymentStatus !== "pendiente_cobro" && citaData.paymentStatus !== "fallido") {
        throw new functions.https.HttpsError("failed-precondition", `El estado del pago no es 'pendiente_cobro' o 'fallido'. Estado actual: ${citaData.paymentStatus}.`);
      }


      // Obtener el monto a cobrar del campo montoTotalEstimado
      const montoACobrar = citaData.montoTotalEstimado;
      if (typeof montoACobrar !== "number" || montoACobrar <= 0) {
        functions.logger.error(`Monto total estimado inválido para cita ${citaId}: ${montoACobrar}`);
        throw new functions.https.HttpsError("internal", "Monto total estimado inválido para la cita.");
      }

      // SIMULACIÓN DE INTERACCIÓN CON PASARELA DE PAGO (STRIPE, MERCADOPAGO, ETC.)
      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Iniciando cobro para cita ${citaId}, Usuario: ${citaData.usuarioId}, Orden ID: ${citaData.ordenCobroId}, Monto: ${montoACobrar}.`);
      
      // Simular éxito o fallo del pago
      const pagoExitosoSimulado = true; // Cambiar a false para simular fallo
      
      if (pagoExitosoSimulado) {
        transaction.update(citaRef, {
          estado: "pagada", // Nuevo estado para indicar que la cita está pagada
          paymentStatus: "procesado_exitosamente",
          fechaCobro: admin.firestore.Timestamp.now(),
          montoCobrado: montoACobrar, // Guardar el monto que se cobró
          updatedAt: admin.firestore.Timestamp.now(),
        });
        functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} procesado exitosamente.`);
        // SIMULACIÓN: Notificar a usuario y prestador.
        functions.logger.warn(`[ProcesarCobro] SIMULACIÓN: Notificar a usuario ${citaData.usuarioId} y prestador ${citaData.prestadorId} sobre pago exitoso para cita ${citaId}.`);
        return { success: true, message: `Cobro para la cita ${citaId} procesado exitosamente. El servicio está ahora en estado 'pagada'.` };
      } else {
        functions.logger.error(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} FALLIDO.`);
        transaction.update(citaRef, {
          paymentStatus: "fallido", // Marcar como fallido
          fechaCobro: admin.firestore.Timestamp.now(), // Registrar intento de cobro
          updatedAt: admin.firestore.Timestamp.now(),
        });
        // SIMULACIÓN: Notificar al usuario sobre el fallo.
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

  // Autenticación opcional, ya que esta función puede ser llamada por otras funciones de backend
  // if (!context.auth) {
  //   throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado o servicio.");
  // }

  const {
    destinatarioId,
    rolDestinatario, // 'usuario' o 'prestador'
    titulo,
    cuerpo,
    tipoNotificacion, // ej: 'cita_confirmada', 'nuevo_mensaje_chat', 'pago_recibido'
    prioridad,      // 'alta' o 'normal'
    datosAdicionales, // ej: { citaId: 'xyz123', chatId: 'abc789' }
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

  const nuevaNotificacionData: Partial<NotificacionData> & { fechaCreacion: admin.firestore.FieldValue } = { // Asegurar que fechaCreacion es del tipo correcto
    destinatarioId: destinatarioId,
    rolDestinatario: rolDestinatario as 'usuario' | 'prestador',
    titulo: titulo,
    cuerpo: cuerpo,
    estadoNotificacion: "pendiente", // Estado inicial
    tipoNotificacion: tipoNotificacion,
    prioridad: prioridadValida,
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp(), // Usar timestamp del servidor
    ...(datosAdicionales && { datosAdicionales: datosAdicionales }),
  };

  try {
    const notificacionRef = await db.collection("notificaciones").add(nuevaNotificacionData);
    functions.logger.info(`Notificación creada con ID: ${notificacionRef.id} para ${rolDestinatario} ${destinatarioId}`);
    
    // En un futuro, aquí podrías añadir lógica para enviar la notificación Push con FCM
    // o un correo electrónico, dependiendo de tipoNotificacion y las preferencias del usuario.

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

      // Verificar si la notificación ya fue procesada por este trigger para evitar bucles si se actualiza.
      if (notificacionData.triggerProcesadoEn || notificacionData.estadoNotificacion !== "pendiente") {
        functions.logger.log(`[Trigger] Notificación ${notificacionId} ya procesada o no está en estado 'pendiente', omitiendo. Estado actual: ${notificacionData.estadoNotificacion}.`);
        return null;
      }

      // SIMULACIÓN de envío de notificación Push/In-App
      // En una implementación real, aquí se usaría Firebase Cloud Messaging (FCM)
      // para enviar una notificación push al dispositivo del destinatario.
      // El payload de FCM contendría los datos de notificacionData.
      functions.logger.log(`[Trigger] SIMULACIÓN: Enviando notificación (ej. FCM) para ${notificacionId} a ${notificacionData.destinatarioId}. Título: ${notificacionData.titulo}`);
      
      // Marcar la notificación como procesada por el trigger para evitar reprocesamiento.
      // Podrías usar un estado más específico como 'fcm_enviado' si implementas FCM.
      try {
        await snapshot.ref.update({
          estadoNotificacion: 'procesada_por_trigger', // O un estado más específico
          triggerProcesadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`[Trigger] Notificación ${notificacionId} marcada como 'procesada_por_trigger'.`);
      } catch (error) {
        functions.logger.error(`[Trigger] Error al actualizar estado de notificación ${notificacionId}:`, error);
        // Considerar reintentos o manejo de errores más robusto aquí
      }

      return null; // Las funciones de trigger de Firestore deben devolver null, una promesa o un valor.
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

    // Condición para detectar la liberación automática
    const esLiberacionAutomatica =
      beforeData.estado === "completado_por_usuario" &&
      afterData.estado === "cerrado_automaticamente" &&
      beforeData.paymentStatus === "retenido_para_liberacion" &&
      afterData.paymentStatus === "liberado_al_proveedor" &&
      !afterData.calificacionUsuario; // Importante: verificar que no haya sido calificado,
                                       // ya que eso implicaría otro flujo de cierre.

    if (esLiberacionAutomatica) {
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Detectada liberación automática de pago para servicio ${servicioId}. Preparando notificaciones.`);

      const servicioDetalles = afterData.detallesServicio || "Servicio sin descripción detallada";
      // Determinar la fecha del servicio de manera más robusta
      let fechaServicioFormateada = "Fecha no especificada";
      if (afterData.fechaServicio) {
        fechaServicioFormateada = afterData.fechaServicio.toDate().toLocaleDateString("es-MX");
      } else if (afterData.fechaConfirmacion) { // O la fecha de confirmación del usuario si es más relevante
        fechaServicioFormateada = afterData.fechaConfirmacion.toDate().toLocaleDateString("es-MX");
      } else {
        fechaServicioFormateada = new Date(afterData.fechaSolicitud.toMillis()).toLocaleDateString("es-MX");
      }
      
      const montoLiberado = afterData.montoCobrado || (afterData as CitaData).montoTotalEstimado || 0; // Tomar el monto cobrado si existe

      // Notificación para el Usuario
      try {
        // Asumimos que crearNotificacion es ahora una función interna o importada
        // y no una función callable que llamaríamos desde aquí.
        // Para esta simulación, crearé un objeto y lo loguearé.
        const notifUsuario = { 
          destinatarioId: afterData.usuarioId,
          rolDestinatario: 'usuario',
          titulo: "Pago Liberado Automáticamente",
          cuerpo: `El pago para tu servicio "${servicioDetalles}" del ${fechaServicioFormateada} ha sido liberado automáticamente al prestador tras ${RATING_AND_DISPUTE_WINDOW_DAYS} días sin reclamos. Monto: $${montoLiberado.toFixed(2)}.`,
          tipoNotificacion: 'pago_liberado_auto_usuario',
          prioridad: 'normal',
          datosAdicionales: { servicioId: servicioId }
        };
        await db.collection("notificaciones").add(notifUsuario); // Crear la notificación directamente
        functions.logger.info(`[notificarLiberacionPagoAutomatica] Notificación de liberación automática enviada al usuario ${afterData.usuarioId} para servicio ${servicioId}.`);
      } catch (error) {
        functions.logger.error(`[notificarLiberacionPagoAutomatica] Error al enviar notificación al usuario ${afterData.usuarioId}:`, error);
      }

      // Notificación para el Prestador
      try {
        const notifPrestador = { 
          destinatarioId: afterData.prestadorId,
          rolDestinatario: 'prestador',
          titulo: "¡Pago Recibido!",
          cuerpo: `El pago por el servicio "${servicioDetalles}" del ${fechaServicioFormateada} ha sido liberado a tu cuenta. Monto: $${montoLiberado.toFixed(2)}.`,
          tipoNotificacion: 'pago_recibido_auto_prestador',
          prioridad: 'normal',
          datosAdicionales: { servicioId: servicioId }
        };
        await db.collection("notificaciones").add(notifPrestador); // Crear la notificación directamente
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
  const { destinatarioId, metadataAdicional } = data; // metadataAdicional podría ser { solicitudId: 'xxx' }

  if (!destinatarioId || typeof destinatarioId !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'destinatarioId'.");
  }
  if (iniciadorId === destinatarioId) {
    throw new functions.https.HttpsError("invalid-argument", "No puedes iniciar un chat contigo mismo.");
  }

  // Asegurar un orden consistente de participantes para que el ID del chat sea el mismo
  const participantesUids = [iniciadorId, destinatarioId].sort();
  // Un ID de chat simple basado en los UIDs de los participantes (esto no es lo ideal para Firestore IDs, pero sirve para la consulta)
  // const chatIdPropuesto = participantesUids.join('_'); // No usaremos esto como ID de documento, solo para la consulta

  const chatsRef = db.collection("chats");

  try {
    // Consultar si ya existe un chat entre estos dos participantes
    // Firestore no permite consultar por igualdad de arrays directamente de forma simple
    // si el orden importa. La solución común es almacenar los participantes en un orden fijo
    // o tener un campo que sea la concatenación ordenada de los UIDs.
    // Aquí, vamos a consultar por 'participantesUids' que contenga ambos UIDs.
    // Firestore array-contains-all es más eficiente si los arrays son idénticos.
    const q = chatsRef
      .where("participantesUids", "==", participantesUids) // Busca un array que sea exactamente igual (ordenado)
      .limit(1);
      
    const chatExistenteSnap = await q.get();

    if (!chatExistenteSnap.empty) {
      const chatExistenteDoc = chatExistenteSnap.docs[0];
      functions.logger.info(`Chat encontrado entre ${iniciadorId} y ${destinatarioId}. ID: ${chatExistenteDoc.id}`);
      // Podrías añadir lógica para reactivar un chat si está archivado.
      return { success: true, chatId: chatExistenteDoc.id, nuevo: false, message: "Chat encontrado." };
    }

    // Si no existe, crear uno nuevo
    functions.logger.info(`No se encontró chat. Creando nuevo chat entre ${iniciadorId} y ${destinatarioId}.`);
    
    // Idealmente, obtener nombres de participantes para 'participantesInfo'
    // const iniciadorProfile = await db.collection('usuariosOPrestadores').doc(iniciadorId).get(); // Ajustar colección
    // const destinatarioProfile = await db.collection('usuariosOPrestadores').doc(destinatarioId).get(); // Ajustar colección

    const nuevoChatData: Omit<ChatDataFirestore, "id" | "mensajes"> = { // Excluir 'id' y 'mensajes' de los datos iniciales
      participantesUids: participantesUids,
      // participantesInfo: { ... }, // Llenar si se obtienen los perfiles
      estadoChat: "activo",
      fechaCreacion: admin.firestore.Timestamp.now(), // Usar Timestamp.now()
      ultimaActualizacion: admin.firestore.Timestamp.now(), // Usar Timestamp.now()
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

  try {
    await db.runTransaction(async (transaction) => {
      const chatDoc = await transaction.get(chatRef);
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Chat con ID ${chatId} no encontrado.`);
      }
      const chatData = chatDoc.data() as ChatDataFirestore;

      // Verificar que el remitente sea parte del chat
      if (!chatData.participantesUids.includes(remitenteId)) {
        throw new functions.https.HttpsError("permission-denied", "No eres participante de este chat.");
      }
      // Verificar que el chat esté activo
      if (chatData.estadoChat !== "activo") {
        throw new functions.https.HttpsError("failed-precondition", `No se pueden enviar mensajes a un chat que no esté activo. Estado actual: ${chatData.estadoChat}`);
      }

      const nuevoMensaje: MensajeDataFirestore = {
        remitenteId: remitenteId,
        texto: texto, // El texto ya está en minúsculas si se procesó antes
        timestamp: admin.firestore.Timestamp.now(),
        leido: false, // Por defecto no leído para el destinatario
        // moderado y motivoBloqueo se manejarían por la función de moderación
      };

      // Identificar al destinatario para incrementar su contador de no leídos
      const destinatarioDelMensajeId = chatData.participantesUids.find(uid => uid !== remitenteId);
      
      const updates: Partial<ChatDataFirestore> & { ultimaActualizacion: admin.firestore.Timestamp } = { // Asegurar que ultimaActualizacion sea Timestamp
        // Usar FieldValue.arrayUnion para añadir el mensaje al array
        mensajes: admin.firestore.FieldValue.arrayUnion(nuevoMensaje) as any, // Cast a 'any' por limitación de tipos de FieldValue
        ultimaActualizacion: admin.firestore.Timestamp.now(),
        ultimoMensajeTexto: texto.substring(0, 100), // Snippet del último mensaje
        ultimoMensajeTimestamp: nuevoMensaje.timestamp,
        ultimoMensajeRemitenteId: remitenteId,
      };

      // Incrementar el contador de no leídos del destinatario
      if (destinatarioDelMensajeId) {
        updates.conteoNoLeido = {
          ...chatData.conteoNoLeido, // Mantener el conteo del remitente (o ponerlo a 0 si se quiere)
          [destinatarioDelMensajeId]: admin.firestore.FieldValue.increment(1) as any, // Cast a 'any'
        };
      }
      
      transaction.update(chatRef, updates);
    });

    functions.logger.info(`Mensaje enviado por ${remitenteId} al chat ${chatId}. Texto: "${texto.substring(0,30)}..." (pendiente de moderación si aplica)`);
    // La moderación se haría con un trigger de Firestore en la colección 'chats'
    // o en una subcolección de mensajes si se opta por esa estructura.

    return { success: true, message: "Mensaje enviado exitosamente." };
  } catch (error: any)
 {
    functions.logger.error(`Error al enviar mensaje al chat ${chatId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al enviar el mensaje.", error.message);
  }
});

exports.moderarMensajesChat = functions.firestore
    .document('chats/{chatId}') // Escucha actualizaciones en el documento del chat completo
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
        
        // Obtener el último mensaje añadido (el nuevo)
        const nuevoMensaje = afterData.mensajes[afterData.mensajes.length - 1];
        
        // Si el mensaje ya fue marcado como moderado, no hacer nada.
        if (nuevoMensaje.moderado === true) {
            functions.logger.log(`[ModerarChat ${chatId}] Mensaje ya marcado como moderado, omitiendo.`);
            return null;
        }

        const mensajeTexto = nuevoMensaje.texto || '';
        const mensajeIdSimulado = `${nuevoMensaje.timestamp.toMillis()}_${nuevoMensaje.remitenteId}`; // Para logging

        functions.logger.log(`[ModerarChat ${chatId}] Nuevo mensaje detectado (ID simulado ${mensajeIdSimulado}): "${mensajeTexto.substring(0,50)}..."`);

        // Mismas expresiones regulares de validateDocumentAndRemoveContactInfo
        const regexTelefono = /(\+?\d{1,3}[-.\s]?(\(?\d{1,4}\)?[-.\s]?)*\d{1,4}[-.\s]?\d{1,9})/;
        const regexEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i; // 'i' para case-insensitive
        // Lista de palabras clave de contacto (reusar la constante global)
        const regexPalabrasClaveContacto = new RegExp(PALABRAS_CLAVE_PROHIBIDAS_CONTACTO.map(kw => `\\b${kw}\\b`).join("|"), "i");


        let mensajeBloqueado = false;
        let motivo = "";

        if (regexTelefono.test(mensajeTexto)) {
            mensajeBloqueado = true;
            motivo = "Posible número de teléfono detectado.";
        } else if (regexEmail.test(mensajeTexto)) {
            mensajeBloqueado = true;
            motivo = "Posible correo electrónico detectado.";
        } else if (regexPalabrasClaveContacto.test(mensajeTexto.toLowerCase())) { // Convertir mensaje a minúsculas para comparar con palabras clave
            mensajeBloqueado = true;
            motivo = "Posible intento de compartir datos de contacto o enlaces externos.";
        }

        if (mensajeBloqueado) {
            functions.logger.warn(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) será MODERADO. Motivo: ${motivo}. Texto original: "${mensajeTexto}"`);
            
            // Crear una nueva copia del array de mensajes para modificar el último
            const mensajesActualizados = [...afterData.mensajes];
            mensajesActualizados[afterData.mensajes.length - 1] = {
                ...nuevoMensaje,
                texto: '[Mensaje bloqueado por el sistema]', // Reemplazar texto
                moderado: true,
                motivoBloqueo: motivo,
                textoOriginal: mensajeTexto, // Guardar el texto original para revisión manual si es necesario
            };

            try {
                // Actualizar el documento del chat con el mensaje modificado
                await db.collection('chats').doc(chatId).update({
                    mensajes: mensajesActualizados,
                    ultimoMensajeTexto: '[Mensaje bloqueado por el sistema]', // Actualizar el snippet del último mensaje
                });
                functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) actualizado por moderación.`);

                // Opcional: Notificar al remitente que su mensaje fue bloqueado
                // await crearNotificacion({
                //   destinatarioId: nuevoMensaje.remitenteId,
                //   rolDestinatario: 'usuario_o_prestador', // Necesitarías saber el rol del remitente
                //   titulo: "Mensaje Bloqueado",
                //   cuerpo: `Tu mensaje en el chat ha sido bloqueado por: ${motivo}.`,
                //   tipoNotificacion: 'mensaje_bloqueado',
                //   prioridad: 'alta',
                //   datosAdicionales: { chatId: chatId }
                // });

            } catch (updateError) {
                functions.logger.error(`[ModerarChat ${chatId}] Error al actualizar mensaje moderado:`, updateError);
            }
        } else {
            functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) pasó la moderación.`);
            // Si no se bloquea, no es necesario actualizar el documento aquí, ya que ya fue escrito por 'enviarMensaje'.
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

        // Si el estado CAMBIÓ a "rechazada_prestador"
        if (afterData.estado === "rechazada_prestador" && beforeData.estado !== "rechazada_prestador") {
            logMessage = `[EvaluarComportamiento ${citaId}] Cita rechazada por prestador ${prestadorId}.`;
            actualizacionPrestador.rechazosCount = admin.firestore.FieldValue.increment(1) as any;

            // Leer el perfil del prestador para obtener el conteo actual antes de decidir la penalización
            const prestadorDocSnap = await prestadorRef.get(); // Leer fuera de la transacción si solo se usa para lógica condicional
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevoRechazosCount = (prestadorDataActual?.rechazosCount || 0) + 1; // Contar el actual

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
        // Si el estado CAMBIÓ a "confirmada_prestador"
        else if (afterData.estado === "confirmada_prestador" && beforeData.estado !== "confirmada_prestador") {
            logMessage = `[EvaluarComportamiento ${citaId}] Cita confirmada por prestador ${prestadorId}.`;
            actualizacionPrestador.confirmacionesCount = admin.firestore.FieldValue.increment(1) as any;
            
            // Leer el perfil para el incentivo
            const prestadorDocSnap = await prestadorRef.get();
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevaConfirmacionesCount = (prestadorDataActual?.confirmacionesCount || 0) + 1;

            if (nuevaConfirmacionesCount > 0 && nuevaConfirmacionesCount % 5 === 0) { // Incentivo cada 5 confirmaciones
                if (!actualizacionPrestador.incentivos) actualizacionPrestador.incentivos = {};
                actualizacionPrestador.incentivos.puntosReputacion = admin.firestore.FieldValue.increment(10) as any;
                logMessage += ` Otorgando 10 puntos de reputación. Total puntos: ${(prestadorDataActual?.incentivos?.puntosReputacion || 0) + 10}.`;
            }
        }

        if (Object.keys(actualizacionPrestador).length > 0) {
            (actualizacionPrestador as any).updatedAt = admin.firestore.Timestamp.now(); // Añadir timestamp de actualización
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

        // Condición: la calificación del usuario acaba de ser añadida
        const ratingJustAdded = !beforeData.calificacionUsuario && !!afterData.calizacionUsuario;

        if (ratingJustAdded && afterData.usuarioId) {
            functions.logger.info(`[asignarIncentivoUsuarioTrigger] Calificación de usuario detectada para servicio ${servicioId} por usuario ${afterData.usuarioId}. Asignando incentivos.`);
            
            const usuarioRef = db.collection("usuarios").doc(afterData.usuarioId);

            try {
                await db.runTransaction(async (transaction) => {
                    const usuarioDoc = await transaction.get(usuarioRef);
                    let updates: Partial<UserData> = {};
                    let currentServiciosCalificados = 0;

                    if (usuarioDoc.exists) {
                        const usuarioData = usuarioDoc.data() as UserData;
                        currentServiciosCalificados = usuarioData.serviciosCalificadosCount || 0;
                        updates = {
                            serviciosCalificadosCount: admin.firestore.FieldValue.increment(1) as any,
                            puntosReputacionUsuario: admin.firestore.FieldValue.increment(5) as any, // Ej: 5 puntos por calificar
                        };

                        // Otorgar un badge si alcanza un hito
                        if ((currentServiciosCalificados + 1) % 5 === 0) { // Ej: cada 5 calificaciones
                            updates.badgesUsuario = admin.firestore.FieldValue.arrayUnion("calificador_bronce") as any; // O el nombre del badge
                            functions.logger.info(`[asignarIncentivoUsuarioTrigger] Usuario ${afterData.usuarioId} ganó badge 'calificador_bronce'.`);
                        }
                        // ... más lógica de badges ...

                    } else {
                        // Si el documento del usuario no existe, crearlo con los valores iniciales
                        updates = {
                            uid: afterData.usuarioId, // Importante añadir el UID
                            name: `Usuario ${afterData.usuarioId.substring(0,5)}`, // Nombre por defecto
                            serviciosCalificadosCount: 1,
                            puntosReputacionUsuario: 5,
                            badgesUsuario: [], // Inicializar array de badges
                            // ... otros campos por defecto para un nuevo usuario ...
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
                // Evitar re-ejecución si la calificación no cambió (ej. solo se actualizó otra parte del doc)
                functions.logger.log(`[asignarIncentivoUsuarioTrigger] La calificación de usuario no es nueva para servicio ${servicioId}.`);
            } else {
                 functions.logger.log(`[asignarIncentivoUsuarioTrigger] No se cumplen condiciones para incentivo en servicio ${servicioId}. RatingJustAdded: ${ratingJustAdded}, UsuarioId: ${afterData.usuarioId}`);
            }
        }
        return null;
    });

export const revisarDocumentoPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando revisarDocumentoPrestador", { structuredData: true, data });

  // Solo administradores o moderadores pueden ejecutar esta función
  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permiso para ejecutar esta función.");
  }

  const { documentoId, nuevoEstado, comentariosRevisor } = data; // ID del documento en la colección 'documentosPrestadores'

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

      // Aquí podrías añadir lógica para verificar si el documento ya fue revisado,
      // o si el estado actual permite esta transición.

      const updateData: Partial<DocumentoPrestadorData> = {
        estadoRevision: nuevoEstado as 'aprobado' | 'rechazado',
        fechaRevision: admin.firestore.Timestamp.now(), // Usar Timestamp
        revisadoPor: context.auth?.uid, // UID del admin/moderador
        ...(comentariosRevisor && { comentariosRevisor: comentariosRevisor }),
      };

      transaction.update(docRef, updateData);
      functions.logger.info(`Documento ${documentoId} del prestador ${docData.prestadorId} actualizado a estado: ${nuevoEstado} por admin ${context.auth?.uid}.`);

      // Opcional: Notificar al prestador sobre el estado de su documento
      // await crearNotificacion(...)
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


export const sugerirPrestadoresInteligente = functions.https.onCall(async (data: SugerirPrestadoresInput, context) => {
  functions.logger.info("Iniciando sugerirPrestadoresInteligente", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  // const usuarioId = context.auth.uid; // Podría usarse para obtener historial real

  const {
    categoriaId,
    ubicacionUsuario,
    // descripcionServicio, // Para futura IA
    preferenciasUsuario, // Para futura IA o lógica de historial
    maxResultados = 10,
    distanciaMaximaKm = 50, // Distancia máxima por defecto
    disponibilidad = 'todos', // 'disponibles_ahora' o 'todos'
    calificacionMinima,
    precioMaximo,
    ordenarPor = 'calificacion_desc', // 'calificacion_desc', 'precio_asc', 'precio_desc'
  } = data;

  if (!categoriaId || !ubicacionUsuario || typeof ubicacionUsuario.lat !== 'number' || typeof ubicacionUsuario.lng !== 'number') {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'categoriaId' y 'ubicacionUsuario' (con lat y lng válidos).");
  }

  // Pesos para el algoritmo de puntuación (ajustar según importancia)
  const WEIGHTS = { 
    rating: 0.4,
    distance: 0.3,
    availability: 0.15,
    reviewCount: 0.1,
    preference: 0.05, // Placeholder para preferencias del usuario
  };


  try {
    let query: admin.firestore.Query = db.collection("prestadores");

    // Aplicar filtros que Firestore maneja bien directamente
    if (disponibilidad === 'disponibles_ahora') {
        query = query.where("isAvailable", "==", true);
    }
    if (calificacionMinima && typeof calificacionMinima === 'number') {
        query = query.where("rating", ">=", calificacionMinima);
    }
    // Firestore limita las queries compuestas. Si tienes un filtro de rango en un campo (ej. rating >= X),
    // tu primer `orderBy` debe ser sobre ese mismo campo.
    // Si se ordena por precio, el filtro de precio se aplicará en código después.
    if (ordenarPor === 'calificacion_desc' && !calificacionMinima) { // Solo si no hay ya un filtro de rango en rating
        query = query.orderBy("rating", "desc");
    }


    const prestadoresSnapshot = await query.get();
    let todosLosPrestadores = prestadoresSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProviderData & {id: string} ));
    functions.logger.info(`[Sugerir] Total prestadores leídos de Firestore (pre-filtro código): ${todosLosPrestadores.length}`);

    // Aplicar filtros en código (distancia, categoría, precio)
    let prestadoresFiltrados = todosLosPrestadores.filter((p) => {
      // Filtro de distancia
      if (p.currentLocation && typeof p.currentLocation.lat === 'number' && typeof p.currentLocation.lng === 'number') {
        const distancia = calculateDistance(ubicacionUsuario.lat, ubicacionUsuario.lng, p.currentLocation.lat, p.currentLocation.lng);
        (p as any).distanciaKmCalculada = parseFloat(distancia.toFixed(1)); 
        if (distancia > distanciaMaximaKm) return false;
      } else {
         // Si el proveedor no tiene ubicación o no es válida, y se especificó distanciaMaximaKm, se excluye.
        if (distanciaMaximaKm) return false;
      }
      
      // Filtro de categoría (si no es 'all')
      if (categoriaId !== 'all') { // Asumiendo 'all' como valor para no filtrar por categoría
        const ofreceCategoria = p.services?.some((s: ServiceDataFirebase) => s.categoria === categoriaId);
        if (!ofreceCategoria) return false;
      }
      
      // Filtro de precio máximo
      if (precioMaximo && typeof precioMaximo === 'number') {
          let tieneServicioEnPrecio = false;
          // Verificar servicios de precio fijo
          if (p.services?.some(s => s.price <= precioMaximo && (categoriaId === 'all' || s.categoria === categoriaId))) {
              tieneServicioEnPrecio = true;
              (p as any).sortPrice = p.services.filter(s => s.price <= precioMaximo && (categoriaId === 'all' || s.categoria === categoriaId)).reduce((min, serv) => Math.min(min, serv.price), Infinity);
          }
          // Verificar tarifa por hora
          if (!tieneServicioEnPrecio && p.allowsHourlyServices && p.hourlyRate && p.hourlyRate <= precioMaximo) {
              // Asumimos que si permite por hora, y pasa el filtro de categoría, es una opción
              if (categoriaId === 'all' || p.services?.some(s => s.categoria === categoriaId)) { // O una lógica más compleja
                 tieneServicioEnPrecio = true;
                 (p as any).sortPrice = Math.min((p as any).sortPrice || Infinity, p.hourlyRate);
              }
          }
          if (!tieneServicioEnPrecio) return false;
      }
      return true;
    });
    functions.logger.info(`[Sugerir] Prestadores tras filtros en código (distancia, categoría, precioMax): ${prestadoresFiltrados.length}`);

    // Simulación de historial de usuario (para el boost de preferencia)
    const historialCategoriasUsuario = preferenciasUsuario?.historialCategorias || [];


    const prestadoresPuntuados = prestadoresFiltrados.map((p) => {
      let score = 0;
      const pTyped = p as any; 

      const ratingScore = (p.rating || 0) * WEIGHTS.rating; 
      // Normalizar distancia: más cerca = mejor. Evitar división por cero.
      const effectiveDistance = Math.max(0.1, pTyped.distanciaKmCalculada || distanciaMaximaKm); 
      const distanceScore = (1 / effectiveDistance) * distanciaMaximaKm * WEIGHTS.distance; // Ponderar
      
      const availabilityScore = (p.isAvailable ? 1 : 0) * WEIGHTS.availability;
      const reviewCountScore = Math.log1p(p.ratingCount || 0) * WEIGHTS.reviewCount; // log1p para manejar 0 reviews

      let preferenceBoost = 0;
      if (p.services?.some((s: ServiceDataFirebase) => historialCategoriasUsuario.includes(s.categoria || ""))) {
        preferenceBoost = 0.5; // Pequeño boost por preferencia de categoría
      }
      // Futuro: Añadir boost por `prestadoresFavoritos` y penalización por `prestadoresEvitados`
      const preferenceScore = preferenceBoost * WEIGHTS.preference;

      score = ratingScore + distanceScore + availabilityScore + reviewCountScore + preferenceScore;
      
      // Para ordenar por precio, calculamos un precio representativo si no se hizo antes
      if (!(p as any).sortPrice && (ordenarPor === 'precio_asc' || ordenarPor === 'precio_desc')) {
          let representativePrice = Infinity;
          const servicePrices = p.services?.filter(s => (categoriaId === 'all' || s.categoria === categoriaId) && typeof s.price === 'number').map(s => s.price as number) || [];
          if (p.allowsHourlyServices && p.hourlyRate) {
              servicePrices.push(p.hourlyRate);
          }
          if (servicePrices.length > 0) {
              representativePrice = Math.min(...servicePrices);
          }
          (p as any).sortPrice = representativePrice;
      }


      functions.logger.debug(`[Sugerir] Prestador ${p.uid} (${p.name}): Dist ${pTyped.distanciaKmCalculada?.toFixed(1)}km, Rating ${p.rating}, Disp ${p.isAvailable}, Revs ${p.ratingCount}. Scores: rating=${ratingScore.toFixed(2)}, dist=${distanceScore.toFixed(2)}, avail=${availabilityScore.toFixed(2)}, revs=${reviewCountScore.toFixed(2)}, pref=${preferenceScore.toFixed(2)}. TOTAL SCORE: ${score.toFixed(2)}, SortPrice: ${(p as any).sortPrice}`);
      return { ...p, finalScore: score, sortPriceCalculated: (p as any).sortPrice };
    });

    // Ordenamiento final
    if (ordenarPor === 'precio_asc') {
        prestadoresPuntuados.sort((a, b) => (a.sortPriceCalculated === Infinity ? 1 : (b.sortPriceCalculated === Infinity ? -1 : (a.sortPriceCalculated || Infinity) - (b.sortPriceCalculated || Infinity)) ));
    } else if (ordenarPor === 'precio_desc') {
        prestadoresPuntuados.sort((a, b) => (a.sortPriceCalculated === Infinity ? 1 : (b.sortPriceCalculated === Infinity ? -1 : (b.sortPriceCalculated || -Infinity) - (a.sortPriceCalculated || -Infinity)) ));
    } else { // Por defecto, o 'calificacion_desc'
        prestadoresPuntuados.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    }


    const resultadosFinales = prestadoresPuntuados
      .slice(0, maxResultados)
      .map((p): PrestadorSugerido => ({ 
        prestadorId: p.uid || '',
        nombre: p.name || "Nombre no disponible",
        rating: p.rating || 0,
        ratingCount: p.ratingCount || 0,
        distanciaKm: (p as any).distanciaKmCalculada,
        isAvailable: p.isAvailable || false,
        especialidades: p.specialties, // Asumiendo que specialties ya está en ProviderData
        score: parseFloat((p.finalScore || 0).toFixed(2)),
        avatarUrl: p.avatarUrl,
        sortPrice: p.sortPriceCalculated === Infinity || p.sortPriceCalculated === -Infinity ? undefined : p.sortPriceCalculated,
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

  const now = admin.firestore.Timestamp.now();

  // Interfaz para los datos que se envían al cliente
  interface ServicioDestacadoCliente { 
        id: string; // ID del documento de servicioDestacado
        servicioId: string;
        prestadorId: string;
        descripcionPromocional: string;
        fechaInicio: string; // ISO string
        fechaFin: string;   // ISO string
        prioridad?: number;
        urlImagenPromocional?: string;
        urlVideoPromocional?: string;
    }

  try {
    let query = db.collection("serviciosDestacados")
      .where("fechaInicio", "<=", now)
      .where("fechaFin", ">=", now);

    // Ordenar por prioridad (si existe) y luego por fecha de inicio
    query = query.orderBy("prioridad", "asc").orderBy("fechaInicio", "desc");

    const snapshot = await query.get();
    const destacados: ServicioDestacadoCliente[] = []; 
    snapshot.forEach((doc) => {
      const docData = doc.data() as ServicioDestacadoData; // Usar la interfaz del backend
      destacados.push({
        id: doc.id,
        servicioId: docData.servicioId,
        prestadorId: docData.prestadorId,
        descripcionPromocional: docData.descripcionPromocional,
        fechaInicio: docData.fechaInicio.toDate().toISOString(), // Convertir a ISO string para el cliente
        fechaFin: docData.fechaFin.toDate().toISOString(),     // Convertir a ISO string para el cliente
        prioridad: docData.prioridad,
        urlImagenPromocional: docData.urlImagenPromocional,
        urlVideoPromocional: docData.urlVideoPromocional,
      });
    });

    functions.logger.info(`Encontrados ${destacados.length} servicios destacados activos.`);
    return destacados;
  } catch (error: any) {
    functions.logger.error("Error al obtener servicios destacados:", error);
    throw new functions.https.HttpsError("internal", "No se pudieron obtener los servicios destacados.", error.message);
  }
});


export const gestionarContratoServicio = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando gestionarContratoServicio", { structuredData: true, data, auth: context.auth?.uid });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const actorId = context.auth.uid;
  const { accion, referenciaId, tipoReferencia, contratoId } = data; // tipoReferencia: 'servicio' o 'cita'

  if (!accion) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere una 'accion' (crear, aceptar, rechazar).");
  }

  // Función auxiliar para generar el texto del contrato
  const generarTextoContratoSimulado = (
        tipoRef: 'servicio' | 'cita',
        refData: ServiceData | CitaData, // Usar los tipos de datos de Firestore
        usuarioNombreSimulado: string,
        prestadorNombreSimulado: string
    ): string => {
        let detalles = "";
        let fechaHoraServicio = new Date(); // Fecha por defecto si no se encuentra
        let monto = 0;

        if (tipoRef === 'servicio' && (refData as ServiceData).detallesServicio) {
            const servicio = refData as ServiceData;
            detalles = servicio.detallesServicio || "Servicio general";
            if (servicio.fechaServicio) fechaHoraServicio = servicio.fechaServicio.toDate();
            monto = servicio.precio || 0;
        } else if (tipoRef === 'cita' && (refData as CitaData).detallesServicio) {
            const cita = refData as CitaData;
            detalles = cita.detallesServicio;
            if (cita.fechaHoraSolicitada) fechaHoraServicio = cita.fechaHoraSolicitada.toDate();
            monto = cita.montoTotalEstimado || 0;
        }

        const fechaFormateada = fechaHoraServicio.toLocaleDateString('es-MX');
        const horaFormateada = fechaHoraServicio.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        return `CONTRATO DE PRESTACIÓN DE SERVICIOS
        --------------------------------------
        Fecha de Contrato: ${new Date().toLocaleDateString('es-MX')}
        
        PARTES:
        Usuario: ${usuarioNombreSimulado} (ID: ${refData.usuarioId})
        Prestador: ${prestadorNombreSimulado} (ID: ${refData.prestadorId})
        
        SERVICIO ACORDADO:
        Descripción: ${detalles}
        Referencia ID (${tipoRef}): ${referenciaId}
        Fecha Programada: ${fechaFormateada} a las ${horaFormateada}
        Monto Acordado: $${monto.toFixed(2)} MXN
        
        TÉRMINOS Y CONDICIONES:
        1. El prestador se compromete a realizar el servicio según lo acordado.
        2. El usuario se compromete a realizar el pago según los términos de la plataforma ServiMap.
        3. Ambas partes aceptan los términos de uso y políticas de privacidad de ServiMap.
        4. Este contrato se considera aceptado una vez que ambas partes lo confirmen en la plataforma.
        --------------------------------------
        ServiMap - Conectando Necesidades con Soluciones`;
    };


  if (accion === 'crear') {
    if (!referenciaId || !tipoReferencia) {
      throw new functions.https.HttpsError("invalid-argument", "Para 'crear', se requieren 'referenciaId' y 'tipoReferencia'.");
    }
    if (tipoReferencia !== 'servicio' && tipoReferencia !== 'cita') {
        throw new functions.https.HttpsError("invalid-argument", "'tipoReferencia' debe ser 'servicio' o 'cita'.");
    }

    try {
      const refCollection = tipoReferencia === 'servicio' ? "servicios" : "citas";
      const refDoc = await db.collection(refCollection).doc(referenciaId).get();

      if (!refDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Documento de referencia ${tipoReferencia} con ID ${referenciaId} no encontrado.`);
      }
      const refData = refDoc.data() as ServiceData | CitaData; // Tipado más específico
      
      // Simular nombres (en real, se obtendrían de perfiles)
      const usuarioNombreSimulado = `Usuario ${refData.usuarioId.substring(0,5)}`;
      const prestadorNombreSimulado = `Prestador ${refData.prestadorId.substring(0,5)}`;

      const textoContrato = generarTextoContratoSimulado(tipoReferencia, refData, usuarioNombreSimulado, prestadorNombreSimulado);

      const nuevoContratoData: Omit<ContratoServicioData, "id"> = { // Excluir 'id'
        referenciaId: referenciaId,
        tipoReferencia: tipoReferencia,
        usuarioId: refData.usuarioId,
        prestadorId: refData.prestadorId,
        fechaCreacionContrato: admin.firestore.Timestamp.now(), // Usar Timestamp
        textoContrato: textoContrato,
        estadoContrato: 'pendiente_aceptacion_usuario',
        infoServicioOriginal: { // Guardar un snapshot de la info relevante
            detalles: (refData as any).detallesServicio || (refData as any).descripcion, // Ajustar según el tipo
            fechaHora: (refData as any).fechaServicio || (refData as any).fechaHoraSolicitada,
            monto: (refData as any).precio || (refData as any).montoTotalEstimado,
            // ubicacion: (refData as any).ubicacion, // Si es necesario
        },
        updatedAt: admin.firestore.Timestamp.now(), // Usar Timestamp
      };

      const contratoRef = await db.collection("contratosServicios").add(nuevoContratoData);
      functions.logger.info(`Contrato creado con ID: ${contratoRef.id} para ${tipoReferencia} ${referenciaId}.`);
      return { success: true, message: "Contrato generado, pendiente de aceptación del usuario.", contratoId: contratoRef.id };

    } catch (error: any) {
      functions.logger.error("Error al crear contrato:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", "Error al generar el contrato.", error.message);
    }

  } else if (accion === 'aceptar' || accion === 'rechazar') {
    if (!contratoId) {
      throw new functions.https.HttpsError("invalid-argument", "Para 'aceptar' o 'rechazar', se requiere 'contratoId'.");
    }
    const contratoRef = db.collection("contratosServicios").doc(contratoId);

    try {
      return await db.runTransaction(async (transaction) => {
        const contratoDoc = await transaction.get(contratoRef);
        if (!contratoDoc.exists) {
          throw new functions.https.HttpsError("not-found", `Contrato con ID ${contratoId} no encontrado.`);
        }
        const contratoData = contratoDoc.data() as ContratoServicioData;
        let nuevoEstado: EstadoContrato = contratoData.estadoContrato;
        const updates: Partial<ContratoServicioData> & { updatedAt: admin.firestore.Timestamp } = { // Usar Timestamp
            updatedAt: admin.firestore.Timestamp.now() 
        };

        if (accion === 'aceptar') {
          if (actorId === contratoData.usuarioId && contratoData.estadoContrato === 'pendiente_aceptacion_usuario') {
            nuevoEstado = 'pendiente_aceptacion_prestador';
            updates.fechaAceptacionUsuario = admin.firestore.Timestamp.now();
          } else if (actorId === contratoData.prestadorId && contratoData.estadoContrato === 'pendiente_aceptacion_prestador') {
            nuevoEstado = 'aceptado_ambos';
            updates.fechaAceptacionPrestador = admin.firestore.Timestamp.now();
          } else {
            throw new functions.https.HttpsError("failed-precondition", `No se puede aceptar el contrato en su estado actual (${contratoData.estadoContrato}) o no eres la parte correspondiente.`);
          }
        } else { // accion === 'rechazar'
          if (actorId === contratoData.usuarioId && (contratoData.estadoContrato === 'pendiente_aceptacion_usuario' || contratoData.estadoContrato === 'pendiente_aceptacion_prestador')) {
            nuevoEstado = 'rechazado_usuario';
            updates.fechaRechazoUsuario = admin.firestore.Timestamp.now();
          } else if (actorId === contratoData.prestadorId && contratoData.estadoContrato === 'pendiente_aceptacion_prestador') {
            nuevoEstado = 'rechazado_prestador';
            updates.fechaRechazoPrestador = admin.firestore.Timestamp.now();
          } else {
            throw new functions.https.HttpsError("failed-precondition", `No se puede rechazar el contrato en su estado actual (${contratoData.estadoContrato}) o no eres la parte correspondiente.`);
          }
        }
        updates.estadoContrato = nuevoEstado;
        transaction.update(contratoRef, updates);
        functions.logger.info(`Contrato ${contratoId} actualizado a estado '${nuevoEstado}' por ${actorId}.`);
        // Aquí podrías añadir lógica para notificar a la otra parte.
        return { success: true, message: `Contrato ${accion === 'aceptar' ? 'aceptado' : 'rechazado'} exitosamente. Nuevo estado: ${nuevoEstado}` };
      });
    } catch (error: any) {
      functions.logger.error(`Error al ${accion} contrato ${contratoId}:`, error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", `Error al ${accion} el contrato.`, error.message);
    }
  } else {
    throw new functions.https.HttpsError("invalid-argument", "Acción no válida. Debe ser 'crear', 'aceptar' o 'rechazar'.");
  }
});

export const crearSolicitudSoporte = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando crearSolicitudSoporte", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const solicitanteId = context.auth.uid;

  const { tipoSoporte, mensaje, rolSolicitante, referenciaId, prioridadTicket, adjuntosUrls } = data;

  if (!tipoSoporte || typeof tipoSoporte !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'tipoSoporte' es requerido y debe ser un string.");
  }
  if (!mensaje || typeof mensaje !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'mensaje' es requerido y debe ser un string.");
  }
  if (!rolSolicitante || (rolSolicitante !== 'usuario' && rolSolicitante !== 'prestador')) {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'rolSolicitante' es requerido y debe ser 'usuario' o 'prestador'.");
  }

  const now = admin.firestore.Timestamp.now();
  const nuevaSolicitudData: Omit<SoporteTicketData, "id"> = { // Excluir 'id' que se genera automáticamente
    solicitanteId: solicitanteId,
    rolSolicitante: rolSolicitante as 'usuario' | 'prestador',
    tipoSoporte: tipoSoporte,
    mensaje: mensaje, // Este será el primer mensaje en el historial
    estadoSolicitud: "pendiente",
    fechaCreacion: now,
    ...(referenciaId && { referenciaId: referenciaId as string }),
    ...(prioridadTicket && { prioridadTicket: prioridadTicket as SoporteTicketData['prioridadTicket'] }),
    ...(adjuntosUrls && Array.isArray(adjuntosUrls) && { adjuntosUrls: adjuntosUrls as string[] }),
    historialConversacion: [{ // Iniciar historial con el primer mensaje
        remitenteId: solicitanteId,
        mensaje: mensaje,
        timestamp: now,
    }]
    // `asignadoA`, `respuestaSoporte`, etc., se llenarán por el equipo de soporte.
  };

  try {
    const solicitudRef = await db.collection("soporte").add(nuevaSolicitudData);
    functions.logger.info(`Nueva solicitud de soporte creada con ID: ${solicitudRef.id} por ${solicitanteId}`);

    // SIMULACIÓN: Notificar al equipo de soporte sobre el nuevo ticket.
    functions.logger.warn(`SIMULACIÓN: Notificar al equipo de soporte sobre el nuevo ticket ${solicitudRef.id}.`);

    return {
      success: true,
      message: "Tu solicitud de soporte ha sido enviada. Nuestro equipo te contactará pronto.",
      ticketId: solicitudRef.id,
    };
  } catch (error: any) {
    functions.logger.error("Error al crear la solicitud de soporte en Firestore:", error);
    throw new functions.https.HttpsError("internal", "No se pudo registrar tu solicitud de soporte.", error.message);
  }
});

export const obtenerTraduccion = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando obtenerTraduccion", { structuredData: true, data });

  const { claveUnica, idiomaSolicitado } = data;

  if (!claveUnica || typeof claveUnica !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'claveUnica' (string).");
  }
  if (!idiomaSolicitado || typeof idiomaSolicitado !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'idiomaSolicitado' (string, ej: 'en', 'es').");
  }

  const DEFAULT_LANGUAGE = 'es'; // Idioma por defecto

  try {
    const traduccionRef = db.collection("traducciones").doc(claveUnica);
    const docSnap = await traduccionRef.get();

    if (!docSnap.exists) {
      functions.logger.warn(`[obtenerTraduccion] No se encontró traducción para la clave: ${claveUnica}`);
      return { traduccion: claveUnica, idiomaDevuelto: null, mensaje: "Clave de traducción no encontrada." };
    }

    const traduccionData = docSnap.data() as TraduccionDataFirestore;
    let textoTraducido = traduccionData[idiomaSolicitado.toLowerCase()];
    let idiomaDevuelto = idiomaSolicitado.toLowerCase();

    if (typeof textoTraducido === 'string' && textoTraducido.trim() !== '') {
      functions.logger.info(`[obtenerTraduccion] Traducción encontrada para ${claveUnica} en ${idiomaSolicitado}: "${textoTraducido}"`);
      return { traduccion: textoTraducido, idiomaDevuelto: idiomaDevuelto, mensaje: "Traducción obtenida." };
    }

    // Si no se encuentra en el idioma solicitado, intentar el idioma por defecto
    functions.logger.warn(`[obtenerTraduccion] No se encontró traducción para ${claveUnica} en ${idiomaSolicitado}. Intentando idioma por defecto (${DEFAULT_LANGUAGE}).`);
    textoTraducido = traduccionData[DEFAULT_LANGUAGE];
    idiomaDevuelto = DEFAULT_LANGUAGE;

    if (typeof textoTraducido === 'string' && textoTraducido.trim() !== '') {
      functions.logger.info(`[obtenerTraduccion] Traducción de respaldo encontrada para ${claveUnica} en ${DEFAULT_LANGUAGE}: "${textoTraducido}"`);
      return { traduccion: textoTraducido, idiomaDevuelto: idiomaDevuelto, mensaje: "Traducción obtenida en idioma por defecto." };
    }

    // Si tampoco se encuentra en el idioma por defecto, devolver la clave original
    functions.logger.warn(`[obtenerTraduccion] No se encontró traducción adecuada ni de respaldo para la clave: ${claveUnica}. Devolviendo clave.`);
    return { traduccion: claveUnica, idiomaDevuelto: null, mensaje: "No se encontró traducción adecuada en el documento." };

  } catch (error: any) {
    functions.logger.error("[obtenerTraduccion] Error al obtener la traducción:", error);
    throw new functions.https.HttpsError("internal", "Error al obtener la traducción.", error.message);
  }
});


export const actualizarUbicacionPrestador = functions.https.onCall(async (data, context) => {
    functions.logger.info("Iniciando actualizarUbicacionPrestador", { structuredData: true, data });

    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un prestador autenticado.");
    }
    const prestadorId = context.auth.uid;
    const { lat, lng } = data;

    if (typeof lat !== "number" || typeof lng !== "number") {
        throw new functions.https.HttpsError("invalid-argument", "Se requieren 'lat' y 'lng' numéricos.");
    }

    const ubicacionData: UbicacionPrestadorData = {
        lat: lat,
        lng: lng,
        timestamp: admin.firestore.Timestamp.now(),
    };

    const prestadorRef = db.collection("prestadores").doc(prestadorId);
    const ubicacionRef = db.collection("ubicacionesPrestadores").doc(prestadorId);

    try {
        const batch = db.batch();
        // Actualizar la colección dedicada 'ubicacionesPrestadores'
        batch.set(ubicacionRef, ubicacionData, { merge: true }); 

        // Actualizar también el perfil principal del prestador
        batch.update(prestadorRef, {
            "currentLocation": ubicacionData, // Guarda el objeto completo
            "isAvailable": true, // Asumimos que si actualiza ubicación, está disponible
            "lastConnection": ubicacionData.timestamp,
        });

        await batch.commit();
        functions.logger.info(`Ubicación de prestador ${prestadorId} actualizada a lat: ${lat}, lng: ${lng}`);
        return { success: true, message: "Ubicación actualizada correctamente." };
    } catch (error: any) {
        functions.logger.error(`Error al actualizar ubicación para prestador ${prestadorId}:`, error);
        // Verificar si el documento del prestador existe, si no, podría ser un error de "not-found"
        const prestadorDoc = await prestadorRef.get();
        if (!prestadorDoc.exists) {
             throw new functions.https.HttpsError("not-found", `Perfil del prestador ${prestadorId} no encontrado. No se pudo actualizar la ubicación.`);
        }
        throw new functions.https.HttpsError("internal", "Error al actualizar la ubicación.", error.message);
    }
});

export const obtenerUbicacionesCercanas = functions.https.onCall(async (data, context) => {
    functions.logger.info("Iniciando obtenerUbicacionesCercanas", { structuredData: true, data });
    const { usuarioLat, usuarioLng, radioKm } = data;

    if (typeof usuarioLat !== "number" || typeof usuarioLng !== "number" || typeof radioKm !== "number" || radioKm <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Se requieren 'usuarioLat', 'usuarioLng' y 'radioKm' (positivo) válidos.");
    }

    try {
        const ubicacionesSnapshot = await db.collection("ubicacionesPrestadores").get();
        const prestadoresCercanosPromesas = ubicacionesSnapshot.docs.map(async (doc) => {
            const ubicacionData = doc.data() as UbicacionPrestadorData;
            const prestadorId = doc.id;

            const distancia = calculateDistance(usuarioLat, usuarioLng, ubicacionData.lat, ubicacionData.lng);

            if (distancia <= radioKm) {
                const prestadorRef = db.collection("prestadores").doc(prestadorId);
                const prestadorDoc = await prestadorRef.get();
                if (prestadorDoc.exists) {
                    const prestadorData = prestadorDoc.data() as ProviderData;
                    // Solo considerar prestadores que estén actualmente disponibles
                    if (prestadorData.isAvailable) {
                        return {
                            id: prestadorId,
                            nombre: prestadorData.name,
                            rating: prestadorData.rating,
                            lat: ubicacionData.lat,
                            lng: ubicacionData.lng,
                            distanciaKm: parseFloat(distancia.toFixed(1)),
                            // Puedes añadir más campos del perfil del prestador si son necesarios
                            // por ejemplo, categoría principal, avatarUrl, etc.
                            categoriaPrincipal: prestadorData.services?.[0]?.category,
                            avatarUrl: prestadorData.avatarUrl,
                            isAvailable: prestadorData.isAvailable,
                        };
                    }
                }
            }
            return null; // Si está fuera de radio, no disponible, o no se encuentra el perfil
        });

        const prestadoresCercanosConNulos = await Promise.all(prestadoresCercanosPromesas);
        const prestadoresFiltrados = prestadoresCercanosConNulos.filter(p => p !== null) as any[]; // Filtrar nulos

        // Ordenar: primero por cercanía, luego por calificación descendente
        prestadoresFiltrados.sort((a, b) => {
            if (a.distanciaKm < b.distanciaKm) return -1;
            if (a.distanciaKm > b.distanciaKm) return 1;
            // Si la distancia es igual, ordenar por rating
            if ((a.rating || 0) > (b.rating || 0)) return -1;
            if ((a.rating || 0) < (b.rating || 0)) return 1;
            return 0;
        });

        functions.logger.info(`Encontrados ${prestadoresFiltrados.length} prestadores dentro de ${radioKm}km.`);
        return prestadoresFiltrados;

    } catch (error: any) {
        functions.logger.error("Error al obtener ubicaciones cercanas:", error);
        throw new functions.https.HttpsError("internal", "Error al buscar prestadores cercanos.", error.message);
    }
});

const ZONAS_DE_COBERTURA: CoberturaZone[] = [
    { id: "culiacan_centro", nombre: "Culiacán Centro", centro: { lat: 24.8093, lng: -107.393 }, radioKm: 5 },
    { id: "culiacan_norte", nombre: "Culiacán Norte", centro: { lat: 24.8400, lng: -107.4000 }, radioKm: 7 },
    // ... más zonas
];

export const validarCoberturaServicio = functions.https.onCall(async (data, context) => {
    functions.logger.info("Iniciando validarCoberturaServicio", { structuredData: true, data });
    const { direccionTexto, lat, lng } = data;
    const usuarioId = context.auth?.uid; // Opcional

    if (!direccionTexto && (typeof lat !== 'number' || typeof lng !== 'number')) {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere 'direccionTexto' o coordenadas ('lat', 'lng') válidas.");
    }

    let coordenadasAnalizadas: { lat: number, lng: number };
    let mensajeResultado = "";
    let enCobertura = false;
    let zonaIdDetectada: string | undefined = undefined;

    if (typeof lat === 'number' && typeof lng === 'number') {
        coordenadasAnalizadas = { lat, lng };
    } else {
        // SIMULACIÓN DE GEOCODIFICACIÓN (en real, aquí llamarías a una API de Geocoding)
        functions.logger.warn(`[validarCoberturaServicio] Geocodificación para '${direccionTexto}' no implementada en esta simulación. Se requieren coordenadas directas para una validación precisa en el prototipo.`);
        mensajeResultado = "No se pudo validar la dirección (geocodificación no simulada). Por favor, proporciona coordenadas.";
        // Registrar intento fallido de geocodificación
        await db.collection("validacionesCobertura").add({
            usuarioId: usuarioId || null,
            direccionTexto: direccionTexto || null,
            coordenadasAnalizadas: null, // No se pudieron obtener
            estaEnCobertura: false,
            zonaId: "geocodificacion_fallida",
            mensajeResultado: mensajeResultado,
            fechaValidacion: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw new functions.https.HttpsError("failed-precondition", mensajeResultado);
    }

    for (const zona of ZONAS_DE_COBERTURA) {
        const distancia = calculateDistance(coordenadasAnalizadas.lat, coordenadasAnalizadas.lng, zona.centro.lat, zona.centro.lng);
        if (distancia <= zona.radioKm) {
            enCobertura = true;
            zonaIdDetectada = zona.id;
            mensajeResultado = `La ubicación está dentro de la zona de cobertura: ${zona.nombre}.`;
            break;
        }
    }

    if (!enCobertura) {
        mensajeResultado = "La ubicación está fuera de nuestras zonas de cobertura actuales.";
    }

    // Registrar la validación
    await db.collection("validacionesCobertura").add({
        usuarioId: usuarioId || null,
        direccionTexto: direccionTexto || null,
        coordenadasAnalizadas: coordenadasAnalizadas,
        estaEnCobertura: enCobertura,
        zonaId: zonaIdDetectada || "ninguna",
        mensajeResultado: mensajeResultado,
        fechaValidacion: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`[validarCoberturaServicio] Resultado para ${usuarioId || 'anónimo'} en ${JSON.stringify(coordenadasAnalizadas)}: ${mensajeResultado}`);
    return { enCobertura, mensaje: mensajeResultado, zonaId: zonaIdDetectada };
});

export const validarCoberturaYObtenerPrestadoresCercanos = functions.https.onCall(async (data, context) => {
    functions.logger.info("Iniciando validarCoberturaYObtenerPrestadoresCercanos", { structuredData: true, data });
    const { direccionTexto, lat, lng } = data;
    const usuarioId = context.auth?.uid; // Opcional, para logging

    // Definiciones de constantes para esta función
    const MAX_DISTANCIA_SUGERENCIAS_KM = 20; // Radio máximo para buscar prestadores
    const MAX_PRESTADORES_SUGERIDOS = 5;   // Número máximo de prestadores a devolver

    if (!direccionTexto && (typeof lat !== 'number' || typeof lng !== 'number')) {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere 'direccionTexto' o coordenadas ('lat', 'lng') válidas.");
    }

    let coordenadasUsuario: { lat: number, lng: number };
    let enCobertura = false;
    let zonaIdDetectada: string | undefined = undefined;
    let mensajeInicial = "";

    if (typeof lat === 'number' && typeof lng === 'number') {
        coordenadasUsuario = { lat, lng };
    } else {
        // SIMULACIÓN DE GEOCODIFICACIÓN
        functions.logger.warn(`[validarCoberturaYObtenerPrestadoresCercanos] Geocodificación para '${direccionTexto}' no implementada. Se requieren coordenadas directas.`);
        mensajeInicial = "Geocodificación no disponible en simulación. Por favor, use coordenadas.";
        // Registrar el intento
        await db.collection("validacionesConPrestadores").add({
            usuarioId: usuarioId || null,
            direccionTexto: direccionTexto || null,
            coordenadasAnalizadas: null,
            estaEnCobertura: false,
            mensajeResultado: mensajeInicial,
            filtrosAplicados: data,
            fechaValidacion: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { enCobertura: false, mensaje: mensajeInicial, prestadoresSugeridos: [] };
    }

    // 1. Validar Cobertura
    for (const zona of ZONAS_DE_COBERTURA) {
        const distancia = calculateDistance(coordenadasUsuario.lat, coordenadasUsuario.lng, zona.centro.lat, zona.centro.lng);
        if (distancia <= zona.radioKm) {
            enCobertura = true;
            zonaIdDetectada = zona.id;
            mensajeInicial = `Ubicación dentro de la zona de cobertura: ${zona.nombre}.`;
            break;
        }
    }

    if (!enCobertura) {
        mensajeInicial = "Ubicación fuera de nuestras zonas de cobertura actuales.";
        await db.collection("validacionesConPrestadores").add({
            usuarioId: usuarioId || null,
            direccionTexto: direccionTexto || null,
            coordenadasAnalizadas: coordenadasUsuario,
            estaEnCobertura: false,
            zonaId: "ninguna",
            mensajeResultado: mensajeInicial,
            filtrosAplicados: data,
            fechaValidacion: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { enCobertura: false, mensaje: mensajeInicial, prestadoresSugeridos: [] };
    }

    // 2. Obtener y Filtrar Prestadores si hay cobertura
    let prestadoresSugeridos: PrestadorSugeridoConDistancia[] = [];
    try {
        const prestadoresSnapshot = await db.collection("prestadores").where("isAvailable", "==", true).get(); // Considerar solo disponibles inicialmente
        
        const prestadoresCercanosPromesas = prestadoresSnapshot.docs.map(async (doc) => {
            const pData = doc.data() as ProviderData;
            const pId = doc.id;

            if (!pData.currentLocation?.lat || !pData.currentLocation?.lng) { // Usar currentLocation para activos
                return null;
            }

            const distanciaKm = calculateDistance(coordenadasUsuario.lat, coordenadasUsuario.lng, pData.currentLocation.lat, pData.currentLocation.lng);
            if (distanciaKm <= MAX_DISTANCIA_SUGERENCIAS_KM) {
                // Obtener membresía del prestador
                let esPremium = false;
                const membresiaRef = db.collection("membresias").doc(pId);
                const membresiaDoc = await membresiaRef.get();
                if (membresiaDoc.exists) {
                    const membresiaData = membresiaDoc.data() as MembresiaData;
                    if (membresiaData.estadoMembresia === 'activa' && membresiaData.tipoMembresia.startsWith('premium')) {
                        esPremium = true;
                    }
                }
                
                // Lógica de puntuación simple: Premium alto, luego rating, luego distancia
                let sortScore = esPremium ? 0 : 1000; // Premium primero
                sortScore += (5 - (pData.rating || 0)) * 100; // Mejor rating = menor score (para ordenar asc)
                sortScore += distanciaKm; // Menor distancia = menor score

                const categoriaPrincipalData = SERVICE_CATEGORIES_FUNCTIONS.find(sc => sc.id === pData.services?.[0]?.categoria);

                return {
                    id: pId,
                    nombre: pData.name,
                    avatarUrl: pData.avatarUrl,
                    rating: pData.rating,
                    ratingCount: pData.ratingCount,
                    esPremium,
                    distanciaKm: parseFloat(distanciaKm.toFixed(1)),
                    lat: pData.currentLocation.lat,
                    lng: pData.currentLocation.lng,
                    categoriaPrincipal: categoriaPrincipalData?.name || pData.services?.[0]?.categoria || "General",
                    isAvailable: pData.isAvailable,
                    sortScore, // Para ordenar
                };
            }
            return null;
        });

        const prestadoresTemp = (await Promise.all(prestadoresCercanosPromesas)).filter(p => p !== null) as (PrestadorSugeridoConDistancia & {sortScore: number})[];
        
        // Ordenar
        prestadoresTemp.sort((a, b) => a.sortScore - b.sortScore);
        
        prestadoresSugeridos = prestadoresTemp.slice(0, MAX_PRESTADORES_SUGERIDOS).map(p => {
            const { sortScore, ...rest } = p; // Quitar sortScore del objeto final
            return rest;
        });

    } catch (error: any) {
        functions.logger.error("Error al obtener/filtrar prestadores:", error);
        // No lanzar error al cliente, sino registrar y devolver que no hay sugerencias por ahora
        mensajeInicial += " Error al buscar prestadores cercanos.";
    }
    
    // Registrar la validación y los resultados
    await db.collection("validacionesConPrestadores").add({
        usuarioId: usuarioId || null,
        direccionTexto: direccionTexto || null,
        coordenadasAnalizadas: coordenadasUsuario,
        estaEnCobertura: enCobertura,
        zonaId: zonaIdDetectada || "ninguna",
        mensajeResultado: mensajeInicial + (prestadoresSugeridos.length > 0 ? ` Se encontraron ${prestadoresSugeridos.length} prestadores.` : " No se encontraron prestadores cercanos que cumplan los criterios."),
        prestadoresSugeridosIds: prestadoresSugeridos.map(p => p.id),
        filtrosAplicados: data, // Guardar los filtros usados
        fechaValidacion: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { enCobertura, mensaje: mensajeInicial, zonaId: zonaIdDetectada, prestadoresSugeridos };
});


export const obtenerDetallesPrestadorParaPopup = functions.https.onCall(async (data, context) => {
    functions.logger.info("Iniciando obtenerDetallesPrestadorParaPopup", { structuredData: true, data });
    const { prestadorId } = data;

    if (!prestadorId || typeof prestadorId !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere 'prestadorId'.");
    }

    try {
        const prestadorRef = db.collection("prestadores").doc(prestadorId);
        const prestadorDoc = await prestadorRef.get();

        if (!prestadorDoc.exists) {
            throw new functions.https.HttpsError("not-found", `Prestador con ID ${prestadorId} no encontrado.`);
        }

        const prestadorData = prestadorDoc.data() as ProviderData;
        
        let categoriaPrincipalNombre = "Servicio General";
        if (prestadorData.services && prestadorData.services.length > 0) {
            const categoriaId = prestadorData.services[0].category;
            const categoriaEncontrada = SERVICE_CATEGORIES_FUNCTIONS.find(cat => cat.id === categoriaId);
            if (categoriaEncontrada) {
                categoriaPrincipalNombre = categoriaEncontrada.name;
            } else if (categoriaId) {
                 categoriaPrincipalNombre = categoriaId; // Fallback al ID si no se encuentra nombre
            }
        }

        const popupData: PrestadorMapaPopupData = {
            id: prestadorId,
            nombre: prestadorData.name || "Nombre no disponible",
            avatarUrl: prestadorData.avatarUrl,
            rating: prestadorData.rating,
            ratingCount: prestadorData.ratingCount,
            categoriaPrincipal: categoriaPrincipalNombre,
            enlacePerfil: `/provider-profile/${prestadorId}`, // Construir enlace
        };

        functions.logger.info(`Detalles para popup del prestador ${prestadorId} obtenidos.`);
        return popupData;

    } catch (error: any) {
        functions.logger.error(`Error al obtener detalles para popup del prestador ${prestadorId}:`, error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", "Error al obtener los detalles del prestador.", error.message);
    }
});


// --- FIN FUNCIONES EXISTENTES ---

```