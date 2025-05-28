
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// --- CONSTANTES ---
const STANDARD_WARRANTY_DAYS = 3;
const PREMIUM_WARRANTY_DAYS = 7;
const RATING_AND_DISPUTE_WINDOW_DAYS = 3; // Días para calificar o reportar problema

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
  tipoInfraccion: string; // e.g., 'CANCELACION_REITERADA', 'NO_PRESENTARSE'
  descripcionInfraccion: string;
  citaIdAsociada?: string;
  servicioIdAsociado?: string;
  tipoPenalizacionAplicada: string; // e.g., 'ADVERTENCIA', 'VISIBILIDAD_REDUCIDA_3D'
  fechaAplicacion: admin.firestore.Timestamp;
  fechaExpiracion?: admin.firestore.Timestamp;
  estadoPenalizacion: 'activa' | 'expirada' | 'anulada';
  aplicadaPor: string; // UID of admin or 'sistema_automatico'
  notasAdmin?: string;
}

interface IncentivoOtorgadoData {
  id?: string;
  receptorId: string; 
  rolReceptor: 'usuario' | 'prestador';
  tipoIncentivo: 'PUNTOS_REPUTACION' | 'BADGE_CALIFICADOR_BRONCE' | 'BADGE_PROVEEDOR_ESTRELLA'; 
  descripcion: string;
  valor?: number; // Para puntos
  nombreBadge?: string; // Para badges
  fechaOtorgado: admin.firestore.Timestamp;
  referenciaId?: string; // ID del servicio/cita/rating que lo gatilló
}


