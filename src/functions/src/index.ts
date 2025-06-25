



import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {SERVICE_CATEGORIES, REPORT_CATEGORIES} from "./constants"; // Asumiendo que tienes este archivo o lo crearás

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- CONSTANTS FOR FINANCIALS & LOYALTY ---
const COMISION_SISTEMA_PAGO_PORCENTAJE = 0.04; // 4% payment processor fee
const COMISION_APP_SERVICIOMAP_PORCENTAJE = 0.06; // 6% ServiMap app commission on original total
const PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD = 0.10; // 10% of ServiMap's commission goes to loyalty
const PORCENTAJE_COMISION_EMBAJADOR = 0.05; // 5% ambassador commission on original total
const FACTOR_CONVERSION_PUNTOS = 10; // $10 MXN (or monetary unit) per 1 loyalty point
const DEFAULT_LANGUAGE_CODE = "es";
const HORAS_ANTES_RECORDATORIO_SERVICIO = 24;
const PLAZO_REPORTE_DIAS = 7;
const MINUTOS_VENTANA_CANCELACION = 10;
const COMISION_CANCELACION_TARDIA_PORCENTAJE = 0.10; // 10%
const MAX_ACTIVE_COMMUNITY_NOTICES = 3;
const DOS_HORAS_EN_MS = 2 * 60 * 60 * 1000;
const TREINTA_MINUTOS_EN_MS = 30 * 60 * 1000;

// --- CONSTANTS FOR CANCELLATION PENALTIES (CITAS) ---
const PENALIZACION_CLIENTE_CITA_MAS_2H_PCT = 0.10; // 10% of service total, all to platform
const PENALIZACION_CLIENTE_CITA_MENOS_2H_PCT_TOTAL = 0.25; // 25% of service total
const PENALIZACION_CLIENTE_CITA_MENOS_2H_PCT_PLATAFORMA = 0.10; // 10% of service total to platform
const PENALIZACION_CLIENTE_CITA_MENOS_2H_PCT_PRESTADOR = 0.15; // 15% of service total to provider


// --- INTERFACES (Locally defined for Cloud Functions context) ---
export type ServiceRequestStatus =
  | "agendado"
  | "pendiente_confirmacion"
  | "pendiente_confirmacion_usuario"
  | "confirmada_prestador"
  | "pagada"
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador"
  | "completado_por_usuario"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "cancelada_admin"
  | "rechazada_prestador"
  | "en_disputa"
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta"
  | "cerrado_forzado_admin";

export type EstadoFinalServicio =
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "rechazada_prestador"
  | "cancelada_admin"
  | "cerrado_forzado_admin";

const ESTADOS_FINALES_SERVICIO: EstadoFinalServicio[] = [
  "cerrado_automaticamente", "cerrado_con_calificacion", "cerrado_con_disputa_resuelta",
  "cancelada_usuario", "cancelada_prestador", "rechazada_prestador", "cancelada_admin", "cerrado_forzado_admin"
];

export type PaymentStatus =
  | "pendiente_confirmacion_usuario"
  | "retenido_para_liberacion"
  | "liberado_al_proveedor"
  | "congelado_por_disputa"
  | "reembolsado_parcial"
  | "reembolsado_total"
  | "pendiente_cobro"
  | "procesado_exitosamente"
  | "fallido"
  | "no_aplica";

interface IndicadoresRendimiento {
  puntualidad?: number;
  calidadServicio?: number;
  comunicacion?: number;
  cumplimientoRequerimientos?: number;
}

interface CalificacionDetallada {
  estrellas: number;
  comentario?: string;
  fecha: admin.firestore.Timestamp;
  indicadoresRendimiento?: IndicadoresRendimiento;
  aspectosPositivos?: string[];
  areasDeMejora?: string[];
}

interface DetallesFinancieros {
  montoTotalPagadoPorUsuario?: number;
  comisionSistemaPagoPct?: number;
  comisionSistemaPagoMonto?: number;
  montoNetoProcesador?: number;
  comisionAppPct?: number;
  comisionAppMonto?: number;
  aporteFondoFidelidadMonto?: number;
  montoBrutoParaPrestador?: number;
  montoFinalLiberadoAlPrestador?: number;
  fechaLiberacion?: admin.firestore.Timestamp;
}
export interface HistorialPuntoUsuario {
  servicioId?: string;
  promocionId?: string;
  tipo: "ganados" | "canjeados";
  puntos: number;
  fecha: admin.firestore.Timestamp;
  descripcion?: string;
}
export interface HistorialComision {
  servicioId: string;
  prestadorId: string;
  montoComision: number;
  fecha: admin.firestore.Timestamp;
}
export interface UserData {
  fcmTokens?: string[];
  nombre?: string;
  puntosAcumulados?: number;
  historialPuntos?: admin.firestore.FieldValue | HistorialPuntoUsuario[];
  isPremium?: boolean;
  idiomaPreferido?: string;
  favoritos?: string[];
  codigoEmbajador?: string;
  referidos?: string[];
  comisionesAcumuladas?: number;
  historialComisiones?: admin.firestore.FieldValue | HistorialComision[];
  isBlocked?: boolean;
  blockReason?: string;
  blockDate?: admin.firestore.Timestamp;
}

interface ProviderLocation {
  lat: number;
  lng: number;
  pais?: string;
}

export interface ProviderData {
  fcmTokens?: string[];
  nombre?: string;
  isPremium?: boolean;
  aceptaCotizacion?: boolean;
  aceptaViajes?: boolean;
  aceptaTrabajosVirtuales?: boolean;
  empresa?: string;
  services?: {category: string; title: string; description: string; price: number}[];
  specialties?: string[];
  isAvailable?: boolean;
  currentLocation?: ProviderLocation | null;
  rating?: number;
  avatarUrl?: string;
  categoryIds?: string[];
  embajadorUID?: string;
  isBlocked?: boolean;
  blockReason?: string;
  blockDate?: admin.firestore.Timestamp;
}

export interface ServiceRequest {
  id: string;
  usuarioId: string;
  prestadorId: string;
  status: ServiceRequestStatus;
  createdAt: admin.firestore.Timestamp | number;
  updatedAt?: admin.firestore.Timestamp | number;
  fechaFinalizacionEfectiva?: admin.firestore.Timestamp | number;
  cancellationWindowExpiresAt?: admin.firestore.Timestamp | number;
  titulo?: string;
  actorDelCambioId?: string;
  actorDelCambioRol?: "usuario" | "prestador" | "sistema" | "admin";
  calificacionUsuario?: CalificacionDetallada;
  calificacionPrestador?: CalificacionDetallada;
  paymentStatus?: PaymentStatus;
  metodoPago?: 'tarjeta' | 'efectivo' | 'transferencia' | 'wallet';
  originatingQuotationId?: string;
  precio?: number;
  montoCobrado?: number;
  paymentReleasedToProviderAt?: admin.firestore.Timestamp | number;
  detallesFinancieros?: admin.firestore.FieldValue | DetallesFinancieros;
  serviceDate?: string; // YYYY-MM-DD
  serviceTime?: string; // HH:MM
  reporteActivoId?: string;
  estadoDisputa?: "ninguna" | "abierta" | "resuelta";
  serviceType?: "fixed" | "hourly";
  selectedFixedServices?: {serviceId: string, title: string, price: number}[];
  totalAmount?: number; // For fixed services array
  durationHours?: number; // For hourly services
  hourlyRate?: number; // For hourly services
  estimatedTotal?: number; // For hourly services
  originatingServiceId?: string;
  isRecurringAttempt?: boolean;
  reactivationOfferedBy?: "usuario" | "prestador";
  mutualRatingCompleted?: boolean;
  location?: ProviderLocation | { customAddress: string };
  notes?: string;
  providerMarkedCompleteAt?: number;
  userConfirmedCompletionAt?: number;
  ratingWindowExpiresAt?: number;
  warrantyEndDate?: string;
  garantiaActiva?: boolean;
  solicitadoPorEmpresaId?: string;
  miembroEmpresaUid?: string;
  paymentIntentId?: string;
  disputeDetails?: {reportedAt: number; reason: string; resolution?: string; resolvedAt?: number;};
  actualStartTime?: admin.firestore.Timestamp | number;
  actualEndTime?: admin.firestore.Timestamp | number;
  actualDurationHours?: number;
  finalTotal?: number;
  category?: string;
}

export type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador" | "precio_propuesto_al_usuario"
  | "rechazada_prestador" | "aceptada_por_usuario"
  | "rechazada_usuario" | "convertida_a_servicio" | "expirada";

export interface SolicitudCotizacionData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  descripcionProblema: string;
  videoUrl?: string;
  estado: SolicitudCotizacionEstado;
  precioSugerido?: number;
  notasPrestador?: string;
  fechaCreacion: admin.firestore.Timestamp;
  fechaRespuestaPrestador?: admin.firestore.Timestamp;
  fechaRespuestaUsuario?: admin.firestore.Timestamp;
  tituloServicio?: string;
}

export interface ChatData {
  id?: string;
  solicitudServicioId: string;
  participantesUids: string[];
  participantesInfo?: {
    [uid: string]: {nombre?: string; rol: "usuario" | "prestador"};
  };
  fechaCreacion: admin.firestore.Timestamp;
  ultimaActualizacion?: admin.firestore.Timestamp;
  ultimoMensaje?: {
    texto: string;
    remitenteId: string;
    timestamp: admin.firestore.Timestamp;
  };
  estadoChat?: "activo" | "archivado_usuario" | "archivado_prestador" | "finalizado_servicio";
  conteoNoLeido?: {[uid: string]: number};
}

export type ActivityLogAction =
  | "CAMBIO_ESTADO_SOLICITUD" | "CALIFICACION_USUARIO" | "CALIFICACION_PRESTADOR"
  | "SOLICITUD_CREADA" | "PAGO_RETENIDO" | "PAGO_LIBERADO"
  | "GARANTIA_ACTIVADA" | "GARANTIA_APROBADA" | "GARANTIA_RECHAZADA"
  | "INICIO_SESION" | "CIERRE_SESION"
  | "CONFIG_CAMBIADA" | "COTIZACION_CREADA" | "COTIZACION_PRECIO_PROPUESTO"
  | "COTIZACION_ACEPTADA_USUARIO" | "COTIZACION_RECHAZADA" | "CHAT_CREADO"
  | "PUNTOS_FIDELIDAD_GANADOS" | "PUNTOS_FIDELIDAD_CANJEADOS" | "FONDO_FIDELIDAD_APORTE"
  | "PAGO_PROCESADO_DETALLES" | "TRADUCCION_SOLICITADA"
  | "NOTIFICACION_RECORDATORIO_PROGRAMADA" | "NOTIFICACION_RECORDATORIO_ENVIADA"
  | "REGLAS_ZONA_CONSULTADAS" | "ADMIN_ZONA_MODIFICADA"
  | "TICKET_SOPORTE_CREADO" | "TICKET_SOPORTE_ACTUALIZADO"
  | "BUSQUEDA_PRESTADORES" | "REPORTE_PROBLEMA_CREADO" | "GARANTIA_REGISTRADA"
  | "SERVICIO_REACTIVADO_SOLICITUD" | "SERVICIO_REACTIVADO_OFERTA"
  | "SERVICIO_CONFIRMADO_PAGADO"
  | "SERVICIO_CANCELADO_CON_PENALIZACION"
  | "SERVICIO_CANCELADO_SIN_PENALIZACION"
  | "COMUNIDAD_SOLICITUD_UNIRSE"
  | "COMUNIDAD_USUARIO_UNIDO"
  | "COMUNIDAD_SOLICITUD_APROBADA"
  | "COMUNIDAD_SOLICITUD_RECHAZADA"
  | "COMUNIDAD_USUARIO_EXPULSADO"
  | "COMUNIDAD_EMBAJADOR_NOTIFICADO_SOLICITUD"
  | "COMUNIDAD_AVISO_CREADO"
  | "COMUNIDAD_AVISO_ACTUALIZADO"
  | "COMUNIDAD_AVISO_ELIMINADO"
  | "COMUNIDAD_NUEVO_AVISO_NOTIFICADO"
  | "CITA_CREADA"
  | "CITA_CONFIRMADA_PRESTADOR"
  | "CITA_RECHAZADA_PRESTADOR"
  | "CITA_CANCELADA_USUARIO"
  | "CITA_CANCELADA_USUARIO_PENALIZACION"
  | "CITA_PAGO_INICIADO"
  | "CITA_PAGADA"
  | "CITA_COMPLETADA"
  | "CITA_ERROR_PAGO"
  | "CITA_VENTANA_SEGUIMIENTO_DEFINIDA"
  | "CITA_PROVEEDOR_NOTIFICADO_ONLINE"
  | "PROVEEDOR_REGISTRADO"
  | "CATEGORIA_PROPUESTA"
  | "CATEGORIA_APROBADA"
  | "CATEGORIA_RECHAZADA"
  | "EMBAJADOR_COMISION_PAGADA"
  | "RELACION_USUARIO_PRESTADOR_ACTUALIZADA"
  | "RECOMENDACION_RECONTRATACION_CREADA"
  | "RECONTRATACION_RECORDATORIO_ENVIADO"
  | "REPORTE_PROBLEMA_RESUELTO"
  | "ADMIN_CANCEL_SERVICE"
  | "ADMIN_FORCE_COMPLETE_SERVICE"
  | "ADMIN_BLOCK_USER"
  | "ADMIN_UNBLOCK_USER";


export interface PromocionFidelidad {
  id?: string;
  descripcion: string;
  puntosRequeridos: number;
  tipoDescuento: "porcentaje" | "monto_fijo";
  valorDescuento: number;
  activo: boolean;
  codigoPromocional?: string;
  usosDisponibles?: admin.firestore.FieldValue | number;
  fechaExpiracion?: admin.firestore.Timestamp;
  serviciosAplicables?: string[];
}

interface IdiomaRecursosFirestore {
  [key: string]: string;
}
interface IdiomaDocumentoFirestore {
  codigo: string;
  nombre: string;
  recursos: IdiomaRecursosFirestore;
}

export type RecordatorioTipo =
  | "recordatorio_servicio"
  | "alerta_cancelacion"
  | "alerta_cambio_servicio"
  | "alerta_pago_proximo"
  | "alerta_promocion";

export interface Recordatorio {
  id?: string;
  usuarioId: string;
  servicioId: string;
  tipo: RecordatorioTipo;
  mensaje: string;
  fechaProgramada: admin.firestore.Timestamp;
  enviado: boolean;
  fechaEnvio?: admin.firestore.Timestamp;
  intentosEnvio?: number;
  errorEnvio?: string;
  datosAdicionales?: {
    tituloServicio?: string;
    nombrePrestador?: string;
    fechaHoraServicioIso?: string;
    [key: string]: any;
  };
}

interface CoordenadaFirestore {
  lat: number;
  lng: number;
}

interface ReglasZonaFirestore {
  tarifaFactor?: number;
  descuentoAbsoluto?: number;
  descuentoPorcentual?: number;
  serviciosRestringidos?: string[];
  serviciosConPrioridad?: string[];
  promocionesActivasIds?: string[];
  mensajeEspecial?: string;
  disponibilidadAfectada?: "restringida_total" | "restringida_parcial" | "mejorada" | "sin_cambio";
}

interface ZonaPreferenteFirestore {
  id?: string;
  nombre: string;
  poligono: CoordenadaFirestore[];
  reglas: ReglasZonaFirestore;
  activa: boolean;
  prioridad?: number;
  descripcion?: string;
}

export type EstadoSolicitudSoporte =
  | "pendiente"
  | "en_proceso"
  | "esperando_respuesta_usuario"
  | "resuelto"
  | "cerrado";

export interface SoporteTicketData {
  id?: string;
  solicitanteId: string;
  rolSolicitante: "usuario" | "prestador";
  categoria: string;
  prioridad?: "baja" | "normal" | "alta" | "urgente";
  estado: EstadoSolicitudSoporte;
  descripcion: string;
  etiquetas?: string[];
  historialMensajes?: {
    remitenteId: string;
    mensaje: string;
    timestamp: admin.firestore.Timestamp;
  }[];
  fechaCreacion: admin.firestore.Timestamp;
  fechaActualizacion: admin.firestore.Timestamp;
  asignadoA?: string;
  referenciaId?: string; // e.g., servicioId, pagoId
  adjuntosUrls?: string[];
}

interface PrestadorBuscado {
  id: string;
  nombre: string;
  empresa?: string;
  distanciaKm?: number;
  calificacion: number;
  avatarUrl?: string;
  categoriaPrincipal?: string;
}

interface ReporteServicioData {
  id?: string;
  idServicio: string;
  idUsuarioReportante: string;
  rolReportante: "usuario" | "prestador";
  idReportado: string;
  rolReportado: "usuario" | "prestador";
  categoria: string;
  descripcionProblema: string;
  archivoAdjuntoURL?: string;
  fechaReporte: admin.firestore.Timestamp;
  estadoReporte: "pendiente_revision_admin" | "en_investigacion" | "resuelto_compensacion" | "resuelto_sin_compensacion" | "rechazado_reporte";
  idServicioOriginalData?: Partial<ServiceRequest>;
  garantiaActivada?: boolean;
  idGarantiaPendiente?: string;
  resolucionAdmin?: string; // Comentario del admin al resolver
  fechaResolucion?: admin.firestore.Timestamp;
  resueltaPorAdminId?: string;
}

interface GarantiaPendienteData {
  id?: string;
  idServicio: string;
  idUsuario: string;
  idPrestador: string;
  idReporte: string;
  fechaSolicitudGarantia: admin.firestore.Timestamp;
  estadoGarantia: "pendiente_revision" | "aprobada_compensacion" | "aprobada_re_servicio" | "rechazada_garantia";
  detallesServicioOriginal?: Partial<ServiceRequest>;
  descripcionProblemaOriginal: string;
  fechaResolucion?: admin.firestore.Timestamp;
  notasResolucion?: string;
  resueltaPorAdminId?: string;
}

interface ServicioConfirmadoData {
  userId: string;
  providerId: string;
  serviceDetails?: string;
  paymentAmount: number;
  status: "confirmado";
  confirmadoEn: admin.firestore.Timestamp;
  puedeCancelarHasta: admin.firestore.Timestamp;
  iniciado: boolean;
}

interface PagoPendienteData {
  userId: string;
  providerId: string;
  paymentAmount: number;
  retenido: boolean;
  status: "esperando_calificacion";
  creadoEn: admin.firestore.Timestamp;
}

interface CancelacionData {
  serviceId: string;
  actor: "usuario" | "prestador";
  penalizacionMonto?: number;
  penalizacionPorcentaje?: number;
  fechaCancelacion: admin.firestore.Timestamp;
  motivo?: string;
}

interface BannerComunitarioDetailsFirestore {
  titulo: string;
  imagenUrl: string;
  link?: string;
  activo: boolean;
  dataAiHint?: string;
}

interface ComunidadData {
  id?: string;
  nombre: string;
  descripcion: string;
  tipo: "publica" | "privada";
  ubicacion: ProviderLocation;
  bannerComunitario: BannerComunitarioDetailsFirestore;
  embajador_uid: string;
  miembros: string[];
  solicitudesPendientes: string[];
  fechaCreacion: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  tags?: string[];
  reglasComunidad?: string;
  lastActivity?: admin.firestore.Timestamp;
}

interface AvisoComunidadDataFirestore {
  id?: string;
  titulo: string;
  descripcion: string;
  fechaPublicacion: admin.firestore.Timestamp;
  activo: boolean;
  anclado: boolean;
  fechaExpiracion?: admin.firestore.Timestamp;
  autor_uid: string; // Should match embajador_uid from parent ComunidadData
}

// Specific type for Cita documents in Firestore
export type CitaEstadoFirestore =
  | "pendiente_confirmacion"
  | "confirmada_prestador"
  | "rechazada_prestador"
  | "cancelada_usuario"
  | "pagada"
  | "completada"
  | "cancelada_prestador"
  | "servicio_iniciado"
  | "en_camino_proveedor"
  | "completado_por_prestador"
  | "completado_por_usuario";

