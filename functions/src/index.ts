
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ImageAnnotatorClient } from "@google-cloud/vision";

admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// --- CONSTANTES ---
const STANDARD_WARRANTY_DAYS = 3; // Días de garantía estándar para usuarios normales
const PREMIUM_WARRANTY_DAYS = 7;  // Días de garantía para usuarios premium
const RATING_AND_DISPUTE_WINDOW_DAYS = 3; // Días para calificar o reportar problema antes de liberación automática de pago

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
  | "pendiente_confirmacion_usuario" // Estado inicial para servicios que requieren confirmación de pago del usuario
  | "retenido_para_liberacion"     // Pago procesado y retenido, esperando ventana de calificación/disputa
  | "liberado_al_proveedor"        // Pago liberado al proveedor
  | "congelado_por_disputa"        // Pago congelado debido a una disputa
  | "reembolsado_parcial"
  | "reembolsado_total"
  | "no_aplica"                    // Para citas/servicios que aún no llegan al punto de cobro
  | "pendiente_cobro"              // Cita confirmada por prestador, lista para cobro (usado en `procesarCobroTrasConfirmacion`)
  | "procesado_exitosamente"       // Cobro de cita/servicio realizado (el dinero está ahora en la plataforma, listo para retenerse)
  | "fallido";                     // Fallo en el cobro de cita/servicio

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
  fechaConfirmacion?: admin.firestore.Timestamp; // Confirmación del usuario (anteriormente userConfirmedCompletionAt)
  userConfirmedCompletionAt?: admin.firestore.Timestamp; // Mantener por si se usa en otro lado, pero fechaConfirmacion es el nuevo estándar.
  habilitarCalificacion?: boolean;
  ratingWindowExpiresAt?: admin.firestore.Timestamp; // Ventana de 3 días para calificar/disputar
  calificacionUsuario?: RatingData;
  calificacionPrestador?: RatingData;
  mutualRatingCompleted?: boolean;

  paymentStatus?: PaymentStatus;
  fechaLiberacionPago?: admin.firestore.Timestamp;
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;
  ordenCobroId?: string;

  warrantyEndDate?: string; // YYYY-MM-DD
  garantiaSolicitada?: boolean;
  idSolicitudGarantia?: string;
  garantiaResultado?: "aprobada" | "rechazada";
  compensacionAutorizada?: boolean;

  detallesDisputa?: {
    reportadoEn: admin.firestore.Timestamp;
    detalle: string;
    reporteId?: string;
  };
  [key: string]: any; // Para permitir otros campos
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

  confirmacionesCount?: number; // Para citas
  rechazosCount?: number;       // Para citas
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
}

interface UserData { // Para la colección `usuarios`
  uid?: string;
  name?: string;
  ratingSumUsuario?: number;    // Suma de calificaciones recibidas POR el usuario de prestadores
  ratingCountUsuario?: number;  // Conteo de calificaciones recibidas POR el usuario
  ratingUsuario?: number;       // Promedio de calificaciones recibidas POR el usuario
  isPremium?: boolean;
  membresiaActual?: string;

  serviciosCalificadosCount?: number; // Cuántos servicios HA CALIFICADO este usuario
  puntosReputacionUsuario?: number; // Puntos por participar, calificar, etc.
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

interface DocumentoPrestadorData { // Para la colección `documentosPrestadores`
  id?: string;
  prestadorId: string;
  tipoDocumento: string;
  urlDocumento: string;
  nombreArchivo?: string;
  estadoRevision: "pendiente" | "aprobado" | "rechazado";
  fechaSubida: admin.firestore.Timestamp;
  fechaRevision?: admin.firestore.Timestamp;
  revisadoPor?: string; // UID del admin/moderador
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
  resueltaPor?: string; // UID del admin/moderador
}

interface CitaData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  fechaHoraSolicitada: admin.firestore.Timestamp;
  detallesServicio: string;
  ubicacion?: { tipo: "actual" | "personalizada"; direccion?: string; lat?: number; lng?: number };
  notasAdicionales?: string;
  estado: CitaEstado; // 'pendiente_confirmacion', 'confirmada_prestador', 'rechazada_prestador', 'cancelada_usuario', 'cancelada_prestador', 'pagada'
  fechaCreacion: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;

  fechaConfirmacionPrestador?: admin.firestore.Timestamp;
  fechaRechazoPrestador?: admin.firestore.Timestamp;
  fechaCancelacion?: admin.firestore.Timestamp;
  canceladaPor?: string; // UID
  rolCancelador?: 'usuario' | 'prestador';

  serviceType?: "fixed" | "hourly";
  precioServicio?: number; // Para fixed
  tarifaPorHora?: number;  // Para hourly
  duracionHoras?: number;  // Para hourly
  montoTotalEstimado?: number;

  // Campos relacionados al pago de la cita
  ordenCobroId?: string; // ID de la pasarela de pago, si aplica
  paymentStatus?: PaymentStatus; // 'pendiente_cobro', 'procesado_exitosamente', 'fallido'
  fechaCobro?: admin.firestore.Timestamp;
  montoCobrado?: number;
}

interface NotificacionData {
  id?: string;
  destinatarioId: string;
  rolDestinatario: 'usuario' | 'prestador';
  titulo: string;
  cuerpo: string;
  estadoNotificacion: 'pendiente' | 'leida' | 'procesada_por_trigger'; // 'procesada_por_trigger' indica que el trigger de envio ya la vio
  fechaCreacion: admin.firestore.Timestamp;
  fechaLectura?: admin.firestore.Timestamp;
  tipoNotificacion: string; // Ej: 'cita_confirmada', 'pago_recibido'
  prioridad: 'alta' | 'normal';
  datosAdicionales?: { [key: string]: any }; // Ej: { citaId: 'xyz', servicioId: 'abc' }
  enlaceOpcional?: string; // Nuevo campo
  triggerProcesadoEn?: admin.firestore.Timestamp; // Para evitar reprocesamiento por el trigger de envio
}

interface MembresiaData {
  userId: string; // UID del usuario o prestador
  rol: 'usuario' | 'prestador';
  tipoMembresia: string; // Ej: "gratis", "premium_mensual_usuario", "premium_anual_prestador"
  fechaInicio: admin.firestore.Timestamp;
  fechaExpiracion: admin.firestore.Timestamp;
  estadoMembresia: 'activa' | 'vencida' | 'cancelada' | 'pendiente_pago';
  beneficiosAdicionales?: {
    descuentoComisionPorcentaje?: number; // Para prestadores, ej. 3 (para 3%)
    descuentoComisionAbsoluto?: number; // Alternativa o complemento al porcentual
    prioridadAgenda?: boolean; // Para usuarios
    garantiaExtendidaDiasAdicionales?: number; // Para usuarios (ej. 7 días extra sobre el estándar)
  };
  stripeSubscriptionId?: string; // O el ID de la plataforma de pago
  mercadoPagoSubscriptionId?: string;
  ultimoPaymentIntentId?: string; // Para referencia del último pago
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
    beneficios: { descuentoComisionPorcentaje: 3 }, // Comisión reducida al 3%
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
  textoOriginal?: string; // Para guardar el texto original si es moderado
}

interface ChatDataFirestore {
  id?: string;
  participantesUids: string[]; // Array de UIDs [uid1, uid2] ordenados alfabéticamente
  participantesInfo?: {
    [uid: string]: { rol: 'usuario' | 'prestador'; nombre?: string; avatarUrl?: string };
  };
  mensajes?: MensajeDataFirestore[]; // Podría ser una subcolección para escalabilidad
  estadoChat: 'activo' | 'archivado_usuario' | 'archivado_prestador' | 'finalizado_por_servicio';
  fechaCreacion: admin.firestore.Timestamp;
  ultimaActualizacion: admin.firestore.Timestamp;
  ultimoMensajeTexto?: string; // Snippet del último mensaje
  ultimoMensajeTimestamp?: admin.firestore.Timestamp;
  ultimoMensajeRemitenteId?: string;
  conteoNoLeido?: { [uid: string]: number }; // Ej: { uid1: 0, uid2: 5 }
  metadataAdicional?: { [key: string]: any }; // Ej: { servicioId: "xyz" }
}

type EstadoContrato = 'pendiente_aceptacion_usuario' | 'pendiente_aceptacion_prestador' | 'aceptado_ambos' | 'rechazado_usuario' | 'rechazado_prestador' | 'cancelado_sistema';