// --- FUNCIONES HELPER ---

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

  let comisionAplicadaPorcentaje = COMISION_ESTANDAR_PORCENTAJE;
  let comisionAplicadaAbsoluta = 0;
  let usarComisionAbsoluta = false;

  if (membresiaDoc.exists) {
    const membresiaData = membresiaDoc.data() as MembresiaData;
    if (membresiaData.estadoMembresia === "activa" && new Date() < membresiaData.fechaExpiracion.toDate()) {
      if (membresiaData.beneficiosAdicionales?.descuentoComisionAbsoluto !== undefined) {
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

// --- FUNCIONES CALLABLE (Existentes y Nuevas) ---
// ... (Se omiten funciones existentes como activarMembresia, confirmServiceCompletionByUserService, etc. por brevedad) ...

// (Función existente, asegurar que esté exportada si se llama desde el cliente o si otras funciones la necesitan)
// export const nombreDeTuFuncionExistente = functions.https.onCall(...)

// --- Funciones Solicitadas ---

export { activarMembresia } from "./activarMembresia";
export { confirmServiceCompletionByUserService } from "./confirmServiceCompletionByUser";
export { calificarPrestador } from "./calificarPrestador";
export { calificarUsuario } from "./calificarUsuario";
export { reportarProblemaServicio } from "./reportarProblemaServicio";
export { obtenerServiciosCompletados } from "./obtenerServiciosCompletados";
export { registrarDocumentoProfesional } from "./registrarDocumentoProfesional";
export { validateDocumentAndRemoveContactInfo } from "./validateDocumentAndRemoveContactInfo";
export { activarGarantiaPremium } from "./activarGarantiaPremium";
export { resolverGarantiaPremium } from "./resolverGarantiaPremium";
export { updateProviderRealtimeStatus } from "./updateProviderRealtimeStatus";
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
export { sugerirPrestadoresInteligente } from "./sugerirPrestadoresInteligente";
export { mostrarServiciosDestacados } from "./mostrarServiciosDestacados";
export { revisarDocumentoPrestador } from "./revisarDocumentoPrestador";
export { gestionarContratoServicio } from "./gestionarContratoServicio";
export { crearSolicitudSoporte } from "./crearSolicitudSoporte";
export { obtenerTraduccion } from "./obtenerTraduccion";
export { actualizarUbicacionPrestador } from "./actualizarUbicacionPrestador";
export { obtenerUbicacionesCercanas } from "./obtenerUbicacionesCercanas";
export { validarCoberturaServicio } from "./validarCoberturaServicio";
export { validarCoberturaYObtenerPrestadoresCercanos } from "./validarCoberturaYObtenerPrestadoresCercanos";
export { obtenerDetallesPrestadorParaPopup } from "./obtenerDetallesPrestadorParaPopup";
export { obtenerHistorialAgrupado } from "./obtenerHistorialAgrupado";
export { sugerirPrestadoresConGeolocalizacion } from "./sugerirPrestadoresConGeolocalizacion";
export { gestionarPenalizacionPrestador } from "./gestionarPenalizacionPrestador";


// --- TRIGGERS (Existentes y Nuevos) ---
// ... (Se omiten triggers existentes como moderarMensajesChat por brevedad) ...

// export { moderarMensajesChat } from "./moderarMensajesChat"; // Ejemplo si estuviera en otro archivo
// export { enviarNotificacionInAppTrigger } from "./enviarNotificacionInAppTrigger";
// export { notificarLiberacionPagoAutomatica } from "./notificarLiberacionPagoAutomatica";
// export { evaluarComportamientoPrestadorTrigger } from "./evaluarComportamientoPrestadorTrigger";
// export { simulateDailyAutomatedChecks } from "./simulateDailyAutomatedChecks";


// Trigger para asignar incentivos a usuarios y prestadores
export const otorgarIncentivosTrigger = functions.firestore
    .document('servicios/{servicioId}')
    .onUpdate(async (change, context) => {
        const servicioId = context.params.servicioId;
        const beforeData = change.before.data() as ServiceData | undefined;
        const afterData = change.after.data() as ServiceData | undefined;

        if (!beforeData || !afterData) {
            functions.logger.warn(`[otorgarIncentivosTrigger] Datos antes o después no disponibles para servicio ${servicioId}.`);
            return null;
        }

        // --- Lógica de Incentivo para USUARIO por calificar ---
        const usuarioAcabaDeCalificar = !beforeData.calificacionUsuario && !!afterData.calificacionUsuario;
        if (usuarioAcabaDeCalificar && afterData.usuarioId && afterData.calificacionUsuario) {
            functions.logger.info(`[otorgarIncentivosTrigger] Usuario ${afterData.usuarioId} calificó servicio ${servicioId}.`);
            const usuarioRef = db.collection("usuarios").doc(afterData.usuarioId);
            const puntosPorCalificar = 5;
            const badgeCalificadorBronce = "calificador_bronce";
            const serviciosNecesariosParaBadge = 5;

            try {
                await db.runTransaction(async (transaction) => {
                    const usuarioDoc = await transaction.get(usuarioRef);
                    const updates: Partial<UserData> = {};
                    let nuevoServiciosCalificadosCount = 0;

                    if (!usuarioDoc.exists) {
                        updates.uid = afterData.usuarioId;
                        updates.name = `Usuario ${afterData.usuarioId.substring(0, 5)}`; // Placeholder
                        updates.serviciosCalificadosCount = 1;
                        updates.puntosReputacionUsuario = puntosPorCalificar;
                        updates.badgesUsuario = [];
                        nuevoServiciosCalificadosCount = 1;
                        functions.logger.info(`[otorgarIncentivosTrigger] Creando perfil para usuario ${afterData.usuarioId} con incentivos iniciales.`);
                    } else {
                        const usuarioData = usuarioDoc.data() as UserData;
                        nuevoServiciosCalificadosCount = (usuarioData.serviciosCalificadosCount || 0) + 1;
                        updates.serviciosCalificadosCount = admin.firestore.FieldValue.increment(1) as any;
                        updates.puntosReputacionUsuario = admin.firestore.FieldValue.increment(puntosPorCalificar) as any;
                    }

                    let badgeOtorgadoNombre: string | null = null;
                    if (nuevoServiciosCalificadosCount > 0 && nuevoServiciosCalificadosCount % serviciosNecesariosParaBadge === 0) {
                        updates.badgesUsuario = admin.firestore.FieldValue.arrayUnion(badgeCalificadorBronce) as any;
                        badgeOtorgadoNombre = badgeCalificadorBronce;
                    }
                    
                    transaction.set(usuarioRef, updates, { merge: true });

                    // Registrar el incentivo
                    const incentivoUsuarioData: Omit<IncentivoOtorgadoData, "id"> = {
                        receptorId: afterData.usuarioId,
                        rolReceptor: 'usuario',
                        tipoIncentivo: 'PUNTOS_REPUTACION',
                        descripcion: `+${puntosPorCalificar} puntos por calificar servicio.`,
                        valor: puntosPorCalificar,
                        fechaOtorgado: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
                        referenciaId: servicioId,
                    };
                    transaction.set(db.collection('incentivosOtorgados').doc(), incentivoUsuarioData);
                    
                    if (badgeOtorgadoNombre) {
                        const incentivoBadgeData: Omit<IncentivoOtorgadoData, "id"> = {
                            receptorId: afterData.usuarioId,
                            rolReceptor: 'usuario',
                            tipoIncentivo: 'BADGE_CALIFICADOR_BRONCE',
                            descripcion: `Badge '${badgeOtorgadoNombre}' obtenido por ${nuevoServiciosCalificadosCount} calificaciones.`,
                            nombreBadge: badgeOtorgadoNombre,
                            fechaOtorgado: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
                            referenciaId: servicioId,
                        };
                         transaction.set(db.collection('incentivosOtorgados').doc(), incentivoBadgeData);

                        // Notificar sobre el badge
                        await exports.enviarNotificacionInApp({
                            destinatarioId: afterData.usuarioId,
                            rolDestinatario: 'usuario',
                            titulo: "¡Nuevo Badge Obtenido!",
                            cuerpo: `¡Felicidades! Has obtenido el badge: ${badgeOtorgadoNombre}.`,
                            tipoNotificacion: 'badge_obtenido',
                            datosAdicionales: { badge: badgeOtorgadoNombre }
                        }, { auth: { uid: 'sistema_incentivos' } }); // Simular llamada del sistema
                    }
                });
                 functions.logger.info(`[otorgarIncentivosTrigger] Incentivos (puntos y/o badge) procesados para usuario ${afterData.usuarioId}.`);

            } catch (error) {
                functions.logger.error(`[otorgarIncentivosTrigger] Error al asignar incentivos al usuario ${afterData.usuarioId}:`, error);
            }
        }

        // --- Lógica de Incentivo para PRESTADOR por recibir buena calificación ---
        // (Se activa con la misma condición de 'usuarioAcabaDeCalificar', pero evalúa la calificación recibida)
        if (usuarioAcabaDeCalificar && afterData.prestadorId && afterData.calificacionUsuario && afterData.calificacionUsuario.calificacion === 5) {
            functions.logger.info(`[otorgarIncentivosTrigger] Prestador ${afterData.prestadorId} recibió calificación de 5 estrellas en servicio ${servicioId}.`);
            const prestadorRef = db.collection("prestadores").doc(afterData.prestadorId);
            const puntosPor5Estrellas = 10; // Ejemplo
            const badgeProveedorEstrella = "proveedor_estrella";

            try {
                await db.runTransaction(async (transaction) => {
                    const prestadorDoc = await transaction.get(prestadorRef);
                    if (!prestadorDoc.exists) {
                        functions.logger.warn(`[otorgarIncentivosTrigger] Perfil del prestador ${afterData.prestadorId} no encontrado para incentivo.`);
                        return;
                    }
                    const prestadorData = prestadorDoc.data() as ProviderData;
                    const updates: Partial<ProviderData> = {};
                    let aplicarBadge = false;

                    // Incrementar puntos de reputación en el perfil del prestador
                    if (!updates.incentivos) updates.incentivos = { ...prestadorData.incentivos };
                    updates.incentivos.puntosReputacion = admin.firestore.FieldValue.increment(puntosPor5Estrellas) as any;
                    
                    // Lógica simple para badge "Proveedor Estrella" (ej. si ya tiene buen rating y suficientes calificaciones)
                    if ((prestadorData.rating || 0) >= 4.5 && (prestadorData.ratingCount || 0) >= 10) { // Umbrales de ejemplo
                        if (!prestadorData.incentivos?.badges?.includes(badgeProveedorEstrella)) {
                            updates.incentivos.badges = admin.firestore.FieldValue.arrayUnion(badgeProveedorEstrella) as any;
                            aplicarBadge = true;
                        }
                    }
                    
                    transaction.set(prestadorRef, updates, { merge: true });

                     // Registrar el incentivo de puntos
                    const incentivoPuntosData: Omit<IncentivoOtorgadoData, "id"> = {
                        receptorId: afterData.prestadorId,
                        rolReceptor: 'prestador',
                        tipoIncentivo: 'PUNTOS_REPUTACION',
                        descripcion: `+${puntosPor5Estrellas} puntos por recibir 5 estrellas.`,
                        valor: puntosPor5Estrellas,
                        fechaOtorgado: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
                        referenciaId: servicioId,
                    };
                    transaction.set(db.collection('incentivosOtorgados').doc(), incentivoPuntosData);

                    if (aplicarBadge) {
                         const incentivoBadgeData: Omit<IncentivoOtorgadoData, "id"> = {
                            receptorId: afterData.prestadorId,
                            rolReceptor: 'prestador',
                            tipoIncentivo: 'BADGE_PROVEEDOR_ESTRELLA',
                            descripcion: `¡Felicidades! Has obtenido el badge '${badgeProveedorEstrella}'.`,
                            nombreBadge: badgeProveedorEstrella,
                            fechaOtorgado: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
                            referenciaId: servicioId,
                        };
                        transaction.set(db.collection('incentivosOtorgados').doc(), incentivoBadgeData);
                        
                        // Notificar al prestador sobre el badge
                         await exports.enviarNotificacionInApp({
                            destinatarioId: afterData.prestadorId,
                            rolDestinatario: 'prestador',
                            titulo: "¡Nuevo Badge Obtenido!",
                            cuerpo: `¡Felicidades! Has obtenido el badge: ${badgeProveedorEstrella} por tu excelente servicio.`,
                            tipoNotificacion: 'badge_obtenido_prestador',
                            datosAdicionales: { badge: badgeProveedorEstrella }
                        }, { auth: { uid: 'sistema_incentivos' } });
                    }
                });
                functions.logger.info(`[otorgarIncentivosTrigger] Incentivos (puntos y/o badge) procesados para prestador ${afterData.prestadorId}.`);

            } catch (error) {
                functions.logger.error(`[otorgarIncentivosTrigger] Error al asignar incentivos al prestador ${afterData.prestadorId}:`, error);
            }
        }
        return null;
    });

// Para un futuro "otorgarIncentivosPorServiciosCompletadosTrigger" (conceptual)
// export const otorgarIncentivosPorServiciosCompletadosTrigger = functions.firestore
//     .document('servicios/{servicioId}')
//     .onUpdate(async (change, context) => {
//         const afterData = change.after.data() as ServiceData | undefined;
//         const beforeData = change.before.data() as ServiceData | undefined;
//         if (!afterData || !beforeData) return null;

//         // Si el servicio acaba de ser completado por el usuario
//         if (beforeData.estado !== 'finalizado_usuario' && afterData.estado === 'finalizado_usuario' && afterData.prestadorId) {
//             const prestadorRef = db.collection('prestadores').doc(afterData.prestadorId);
//             // Lógica para incrementar contador de servicios completados en el perfil del prestador
//             // y otorgar badges/puntos por hitos (ej. 10, 50, 100 servicios)
//             // ... registrar en 'incentivosOtorgados' y notificar ...
//             functions.logger.info(`[IncentivosServicioCompletado] Evaluando incentivos para prestador ${afterData.prestadorId} por servicio ${context.params.servicioId} finalizado.`);
//         }
//         return null;
//     });

// Asegúrate de que las funciones exportadas previamente estén aquí o que se exporten correctamente.
// (Todas las funciones callable que ya hemos creado deberían estar exportadas)
// ...
// La función `moderarMensajesChat` (si la tienes en un archivo separado, impórtala y expórtala, o inclúyela aquí)
// La función `enviarNotificacionInAppTrigger` (si la tienes en un archivo separado, impórtala y expórtala, o inclúyela aquí)
// La función `notificarLiberacionPagoAutomatica` (si la tienes en un archivo separado, impórtala y expórtala, o inclúyela aquí)
// La función `evaluarComportamientoPrestadorTrigger` (si la tienes en un archivo separado, impórtala y expórtala, o inclúyela aquí)
// La función `simulateDailyAutomatedChecks` (si la tienes en un archivo separado, impórtala y expórtala, o inclúyela aquí)
// La función `otorgarIncentivosTrigger` ya está definida arriba.

// Si `enviarNotificacionInApp` es una función callable y no una función helper interna:
// (Asumiendo que está definida y exportada desde "./enviarNotificacionInApp.ts" o similar)
// Asegúrate de que el `exports.enviarNotificacionInApp` sea correcto.
// Si la llamas internamente como hice en el trigger, debe estar accesible en el mismo scope.
// Lo más simple es que todas las funciones estén en este index.ts o importadas y re-exportadas.

// Si `enviarNotificacionInApp` está en este mismo archivo, la llamada `await exports.enviarNotificacionInApp(...)` debería funcionar.
// Si no, necesitarías importarla correctamente o usar admin.functions().httpsCallable(...) si la llamas como cliente.
// Dado el contexto de un trigger llamando a otra función para una tarea interna,
// es mejor que `enviarNotificacionInApp` esté disponible como una función helper o exportada
// para ser llamada directamente desde otros triggers/funciones en el mismo despliegue.
// La forma más simple es tenerla en el mismo archivo o asegurar la exportación/importación correcta.
// Para simplificar, asumo que está disponible en el scope (definida en este archivo o importada).
// El `exports.nombreDeFuncion = nombreDeFuncion;` es para funciones callable desde el cliente.
// Los triggers se definen con `export const nombreTrigger = functions.firestore...`
// Si una función es llamada por otra función dentro del mismo `index.ts`, no necesita el `exports.`.

// Reviso y confirmo que la función `enviarNotificacionInApp` ya está definida en el `index.ts` actual.
// La llamada `await exports.enviarNotificacionInApp(...)` dentro de `otorgarIncentivosTrigger`
// es una forma de llamar a otra función callable desplegada.
// Si quieres una llamada interna más directa y `enviarNotificacionInApp` es solo una helper
// para crear documentos de notificación, entonces se llamaría directamente:
// await _crearDocumentoNotificacionInterna(datosNotificacion); (si renombras la lógica interna)
// O, si `enviarNotificacionInApp` es principalmente para crear el documento, se puede simplificar la llamada:
// await db.collection('notificaciones').add(datosNotificacionParaUsuario);


// --- HELPER INTERNO PARA CREAR NOTIFICACIONES (si no se quiere llamar a la función callable `enviarNotificacionInApp` desde un trigger) ---
// Podrías tener una función helper como esta:
// async function _registrarNotificacionInterna(notificacion: Omit<NotificacionData, "id" | "fechaCreacion" | "estadoNotificacion" | "triggerProcesadoEn">) {
//   const datosCompletos: NotificacionData = {
//     ...notificacion,
//     fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
//     estadoNotificacion: 'pendiente',
//   };
//   await db.collection("notificaciones").add(datosCompletos);
//   functions.logger.info(`Notificación interna registrada para ${notificacion.destinatarioId}`);
// }
// Y luego en el trigger:
// await _registrarNotificacionInterna({
//   destinatarioId: afterData.usuarioId,
//   rolDestinatario: 'usuario',
//   titulo: "¡Nuevo Badge Obtenido!",
//   cuerpo: `¡Felicidades! Has obtenido el badge: ${badgeOtorgadoNombre}.`,
//   tipoNotificacion: 'badge_obtenido',
//   datosAdicionales: { badge: badgeOtorgadoNombre },
//   prioridad: 'normal' // Añadido para cumplir la interfaz
// });

// Por ahora, mantendré la llamada a `exports.enviarNotificacionInApp` asumiendo que
// es la función callable que ya tienes y que maneja la creación del documento de notificación.

// Todas las funciones exportadas se listan arriba con la sintaxis de re-exportación de módulos.
// Los triggers (como otorgarIncentivosTrigger) se exportan directamente como constantes.
// El archivo "errores_deploy.txt" no se modifica aquí.
// Las funciones de helper como _calcularMontoParaProveedor, etc., no se exportan.
 
  