// Interface for Cita documents in Firestore
export interface CitaDataFirestore {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  fechaHoraSolicitada: admin.firestore.Timestamp;
  detallesServicio: string;
  ubicacion?: ProviderLocation | { customAddress: string };
  notasAdicionales?: string;
  estado: CitaEstadoFirestore;
  fechaCreacion: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  fechaConfirmacionPrestador?: admin.firestore.Timestamp | null;
  fechaRechazoPrestador?: admin.firestore.Timestamp | null;
  ordenCobroId?: string;
  paymentStatus?: PaymentStatus;
  fechaCobro?: admin.firestore.Timestamp | null;
  montoCobrado?: number | null;
  fechaCancelacion?: admin.firestore.Timestamp | null;
  canceladaPor?: string;
  rolCancelador?: "usuario" | "prestador";
  motivoCancelacion?: string;
  detallesCancelacion?: {
    penalizacionTotalCalculada: number;
    montoParaPlataforma: number;
    montoParaPrestador: number;
    montoReembolsoProgramadoUsuario: number;
    reglaAplicada: '>2h' | '<=2h';
  };
  serviceType?: "fixed" | "hourly";
  precioServicio?: number;
  tarifaPorHora?: number;
  duracionHoras?: number;
  montoTotalEstimado?: number;
  permiteSeguimientoDesdeTimestamp?: admin.firestore.Timestamp;
  notificadoParaEstarEnLinea?: boolean;
}

export interface CategoriaPropuestaData {
    id?: string;
    providerId: string;
    nombrePropuesto: string;
    estado: 'pendiente' | 'aprobada' | 'rechazada';
    fechaCreacion: admin.firestore.Timestamp;
}

export interface RelacionUsuarioPrestadorData {
  usuarioId: string;
  prestadorId: string;
  serviciosContratados: number;
  ultimoServicioFecha: admin.firestore.Timestamp;
  categoriasServicios: string[];
  lastReminderSent?: admin.firestore.Timestamp;
}

export interface RecomendacionData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  categoria: string;
  mensaje: string;
  estado: 'pendiente' | 'vista' | 'aceptada' | 'descartada';
  fechaCreacion: admin.firestore.Timestamp;
  tipo?: 'sistema' | 'invita-prestador';
}

export interface MonitoredService {
  id: string;
  status: ServiceRequestStatus;
  userName: string;
  providerName: string;
  serviceTitle: string;
  scheduledDate: number; // Timestamp
  createdAt: number; // Timestamp
}

export interface BlockedUser {
  id: string;
  type: 'usuario' | 'prestador';
  name?: string;
  email?: string; // Add email if available in your user/provider docs
  isBlocked: boolean;
  blockReason?: string;
  blockDate?: admin.firestore.Timestamp;
}

export interface BannerPublicitario {
  id?: string;
  nombre: string;
  imagenUrl: string;
  linkDestino?: string;
  orden: number;
  activo: boolean;
  dataAiHint?: string;
  fechaInicio?: admin.firestore.Timestamp;
  fechaFin?: admin.firestore.Timestamp;
  regiones?: string[];
  idiomas?: string[];
  categorias?: string[];
}


// --- Helper para enviar notificaciones ---
async function sendNotification(userId: string, userType: "usuario" | "prestador", title: string, body: string, data?: {[key: string]: string}) {
  const userCol = userType === "usuario" ? "usuarios" : "prestadores";
  const userDoc = await db.collection(userCol).doc(userId).get();
  if (!userDoc.exists) {
    functions.logger.error(`[NotificationHelper] ${userType} ${userId} no encontrado.`);
    return;
  }
  const userData = userDoc.data() as (UserData | ProviderData);
  const tokens = userData.fcmTokens;

  if (tokens && tokens.length > 0) {
    const payload = {notification: {title, body}, data};
    try {
      await admin.messaging().sendToDevice(tokens, payload);
      functions.logger.info(`[NotificationHelper] Notificación enviada a ${userType} ${userId}.`);
    } catch (error) {
      functions.logger.error(`[NotificationHelper] Error enviando notificación a ${userType} ${userId}:`, error);
    }
  } else {
    functions.logger.log(`[NotificationHelper] ${userType} ${userId} no tiene tokens FCM.`);
  }
}

// --- Helper para crear logs de actividad ---
async function logActivity(
  actorId: string,
  actorRol: "usuario" | "prestador" | "sistema" | "admin",
  accion: ActivityLogAction,
  descripcion: string,
  entidadAfectada?: {tipo: string; id: string},
  detallesAdicionales?: Record<string, any>
) {
  try {
    await db.collection("logs_actividad").add({
      actorId,
      actorRol,
      accion,
      descripcion,
      fecha: admin.firestore.Timestamp.now(),
      entidadAfectada: entidadAfectada || null,
      detallesAdicionales: detallesAdicionales || null,
    });
    functions.logger.info(`[LogActivityHelper] Log creado: ${descripcion}`);
  } catch (error) {
    functions.logger.error(`[LogActivityHelper] Error al crear log: ${descripcion}`, error);
  }
}

export const createImmediateServiceRequest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
    }
    const usuarioId = context.auth.uid;
    const { providerId, selectedServices, totalAmount, location, metodoPago } = data;

    if (!providerId || !Array.isArray(selectedServices) || selectedServices.length === 0 || typeof totalAmount !== "number" || !location || !metodoPago) {
        throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos o son inválidos.");
    }

    const now = admin.firestore.Timestamp.now();
    const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();

    const providerDoc = await db.collection("prestadores").doc(providerId).get();
    if (!providerDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Proveedor con ID ${providerId} no encontrado.`);
    }

    const nuevaSolicitudData: Omit<ServiceRequest, "id" | "serviceType"> & { serviceType: "fixed" } = {
        usuarioId: usuarioId,
        prestadorId: providerId,
        status: "pagada", // Servicio inmediato, se asume pagado y listo para empezar.
        createdAt: now,
        updatedAt: now,
        titulo: `Servicio inmediato: ${selectedServices.map((s: any) => s.title).join(", ")}`,
        serviceType: "fixed",
        selectedFixedServices: selectedServices,
        totalAmount: totalAmount,
        montoCobrado: totalAmount,
        location: location,
        metodoPago: metodoPago,
        paymentStatus: "retenido_para_liberacion", // El pago se retiene hasta la confirmación final
        actorDelCambioId: usuarioId,
        actorDelCambioRol: "usuario",
    };

    await nuevaSolicitudRef.set(nuevaSolicitudData);

    await logActivity(
        usuarioId,
        "usuario",
        "SOLICITUD_CREADA",
        `Usuario ${usuarioId} creó y pagó una solicitud de servicio inmediato #${nuevaSolicitudRef.id} para el proveedor ${providerId}.`,
        { tipo: "solicitud_servicio", id: nuevaSolicitudRef.id },
        { totalAmount, metodoPago }
    );

    await sendNotification(
        providerId,
        "prestador",
        "¡Nuevo Servicio Inmediato!",
        `Has recibido un nuevo servicio inmediato de ${usuarioId}. ¡Prepárate!`,
        { solicitudId: nuevaSolicitudRef.id }
    );

    return { success: true, message: "Servicio inmediato creado y pago procesado.", solicitudId: nuevaSolicitudRef.id };
});


