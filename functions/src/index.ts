

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}
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

interface ServiceData { // Solicitud de Servicio
  id?: string;
  usuarioId: string;
  prestadorId: string;
  estado: ServiceRequestStatus;
  fechaSolicitud: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  detallesServicio?: string;
  precio?: number;
  categoria?: string;

  // Campos para servicios agendados / por horas
  serviceType?: 'fixed' | 'hourly';
  fechaServicio?: admin.firestore.Timestamp; // Para fijos agendados
  serviceTime?: string; // Para fijos agendados
  startTime?: string; // Para por horas
  durationHours?: number; // Para por horas
  hourlyRate?: number; // Para por horas
  estimatedTotal?: number; // Para por horas
  
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;

  // Timestamps de ciclo de vida
  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  fechaConfirmacion?: admin.firestore.Timestamp; // Confirmación del usuario (genérica)
  userConfirmedCompletionAt?: admin.firestore.Timestamp; // Usuario confirma finalización del servicio
  providerMarkedCompleteAt?: admin.firestore.Timestamp; // Prestador marca como completado

  // Calificación y Ventana
  habilitarCalificacion?: boolean; // Podría ser redundante si se usa ratingWindowExpiresAt
  ratingWindowExpiresAt?: admin.firestore.Timestamp;
  calificacionUsuario?: RatingData;
  calificacionPrestador?: RatingData;
  mutualRatingCompleted?: boolean;

  // Pagos
  paymentStatus?: PaymentStatus;
  paymentIntentId?: string; // ID de la pasarela de pago
  fechaLiberacionPago?: admin.firestore.Timestamp; // Pago liberado al proveedor
  paymentReleasedToProviderAt?: admin.firestore.Timestamp; // Alias o nuevo campo
  fechaCobro?: admin.firestore.Timestamp; // Fecha en que se intentó/realizó el cobro al usuario
  montoCobrado?: number; // Monto final cobrado al usuario
  ordenCobroId?: string; // ID interno de orden de cobro

  // Garantía
  warrantyEndDate?: string; // YYYY-MM-DD
  garantiaSolicitada?: boolean;
  idSolicitudGarantia?: string;
  garantiaResultado?: "aprobada" | "rechazada";
  compensacionAutorizada?: boolean;
  garantiaActiva?: boolean; // Campo para garantía activada automáticamente

  // Disputa
  detallesDisputa?: {
    reportadoEn: admin.firestore.Timestamp;
    detalle: string;
    reporteId?: string;
  };
  
  // Para notificaciones
  titulo?: string; // Para identificar el servicio en notificaciones

  [key: string]: any; // Para flexibilidad
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
  estadoOnline?: boolean; // Añadido para indicar si está activamente en línea
  currentLocation?: { // Para ubicación en tiempo real si isAvailable
    lat: number;
    lng: number;
    timestamp: admin.firestore.Timestamp;
  } | null;
  ubicacionAproximada?: { lat: number; lng: number; }; // Ubicación general para búsqueda
  ubicacionExacta?: { lat: number; lng: number; }; // Ubicación exacta para servicios aceptados
  location?: { lat: number; lng: number }; // Ubicación base (podría ser redundante con ubicacionAproximada o Exacta)
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
  fcmTokens?: string[]; // Para notificaciones push
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
  fcmTokens?: string[]; // Para notificaciones push
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

interface CitaData { // Similar a ServiceData, pero específica para citas
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
  precioServicio?: number; // Para fixed agendado
  tarifaPorHora?: number; // Para hourly agendado
  duracionHoras?: number; // Para hourly agendado
  montoTotalEstimado?: number; // Calculado para hourly, o fijo para fixed

  ordenCobroId?: string;
  paymentStatus?: PaymentStatus;
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;
  titulo?: string; // Para identificar la cita en notificaciones
}


interface NotificacionData {
  id?: string;
  destinatarioId: string;
  rolDestinatario: 'usuario' | 'prestador';
  titulo: string;
  cuerpo: string;
  estadoNotificacion: 'pendiente' | 'leida' | 'procesada_por_trigger' | 'enviada_fcm';
  fechaCreacion: admin.firestore.Timestamp;
  fechaLectura?: admin.firestore.Timestamp;
  tipoNotificacion: string; // Ej: 'NUEVA_SOLICITUD', 'SOLICITUD_ACEPTADA', 'PAGO_LIBERADO'
  prioridad: 'alta' | 'normal';
  datosAdicionales?: { [key: string]: any }; // Ej: { servicioId: 'xyz', citaId: 'abc' }
  enlaceOpcional?: string; // Para deeplinking en la app
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

async function getMockUser(userId: string): Promise<UserData | null> {
    const userRef = db.collection("usuarios").doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
        return userDoc.data() as UserData;
    }
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

