
// src/types/index.ts
import type { LucideIcon } from 'lucide-react';

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number; // Assuming this is the final service amount paid by user
  category: string;
  imageUrl?: string;
  dataAiHint?: string;
  providerId: string;
  hourlyRate?: never;
}

export interface GalleryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  description?: string;
  dataAiHint?: string;
}

export interface ProviderGallery {
  providerId: string;
  items: GalleryItem[];
}

export interface ProviderLocation {
  lat: number;
  lng: number;
}

export interface Provider {
  id: string;
  name: string;
  avatarUrl: string;
  dataAiHint?: string;
  rating: number;
  ratingCount: number;
  ratingSum: number;
  services: Service[];
  isAvailable: boolean;
  estadoOnline: boolean;
  ubicacionAproximada: ProviderLocation;
  ubicacionExacta?: ProviderLocation;
  currentLocation?: ProviderLocation | null;
  lastConnection?: number;
  specialties?: string[];
  allowsHourlyServices?: boolean;
  hourlyRate?: number;
  idiomasHablados?: string[];
  fcmTokens?: string[];
  aceptaCotizacion?: boolean;
  empresa?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'provider' | 'system';
  text: string;
  timestamp: number;
  isSafe?: boolean;
  safetyReason?: string;
}

export type ServiceRequestStatus =
  | 'agendado'
  | 'pendiente_confirmacion' // Generally implies provider needs to confirm
  | 'pendiente_confirmacion_usuario' // User needs to confirm (e.g., a provider's offer or reactivation)
  | 'confirmada_prestador'
  | 'pagada'
  | 'en_camino_proveedor'
  | 'servicio_iniciado'
  | 'completado_por_prestador'
  | 'completado_por_usuario'
  | 'cancelada_usuario'
  | 'cancelada_prestador'
  | 'rechazada_prestador'
  | 'en_disputa'
  | 'cerrado_automaticamente'
  | 'cerrado_con_calificacion'
  | 'cerrado_con_disputa_resuelta';

export type EstadoFinalServicio =
  | 'cerrado_automaticamente'
  | 'cerrado_con_calificacion'
  | 'cerrado_con_disputa_resuelta'
  | 'cancelada_usuario'
  | 'cancelada_prestador'
  | 'rechazada_prestador';

export type PaymentStatus =
  | 'pendiente_confirmacion_usuario'
  | 'retenido_para_liberacion'
  | 'liberado_al_proveedor'
  | 'congelado_por_disputa'
  | 'reembolsado_parcial'
  | 'reembolsado_total'
  | 'pendiente_cobro'
  | 'procesado_exitosamente'
  | 'fallido'
  | 'no_aplica';

export interface HistorialPuntoUsuario {
  id?: string;
  servicioId?: string;
  promocionId?: string;
  tipo: 'ganados' | 'canjeados';
  puntos: number;
  fecha: number; // timestamp
  descripcion?: string;
}

export interface IdiomaRecursos {
  [key: string]: string;
}

export interface IdiomaDocumento {
  codigo: string;
  nombre: string;
  recursos: IdiomaRecursos;
}

export interface DemoUser {
  id: string;
  isPremium: boolean;
  name: string;
  idiomaPreferido?: 'es' | 'en';
  ubicacionExacta?: ProviderLocation;
  fcmTokens?: string[];
  puntosAcumulados?: number;
  historialPuntos?: HistorialPuntoUsuario[];
  favoritos?: string[]; // Array of provider IDs
}


export interface DetallesFinancieros {
  montoTotalPagadoPorUsuario?: number;
  comisionSistemaPagoPct?: number;
  comisionSistemaPagoMonto?: number;
  montoNetoProcesador?: number;
  comisionAppPct?: number;
  comisionAppMonto?: number;
  aporteFondoFidelidadMonto?: number;
  montoBrutoParaPrestador?: number;
  montoFinalLiberadoAlPrestador?: number;
  fechaLiberacion?: number; // timestamp
}

export interface IndicadoresRendimiento {
  puntualidad?: number; // e.g., 1-5 scale
  calidadServicio?: number; // e.g., 1-5 scale
  comunicacion?: number; // e.g., 1-5 scale
  cumplimientoRequerimientos?: number; // e.g., 1-5 scale
}

export interface CalificacionDetallada {
  estrellas: number;
  comentario?: string;
  fecha: number;
  indicadoresRendimiento?: IndicadoresRendimiento;
  aspectosPositivos?: string[];
  areasDeMejora?: string[];
}