export const onServiceStatusChangeSendNotification = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const newValue = change.after.data() as ServiceRequest;
    const previousValue = change.before.data() as ServiceRequest;
    const solicitudId = context.params.solicitudId;

    if (!newValue || !previousValue) {
      functions.logger.log(`[FCM Trigger Solicitud ${solicitudId}] No new or previous data, exiting.`);
      return null;
    }
    if (newValue.status === previousValue.status && newValue.paymentStatus === previousValue.paymentStatus) return null;

    functions.logger.log(`[FCM Trigger Solicitud ${solicitudId}] Estado/Pago cambiado. Antes: ${previousValue.status}, ${previousValue.paymentStatus}. Después: ${newValue.status}, ${newValue.paymentStatus}.`);

    const usuarioId = newValue.usuarioId;
    const prestadorId = newValue.prestadorId;
    let tituloNotif = "";
    let cuerpoNotif = "";
    let targetUserId: string | null = null;
    let targetUserType: "usuario" | "prestador" | null = null;
    const serviceTitle = newValue.titulo || "un servicio";
    let sendStdNotification = true;

    if (newValue.status !== previousValue.status) {
      switch (newValue.status) {
      case "agendado":
        if (newValue.isRecurringAttempt && newValue.reactivationOfferedBy === "usuario") {
          targetUserId = prestadorId; targetUserType = "prestador";
          tituloNotif = "Solicitud de Reactivación de Servicio";
          cuerpoNotif = `El usuario ${newValue.usuarioId} quiere reactivar el servicio "${serviceTitle}". Por favor, confirma la nueva fecha/hora.`;
        } else if (!newValue.isRecurringAttempt && previousValue.status !== "pendiente_confirmacion_usuario") {
          targetUserId = prestadorId; targetUserType = "prestador";
          tituloNotif = "Nueva Solicitud de Servicio";
          cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}".`;
        } else {
          sendStdNotification = false;
        }
        break;
      case "pendiente_confirmacion_usuario":
        if (newValue.isRecurringAttempt && newValue.reactivationOfferedBy === "prestador") {
          targetUserId = usuarioId; targetUserType = "usuario";
          tituloNotif = "Oferta de Reactivación de Servicio";
          cuerpoNotif = `El prestador ${newValue.prestadorId} te ofrece reactivar el servicio "${serviceTitle}". Por favor, confirma si deseas continuar.`;
        } else {
          sendStdNotification = false;
        }
        break;
      case "confirmada_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "¡Cita Confirmada!"; cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido confirmada.`;

        if (newValue.serviceDate && newValue.serviceTime) {
          try {
            const [year, month, day] = newValue.serviceDate.split("-").map(Number);
            const [hour, minute] = newValue.serviceTime.split(":").map(Number);
            const serviceDateTime = new Date(year, month - 1, day, hour, minute);
            const reminderTime = new Date(serviceDateTime.getTime() - HORAS_ANTES_RECORDATORIO_SERVICIO * 60 * 60 * 1000);

            if (reminderTime.getTime() > Date.now()) {
              const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
              const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData)?.nombre || "El prestador" : "El prestador";

              const reminderData: Omit<Recordatorio, "id"> = {
                usuarioId: usuarioId,
                servicioId: solicitudId,
                tipo: "recordatorio_servicio",
                mensaje: `Recordatorio: Tu servicio "${serviceTitle}" con ${nombrePrestador} es mañana a las ${newValue.serviceTime}.`,
                fechaProgramada: admin.firestore.Timestamp.fromDate(reminderTime),
                enviado: false,
                datosAdicionales: {
                  tituloServicio: serviceTitle,
                  nombrePrestador: nombrePrestador,
                  fechaHoraServicioIso: serviceDateTime.toISOString(),
                },
              };
              const reminderRef = await db.collection("recordatorios").add(reminderData);
              functions.logger.info(`[Reminder Scheduled] Recordatorio programado para servicio ${solicitudId} en ${reminderTime.toISOString()}. ID: ${reminderRef.id}`);
              await logActivity("sistema", "sistema", "NOTIFICACION_RECORDATORIO_PROGRAMADA", `Recordatorio programado para servicio ${solicitudId}.`, {tipo: "recordatorio", id: reminderRef.id});
            }
          } catch (e) {
            functions.logger.error(`[Reminder Scheduling Error] Error al parsear fecha/hora para servicio ${solicitudId}: ${newValue.serviceDate} ${newValue.serviceTime}`, e);
          }
        }
        break;
      case "rechazada_prestador": case "cancelada_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = `Cita ${newValue.status === "rechazada_prestador" ? "Rechazada" : "Cancelada"}`;
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido ${newValue.status === "rechazada_prestador" ? "rechazada" : "cancelada"} por el prestador.`;
        break;
      case "cancelada_usuario":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "Cita Cancelada por Usuario"; cuerpoNotif = `La cita para "${serviceTitle}" ha sido cancelada por el usuario.`;
        break;
      case "en_camino_proveedor":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "¡Tu Proveedor está en Camino!"; cuerpoNotif = `El proveedor para "${serviceTitle}" está en camino.`;
        break;
      case "servicio_iniciado":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "Servicio Iniciado"; cuerpoNotif = `El proveedor ha iniciado el servicio "${serviceTitle}".`;
        break;
      case "completado_por_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "Servicio Completado por Prestador"; cuerpoNotif = `El prestador ha marcado "${serviceTitle}" como completado. Por favor, confirma y califica.`;
        break;
      case "completado_por_usuario":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "¡Servicio Confirmado por Usuario!"; cuerpoNotif = `El usuario ha confirmado la finalización de "${serviceTitle}". ¡Ya puedes calificarlo!`;
        break;
      }
    }

    if (newValue.paymentStatus !== previousValue.paymentStatus && newValue.paymentStatus === "liberado_al_proveedor") {
      targetUserId = prestadorId; targetUserType = "prestador";
      tituloNotif = "¡Pago Liberado!";
      const montoFinalLiberado = (newValue.detallesFinancieros as DetallesFinancieros)?.montoFinalLiberadoAlPrestador;
      const montoParaMensaje = montoFinalLiberado !== undefined ? montoFinalLiberado.toFixed(2) : (newValue.montoCobrado || newValue.precio || 0).toFixed(2);
      cuerpoNotif = `El pago para el servicio "${serviceTitle}" ha sido liberado a tu cuenta. Monto: $${montoParaMensaje}.`;
      sendStdNotification = true;
    }

    if (sendStdNotification && targetUserId && targetUserType && tituloNotif && cuerpoNotif) {
      await sendNotification(targetUserId, targetUserType, tituloNotif, cuerpoNotif, {solicitudId, nuevoEstado: newValue.status, nuevoEstadoPago: newValue.paymentStatus || "N/A"});
    }
    return null;
  });

export const logSolicitudServicioChanges = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const solicitudId = context.params.solicitudId;
    const beforeData = change.before.data() as ServiceRequest | undefined;
    const afterData = change.after.data() as ServiceRequest | undefined;

    if (!beforeData || !afterData) {
      functions.logger.warn(`[LogTrigger ${solicitudId}] Datos antes o después no disponibles.`);
      return null;
    }

    const actorId = afterData.actorDelCambioId || "sistema";
    const actorRol: "usuario" | "prestador" | "sistema" | "admin" = afterData.actorDelCambioRol || "sistema";
    const now = admin.firestore.Timestamp.now();
    const updatesToServiceRequest: Partial<ServiceRequest> & {updatedAt?: admin.firestore.Timestamp} = {updatedAt: now};


    if (beforeData.status !== afterData.status) {
      const descLog = `Solicitud ${solicitudId} cambió de ${beforeData.status} a ${afterData.status} por ${actorRol} ${actorId}.`;
      await logActivity(actorId, actorRol, "CAMBIO_ESTADO_SOLICITUD", descLog, {tipo: "solicitud_servicio", id: solicitudId}, {estadoAnterior: beforeData.status, estadoNuevo: afterData.status});
      if (ESTADOS_FINALES_SERVICIO.includes(afterData.status as EstadoFinalServicio) && !ESTADOS_FINALES_SERVICIO.includes(beforeData.status as EstadoFinalServicio)) {
        updatesToServiceRequest.fechaFinalizacionEfectiva = now;
      }
    }

    if (!beforeData.calificacionUsuario && afterData.calificacionUsuario) {
      const descLog = `Usuario ${afterData.usuarioId} calificó servicio ${solicitudId} (Prestador: ${afterData.prestadorId}) con ${afterData.calificacionUsuario.estrellas} estrellas.`;
      await logActivity(afterData.usuarioId, "usuario", "CALIFICACION_USUARIO", descLog, {tipo: "solicitud_servicio", id: solicitudId}, {
        estrellas: afterData.calificacionUsuario.estrellas,
        comentario: afterData.calificacionUsuario.comentario || "",
        indicadores: afterData.calificacionUsuario.indicadoresRendimiento,
        aspectosPositivos: afterData.calificacionUsuario.aspectosPositivos,
        areasDeMejora: afterData.calificacionUsuario.areasDeMejora,
      });
    }

    if (!beforeData.calificacionPrestador && afterData.calificacionPrestador) {
      const descLog = `Prestador ${afterData.prestadorId} calificó a usuario ${afterData.usuarioId} en servicio ${solicitudId} con ${afterData.calificacionPrestador.estrellas} estrellas.`;
      await logActivity(afterData.prestadorId, "prestador", "CALIFICACION_PRESTADOR", descLog, {tipo: "solicitud_servicio", id: solicitudId}, {
        estrellas: afterData.calificacionPrestador.estrellas,
        comentario: afterData.calificacionPrestador.comentario || "",
      });
    }

    const isFinalizedState = ESTADOS_FINALES_SERVICIO.includes(afterData.status as EstadoFinalServicio);
    const wasNotFinalizedBefore = !ESTADOS_FINALES_SERVICIO.includes(beforeData.status as EstadoFinalServicio);

    if (isFinalizedState && wasNotFinalizedBefore) {
        // --- START RELATIONSHIP TRACKING ---
        const relationshipId = `${afterData.usuarioId}_${afterData.prestadorId}`;
        const relationshipRef = db.collection("relacionesUsuarioPrestador").doc(relationshipId);
        let serviceCategory = afterData.category;
        if (!serviceCategory) {
            const providerDoc = await db.collection("prestadores").doc(afterData.prestadorId).get();
            if (providerDoc.exists) {
                const providerData = providerDoc.data() as ProviderData;
                serviceCategory = providerData.categoryIds?.[0] || "general";
            }
        }
        if (serviceCategory) {
            try {
                await db.runTransaction(async (transaction) => {
                    const relDoc = await transaction.get(relationshipRef);
                    if (relDoc.exists) {
                        transaction.update(relationshipRef, {
                            serviciosContratados: admin.firestore.FieldValue.increment(1),
                            ultimoServicioFecha: now,
                            categoriasServicios: admin.firestore.FieldValue.arrayUnion(serviceCategory),
                        });
                    } else {
                        const newRelationshipData: RelacionUsuarioPrestadorData = {
                            usuarioId: afterData.usuarioId,
                            prestadorId: afterData.prestadorId,
                            serviciosContratados: 1,
                            ultimoServicioFecha: now,
                            categoriasServicios: [serviceCategory],
                        };
                        transaction.set(relationshipRef, newRelationshipData);
                    }
                });
                await logActivity("sistema", "sistema", "RELACION_USUARIO_PRESTADOR_ACTUALIZADA", `Relación entre usuario ${afterData.usuarioId} y prestador ${afterData.prestadorId} actualizada.`, {tipo: "relacionUsuarioPrestador", id: relationshipId});
            } catch (e) {
                functions.logger.error(`Error actualizando relación para ${relationshipId}:`, e);
            }
        }
        // --- END RELATIONSHIP TRACKING ---
    }


    if ((isFinalizedState && wasNotFinalizedBefore && afterData.paymentStatus === "retenido_para_liberacion") ||
        (beforeData.paymentStatus === "retenido_para_liberacion" && afterData.paymentStatus === "liberado_al_proveedor" && isFinalizedState && beforeData.status !== afterData.status && afterData.status !== "en_disputa")) {
      const montoTotalPagadoPorUsuario = afterData.montoCobrado || afterData.precio || 0;
      let detallesFinancierosNuevos: DetallesFinancieros = {...(afterData.detallesFinancieros as DetallesFinancieros || {})};

      if (montoTotalPagadoPorUsuario > 0 && !detallesFinancierosNuevos.montoFinalLiberadoAlPrestador) {
        detallesFinancierosNuevos.montoTotalPagadoPorUsuario = montoTotalPagadoPorUsuario;
        detallesFinancierosNuevos.comisionSistemaPagoPct = COMISION_SISTEMA_PAGO_PORCENTAJE;
        detallesFinancierosNuevos.comisionSistemaPagoMonto = montoTotalPagadoPorUsuario * COMISION_SISTEMA_PAGO_PORCENTAJE;
        detallesFinancierosNuevos.montoNetoProcesador = montoTotalPagadoPorUsuario - (detallesFinancierosNuevos.comisionSistemaPagoMonto || 0);
        detallesFinancierosNuevos.comisionAppPct = COMISION_APP_SERVICIOMAP_PORCENTAJE;
        detallesFinancierosNuevos.comisionAppMonto = montoTotalPagadoPorUsuario * COMISION_APP_SERVICIOMAP_PORCENTAJE;
        detallesFinancierosNuevos.aporteFondoFidelidadMonto = (detallesFinancierosNuevos.comisionAppMonto || 0) * PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD;
        detallesFinancierosNuevos.montoBrutoParaPrestador = (detallesFinancierosNuevos.montoNetoProcesador || 0) - (detallesFinancierosNuevos.comisionAppMonto || 0);
        detallesFinancierosNuevos.montoFinalLiberadoAlPrestador = detallesFinancierosNuevos.montoBrutoParaPrestador;
        detallesFinancierosNuevos.fechaLiberacion = now;

        updatesToServiceRequest.paymentStatus = "liberado_al_proveedor";
        updatesToServiceRequest.paymentReleasedToProviderAt = now;
        updatesToServiceRequest.detallesFinancieros = detallesFinancierosNuevos;

        await logActivity("sistema", "sistema", "PAGO_LIBERADO", `Pago para servicio ${solicitudId} liberado. Prestador recibe $${detallesFinancierosNuevos.montoFinalLiberadoAlPrestador?.toFixed(2)}.`, {tipo: "solicitud_servicio", id: solicitudId}, detallesFinancierosNuevos);
        await logActivity("sistema", "sistema", "PAGO_PROCESADO_DETALLES", `Detalles financieros procesados para ${solicitudId}.`, {tipo: "solicitud_servicio", id: solicitudId}, detallesFinancierosNuevos);

        const pointsEarned = Math.floor(montoTotalPagadoPorUsuario / FACTOR_CONVERSION_PUNTOS);
        if (pointsEarned > 0) {
          const userRef = db.collection("usuarios").doc(afterData.usuarioId);
          const userHistoryEntry: HistorialPuntoUsuario = {
            servicioId: solicitudId, tipo: "ganados", puntos: pointsEarned, fecha: now,
            descripcion: `Puntos por servicio: ${afterData.titulo || solicitudId.substring(0, 6)}`,
          };
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            await userRef.update({
              puntosAcumulados: admin.firestore.FieldValue.increment(pointsEarned),
              historialPuntos: admin.firestore.FieldValue.arrayUnion(userHistoryEntry),
            });
          } else {
            await userRef.set({
              puntosAcumulados: pointsEarned, historialPuntos: [userHistoryEntry],
              nombre: `Usuario ${afterData.usuarioId.substring(0, 5)}`, fcmTokens: [], isPremium: false,
            }, {merge: true});
          }
          await logActivity(afterData.usuarioId, "usuario", "PUNTOS_FIDELIDAD_GANADOS", `Usuario ganó ${pointsEarned} puntos por servicio ${solicitudId}.`, {tipo: "usuario", id: afterData.usuarioId}, {puntos: pointsEarned, servicioId});
        }
        
        // --- START AMBASSADOR COMMISSION LOGIC ---
        const providerDoc = await db.collection("prestadores").doc(afterData.prestadorId).get();
        if (providerDoc.exists) {
            const providerData = providerDoc.data() as ProviderData;
            if (providerData.embajadorUID) {
                const embajadorUID = providerData.embajadorUID;
                const embajadorRef = db.collection("usuarios").doc(embajadorUID);
                const comisionEmbajador = montoTotalPagadoPorUsuario * PORCENTAJE_COMISION_EMBAJADOR;

                if (comisionEmbajador > 0) {
                    const comisionHistoryEntry: HistorialComision = {
                        servicioId: solicitudId,
                        prestadorId: afterData.prestadorId,
                        montoComision: comisionEmbajador,
                        fecha: now,
                    };
                    
                    await embajadorRef.update({
                        comisionesAcumuladas: admin.firestore.FieldValue.increment(comisionEmbajador),
                        historialComisiones: admin.firestore.FieldValue.arrayUnion(comisionHistoryEntry),
                    });
                    
                    await logActivity(
                        "sistema",
                        "sistema",
                        "EMBAJADOR_COMISION_PAGADA",
                        `Comisión de $${comisionEmbajador.toFixed(2)} pagada a embajador ${embajadorUID} por servicio ${solicitudId} de prestador ${afterData.prestadorId}.`,
                        { tipo: "usuario", id: embajadorUID },
                        { montoComision: comisionEmbajador, servicioId, prestadorId: afterData.prestadorId }
                    );
                }
            }
        }
        // --- END AMBASSADOR COMMISSION LOGIC ---


        if (detallesFinancierosNuevos.aporteFondoFidelidadMonto && detallesFinancierosNuevos.aporteFondoFidelidadMonto > 0) {
          const fundRef = db.collection("fondoFidelidad").doc("global");
          const fundHistoryEntry = {
            servicioId: solicitudId, montoServicio: montoTotalPagadoPorUsuario,
            comisionPlataformaCalculada: detallesFinancierosNuevos.comisionAppMonto,
            montoAportadoAlFondo: detallesFinancierosNuevos.aporteFondoFidelidadMonto, fecha: now,
          };
          const fundDoc = await fundRef.get();
          if (fundDoc.exists) {
            await fundRef.update({
              totalAcumulado: admin.firestore.FieldValue.increment(detallesFinancierosNuevos.aporteFondoFidelidadMonto),
              registros: admin.firestore.FieldValue.arrayUnion(fundHistoryEntry),
            });
          } else {
            await fundRef.set({
              totalAcumulado: detallesFinancierosNuevos.aporteFondoFidelidadMonto,
              registros: [fundHistoryEntry],
            });
          }
          await logActivity("sistema", "sistema", "FONDO_FIDELIDAD_APORTE", `Aporte de ${detallesFinancierosNuevos.aporteFondoFidelidadMonto.toFixed(2)} al fondo de fidelidad por servicio ${solicitudId}.`, {tipo: "fondo_fidelidad", id: "global"}, {monto: detallesFinancierosNuevos.aporteFondoFidelidadMonto, servicioId});
        }
      }
    }

    if (Object.keys(updatesToServiceRequest).length > 1 || updatesToServiceRequest.fechaFinalizacionEfectiva || updatesToServiceRequest.detallesFinancieros) {
      await change.after.ref.update(updatesToServiceRequest);
    }

    return null;
  });


export const onQuotationResponseNotifyUser = functions.firestore
  .document("solicitudes_cotizacion/{cotizacionId}")
  .onUpdate(async (change, context) => {
    const cotizacionId = context.params.cotizacionId;
    const beforeData = change.before.data() as SolicitudCotizacionData | undefined;
    const afterData = change.after.data() as SolicitudCotizacionData | undefined;

    if (!beforeData || !afterData) return null;

    const usuarioId = afterData.usuarioId;
    const prestadorId = afterData.prestadorId;
    const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
    const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData).nombre || "El prestador" : "El prestador";
    const tituloServicio = afterData.tituloServicio || "tu cotización";
    let notifTitle = ""; let notifBody = ""; let logDesc = ""; let logAction: ActivityLogAction | null = null;

    if (afterData.estado !== beforeData.estado) {
      if (afterData.estado === "precio_propuesto_al_usuario" && beforeData.estado === "pendiente_revision_prestador") {
        notifTitle = "¡Cotización Actualizada!";
        notifBody = `${nombrePrestador} ha propuesto un precio de $${afterData.precioSugerido} para ${tituloServicio}. Revisa y acepta o rechaza.`;
        logAction = "COTIZACION_PRECIO_PROPUESTO";
        logDesc = `${nombrePrestador} (ID: ${prestadorId}) propuso precio $${afterData.precioSugerido} para cotización ${cotizacionId} de usuario ${usuarioId}.`;
      } else if (afterData.estado === "rechazada_prestador" && beforeData.estado === "pendiente_revision_prestador") {
        notifTitle = "Cotización Rechazada";
        notifBody = `${nombrePrestador} ha tenido que rechazar tu solicitud de cotización para ${tituloServicio}. ${afterData.notasPrestador || ""}`;
        logAction = "COTIZACION_RECHAZADA";
        logDesc = `${nombrePrestador} (ID: ${prestadorId}) rechazó cotización ${cotizacionId}. Motivo: ${afterData.notasPrestador || "No especificado"}`;
      }
    }
    if (notifTitle && notifBody) await sendNotification(usuarioId, "usuario", notifTitle, notifBody, {cotizacionId: cotizacionId, nuevoEstado: afterData.estado});
    if (logAction && logDesc) await logActivity(prestadorId, "prestador", logAction, logDesc, {tipo: "solicitud_cotizacion", id: cotizacionId}, {precioSugerido: afterData.precioSugerido, notasPrestador: afterData.notasPrestador});
    return null;
  });

export const acceptQuotationAndCreateServiceRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  const usuarioId = context.auth.uid;
  const {cotizacionId} = data;
  if (!cotizacionId || typeof cotizacionId !== "string") throw new functions.https.HttpsError("invalid-argument", "Se requiere 'cotizacionId'.");

  const cotizacionRef = db.collection("solicitudes_cotizacion").doc(cotizacionId);
  try {
    return await db.runTransaction(async (transaction) => {
      const cotizacionDoc = await transaction.get(cotizacionRef);
      if (!cotizacionDoc.exists) throw new functions.https.HttpsError("not-found", `Cotización ${cotizacionId} no encontrada.`);
      const cotizacionData = cotizacionDoc.data() as SolicitudCotizacionData;

      if (cotizacionData.usuarioId !== usuarioId) throw new functions.https.HttpsError("permission-denied", "No eres el propietario.");
      if (cotizacionData.estado !== "precio_propuesto_al_usuario") throw new functions.https.HttpsError("failed-precondition", `Estado inválido: ${cotizacionData.estado}`);
      if (typeof cotizacionData.precioSugerido !== "number" || cotizacionData.precioSugerido <= 0) throw new functions.https.HttpsError("failed-precondition", "Precio sugerido inválido.");

      const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();
      const ahora = admin.firestore.Timestamp.now();

      const tomorrow = new Date(ahora.toDate());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const serviceDateStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, "0")}-${tomorrow.getDate().toString().padStart(2, "0")}`;
      const serviceTimeStr = "10:00";

      const nuevaSolicitudData: Omit<ServiceRequest, "id"> = {
        usuarioId: usuarioId, prestadorId: cotizacionData.prestadorId, status: "confirmada_prestador",
        createdAt: ahora, updatedAt: ahora, titulo: cotizacionData.tituloServicio || `Servicio de cotización ${cotizacionId.substring(0, 5)}`,
        precio: cotizacionData.precioSugerido,
        montoCobrado: cotizacionData.precioSugerido,
        paymentStatus: "retenido_para_liberacion",
        originatingQuotationId: cotizacionId,
        actorDelCambioId: usuarioId,
        actorDelCambioRol: "usuario",
        serviceDate: serviceDateStr,
        serviceTime: serviceTimeStr,
        serviceType: "fixed",
      };
      transaction.set(nuevaSolicitudRef, nuevaSolicitudData);
      transaction.update(cotizacionRef, {estado: "convertida_a_servicio", fechaRespuestaUsuario: ahora});

      await logActivity(usuarioId, "usuario", "COTIZACION_ACEPTADA_USUARIO", `Usuario aceptó cotización ${cotizacionId}. Nueva solicitud ID: ${nuevaSolicitudRef.id}.`, {tipo: "solicitud_cotizacion", id: cotizacionId}, {nuevaSolicitudServicioId: nuevaSolicitudRef.id, precioAceptado: cotizacionData.precioSugerido});
      await sendNotification(cotizacionData.prestadorId, "prestador", "¡Cotización Aceptada!", `Usuario aceptó tu cotización de $${cotizacionData.precioSugerido} para "${cotizacionData.tituloServicio || "el servicio"}". Se ha creado una solicitud de servicio.`, {solicitudId: nuevaSolicitudRef.id, cotizacionId: cotizacionId});
      return {success: true, message: "Cotización aceptada y servicio creado.", servicioId: nuevaSolicitudRef.id};
    });
  } catch (error: any) {
    functions.logger.error(`Error al aceptar cotización ${cotizacionId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar.", error.message);
  }
});

export const onServiceConfirmedCreateChatRoom = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const solicitudId = context.params.solicitudId;
    const afterData = change.after.data() as ServiceRequest | undefined;
    const beforeData = change.before.data() as ServiceRequest | undefined;
    if (!afterData || !beforeData) return null;

    const chatTriggerStatus: ServiceRequestStatus = "confirmada_prestador";
    if (afterData.status === chatTriggerStatus && beforeData.status !== chatTriggerStatus) {
      functions.logger.info(`[ChatCreate ${solicitudId}] Creando sala de chat.`);
      const usuarioId = afterData.usuarioId; const prestadorId = afterData.prestadorId;
      const chatDocRef = db.collection("chats").doc(solicitudId);
      try {
        const chatDoc = await chatDocRef.get();
        if (chatDoc.exists) {
          functions.logger.info(`Chat ${solicitudId} ya existe.`); return null;
        }

        const usuarioInfoDoc = await db.collection("usuarios").doc(usuarioId).get();
        const prestadorInfoDoc = await db.collection("prestadores").doc(prestadorId).get();
        const ahora = admin.firestore.Timestamp.now();
        const nuevoChatData: ChatData = {
          solicitudServicioId: solicitudId, participantesUids: [usuarioId, prestadorId].sort(),
          participantesInfo: {
            [usuarioId]: {nombre: (usuarioInfoDoc.data() as UserData)?.nombre || `Usuario ${usuarioId.substring(0, 5)}`, rol: "usuario"},
            [prestadorId]: {nombre: (prestadorInfoDoc.data() as ProviderData)?.nombre || `Prestador ${prestadorId.substring(0, 5)}`, rol: "prestador"},
          },
          fechaCreacion: ahora, ultimaActualizacion: ahora, estadoChat: "activo", conteoNoLeido: {[usuarioId]: 0, [prestadorId]: 0}
        };
        await chatDocRef.set(nuevoChatData);
        await logActivity("sistema", "sistema", "CHAT_CREADO", `Chat creado para solicitud ${solicitudId}.`, {tipo: "chat", id: solicitudId}, {solicitudServicioId: solicitudId});
        const serviceTitle = afterData.titulo || "el servicio";
        await sendNotification(usuarioId, "usuario", "Chat Habilitado", `Ya puedes chatear sobre "${serviceTitle}".`, {chatId: solicitudId, solicitudId: solicitudId});
        await sendNotification(prestadorId, "prestador", "Chat Habilitado", `Ya puedes chatear sobre "${serviceTitle}".`, {chatId: solicitudId, solicitudId: solicitudId});
      } catch (error) {
        functions.logger.error(`[ChatCreate ${solicitudId}] Error:`, error);
      }
    }
    return null;
  });

export const canjearPuntosPromocion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida para canjear puntos.");
  }
  const usuarioId = context.auth.uid;
  const {promocionId} = data;

  if (!promocionId || typeof promocionId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'promocionId'.");
  }

  const usuarioRef = db.collection("usuarios").doc(usuarioId);
  const promocionRef = db.collection("promociones").doc(promocionId);
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const usuarioDoc = await transaction.get(usuarioRef);
      const promocionDoc = await transaction.get(promocionRef);

      if (!usuarioDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      }
      if (!promocionDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Promoción ${promocionId} no encontrada.`);
      }

      const usuarioData = usuarioDoc.data() as UserData;
      const promocionData = promocionDoc.data() as PromocionFidelidad;

      if (!promocionData.activo) {
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción no está activa.");
      }
      if (promocionData.fechaExpiracion && promocionData.fechaExpiracion.toMillis() < now.toMillis()) {
        transaction.update(promocionRef, {activo: false});
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción ha expirado.");
      }
      if (typeof promocionData.usosDisponibles === "number" && promocionData.usosDisponibles <= 0) {
        transaction.update(promocionRef, {activo: false});
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción se ha agotado.");
      }
      if ((usuarioData.puntosAcumulados || 0) < promocionData.puntosRequeridos) {
        throw new functions.https.HttpsError("failed-precondition", `No tienes suficientes puntos. Necesitas ${promocionData.puntosRequeridos}, tienes ${usuarioData.puntosAcumulados || 0}.`);
      }

      const historialCanje: HistorialPuntoUsuario = {
        promocionId: promocionId,
        tipo: "canjeados",
        puntos: -promocionData.puntosRequeridos,
        fecha: now,
        descripcion: `Canje de promoción: ${promocionData.descripcion}`,
      };
      transaction.update(usuarioRef, {
        puntosAcumulados: admin.firestore.FieldValue.increment(-promocionData.puntosRequeridos),
        historialPuntos: admin.firestore.FieldValue.arrayUnion(historialCanje),
      });

      if (typeof promocionData.usosDisponibles === "number") {
        transaction.update(promocionRef, {
          usosDisponibles: admin.firestore.FieldValue.increment(-1),
        });
      }

      await logActivity(usuarioId, "usuario", "PUNTOS_FIDELIDAD_CANJEADOS", `Usuario canjeó ${promocionData.puntosRequeridos} puntos por promoción '${promocionData.descripcion}'.`, {tipo: "promocion_fidelidad", id: promocionId}, {puntosGastados: promocionData.puntosRequeridos, promocionId});

      return {
        success: true,
        message: `¡Promoción "${promocionData.descripcion}" canjeada exitosamente!`,
        descuentoAplicable: {
          tipo: promocionData.tipoDescuento,
          valor: promocionData.valorDescuento,
          codigo: promocionData.codigoPromocional,
        },
      };
    });
  } catch (error: any) {
    functions.logger.error(`Error al canjear puntos para promoción ${promocionId} por usuario ${usuarioId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar el canje de puntos.", error.message);
  }
});

export const obtenerTraduccion = functions.https.onCall(async (data, context) => {
  const {claveUnica, idiomaSolicitado} = data;

  if (!claveUnica || typeof claveUnica !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'claveUnica' (string).");
  }
  if (!idiomaSolicitado || typeof idiomaSolicitado !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'idiomaSolicitado' (string, ej: 'es', 'en').");
  }

  const logActorId = context.auth?.uid || "sistema_anonimo";
  const logActorRol = context.auth?.uid ? "usuario" : "sistema";

  try {
    const idiomaRef = db.collection("idiomas").doc(idiomaSolicitado);
    const docSnap = await idiomaRef.get();
    let textoTraducido: string | undefined = undefined;

    if (docSnap.exists) {
      const idiomaData = docSnap.data() as IdiomaDocumentoFirestore;
      textoTraducido = idiomaData.recursos?.[claveUnica];
    }

    if (textoTraducido === undefined && idiomaSolicitado !== DEFAULT_LANGUAGE_CODE) {
      functions.logger.warn(`[obtenerTraduccion] Clave '${claveUnica}' no encontrada en idioma '${idiomaSolicitado}'. Intentando con idioma por defecto '${DEFAULT_LANGUAGE_CODE}'.`);
      const defaultIdiomaRef = db.collection("idiomas").doc(DEFAULT_LANGUAGE_CODE);
      const defaultDocSnap = await defaultIdiomaRef.get();
      if (defaultDocSnap.exists) {
        const defaultIdiomaData = defaultDocSnap.data() as IdiomaDocumentoFirestore;
        textoTraducido = defaultIdiomaData.recursos?.[claveUnica];
      }
    }

    if (textoTraducido === undefined) {
      functions.logger.error(`[obtenerTraduccion] Clave '${claveUnica}' no encontrada en idioma '${idiomaSolicitado}' ni en el idioma por defecto.`);
      await logActivity(logActorId, logActorRol, "TRADUCCION_SOLICITADA", `Clave de traducción no encontrada: ${claveUnica} para idioma ${idiomaSolicitado}.`, {tipo: "idioma", id: idiomaSolicitado}, {clave: claveUnica, resultado: "no_encontrada"});
      return {traduccion: `[${claveUnica}]`, idiomaDevuelto: null, error: "Clave de traducción no encontrada."};
    }

    await logActivity(logActorId, logActorRol, "TRADUCCION_SOLICITADA", `Traducción solicitada para clave: ${claveUnica}, idioma: ${idiomaSolicitado}.`, {tipo: "idioma", id: idiomaSolicitado}, {clave: claveUnica, resultado: "encontrada"});
    return {traduccion: textoTraducido, idiomaDevuelto: idiomaSolicitado};
  } catch (error: any) {
    functions.logger.error(`[obtenerTraduccion] Error al obtener traducción para clave '${claveUnica}', idioma '${idiomaSolicitado}':`, error);
    await logActivity(logActorId, logActorRol, "TRADUCCION_SOLICITADA", `Error al obtener traducción para clave: ${claveUnica}, idioma: ${idiomaSolicitado}.`, {tipo: "idioma", id: idiomaSolicitado}, {clave: claveUnica, error: error.message});
    throw new functions.https.HttpsError("internal", "Error al procesar la solicitud de traducción.", error.message);
  }
});

export const enviarRecordatoriosProgramados = functions.pubsub
  .schedule("every 15 minutes")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const remindersQuery = db.collection("recordatorios")
      .where("enviado", "==", false)
      .where("fechaProgramada", "<=", now);

    const snapshot = await remindersQuery.get();
    if (snapshot.empty) {
      functions.logger.log("[EnviarRecordatorios] No hay recordatorios para enviar.");
      return null;
    }

    const promises = snapshot.docs.map(async (doc) => {
      const reminder = doc.data() as Recordatorio;
      const reminderId = doc.id;

      try {
        const userDoc = await db.collection("usuarios").doc(reminder.usuarioId).get();
        if (!userDoc.exists) {
          functions.logger.error(`[EnviarRecordatorios] Usuario ${reminder.usuarioId} no encontrado para recordatorio ${reminderId}.`);
          await doc.ref.update({enviado: true, errorEnvio: "Usuario no encontrado"});
          return;
        }
        const userData = userDoc.data() as UserData;
        const tokens = userData.fcmTokens;

        if (tokens && tokens.length > 0) {
          let finalMessage = reminder.mensaje;
          if (reminder.datosAdicionales?.tituloServicio && reminder.datosAdicionales?.nombrePrestador && reminder.datosAdicionales?.fechaHoraServicioIso) {
            const serviceDateTime = new Date(reminder.datosAdicionales.fechaHoraServicioIso);
            const formattedTime = serviceDateTime.toLocaleTimeString("es-MX", {hour: "2-digit", minute: "2-digit"});
            finalMessage = `Recordatorio: Tu servicio "${reminder.datosAdicionales.tituloServicio}" con ${reminder.datosAdicionales.nombrePrestador} es hoy a las ${formattedTime}.`;
          }

          const payload = {
            notification: {
              title: "Recordatorio de Servicio",
              body: finalMessage,
            },
            data: {
              servicioId: reminder.servicioId,
              tipoRecordatorio: reminder.tipo,
            },
          };
          await admin.messaging().sendToDevice(tokens, payload);
          await doc.ref.update({enviado: true, fechaEnvio: admin.firestore.Timestamp.now(), errorEnvio: null, intentosEnvio: admin.firestore.FieldValue.increment(1)});
          functions.logger.info(`[EnviarRecordatorios] Recordatorio ${reminderId} enviado a usuario ${reminder.usuarioId}.`);
          await logActivity("sistema", "sistema", "NOTIFICACION_RECORDATORIO_ENVIADA", `Recordatorio ${reminder.tipo} enviado a usuario ${reminder.usuarioId} para servicio ${reminder.servicioId}.`, {tipo: "recordatorio", id: reminderId});
        } else {
          functions.logger.warn(`[EnviarRecordatorios] Usuario ${reminder.usuarioId} no tiene tokens FCM para recordatorio ${reminderId}.`);
          await doc.ref.update({enviado: true, errorEnvio: "Sin tokens FCM", fechaEnvio: admin.firestore.Timestamp.now()});
        }
      } catch (error: any) {
        functions.logger.error(`[EnviarRecordatorios] Error enviando recordatorio ${reminderId}:`, error);
        const intentos = (reminder.intentosEnvio || 0) + 1;
        if (intentos >= 3) {
          await doc.ref.update({enviado: true, errorEnvio: `Error tras ${intentos} intentos: ${error.message}`, intentosEnvio: intentos});
        } else {
          await doc.ref.update({errorEnvio: error.message, intentosEnvio: intentos});
        }
      }
    });

    await Promise.all(promises);
    return null;
  });

function isPointInPolygon(point: CoordenadaFirestore, polygon: CoordenadaFirestore[]): boolean {
  let crossings = 0;
  const n = polygon.length;
  if (n < 3) return false;

  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];

    if (((p1.lat <= point.lat && point.lat < p2.lat) || (p2.lat <= point.lat && point.lat < p1.lat)) &&
        (point.lng < (p2.lng - p1.lng) * (point.lat - p1.lat) / (p2.lat - p1.lat) + p1.lng)) {
      crossings++;
    }
  }
  return crossings % 2 === 1;
}

export const verificarReglasDeZona = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida para verificar reglas de zona.");
  }
  const actorId = context.auth.uid;
  const {lat, lng} = data;

  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren coordenadas 'lat' y 'lng' numéricas.");
  }
  const puntoUsuario: CoordenadaFirestore = {lat, lng};

  try {
    const zonasSnapshot = await db.collection("zonas_preferentes").where("activa", "==", true).orderBy("prioridad", "desc").get();
    let zonaAplicada: ZonaPreferenteFirestore | null = null;

    if (!zonasSnapshot.empty) {
      for (const doc of zonasSnapshot.docs) {
        const zona = doc.data() as ZonaPreferenteFirestore;
        if (zona.poligono && zona.poligono.length >= 3) {
          if (isPointInPolygon(puntoUsuario, zona.poligono)) {
            zonaAplicada = {id: doc.id, ...zona};
            break;
          }
        }
      }
    }

    if (zonaAplicada) {
      await logActivity(actorId, "usuario", "REGLAS_ZONA_CONSULTADAS", `Usuario en zona preferente '${zonaAplicada.nombre}' (ID: ${zonaAplicada.id}).`, {tipo: "zona_preferente", id: zonaAplicada.id || "N/A"}, {lat, lng});
      return {
        enZona: true,
        zonaId: zonaAplicada.id,
        nombreZona: zonaAplicada.nombre,
        reglas: zonaAplicada.reglas,
        descripcion: zonaAplicada.descripcion,
      };
    } else {
      await logActivity(actorId, "usuario", "REGLAS_ZONA_CONSULTADAS", "Usuario no se encuentra en ninguna zona preferente activa.", undefined, {lat, lng});
      return {enZona: false, zonaId: null, nombreZona: null, reglas: null};
    }
  } catch (error: any) {
    functions.logger.error("Error al verificar reglas de zona:", error);
    await logActivity(actorId, "usuario", "REGLAS_ZONA_CONSULTADAS", `Error al verificar zona para ${lat},${lng}: ${error.message}`, undefined, {lat, lng, error: error.message});
    throw new functions.https.HttpsError("internal", "Error al procesar la verificación de zona.", error.message);
  }
});

export const onZoneChangeLog = functions.firestore
  .document("zonas_preferentes/{zonaId}")
  .onWrite(async (change, context) => {
    const zonaId = context.params.zonaId;
    const adminActorId = "admin_sistema";

    if (!change.before.exists) {
      const newData = change.after.data() as ZonaPreferenteFirestore;
      await logActivity(adminActorId, "admin", "ADMIN_ZONA_MODIFICADA", `Nueva zona preferente creada: '${newData.nombre}' (ID: ${zonaId}).`, {tipo: "zona_preferente", id: zonaId}, {accionRealizada: "creacion", detalles: newData});
    } else if (!change.after.exists) {
      const oldData = change.before.data() as ZonaPreferenteFirestore;
      await logActivity(adminActorId, "admin", "ADMIN_ZONA_MODIFICADA", `Zona preferente eliminada: '${oldData.nombre}' (ID: ${zonaId}).`, {tipo: "zona_preferente", id: zonaId}, {accionRealizada: "eliminacion"});
    } else {
      const newData = change.after.data() as ZonaPreferenteFirestore;
      const oldData = change.before.data() as ZonaPreferenteFirestore;
      await logActivity(adminActorId, "admin", "ADMIN_ZONA_MODIFICADA", `Zona preferente actualizada: '${newData.nombre}' (ID: ${zonaId}). Activa: ${newData.activa}.`, {tipo: "zona_preferente", id: zonaId}, {accionRealizada: "actualizacion", cambios: {old: oldData, new: newData}});
    }
    return null;
  });

export const crearSolicitudSoporte = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const solicitanteId = context.auth.uid;
  const {
    categoria,
    descripcion,
    rolSolicitante,
    prioridad,
    referenciaId,
    adjuntosUrls,
  } = data;

  if (!categoria || typeof categoria !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'categoria' es requerido.");
  }
  if (!descripcion || typeof descripcion !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'descripcion' es requerido.");
  }
  if (!rolSolicitante || (rolSolicitante !== "usuario" && rolSolicitante !== "prestador")) {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'rolSolicitante' debe ser 'usuario' o 'prestador'.");
  }

  const now = admin.firestore.Timestamp.now();

  const nuevaSolicitudData: Omit<SoporteTicketData, "id" | "etiquetas"> = {
    solicitanteId: solicitanteId,
    rolSolicitante: rolSolicitante as "usuario" | "prestador",
    categoria: categoria,
    estado: "pendiente",
    descripcion: descripcion,
    historialMensajes: [
      {
        remitenteId: solicitanteId,
        mensaje: descripcion,
        timestamp: now,
      },
    ],
    fechaCreacion: now,
    fechaActualizacion: now,
    ...(prioridad && {prioridad: prioridad as SoporteTicketData["prioridad"]}),
    ...(referenciaId && {referenciaId: referenciaId as string}),
    ...(adjuntosUrls && Array.isArray(adjuntosUrls) && {adjuntosUrls: adjuntosUrls as string[]}),
  };

  try {
    const solicitudRef = await db.collection("tickets_soporte").add(nuevaSolicitudData);
    await logActivity(
      solicitanteId,
      rolSolicitante as "usuario" | "prestador",
      "TICKET_SOPORTE_CREADO",
      `Nuevo ticket de soporte #${solicitudRef.id} creado por ${rolSolicitante} ${solicitanteId}. Categoría: ${categoria}.`,
      {tipo: "ticket_soporte", id: solicitudRef.id},
      {categoria, prioridad: prioridad || "normal"}
    );

    return {
      success: true,
      message: "Tu solicitud de soporte ha sido enviada. Nuestro equipo te contactará pronto.",
      ticketId: solicitudRef.id,
    };
  } catch (error: any) {
    functions.logger.error(`Error al crear ticket de soporte para ${solicitanteId}:`, error);
    await logActivity(
      solicitanteId,
      rolSolicitante as "usuario" | "prestador",
      "TICKET_SOPORTE_CREADO",
      `Error al crear ticket de soporte. Categoría: ${categoria}. Error: ${error.message}`,
      undefined,
      {categoria, error: error.message}
    );
    throw new functions.https.HttpsError("internal", "No se pudo registrar tu solicitud de soporte.", error.message);
  }
});