interface ContratoServicioData {
  id?: string;
  referenciaId: string; // ID del servicio o cita
  tipoReferencia: 'servicio' | 'cita';
  usuarioId: string;
  prestadorId: string;
  fechaCreacionContrato: admin.firestore.Timestamp;
  textoContrato: string; // El texto completo del contrato generado
  estadoContrato: EstadoContrato;
  fechaAceptacionUsuario?: admin.firestore.Timestamp;
  fechaAceptacionPrestador?: admin.firestore.Timestamp;
  fechaRechazoUsuario?: admin.firestore.Timestamp;
  fechaRechazoPrestador?: admin.firestore.Timestamp;
  infoServicioOriginal?: { // Snapshot de los datos del servicio/cita al momento de crear el contrato
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
  descripcionServicio?: string; // Para futura IA
  preferenciasUsuario?: { // Para futura IA o lógica de historial
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
  score?: number; // Puntuación de recomendación
  avatarUrl?: string;
  sortPrice?: number; // Precio representativo para ordenar por precio
}

interface ServicioDestacadoData {
  id?: string; // ID del documento en serviciosDestacados
  servicioId: string; // ID del servicio original en la colección `servicios` de un prestador
  prestadorId: string;
  descripcionPromocional: string;
  fechaInicio: admin.firestore.Timestamp;
  fechaFin: admin.firestore.Timestamp;
  prioridad?: number; // Para ordenar, menor es más importante
  urlImagenPromocional?: string;
  urlVideoPromocional?: string;
}

type EstadoSolicitudSoporte = 'pendiente' | 'en_proceso' | 'esperando_respuesta_usuario' | 'resuelto' | 'cerrado';

interface SoporteTicketData {
  id?: string;
  solicitanteId: string;
  rolSolicitante: 'usuario' | 'prestador';
  tipoSoporte: string; // Ej: "problema_pago", "duda_general", "soporte_tecnico"
  mensaje: string; // Mensaje inicial del solicitante
  estadoSolicitud: EstadoSolicitudSoporte;
  fechaCreacion: admin.firestore.Timestamp;
  referenciaId?: string; // Ej: servicioId, citaId, pagoId
  historialConversacion?: { // Para respuestas del equipo de soporte y del usuario
    remitenteId: string; // Puede ser el solicitante o un UID de admin/soporte
    mensaje: string;
    timestamp: admin.firestore.Timestamp;
  }[];
  asignadoA?: string; // UID del agente de soporte
  respuestaSoporte?: string; // Última respuesta del equipo de soporte (obsoleto si se usa historial)
  fechaRespuestaSoporte?: admin.firestore.Timestamp;
  fechaCierre?: admin.firestore.Timestamp;
  prioridadTicket?: 'baja' | 'normal' | 'alta' | 'urgente';
  adjuntosUrls?: string[]; // URLs a archivos adjuntos
}

interface TraduccionDataFirestore {
  [key: string]: string | admin.firestore.Timestamp | undefined; // es: "Hola", en: "Hello"
  fechaUltimaActualizacion: admin.firestore.Timestamp;
}

interface UbicacionPrestadorData { // Para la colección `ubicacionesPrestadores`
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

interface ValidacionCoberturaData { // Para la colección `validacionesCobertura`
  usuarioId?: string;
  direccionTexto?: string;
  coordenadasAnalizadas: { lat: number; lng: number } | null;
  estaEnCobertura: boolean;
  zonaId?: string;
  mensajeResultado: string;
  fechaValidacion: admin.firestore.Timestamp;
}

interface ValidacionConPrestadoresData { // Para la colección `validacionesConPrestadores`
  usuarioId?: string;
  direccionTexto?: string;
  coordenadasAnalizadas: { lat: number; lng: number } | null;
  estaEnCobertura: boolean;
  zonaId?: string;
  mensajeResultado: string;
  prestadoresSugeridosIds?: string[];
  filtrosAplicados?: any; // El objeto de filtros que se usó
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
  enlacePerfil: string; // ej. /perfil-prestador/{id}
}

interface HistorialItemDetallado {
  id: string; // ID de la cita o servicio
  tipo: 'cita' | 'servicio';
  estado: CitaEstado | ServiceRequestStatus;
  participanteContrarioId: string; // ID del prestador (si solicitante es usuario) o usuario (si solicitante es prestador)
  participanteContrarioNombre?: string; // Nombre del otro participante (se podría obtener si es necesario)
  fechaRelevante: admin.firestore.Timestamp; // fechaCreacion (citas) o fechaSolicitud/updatedAt (servicios)
  fechaServicioProgramada?: string; // Formateado YYYY-MM-DD HH:mm
  detallesPrincipales?: string; // detallesServicio o descripción
  ubicacion?: any;
  montoEstimado?: number;
  calificadoPorSolicitante: boolean;
}



// --- FUNCIONES HELPER ---

async function getMockUser(userId: string): Promise<UserData | null> {
  // En una app real, esto leería de Firestore o usaría context.auth.token
  if (userId === "currentUserDemoId") { // Asumir que este es premium
    return { uid: userId, name: "Usuario Premium Demo", isPremium: true, membresiaActual: "premium_anual_usuario" };
  }
  if (userId === "standardUserDemoId") {
    return { uid: userId, name: "Usuario Estándar Demo", isPremium: false, membresiaActual: "gratis" };
  }
  // Simular lectura de Firestore para otros usuarios
  const userRef = db.collection("usuarios").doc(userId);
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    return userDoc.data() as UserData;
  }
  return null; // O un objeto UserData por defecto
}

// Función conceptual para calcular el monto que va al proveedor después de comisiones
// Esta lógica se integraría donde se procesa la liberación final del pago.
async function _calcularMontoParaProveedor(servicioId: string, montoTotalServicio: number): Promise<number> {
  functions.logger.info(`[Comisiones] Calculando monto para proveedor del servicio: ${servicioId}, monto total: ${montoTotalServicio}`);
  const COMISION_ESTANDAR_PORCENTAJE = 6; // 6% por defecto

  // Obtener el servicio para saber quién es el prestador
  const servicioRef = db.collection("servicios").doc(servicioId); // Asumiendo que es un servicio, ajustar para citas si es necesario
  const servicioDoc = await servicioRef.get();

  if (!servicioDoc.exists) {
    functions.logger.error(`[Comisiones] Servicio ${servicioId} no encontrado.`);
    throw new Error("Servicio no encontrado para calcular comisión.");
  }
  const servicioData = servicioDoc.data() as ServiceData;
  const prestadorId = servicioData.prestadorId;

  // Consultar la membresía del prestador
  const membresiaRef = db.collection("membresias").doc(prestadorId); // Asumiendo que el ID del doc en "membresias" es el prestadorId
  const membresiaDoc = await membresiaRef.get();

  let comisionPorcentaje = COMISION_ESTANDAR_PORCENTAJE;

  if (membresiaDoc.exists) {
    const membresiaData = membresiaDoc.data() as MembresiaData;
    // Verificar que la membresía esté activa y no expirada
    if (membresiaData.estadoMembresia === "activa" && new Date() < membresiaData.fechaExpiracion.toDate()) {
      if (membresiaData.beneficiosAdicionales?.descuentoComisionPorcentaje !== undefined) {
        comisionPorcentaje = membresiaData.beneficiosAdicionales.descuentoComisionPorcentaje;
        functions.logger.info(`[Comisiones] Prestador ${prestadorId} tiene membresía activa con descuento porcentual. Comisión aplicada: ${comisionPorcentaje}%`);
      }
      // Podrías añadir lógica para descuentoComisionAbsoluto aquí si fuera necesario.
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
  return R * c; // Distance in km
};


// --- FUNCIONES CALLABLE ---

export const activarMembresia = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando activarMembresia", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const userId = context.auth.uid; // Este es el ID del documento en la colección 'membresias'
  const { rol, tipoMembresiaDeseado } = data; // rol: 'usuario' o 'prestador'

  if (!rol || (rol !== 'usuario' && rol !== 'prestador')) {
    throw new functions.https.HttpsError("invalid-argument", "El rol ('usuario' o 'prestador') es requerido.");
  }
  if (!tipoMembresiaDeseado || typeof tipoMembresiaDeseado !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "El 'tipoMembresiaDeseado' es requerido y debe ser un string.");
  }

  const planSeleccionado = PLANES_MEMBRESIA[tipoMembresiaDeseado]; // Clave directa ej: "premium_mensual_usuario"

  if (!planSeleccionado) {
    throw new functions.https.HttpsError("not-found", `El plan de membresía '${tipoMembresiaDeseado}' no es válido.`);
  }

  functions.logger.info(`[activarMembresia] Usuario ${userId} (${rol}) solicitando plan: ${tipoMembresiaDeseado}. Precio Simulado: ${planSeleccionado.precioSimulado}`);

  // --- SIMULACIÓN DE PAGO ---
  // En una app real, aquí se integraría con Stripe, MercadoPago, etc.
  // 1. Crear un PaymentIntent/Orden de Pago.
  // 2. Devolver el client_secret al frontend para que el usuario complete el pago.
  // 3. Escuchar un webhook de la pasarela de pago para confirmar el pago exitoso.
  // 4. SOLO DESPUÉS DEL WEBHOOK EXITOSO, activar la membresía en Firestore y los custom claims.
  const pagoExitosoSimulado = true; // Cambiar a false para simular fallo
  const paymentIntentIdSimulado = `sim_pi_${Date.now()}`; // ID de pago simulado

  if (!pagoExitosoSimulado) {
    functions.logger.error(`[activarMembresia] SIMULACIÓN: Pago fallido para ${userId}.`);
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
    userId: userId, // Redundante pero útil para consultas where('userId', ...) si el ID del doc no es el UID
    rol: rol,
    tipoMembresia: tipoMembresiaDeseado, // El nombre completo del plan, ej: "premium_mensual_usuario"
    fechaInicio: fechaInicio,
    fechaExpiracion: fechaExpiracion,
    estadoMembresia: "activa",
    beneficiosAdicionales: planSeleccionado.beneficios, // Guardar los beneficios del plan
    ultimoPaymentIntentId: paymentIntentIdSimulado, // Referencia al pago
  };

  try {
    await membresiaRef.set(membresiaData, { merge: true }); // Usar set con merge para crear o sobrescribir/actualizar
    functions.logger.info(`[activarMembresia] Documento de membresía para ${userId} creado/actualizado.`);

    // Actualizar Custom Claims del usuario para acceso rápido a su estado de membresía
    const currentClaims = (await admin.auth().getUser(userId)).customClaims || {};
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims,
      premium: tipoMembresiaDeseado.startsWith("premium"), // `true` si es cualquier plan premium
      rol: rol, // El rol principal del usuario en la plataforma
      membresiaTipo: tipoMembresiaDeseado, // El tipo de membresía específico
      membresiaExpiraEpoch: fechaExpiracion.toMillis(), // Útil para verificar expiración en reglas de seguridad
    });
    functions.logger.info(`[activarMembresia] Custom claims actualizados para ${userId}.`);

    // Actualizar el perfil del usuario/prestador con su membresía actual
    const perfilCollection = rol === 'usuario' ? "usuarios" : "prestadores";
    const perfilRef = db.collection(perfilCollection).doc(userId);
    await perfilRef.set({
      membresiaActual: tipoMembresiaDeseado,
      isPremium: tipoMembresiaDeseado.startsWith("premium"), // Campo redundante para facilitar consultas
      fechaExpiracionMembresia: fechaExpiracion, // También útil en el perfil
    }, { merge: true });
    functions.logger.info(`[activarMembresia] Perfil en colección '${perfilCollection}' actualizado para ${userId}.`);


    return {
      success: true,
      message: `Membresía '${tipoMembresiaDeseado}' activada exitosamente hasta ${fechaExpiracionDate.toLocaleDateString()}.`,
      membresiaId: membresiaRef.id, // Es el mismo que userId
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
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const userId = context.auth.uid;
  const { servicioId } = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere un 'servicioId' válido.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);

  try {
    await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }

      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.usuarioId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No estás autorizado para confirmar este servicio.");
      }