  const servicioRef = db.collection("servicios").doc(servicioId); // Asumiendo que 'servicios' es la colección de ServiceData
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
export { activarMembresia } from "./activarMembresia";
export { confirmServiceCompletionByUserService } from "./confirmServiceCompletionByUser";
export { calificarPrestador } from "./calificarPrestador";
export { calificarUsuario } from "./calificarUsuario";
export { reportarProblemaServicio } from "./reportarProblemaServicio"; 
export { obtenerServiciosCompletados } from "./obtenerServiciosCompletados";
export { registrarDocumentoProfesional } from "./registrarDocumentoProfesional";
export { verificarDocumentoProfesional } from "./verificarDocumentoProfesional"; 
export { activarGarantiaPremium } from "./activarGarantiaPremium";
export { resolverGarantiaPremium } from "./resolverGarantiaPremium";
export { disconnectProvider } from "./disconnectProvider";
export { verificarEstadoFunciones } from "./verificarEstadoFunciones";
export { agendarCitaConPrestador } from "./agendarCitaConPrestador"; 
export { cancelarCita } from "./cancelarCita"; 
export { confirmarCitaPorPrestador } from "./confirmarCitaPrestador"; 
export { procesarCobroTrasConfirmacion } from "./procesarCobroTrasConfirmacion";
export { enviarNotificacionInApp } from "./enviarNotificacionInApp"; 
export { iniciarChat } from "./iniciarChat";
export { enviarMensaje } from "./enviarMensaje";
export { configurarDisponibilidadAvanzada } from "./configurarDisponibilidadAvanzada";
export { sugerirPrestadoresIA } from "./sugerirPrestadoresIA"; 
export { mostrarServiciosDestacados } from "./mostrarServiciosDestacados";
export { revisarDocumentoPrestador } from "./revisarDocumentoPrestador";
export { generarContratoDigital } from "./generarContratoDigital"; 
export { crearSolicitudSoporte } from "./crearSolicitudSoporte";
export { responderSolicitudSoporte } from "./responderSolicitudSoporte";
export { obtenerTraduccion } from "./obtenerTraduccion";
export { integrarGeolocalizacionTiempoReal } from "./integrarGeolocalizacionTiempoReal"; 
export { obtenerUbicacionesCercanas } from "./obtenerUbicacionesCercanas";
export { validarCoberturaServicio } from "./validarCoberturaServicio";
export { validarCoberturaYObtenerPrestadoresCercanos } from "./validarCoberturaYObtenerPrestadoresCercanos";
export { obtenerDetallesPrestadorParaPopup } from "./obtenerDetallesPrestadorParaPopup";
export { obtenerHistorialAgrupado } from "./obtenerHistorialAgrupado";
export { sugerirPrestadoresConGeolocalizacion } from "./sugerirPrestadoresConGeolocalizacion";
export { gestionarPenalizacionPrestador } from "./gestionarPenalizacionPrestador"; 
export { configurarSoporteMultiIdioma } from "./configurarSoporteMultiIdioma";


// --- TRIGGERS ---

export { moderarMensajesChat } from "./moderarMensajesChat";
export { enviarNotificacionInAppTrigger } from "./enviarNotificacionInAppTrigger";
export { notificarLiberacionPagoAutomatica } from "./notificarLiberacionPagoAutomatica";
export { evaluarComportamientoPrestadorTrigger } from "./evaluarComportamientoPrestadorTrigger";
export { otorgarIncentivosTrigger } from "./otorgarIncentivosTrigger"; 
export { simulateDailyAutomatedChecks } from "./simulateDailyAutomatedChecks";


// --- NUEVO TRIGGER FCM PARA CAMBIOS DE ESTADO DE SERVICIO ---
export const onServiceStatusChangeSendNotification = functions.firestore
  .document("solicitudes_servicio/{solicitudId}") // Ajusta el path a tu colección real
  .onUpdate(async (change, context) => {
    const newValue = change.after.data() as ServiceData | CitaData; // Usar ServiceData o CitaData según corresponda
    const previousValue = change.before.data() as ServiceData | CitaData;
    const solicitudId = context.params.solicitudId;

    if (!newValue || !previousValue) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] No new or previous data, exiting.`);
      return null;
    }

    // Solo enviar notificación si el estado realmente cambió
    if (newValue.estado === previousValue.estado) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] Estado no cambió (${newValue.estado}), no se envía notificación.`);
      return null;
    }
    
    functions.logger.log(`[FCM Trigger ${solicitudId}] Estado cambiado de ${previousValue.estado} a ${newValue.estado}. Preparando notificación.`);

    const usuarioId = newValue.usuarioId;
    const prestadorId = newValue.prestadorId;
    let tituloNotif = "";
    let cuerpoNotif = "";
    let targetUserId: string | null = null;
    let targetUserType: 'usuario' | 'prestador' | null = null;

    const serviceTitle = newValue.titulo || newValue.detallesServicio || "un servicio"; // Usar un título representativo del servicio/cita