export const rateServiceByUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const userId = context.auth.uid;
  const {
    servicioId,
    estrellas,
    comentario,
    indicadoresRendimiento,
    aspectosPositivos,
    areasDeMejora,
  } = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'servicioId'.");
  }
  if (typeof estrellas !== "number" || estrellas < 1 || estrellas > 5) {
    throw new functions.https.HttpsError("invalid-argument", "La 'calificacion' (estrellas) debe ser un número entre 1 y 5.");
  }

  const servicioRef = db.collection("solicitudes_servicio").doc(servicioId);

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceRequest;

      if (servicioData.usuarioId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No puedes calificar este servicio.");
      }
      if (servicioData.status !== "completado_por_usuario" && servicioData.status !== "cerrado_automaticamente") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden calificar servicios en estado 'completado_por_usuario' o 'cerrado_automaticamente'. Estado actual: ${servicioData.status}`);
      }
      if (servicioData.calificacionUsuario) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      const nuevaCalificacion: CalificacionDetallada = {
        estrellas: estrellas,
        fecha: now,
        ...(comentario && {comentario: comentario as string}),
        ...(indicadoresRendimiento && {indicadoresRendimiento: indicadoresRendimiento as IndicadoresRendimiento}),
        ...(aspectosPositivos && Array.isArray(aspectosPositivos) && {aspectosPositivos: aspectosPositivos as string[]}),
        ...(areasDeMejora && Array.isArray(areasDeMejora) && {areasDeMejora: areasDeMejora as string[]}),
      };

      const updates: Partial<ServiceRequest> & {updatedAt: admin.firestore.Timestamp} = {
        calificacionUsuario: nuevaCalificacion,
        updatedAt: now,
      };

      if (servicioData.calificacionPrestador) {
        updates.mutualRatingCompleted = true;
      }

      if (servicioData.status !== "en_disputa") {
        updates.status = "cerrado_con_calificacion";
      }


      transaction.update(servicioRef, updates);
      return {success: true, message: "Calificación registrada exitosamente."};
    });
  } catch (error: any) {
    functions.logger.error(`Error al calificar servicio ${servicioId} por usuario ${userId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la calificación.", error.message);
  }
});

export const buscarPrestadoresInteligente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const {textoBusqueda, latUsuario, lngUsuario} = data;

  if (!textoBusqueda || typeof textoBusqueda !== "string" || typeof latUsuario !== "number" || typeof lngUsuario !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'textoBusqueda', 'latUsuario' y 'lngUsuario'.");
  }

  const textoBusquedaLower = textoBusqueda.toLowerCase();

  try {
    const prestadoresSnapshot = await db.collection("prestadores").get();
    const prestadoresCandidatos: PrestadorBuscado[] = [];

    for (const doc of prestadoresSnapshot.docs) {
      const provider = doc.data() as ProviderData;
      if (!provider.isAvailable || !provider.currentLocation) continue;

      let match = false;
      if (provider.nombre?.toLowerCase().includes(textoBusquedaLower)) match = true;
      if (!match && provider.empresa?.toLowerCase().includes(textoBusquedaLower)) match = true;
      if (!match && provider.specialties?.some((s) => s.toLowerCase().includes(textoBusquedaLower))) match = true;

      if (!match && provider.services) {
        for (const service of provider.services) {
          if (service.title.toLowerCase().includes(textoBusquedaLower)) {
            match = true; break;
          }
          if (service.description.toLowerCase().includes(textoBusquedaLower)) {
            match = true; break;
          }
          const categoryInfo = SERVICE_CATEGORIES.find((c) => c.id === service.category);
          if (categoryInfo?.name.toLowerCase().includes(textoBusquedaLower)) {
            match = true; break;
          }
          if (categoryInfo?.keywords.some((k) => k.toLowerCase().includes(textoBusquedaLower))) {
            match = true; break;
          }
        }
      }

      if (match) {
        const distanciaKm = calculateDistance(
          latUsuario,
          lngUsuario,
          provider.currentLocation.lat,
          provider.currentLocation.lng
        );

        prestadoresCandidatos.push({
          id: doc.id,
          nombre: provider.nombre || "N/A",
          empresa: provider.empresa,
          distanciaKm: parseFloat(distanciaKm.toFixed(1)),
          calificacion: provider.rating || 0,
          avatarUrl: provider.avatarUrl,
          categoriaPrincipal: provider.services?.[0]?.category ? (SERVICE_CATEGORIES.find(c=>c.id === provider.services?.[0]?.category)?.name || provider.services?.[0]?.category) : "General",
        });
      }
    }

    prestadoresCandidatos.sort((a, b) => {
      if (a.distanciaKm && b.distanciaKm && a.distanciaKm < b.distanciaKm) return -1;
      if (a.distanciaKm && b.distanciaKm && a.distanciaKm > b.distanciaKm) return 1;
      if (a.calificacion > b.calificacion) return -1;
      if (a.calificacion < b.calificacion) return 1;
      return 0;
    });

    await logActivity(context.auth.uid, "usuario", "BUSQUEDA_PRESTADORES", `Usuario buscó: "${textoBusqueda}". Resultados: ${prestadoresCandidatos.length}.`, undefined, {texto: textoBusqueda, lat: latUsuario, lng: lngUsuario});

    return prestadoresCandidatos;
  } catch (error: any) {
    functions.logger.error("Error en buscarPrestadoresInteligente:", error);
    throw new functions.https.HttpsError("internal", "Error al buscar prestadores.", error.message);
  }
});

export const buscarPrestadoresPorFiltros = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const { categoriaId } = data;

  if (!categoriaId || typeof categoriaId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'categoriaId'.");
  }

  try {
    const prestadoresQuery = db.collection("prestadores")
      .where("isAvailable", "==", true)
      .where("categoryIds", "array-contains", categoriaId)
      .where("aceptaTrabajosVirtuales", "==", true)
      .orderBy("rating", "desc");

    const prestadoresSnapshot = await prestadoresQuery.get();

    if (prestadoresSnapshot.empty) {
      return [];
    }

    const resultados: Omit<PrestadorBuscado, "distanciaKm">[] = [];

    for (const doc of prestadoresSnapshot.docs) {
      const provider = doc.data() as ProviderData;

      resultados.push({
        id: doc.id,
        nombre: provider.nombre || "N/A",
        empresa: provider.empresa,
        calificacion: provider.rating || 0,
        avatarUrl: provider.avatarUrl,
        categoriaPrincipal: SERVICE_CATEGORIES.find(c => c.id === (provider.categoryIds?.[0]))?.name || "General",
      });
    }

    await logActivity(context.auth.uid, "usuario", "BUSQUEDA_PRESTADORES", `Usuario buscó trabajos virtuales por categoría: "${categoriaId}". Resultados: ${resultados.length}.`, undefined, { categoriaId });

    return resultados;
  } catch (error: any) {
    functions.logger.error("Error en buscarPrestadoresPorFiltros:", error);
    if (error.code === 'failed-precondition') {
        throw new functions.https.HttpsError("failed-precondition", "La consulta requiere un índice compuesto en Firestore. Por favor, crea uno desde el enlace en el log de Firebase Functions (isAvailable, categoryIds, aceptaTrabajosVirtuales, rating).");
    }
    throw new functions.https.HttpsError("internal", "Error al buscar prestadores.", error.message);
  }
});


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