interface BaseServiceRequest {
  id: string;
  userId: string;
  providerId: string;
  location?: ProviderLocation | { customAddress: string };
  serviceDate?: string; // YYYY-MM-DD
  serviceTime?: string; // HH:MM
  notes?: string;
  status: ServiceRequestStatus;
  createdAt: number;
  updatedAt?: number;
  fechaFinalizacionEfectiva?: number; // Timestamp of when it reached a terminal state
  providerMarkedCompleteAt?: number;
  userConfirmedCompletionAt?: number;
  ratingWindowExpiresAt?: number;
  cancellationWindowExpiresAt?: number; // Timestamp until which cancellation is allowed (e.g., 10 mins after confirmation)
  calificacionUsuario?: CalificacionDetallada;
  calificacionPrestador?: CalificacionDetallada;
  mutualRatingCompleted?: boolean;
  paymentStatus?: PaymentStatus;
  paymentIntentId?: string;
  paymentReleasedToProviderAt?: number;
  disputeDetails?: {
    reportedAt: number;
    reason: string;
    resolution?: string;
    resolvedAt?: number;
  };
  reporteActivoId?: string;
  estadoDisputa?: 'ninguna' | 'abierta' | 'resuelta';
  warrantyEndDate?: string;
  garantiaActiva?: boolean;
  solicitadoPorEmpresaId?: string;
  miembroEmpresaUid?: string;
  titulo?: string;
  originatingQuotationId?: string;
  precio?: number;
  montoCobrado?: number;
  detallesFinancieros?: DetallesFinancieros;
  actorDelCambioId?: string;
  actorDelCambioRol?: 'usuario' | 'prestador' | 'sistema';
  originatingServiceId?: string; // ID of the service being reactivated
  isRecurringAttempt?: boolean;  // Flag for reactivated service
  reactivationOfferedBy?: 'usuario' | 'prestador'; // Who initiated this reactivation
  actualStartTime?: number; // Timestamp when service actually started
  actualEndTime?: number; // Timestamp when service actually ended
}

export interface FixedServiceRequest extends BaseServiceRequest {
  serviceType: 'fixed';
  selectedFixedServices?: { serviceId: string, title: string, price: number }[];
  totalAmount?: number;
}

export interface HourlyServiceRequest extends BaseServiceRequest {
  serviceType: 'hourly';
  durationHours: number;
  hourlyRate: number;
  estimatedTotal: number;
  actualDurationHours?: number; // For hourly services, calculated after completion
  finalTotal?: number; // For hourly services, calculated after completion based on actualDurationHours
}

export type ServiceRequest = FixedServiceRequest | HourlyServiceRequest;