      // Solo permitir confirmar si el proveedor ya marcó como completado
      if (servicioData.estado !== "completado_por_prestador") {
        throw new functions.https.HttpsError("failed-precondition", `El servicio debe estar en estado 'completado_por_prestador'. Estado actual: ${servicioData.estado}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const ratingAndDisputeWindowEndDate = new Date(now.toDate().getTime() + RATING_AND_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const ratingWindowExpiresTimestamp = admin.firestore.Timestamp.fromDate(ratingAndDisputeWindowEndDate);

      let warrantyDays = STANDARD_WARRANTY_DAYS;
      const userProfile = await getMockUser(userId); // Simula obtener perfil del usuario

      if (userProfile?.isPremium) {
        // Podrías obtener los días exactos de la membresía si el beneficio es variable
        const membresiaRef = db.collection("membresias").doc(userId);
        const membresiaDoc = await transaction.get(membresiaRef); // Leer dentro de la transacción
        if (membresiaDoc.exists) {
            const membresiaData = membresiaDoc.data() as MembresiaData;
            if (membresiaData.estadoMembresia === "activa" && membresiaData.beneficiosAdicionales?.garantiaExtendidaDiasAdicionales) {
                warrantyDays = STANDARD_WARRANTY_DAYS + membresiaData.beneficiosAdicionales.garantiaExtendidaDiasAdicionales;
            } else if (membresiaData.estadoMembresia === "activa") { // Si es premium pero sin beneficio específico, usa el default premium
                 warrantyDays = PREMIUM_WARRANTY_DAYS;
            }
        } else { // Fallback si no hay doc de membresía pero el claim indica premium
            warrantyDays = PREMIUM_WARRANTY_DAYS;
        }
      }
      
      const warrantyEndDateDt = new Date(now.toDate().getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      transaction.update(servicioRef, {
        estado: "completado_por_usuario", // Nuevo estado
        fechaConfirmacion: now, // Fecha de confirmación del usuario
        userConfirmedCompletionAt: now, // Mantener por compatibilidad, pero fechaConfirmacion es más genérico
        habilitarCalificacion: true,
        paymentStatus: "retenido_para_liberacion",
        ratingWindowExpiresAt: ratingWindowExpiresTimestamp, // Ventana para calificar y disputar
        warrantyEndDate: warrantyEndDateDt.toISOString().split("T")[0], // Guardar como YYYY-MM-DD
        updatedAt: now,
      });
      functions.logger.info(`Servicio ${servicioId} confirmado por usuario ${userId}. Pago retenido. Ventana de calificación/disputa de ${RATING_AND_DISPUTE_WINDOW_DAYS} días. Garantía de ${warrantyDays} días establecida hasta ${warrantyEndDateDt.toISOString().split("T")[0]}.`);
    });

    return { success: true, message: "Servicio confirmado exitosamente. Ya puedes calificar al prestador y el pago está retenido." };
  } catch (error: any) {
    functions.logger.error("Error en confirmServiceCompletionByUserService:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al confirmar el servicio.", error.message);
  }
});


// Anteriormente calificarPrestador, ahora gestionarCalificacionYPago
export const gestionarCalificacionYPago = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando gestionarCalificacionYPago (calificación de usuario a prestador)", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const userId = context.auth.uid; // Usuario que califica
  const { servicioId, calificacion, comentario } = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'servicioId'.");
  }
  if (typeof calificacion !== "number" || calificacion < 1 || calificacion > 5) {
    throw new functions.https.HttpsError("invalid-argument", "La 'calificacion' debe ser un número entre 1 y 5.");
  }
  if (comentario && typeof comentario !== "string") { // Comentario es opcional
    throw new functions.https.HttpsError("invalid-argument", "El 'comentario' debe ser un string si se proporciona.");
  }

  const servicioRef = db.collection("servicios").doc(servicioId);
  const prestadorCollectionRef = db.collection("prestadores"); // Asumiendo que aquí están los perfiles de prestadores

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceData;

      if (servicioData.usuarioId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No puedes calificar este servicio, no eres el solicitante.");
      }
      if (!servicioData.habilitarCalificacion) {
        throw new functions.https.HttpsError("failed-precondition", "La calificación para este servicio no está habilitada. Asegúrate de haber confirmado la finalización primero.");
      }
      if (servicioData.calificacionUsuario) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado este servicio previamente.");
      }
      if (servicioData.estado === "en_disputa") {
         throw new functions.https.HttpsError("failed-precondition", "No se puede calificar un servicio que está en disputa.");
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        // Si la ventana expiró, actualizamos para que ya no se pueda calificar y no se libera pago aquí.
        // El cron job (simulateDailyAutomatedChecks) se encargará de la liberación si no hubo disputa.
        transaction.update(servicioRef, { habilitarCalificacion: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
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

      transaction.set(prestadorDocRef, {
        uid: servicioData.prestadorId,
        name: prestadorDoc.exists() ? (prestadorDoc.data() as ProviderData).name : `Prestador ${servicioData.prestadorId.substring(0, 5)}`,
        ratingSum: newRatingSum,
        ratingCount: newRatingCount,
        rating: currentRating,
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> & { updatedAt: admin.firestore.FieldValue } = {
        calificacionUsuario: nuevaCalificacionUsuario,
        estado: "cerrado_con_calificacion", // Servicio se cierra al ser calificado (si no está en disputa)
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Si el prestador también ya calificó al usuario
      if (servicioData.calificacionPrestador) {
        servicioUpdate.mutualRatingCompleted = true;
      }
      
      // Liberar pago si se califica dentro del plazo y no hay disputa
      // (Punto 3 del prompt: "Si el usuario califica dentro del plazo, el pago se libera al prestador automáticamente.")
      if (servicioData.paymentStatus === "retenido_para_liberacion") { // Solo si estaba retenido
         // La verificación de 'ratingWindowExpiresAt' ya se hizo arriba.
         // La verificación de 'en_disputa' también se hizo arriba.
        servicioUpdate.paymentStatus = "liberado_al_proveedor";
        servicioUpdate.fechaLiberacionPago = admin.firestore.Timestamp.now();
        functions.logger.info(`[gestionarCalificacionYPago] Pago para servicio ${servicioId} liberado al prestador ${servicioData.prestadorId} debido a calificación oportuna.`);
      }

      transaction.update(servicioRef, servicioUpdate);

      functions.logger.info(`Usuario ${userId} calificó servicio ${servicioId} para prestador ${servicioData.prestadorId}.`);
      return { success: true, message: "Calificación registrada y pago procesado (si aplicaba)." };
    });
  } catch (error: any) {
    functions.logger.error("Error en gestionarCalificacionYPago:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al registrar la calificación.", error.message);
  }
});


export const calificarUsuario = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando calificarUsuario (prestador califica a usuario)", { structuredData: true, data });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const prestadorId = context.auth.uid; // Prestador que califica
  const { servicioId, calificacion, comentario } = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'servicioId'.");
  }
  if (typeof calificacion !== "number" || calificacion < 1 || calificacion > 5) {
    throw new functions.https.HttpsError("invalid-argument", "La 'calificacion' debe ser un número entre 1 y 5.");
  }
  if (comentario && typeof comentario !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El 'comentario' debe ser un string si se proporciona.");
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
        throw new functions.https.HttpsError("permission-denied", "No puedes calificar este servicio, no eres el prestador asignado.");
      }
      // El prestador solo puede calificar si el usuario ya confirmó la finalización del servicio.
      if (!servicioData.habilitarCalificacion || servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_con_calificacion") {
        throw new functions.https.HttpsError("failed-precondition", "La calificación mutua no está habilitada o el servicio no está en un estado adecuado (el usuario debe confirmar primero o ya debe estar calificado por el usuario).");
      }
      if (servicioData.calificacionPrestador) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado a este usuario para este servicio.");
      }
      // Podrías añadir una lógica de ventana de tiempo para el prestador si es necesario, similar a `ratingWindowExpiresAt`
      // if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
      //   throw new functions.https.HttpsError("failed-precondition", "El período para calificar a este usuario ha expirado.");
      // }


      const nuevaCalificacionPrestador: RatingData = {
        calificacion: calificacion,
        fecha: admin.firestore.Timestamp.now(),
        ...(comentario && { comentario: comentario }),
      };

      const usuarioDocRef = usuarioCollectionRef.doc(servicioData.usuarioId);
      const usuarioDoc = await transaction.get(usuarioDocRef);
      let newRatingSumUsuario = calificacion;
      let newRatingCountUsuario = 1;
      let userName = `Usuario ${servicioData.usuarioId.substring(0, 5)}`;

      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data() as UserData;
        newRatingSumUsuario = (usuarioData.ratingSumUsuario || 0) + calificacion;
        newRatingCountUsuario = (usuarioData.ratingCountUsuario || 0) + 1;
        userName = usuarioData.name || userName;
      }
      const currentRatingUsuario = newRatingCountUsuario > 0 ? parseFloat((newRatingSumUsuario / newRatingCountUsuario).toFixed(2)) : 0;

      transaction.set(usuarioDocRef, {
        uid: servicioData.usuarioId,
        name: userName,
        ratingSumUsuario: newRatingSumUsuario,
        ratingCountUsuario: newRatingCountUsuario,
        ratingUsuario: currentRatingUsuario,
      }, { merge: true });

      const servicioUpdate: Partial<ServiceData> & { updatedAt: admin.firestore.FieldValue } = {
        calificacionPrestador: nuevaCalificacionPrestador,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Si el usuario ya calificó al prestador, la calificación mutua está completa.
      if (servicioData.calificacionUsuario) {
        servicioUpdate.mutualRatingCompleted = true;
        // El estado del servicio ya sería 'cerrado_con_calificacion' por la acción del usuario.
      }
      transaction.update(servicioRef, servicioUpdate);

      functions.logger.info(`Prestador ${prestadorId} calificó al usuario ${servicioData.usuarioId} para el servicio ${servicioId}.`);
      return { success: true, message: "Calificación de usuario registrada exitosamente." };
    });
  } catch (error: any) {
    functions.logger.error("Error en calificarUsuario:", error);
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
  const { servicioId, detalleProblema } = data; // detalleProblema es el motivo/comentario

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

      // Solo se puede reportar si el usuario ya confirmó Y está dentro de la ventana
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_con_calificacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden reportar problemas de servicios confirmados por ti y que no estén ya cerrados o en disputa. Estado actual: ${servicioData.estado}`);
      }
      if (servicioData.ratingWindowExpiresAt && servicioData.ratingWindowExpiresAt.toDate() < new Date()) {
        throw new functions.https.HttpsError("failed-precondition", "El período para reportar un problema para este servicio ha expirado.");
      }
      if (servicioData.estado === "en_disputa") {
        throw new functions.https.HttpsError("failed-precondition", "Ya existe un reporte activo (disputa) para este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      const reporteId = db.collection("reportes").doc().id; // Simular ID de reporte

      transaction.update(servicioRef, {
        estado: "en_disputa",
        paymentStatus: "congelado_por_disputa", // Congelar el pago
        detallesDisputa: {
          reportadoEn: now,
          detalle: detalleProblema,
          reporteId: reporteId, // Enlazar al documento en 'reportes'
        },
        updatedAt: now,
        habilitarCalificacion: false, // Deshabilitar calificación si se abre una disputa
      });

      // Crear un documento en la colección "reportes" (simulado)
      // En una app real, crearías el documento aquí:
      // const datosReporte = { /* ... */ };
      // transaction.set(db.collection("reportes").doc(reporteId), datosReporte);
      functions.logger.info(`SIMULACIÓN: Documento creado en 'reportes' con ID ${reporteId} para servicio ${servicioId}.`);


      functions.logger.info(`Usuario ${usuarioId} reportó problema para servicio ${servicioId}. Reporte ID: ${reporteId}. Pago congelado. Calificación deshabilitada.`);
      // SIMULACIÓN: Notificar al prestador y al admin.
      // await enviarNotificacionInApp({ destinatarioId: servicioData.prestadorId, ... });
      // await enviarNotificacionInApp({ destinatarioId: 'admin_uid', ... });

      return {
        success: true,
        message: "Problema reportado exitosamente. El servicio está ahora en disputa y el pago ha sido congelado.",
        reporteId: reporteId,
      };
    });
  } catch (error: any) {
    functions.logger.error("Error en reportServiceIssue:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al reportar el problema.", error.message);
  }
});