export const reportarProblemaServicio = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const idUsuarioReportante = context.auth.uid;
  const {idServicio, rol, categoria, descripcionProblema, archivoAdjuntoURL} = data;

  if (!idServicio || typeof idServicio !== "string") throw new functions.https.HttpsError("invalid-argument", "Se requiere 'idServicio'.");
  if (!rol || (rol !== "usuario" && rol !== "prestador")) throw new functions.https.HttpsError("invalid-argument", "El 'rol' del reportante es requerido.");
  if (!categoria || typeof categoria !== "string") throw new functions.https.HttpsError("invalid-argument", "Se requiere 'categoria' del reporte.");
  if (!descripcionProblema || typeof descripcionProblema !== "string") throw new functions.https.HttpsError("invalid-argument", "Se requiere 'descripcionProblema'.");

  const servicioRef = db.collection("solicitudes_servicio").doc(idServicio);
  const reportesRef = db.collection("reportes");
  const garantiasRef = db.collection("garantiasPendientes");
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${idServicio} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceRequest;

      const [idReportado, rolReportado] = rol === "usuario" ? [servicioData.prestadorId, "prestador"] : [servicioData.usuarioId, "usuario"];
      
      if (idUsuarioReportante !== servicioData.usuarioId && idUsuarioReportante !== servicioData.prestadorId) throw new functions.https.HttpsError("permission-denied", "No participaste en este servicio.");
      if (rol === "usuario" && idUsuarioReportante !== servicioData.usuarioId) throw new functions.https.HttpsError("permission-denied", "Tu rol no coincide con tu participación en este servicio.");
      if (rol === "prestador" && idUsuarioReportante !== servicioData.prestadorId) throw new functions.https.HttpsError("permission-denied", "Tu rol no coincide con tu participación en este servicio.");
      if (!servicioData.fechaFinalizacionEfectiva) throw new functions.https.HttpsError("failed-precondition", "El servicio aún no ha finalizado para poder reportar un problema.");

      const fechaFinalizacion = (servicioData.fechaFinalizacionEfectiva as admin.firestore.Timestamp).toDate();
      const plazoMaximoReporte = new Date(fechaFinalizacion.getTime() + PLAZO_REPORTE_DIAS * 24 * 60 * 60 * 1000);
      if (now.toDate() > plazoMaximoReporte) throw new functions.https.HttpsError("failed-precondition", "El plazo para reportar problemas ha expirado.");

      if (servicioData.reporteActivoId) {
        const reporteExistenteDoc = await transaction.get(reportesRef.doc(servicioData.reporteActivoId));
        if (reporteExistenteDoc.exists) throw new functions.https.HttpsError("already-exists", "Ya existe un reporte activo para este servicio.");
      }

      const nuevoReporteRef = reportesRef.doc();
      const reporteData: ReporteServicioData = {
        idServicio: idServicio,
        idUsuarioReportante: idUsuarioReportante,
        rolReportante: rol as "usuario" | "prestador",
        idReportado: idReportado,
        rolReportado: rolReportado,
        categoria,
        descripcionProblema,
        fechaReporte: now,
        estadoReporte: "pendiente_revision_admin",
        garantiaActivada: false,
        ...(archivoAdjuntoURL && {archivoAdjuntoURL: archivoAdjuntoURL as string}),
        idServicioOriginalData: {
          titulo: servicioData.titulo,
          status: servicioData.status,
          paymentStatus: servicioData.paymentStatus,
          montoCobrado: servicioData.montoCobrado,
        },
      };
      transaction.set(nuevoReporteRef, reporteData);

      const updateServicio: Partial<ServiceRequest> = {
        reporteActivoId: nuevoReporteRef.id,
        estadoDisputa: "abierta",
        updatedAt: now,
      };
      if (servicioData.paymentStatus === "retenido_para_liberacion" || servicioData.paymentStatus === "liberado_al_proveedor") {
        updateServicio.paymentStatus = "congelado_por_disputa";
      }
      transaction.update(servicioRef, updateServicio);

      await logActivity(idUsuarioReportante, rol as "usuario" | "prestador", "REPORTE_PROBLEMA_CREADO", `Reporte #${nuevoReporteRef.id} creado para servicio ${idServicio} por ${rol} ${idUsuarioReportante}.`, {tipo: "reporte_servicio", id: nuevoReporteRef.id}, {descripcion: descripcionProblema});
      await sendNotification(idReportado, rolReportado, "Reporte de Problema Recibido", `Se ha registrado un reporte para el servicio "${servicioData.titulo || idServicio}". Un administrador lo revisará pronto.`, {servicioId: idServicio, reporteId: nuevoReporteRef.id});

      if (rol === "usuario") {
        const usuarioDocSnap = await db.collection("usuarios").doc(idUsuarioReportante).get();
        const esPremium = (usuarioDocSnap.data() as UserData)?.isPremium || false;

        if (esPremium) {
          const nuevaGarantiaRef = garantiasRef.doc();
          const garantiaData: GarantiaPendienteData = {
            idServicio: idServicio,
            idUsuario: idUsuarioReportante,
            idPrestador: servicioData.prestadorId,
            idReporte: nuevoReporteRef.id,
            fechaSolicitudGarantia: now,
            estadoGarantia: "pendiente_revision",
            descripcionProblemaOriginal: descripcionProblema,
            detallesServicioOriginal: {titulo: servicioData.titulo, status: servicioData.status},
          };
          transaction.set(nuevaGarantiaRef, garantiaData);
          transaction.update(nuevoReporteRef, {garantiaActivada: true, idGarantiaPendiente: nuevaGarantiaRef.id});
          await logActivity(idUsuarioReportante, "usuario", "GARANTIA_REGISTRADA", `Garantía #${nuevaGarantiaRef.id} registrada para reporte ${nuevoReporteRef.id} de usuario premium.`, {tipo: "garantia", id: nuevaGarantiaRef.id});
          return {status: "garantiaActivada", reporteId: nuevoReporteRef.id, garantiaId: nuevaGarantiaRef.id};
        }
      }
      return {status: "reporteRegistrado", reporteId: nuevoReporteRef.id};
    });
  } catch (error: any) {
    functions.logger.error(`Error al reportar problema para servicio ${idServicio}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar el reporte.", error.message);
  }
});


export const reactivarServicioRecurrente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const initiatorId = context.auth.uid;
  const {idServicioAnterior, accion, notasIniciador, nuevaFecha, nuevaHora} = data;

  if (!idServicioAnterior || typeof idServicioAnterior !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'idServicioAnterior'.");
  }
  if (!accion || (accion !== "solicitar_nuevamente" && accion !== "ofrecer_nuevamente")) {
    throw new functions.https.HttpsError("invalid-argument", "La 'accion' debe ser 'solicitar_nuevamente' o 'ofrecer_nuevamente'.");
  }

  const servicioAnteriorRef = db.collection("solicitudes_servicio").doc(idServicioAnterior);

  try {
    const servicioAnteriorDoc = await servicioAnteriorRef.get();
    if (!servicioAnteriorDoc.exists) {
      throw new functions.https.HttpsError("not-found", `Servicio anterior con ID ${idServicioAnterior} no encontrado.`);
    }
    const servicioAnteriorData = servicioAnteriorDoc.data() as ServiceRequest;

    let initiatorRoleInOldService: "usuario" | "prestador";
    if (initiatorId === servicioAnteriorData.usuarioId) {
      initiatorRoleInOldService = "usuario";
    } else if (initiatorId === servicioAnteriorData.prestadorId) {
      initiatorRoleInOldService = "prestador";
    } else {
      throw new functions.https.HttpsError("permission-denied", "No participaste en el servicio anterior.");
    }

    if (accion === "solicitar_nuevamente" && initiatorRoleInOldService !== "usuario") {
      throw new functions.https.HttpsError("failed-precondition", "Solo el usuario original puede 'solicitar_nuevamente'.");
    }
    if (accion === "ofrecer_nuevamente" && initiatorRoleInOldService !== "prestador") {
      throw new functions.https.HttpsError("failed-precondition", "Solo el prestador original puede 'ofrecer_nuevamente'.");
    }

    const now = admin.firestore.Timestamp.now();
    const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();

    const newServiceRequestData: Partial<ServiceRequest> = {
      usuarioId: servicioAnteriorData.usuarioId,
      prestadorId: servicioAnteriorData.prestadorId,
      titulo: `Reactivación: ${servicioAnteriorData.titulo || "Servicio Anterior"}`,
      serviceType: servicioAnteriorData.serviceType,
      location: servicioAnteriorData.location,
      notes: notasIniciador || `Reactivación de servicio: ${idServicioAnterior}`,
      precio: servicioAnteriorData.precio,
      hourlyRate: servicioAnteriorData.hourlyRate,
      durationHours: servicioAnteriorData.durationHours,
      selectedFixedServices: servicioAnteriorData.selectedFixedServices,
      totalAmount: servicioAnteriorData.totalAmount,
      estimatedTotal: servicioAnteriorData.estimatedTotal,
      originatingServiceId: idServicioAnterior,
      isRecurringAttempt: true,
      actorDelCambioId: initiatorId,
      actorDelCambioRol: initiatorRoleInOldService,
      createdAt: now,
      updatedAt: now,
      paymentStatus: "no_aplica",
    };

    if (nuevaFecha) newServiceRequestData.serviceDate = nuevaFecha;
    if (nuevaHora) newServiceRequestData.serviceTime = nuevaHora;

    let targetNotificationUserId = "";
    let targetNotificationUserType: "usuario" | "prestador" = "usuario";
    let notificationTitle = "";
    let notificationBody = "";
    let logAction: ActivityLogAction = "SOLICITUD_CREADA";

    if (accion === "solicitar_nuevamente") {
      newServiceRequestData.status = "agendado";
      newServiceRequestData.reactivationOfferedBy = "usuario";
      targetNotificationUserId = servicioAnteriorData.prestadorId;
      targetNotificationUserType = "prestador";
      notificationTitle = "Solicitud de Reactivación de Servicio";
      notificationBody = `El usuario ${initiatorId} desea reactivar el servicio "${servicioAnteriorData.titulo || idServicioAnterior}". Por favor, revisa y confirma los detalles.`;
      logAction = "SERVICIO_REACTIVADO_SOLICITUD";
    } else { // "ofrecer_nuevamente"
      newServiceRequestData.status = "pendiente_confirmacion_usuario";
      newServiceRequestData.reactivationOfferedBy = "prestador";
      targetNotificationUserId = servicioAnteriorData.usuarioId;
      targetNotificationUserType = "usuario";
      notificationTitle = "Oferta para Reactivar Servicio";
      notificationBody = `El prestador ${initiatorId} te ofrece reactivar el servicio "${servicioAnteriorData.titulo || idServicioAnterior}". Por favor, revisa y confirma si deseas proceder.`;
      logAction = "SERVICIO_REACTIVADO_OFERTA";
    }

    await nuevaSolicitudRef.set(newServiceRequestData);

    await logActivity(
      initiatorId,
      initiatorRoleInOldService,
      logAction,
      `Intento de reactivación (${accion}) para servicio anterior ${idServicioAnterior}. Nueva solicitud: ${nuevaSolicitudRef.id}.`,
      {tipo: "solicitud_servicio", id: nuevaSolicitudRef.id},
      {idServicioAnterior, notas: notasIniciador}
    );

    await sendNotification(targetNotificationUserId, targetNotificationUserType, notificationTitle, notificationBody, {
      newServiceRequestId: nuevaSolicitudRef.id,
      originatingServiceId: idServicioAnterior,
    });

    return {success: true, newServiceRequestId: nuevaSolicitudRef.id};
  } catch (error: any) {
    functions.logger.error(`Error en reactivarServicioRecurrente para ${idServicioAnterior}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la reactivación del servicio.", error.message);
  }
});

export const startServiceByProvider = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un prestador autenticado.");
  }
  const providerId = context.auth.uid;
  const {servicioId} = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'servicioId'.");
  }

  const servicioRef = db.collection("solicitudes_servicio").doc(servicioId);

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceRequest;

      if (servicioData.prestadorId !== providerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el prestador asignado a este servicio.");
      }

      const validPreviousStates: ServiceRequestStatus[] = ["confirmada_prestador", "pagada", "en_camino_proveedor"];
      if (!validPreviousStates.includes(servicioData.status)) {
        throw new functions.https.HttpsError("failed-precondition", `No se puede iniciar el servicio desde el estado actual '${servicioData.status}'. Estados válidos previos: ${validPreviousStates.join(", ")}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const updates: Partial<ServiceRequest> = {
        status: "servicio_iniciado",
        actualStartTime: now,
        updatedAt: now,
        actorDelCambioId: providerId,
        actorDelCambioRol: "prestador",
      };

      transaction.update(servicioRef, updates);

      await logActivity(
        providerId,
        "prestador",
        "CAMBIO_ESTADO_SOLICITUD",
        `Prestador ${providerId} inició el servicio ${servicioId}.`,
        {tipo: "solicitud_servicio", id: servicioId},
        {estadoAnterior: servicioData.status, estadoNuevo: "servicio_iniciado"}
      );

      await sendNotification(
        servicioData.usuarioId,
        "usuario",
        "¡Servicio Iniciado!",
        `El prestador ${providerId} (ID: ${providerId.substring(0, 5)}) ha comenzado el servicio "${servicioData.titulo || "reservado"}".`,
        {servicioId: servicioId, nuevoEstado: "servicio_iniciado"}
      );

      return {success: true, message: "Servicio marcado como iniciado correctamente."};
    });
  } catch (error: any) {
    functions.logger.error(`Error al iniciar servicio ${servicioId} por prestador ${providerId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al iniciar el servicio.", error.message);
  }
});

