
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// --- CONSTANTES ---
// Ajustado a 3 días según la solicitud más reciente para la ventana de calificación/disputa
const RATING_AND_DISPUTE_WINDOW_DAYS = 3;
const STANDARD_WARRANTY_DAYS = 3; // Para la función isServiceRequestUnderWarranty
const PREMIUM_WARRANTY_DAYS = 7;  // Para la función isServiceRequestUnderWarranty

const PALABRAS_CLAVE_PROHIBIDAS_CONTACTO = [
  "teléfono", "telefono", "celular", "móvil", "movil", "whatsapp", "tel:",
  "email", "correo", "e-mail", "@",
  "facebook", "fb.com", "instagram", "twitter", "linkedin", "tiktok",
  "calle", "avenida", "colonia", "barrio", "cp ", "c.p.", "código postal", "codigo postal",
  "apartado postal", "suite", "edificio", "núm.", "no.", "int.", "depto.",
  "contacto", "llámame", "llamame", "escríbeme", "escribeme", "sitio web", "pagina web", "www.", ".com", ".mx", ".net", ".org",
];

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
  | "agendado"
  | "pendiente_confirmacion" // Para citas
  | "confirmada_prestador"   // Para citas
  | "pagada"                 // Para citas (después de procesarCobroTrasConfirmacion)
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador" // Proveedor marca como completado
  | "completado_por_usuario"   // Usuario confirma finalización
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "rechazada_prestador"    // Para citas
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

interface ServiceDataFirebase {
  id?: string;
  title: string;
  description: string;
  price: number;
  category: string;
  providerId: string;
  imageUrl?: string;
}

interface ServiceData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  estado: ServiceRequestStatus;
  fechaSolicitud: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  detallesServicio?: string;
  precio?: number;
  categoria?: string;

  fechaServicio?: admin.firestore.Timestamp;
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

type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

interface DisponibilidadSlot {
  idSlot: string;
  dia: DiaSemana;
  inicio: string;
  fin: string;
}

interface ProviderData {
  uid?: string;
  name?: string;
  avatarUrl?: string;
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
  location?: { lat: number; lng: number }; // Ubicación base
  lastConnection?: admin.firestore.Timestamp;
  allowsHourlyServices?: boolean;
  hourlyRate?: number;
  membresiaActual?: string;

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
  services?: ServiceDataFirebase[];
  specialties?: string[];
  idiomasHablados?: string[];
  disponibilidadAvanzada?: DisponibilidadSlot[];
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
  idiomaPreferido?: string;
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
  fechaCancelacion?: admin.firestore.Timestamp;
  canceladaPor?: string;
  rolCancelador?: 'usuario' | 'prestador';

  serviceType?: "fixed" | "hourly";
  precioServicio?: number;
  tarifaPorHora?: number;
  duracionHoras?: number;
  montoTotalEstimado?: number;

  ordenCobroId?: string;
  paymentStatus?: PaymentStatus;
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;
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
  enlaceOpcional?: string;
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
    descuentoComisionAbsoluto?: number;
    prioridadAgenda?: boolean;
    garantiaExtendidaDiasAdicionales?: number;
  };
  stripeSubscriptionId?: string;
  mercadoPagoSubscriptionId?: string;
  ultimoPaymentIntentId?: string;
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

interface SugerirPrestadoresIAInput {
  categoriaId: string;
  ubicacionUsuario: { lat: number; lng: number };
  descripcionServicio?: string;
  idiomaPreferenciaUsuario?: string;
  preferenciasUsuario?: {
    historialCategorias?: string[];
    prestadoresFavoritos?: string[];
    prestadoresEvitados?: string[];
  };
  maxResultados?: number;
  distanciaMaximaKm?: number;
}

interface PrestadorSugeridoIA {
  prestadorId: string;
  nombre?: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  distanciaKm?: number;
  isAvailable?: boolean;
  especialidades?: string[];
  idiomasHablados?: string[];
  score: number;
  motivosSugerencia?: string[];
}

interface SugerenciaIARegistroData {
  userId: string;
  timestamp: admin.firestore.Timestamp;
  inputSolicitud: SugerirPrestadoresIAInput;
  prestadoresSugeridos: Array<{ prestadorId: string; score: number; nombre?: string }>;
  factoresPonderados?: {
    rating: number;
    distancia: number;
    disponibilidad: number;
    historialCategoria: number;
    favorito: number;
    idioma: number;
    especialidadSimple: number;
  };
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
  respuestaSoporte?: string; // Podría ser el último mensaje del agente en el historial
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
  coordenadasAnalizadas: { lat: number; lng: number } | null;
  estaEnCobertura: boolean;
  zonaId?: string;
  mensajeResultado: string;
  fechaValidacion: admin.firestore.Timestamp;
}