    // Lógica para determinar a quién notificar y qué mensaje enviar
    switch (newValue.estado) {
      case "agendado": // Solicitud creada por usuario, notificar al prestador
        targetUserId = prestadorId;
        targetUserType = "prestador";
        tituloNotif = "Nueva Solicitud de Servicio";
        cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}".`;
        break;
      case "confirmada_prestador": // Prestador confirma, notificar al usuario
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = "¡Cita Confirmada!";
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido confirmada por el prestador.`;
        break;
      case "rechazada_prestador": // Prestador rechaza, notificar al usuario
      case "cancelada_prestador": // Prestador cancela, notificar al usuario
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = `Cita ${newValue.estado === "rechazada_prestador" ? "Rechazada" : "Cancelada"}`;
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido ${newValue.estado === "rechazada_prestador" ? "rechazada" : "cancelada"} por el prestador.`;
        break;
      case "cancelada_usuario": // Usuario cancela, notificar al prestador
        targetUserId = prestadorId;
        targetUserType = "prestador";
        tituloNotif = "Cita Cancelada por Usuario";
        cuerpoNotif = `La cita para "${serviceTitle}" ha sido cancelada por el usuario.`;
        break;
      case "en_camino_proveedor":
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = "¡Tu Proveedor está en Camino!";
        cuerpoNotif = `El proveedor para "${serviceTitle}" está en camino.`;
        break;
      case "servicio_iniciado":
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = "Servicio Iniciado";
        cuerpoNotif = `El proveedor ha iniciado el servicio "${serviceTitle}".`;
        break;
      case "completado_por_prestador": // Proveedor completa, notificar al usuario para que confirme
        targetUserId = usuarioId;
        targetUserType = "usuario";
        tituloNotif = "Servicio Completado por Prestador";
        cuerpoNotif = `El prestador ha marcado "${serviceTitle}" como completado. Por favor, confirma y califica.`;
        break;
      case "completado_por_usuario": // Usuario confirma, notificar al prestador para que califique
        targetUserId = prestadorId;
        targetUserType = "prestador";
        tituloNotif = "¡Servicio Confirmado por Usuario!";
        cuerpoNotif = `El usuario ha confirmado la finalización de "${serviceTitle}". ¡Ya puedes calificarlo!`;
        break;
      // Otros estados como 'en_disputa', 'cerrado_con_calificacion', etc., también podrían tener notificaciones.
      default:
        functions.logger.log(`[FCM Trigger ${solicitudId}] Estado ${newValue.estado} no maneja notificación específica por ahora.`);
        return null;
    }

    if (!targetUserId || !targetUserType) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] No se definió destinatario para el estado ${newValue.estado}.`);
      return null;
    }

    // Obtener los tokens FCM del destinatario
    const recipientCollection = targetUserType === "usuario" ? "usuarios" : "prestadores";
    const recipientDoc = await db.collection(recipientCollection).doc(targetUserId).get();

    if (!recipientDoc.exists) {
      functions.logger.error(`[FCM Trigger ${solicitudId}] Documento del destinatario ${targetUserType} ${targetUserId} no encontrado.`);
      return null;
    }

    const recipientData = (targetUserType === "usuario" ? recipientDoc.data() as UserData : recipientDoc.data() as ProviderData);
    const tokens = recipientData.fcmTokens;

    if (!tokens || tokens.length === 0) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] El destinatario ${targetUserType} ${targetUserId} no tiene tokens FCM registrados.`);
      return null;
    }

    const payload: admin.messaging.MessagingPayload = {
      notification: {
        title: tituloNotif,
        body: cuerpoNotif,
        // icon: "URL_A_TU_ICONO_DE_APP", // Opcional
        // click_action: "URL_O_RUTA_PARA_ABRIR_EN_LA_APP" // Opcional para deeplinking
      },
      data: { // Datos adicionales que tu app cliente puede usar
        solicitudId: solicitudId,
        nuevoEstado: newValue.estado,
        tipoNotificacion: `SERVICIO_${newValue.estado.toUpperCase()}`, // ej: SERVICIO_CONFIRMADA_PRESTADOR
        // Puedes añadir más datos relevantes aquí
      },
    };

    try {
      const response = await admin.messaging().sendToDevice(tokens, payload);
      functions.logger.log(`[FCM Trigger ${solicitudId}] Notificación enviada exitosamente a ${response.successCount} tokens para ${targetUserType} ${targetUserId}.`);
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          functions.logger.error(
            `[FCM Trigger ${solicitudId}] Falla al enviar notificación al token ${tokens[index]}:`,
            error
          );
          // Lógica para limpiar tokens inválidos/caducados
          if (error.code === "messaging/invalid-registration-token" ||
              error.code === "messaging/registration-token-not-registered") {
            // db.collection(recipientCollection).doc(targetUserId).update({
            //   fcmTokens: admin.firestore.FieldValue.arrayRemove(tokens[index])
            // });
          }
        }
      });
    } catch (error) {
      functions.logger.error(`[FCM Trigger ${solicitudId}] Error al enviar notificación FCM a ${targetUserType} ${targetUserId}:`, error);
    }
    return null;
  });