export const obtenerServiciosCompletados = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando obtenerServiciosCompletados (para usuario)", { structuredData: true });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const usuarioId = context.auth.uid;

  try {
    const querySnapshot = await db
      .collection("servicios")
      .where("usuarioId", "==", usuarioId)
      .where("estado", "==", "completado_por_usuario") // Solo aquellos que el usuario ha confirmado
      .orderBy("fechaConfirmacion", "desc") // Los más recientes primero
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
        precio: servicio.precio,
        // Podrías añadir más campos si el frontend los necesita
      });
    });
    functions.logger.info(`Encontrados ${serviciosCompletados.length} servicios completados y confirmados por usuario ${usuarioId}.`);
    return serviciosCompletados;
  } catch (error: any) {
    functions.logger.error("Error al obtener servicios completados por el usuario:", error);
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
        // Si el prestador no tiene perfil, se podría crear uno básico aquí
        functions.logger.info(`Documento del prestador ${prestadorId} no encontrado, creando uno nuevo con el documento.`);
        transaction.set(prestadorRef, {
          uid: prestadorId,
          name: context.auth.token.name || `Prestador ${prestadorId.substring(0, 5)}`,
          documentosVerificables: [nuevoDocumento],
          // ... otros campos por defecto para un nuevo prestador
        });
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

export const validateDocumentAndRemoveContactInfo = functions.runWith({
  timeoutSeconds: 120,
  memory: "512MB",
}).https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validateDocumentAndRemoveContactInfo (Vision API)", { structuredData: true, data });

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
      const documentos = prestadorData.documentosVerificables ? [...prestadorData.documentosVerificables] : [];

      if (documentoIndex >= documentos.length) {
        throw new functions.https.HttpsError("out-of-range", `Índice de documento ${documentoIndex} fuera de rango.`);
      }

      const documentoAVerificar = documentos[documentoIndex];
      if (!documentoAVerificar) {
         throw new functions.https.HttpsError("internal", `No se encontró el documento en el índice ${documentoIndex}.`);
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
    functions.logger.error("Error en validateDocumentAndRemoveContactInfo:", error);
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
      if (servicioData.estado !== "completado_por_usuario" && servicioData.estado !== "cerrado_con_calificacion" && servicioData.estado !== "cerrado_automaticamente") {
        throw new functions.https.HttpsError("failed-precondition", "La garantía solo puede activarse para servicios completados y confirmados.");
      }
      if (servicioData.garantiaSolicitada === true) {
        throw new functions.https.HttpsError("already-exists", "Ya se ha solicitado una garantía para este servicio.");
      }
      
      const warrantyEndDateString = servicioData.warrantyEndDate;
      if (!warrantyEndDateString) {
        throw new functions.https.HttpsError("failed-precondition", "No se encontró fecha de fin de garantía para este servicio.");
      }
      const [year, month, day] = warrantyEndDateString.split('-').map(Number);
      const warrantyEndDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)); // Fin del día en UTC
      
      const currentDate = new Date(); // Fecha actual UTC

      if (currentDate > warrantyEndDate) {
        throw new functions.https.HttpsError("failed-precondition", `El período de garantía ha expirado. Finalizó el ${warrantyEndDateString}.`);
      }

      const nuevaSolicitudGarantiaRef = garantiasRef.doc();
      const nuevaGarantiaData: GarantiaData = {
        servicioId: servicioId,
        usuarioId: usuarioId,
        prestadorId: servicioData.prestadorId,
        motivo: motivo,
        fechaSolicitudGarantia: admin.firestore.Timestamp.now(),
        estadoGarantia: "pendiente",
      };
      transaction.set(nuevaSolicitudGarantiaRef, nuevaGarantiaData);

      transaction.update(servicioRef, {
        garantiaSolicitada: true,
        idSolicitudGarantia: nuevaSolicitudGarantiaRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Garantía premium activada para servicio ${servicioId}. Garantía ID: ${nuevaSolicitudGarantiaRef.id}`);
      // SIMULACIÓN: Notificar al admin.
      // await enviarNotificacionInApp({ ... });

      return {
        success: true,
        message: "Solicitud de garantía premium activada exitosamente.",
        garantiaId: nuevaSolicitudGarantiaRef.id,
        estadoGarantia: "pendiente",
      };
    });
  } catch (error: any) {
    functions.logger.error("Error en activarGarantiaPremium:", error);
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

      const updateGarantiaData: Partial<GarantiaData> & {updatedAt: admin.firestore.Timestamp} = { // Explicitly type updatedAt
        estadoGarantia: decision,
        fechaResolucionGarantia: admin.firestore.Timestamp.now(),
        resolucionDetalles: comentarioResolucion || "",
        resueltaPor: context.auth?.uid,
        updatedAt: admin.firestore.Timestamp.now(), // Add this line
      };
      transaction.update(garantiaRef, updateGarantiaData);

      const servicioRef = db.collection("servicios").doc(garantiaData.servicioId);
      const servicioUpdateData: Partial<ServiceData> & {updatedAt: admin.firestore.Timestamp} = {
        garantiaResultado: decision as "aprobada" | "rechazada",
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (decision === "aprobada") {
        servicioUpdateData.compensacionAutorizada = true;
        functions.logger.info(`Garantía ${garantiaId} aprobada. SIMULACIÓN: Iniciar compensación para servicio ${garantiaData.servicioId}.`);
      } else {
        servicioUpdateData.compensacionAutorizada = false;
      }
      transaction.update(servicioRef, servicioUpdateData);

      functions.logger.info(`Garantía ${garantiaId} resuelta como '${decision}' por admin ${context.auth?.uid}.`);
      // SIMULACIÓN: Notificar al usuario y prestador.
      // await enviarNotificacionInApp({ destinatarioId: garantiaData.usuarioId, ... });
      // await enviarNotificacionInApp({ destinatarioId: garantiaData.prestadorId, ... });

      return { success: true, message: `Solicitud de garantía ${decision} exitosamente.` };
    });
  } catch (error: any) {
    functions.logger.error("Error en resolverGarantiaPremium:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al resolver la garantía.", error.message);
  }
});

export const simulateDailyAutomatedChecks = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    functions.logger.info("Ejecutando simulateDailyAutomatedChecks", { timestamp: context.timestamp });
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    let processedCount = 0;

    // CASO 1: Servicios completados por usuario, pago retenido, ventana de calificación/disputa expirada, sin calificación ni disputa.
    const querySinAccion = db.collection("servicios")
      .where("estado", "==", "completado_por_usuario")
      .where("paymentStatus", "==", "retenido_para_liberacion")
      .where("ratingWindowExpiresAt", "<=", now); // Ventana expiró

    try {
      const snapshotSinAccion = await querySinAccion.get();
      functions.logger.info(`[DailyCheck] Encontrados ${snapshotSinAccion.size} servicios 'completado_por_usuario' con pago 'retenido' y ventana de calificación/disputa expirada.`);
      
      snapshotSinAccion.forEach((doc) => {
        const servicio = doc.data() as ServiceData;
        // Doble chequeo: asegurarse que no haya sido calificado por el usuario y que no esté en disputa.
        // (el estado "completado_por_usuario" ya implica que no está en disputa grave, pero por si acaso)
        if (!servicio.calificacionUsuario && servicio.estado === "completado_por_usuario") {
          functions.logger.info(`[DailyCheck] CERRANDO AUTOMÁTICAMENTE Y LIBERANDO PAGO para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
          batch.update(doc.ref, {
            paymentStatus: "liberado_al_proveedor",
            fechaLiberacionPago: now,
            estado: "cerrado_automaticamente", // Nuevo estado para cierre automático
            updatedAt: now,
            habilitarCalificacion: false, // Desactivar calificación después de la ventana
          });
          processedCount++;
        } else {
           functions.logger.log(`[DailyCheck] Servicio ${doc.id} no cumple condiciones para cierre automático (ya calificado o estado no es 'completado_por_usuario' puro). calificacionUsuario: ${!!servicio.calificacionUsuario}, estado: ${servicio.estado}`);
        }
      });
    } catch (error) {
      functions.logger.error("[DailyCheck] Error consultando servicios para liberación automática:", error);
    }
    
    // CASO 2: Servicios ya calificados por el usuario, pago aún retenido (como un barrido/fallback)
    // La función `gestionarCalificacionYPago` ya debería haber liberado el pago si la calificación fue oportuna.
    // Este es un seguro por si esa liberación no ocurrió o si el flujo fue interrumpido.
    const queryCalificadosPagoRetenido = db.collection("servicios")
        .where("estado", "==", "cerrado_con_calificacion") // Usuario ya calificó
        .where("paymentStatus", "==", "retenido_para_liberacion");

    try {
        const snapshotCalificados = await queryCalificadosPagoRetenido.get();
        functions.logger.info(`[DailyCheck] Encontrados ${snapshotCalificados.size} servicios 'cerrado_con_calificacion' con pago 'retenido_para_liberacion'.`);

        snapshotCalificados.forEach(doc => {
            const servicio = doc.data() as ServiceData;
            // Solo liberar si no está en disputa (aunque "cerrado_con_calificacion" ya implica que no lo está)
            if (servicio.estado !== "en_disputa") { 
                functions.logger.info(`[DailyCheck] LIBERANDO PAGO (fallback por calificación ya hecha) para servicio ${doc.id}. Proveedor: ${servicio.prestadorId}.`);
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

// Funciones de Gestión de Estado y Ubicación del Proveedor
export const updateProviderRealtimeStatus = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando updateProviderRealtimeStatus", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const providerId = context.auth.uid;
  const { isAvailable, ubicacion } = data; // ubicacion: { lat: number, lng: number }

  if (typeof isAvailable !== "boolean") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el parámetro 'isAvailable' (booleano).");
  }

  const providerRef = db.collection("prestadores").doc(providerId);
  const ubicacionPrestadorRef = db.collection("ubicacionesPrestadores").doc(providerId);
  
  const now = admin.firestore.Timestamp.now();
  const updatesPrestador: any = { // Usar 'any' temporalmente para los updates
    isAvailable: isAvailable,
    lastConnection: now,
  };
  let updatesUbicacion: Partial<UbicacionPrestadorData> | null = null;

  if (isAvailable === true) {
    if (!ubicacion || typeof ubicacion.lat !== "number" || typeof ubicacion.lng !== "number") {
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
    updatesPrestador.currentLocation = null; // O admin.firestore.FieldValue.delete()
  }

  try {
    const batch = db.batch();
    batch.set(providerRef, updatesPrestador, { merge: true });

    if (updatesUbicacion) {
        batch.set(ubicacionPrestadorRef, updatesUbicacion, { merge: true });
    } else if (!isAvailable) {
        // Si se desconecta, podríamos borrar el documento de ubicación en tiempo real
        // Opcional: batch.delete(ubicacionPrestadorRef);
    }

    await batch.commit();
    
    functions.logger.info(`Estado de prestador ${providerId} actualizado a ${isAvailable ? "disponible" : "no disponible"}.`);
    return { success: true, message: `Estado actualizado a ${isAvailable ? "disponible" : "no disponible"}.` };
  } catch (error: any) {
    functions.logger.error(`Error al actualizar estado para prestador ${providerId}:`, error);
    throw new functions.https.HttpsError("internal", "Error al actualizar el estado del prestador.", error.message);
  }
});

export const disconnectProvider = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando disconnectProvider", { structuredData: true });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado (prestador).");
  }
  const providerId = context.auth.uid;

  const providerRef = db.collection("prestadores").doc(providerId);
  // const ubicacionPrestadorRef = db.collection("ubicacionesPrestadores").doc(providerId); // Opcional si se borra
  const now = admin.firestore.Timestamp.now();

  const updates: Partial<ProviderData> = {
    isAvailable: false,
    currentLocation: null, // O admin.firestore.FieldValue.delete()
    lastConnection: now,
  };

  try {
    await providerRef.update(updates);
    // Opcional: await ubicacionPrestadorRef.delete();
    functions.logger.info(`Prestador ${providerId} desconectado y ubicación borrada del perfil principal.`);
    return { success: true, message: "Te has desconectado exitosamente." };
  } catch (error: any) {
    functions.logger.error(`Error al desconectar al prestador ${providerId}:`, error);
    // Considerar si el perfil no existe, en cuyo caso .update() fallará.
    // Una comprobación previa con .get() o .set(..., {merge: true}) podría ser más robusta si los perfiles pueden no existir.
    throw new functions.https.HttpsError("internal", "Error al desconectar al prestador.", error.message);
  }
});

export const verificarEstadoFunciones = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando verificarEstadoFunciones", { structuredData: true });

  const NOMBRES_FUNCIONES_ESPERADAS = [
    "confirmServiceCompletionByUserService", "gestionarCalificacionYPago", "calificarUsuario",
    "reportServiceIssue", "obtenerServiciosCompletados", "registrarDocumentoProfesional",
    "validateDocumentAndRemoveContactInfo", "activarGarantiaPremium", "resolverGarantiaPremium",
    "simulateDailyAutomatedChecks", "updateProviderRealtimeStatus", "disconnectProvider",
    "agendarCitaConPrestador", "cancelarCita", "confirmarCitaPorPrestador", 
    "procesarCobroTrasConfirmacion", "enviarNotificacionInApp", // Renombrado de crearNotificacion
    "enviarNotificacionInAppTrigger", "notificarLiberacionPagoAutomatica", "activarMembresia",
    "verificarEstadoFunciones", "iniciarChat", "enviarMensaje", "moderarMensajesChat",
    "evaluarComportamientoPrestadorTrigger", "asignarIncentivoUsuarioTrigger",
    "sugerirPrestadoresInteligente", "mostrarServiciosDestacados",
    "revisarDocumentoPrestador", "gestionarContratoServicio", "crearSolicitudSoporte",
    "obtenerTraduccion", "actualizarUbicacionPrestador", "obtenerUbicacionesCercanas",
    "validarCoberturaServicio", "validarCoberturaYObtenerPrestadoresCercanos",
    "obtenerDetallesPrestadorParaPopup", "sugerirPrestadoresConGeolocalizacion",
  ];

  const estadoFunciones: any[] = [];
  let todasLasFuncionesCriticasPresentes = true;

  for (const nombreFuncion of NOMBRES_FUNCIONES_ESPERADAS) {
    const funcionExportada = (exports as any)[nombreFuncion];
    const presenteEnCodigo = typeof funcionExportada === "function";
    
    const esTrigger = nombreFuncion.endsWith("Trigger") || 
                      nombreFuncion === "simulateDailyAutomatedChecks" || 
                      nombreFuncion === "moderarMensajesChat" ||
                      nombreFuncion === "notificarLiberacionPagoAutomatica";


    if (!presenteEnCodigo && !esTrigger && nombreFuncion !== "verificarEstadoFunciones") { // Considerar no críticas a los triggers si su ausencia no rompe el flujo principal callable
      todasLasFuncionesCriticasPresentes = false;
    }

    estadoFunciones.push({
      nombre: nombreFuncion,
      presenteEnCodigo: presenteEnCodigo,
      tipo: (typeof funcionExportada), 
      esPubSub: nombreFuncion === "simulateDailyAutomatedChecks", 
      esFirestoreTrigger: esTrigger && nombreFuncion !== "simulateDailyAutomatedChecks", 
      estadoDespliegueSimulado: presenteEnCodigo ? "Asumido Habilitada si Presente en código y desplegada" : "Ausente en Código",
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


// --- FUNCIONES DE CITAS ---
export const agendarCitaConPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando agendarCitaConPrestador", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para agendar una cita.");
  }
  const usuarioId = context.auth.uid;
  const {
    prestadorId,
    fechaSolicitada, // YYYY-MM-DD
    horaSolicitada,   // HH:MM (ej. "14:30")
    detallesServicio,
    ubicacion,
    notasAdicionales,
    serviceType = "fixed", // 'fixed' o 'hourly'
    precioServicio, // Para fixed
    tarifaPorHora,  // Para hourly
    duracionHoras,  // Para hourly
  } = data;

  if (!prestadorId || !fechaSolicitada || !horaSolicitada || !detallesServicio) {
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
    if (isNaN(dateObject.getTime())) throw new Error("Fecha u hora inválida.");
    if (dateObject < new Date(Date.now() + 60 * 60 * 1000)) { // No agendar con menos de 1 hora de antelación
      throw new functions.https.HttpsError("invalid-argument", "La cita debe ser con al menos 1 hora de antelación.");
    }
    fechaHoraSolicitadaConvertida = admin.firestore.Timestamp.fromDate(dateObject);
  } catch (e: any) {
    throw new functions.https.HttpsError("invalid-argument", `Error procesando fecha y hora: ${e.message}`);
  }

  const citasRef = db.collection("citas");
  const conflictoQuery = citasRef
    .where("prestadorId", "==", prestadorId)
    .where("fechaHoraSolicitada", "==", fechaHoraSolicitadaConvertida)
    .where("estado", "in", ["pendiente_confirmacion", "confirmada_prestador", "pagada"]); // Estados que indican ocupación

  const conflictoSnapshot = await conflictoQuery.get();
  if (!conflictoSnapshot.empty) {
    throw new functions.https.HttpsError("failed-precondition", "El prestador ya tiene una cita en este horario. Por favor, elige otro.");
  }
  
  let montoTotalEstimado = 0;
  if (serviceType === 'fixed' && typeof precioServicio === 'number') {
      montoTotalEstimado = precioServicio;
  } else if (serviceType === 'hourly' && typeof tarifaPorHora === 'number' && typeof duracionHoras === 'number') {
      montoTotalEstimado = tarifaPorHora * duracionHoras;
  }

  const nuevaCitaData: Omit<CitaData, "id" | "updatedAt"> = {
    usuarioId: usuarioId,
    prestadorId: prestadorId,
    fechaHoraSolicitada: fechaHoraSolicitadaConvertida,
    detallesServicio: detallesServicio,
    estado: "pendiente_confirmacion",
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    serviceType: serviceType as 'fixed' | 'hourly',
    ...(ubicacion && { ubicacion: ubicacion }),
    ...(notasAdicionales && { notasAdicionales: notasAdicionales }),
    ...(serviceType === 'fixed' && { precioServicio: precioServicio }),
    ...(serviceType === 'hourly' && { tarifaPorHora: tarifaPorHora, duracionHoras: duracionHoras }),
    ...(montoTotalEstimado > 0 && { montoTotalEstimado: montoTotalEstimado }),
  };

  const citaRef = await citasRef.add(nuevaCitaData);
  functions.logger.info(`Cita ${citaRef.id} solicitada por ${usuarioId} a ${prestadorId}.`);
  
  // SIMULACIÓN: Notificar al prestador
  // await enviarNotificacionInApp({ destinatarioId: prestadorId, ... });

  return { success: true, message: "Cita solicitada. Esperando confirmación del prestador.", citaId: citaRef.id };
});