export const confirmServiceAndHandlePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const userId = context.auth.uid;
  const {serviceId, serviceDetails, paymentAmount} = data;

  if (!serviceId || typeof serviceId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'serviceId'.");
  }
  if (typeof paymentAmount !== "number" || paymentAmount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'paymentAmount' válido y positivo.");
  }

  const originalServiceRef = db.collection("solicitudes_servicio").doc(serviceId);
  const servicioConfirmadoRef = db.collection("serviciosConfirmados").doc(serviceId);
  const pagoPendienteRef = db.collection("pagosPendientes").doc(serviceId);
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const originalServiceDoc = await transaction.get(originalServiceRef);
      if (!originalServiceDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio original con ID ${serviceId} no encontrado.`);
      }
      const originalServiceData = originalServiceDoc.data() as ServiceRequest;

      if (originalServiceData.usuarioId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el usuario de este servicio.");
      }

      if (originalServiceData.status !== "confirmada_prestador" && originalServiceData.status !== "pendiente_confirmacion_usuario") {
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en un estado válido para confirmación y pago. Estado actual: ${originalServiceData.status}`);
      }
      if (originalServiceData.paymentStatus !== "pendiente_cobro" && originalServiceData.paymentStatus !== "no_aplica") {
        if (!(originalServiceData.isRecurringAttempt && originalServiceData.reactivationOfferedBy === "prestador" && originalServiceData.paymentStatus === "no_aplica")) {
          throw new functions.https.HttpsError("failed-precondition", `El estado de pago del servicio no es 'pendiente_cobro' o no es una oferta de reactivación válida. Estado pago: ${originalServiceData.paymentStatus}`);
        }
      }

      const servicioConfirmadoPayload: ServicioConfirmadoData = {
        userId: userId,
        providerId: originalServiceData.prestadorId,
        paymentAmount: paymentAmount,
        status: "confirmado",
        confirmadoEn: now,
        puedeCancelarHasta: admin.firestore.Timestamp.fromMillis(now.toMillis() + MINUTOS_VENTANA_CANCELACION * 60 * 1000),
        iniciado: false,
        ...(serviceDetails && {serviceDetails: serviceDetails as string}),
      };
      transaction.set(servicioConfirmadoRef, servicioConfirmadoPayload);

      const pagoPendientePayload: PagoPendienteData = {
        userId: userId,
        providerId: originalServiceData.prestadorId,
        paymentAmount: paymentAmount,
        retenido: true,
        status: "esperando_calificacion",
        creadoEn: now,
      };
      transaction.set(pagoPendienteRef, pagoPendientePayload);

      const updateOriginalService: Partial<ServiceRequest> = {
        status: "pagada",
        paymentStatus: "retenido_para_liberacion",
        montoCobrado: paymentAmount,
        updatedAt: now,
        actorDelCambioId: userId,
        actorDelCambioRol: "usuario",
        cancellationWindowExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + MINUTOS_VENTANA_CANCELACION * 60 * 1000),
        paymentIntentId: `sim_pi_${serviceId}_${now.toMillis()}`,
      };
      transaction.update(originalServiceRef, updateOriginalService);

      await logActivity(
        userId,
        "usuario",
        "SERVICIO_CONFIRMADO_PAGADO",
        `Usuario confirmó y pagó servicio ${serviceId}. Monto: ${paymentAmount}. Detalles: ${serviceDetails || "N/A"}`,
        {tipo: "solicitud_servicio", id: serviceId},
        {paymentAmount, serviceDetails: serviceDetails || "N/A"}
      );

      await sendNotification(
        originalServiceData.prestadorId,
        "prestador",
        "¡Servicio Confirmado y Pagado!",
        `El usuario ha confirmado y pagado el servicio "${originalServiceData.titulo || serviceId}". Monto: $${paymentAmount}.`,
        {serviceId: serviceId, status: "pagada"}
      );

      return {success: true, message: "Servicio confirmado y pago retenido exitosamente."};
    });
  } catch (error: any) {
    functions.logger.error(`Error en confirmServiceAndHandlePayment para servicio ${serviceId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al confirmar el servicio y procesar el pago.", error.message);
  }
});

export const cancelService = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const callingUserId = context.auth.uid;
  const {serviceId} = data;

  if (!serviceId || typeof serviceId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'serviceId'.");
  }

  const servicioConfirmadoRef = db.collection("serviciosConfirmados").doc(serviceId);
  const cancelacionesRef = db.collection("cancelaciones");

  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioConfirmadoDoc = await transaction.get(servicioConfirmadoRef);
      if (!servicioConfirmadoDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio confirmado con ID ${serviceId} no encontrado.`);
      }
      const servicioConfirmadoData = servicioConfirmadoDoc.data() as ServicioConfirmadoData;

      let actor: "usuario" | "prestador";
      let otraParteId: string;
      let otraParteRol: "usuario" | "prestador";

      if (callingUserId === servicioConfirmadoData.userId) {
        actor = "usuario";
        otraParteId = servicioConfirmadoData.providerId;
        otraParteRol = "prestador";
      } else if (callingUserId === servicioConfirmadoData.providerId) {
        actor = "prestador";
        otraParteId = servicioConfirmadoData.userId;
        otraParteRol = "usuario";
      } else {
        throw new functions.https.HttpsError("permission-denied", "No estás autorizado para cancelar este servicio.");
      }

      if (servicioConfirmadoData.iniciado === true) {
        throw new functions.https.HttpsError("failed-precondition", "No se puede cancelar un servicio que ya ha comenzado.");
      }

      let penalizacionMonto = 0;
      let penalizacionPorcentaje = 0;
      let logAction: ActivityLogAction = "SERVICIO_CANCELADO_SIN_PENALIZACION";
      let messageToUser = `Servicio ${serviceId} cancelado exitosamente.`;

      if (now.toMillis() > (servicioConfirmadoData.puedeCancelarHasta as admin.firestore.Timestamp).toMillis()) {
        penalizacionPorcentaje = COMISION_CANCELACION_TARDIA_PORCENTAJE;
        penalizacionMonto = servicioConfirmadoData.paymentAmount * penalizacionPorcentaje;
        logAction = "SERVICIO_CANCELADO_CON_PENALIZACION";
        messageToUser = `Servicio ${serviceId} cancelado. Se aplicó una penalización de $${penalizacionMonto.toFixed(2)} por cancelación tardía.`;
        functions.logger.info(`Cancelación tardía para servicio ${serviceId} por ${actor}. Penalización: $${penalizacionMonto.toFixed(2)}`);
      } else {
        functions.logger.info(`Cancelación dentro de ventana para servicio ${serviceId} por ${actor}. Sin penalización.`);
      }

      const cancelacionPayload: CancelacionData = {
        serviceId: serviceId,
        actor: actor,
        penalizacionMonto: penalizacionMonto > 0 ? penalizacionMonto : undefined,
        penalizacionPorcentaje: penalizacionPorcentaje > 0 ? penalizacionPorcentaje : undefined,
        fechaCancelacion: now,
      };
      transaction.set(cancelacionesRef.doc(), cancelacionPayload);
      transaction.delete(servicioConfirmadoRef);

      await logActivity(
        callingUserId,
        actor,
        logAction,
        `Servicio ${serviceId} cancelado por ${actor}. Penalización: $${penalizacionMonto.toFixed(2)}.`,
        {tipo: "cancelacion", id: serviceId},
        {montoPenalizacion: penalizacionMonto, porcentajePenalizacion: penalizacionPorcentaje}
      );

      await sendNotification(
        otraParteId,
        otraParteRol,
        "Servicio Cancelado",
        `El servicio (ID: ${serviceId.substring(0, 6)}) ha sido cancelado por ${actor}. ${penalizacionMonto > 0 ? `Se aplicó una penalización de $${penalizacionMonto.toFixed(2)}.` : "No se aplicó penalización."}`,
        {serviceId: serviceId, actorCancelacion: actor}
      );
      functions.logger.warn(`[cancelService] DEUDA TÉCNICA: Actualizaciones a 'pagosPendientes' y 'solicitudes_servicio' para ${serviceId} no implementadas en esta función.`);


      return {success: true, message: messageToUser, penalizacionAplicada: penalizacionMonto};
    });
  } catch (error: any) {
    functions.logger.error(`Error al cancelar servicio ${serviceId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la cancelación del servicio.", error.message);
  }
});


export const solicitarUnirseAComunidad = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const usuarioId = context.auth.uid;
  const {comunidadId} = data;

  if (!comunidadId || typeof comunidadId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'comunidadId'.");
  }

  const comunidadRef = db.collection("comunidades").doc(comunidadId);
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const comunidadDoc = await transaction.get(comunidadRef);
      if (!comunidadDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Comunidad con ID ${comunidadId} no encontrada.`);
      }
      const comunidadData = comunidadDoc.data() as ComunidadData;

      if (comunidadData.tipo === "privada") {
        if (comunidadData.miembros?.includes(usuarioId)) {
          throw new functions.https.HttpsError("already-exists", "Ya eres miembro de esta comunidad.");
        }
        if (comunidadData.solicitudesPendientes?.includes(usuarioId)) {
          throw new functions.https.HttpsError("already-exists", "Tu solicitud para unirte a esta comunidad ya está pendiente.");
        }
        transaction.update(comunidadRef, {
          solicitudesPendientes: admin.firestore.FieldValue.arrayUnion(usuarioId),
          updatedAt: now,
        });
        await logActivity(usuarioId, "usuario", "COMUNIDAD_SOLICITUD_UNIRSE", `Usuario ${usuarioId} solicitó unirse a comunidad privada '${comunidadData.nombre}' (ID: ${comunidadId}).`, {tipo: "comunidad", id: comunidadId});

        if (comunidadData.embajador_uid && comunidadData.embajador_uid !== usuarioId) {
          await sendNotification(comunidadData.embajador_uid, "usuario", "Nueva Solicitud de Unión", `El usuario ${usuarioId} desea unirse a tu comunidad "${comunidadData.nombre}".`, {comunidadId: comunidadId, solicitanteId: usuarioId});
          await logActivity("sistema", "sistema", "COMUNIDAD_EMBAJADOR_NOTIFICADO_SOLICITUD", `Embajador ${comunidadData.embajador_uid} notificado de solicitud de ${usuarioId} para comunidad ${comunidadId}.`, {tipo: "comunidad", id: comunidadId});
        }
        return {success: true, message: "Tu solicitud para unirte ha sido enviada. Espera la aprobación del embajador."};
      } else if (comunidadData.tipo === "publica") {
        if (comunidadData.miembros?.includes(usuarioId)) {
          throw new functions.https.HttpsError("already-exists", "Ya eres miembro de esta comunidad.");
        }
        transaction.update(comunidadRef, {
          miembros: admin.firestore.FieldValue.arrayUnion(usuarioId),
          updatedAt: now,
        });
        await logActivity(usuarioId, "usuario", "COMUNIDAD_USUARIO_UNIDO", `Usuario ${usuarioId} se unió a comunidad pública '${comunidadData.nombre}' (ID: ${comunidadId}).`, {tipo: "comunidad", id: comunidadId});
        return {success: true, message: `¡Te has unido a la comunidad "${comunidadData.nombre}"!`};
      } else {
        throw new functions.https.HttpsError("failed-precondition", "Tipo de comunidad desconocido o no manejado.");
      }
    });
  } catch (error: any) {
    functions.logger.error(`Error al solicitar unirse a comunidad ${comunidadId} por usuario ${usuarioId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la solicitud para unirse a la comunidad.", error.message);
  }
});

export const gestionarSolicitudComunidad = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const embajadorId = context.auth.uid;
  const {comunidadId, solicitanteUid, accion} = data; // accion: "aprobar" | "rechazar"

  if (!comunidadId || typeof comunidadId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'comunidadId'.");
  }
  if (!solicitanteUid || typeof solicitanteUid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'solicitanteUid'.");
  }
  if (!accion || (accion !== "aprobar" && accion !== "rechazar")) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere una 'accion' válida ('aprobar' o 'rechazar').");
  }

  const comunidadRef = db.collection("comunidades").doc(comunidadId);
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const comunidadDoc = await transaction.get(comunidadRef);
      if (!comunidadDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Comunidad con ID ${comunidadId} no encontrada.`);
      }
      const comunidadData = comunidadDoc.data() as ComunidadData;

      if (comunidadData.embajador_uid !== embajadorId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el embajador de esta comunidad y no puedes gestionar solicitudes.");
      }

      if (!comunidadData.solicitudesPendientes?.includes(solicitanteUid)) {
        throw new functions.https.HttpsError("failed-precondition", `El usuario ${solicitanteUid} no tiene una solicitud pendiente para esta comunidad o ya fue procesada.`);
      }

      let logMessage = "";
      let logActionType: ActivityLogAction;
      let notifTitle = "";
      let notifBody = "";

      if (accion === "aprobar") {
        transaction.update(comunidadRef, {
          solicitudesPendientes: admin.firestore.FieldValue.arrayRemove(solicitanteUid),
          miembros: admin.firestore.FieldValue.arrayUnion(solicitanteUid),
          updatedAt: now,
        });
        logActionType = "COMUNIDAD_SOLICITUD_APROBADA";
        logMessage = `Embajador ${embajadorId} aprobó solicitud de ${solicitanteUid} para unirse a comunidad '${comunidadData.nombre}' (ID: ${comunidadId}).`;
        notifTitle = "¡Solicitud Aprobada!";
        notifBody = `Tu solicitud para unirte a la comunidad "${comunidadData.nombre}" ha sido aprobada. ¡Bienvenido/a!`;
      } else { // accion === "rechazar"
        transaction.update(comunidadRef, {
          solicitudesPendientes: admin.firestore.FieldValue.arrayRemove(solicitanteUid),
          updatedAt: now,
        });
        logActionType = "COMUNIDAD_SOLICITUD_RECHAZADA";
        logMessage = `Embajador ${embajadorId} rechazó solicitud de ${solicitanteUid} para unirse a comunidad '${comunidadData.nombre}' (ID: ${comunidadId}).`;
        notifTitle = "Solicitud Rechazada";
        notifBody = `Lamentablemente, tu solicitud para unirte a la comunidad "${comunidadData.nombre}" ha sido rechazada.`;
      }

      await logActivity(embajadorId, "usuario", logActionType, logMessage, {tipo: "comunidad", id: comunidadId}, {solicitanteProcesado: solicitanteUid});
      await sendNotification(solicitanteUid, "usuario", notifTitle, notifBody, {comunidadId: comunidadId, accionRealizada: accion});

      return {success: true, message: `Solicitud de ${solicitanteUid} ${accion === "aprobar" ? "aprobada" : "rechazada"} exitosamente.`};
    });
  } catch (error: any) {
    functions.logger.error(`Error al gestionar solicitud para comunidad ${comunidadId} por embajador ${embajadorId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la gestión de la solicitud.", error.message);
  }
});

export const manageCommunityNotice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const embajadorId = context.auth.uid;
  const {comunidadId, action, noticeData, noticeId} = data as {
    comunidadId: string,
    action: "create" | "update",
    noticeData: Partial<AvisoComunidadDataFirestore>,
    noticeId?: string
  };

  if (!comunidadId || typeof comunidadId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'comunidadId'.");
  }
  if (!action || (action !== "create" && action !== "update")) {
    throw new functions.https.HttpsError("invalid-argument", "La 'action' debe ser 'create' o 'update'.");
  }
  if (!noticeData || typeof noticeData !== "object") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'noticeData'.");
  }
  if (action === "update" && (!noticeId || typeof noticeId !== "string")) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'noticeId' para la acción 'update'.");
  }

  const comunidadRef = db.collection("comunidades").doc(comunidadId);
  const avisosComunidadRef = comunidadRef.collection("avisos");
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const comunidadDoc = await transaction.get(comunidadRef);
      if (!comunidadDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Comunidad con ID ${comunidadId} no encontrada.`);
      }
      const comunidadData = comunidadDoc.data() as ComunidadData;

      if (comunidadData.embajador_uid !== embajadorId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el embajador de esta comunidad.");
      }

      let finalNoticeId = noticeId;
      let logActionType: ActivityLogAction = "COMUNIDAD_AVISO_CREADO";
      let logMessage = "";

      if (noticeData.activo === true) {
        let activeNoticesQuery = avisosComunidadRef.where("activo", "==", true);
        const activeNoticesSnapshot = await transaction.get(activeNoticesQuery);
        let activeNotices = activeNoticesSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()} as AvisoComunidadDataFirestore & {id: string}));

        let isBecomingActive = false;
        if (action === "update" && noticeId) {
          const currentNoticeSnap = await transaction.get(avisosComunidadRef.doc(noticeId));
          if (currentNoticeSnap.exists) {
            const currentNoticeData = currentNoticeSnap.data() as AvisoComunidadDataFirestore;
            if (currentNoticeData.activo === false && noticeData.activo === true) {
              isBecomingActive = true;
            }
            if (currentNoticeData.activo === true) {
              activeNotices = activeNotices.filter(n => n.id !== noticeId);
            }
          }
        }

        if ( (action === "create" && activeNotices.length >= MAX_ACTIVE_COMMUNITY_NOTICES) ||
             (isBecomingActive && activeNotices.length >= MAX_ACTIVE_COMMUNITY_NOTICES) ) {
          activeNotices.sort((a, b) => a.fechaPublicacion.toMillis() - b.fechaPublicacion.toMillis());
          const oldestActiveNotice = activeNotices[0];
          if (oldestActiveNotice) {
            transaction.update(avisosComunidadRef.doc(oldestActiveNotice.id), {activo: false, anclado: false});
            functions.logger.info(`[manageCommunityNotice] Desactivado aviso más antiguo ${oldestActiveNotice.id} en comunidad ${comunidadId} para hacer espacio.`);
          }
        }
      }

      if (noticeData.anclado === true) {
        const ancladosQuery = avisosComunidadRef.where("anclado", "==", true);
        const ancladosSnapshot = await transaction.get(ancladosQuery);
        ancladosSnapshot.forEach((doc) => {
          if (action === "create" || (action === "update" && doc.id !== noticeId)) {
            transaction.update(doc.ref, {anclado: false});
            functions.logger.info(`[manageCommunityNotice] Desanclado aviso ${doc.id} en comunidad ${comunidadId}.`);
          }
        });
      }

      if (action === "create") {
        const newNoticeRef = avisosComunidadRef.doc();
        finalNoticeId = newNoticeRef.id;
        const completeNoticeData: AvisoComunidadDataFirestore = {
          titulo: noticeData.titulo || "Sin Título",
          descripcion: noticeData.descripcion || "",
          fechaPublicacion: now,
          activo: noticeData.activo !== undefined ? noticeData.activo : true,
          anclado: noticeData.anclado || false,
          autor_uid: embajadorId,
          ...(noticeData.fechaExpiracion && {fechaExpiracion: noticeData.fechaExpiracion}),
        };
        transaction.set(newNoticeRef, completeNoticeData);
        logMessage = `Embajador ${embajadorId} creó aviso '${completeNoticeData.titulo}' (ID: ${finalNoticeId}) en comunidad ${comunidadId}.`;
        logActionType = "COMUNIDAD_AVISO_CREADO";
      } else if (action === "update" && noticeId) {
        const noticeToUpdateRef = avisosComunidadRef.doc(noticeId);
        const updatePayload: Partial<AvisoComunidadDataFirestore> = {...noticeData};
        delete updatePayload.fechaPublicacion;
        delete updatePayload.autor_uid;
        transaction.update(noticeToUpdateRef, updatePayload);
        logMessage = `Embajador ${embajadorId} actualizó aviso ID: ${noticeId} en comunidad ${comunidadId}.`;
        logActionType = "COMUNIDAD_AVISO_ACTUALIZADO";
      } else {
        throw new functions.https.HttpsError("internal", "Acción o noticeId inválido para la operación.");
      }

      await logActivity(embajadorId, "usuario", logActionType, logMessage, {tipo: "aviso_comunidad", id: finalNoticeId || "N/A"}, {comunidadId: comunidadId, detallesAviso: noticeData});

      return {success: true, message: `Aviso ${action === "create" ? "creado" : "actualizado"} exitosamente.`, noticeId: finalNoticeId};
    });
  } catch (error: any) {
    functions.logger.error(`Error en manageCommunityNotice para comunidad ${comunidadId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al gestionar el aviso de la comunidad.", error.message);
  }
});


export const onNewCommunityNoticeSendNotifications = functions.firestore
  .document("comunidades/{comunidadId}/avisos/{avisoId}")
  .onCreate(async (snapshot, context) => {
    const avisoData = snapshot.data() as AvisoComunidadDataFirestore | undefined;
    const comunidadId = context.params.comunidadId;
    const avisoId = context.params.avisoId;

    if (!avisoData) {
      functions.logger.error(`[NewAvisoTrigger ${comunidadId}/${avisoId}] No hay datos en el aviso, saliendo.`);
      return null;
    }

    if (avisoData.activo !== true) {
      functions.logger.log(`[NewAvisoTrigger ${comunidadId}/${avisoId}] El aviso no está activo, no se enviarán notificaciones.`);
      return null;
    }

    functions.logger.info(`[NewAvisoTrigger ${comunidadId}/${avisoId}] Nuevo aviso activo detectado. Título: "${avisoData.titulo}". Iniciando envío de notificaciones.`);

    try {
      const comunidadDocRef = db.collection("comunidades").doc(comunidadId);
      const comunidadDoc = await comunidadDocRef.get();

      if (!comunidadDoc.exists) {
        functions.logger.error(`[NewAvisoTrigger ${comunidadId}/${avisoId}] Comunidad con ID ${comunidadId} no encontrada.`);
        return null;
      }
      const comunidadData = comunidadDoc.data() as ComunidadData;
      const miembros = comunidadData.miembros;

      if (!miembros || miembros.length === 0) {
        functions.logger.log(`[NewAvisoTrigger ${comunidadId}/${avisoId}] La comunidad "${comunidadData.nombre}" no tiene miembros para notificar.`);
        return null;
      }

      const notifTitle = `Nuevo aviso en ${comunidadData.nombre}: ${avisoData.titulo}`;
      const notifBody = `Se ha publicado un nuevo aviso en la comunidad "${comunidadData.nombre}". ¡Échale un vistazo!`;
      const notifData = {
        comunidadId: comunidadId,
        avisoId: avisoId,
        type: "NEW_COMMUNITY_NOTICE",
      };

      const notificationPromises = miembros.map((miembroUid) => {
        if (miembroUid === avisoData.autor_uid) {
          return Promise.resolve();
        }
        return sendNotification(miembroUid, "usuario", notifTitle, notifBody, notifData);
      });

      await Promise.all(notificationPromises);
      functions.logger.info(`[NewAvisoTrigger ${comunidadId}/${avisoId}] Notificaciones enviadas a ${miembros.length} miembros para el aviso.`);

      await logActivity(
        "sistema",
        "sistema",
        "COMUNIDAD_NUEVO_AVISO_NOTIFICADO",
        `Notificaciones enviadas a ${miembros.length} miembros por nuevo aviso "${avisoData.titulo}" en comunidad "${comunidadData.nombre}".`,
        {tipo: "aviso_comunidad", id: avisoId},
        {comunidadId, avisoTitulo: avisoData.titulo, miembrosNotificados: miembros.length}
      );
    } catch (error) {
      functions.logger.error(`[NewAvisoTrigger ${comunidadId}/${avisoId}] Error al enviar notificaciones por nuevo aviso:`, error);
    }
    return null;
  });

export const confirmarCitaPorPrestador = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para confirmar una cita (prestador).");
  }
  const prestadorIdAutenticado = context.auth.uid;
  const {citaId, accion} = data; // accion puede ser "confirmar" o "rechazar"

  if (!citaId || typeof citaId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'citaId'.");
  }
  if (!accion || (accion !== "confirmar" && accion !== "rechazar")) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere una 'accion' válida ('confirmar' o 'rechazar').");
  }

  const citaRef = db.collection("citas").doc(citaId);

  try {
    return await db.runTransaction(async (transaction) => {
      const citaDoc = await transaction.get(citaRef);
      if (!citaDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Cita con ID ${citaId} no encontrada.`);
      }
      const citaData = citaDoc.data() as CitaDataFirestore;

      if (citaData.prestadorId !== prestadorIdAutenticado) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para modificar esta cita. No corresponde a tu ID de prestador.");
      }

      if (citaData.estado !== "pendiente_confirmacion") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden ${accion} citas en estado 'pendiente_confirmacion'. Estado actual: ${citaData.estado}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const updateData: Partial<CitaDataFirestore> & {updatedAt: admin.firestore.Timestamp} = {
        updatedAt: now,
      };
      let logActionType: ActivityLogAction;
      let logMessage = "";

      if (accion === "confirmar") {
        updateData.estado = "confirmada_prestador";
        updateData.fechaConfirmacionPrestador = now;
        updateData.paymentStatus = "pendiente_cobro"; // Prepara para el cobro
        updateData.ordenCobroId = `sim_orden_${citaId}_${Date.now()}`; // ID de orden simulado
        logActionType = "CITA_CONFIRMADA_PRESTADOR";
        logMessage = `Prestador ${prestadorIdAutenticado} confirmó cita ${citaId}.`;
      } else { // accion === "rechazar"
        updateData.estado = "rechazada_prestador";
        updateData.fechaRechazoPrestador = now;
        logActionType = "CITA_RECHAZADA_PRESTADOR";
        logMessage = `Prestador ${prestadorIdAutenticado} rechazó cita ${citaId}.`;
      }

      transaction.update(citaRef, updateData);
      await logActivity(
        prestadorIdAutenticado,
        "prestador",
        logActionType,
        logMessage,
        {tipo: "cita", id: citaId},
        {usuarioId: citaData.usuarioId}
      );
      return {success: true, message: `Cita ${accion === "confirmar" ? "confirmada" : "rechazada"} exitosamente.`};
    });
  } catch (error: any) {
    functions.logger.error(`Error en confirmarCitaPorPrestador (cita ${citaId}, accion ${accion}):`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Error al ${accion} la cita.`, error.message);
  }
});

export const cancelarCitaConfirmadaPorCliente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para cancelar una cita.");
  }
  const clienteUid = context.auth.uid;
  const {citaId, motivoCancelacion} = data as {citaId: string, motivoCancelacion?: string};

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
      const citaData = citaDoc.data() as CitaDataFirestore;

      if (citaData.usuarioId !== clienteUid) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para cancelar esta cita.");
      }

      const validPreviousStates: CitaEstadoFirestore[] = ["confirmada_prestador", "pagada"];
      if (!validPreviousStates.includes(citaData.estado)) {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden cancelar citas con estado '${validPreviousStates.join("' o '")}'. Estado actual: ${citaData.estado}.`);
      }
      if (citaData.estado === "servicio_iniciado" || citaData.estado === "completada" || citaData.estado === "completado_por_prestador" || citaData.estado === "completado_por_usuario") {
        throw new functions.https.HttpsError("failed-precondition", "No se puede cancelar una cita que ya ha iniciado o sido completada.");
      }

      const now = admin.firestore.Timestamp.now();
      const fechaHoraCita = citaData.fechaHoraSolicitada.toDate();
      const horasRestantes = (fechaHoraCita.getTime() - now.toDate().getTime()) / (1000 * 60 * 60);

      const montoTotalServicio = citaData.montoTotalEstimado || citaData.precioServicio || 0;
      let penalizacionTotalCalculada = 0;
      let montoParaPlataforma = 0;
      let montoParaPrestador = 0;
      let reglaAplicada: '>2h' | '<=2h';

      if (horasRestantes > 2) {
        reglaAplicada = ">2h";
        penalizacionTotalCalculada = montoTotalServicio * PENALIZACION_CLIENTE_CITA_MAS_2H_PCT;
        montoParaPlataforma = penalizacionTotalCalculada;
        montoParaPrestador = 0;
      } else {
        reglaAplicada = "<=2h";
        penalizacionTotalCalculada = montoTotalServicio * PENALIZACION_CLIENTE_CITA_MENOS_2H_PCT_TOTAL;
        montoParaPlataforma = montoTotalServicio * PENALIZACION_CLIENTE_CITA_MENOS_2H_PCT_PLATAFORMA;
        montoParaPrestador = montoTotalServicio * PENALIZACION_CLIENTE_CITA_MENOS_2H_PCT_PRESTADOR;
      }
      const montoReembolsoProgramadoUsuario = Math.max(0, montoTotalServicio - penalizacionTotalCalculada);

      const updates: Partial<CitaDataFirestore> & {updatedAt: admin.firestore.Timestamp} = {
        estado: "cancelada_usuario",
        fechaCancelacion: now,
        canceladaPor: clienteUid,
        rolCancelador: "usuario",
        motivoCancelacion: motivoCancelacion || "Cancelación por el usuario.",
        detallesCancelacion: {
          penalizacionTotalCalculada,
          montoParaPlataforma,
          montoParaPrestador,
          montoReembolsoProgramadoUsuario,
          reglaAplicada,
        },
        updatedAt: now,
      };

      // Lógica simulada de ajuste de PaymentStatus
      if (citaData.paymentStatus === "procesado_exitosamente" || citaData.paymentStatus === "retenido_para_liberacion") {
        if (montoReembolsoProgramadoUsuario === montoTotalServicio) {
          updates.paymentStatus = "reembolsado_total"; // No penalty, full refund
        } else if (montoReembolsoProgramadoUsuario > 0) {
          updates.paymentStatus = "reembolsado_parcial";
        } else { // No refund if penalty >= total
          updates.paymentStatus = "liberado_al_proveedor"; // Assume penalty covers what would be released or more
        }
      } else if (citaData.paymentStatus === "pendiente_cobro") {
        // If payment was pending, it might just not be processed, or a penalty is charged.
        // For simplicity, we'll assume no charge attempt is made now, or it's adjusted if a penalty applies.
        // This part needs solid payment gateway integration.
        updates.paymentStatus = "no_aplica"; // Or a specific "cancelled_before_payment"
      }

      transaction.update(citaRef, updates);

      await logActivity(
        clienteUid,
        "usuario",
        "CITA_CANCELADA_USUARIO_PENALIZACION",
        `Cliente canceló cita ${citaId}. Regla: ${reglaAplicada}. Penalización: $${penalizacionTotalCalculada.toFixed(2)}. Reembolso prog.: $${montoReembolsoProgramadoUsuario.toFixed(2)}.`,
        {tipo: "cita", id: citaId},
        updates.detallesCancelacion
      );

      // Notificar al proveedor
      const prestadorDoc = await db.collection("prestadores").doc(citaData.prestadorId).get();
      const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData)?.nombre || "El prestador" : "El prestador";

      await sendNotification(
        citaData.prestadorId,
        "prestador",
        "Cita Cancelada por Cliente",
        `La cita para "${citaData.detallesServicio}" con ${nombrePrestador} el ${fechaHoraCita.toLocaleDateString()} ha sido cancelada por el cliente. Compensación (si aplica): $${montoParaPrestador.toFixed(2)}.`,
        {citaId: citaId, motivo: motivoCancelacion || "Sin motivo especificado"}
      );

      return {
        success: true,
        message: `Cita cancelada. Penalización aplicada: $${penalizacionTotalCalculada.toFixed(2)}. Monto a reembolsar (estimado): $${montoReembolsoProgramadoUsuario.toFixed(2)}.`,
        detallesCancelacion: updates.detallesCancelacion,
      };
    });
  } catch (error: any) {
    functions.logger.error(`Error al cancelar cita ${citaId} por cliente ${clienteUid}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la cancelación de la cita.", error.message);
  }
});


export const onCitaActualizadaNotificarYProcesar = functions.firestore
  .document("citas/{citaId}")
  .onUpdate(async (change, context) => {
    const citaId = context.params.citaId;
    const beforeData = change.before.data() as CitaDataFirestore | undefined;
    const afterData = change.after.data() as CitaDataFirestore | undefined;

    if (!beforeData || !afterData) {
      functions.logger.log(`[onCitaActualizada ${citaId}] No hay datos antes o después, saliendo.`);
      return null;
    }
    
    // Solo actuar si el estado ha cambiado
    if (beforeData.estado === afterData.estado) {
        return null;
    }

    const usuarioId = afterData.usuarioId;
    const prestadorId = afterData.prestadorId;
    let prestadorNombre = "El prestador";
    try {
      const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
      if (prestadorDoc.exists) {
        prestadorNombre = (prestadorDoc.data() as ProviderData)?.nombre || "El prestador";
      }
    } catch (e) {
      functions.logger.error(`[onCitaActualizada ${citaId}] Error al obtener nombre del prestador ${prestadorId}:`, e);
    }

    const detallesCita = afterData.detallesServicio || "tu cita";
    let fechaCitaFormateada = "fecha no disponible";
    let horaCitaFormateada = "hora no disponible";

    if (afterData.fechaHoraSolicitada) {
      try {
        const fechaHora = afterData.fechaHoraSolicitada.toDate();
        fechaCitaFormateada = fechaHora.toLocaleDateString("es-MX", {weekday: "long", year: "numeric", month: "long", day: "numeric"});
        horaCitaFormateada = fechaHora.toLocaleTimeString("es-MX", {hour: "2-digit", minute: "2-digit"});
      } catch (e) {
        functions.logger.error(`[onCitaActualizada ${citaId}] Error al formatear fechaHoraSolicitada:`, e);
      }
    }

    // Si la cita es confirmada por el proveedor
    if (afterData.estado === "confirmada_prestador" && beforeData.estado !== "confirmada_prestador") {
      functions.logger.info(`[onCitaActualizada ${citaId}] Cita confirmada por prestador. Notificando al cliente y procesando campos de seguimiento.`);

      // Lógica para pago (simulada)
      await logActivity(
        "sistema", "sistema", "CITA_PAGO_INICIADO",
        `Proceso de pago iniciado (simulado) para cita confirmada ${citaId}. Monto: ${afterData.montoTotalEstimado || afterData.precioServicio || 0}.`,
        {tipo: "cita", id: citaId},
        {usuarioId, prestadorId, monto: afterData.montoTotalEstimado || afterData.precioServicio || 0}
      );

      // Notificación al cliente
      const montoCita = (afterData.montoTotalEstimado || afterData.precioServicio || 0).toFixed(2);
      await sendNotification(
        usuarioId, "usuario", "¡Tu Cita ha sido Confirmada!",
        `El prestador ${prestadorNombre} ha confirmado tu cita para "${detallesCita}" el ${fechaCitaFormateada} a las ${horaCitaFormateada}. Se procederá con el cobro de $${montoCita}.`,
        {citaId, tipo: "CITA_CONFIRMADA"}
      );

      // Lógica para definir la ventana de seguimiento
      const fechaHoraCitaMillis = afterData.fechaHoraSolicitada.toMillis();
      const timestampActivacionSeguimiento = fechaHoraCitaMillis - DOS_HORAS_EN_MS;

      const updatePayload: Partial<CitaDataFirestore> = {
        permiteSeguimientoDesdeTimestamp: admin.firestore.Timestamp.fromMillis(timestampActivacionSeguimiento),
        notificadoParaEstarEnLinea: false, // Inicializar
      };

      // Log de la definición de la ventana de seguimiento
      await logActivity(
        "sistema", "sistema", "CITA_VENTANA_SEGUIMIENTO_DEFINIDA",
        `Ventana de seguimiento definida para cita ${citaId}. Seguimiento posible desde: ${new Date(timestampActivacionSeguimiento).toISOString()}`,
        {tipo: "cita", id: citaId},
        {timestampActivacionSeguimiento}
      );
      
      // Notificar al proveedor si la cita es pronto
      const ahoraMillis = Date.now();
      if (timestampActivacionSeguimiento - ahoraMillis < TREINTA_MINUTOS_EN_MS && // Si la ventana de seguimiento empieza en menos de 30 min
          ahoraMillis < fechaHoraCitaMillis && // Y la cita aún no ha pasado
          !afterData.notificadoParaEstarEnLinea) {
        await sendNotification(
          prestadorId, "prestador", "Cita Próxima - ¡Ponte en Línea!",
          `Tu cita para "${detallesCita}" con ${usuarioId} es pronto. Asegúrate de estar en línea para el seguimiento.`,
          {citaId, tipo: "CITA_PROXIMA_IR_ONLINE"}
        );
        updatePayload.notificadoParaEstarEnLinea = true;
        await logActivity("sistema", "sistema", "CITA_PROVEEDOR_NOTIFICADO_ONLINE", `Proveedor ${prestadorId} notificado para estar en línea para cita ${citaId}.`, {tipo: "cita", id: citaId});
      }
      
      await change.after.ref.update(updatePayload);
      functions.logger.info(`[onCitaActualizada ${citaId}] Campos de seguimiento actualizados en la cita.`);

    } else if (afterData.estado === "rechazada_prestador" && beforeData.estado !== "rechazada_prestador") {
      functions.logger.info(`[onCitaActualizada ${citaId}] Cita rechazada por prestador. Notificando al cliente.`);
      await sendNotification(
        usuarioId, "usuario", "Cita Rechazada",
        `Lamentablemente, el prestador ${prestadorNombre} ha tenido que rechazar tu cita para "${detallesCita}" el ${fechaCitaFormateada}.`,
        {citaId, tipo: "CITA_RECHAZADA"}
      );
    } else if (afterData.estado === "cancelada_usuario" && beforeData.estado !== "cancelada_usuario") {
      functions.logger.info(`[onCitaActualizada ${citaId}] Cita cancelada por usuario. Notificación al proveedor ya manejada en la función callable 'cancelarCitaConfirmadaPorCliente'.`);
      // La notificación al proveedor sobre la cancelación del usuario ya se hace en la función callable `cancelarCitaConfirmadaPorCliente`.
      // Aquí solo se loguearía el cambio de estado si es necesario por el trigger.
    }
    return null;
  });

export const registerProviderProfile = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para registrarte como proveedor.");
    }
    const providerId = context.auth.uid;
    const {name, specialties, selectedCategoryIds, newCategoryName, codigoEmbajador} = data;

    if (!name || typeof name !== "string" || name.length < 3) {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere un nombre válido (mínimo 3 caracteres).");
    }
    if (!Array.isArray(specialties) || !Array.isArray(selectedCategoryIds)) {
        throw new functions.https.HttpsError("invalid-argument", "Especialidades y categorías deben ser un arreglo.");
    }

    const providerRef = db.collection("prestadores").doc(providerId);

    try {
        const providerDoc = await providerRef.get();
        if (providerDoc.exists) {
            throw new functions.https.HttpsError("already-exists", "Ya existe un perfil de proveedor para este usuario.");
        }

        const now = admin.firestore.Timestamp.now();
        const batch = db.batch();

        const newProviderData: Partial<ProviderData> = {
            nombre: name,
            specialties: specialties,
            categoryIds: selectedCategoryIds,
            isAvailable: false, // Por defecto no disponible hasta que lo activen
            rating: 0,
            avatarUrl: `https://placehold.co/100x100/7F7F7F/FFFFFF.png?text=${name.charAt(0)}`,
        };

        if (codigoEmbajador && typeof codigoEmbajador === "string") {
            const embajadorQuery = db.collection("usuarios").where("codigoEmbajador", "==", codigoEmbajador).limit(1);
            const embajadorSnapshot = await embajadorQuery.get();

            if (!embajadorSnapshot.empty) {
                const embajadorDoc = embajadorSnapshot.docs[0];
                const embajadorData = embajadorDoc.data() as UserData;

                if (embajadorData.isBlocked) {
                    functions.logger.warn(`Intento de registro con código de embajador bloqueado. Embajador UID: ${embajadorDoc.id}, Código: ${codigoEmbajador}.`);
                    await logActivity(
                        providerId, "usuario", "PROVEEDOR_REGISTRADO",
                        `Proveedor ${providerId} intentó registrarse con código de embajador bloqueado (${codigoEmbajador}). La afiliación no se completó.`,
                        {tipo: "prestador", id: providerId},
                        {codigoEmbajador, embajadorBloqueado: true}
                    );
                } else {
                    const embajadorUID = embajadorDoc.id;
                    newProviderData.embajadorUID = embajadorUID;
                    const embajadorRef = db.collection("usuarios").doc(embajadorUID);
                    batch.update(embajadorRef, {
                        referidos: admin.firestore.FieldValue.arrayUnion(providerId),
                    });
                    functions.logger.info(`Proveedor ${providerId} referido por embajador activo ${embajadorUID}.`);
                    await logActivity("sistema", "sistema", "PROVEEDOR_REGISTRADO", `Proveedor ${providerId} registrado con código de embajador válido de ${embajadorUID}.`, {tipo: "prestador", id: providerId}, {embajadorUID, codigo: codigoEmbajador});
                }
            } else {
                functions.logger.warn(`Código de embajador "${codigoEmbajador}" no encontrado. Registrando proveedor sin referencia.`);
            }
        }

        batch.set(providerRef, newProviderData, {merge: true});
        if (!newProviderData.embajadorUID) {
           await logActivity(providerId, "usuario", "PROVEEDOR_REGISTRADO", `Usuario ${providerId} se registró como proveedor: ${name}.`, {tipo: "prestador", id: providerId});
        }
        
        if (newCategoryName && typeof newCategoryName === "string" && newCategoryName.trim().length > 2) {
            const proposalRef = db.collection("propuestas_categorias").doc();
            const proposalData: CategoriaPropuestaData = {
                providerId: providerId,
                nombrePropuesto: newCategoryName.trim(),
                estado: "pendiente",
                fechaCreacion: now,
            };
            batch.set(proposalRef, proposalData);
            await logActivity(providerId, "usuario", "CATEGORIA_PROPUESTA", `Proveedor ${providerId} propuso nueva categoría: "${newCategoryName.trim()}".`, {tipo: "categoria_propuesta", id: proposalRef.id});
        }

        await batch.commit();

        return {success: true, message: "¡Felicidades! Tu perfil de proveedor ha sido creado.", providerId: providerId};
    } catch (error: any) {
        functions.logger.error(`Error registrando proveedor ${providerId}:`, error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", "Error al crear el perfil de proveedor.", error.message);
    }
});

    
export const onCategoryProposalUpdate = functions.firestore
  .document("propuestas_categorias/{proposalId}")
  .onUpdate(async (change, context) => {
    const proposalId = context.params.proposalId;
    const beforeData = change.before.data() as CategoriaPropuestaData;
    const afterData = change.after.data() as CategoriaPropuestaData;

    if (!beforeData || !afterData) {
      functions.logger.log(`[CategoryProposalTrigger ${proposalId}] No data, exiting.`);
      return null;
    }

    // Only trigger if 'estado' changes from 'pendiente'
    if (beforeData.estado !== "pendiente" || beforeData.estado === afterData.estado) {
      functions.logger.log(`[CategoryProposalTrigger ${proposalId}] No relevant state change from 'pendiente', exiting. Before: ${beforeData.estado}, After: ${afterData.estado}`);
      return null;
    }

    const {providerId, nombrePropuesto} = afterData;

    if (afterData.estado === "aprobada") {
      functions.logger.info(`[CategoryProposalTrigger ${proposalId}] Proposal for "${nombrePropuesto}" approved. Adding to official categories.`);
      try {
        const newCategoryRef = await db.collection("categorias_oficiales").add({
          nombre_categoria: nombrePropuesto,
          fecha_creacion: admin.firestore.Timestamp.now(),
          origen: "propuesta_prestador",
        });

        await logActivity(
          "sistema_admin", // Assume an admin made the change
          "admin",
          "CATEGORIA_APROBADA",
          `Categoría propuesta "${nombrePropuesto}" (ID: ${proposalId}) fue aprobada y añadida como '${newCategoryRef.id}' a categorias_oficiales.`,
          {tipo: "categoria_propuesta", id: proposalId},
          {newOfficialCategoryId: newCategoryRef.id}
        );

        await sendNotification(
          providerId,
          "prestador",
          "¡Tu categoría fue aprobada!",
          `La categoría "${nombrePropuesto}" que propusiste ha sido aprobada y ya está disponible.`,
          {proposalId, newCategoryId: newCategoryRef.id}
        );
      } catch (error) {
        functions.logger.error(`[CategoryProposalTrigger ${proposalId}] Error adding approved category:`, error);
      }
    } else if (afterData.estado === "rechazada") {
      functions.logger.info(`[CategoryProposalTrigger ${proposalId}] Proposal for "${nombrePropuesto}" was rejected.`);

      await logActivity(
        "sistema_admin",
        "admin",
        "CATEGORIA_RECHAZADA",
        `Categoría propuesta "${nombrePropuesto}" (ID: ${proposalId}) fue rechazada.`,
        {tipo: "categoria_propuesta", id: proposalId}
      );

      await sendNotification(
        providerId,
        "prestador",
        "Categoría Propuesta Revisada",
        `La categoría "${nombrePropuesto}" que propusiste ha sido revisada y no fue aprobada en esta ocasión.`,
        {proposalId}
      );
    }

    return null;
  });