export interface Membresia {
  id: string;
  rol: 'usuario' | 'prestador';
  tipoMembresia: string;
  fechaInicio: string;
  fechaExpiracion: string;
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

export interface BannerPublicitario {
  id: string;
  nombre: string;
  imagenUrl: string;
  linkDestino?: string;
  orden: number;
  activo: boolean;
  dataAiHint?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface CategoriaServicio {
  id: string;
  nombre: string;
  iconoUrl: string;
  icon?: LucideIcon;
  keywords: string[];
}

export interface MiembroEmpresa {
  uid: string;
  nombre?: string;
  email?: string;
  rolEnEmpresa?: string;
  activo: boolean;
  fechaAgregado: number;
}

export interface MetodoPagoEmpresa {
  idMetodoPago: string;
  tipo: string;
  ultimosDigitos?: string;
  predeterminado: boolean;
  fechaAgregado: number;
}

export interface EmpresaData {
  id?: string;
  nombreEmpresa: string;
  adminPrincipalUids: string[];
  miembrosAutorizados: MiembroEmpresa[];
  metodosPagoCentralizados?: MetodoPagoEmpresa[];
  configuracionFacturacion?: {
    rfc?: string;
    razonSocial?: string;
    direccionFiscal?: string;
  };
  fechaCreacion: number;
  updatedAt: number;
}

export type ActivityLogAction =
  | 'CAMBIO_ESTADO_SOLICITUD'
  | 'CALIFICACION_USUARIO'
  | 'CALIFICACION_PRESTADOR'
  | 'SOLICITUD_CREADA'
  | 'PAGO_RETENIDO'
  | 'PAGO_LIBERADO'
  | 'GARANTIA_ACTIVADA'
  | 'INICIO_SESION'
  | 'CIERRE_SESION'
  | 'CONFIG_CAMBIADA'
  | 'COTIZACION_CREADA'
  | 'COTIZACION_PRECIO_PROPUESTO'
  | 'COTIZACION_ACEPTADA_USUARIO'
  | 'COTIZACION_RECHAZADA'
  | 'CHAT_CREADO'
  | 'PUNTOS_FIDELIDAD_GANADOS'
  | 'PUNTOS_FIDELIDAD_CANJEADOS'
  | 'FONDO_FIDELIDAD_APORTE'
  | 'PAGO_PROCESADO_DETALLES'
  | 'TRADUCCION_SOLICITADA'
  | 'NOTIFICACION_RECORDATORIO_PROGRAMADA'
  | 'NOTIFICACION_RECORDATORIO_ENVIADA'
  | 'REGLAS_ZONA_CONSULTADAS'
  | 'ADMIN_ZONA_MODIFICADA'
  | 'TICKET_SOPORTE_CREADO'
  | 'TICKET_SOPORTE_ACTUALIZADO'
  | 'BUSQUEDA_PRESTADORES'
  | 'REPORTE_PROBLEMA_CREADO'
  | 'GARANTIA_REGISTRADA'
  | 'SERVICIO_REACTIVADO_SOLICITUD'
  | 'SERVICIO_REACTIVADO_OFERTA'
  | 'SERVICIO_CONFIRMADO_PAGADO'
  | 'SERVICIO_CANCELADO_CON_PENALIZACION'
  | 'SERVICIO_CANCELADO_SIN_PENALIZACION'
  | 'COMUNIDAD_SOLICITUD_UNIRSE'
  | 'COMUNIDAD_USUARIO_UNIDO'
  | 'COMUNIDAD_SOLICITUD_APROBADA'
  | 'COMUNIDAD_SOLICITUD_RECHAZADA'
  | 'COMUNIDAD_USUARIO_EXPULSADO'
  | 'COMUNIDAD_EMBAJADOR_NOTIFICADO_SOLICITUD';


export interface ActivityLog {
  id?: string;
  actorId: string;
  actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin';
  accion: ActivityLogAction;
  descripcion: string;
  fecha: number; // timestamp
  entidadAfectada?: {
    tipo: 'solicitud_servicio' | 'usuario' | 'prestador' | 'pago' | 'solicitud_cotizacion' | 'chat' | 'promocion_fidelidad' | 'fondo_fidelidad' | 'idioma' | 'recordatorio' | 'zona_preferente' | 'ticket_soporte' | 'reporte_servicio' | 'garantia' | 'cancelacion' | 'comunidad';
    id: string;
  };
  detallesAdicionales?: Record<string, any>;
}

export type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador"
  | "precio_propuesto_al_usuario"
  | "rechazada_prestador"
  | "aceptada_por_usuario"
  | "rechazada_usuario"
  | "convertida_a_servicio"
  | "expirada";

export interface SolicitudCotizacion {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  descripcionProblema: string;
  videoUrl?: string;
  estado: SolicitudCotizacionEstado;
  precioSugerido?: number;
  notasPrestador?: string;
  fechaCreacion: number;
  fechaRespuestaPrestador?: number;
  fechaRespuestaUsuario?: number;
  tituloServicio?: string;
  categoriaServicioId?: string;
}

export interface MensajeChat {
  id?: string;
  remitenteId: string;
  texto: string;
  timestamp: number;
  tipo?: "texto" | "imagen" | "video_link";
  urlAdjunto?: string;
  leidoPor?: string[];
}

export interface Chat {
  id?: string;
  solicitudServicioId: string;
  participantesUids: string[];
  participantesInfo?: {
    [uid: string]: { nombre?: string; avatarUrl?: string; rol: 'usuario' | 'prestador' };
  };
  fechaCreacion: number;
  ultimaActualizacion: number;
  ultimoMensaje?: {
    texto: string;
    remitenteId: string;
    timestamp: number;
  };
  estadoChat?: "activo" | "archivado_usuario" | "archivado_prestador" | "finalizado_servicio";
  conteoNoLeido?: {
    [uid: string]: number;
  };
}

export interface FondoFidelidad {
  id?: 'global';
  totalAcumulado: number;
}

export interface RegistroFondoFidelidad {
  id?: string;
  servicioId: string;
  montoServicio: number;
  comisionPlataformaCalculada: number;
  montoAportadoAlFondo: number;
  fecha: number;
}

export interface PromocionFidelidad {
  id?: string;
  descripcion: string;
  puntosRequeridos: number;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: number;
  activo: boolean;
  codigoPromocional?: string;
  usosDisponibles?: number;
  fechaExpiracion?: number;
  serviciosAplicables?: string[];
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
  fechaProgramada: number;
  enviado: boolean;
  fechaEnvio?: number;
  intentosEnvio?: number;
  errorEnvio?: string;
  datosAdicionales?: {
    tituloServicio?: string;
    nombrePrestador?: string;
    fechaHoraServicioIso?: string;
    [key: string]: any;
  };
}

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface ReglasZona {
  tarifaFactor?: number;
  descuentoAbsoluto?: number;
  descuentoPorcentual?: number;
  serviciosRestringidos?: string[];
  serviciosConPrioridad?: string[];
  promocionesActivasIds?: string[];
  mensajeEspecial?: string;
  disponibilidadAfectada?: 'restringida_total' | 'restringida_parcial' | 'mejorada' | 'sin_cambio';
}

export interface ZonaPreferente {
  id?: string;
  nombre: string;
  poligono: Coordenada[];
  reglas: ReglasZona;
  activa: boolean;
  prioridad?: number;
  descripcion?: string;
}

export type EstadoSolicitudSoporte =
  | 'pendiente'
  | 'en_proceso'
  | 'esperando_respuesta_usuario'
  | 'resuelto'
  | 'cerrado';

export interface SoporteTicketData {
  id?: string;
  solicitanteId: string;
  rolSolicitante: 'usuario' | 'prestador';
  categoria: string;
  prioridad?: 'baja' | 'normal' | 'alta' | 'urgente';
  estado: EstadoSolicitudSoporte;
  descripcion: string;
  etiquetas?: string[];
  historialMensajes?: {
    remitenteId: string;
    mensaje: string;
    timestamp: number;
  }[];
  fechaCreacion: number;
  fechaActualizacion: number;
  asignadoA?: string;
  referenciaId?: string;
  adjuntosUrls?: string[];
}

export interface PrestadorBuscado {
  id: string;
  nombre: string;
  empresa?: string;
  distanciaKm: number;
  calificacion: number;
  avatarUrl?: string;
  categoriaPrincipal?: string;
}

export interface ReporteServicio {
  id?: string;
  idServicio: string;
  idUsuarioReportante: string;
  rolReportante: 'usuario' | 'prestador';
  descripcionProblema: string;
  archivoAdjuntoURL?: string;
  fechaReporte: number; // Timestamp
  estadoReporte: 'pendiente_revision_admin' | 'en_investigacion' | 'resuelto_compensacion' | 'resuelto_sin_compensacion' | 'rechazado_reporte';
  idServicioOriginalData?: Partial<ServiceRequest>;
  garantiaActivada?: boolean;
  idGarantiaPendiente?: string;
}

export interface GarantiaPendiente {
  id?: string;
  idServicio: string;
  idUsuario: string;
  idPrestador: string;
  idReporte: string;
  fechaSolicitudGarantia: number; // Timestamp
  estadoGarantia: 'pendiente_revision' | 'aprobada_compensacion' | 'aprobada_re_servicio' | 'rechazada_garantia';
  detallesServicioOriginal?: Partial<ServiceRequest>;
  descripcionProblemaOriginal: string;
  fechaResolucion?: number;
  notasResolucion?: string;
  resueltaPorAdminId?: string;
}

export interface ServicioConfirmado {
  userId: string;
  providerId: string;
  serviceDetails?: string;
  paymentAmount: number;
  status: "confirmado";
  confirmadoEn: number; // timestamp
  puedeCancelarHasta: number; // timestamp
  iniciado: boolean;
}

export interface PagoPendiente {
  userId: string;
  providerId: string;
  paymentAmount: number;
  retenido: boolean;
  status: "esperando_calificacion";
  creadoEn: number; // timestamp
}

export interface Cancelacion {
  serviceId: string;
  actor: 'usuario' | 'prestador';
  penalizacionMonto?: number;
  penalizacionPorcentaje?: number;
  fechaCancelacion: number; // timestamp
  motivo?: string;
}

interface BannerComunitarioDetails {
  titulo: string;
  imagenUrl: string;
  link?: string;
  activo: boolean;
  dataAiHint?: string;
}

export interface Comunidad {
  id?: string; // Firestore document ID
  nombre: string;
  descripcion: string;
  tipo: "publica" | "privada";
  ubicacion: ProviderLocation; // Coordenadas aproximadas de la comunidad
  bannerComunitario: BannerComunitarioDetails;
  embajador_uid: string; // UID del usuario creador/embajador
  miembros: string[]; // Array de UIDs de los miembros
  solicitudesPendientes: string[]; // Array de UIDs de usuarios que quieren unirse (si es privada)
  fechaCreacion: number; // Timestamp
  updatedAt?: number; // Timestamp
  tags?: string[]; // Para búsqueda y categorización
  reglasComunidad?: string; // Texto con las reglas
  lastActivity?: number; // Timestamp de la última actividad relevante
}

export interface RespuestaRecomendacion {
  uid_responde: string;
  prestador_tagged: string; // ID del proveedor etiquetado/recomendado
  timestamp: number; // Timestamp de la respuesta
}

export interface RecomendacionComunidad {
  id?: string; // ID del documento de recomendación
  autor_uid: string; // UID del usuario que publica la recomendación
  texto: string; // El texto de la pregunta o solicitud de recomendación
  timestamp: number; // Timestamp de cuándo se creó la recomendación
  respuestas: RespuestaRecomendacion[]; // Array de respuestas
  estado: "activa" | "cerrada"; // Estado de la solicitud de recomendación
}