export const cancelarCita = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando cancelarCita", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para cancelar una cita.");
  }
  const canceladorIdAutenticado = context.auth.uid;
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

      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden cancelar citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}`);
      }

      let nuevoEstado: CitaEstado;
      let idNotificado: string = "";
      let rolNotificado: 'usuario' | 'prestador' = 'usuario';


      if (rol === "usuario") {
        if (citaData.usuarioId !== canceladorIdAutenticado) {
          throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita como usuario.");
        }
        nuevoEstado = "cancelada_usuario";
        idNotificado = citaData.prestadorId;
        rolNotificado = 'prestador';
      } else if (rol === "prestador") {
        if (citaData.prestadorId !== canceladorIdAutenticado) {
          throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita como prestador.");
        }
        nuevoEstado = "cancelada_prestador";
        idNotificado = citaData.usuarioId;
        rolNotificado = 'usuario';
      } else {
        throw new functions.https.HttpsError("internal", "Rol de cancelador inválido internamente.");
      }
      
      const now = admin.firestore.Timestamp.now();
      const updateData: Partial<CitaData> = {
        estado: nuevoEstado,
        fechaCancelacion: now,
        canceladaPor: canceladorIdAutenticado,
        rolCancelador: rol as 'usuario' | 'prestador',
        updatedAt: now,
      };
      transaction.update(citaRef, updateData);

      functions.logger.info(`Cita ${citaId} cancelada por ${rol} ${canceladorIdAutenticado}.`);
      // SIMULACIÓN: Notificar a la otra parte.
      // await enviarNotificacionInApp({ destinatarioId: idNotificado, rolDestinatario: rolNotificado, ... });
    });
    return { success: true, message: "Cita cancelada exitosamente." };
  } catch (error: any) {
    functions.logger.error("Error en cancelarCita:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error interno al cancelar la cita.", error.message);
  }
});

export const confirmarCitaPorPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando confirmarCitaPorPrestador", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado (prestador).");
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
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para modificar esta cita.");
      }
      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden ${accion} citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const updateData: Partial<CitaData> = { updatedAt: now };
      let notifTitulo = "";
      let notifCuerpo = "";
      let notifTipo = "";

      if (accion === "confirmar") {
        updateData.estado = "confirmada_prestador";
        updateData.fechaConfirmacionPrestador = now;
        updateData.paymentStatus = "pendiente_cobro"; // Lista para el siguiente paso de cobro
        updateData.ordenCobroId = `sim_orden_${citaId}_${Date.now()}`; 
        
        notifTitulo = "¡Cita Confirmada!";
        notifCuerpo = `Tu cita para "${citaData.detallesServicio}" el ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()} ha sido confirmada por el prestador.`;
        notifTipo = "cita_confirmada_prestador";
        functions.logger.info(`Cita ${citaId} confirmada por prestador ${prestadorIdAutenticado}. PaymentStatus: pendiente_cobro.`);
      } else { // accion === "rechazar"
        updateData.estado = "rechazada_prestador";
        updateData.fechaRechazoPrestador = now;

        notifTitulo = "Cita Rechazada";
        notifCuerpo = `Lamentablemente, tu cita para "${citaData.detallesServicio}" el ${citaData.fechaHoraSolicitada.toDate().toLocaleDateString()} ha sido rechazada por el prestador.`;
        notifTipo = "cita_rechazada_prestador";
        functions.logger.info(`Cita ${citaId} rechazada por prestador ${prestadorIdAutenticado}.`);
      }
      
      transaction.update(citaRef, updateData);
      
      // SIMULACIÓN: Notificar al usuario.
      // await enviarNotificacionInApp({ 
      //   destinatarioId: citaData.usuarioId, 
      //   rolDestinatario: 'usuario',
      //   titulo: notifTitulo,
      //   cuerpo: notifCuerpo,
      //   tipoNotificacion: notifTipo,
      //   prioridad: 'alta',
      //   datosAdicionales: { citaId: citaId }
      // });
    });

    return { success: true, message: `Cita ${accion === 'confirmar' ? 'confirmada' : 'rechazada'} exitosamente.` };
  } catch (error: any) {
    functions.logger.error(`Error en confirmarCitaPorPrestador (accion: ${accion}):`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Error interno al ${accion} la cita.`, error.message);
  }
});

export const procesarCobroTrasConfirmacion = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando procesarCobroTrasConfirmacion", { structuredData: true, data });

  // Esta función podría ser llamada por el sistema/admin o por el cliente después de que el prestador confirma.
  // if (!context.auth) { 
  //     throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  // }

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
      if (citaData.paymentStatus !== "pendiente_cobro" && citaData.paymentStatus !== "fallido") { // Permitir reintentos si falló
        throw new functions.https.HttpsError("failed-precondition", `El estado del pago no es 'pendiente_cobro' o 'fallido'. Estado actual: ${citaData.paymentStatus}.`);
      }

      const montoACobrar = citaData.montoTotalEstimado;
      if (typeof montoACobrar !== "number" || montoACobrar <= 0) {
        throw new functions.https.HttpsError("internal", "Monto total estimado inválido para la cita.");
      }

      functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Iniciando cobro para cita ${citaId}, Usuario: ${citaData.usuarioId}, Orden ID: ${citaData.ordenCobroId}, Monto: ${montoACobrar}.`);
      const pagoExitosoSimulado = true; // Cambiar a false para simular fallo
      
      const now = admin.firestore.Timestamp.now();
      if (pagoExitosoSimulado) {
        transaction.update(citaRef, {
          estado: "pagada", 
          paymentStatus: "procesado_exitosamente",
          fechaCobro: now,
          montoCobrado: montoACobrar,
          updatedAt: now,
        });
        functions.logger.info(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} procesado exitosamente.`);
        // SIMULACIÓN: Notificar a usuario y prestador.
        // await enviarNotificacionInApp({ ... para usuario ... });
        // await enviarNotificacionInApp({ ... para prestador ... });
        return { success: true, message: `Cobro para la cita ${citaId} procesado exitosamente. El servicio está ahora en estado 'pagada'.` };
      } else {
        transaction.update(citaRef, {
          paymentStatus: "fallido",
          fechaCobro: now, // Registrar intento
          updatedAt: now,
        });
        functions.logger.error(`[ProcesarCobro] SIMULACIÓN: Cobro para cita ${citaId} FALLIDO.`);
        // SIMULACIÓN: Notificar al usuario.
        throw new functions.https.HttpsError("aborted", "El procesamiento del pago falló (simulado).");
      }
    });
  } catch (error: any) {
    functions.logger.error(`Error en procesarCobroTrasConfirmacion para cita ${citaId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Error interno al procesar el cobro de la cita.", error.message);
  }
});


// --- FUNCIONES DE NOTIFICACIONES ---
export const enviarNotificacionInApp = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando enviarNotificacionInApp (antes crearNotificacion)", { structuredData: true, data });

  const {
    destinatarioId,
    rolDestinatario,
    titulo,
    cuerpo,
    tipoNotificacion,
    prioridad,
    datosAdicionales,
    enlaceOpcional, // Nuevo campo
  } = data;

  if (!destinatarioId || !rolDestinatario || !titulo || !cuerpo || !tipoNotificacion) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Faltan parámetros requeridos: destinatarioId, rolDestinatario, titulo, cuerpo, tipoNotificacion."
    );
  }
  if (rolDestinatario !== "usuario" && rolDestinatario !== "prestador") {
    throw new functions.https.HttpsError("invalid-argument", "El 'rolDestinatario' debe ser 'usuario' o 'prestador'.");
  }

  const prioridadValida = prioridad === "alta" || prioridad === "normal" ? prioridad : "normal";

  const nuevaNotificacionData: Partial<NotificacionData> = {
    destinatarioId: destinatarioId,
    rolDestinatario: rolDestinatario as 'usuario' | 'prestador',
    titulo: titulo,
    cuerpo: cuerpo,
    estadoNotificacion: "pendiente",
    tipoNotificacion: tipoNotificacion,
    prioridad: prioridadValida,
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    ...(datosAdicionales && { datosAdicionales: datosAdicionales }),
    ...(enlaceOpcional && { enlaceOpcional: enlaceOpcional }),
  };

  try {
    const notificacionRef = await db.collection("notificaciones").add(nuevaNotificacionData);
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

      if (notificacionData.triggerProcesadoEn || notificacionData.estadoNotificacion !== "pendiente") {
        functions.logger.log(`[Trigger] Notificación ${notificacionId} ya procesada o no 'pendiente', omitiendo.`);
        return null;
      }

      functions.logger.log(`[Trigger] SIMULACIÓN: "Enviando" notificación (ej. FCM) para ${notificacionId}. Título: ${notificacionData.titulo}`);
      // Aquí iría la lógica para enviar un mensaje FCM o email en una app real.
      
      try {
        await snapshot.ref.update({
          estadoNotificacion: 'procesada_por_trigger', // O 'fcm_enviada', 'email_enviado'
          triggerProcesadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`[Trigger] Notificación ${notificacionId} marcada como procesada.`);
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
      !afterData.calificacionUsuario; // Es automático porque el usuario NO calificó

    if (esLiberacionAutomatica) {
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Detectada liberación automática de pago para servicio ${servicioId}.`);

      const servicioDetalles = afterData.detallesServicio || "Servicio general";
      const fechaServicioConfirmada = afterData.fechaConfirmacion?.toDate().toLocaleDateString("es-MX") || "Fecha no especificada";
      const montoLiberado = afterData.montoCobrado || afterData.precio || 0;

      // Notificación para el Usuario
      const notifUsuarioPayload = {
        destinatarioId: afterData.usuarioId,
        rolDestinatario: 'usuario',
        titulo: "Pago Liberado Automáticamente",
        cuerpo: `El pago para tu servicio "${servicioDetalles}" del ${fechaServicioConfirmada} ha sido liberado automáticamente al prestador tras ${RATING_AND_DISPUTE_WINDOW_DAYS} días sin reclamos ni calificación. Monto: $${montoLiberado.toFixed(2)}.`,
        tipoNotificacion: 'pago_liberado_auto_usuario',
        prioridad: 'normal',
        datosAdicionales: { servicioId: servicioId },
      };
      await db.collection("notificaciones").add(notifUsuarioPayload); // Crear directamente
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Notificación (usuario) creada para servicio ${servicioId}.`);

      // Notificación para el Prestador
      const notifPrestadorPayload = {
        destinatarioId: afterData.prestadorId,
        rolDestinatario: 'prestador',
        titulo: "¡Pago Recibido!",
        cuerpo: `El pago por el servicio "${servicioDetalles}" del ${fechaServicioConfirmada} (solicitado por usuario ${afterData.usuarioId.substring(0,5)}...) ha sido liberado a tu cuenta. Monto: $${montoLiberado.toFixed(2)}.`,
        tipoNotificacion: 'pago_recibido_auto_prestador',
        prioridad: 'normal',
        datosAdicionales: { servicioId: servicioId },
      };
      await db.collection("notificaciones").add(notifPrestadorPayload); // Crear directamente
      functions.logger.info(`[notificarLiberacionPagoAutomatica] Notificación (prestador) creada para servicio ${servicioId}.`);
    } else {
      // functions.logger.log(`[notificarLiberacionPagoAutomatica] Actualización de servicio ${servicioId} no cumple criterios de liberación automática.`);
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
    const q = chatsRef.where("participantesUids", "==", participantesUids).limit(1);
    const chatExistenteSnap = await q.get();

    if (!chatExistenteSnap.empty) {
      const chatExistenteDoc = chatExistenteSnap.docs[0];
      functions.logger.info(`Chat encontrado entre ${iniciadorId} y ${destinatarioId}. ID: ${chatExistenteDoc.id}`);
      // Podrías añadir lógica para reactivar si está archivado.
      return { success: true, chatId: chatExistenteDoc.id, nuevo: false, message: "Chat encontrado." };
    }

    functions.logger.info(`No se encontró chat. Creando nuevo chat entre ${iniciadorId} y ${destinatarioId}.`);
    
    const ahora = admin.firestore.Timestamp.now();
    const nuevoChatData: Omit<ChatDataFirestore, "id" | "mensajes"> = {
      participantesUids: participantesUids,
      estadoChat: "activo",
      fechaCreacion: ahora,
      ultimaActualizacion: ahora,
      conteoNoLeido: { [iniciadorId]: 0, [destinatarioId]: 0 },
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

      const ahora = admin.firestore.Timestamp.now();
      const nuevoMensaje: MensajeDataFirestore = {
        remitenteId: remitenteId,
        texto: texto,
        timestamp: ahora,
        leido: false,
      };

      const destinatarioDelMensajeId = chatData.participantesUids.find(uid => uid !== remitenteId);
      
      const updates: any = {
        mensajes: admin.firestore.FieldValue.arrayUnion(nuevoMensaje),
        ultimaActualizacion: ahora,
        ultimoMensajeTexto: texto.substring(0, 100),
        ultimoMensajeTimestamp: ahora,
        ultimoMensajeRemitenteId: remitenteId,
      };

      if (destinatarioDelMensajeId && chatData.conteoNoLeido) {
        updates[`conteoNoLeido.${destinatarioDelMensajeId}`] = admin.firestore.FieldValue.increment(1);
      }
      
      transaction.update(chatRef, updates);
    });

    functions.logger.info(`Mensaje enviado por ${remitenteId} al chat ${chatId}.`);
    return { success: true, message: "Mensaje enviado exitosamente." };
  } catch (error: any) {
    functions.logger.error(`Error al enviar mensaje al chat ${chatId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al enviar el mensaje.", error.message);
  }
});