export const generarRecomendacionesDeRecontratacion = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    functions.logger.info("Ejecutando generarRecomendacionesDeRecontratacion...");

    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    const thirtyDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

    const relacionesQuery = db.collection("relacionesUsuarioPrestador")
        .where("ultimoServicioFecha", "<", thirtyDaysAgoTimestamp);

    const snapshot = await relacionesQuery.get();

    if (snapshot.empty) {
        functions.logger.log("No hay relaciones de más de 30 días para procesar.");
        return null;
    }

    const batch = db.batch();
    const recomendacionesRef = db.collection("recomendaciones");

    let recommendationsCreated = 0;

    for (const doc of snapshot.docs) {
        const relacion = doc.data() as RelacionUsuarioPrestadorData;
        const categoriasRelacion = relacion.categoriasServicios || [];

        const periodicCategory = categoriasRelacion.find((catId) =>
            SERVICE_CATEGORIES.find((sc) => sc.id === catId)?.isPeriodic
        );

        if (periodicCategory) {
            const categoriaInfo = SERVICE_CATEGORIES.find((sc) => sc.id === periodicCategory);
            if (!categoriaInfo) continue;

            const providerDoc = await db.collection("prestadores").doc(relacion.prestadorId).get();
            if (!providerDoc.exists) continue;

            const providerName = (providerDoc.data() as ProviderData)?.nombre || "un prestador";
            const message = `¿Necesitas ayuda de nuevo con ${categoriaInfo.name}? Podrías volver a contratar a ${providerName}.`;

            const recomendacionData: Omit<RecomendacionData, "id"> = {
                usuarioId: relacion.usuarioId,
                prestadorId: relacion.prestadorId,
                categoria: periodicCategory,
                mensaje: message,
                estado: "pendiente",
                fechaCreacion: admin.firestore.Timestamp.now(),
                tipo: 'sistema',
            };

            const newRecomendacionRef = recomendacionesRef.doc();
            batch.set(newRecomendacionRef, recomendacionData);
            recommendationsCreated++;

            await logActivity(
                "sistema",
                "sistema",
                "RECOMENDACION_RECONTRATACION_CREADA",
                `Recomendación creada para usuario ${relacion.usuarioId} de recontratar a prestador ${relacion.prestadorId} para ${periodicCategory}.`,
                { tipo: "recomendacion", id: newRecomendacionRef.id },
                { usuarioId: relacion.usuarioId, prestadorId: relacion.prestadorId, categoria: periodicCategory }
            );

            await sendNotification(
                relacion.usuarioId,
                "usuario",
                `¿Necesitas ayuda de nuevo con ${categoriaInfo.name}?`,
                `Notamos que ha pasado un tiempo. ¡${providerName} está disponible para ayudarte de nuevo!`,
                { recomendacionId: newRecomendacionRef.id }
            );
        }
    }

    if (recommendationsCreated > 0) {
        await batch.commit();
        functions.logger.info(`Se crearon ${recommendationsCreated} recomendaciones de recontratación.`);
    } else {
        functions.logger.log("No se generaron nuevas recomendaciones en esta ejecución.");
    }

    return null;
  });