interface ValidacionConPrestadoresData {
  usuarioId?: string;
  direccionTexto?: string;
  coordenadasAnalizadas: { lat: number; lng: number } | null;
  estaEnCobertura: boolean;
  zonaId?: string;
  mensajeResultado: string;
  prestadoresSugeridosIds?: string[];
  filtrosAplicados?: any;
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
  categoriaPrincipal?: string;
  isAvailable?: boolean;
}

interface PrestadorMapaPopupData {
  id: string;
  nombre?: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  categoriaPrincipal?: string;
  enlacePerfil: string;
}

interface HistorialItemDetallado {
  id: string;
  tipo: 'cita' | 'servicio';
  estado: CitaEstado | ServiceRequestStatus;
  participanteContrarioId: string;
  participanteContrarioNombre?: string;
  fechaRelevante: admin.firestore.Timestamp;
  fechaServicioProgramada?: string;
  detallesPrincipales?: string;
  ubicacion?: any;
  montoEstimado?: number;
  calificadoPorSolicitante: boolean;
}

interface PenalizacionData {
  id?: string;
  prestadorId: string;
  tipoInfraccion: string;
  descripcionInfraccion: string;
  citaIdAsociada?: string;
  servicioIdAsociado?: string;
  tipoPenalizacionAplicada: string;
  fechaAplicacion: admin.firestore.Timestamp;
  fechaExpiracion?: admin.firestore.Timestamp;
  estadoPenalizacion: 'activa' | 'expirada' | 'anulada';
  aplicadaPor: string;
  notasAdmin?: string;
}

interface IncentivoOtorgadoData {
  id?: string;
  receptorId: string;
  rolReceptor: 'usuario' | 'prestador';
  tipoIncentivo: 'PUNTOS_REPUTACION' | 'BADGE_CALIFICADOR_BRONCE' | 'BADGE_PROVEEDOR_ESTRELLA';
  descripcion: string;
  valor?: number;
  nombreBadge?: string;
  fechaOtorgado: admin.firestore.Timestamp;
  referenciaId?: string;
}


// --- FUNCIONES HELPER ---

// Asumimos que estas funciones existen o son adaptadas
async function getMockUser(userId: string): Promise<UserData | null> {
    const userRef = db.collection("usuarios").doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
        return userDoc.data() as UserData;
    }
    // Simulación básica si no se encuentra
    if (userId === "currentUserDemoId") {
        return { uid: userId, name: "Usuario Premium Demo", isPremium: true, membresiaActual: "premium_anual_usuario", idiomaPreferido: "es" };
    }
    if (userId === "standardUserDemoId") {
        return { uid: userId, name: "Usuario Estándar Demo", isPremium: false, membresiaActual: "gratis", idiomaPreferido: "es" };
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

  let comisionAplicadaPorcentaje = COMISION_ESTANDAR_PORCENTAJE;
  let comisionAplicadaAbsoluta = 0;
  let usarComisionAbsoluta = false;

  if (membresiaDoc.exists) {
    const membresiaData = membresiaDoc.data() as MembresiaData;
    if (membresiaData.estadoMembresia === "activa" && new Date() < membresiaData.fechaExpiracion.toDate()) {
      if (membresiaData.beneficiosAdicionales?.descuentoComisionAbsoluto !== undefined && membresiaData.beneficiosAdicionales.descuentoComisionAbsoluto > 0) {
        comisionAplicadaAbsoluta = membresiaData.beneficiosAdicionales.descuentoComisionAbsoluto;
        usarComisionAbsoluta = true;
        functions.logger.info(`[Comisiones] Prestador ${prestadorId} tiene membresía activa con comisión absoluta de: $${comisionAplicadaAbsoluta}`);
      } else if (membresiaData.beneficiosAdicionales?.descuentoComisionPorcentaje !== undefined) {
        comisionAplicadaPorcentaje = membresiaData.beneficiosAdicionales.descuentoComisionPorcentaje;
        functions.logger.info(`[Comisiones] Prestador ${prestadorId} tiene membresía activa con descuento porcentual. Comisión aplicada: ${comisionAplicadaPorcentaje}%`);
      }
    }
  }

  const montoComision = usarComisionAbsoluta ? comisionAplicadaAbsoluta : montoTotalServicio * (comisionAplicadaPorcentaje / 100);
  const montoParaProveedor = montoTotalServicio - montoComision;

  functions.logger.info(`[Comisiones] Servicio ${servicioId}: Monto Total: ${montoTotalServicio}, Comisión (${usarComisionAbsoluta ? '$'+comisionAplicadaAbsoluta : comisionAplicadaPorcentaje+'%'}): ${montoComision}, Monto para Proveedor: ${montoParaProveedor}`);
  return montoParaProveedor;
}


const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const DIAS_SEMANA_VALIDOS: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