exports.moderarMensajesChat = functions.firestore
    .document('chats/{chatId}') // Escucha actualizaciones en el documento del chat
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data() as ChatDataFirestore | undefined;
        const afterData = change.after.data() as ChatDataFirestore | undefined;
        const chatId = context.params.chatId;

        if (!beforeData || !afterData || !afterData.mensajes || !beforeData.mensajes) {
            functions.logger.log(`[ModerarChat ${chatId}] Datos incompletos o sin 'mensajes', omitiendo.`);
            return null;
        }
        
        if (afterData.mensajes.length <= beforeData.mensajes.length) {
            functions.logger.log(`[ModerarChat ${chatId}] No hay nuevos mensajes o se eliminó uno, omitiendo.`);
            return null;
        }
        
        const nuevoMensaje = afterData.mensajes[afterData.mensajes.length - 1];
        
        if (nuevoMensaje.moderado === true || !nuevoMensaje.texto) { // Si ya está moderado o no tiene texto
            functions.logger.log(`[ModerarChat ${chatId}] Mensaje ya moderado o sin texto, omitiendo.`);
            return null;
        }

        const mensajeTexto = nuevoMensaje.texto;
        const mensajeIdSimulado = `${nuevoMensaje.timestamp.toMillis()}_${nuevoMensaje.remitenteId}`;

        functions.logger.log(`[ModerarChat ${chatId}] Nuevo mensaje (ID ${mensajeIdSimulado}): "${mensajeTexto.substring(0,50)}..."`);
        
        let mensajeBloqueado = false;
        let motivo = "";

        for (const palabra of PALABRAS_CLAVE_PROHIBIDAS_CONTACTO) {
            const palabraRegex = new RegExp(`\\b${palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "gi"); // Escapar caracteres especiales y 'i' para case-insensitive
            if (palabraRegex.test(mensajeTexto)) {
                mensajeBloqueado = true;
                motivo = `Detección de palabra clave prohibida: "${palabra}"`;
                break; 
            }
        }

        if (mensajeBloqueado) {
            functions.logger.warn(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) MODERADO. Motivo: ${motivo}.`);
            
            const mensajesActualizados = [...afterData.mensajes];
            mensajesActualizados[afterData.mensajes.length - 1] = {
                ...nuevoMensaje,
                texto: '[Mensaje bloqueado por el sistema]',
                moderado: true,
                motivoBloqueo: motivo,
                textoOriginal: mensajeTexto, // Guardar el texto original
            };

            try {
                await db.collection('chats').doc(chatId).update({
                    mensajes: mensajesActualizados,
                    ultimoMensajeTexto: '[Mensaje bloqueado por el sistema]',
                });
                functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) actualizado por moderación.`);
                // Opcional: Notificar al remitente.
            } catch (updateError) {
                functions.logger.error(`[ModerarChat ${chatId}] Error al actualizar mensaje moderado:`, updateError);
            }
        } else {
            functions.logger.info(`[ModerarChat ${chatId}] Mensaje (${mensajeIdSimulado}) pasó la moderación.`);
        }
        return null;
    });

// --- FUNCIONES DE EVALUACIÓN Y REPUTACIÓN ---
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
            functions.logger.error(`[EvaluarComportamiento ${citaId}] No se encontró prestadorId.`);
            return null;
        }

        const prestadorRef = db.collection("prestadores").doc(prestadorId);
        let actualizacionPrestador: any = {}; // Usar 'any' para facilitar la construcción dinámica
        let logMessage = "";

        // Estado cambió a "rechazada_prestador"
        if (afterData.estado === "rechazada_prestador" && beforeData.estado !== "rechazada_prestador") {
            logMessage = `[EvaluarComportamiento ${citaId}] Cita rechazada por prestador ${prestadorId}.`;
            actualizacionPrestador.rechazosCount = admin.firestore.FieldValue.increment(1);

            const prestadorDocSnap = await prestadorRef.get();
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevoRechazosCount = (prestadorDataActual?.rechazosCount || 0) + 1;

            if (nuevoRechazosCount > 0 && nuevoRechazosCount % 3 === 0) {
                const fechaExpiracionPenalizacion = new Date();
                fechaExpiracionPenalizacion.setDate(fechaExpiracionPenalizacion.getDate() + 1);
                actualizacionPrestador.penalizacionActiva = {
                    tipo: "visibilidad_reducida_temporal",
                    motivo: `Rechazos frecuentes (${nuevoRechazosCount} rechazos).`,
                    expiraEn: admin.firestore.Timestamp.fromDate(fechaExpiracionPenalizacion),
                };
                logMessage += ` Aplicando penalización hasta ${fechaExpiracionPenalizacion.toISOString()}.`;
            }
        }
        // Estado cambió a "confirmada_prestador"
        else if (afterData.estado === "confirmada_prestador" && beforeData.estado !== "confirmada_prestador") {
            logMessage = `[EvaluarComportamiento ${citaId}] Cita confirmada por prestador ${prestadorId}.`;
            actualizacionPrestador.confirmacionesCount = admin.firestore.FieldValue.increment(1);
            
            const prestadorDocSnap = await prestadorRef.get();
            const prestadorDataActual = prestadorDocSnap.data() as ProviderData | undefined;
            const nuevaConfirmacionesCount = (prestadorDataActual?.confirmacionesCount || 0) + 1;

            if (nuevaConfirmacionesCount > 0 && nuevaConfirmacionesCount % 5 === 0) {
                if (!actualizacionPrestador.incentivos) actualizacionPrestador.incentivos = {};
                actualizacionPrestador.incentivos.puntosReputacion = admin.firestore.FieldValue.increment(10);
                logMessage += ` Otorgando 10 puntos de reputación.`;
            }
        }

        if (Object.keys(actualizacionPrestador).length > 0) {
            actualizacionPrestador.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            try {
                await prestadorRef.set(actualizacionPrestador, { merge: true });
                functions.logger.info(logMessage + " Perfil del prestador actualizado.");
            } catch (error) {
                functions.logger.error(`[EvaluarComportamiento ${citaId}] Error al actualizar perfil del prestador ${prestadorId}:`, error);
            }
        } else {
            // functions.logger.log(`[EvaluarComportamiento ${citaId}] No se requieren acciones para prestador ${prestadorId}.`);
        }
        return null;
    });

export const asignarIncentivoUsuarioTrigger = functions.firestore
    .document('servicios/{servicioId}') // Asumiendo que la calificación del usuario se guarda en el doc del servicio
    .onUpdate(async (change, context) => {
        const servicioId = context.params.servicioId;
        const beforeData = change.before.data() as ServiceData | undefined;
        const afterData = change.after.data() as ServiceData | undefined;

        if (!beforeData || !afterData) {
            functions.logger.warn(`[AsignarIncentivoUsuario ${servicioId}] Datos antes o después no disponibles.`);
            return null;
        }

        // Condición: la calificación del usuario acaba de ser añadida.
        const ratingJustAdded = !beforeData.calificacionUsuario && !!afterData.calificacionUsuario;

        if (ratingJustAdded && afterData.usuarioId) {
            functions.logger.info(`[AsignarIncentivoUsuario ${servicioId}] Calificación de usuario detectada por ${afterData.usuarioId}.`);
            
            const usuarioRef = db.collection("usuarios").doc(afterData.usuarioId);

            try {
                await db.runTransaction(async (transaction) => {
                    const usuarioDoc = await transaction.get(usuarioRef);
                    let updates: any = {};
                    let currentServiciosCalificados = 0;
                    let currentPuntos = 0;
                    let currentBadges: string[] = [];

                    if (usuarioDoc.exists) {
                        const usuarioData = usuarioDoc.data() as UserData;
                        currentServiciosCalificados = usuarioData.serviciosCalificadosCount || 0;
                        currentPuntos = usuarioData.puntosReputacionUsuario || 0;
                        currentBadges = usuarioData.badgesUsuario || [];
                    }
                    
                    updates.serviciosCalificadosCount = admin.firestore.FieldValue.increment(1);
                    updates.puntosReputacionUsuario = admin.firestore.FieldValue.increment(5); // Ej: 5 puntos por calificar

                    const nuevoTotalCalificados = currentServiciosCalificados + 1;
                    if (nuevoTotalCalificados % 5 === 0 && !currentBadges.includes("calificador_bronce")) {
                        updates.badgesUsuario = admin.firestore.FieldValue.arrayUnion("calificador_bronce");
                        functions.logger.info(`[AsignarIncentivoUsuario ${servicioId}] Usuario ${afterData.usuarioId} ganó badge 'calificador_bronce'.`);
                    }
                    // ... más lógica de badges ...
                    
                    if (!usuarioDoc.exists) { // Si el usuario no existe, crear el documento con los datos.
                        updates.uid = afterData.usuarioId;
                        updates.name = `Usuario ${afterData.usuarioId.substring(0,5)}`; // Nombre por defecto
                        updates.ratingSumUsuario = 0; // Inicializar campos de calificación recibida
                        updates.ratingCountUsuario = 0;
                        updates.ratingUsuario = 0;
                    }
                    transaction.set(usuarioRef, updates, { merge: true });
                });
                functions.logger.info(`[AsignarIncentivoUsuario ${servicioId}] Incentivos asignados a usuario ${afterData.usuarioId}.`);
            } catch (error) {
                functions.logger.error(`[AsignarIncentivoUsuario ${servicioId}] Error al asignar incentivos a ${afterData.usuarioId}:`, error);
            }
        }
        return null;
    });


// --- OTRAS FUNCIONES DE GESTIÓN ---
export const revisarDocumentoPrestador = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando revisarDocumentoPrestador", { structuredData: true, data });

  if (!context.auth || (!context.auth.token.admin && !context.auth.token.moderador)) {
    throw new functions.https.HttpsError("permission-denied", "No tienes permiso para ejecutar esta función.");
  }

  const { documentoId, nuevoEstado, comentariosRevisor } = data;

  if (!documentoId || typeof documentoId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'documentoId' (ID del documento en la colección `documentosPrestadores`).");
  }
  if (!nuevoEstado || (nuevoEstado !== "aprobado" && nuevoEstado !== "rechazado")) {
    throw new functions.https.HttpsError("invalid-argument", "El 'nuevoEstado' debe ser 'aprobado' o 'rechazado'.");
  }

  const docRef = db.collection("documentosPrestadores").doc(documentoId);

  try {
    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists) {
        throw new functions.https.HttpsError("not-found", `Documento con ID ${documentoId} no encontrado.`);
      }
      const docData = docSnap.data() as DocumentoPrestadorData;

      const updateData: Partial<DocumentoPrestadorData> = {
        estadoRevision: nuevoEstado as 'aprobado' | 'rechazado',
        fechaRevision: admin.firestore.Timestamp.now(),
        revisadoPor: context.auth?.uid,
        ...(comentariosRevisor && { comentariosRevisor: comentariosRevisor }),
      };
      transaction.update(docRef, updateData);
      functions.logger.info(`Documento ${documentoId} del prestador ${docData.prestadorId} actualizado a estado: ${nuevoEstado}.`);
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

export const gestionarContratoServicio = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando gestionarContratoServicio", { structuredData: true, data, auth: context.auth?.uid });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const actorId = context.auth.uid;
  const { accion, referenciaId, tipoReferencia, contratoId } = data;

  const generarTextoContratoSimulado = (
        tipoRef: 'servicio' | 'cita',
        refData: ServiceData | CitaData,
        infoUsuario: UserData | null,
        infoPrestador: ProviderData | null
    ): string => {
        const usuarioNombre = infoUsuario?.name || `Usuario ${refData.usuarioId.substring(0,5)}`;
        const prestadorNombre = infoPrestador?.name || `Prestador ${refData.prestadorId.substring(0,5)}`;
        let detalles = "";
        let fechaHoraServicio = new Date();
        let monto = 0;

        if (tipoRef === 'servicio') {
            const servicio = refData as ServiceData;
            detalles = servicio.detallesServicio || "Servicio general";
            if (servicio.fechaServicio) fechaHoraServicio = servicio.fechaServicio.toDate();
            monto = servicio.precio || 0;
        } else { // 'cita'
            const cita = refData as CitaData;
            detalles = cita.detallesServicio || "Cita general";
            if (cita.fechaHoraSolicitada) fechaHoraServicio = cita.fechaHoraSolicitada.toDate();
            monto = cita.montoTotalEstimado || 0;
        }
        const fechaFormateada = fechaHoraServicio.toLocaleDateString('es-MX');
        const horaFormateada = fechaHoraServicio.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        return `CONTRATO DE PRESTACIÓN DE SERVICIOS SIMULADO...`; // Texto abreviado
    };


  if (accion === 'crear') {
    // ... Lógica para crear contrato ...
    if (!referenciaId || !tipoReferencia) throw new functions.https.HttpsError("invalid-argument", "Faltan datos para crear contrato.");
    const refCollectionName = tipoReferencia === 'servicio' ? "servicios" : "citas";
    const refDocSnap = await db.collection(refCollectionName).doc(referenciaId).get();
    if (!refDocSnap.exists) throw new functions.https.HttpsError("not-found", `Referencia ${tipoReferencia} ID ${referenciaId} no encontrada.`);
    const refData = refDocSnap.data() as ServiceData | CitaData;
    
    // Obtener nombres (simulado, en real sería otra lectura o ya los tendrías)
    const usuarioSnap = await db.collection("usuarios").doc(refData.usuarioId).get();
    const prestadorSnap = await db.collection("prestadores").doc(refData.prestadorId).get();

    const textoContrato = generarTextoContratoSimulado(tipoReferencia, refData, usuarioSnap.data() as UserData, prestadorSnap.data() as ProviderData);
    const ahora = admin.firestore.Timestamp.now();
    const nuevoContratoData: Omit<ContratoServicioData, "id"> = {
      referenciaId: referenciaId,
      tipoReferencia: tipoReferencia,
      usuarioId: refData.usuarioId,
      prestadorId: refData.prestadorId,
      fechaCreacionContrato: ahora,
      textoContrato: textoContrato,
      estadoContrato: 'pendiente_aceptacion_usuario',
      infoServicioOriginal: { 
          detalles: (refData as any).detallesServicio || (refData as any).descripcion,
          fechaHora: (refData as any).fechaServicio || (refData as any).fechaHoraSolicitada,
          monto: (refData as any).precio || (refData as any).montoTotalEstimado,
      },
      updatedAt: ahora,
    };
    const contratoRef = await db.collection("contratosServicios").add(nuevoContratoData);
    functions.logger.info(`Contrato creado ID: ${contratoRef.id}`);
    return { success: true, message: "Contrato generado, pendiente de aceptación del usuario.", contratoId: contratoRef.id };

  } else if (accion === 'aceptar' || accion === 'rechazar') {
    // ... Lógica para aceptar/rechazar contrato ...
    if (!contratoId) throw new functions.https.HttpsError("invalid-argument", "Se requiere 'contratoId'.");
    const contratoRef = db.collection("contratosServicios").doc(contratoId);
    return await db.runTransaction(async (transaction) => {
      const contratoDoc = await transaction.get(contratoRef);
      if (!contratoDoc.exists) throw new functions.https.HttpsError("not-found", `Contrato ID ${contratoId} no encontrado.`);
      const contratoData = contratoDoc.data() as ContratoServicioData;
      let nuevoEstado: EstadoContrato = contratoData.estadoContrato;
      const ahora = admin.firestore.Timestamp.now();
      const updates: Partial<ContratoServicioData> = { updatedAt: ahora };

      if (accion === 'aceptar') {
        if (actorId === contratoData.usuarioId && contratoData.estadoContrato === 'pendiente_aceptacion_usuario') {
          nuevoEstado = 'pendiente_aceptacion_prestador';
          updates.fechaAceptacionUsuario = ahora;
        } else if (actorId === contratoData.prestadorId && contratoData.estadoContrato === 'pendiente_aceptacion_prestador') {
          nuevoEstado = 'aceptado_ambos';
          updates.fechaAceptacionPrestador = ahora;
        } else {
          throw new functions.https.HttpsError("failed-precondition", `No se puede aceptar el contrato en estado ${contratoData.estadoContrato} por el rol actual.`);
        }
      } else { // 'rechazar'
        if (actorId === contratoData.usuarioId && (contratoData.estadoContrato === 'pendiente_aceptacion_usuario' || contratoData.estadoContrato === 'pendiente_aceptacion_prestador')) {
          nuevoEstado = 'rechazado_usuario';
          updates.fechaRechazoUsuario = ahora;
        } else if (actorId === contratoData.prestadorId && contratoData.estadoContrato === 'pendiente_aceptacion_prestador') {
          nuevoEstado = 'rechazado_prestador';
          updates.fechaRechazoPrestador = ahora;
        } else {
           throw new functions.https.HttpsError("failed-precondition", `No se puede rechazar el contrato en estado ${contratoData.estadoContrato} por el rol actual.`);
        }
      }
      updates.estadoContrato = nuevoEstado;
      transaction.update(contratoRef, updates);
      functions.logger.info(`Contrato ${contratoId} ${accion} por ${actorId}. Nuevo estado: ${nuevoEstado}`);
      return { success: true, message: `Contrato ${accion} exitosamente.` };
    });
  } else {
    throw new functions.https.HttpsError("invalid-argument", "Acción no válida.");
  }
});

export const crearSolicitudSoporte = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando crearSolicitudSoporte", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const solicitanteId = context.auth.uid;
  const { tipoSoporte, mensaje, rolSolicitante, referenciaId, prioridadTicket, adjuntosUrls } = data;

  if (!tipoSoporte || !mensaje || !rolSolicitante) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan campos requeridos: tipoSoporte, mensaje, rolSolicitante.");
  }
  if (rolSolicitante !== 'usuario' && rolSolicitante !== 'prestador') {
     throw new functions.https.HttpsError("invalid-argument", "rolSolicitante debe ser 'usuario' o 'prestador'.");
  }

  const ahora = admin.firestore.Timestamp.now();
  const nuevaSolicitudData: Omit<SoporteTicketData, "id"> = {
    solicitanteId: solicitanteId,
    rolSolicitante: rolSolicitante as 'usuario' | 'prestador',
    tipoSoporte: tipoSoporte,
    mensaje: mensaje, // Este es el primer mensaje del historial
    estadoSolicitud: "pendiente",
    fechaCreacion: ahora,
    historialConversacion: [{ remitenteId: solicitanteId, mensaje: mensaje, timestamp: ahora }],
    ...(referenciaId && { referenciaId: referenciaId as string }),
    ...(prioridadTicket && { prioridadTicket: prioridadTicket as SoporteTicketData['prioridadTicket'] }),
    ...(adjuntosUrls && Array.isArray(adjuntosUrls) && { adjuntosUrls: adjuntosUrls as string[] }),
  };

  try {
    const solicitudRef = await db.collection("soporte").add(nuevaSolicitudData);
    functions.logger.info(`Solicitud de soporte ${solicitudRef.id} creada por ${solicitanteId}.`);
    // SIMULACIÓN: Notificar al equipo de soporte
    return { success: true, message: "Solicitud de soporte enviada.", ticketId: solicitudRef.id };
  } catch (error: any) {
    functions.logger.error("Error al crear solicitud de soporte:", error);
    throw new functions.https.HttpsError("internal", "No se pudo registrar la solicitud de soporte.", error.message);
  }
});

export const obtenerTraduccion = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando obtenerTraduccion", { structuredData: true, data });
  const { claveUnica, idiomaSolicitado } = data;

  if (!claveUnica || !idiomaSolicitado) {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'claveUnica' e 'idiomaSolicitado'.");
  }
  const DEFAULT_LANGUAGE = 'es';

  try {
    const traduccionRef = db.collection("traducciones").doc(claveUnica);
    const docSnap = await traduccionRef.get();

    if (!docSnap.exists) {
      functions.logger.warn(`[Traduccion] Clave no encontrada: ${claveUnica}`);
      return { traduccion: claveUnica, idiomaDevuelto: null, mensaje: "Clave de traducción no encontrada." };
    }

    const traduccionData = docSnap.data() as TraduccionDataFirestore;
    let textoTraducido = traduccionData[idiomaSolicitado.toLowerCase()];
    let idiomaDevuelto = idiomaSolicitado.toLowerCase();

    if (typeof textoTraducido === 'string' && textoTraducido.trim() !== '') {
      return { traduccion: textoTraducido, idiomaDevuelto: idiomaDevuelto, mensaje: "Traducción obtenida." };
    }
    
    textoTraducido = traduccionData[DEFAULT_LANGUAGE];
    idiomaDevuelto = DEFAULT_LANGUAGE;
    if (typeof textoTraducido === 'string' && textoTraducido.trim() !== '') {
      return { traduccion: textoTraducido, idiomaDevuelto: idiomaDevuelto, mensaje: "Traducción obtenida en idioma por defecto." };
    }
    
    return { traduccion: claveUnica, idiomaDevuelto: null, mensaje: "No se encontró traducción adecuada." };
  } catch (error: any) {
    functions.logger.error("[Traduccion] Error:", error);
    throw new functions.https.HttpsError("internal", "Error al obtener la traducción.", error.message);
  }
});


// --- FUNCIONES DE UBICACIÓN Y COBERTURA ---
export const actualizarUbicacionPrestador = functions.https.onCall(async (data, context) => {
    functions.logger.info("Iniciando actualizarUbicacionPrestador", { structuredData: true, data });

    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "El prestador debe estar autenticado.");
    }
    const prestadorId = context.auth.uid;
    const { lat, lng } = data;

    if (typeof lat !== "number" || typeof lng !== "number") {
        throw new functions.https.HttpsError("invalid-argument", "Se requieren 'lat' y 'lng' numéricos.");
    }

    const ahora = admin.firestore.Timestamp.now();
    const ubicacionData: UbicacionPrestadorData = { lat, lng, timestamp: ahora };
    
    const prestadorRef = db.collection("prestadores").doc(prestadorId);
    const ubicacionRef = db.collection("ubicacionesPrestadores").doc(prestadorId);

    try {
        const batch = db.batch();
        batch.set(ubicacionRef, ubicacionData, { merge: true }); 
        batch.update(prestadorRef, {
            currentLocation: ubicacionData,
            isAvailable: true, // Asumir que al actualizar ubicación, está disponible
            lastConnection: ahora,
        });
        await batch.commit();
        functions.logger.info(`Ubicación de prestador ${prestadorId} actualizada: ${lat}, ${lng}`);
        return { success: true, message: "Ubicación actualizada." };
    } catch (error: any) {
        functions.logger.error(`Error al actualizar ubicación para ${prestadorId}:`, error);
        const prestadorDoc = await prestadorRef.get(); // Verificar si el perfil existe
        if (!prestadorDoc.exists) {
             throw new functions.https.HttpsError("not-found", `Perfil del prestador ${prestadorId} no encontrado.`);
        }
        throw new functions.https.HttpsError("internal", "Error al actualizar la ubicación.", error.message);
    }
});

export const obtenerUbicacionesCercanas = functions.https.onCall(async (data, context) => {
    functions.logger.info("Iniciando obtenerUbicacionesCercanas", { structuredData: true, data });
    const { usuarioLat, usuarioLng, radioKm } = data;

    if (typeof usuarioLat !== "number" || typeof usuarioLng !== "number" || typeof radioKm !== "number" || radioKm <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Se requieren 'usuarioLat', 'usuarioLng' y 'radioKm' válidos.");
    }

    try {
        const ubicacionesSnapshot = await db.collection("ubicacionesPrestadores").get(); // Considerar filtrar por timestamp reciente
        const prestadoresCercanosPromesas = ubicacionesSnapshot.docs.map(async (doc) => {
            const ubicacionData = doc.data() as UbicacionPrestadorData;
            const prestadorId = doc.id;
            const distancia = calculateDistance(usuarioLat, usuarioLng, ubicacionData.lat, ubicacionData.lng);

            if (distancia <= radioKm) {
                const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
                if (prestadorDoc.exists) {
                    const prestadorData = prestadorDoc.data() as ProviderData;
                    if (prestadorData.isAvailable) { // Solo disponibles
                        return {
                            id: prestadorId,
                            nombre: prestadorData.name,
                            rating: prestadorData.rating,
                            lat: ubicacionData.lat,
                            lng: ubicacionData.lng,
                            distanciaKm: parseFloat(distancia.toFixed(1)),
                            categoriaPrincipal: prestadorData.services?.[0]?.category,
                            avatarUrl: prestadorData.avatarUrl,
                            isAvailable: prestadorData.isAvailable,
                        };
                    }
                }
            }
            return null;
        });

        const prestadoresCercanosConNulos = await Promise.all(prestadoresCercanosPromesas);
        const prestadoresFiltrados = prestadoresCercanosConNulos.filter(p => p !== null) as any[];

        prestadoresFiltrados.sort((a, b) => {
            if (a.distanciaKm < b.distanciaKm) return -1;
            if (a.distanciaKm > b.distanciaKm) return 1;
            return (b.rating || 0) - (a.rating || 0);
        });

        functions.logger.info(`Encontrados ${prestadoresFiltrados.length} prestadores disponibles dentro de ${radioKm}km.`);
        return prestadoresFiltrados;
    } catch (error: any) {
        functions.logger.error("Error en obtenerUbicacionesCercanas:", error);
        throw new functions.https.HttpsError("internal", "Error al buscar prestadores cercanos.", error.message);
    }
});

const ZONAS_DE_COBERTURA: CoberturaZone[] = [ /* ... Zonas predefinidas ... */ ];

export const validarCoberturaServicio = functions.https.onCall(async (data, context) => {
    // ... Implementación existente ...
    return {enCobertura: false, mensaje: "Función no completamente implementada como solicitada previamente."};
});

export const validarCoberturaYObtenerPrestadoresCercanos = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando validarCoberturaYObtenerPrestadoresCercanos", { structuredData: true, data });
  const { direccionTexto, lat, lng } = data;
  const usuarioId = context.auth?.uid;
  const MAX_DISTANCIA_SUGERENCIAS_KM = 20;
  const MAX_PRESTADORES_SUGERIDOS = 5;

  let coordenadasUsuario: { lat: number, lng: number };
  if (typeof lat === 'number' && typeof lng === 'number') {
      coordenadasUsuario = { lat, lng };
  } else {
      functions.logger.warn("Geocodificación no implementada, se requieren coordenadas.");
      await db.collection("validacionesConPrestadores").add({ /* ... log de geocodificación fallida ... */ });
      throw new functions.https.HttpsError("invalid-argument", "Se requieren coordenadas (lat, lng) para esta función.");
  }

  let enCobertura = false;
  let zonaIdDetectada: string | undefined;
  let mensajeResultado = "Ubicación fuera de nuestras zonas de cobertura actuales.";

  for (const zona of ZONAS_DE_COBERTURA) {
      const distancia = calculateDistance(coordenadasUsuario.lat, coordenadasUsuario.lng, zona.centro.lat, zona.centro.lng);
      if (distancia <= zona.radioKm) {
          enCobertura = true;
          zonaIdDetectada = zona.id;
          mensajeResultado = `Ubicación dentro de la zona: ${zona.nombre}.`;
          break;
      }
  }

  if (!enCobertura) {
    await db.collection("validacionesConPrestadores").add({ /* ... log de no cobertura ... */ });
    return { enCobertura, mensaje: mensajeResultado, prestadoresSugeridos: [] };
  }

  let prestadoresSugeridos: PrestadorSugeridoConDistancia[] = [];
  try {
    const prestadoresSnapshot = await db.collection("prestadores").where("isAvailable", "==", true).get();
    const prestadoresCercanosPromesas = prestadoresSnapshot.docs.map(async (doc) => {
        const pData = doc.data() as ProviderData;
        const pId = doc.id;
        if (!pData.currentLocation?.lat || !pData.currentLocation?.lng) return null;
        const distanciaKm = calculateDistance(coordenadasUsuario.lat, coordenadasUsuario.lng, pData.currentLocation.lat, pData.currentLocation.lng);
        if (distanciaKm <= MAX_DISTANCIA_SUGERENCIAS_KM) {
            let esPremium = false;
            const membresiaDoc = await db.collection("membresias").doc(pId).get();
            if (membresiaDoc.exists) {
                const membresiaData = membresiaDoc.data() as MembresiaData;
                if (membresiaData.estadoMembresia === 'activa' && membresiaData.tipoMembresia.startsWith('premium')) {
                    esPremium = true;
                }
            }
            let sortScore = esPremium ? 0 : 1000;
            sortScore += (5 - (pData.rating || 0)) * 100;
            sortScore += distanciaKm;
            const categoriaInfo = SERVICE_CATEGORIES_FUNCTIONS.find(sc => sc.id === pData.services?.[0]?.categoria);

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
                categoriaPrincipal: categoriaInfo?.name || pData.services?.[0]?.categoria || "General",
                isAvailable: pData.isAvailable,
                sortScore,
            };
        }
        return null;
    });
    const prestadoresTemp = (await Promise.all(prestadoresCercanosPromesas)).filter(p => p !== null) as (PrestadorSugeridoConDistancia & {sortScore: number})[];
    prestadoresTemp.sort((a, b) => a.sortScore - b.sortScore);
    prestadoresSugeridos = prestadoresTemp.slice(0, MAX_PRESTADORES_SUGERIDOS).map(p => {
        const { sortScore, ...rest } = p;
        return rest;
    });
    mensajeResultado += ` Se encontraron ${prestadoresSugeridos.length} prestadores.`;
  } catch (error: any) {
      functions.logger.error("Error al obtener/filtrar prestadores:", error);
      mensajeResultado += " Error al buscar prestadores.";
  }
  
  await db.collection("validacionesConPrestadores").add({ /* ... log completo ... */ });
  return { enCobertura, mensaje: mensajeResultado, zonaId: zonaIdDetectada, prestadoresSugeridos };
});


export const obtenerDetallesPrestadorParaPopup = functions.https.onCall(async (data, context) => {
    // ... Implementación existente ...
    return { id: "test", nombre: "Test", enlacePerfil: "/test" };
});

export const sugerirPrestadoresConGeolocalizacion = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando sugerirPrestadoresConGeolocalizacion", { structuredData: true, data });

  const { ubicacionUsuario, radioKm = 20, maxResultados = 5 } = data;

  if (!ubicacionUsuario || typeof ubicacionUsuario.lat !== "number" || typeof ubicacionUsuario.lng !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'ubicacionUsuario' con 'lat' y 'lng' válidos.");
  }

  try {
    const prestadoresDisponiblesSnapshot = await db.collection("prestadores")
      .where("isAvailable", "==", true)
      .get();

    functions.logger.debug(`[SugerirGeo] Total prestadores disponibles leídos: ${prestadoresDisponiblesSnapshot.size}`);

    const promesasPrestadores = prestadoresDisponiblesSnapshot.docs.map(async (doc) => {
      const providerData = doc.data() as ProviderData;
      const providerId = doc.id;

      if (!providerData.currentLocation?.lat || !providerData.currentLocation?.lng) {
        functions.logger.debug(`[SugerirGeo] Prestador ${providerId} omitido por falta de currentLocation.`);
        return null;
      }

      const distancia = calculateDistance(ubicacionUsuario.lat, ubicacionUsuario.lng, providerData.currentLocation.lat, providerData.currentLocation.lng);

      if (distancia > radioKm) {
        functions.logger.debug(`[SugerirGeo] Prestador ${providerId} omitido por distancia: ${distancia.toFixed(1)}km > ${radioKm}km.`);
        return null;
      }

      let esPremium = false;
      const membresiaDoc = await db.collection("membresias").doc(providerId).get();
      if (membresiaDoc.exists) {
        const membresiaData = membresiaDoc.data() as MembresiaData;
        if (membresiaData.estadoMembresia === 'activa' && membresiaData.tipoMembresia?.startsWith('premium')) {
          esPremium = true;
        }
      }
      
      // Puntuación: Premium primero, luego mejor rating, luego menor distancia.
      // Un sortScore más bajo es mejor.
      let sortScore = 0;
      if (esPremium) {
        sortScore -= 10000; // Gran bonificación para premium
      }
      sortScore -= (providerData.rating || 0) * 100; // Mejor rating baja el score
      sortScore += distancia; // Menor distancia baja el score

      const categoriaInfo = SERVICE_CATEGORIES_FUNCTIONS.find(sc => sc.id === providerData.services?.[0]?.categoria);

      return {
        id: providerId,
        nombre: providerData.name,
        avatarUrl: providerData.avatarUrl,
        rating: providerData.rating,
        ratingCount: providerData.ratingCount,
        esPremium,
        distanciaKm: parseFloat(distancia.toFixed(1)),
        lat: providerData.currentLocation.lat,
        lng: providerData.currentLocation.lng,
        categoriaPrincipal: categoriaInfo?.name || providerData.services?.[0]?.categoria || "General",
        isAvailable: providerData.isAvailable,
        sortScore, // Usado para ordenar y luego se descarta
      };
    });

    const prestadoresFiltradosConScore = (await Promise.all(promesasPrestadores)).filter(p => p !== null) as (PrestadorSugeridoConDistancia & { sortScore: number })[];
    
    functions.logger.debug(`[SugerirGeo] Prestadores dentro del radio ${radioKm}km: ${prestadoresFiltradosConScore.length}`);

    prestadoresFiltradosConScore.sort((a, b) => a.sortScore - b.sortScore);

    const resultadosFinales = prestadoresFiltradosConScore.slice(0, maxResultados).map(p => {
      const { sortScore, ...rest } = p; // Quitar sortScore del objeto final
      return rest;
    });

    functions.logger.info(`[SugerirGeo] Devolviendo ${resultadosFinales.length} prestadores sugeridos.`);
    return resultadosFinales;

  } catch (error: any) {
    functions.logger.error("Error en sugerirPrestadoresConGeolocalizacion:", error);
    throw new functions.https.HttpsError("internal", "Error al obtener sugerencias de prestadores.", error.message);
  }
});


// --- FUNCIONES DE HISTORIAL ---
export const obtenerHistorialAgrupado = functions.https.onCall(async (data, context) => {
  functions.logger.info("Iniciando obtenerHistorialAgrupado", { structuredData: true, data });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const solicitanteUid = context.auth.uid;
  const { coleccionConsultar, rolDelSolicitante, estadosFiltrar } = data; // estadosFiltrar es opcional

  if (!coleccionConsultar || (coleccionConsultar !== 'citas' && coleccionConsultar !== 'servicios')) {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'coleccionConsultar' debe ser 'citas' o 'servicios'.");
  }
  if (!rolDelSolicitante || (rolDelSolicitante !== 'usuario' && rolDelSolicitante !== 'prestador')) {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'rolDelSolicitante' debe ser 'usuario' o 'prestador'.");
  }

  const idField = rolDelSolicitante === 'usuario' ? 'usuarioId' : 'prestadorId';
  const fechaOrderField = coleccionConsultar === 'citas' ? 'fechaCreacion' : 'fechaSolicitud'; // o updatedAt para servicios

  let query: admin.firestore.Query = db.collection(coleccionConsultar).where(idField, "==", solicitanteUid);

  if (estadosFiltrar && Array.isArray(estadosFiltrar) && estadosFiltrar.length > 0) {
    query = query.where('estado', 'in', estadosFiltrar);
  }
  query = query.orderBy(fechaOrderField, "desc");

  try {
    const snapshot = await query.get();
    const items: HistorialItemDetallado[] = [];

    snapshot.forEach(doc => {
      const docData = doc.data() as CitaData | ServiceData; // Tipado más general
      let participanteContrarioId = "";
      if (rolDelSolicitante === 'usuario') {
        participanteContrarioId = docData.prestadorId;
      } else { // rolDelSolicitante === 'prestador'
        participanteContrarioId = docData.usuarioId;
      }

      let fechaServicioProgramadaFormateada = "N/A";
      const fechaServicioTimestamp = (docData as CitaData).fechaHoraSolicitada || (docData as ServiceData).fechaServicio;
      if (fechaServicioTimestamp) {
        fechaServicioProgramadaFormateada = fechaServicioTimestamp.toDate().toLocaleString('es-MX', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
      }
      
      let calificadoPorSolicitante = false;
      if (rolDelSolicitante === 'usuario' && (docData as ServiceData).calificacionUsuario) {
        calificadoPorSolicitante = true;
      } else if (rolDelSolicitante === 'prestador' && (docData as ServiceData).calificacionPrestador) {
        calificadoPorSolicitante = true;
      }

      items.push({
        id: doc.id,
        tipo: coleccionConsultar === 'citas' ? 'cita' : 'servicio',
        estado: docData.estado,
        participanteContrarioId: participanteContrarioId,
        // participanteContrarioNombre: "Obtener de perfil", // Requeriría otra lectura
        fechaRelevante: (docData as CitaData).fechaCreacion || (docData as ServiceData).fechaSolicitud,
        fechaServicioProgramada: fechaServicioProgramadaFormateada,
        detallesPrincipales: (docData as CitaData).detallesServicio || (docData as ServiceData).detallesServicio,
        ubicacion: docData.ubicacion,
        montoEstimado: (docData as CitaData).montoTotalEstimado || (docData as ServiceData).precio,
        calificadoPorSolicitante: calificadoPorSolicitante,
      });
    });

    // Agrupar por estado
    const historialAgrupado: { [key: string]: HistorialItemDetallado[] } = {};
    items.forEach(item => {
      if (!historialAgrupado[item.estado]) {
        historialAgrupado[item.estado] = [];
      }
      historialAgrupado[item.estado].push(item);
    });
    
    functions.logger.info(`Historial agrupado para ${solicitanteUid} (${rolDelSolicitante}) en ${coleccionConsultar} obtenido. Total items: ${items.length}`);
    return historialAgrupado;

  } catch (error: any) {
    functions.logger.error("Error al obtener historial agrupado:", error);
    throw new functions.https.HttpsError("internal", "Error al obtener el historial.", error.message);
  }
});