export const enviarRecordatorioRecontratacion = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para enviar un recordatorio (prestador).");
    }
    const prestadorId = context.auth.uid;
    const { usuarioId, categoriaId, mensajePersonalizado } = data;

    if (!usuarioId || typeof usuarioId !== 'string' || !categoriaId || typeof categoriaId !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "Se requieren 'usuarioId' y 'categoriaId' válidos.");
    }
    
    const now = admin.firestore.Timestamp.now();
    const prestadorRef = db.collection("prestadores").doc(prestadorId);
    const relacionId = `${usuarioId}_${prestadorId}`;
    const relacionRef = db.collection("relacionesUsuarioPrestador").doc(relacionId);

    try {
        return await db.runTransaction(async (transaction) => {
            const prestadorDoc = await transaction.get(prestadorRef);
            if (!prestadorDoc.exists) {
                throw new functions.https.HttpsError("not-found", "No se encontró tu perfil de prestador.");
            }
            const prestadorData = prestadorDoc.data() as ProviderData;
            
            const relacionDoc = await transaction.get(relacionRef);
            if (!relacionDoc.exists) {
                 throw new functions.https.HttpsError("not-found", "No se encontró una relación de servicio previa con este usuario.");
            }
            const relacionData = relacionDoc.data() as RelacionUsuarioPrestadorData;
            
            // Lógica de límite de envíos para no-premium
            if (!prestadorData.isPremium) {
                if (relacionData.lastReminderSent) {
                    const sixtyDaysInMillis = 60 * 24 * 60 * 60 * 1000;
                    const lastSentDate = relacionData.lastReminderSent.toMillis();
                    if (now.toMillis() - lastSentDate < sixtyDaysInMillis) {
                        throw new functions.https.HttpsError("failed-precondition", "Ya has enviado un recordatorio a este cliente recientemente. Por favor, espera 60 días para enviar otro.");
                    }
                }
            }
            
            const prestadorNombre = prestadorData.nombre || 'Tu prestador de confianza';
            const categoria = SERVICE_CATEGORIES.find(c => c.id === categoriaId);
            const nombreCategoria = categoria?.name || 'un servicio';
            const mensaje = mensajePersonalizado || `${prestadorNombre} te invita a agendar de nuevo un servicio de ${nombreCategoria}.`;
            
            const recomendacionData: Omit<RecomendacionData, "id"> = {
                usuarioId: usuarioId,
                prestadorId: prestadorId,
                categoria: categoriaId,
                mensaje: mensaje,
                estado: 'pendiente',
                fechaCreacion: now,
                tipo: 'invita-prestador',
            };
            const recomendacionRef = db.collection("recomendaciones").doc();
            transaction.set(recomendacionRef, recomendacionData);
            
            // Actualizar la fecha del último recordatorio enviado en la relación
            transaction.update(relacionRef, { lastReminderSent: now });

            await logActivity(
                prestadorId, "prestador", "RECONTRATACION_RECORDATORIO_ENVIADO",
                `Prestador ${prestadorId} envió recordatorio a usuario ${usuarioId} para categoría ${categoriaId}.`,
                { tipo: "recomendacion", id: recomendacionRef.id },
                { prestadorId, categoriaId, usuarioId }
            );

            const notifTitle = `Un recordatorio de ${prestadorNombre}`;
            const notifBody = mensaje;

            await sendNotification(usuarioId, "usuario", notifTitle, notifBody, {
                type: 'REHIRE_REMINDER',
                providerId: prestadorId,
                categoryId: categoriaId,
                recommendationId: recomendacionRef.id,
            });

            return { success: true, message: `Recordatorio enviado a usuario ${usuarioId}.`, recomendacionId: recomendacionRef.id };
        });
    } catch (error: any) {
        functions.logger.error(`Error al enviar recordatorio de ${prestadorId} a ${usuarioId}:`, error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", "Error al procesar el envío del recordatorio.", error.message);
    }
});

export const getPastClientsForProvider = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado para ver tus clientes pasados (proveedor).");
    }
    const providerId = context.auth.uid;

    try {
        const relationsQuery = db.collection("relacionesUsuarioPrestador")
            .where("prestadorId", "==", providerId)
            .orderBy("ultimoServicioFecha", "desc");
        
        const snapshot = await relationsQuery.get();
        if (snapshot.empty) {
            return [];
        }

        const pastClientsPromises = snapshot.docs.map(async (doc) => {
            const relacion = doc.data() as RelacionUsuarioPrestadorData;
            const userDoc = await db.collection("usuarios").doc(relacion.usuarioId).get();
            const userData = userDoc.exists() ? userDoc.data() as UserData : null;
            const lastCategory = SERVICE_CATEGORIES.find(c => c.id === relacion.categoriasServicios[relacion.categoriasServicios.length - 1]);

            return {
                usuarioId: relacion.usuarioId,
                nombreUsuario: userData?.nombre || 'Usuario Desconocido',
                avatarUrl: "https://placehold.co/100x100.png", // UserData doesn't have avatarUrl yet, so using a placeholder.
                ultimoServicioFecha: (relacion.ultimoServicioFecha as admin.firestore.Timestamp).toMillis(),
                ultimaCategoriaId: lastCategory?.id || 'general',
                ultimaCategoriaNombre: lastCategory?.name || 'Servicio General',
                serviciosContratados: relacion.serviciosContratados,
            };
        });

        const pastClients = await Promise.all(pastClientsPromises);
        return pastClients;

    } catch (error: any) {
        functions.logger.error(`Error al obtener clientes pasados para proveedor ${providerId}:`, error);
        if (error.code === 'failed-precondition') {
             throw new functions.https.HttpsError("failed-precondition", "La consulta para obtener clientes pasados requiere un índice compuesto en Firestore. Por favor, crea uno desde el enlace en el log de Firebase Functions.");
        }
        throw new functions.https.HttpsError("internal", "Error al obtener la lista de clientes.", error.message);
    }
});

export const getBlockedUsers = functions.https.onCall(async (data, context) => {
    // Ideally, this should be protected by an admin or moderator role check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    // Example: if (!context.auth.token.admin) { throw new functions.https.HttpsError("permission-denied", "Admin role required."); }
    
    try {
        const blockedUsersQuery = db.collection("usuarios").where("isBlocked", "==", true);
        const blockedProvidersQuery = db.collection("prestadores").where("isBlocked", "==", true);

        const [usersSnapshot, providersSnapshot] = await Promise.all([
            blockedUsersQuery.get(),
            blockedProvidersQuery.get(),
        ]);

        const blockedUsers = usersSnapshot.docs.map((doc) => {
            const data = doc.data() as UserData;
            return {
                id: doc.id,
                type: 'usuario',
                name: data.nombre,
                // email: data.email, // Assuming email is stored
                isBlocked: data.isBlocked,
                blockReason: data.blockReason,
                blockDate: data.blockDate?.toMillis(),
            };
        });

        const blockedProviders = providersSnapshot.docs.map((doc) => {
            const data = doc.data() as ProviderData;
            return {
                id: doc.id,
                type: 'prestador',
                name: data.nombre,
                // email: data.email, // Assuming email is stored
                isBlocked: data.isBlocked,
                blockReason: data.blockReason,
                blockDate: data.blockDate?.toMillis(),
            };
        });

        return [...blockedUsers, ...blockedProviders];
    } catch (error: any) {
        functions.logger.error("Error fetching blocked users:", error);
        throw new functions.https.HttpsError("internal", "Failed to fetch blocked users.", error.message);
    }
});

export const updateUserBlockStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const adminId = context.auth.uid;
    // Add admin role check here

    const { userId, userType, blockStatus, reason } = data;

    if (!userId || !userType || typeof blockStatus !== 'boolean') {
        throw new functions.https.HttpsError("invalid-argument", "Missing required parameters: userId, userType, blockStatus.");
    }
    if (userType !== 'usuario' && userType !== 'prestador') {
        throw new functions.https.HttpsError("invalid-argument", "userType must be 'usuario' or 'prestador'.");
    }

    const collectionName = userType === 'usuario' ? 'usuarios' : 'prestadores';
    const userRef = db.collection(collectionName).doc(userId);

    try {
        const updatePayload: { isBlocked: boolean; blockDate?: admin.firestore.FieldValue; blockReason?: admin.firestore.FieldValue | string } = {
            isBlocked: blockStatus,
        };

        if (blockStatus) {
            updatePayload.blockDate = admin.firestore.FieldValue.serverTimestamp();
            updatePayload.blockReason = reason || "No reason specified.";
        } else {
            // When unblocking, clear the reason and date
            updatePayload.blockReason = admin.firestore.FieldValue.delete();
            updatePayload.blockDate = admin.firestore.FieldValue.delete();
        }

        await userRef.update(updatePayload);
        
        const logAction = blockStatus ? "ADMIN_BLOCK_USER" : "ADMIN_UNBLOCK_USER";
        const logDescription = `Admin ${adminId} ${blockStatus ? 'blocked' : 'unblocked'} ${userType} ${userId}. Reason: ${reason || 'N/A'}`;
        await logActivity(adminId, "admin", logAction, logDescription, { type: userType, id: userId }, { reason });

        return { success: true, message: `User ${userId} status updated to ${blockStatus ? 'blocked' : 'unblocked'}.` };
    } catch (error: any) {
        functions.logger.error(`Error updating block status for ${userType} ${userId}:`, error);
        throw new functions.https.HttpsError("internal", "Failed to update user block status.", error.message);
    }
});

export const getProvidersForValidation = functions.https.onCall(async (data, context) => {
  if (!context.auth /* && !context.auth.token.admin */) { // Descomentar para producción
    throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");
  }

  try {
    const providersSnapshot = await db.collection("prestadores")
      .where("documentosValidos", "==", false)
      .get();
      
    if (providersSnapshot.empty) {
      return [];
    }

    const providersToValidate = providersSnapshot.docs.map(doc => {
      const data = doc.data() as ProviderData;
      return {
        id: doc.id,
        nombre: data.nombre,
        avatarUrl: data.avatarUrl,
        comentarioValidacion: data.comentarioValidacion,
        documentosVerificables: data.documentosVerificables || [],
      };
    });

    return providersToValidate;
  } catch (error: any) {
    console.error("Error fetching providers for validation:", error);
    if (error.code === 'failed-precondition') {
        throw new functions.https.HttpsError("failed-precondition", "La consulta requiere un índice compuesto en Firestore. Por favor, crea uno desde el enlace en el log de Firebase Functions.");
    }
    throw new functions.https.HttpsError("internal", "Error al obtener proveedores para validación.");
  }
});


export const getPendingReports = functions.https.onCall(async (data, context) => {
  if (!context.auth /* && !context.auth.token.admin */) {
    throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");
  }

  try {
    const reportsSnapshot = await db.collection("reportes")
      .where("estadoReporte", "==", "pendiente_revision_admin")
      .orderBy("fechaReporte", "asc")
      .get();

    if (reportsSnapshot.empty) {
      return [];
    }
    
    return reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  } catch (error: any) {
    console.error("Error fetching pending reports:", error);
    if (error.code === 'failed-precondition') {
      throw new functions.https.HttpsError("failed-precondition", "La consulta de reportes pendientes requiere un índice compuesto. Por favor, créalo desde el enlace en los logs de Firebase Functions.");
    }
    throw new functions.https.HttpsError("internal", "Error al obtener los reportes pendientes.");
  }
});


export const resolveReport = functions.https.onCall(async (data, context) => {
  if (!context.auth /* && !context.auth.token.admin */) {
    throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");
  }
  const adminId = context.auth.uid;
  const { reporteId, decision, comentarioAdmin } = data;

  if (!reporteId || !decision || !comentarioAdmin) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros: reporteId, decision, comentarioAdmin.");
  }

  const reporteRef = db.collection("reportes").doc(reporteId);
  const now = admin.firestore.Timestamp.now();

  return db.runTransaction(async (transaction) => {
    const reporteDoc = await transaction.get(reporteRef);
    if (!reporteDoc.exists) {
      throw new functions.https.HttpsError("not-found", `Reporte con ID ${reporteId} no encontrado.`);
    }
    const reporteData = reporteDoc.data() as ReporteServicioData;

    transaction.update(reporteRef, {
      estadoReporte: decision,
      resolucionAdmin: comentarioAdmin,
      fechaResolucion: now,
      resueltaPorAdminId: adminId,
    });
    
    // Actualizar también el servicio relacionado
    const servicioRef = db.collection("solicitudes_servicio").doc(reporteData.idServicio);
    transaction.update(servicioRef, {
      estadoDisputa: "resuelta",
      status: "cerrado_con_disputa_resuelta",
      updatedAt: now,
      // Si la decisión es compensar, el pago podría ser reembolsado.
      ...(decision === 'resuelto_compensacion' && { paymentStatus: 'reembolsado_parcial' })
    });

    await logActivity(adminId, "admin", "REPORTE_PROBLEMA_RESUELTO", `Admin resolvió reporte ${reporteId} con decisión: ${decision}.`, { tipo: "reporte_servicio", id: reporteId }, { comentario: comentarioAdmin });
    
    // Notificar a las partes
    await sendNotification(reporteData.idUsuarioReportante, reporteData.rolReportante, "Tu Reporte Ha Sido Resuelto", `Un administrador ha resuelto tu reporte para el servicio #${reporteData.idServicio.substring(0,6)}. Decisión: ${decision}.`);
    await sendNotification(reporteData.idReportado, reporteData.rolReportado, "Un Reporte Sobre Tu Servicio Ha Sido Resuelto", `Un administrador ha resuelto un reporte sobre el servicio #${reporteData.idServicio.substring(0,6)}. Decisión: ${decision}.`);
    
    return { success: true, message: "Reporte resuelto exitosamente." };
  });
});


export const getActiveServices = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");
  }

  try {
    const servicesSnapshot = await db.collection("solicitudes_servicio")
      .where("status", "in", ["agendado", "confirmada_prestador", "pagada", "en_camino_proveedor", "servicio_iniciado"])
      .orderBy("createdAt", "desc")
      .get();

    const services = await Promise.all(servicesSnapshot.docs.map(async (doc) => {
      const serviceData = doc.data() as ServiceRequest;
      const userDoc = await db.collection("usuarios").doc(serviceData.usuarioId).get();
      const providerDoc = await db.collection("prestadores").doc(serviceData.prestadorId).get();

      return {
        id: doc.id,
        status: serviceData.status,
        userName: userDoc.exists() ? userDoc.data()?.nombre : 'Usuario Desconocido',
        providerName: providerDoc.exists() ? providerDoc.data()?.nombre : 'Proveedor Desconocido',
        serviceTitle: serviceData.titulo || 'Servicio sin título',
        scheduledDate: (serviceData.serviceDate && serviceData.serviceTime) ? new Date(`${serviceData.serviceDate}T${serviceData.serviceTime}`).getTime() : (serviceData.createdAt as admin.firestore.Timestamp).toMillis(),
        createdAt: (serviceData.createdAt as admin.firestore.Timestamp).toMillis(),
      };
    }));

    return services;
  } catch (error: any) {
    console.error("Error fetching active services:", error);
    if (error.code === 'failed-precondition') {
      throw new functions.https.HttpsError("failed-precondition", "La consulta de servicios activos requiere un índice compuesto. Por favor, créalo desde el enlace en los logs de Firebase Functions.");
    }
    throw new functions.https.HttpsError("internal", "Error al obtener los servicios activos.");
  }
});


export const adminCancelService = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");
    const adminId = context.auth.uid;
    const { serviceId, reason } = data;

    if (!serviceId || !reason) throw new functions.https.HttpsError("invalid-argument", "Faltan 'serviceId' o 'reason'.");

    const serviceRef = db.collection("solicitudes_servicio").doc(serviceId);
    
    return db.runTransaction(async transaction => {
        const serviceDoc = await transaction.get(serviceRef);
        if (!serviceDoc.exists) throw new functions.https.HttpsError("not-found", "Servicio no encontrado.");

        transaction.update(serviceRef, {
            status: 'cancelada_admin',
            paymentStatus: 'reembolsado_total', // Asumir reembolso completo en cancelación de admin
            actorDelCambioId: adminId,
            actorDelCambioRol: 'admin',
            updatedAt: admin.firestore.Timestamp.now(),
            notes: admin.firestore.FieldValue.arrayUnion(`Cancelado por admin: ${reason}`)
        });

        await logActivity(adminId, "admin", "ADMIN_CANCEL_SERVICE", `Admin canceló servicio ${serviceId}. Razón: ${reason}`, { tipo: "solicitud_servicio", id: serviceId }, { reason });

        const serviceData = serviceDoc.data() as ServiceRequest;
        await sendNotification(serviceData.usuarioId, "usuario", "Servicio Cancelado", `Tu servicio "${serviceData.titulo}" ha sido cancelado por un administrador. Razón: ${reason}`);
        await sendNotification(serviceData.prestadorId, "prestador", "Servicio Cancelado", `El servicio "${serviceData.titulo}" ha sido cancelado por un administrador. Razón: ${reason}`);
        
        return { success: true };
    });
});

export const adminForceCompleteService = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");
    const adminId = context.auth.uid;
    const { serviceId, reason } = data;

    if (!serviceId || !reason) throw new functions.https.HttpsError("invalid-argument", "Faltan 'serviceId' o 'reason'.");

    const serviceRef = db.collection("solicitudes_servicio").doc(serviceId);
    
    return db.runTransaction(async transaction => {
        const serviceDoc = await transaction.get(serviceRef);
        if (!serviceDoc.exists) throw new functions.https.HttpsError("not-found", "Servicio no encontrado.");

        transaction.update(serviceRef, {
            status: 'cerrado_forzado_admin',
            paymentStatus: 'liberado_al_proveedor', // Asumir que se libera el pago
            actorDelCambioId: adminId,
            actorDelCambioRol: 'admin',
            updatedAt: admin.firestore.Timestamp.now(),
            notes: admin.firestore.FieldValue.arrayUnion(`Completado forzosamente por admin: ${reason}`)
        });

        await logActivity(adminId, "admin", "ADMIN_FORCE_COMPLETE_SERVICE", `Admin completó forzosamente el servicio ${serviceId}. Razón: ${reason}`, { tipo: "solicitud_servicio", id: serviceId }, { reason });

        const serviceData = serviceDoc.data() as ServiceRequest;
        await sendNotification(serviceData.usuarioId, "usuario", "Servicio Completado", `Tu servicio "${serviceData.titulo}" ha sido marcado como completado por un administrador.`);
        await sendNotification(serviceData.prestadorId, "prestador", "Servicio Completado y Pago Liberado", `El servicio "${serviceData.titulo}" ha sido completado por un administrador y el pago ha sido liberado.`);
        
        return { success: true };
    });
});


export const getPendingWarranties = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");

    try {
        const snapshot = await db.collection("garantiasPendientes")
            .where("estadoGarantia", "==", "pendiente_revision")
            .orderBy("fechaSolicitudGarantia", "asc")
            .get();

        if (snapshot.empty) return [];
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (error: any) {
        if (error.code === 'failed-precondition') {
            throw new functions.https.HttpsError("failed-precondition", "La consulta de garantías pendientes requiere un índice compuesto. Por favor, créalo.");
        }
        throw new functions.https.HttpsError("internal", "Error al obtener las garantías pendientes.");
    }
});


export const resolveWarranty = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");
    const adminId = context.auth.uid;
    const { garantiaId, decision, notasAdmin } = data;

    if (!garantiaId || !decision || !notasAdmin) {
        throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos.");
    }

    const warrantyRef = db.collection("garantiasPendientes").doc(garantiaId);
    
    return db.runTransaction(async transaction => {
        const warrantyDoc = await transaction.get(warrantyRef);
        if (!warrantyDoc.exists) throw new functions.https.HttpsError("not-found", "Garantía no encontrada.");
        
        const warrantyData = warrantyDoc.data() as GarantiaPendienteData;
        const serviceRef = db.collection("solicitudes_servicio").doc(warrantyData.idServicio);
        
        transaction.update(warrantyRef, {
            estadoGarantia: decision,
            notasResolucion: notasAdmin,
            fechaResolucion: admin.firestore.Timestamp.now(),
            resueltaPorAdminId: adminId
        });

        transaction.update(serviceRef, {
            garantiaActiva: false, // La garantía ya fue procesada
            paymentStatus: decision === 'aprobada_compensacion' ? 'reembolsado_parcial' : 'liberado_al_proveedor'
        });
        
        const logAction = decision === 'aprobada_compensacion' ? "GARANTIA_APROBADA" : "GARANTIA_RECHAZADA";
        await logActivity(adminId, "admin", logAction, `Admin resolvió garantía ${garantiaId} como ${decision}.`, { tipo: "garantia", id: garantiaId });

        await sendNotification(warrantyData.idUsuario, "usuario", "Resolución de Garantía", `Tu solicitud de garantía para el servicio #${warrantyData.idServicio.substring(0,6)} ha sido resuelta como: ${decision}.`);
        
        return { success: true };
    });
});

export const getBanners = functions.https.onCall(async(data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("permission-denied", "Acceso denegado.");

    const { region, idioma, categoria } = data;
    const now = admin.firestore.Timestamp.now();
    
    let query: admin.firestore.Query = db.collection("banners")
      .where("activo", "==", true)
      .where("fechaInicio", "<=", now);
      // No podemos hacer dos < > en campos distintos, el de fechaFin se hará en código.

    // Filtros opcionales que sí se pueden aplicar en la query
    if (idioma) query = query.where("idiomas", "array-contains", idioma);
    if (region) query = query.where("regiones", "array-contains", region);
    if (categoria) query = query.where("categorias", "array-contains", categoria);

    try {
        const snapshot = await query.orderBy("orden", "asc").get();
        const banners = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as BannerPublicitario))
            .filter(banner => !banner.fechaFin || banner.fechaFin >= now); // Filtro final en código

        return banners;
    } catch(error: any) {
        if (error.code === 'failed-precondition') {
            throw new functions.https.HttpsError("failed-precondition", "La consulta de banners requiere uno o más índices compuestos. Por favor, créalos desde los logs de Firebase.");
        }
        throw new functions.https.HttpsError("internal", "Error al obtener banners.");
    }
});