const isValidTimeFormat = (time: string): boolean => {
  return /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const checkSlotsOverlap = (slotA: { inicio: string, fin: string }, slotB: { inicio: string, fin: string }): boolean => {
  const startA = timeToMinutes(slotA.inicio);
  const endA = timeToMinutes(slotA.fin);
  const startB = timeToMinutes(slotB.inicio);
  const endB = timeToMinutes(slotB.fin);
  return startA < endB && startB < endA;
};

// --- FUNCIONES CALLABLE ---
// ... (funciones existentes como activarMembresia, etc.) ...

export { activarMembresia } from "./activarMembresia";
export { confirmServiceCompletionByUserService } from "./confirmServiceCompletionByUser";
export { calificarPrestador } from "./calificarPrestador";
export { calificarUsuario } from "./calificarUsuario";
export { reportarProblemaServicio } from "./reportarProblemaServicio"; // Renombrado desde reportServiceIssue para consistencia
export { obtenerServiciosCompletados } from "./obtenerServiciosCompletados";
export { registrarDocumentoProfesional } from "./registrarDocumentoProfesional";
export { verificarDocumentoProfesional } from "./verificarDocumentoProfesional"; // Renombrado desde validateDocumentAndRemoveContactInfo
export { activarGarantiaPremium } from "./activarGarantiaPremium";
export { resolverGarantiaPremium } from "./resolverGarantiaPremium";
// export { updateProviderRealtimeStatus } from "./updateProviderRealtimeStatus"; // Renombrada
export { disconnectProvider } from "./disconnectProvider";
export { verificarEstadoFunciones } from "./verificarEstadoFunciones";
export { agendarCitaConPrestador } from "./agendarCitaConPrestador"; // Renombrado desde agendarCita
export { cancelarCita } from "./cancelarCita"; // Renombrado desde cancelarCitaAgendada
export { confirmarCitaPorPrestador } from "./confirmarCitaPrestador"; // Renombrado desde confirmarCitaPorPrestador
export { procesarCobroTrasConfirmacion } from "./procesarCobroTrasConfirmacion";
export { enviarNotificacionInApp } from "./enviarNotificacionInApp"; // Renombrado desde crearNotificacion
export { iniciarChat } from "./iniciarChat";
export { enviarMensaje } from "./enviarMensaje";
export { configurarDisponibilidadAvanzada } from "./configurarDisponibilidadAvanzada";
export { sugerirPrestadoresIA } from "./sugerirPrestadoresIA"; // Renombrado desde sugerirPrestadoresInteligente
export { mostrarServiciosDestacados } from "./mostrarServiciosDestacados";
export { revisarDocumentoPrestador } from "./revisarDocumentoPrestador";
export { generarContratoDigital } from "./generarContratoDigital"; // Renombrado desde gestionarContratoServicio
export { crearSolicitudSoporte } from "./crearSolicitudSoporte";
export { responderSolicitudSoporte } from "./responderSolicitudSoporte";
export { obtenerTraduccion } from "./obtenerTraduccion";
// export { actualizarUbicacionPrestador } from "./actualizarUbicacionPrestador"; // Renombrada a integrarGeolocalizacionTiempoReal
export { integrarGeolocalizacionTiempoReal } from "./integrarGeolocalizacionTiempoReal"; // Nueva función para ubicación
export { obtenerUbicacionesCercanas } from "./obtenerUbicacionesCercanas";
export { validarCoberturaServicio } from "./validarCoberturaServicio";
export { validarCoberturaYObtenerPrestadoresCercanos } from "./validarCoberturaYObtenerPrestadoresCercanos";
export { obtenerDetallesPrestadorParaPopup } from "./obtenerDetallesPrestadorParaPopup";
export { obtenerHistorialAgrupado } from "./obtenerHistorialAgrupado";
export { sugerirPrestadoresConGeolocalizacion } from "./sugerirPrestadoresConGeolocalizacion";
export { gestionarPenalizacionPrestador } from "./gestionarPenalizacionPrestador"; // Renombrado desde gestionarPenalizacionesPrestadores


export { configurarSoporteMultiIdioma } from "./configurarSoporteMultiIdioma";


// --- TRIGGERS ---
// ... (triggers existentes como moderarMensajesChat, etc.) ...

export { moderarMensajesChat } from "./moderarMensajesChat";
export { enviarNotificacionInAppTrigger } from "./enviarNotificacionInAppTrigger";
export { notificarLiberacionPagoAutomatica } from "./notificarLiberacionPagoAutomatica";
export { evaluarComportamientoPrestadorTrigger } from "./evaluarComportamientoPrestadorTrigger";
export { otorgarIncentivosTrigger } from "./otorgarIncentivosTrigger"; // Renombrado desde asignarIncentivoUsuarioTrigger
export { simulateDailyAutomatedChecks } from "./simulateDailyAutomatedChecks";
