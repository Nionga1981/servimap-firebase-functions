
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
  comunidad_id?: string; // Added for community linking
  activo?: boolean; // Added to mark service as active/inactive (default true)
  fechaCreacion?: number; // Timestamp for "Most Recent" sorting
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
  pais?: string;
}

export interface DocumentoVerificable {
  tipoDocumento: string;
  urlDocumento: string;
  descripcion?: string;
  fechaRegistro: number; // timestamp
  estadoVerificacion: "pendiente" | "verificado_ia" | "rechazado_ia" | "verificado_manual" | "rechazado_manual" | "Validado" | "Rechazado por datos sensibles detectados";
  fechaVerificacion?: number; // timestamp
  motivoRechazoIA?: string;
  palabrasClaveDetectadasIA?: string[];
}

export interface Provider {
  id: string;
  name: string;
  avatarUrl: string;
  logoURL?: string;
  dataAiHint?: string;
  rating: number;
  ratingCount: number;
  ratingSum: number;
  services: Service[];
  isAvailable: boolean; // General availability toggle by provider
  estadoOnline: boolean; // Real-time online status (e.g., sharing location)
  isPremium?: boolean; // Added for premium features check
  ubicacionAproximada: ProviderLocation; // For general display on map before hiring
  ubicacionExacta?: ProviderLocation; // For routing after hiring or if explicitly shared
  currentLocation?: ProviderLocation | null; // Live location if estadoOnline is true
  lastConnection?: number;
  specialties?: string[];
  allowsHourlyServices?: boolean;
  hourlyRate?: number;
  idiomasHablados?: string[];
  fcmTokens?: string[];
  aceptaCotizacion?: boolean;
  aceptaViajes?: boolean;
  aceptaTrabajosVirtuales?: boolean;
  empresa?: string;
  categoryIds?: string[];
  referidoPor?: string;
  documentosVerificables?: DocumentoVerificable[];
  documentosValidos?: boolean;
  comentarioValidacion?: string;
  isBlocked?: boolean;
  blockReason?: string;
  blockDate?: number;
  membresiaExpira?: number;
  type?: 'mobile' | 'fixed'; // Type to differentiate providers
  recommendationCount?: number;
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
  | 'cancelada_admin' // New status for admin intervention
  | 'rechazada_prestador'
  | 'en_disputa'
  | 'cerrado_automaticamente'
  | 'cerrado_con_calificacion'
  | 'cerrado_con_disputa_resuelta'
  | 'cerrado_forzado_admin';

export type EstadoFinalServicio =
  | 'cerrado_automaticamente'
  | 'cerrado_con_calificacion'
  | 'cerrado_con_disputa_resuelta'
  | 'cancelada_usuario'
  | 'cancelada_prestador'
  | 'rechazada_prestador'
  | 'cancelada_admin'
  | 'cerrado_forzado_admin';

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

export interface HistorialComision {
  servicioId: string;
  prestadorId: string;
  montoComision: number;
  fecha: number; // timestamp
}


export interface IdiomaRecursos {
  [key: string]: string;
}

export interface IdiomaDocumento {
  codigo: string;
  nombre: string;
  recursos: IdiomaRecursos;
}

export interface BonificacionData {
  id?: string;
  usuarioId: string; // ID del embajador
  monto: number;
  motivo: 'bono_por_afiliaciones' | 'otro';
  fecha: number; // timestamp
  origen: 'sistema' | 'admin';
  detalles?: {
    umbralAlcanzado?: number;
  };
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
  codigoPropio?: string;
  referidos?: string[];
  gananciasTotales?: number;
  historialComisiones?: HistorialComision[];
  avatarUrl?: string; // Added for past clients list
  isBlocked?: boolean;
  blockReason?: string;
  blockDate?: number;
  bonosRecibidos?: { [key: number]: boolean };
  balanceBonos?: number;
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
  metodoPago?: 'tarjeta' | 'efectivo' | 'transferencia' | 'wallet';
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
  promoAplicada?: {
    codigo: string;
    descripcion: string;
    montoDescuento: number;
  };
  actorDelCambioId?: string;
  actorDelCambioRol?: 'usuario' | 'prestador' | 'sistema' | 'admin';
  originatingServiceId?: string; // ID of the service being reactivated
  isRecurringAttempt?: boolean;  // Flag for reactivated service
  reactivationOfferedBy?: 'usuario' | 'prestador'; // Who initiated this reactivation
  actualStartTime?: number; // Timestamp when service actually started
  actualEndTime?: number; // Timestamp when service actually ended
  category?: string;
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


export type CitaEstado =
  | 'pendiente_confirmacion'
  | 'confirmada_prestador'
  | 'rechazada_prestador'
  | 'cancelada_usuario'
  | 'pagada'
  | 'completada'
  | 'cancelada_prestador'
  | 'servicio_iniciado'
  | 'en_camino_proveedor'
  | 'completado_por_prestador'
  | 'completado_por_usuario';


export interface Cita {
  id?: string;
  usuarioId: string; // Anteriormente cliente_uid
  prestadorId: string; // Anteriormente prestador_uid
  // servicio_id: string; // Si es para un servicio específico del catálogo del proveedor
  fechaHoraSolicitada: number; // Timestamp
  detallesServicio: string; // Descripción del servicio a realizar
  ubicacion?: ProviderLocation | { customAddress: string };
  notasAdicionales?: string;
  estado: CitaEstado;
  fechaCreacion: number; // Timestamp
  updatedAt?: number; // Timestamp

  fechaConfirmacionPrestador?: number | null; // Timestamp
  fechaRechazoPrestador?: number | null; // Timestamp
  ordenCobroId?: string;
  paymentStatus?: PaymentStatus;
  fechaCobro?: number | null; // Timestamp
  montoCobrado?: number | null;

  fechaCancelacion?: number | null; // Timestamp
  canceladaPor?: string; // UID
  rolCancelador?: 'usuario' | 'prestador';
  motivoCancelacion?: string;
  detallesCancelacion?: {
    penalizacionTotalCalculada: number;
    montoParaPlataforma: number;
    montoParaPrestador: number;
    montoReembolsoProgramadoUsuario: number;
    reglaAplicada: '>2h' | '<=2h';
  };

  serviceType?: 'fixed' | 'hourly'; // Tipo de servicio (ej. precio fijo, por horas)
  precioServicio?: number; // Para 'fixed'
  tarifaPorHora?: number; // Para 'hourly'
  duracionHoras?: number; // Para 'hourly'
  montoTotalEstimado?: number; // Calculado: precioServicio o tarifaPorHora * duracionHoras

  permiteSeguimientoDesdeTimestamp?: number; // Timestamp: fechaHoraSolicitada - 2 horas
  notificadoParaEstarEnLinea?: boolean; // Para evitar notificaciones repetidas al proveedor
}


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
  fechaInicio?: number; // timestamp
  fechaFin?: number; // timestamp
  regiones?: string[]; // e.g., ['mx-cul', 'mx-mzt']
  idiomas?: string[]; // e.g., ['es', 'en']
  categorias?: string[]; // e.g., ['plumbing', 'electrical']
}

export interface CategoriaServicio {
  id: string;
  nombre: string;
  iconoUrl: string;
  icon?: LucideIcon;
  keywords: string[];
  isPeriodic?: boolean;
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
  | 'GARANTIA_APROBADA'
  | 'GARANTIA_RECHAZADA'
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
  | 'PROMO_APLICADA'
  | 'TRADUCCION_SOLICITADA'
  | 'NOTIFICACION_RECORDATORIO_PROGRAMADA'
  | 'NOTIFICACION_RECORDATORIO_ENVIADA'
  | 'REGLAS_ZONA_CONSULTADAS'
  | 'ADMIN_ZONA_MODIFICADA'
  | 'TICKET_SOPORTE_CREADO'
  | 'TICKET_SOPORTE_ACTUALIZADO'
  | 'BUSQUEDA_PRESTADORES'
  | 'REPORTE_PROBLEMA_CREADO'
  | 'REPORTE_PROBLEMA_RESUELTO'
  | 'GARANTIA_REGISTRADA'
  | 'SERVICIO_REACTIVADO_SOLICITUD'
  | 'SERVICIO_REACTIVADO_OFERTA'
  | 'SERVICIO_CONFIRMADO_PAGADO'
  | 'SERVICIO_CANCELADO_CON_PENALIZACION' // Para ServiceRequest
  | 'SERVICIO_CANCELADO_SIN_PENALIZACION' // Para ServiceRequest
  | 'COMUNIDAD_SOLICITUD_UNIRSE'
  | 'COMUNIDAD_USUARIO_UNIDO'
  | 'COMUNIDAD_SOLICITUD_APROBADA'
  | 'COMUNIDAD_SOLICITUD_RECHAZADA'
  | 'COMUNIDAD_USUARIO_EXPULSADO'
  | 'COMUNIDAD_EMBAJADOR_NOTIFICADO_SOLICITUD'
  | 'COMUNIDAD_AVISO_CREADO'
  | 'COMUNIDAD_AVISO_ACTUALIZADO'
  | 'COMUNIDAD_AVISO_ELIMINADO'
  | 'COMUNIDAD_NUEVO_AVISO_NOTIFICADO'
  | 'COMUNIDAD_PREGUNTA_PUBLICADA'
  | 'COMUNIDAD_PREGUNTA_RESPUESTA'
  | 'CITA_CREADA'
  | 'CITA_CONFIRMADA_PRESTADOR'
  | 'CITA_RECHAZADA_PRESTADOR'
  | 'CITA_CANCELADA_USUARIO'
  | 'CITA_CANCELADA_USUARIO_PENALIZACION' // Nuevo para Cita
  | 'CITA_PAGO_INICIADO'
  | 'CITA_PAGADA'
  | 'CITA_COMPLETADA'
  | 'CITA_ERROR_PAGO'
  | 'CITA_VENTANA_SEGUIMIENTO_DEFINIDA'
  | 'CITA_PROVEEDOR_NOTIFICADO_ONLINE'
  | 'PROVEEDOR_REGISTRADO'
  | 'CATEGORIA_PROPUESTA'
  | 'CATEGORIA_APROBADA'
  | 'CATEGORIA_RECHAZADA'
  | 'EMBAJADOR_COMISION_PAGADA'
  | 'EMBAJADOR_COMISION_SUSCRIPCION'
  | 'EMBAJADOR_COMISION_AFILIADO'
  | 'EMBAJADOR_BONO_ASIGNADO'
  | 'RELACION_USUARIO_PRESTADOR_ACTUALIZADA'
  | 'RECOMENDACION_RECONTRATACION_CREADA'
  | 'RECONTRATACION_RECORDATORIO_ENVIADO'
  | 'NEGOCIO_RECOMENDADO'
  | 'ADMIN_CANCEL_SERVICE'
  | 'ADMIN_FORCE_COMPLETE_SERVICE'
  | 'ADMIN_BLOCK_USER'
  | 'ADMIN_UNBLOCK_USER'
  | 'PROVIDER_GET_PAST_CLIENTS'
  | 'ADMIN_GET_PROVIDERS_FOR_VALIDATION'
  | 'ADMIN_GET_PENDING_REPORTS'
  | 'ADMIN_GET_ACTIVE_SERVICES'
  | 'ADMIN_GET_PENDING_WARRANTIES'
  | 'ADMIN_GET_BLOCKED_USERS'
  | 'USER_GET_BANNERS';


export interface ActivityLog {
  id?: string;
  actorId: string;
  actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin';
  accion: ActivityLogAction;
  descripcion: string;
  fecha: number; // timestamp
  entidadAfectada?: {
    tipo: 'solicitud_servicio' | 'cita' | 'usuario' | 'prestador' | 'pago' | 'solicitud_cotizacion' | 'chat' | 'promocion_fidelidad' | 'fondo_fidelidad' | 'idioma' | 'recordatorio' | 'zona_preferente' | 'ticket_soporte' | 'reporte_servicio' | 'garantia' | 'cancelacion' | 'comunidad' | 'aviso_comunidad' | 'categoria_propuesta' | 'relacionUsuarioPrestador' | 'recomendacion' | 'preguntaComunidad' | 'recomendacionNegocio' | 'respuestaComunidad';
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
  puntosRequeridos?: number;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: number;
  activo: boolean;
  codigoPromocional: string;
  usosDisponibles?: number;
  fechaExpiracion?: number;
  serviciosAplicables?: string[]; // IDs de categorías
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
  servicioId: string; // Can be serviceId or citaId
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
  distanciaKm?: number;
  calificacion: number;
  avatarUrl?: string;
  categoriaPrincipal?: string;
}

export interface ReporteServicio {
  id?: string;
  idServicio: string;
  idUsuarioReportante: string;
  rolReportante: 'usuario' | 'prestador';
  idReportado: string;
  rolReportado: 'usuario' | 'prestador';
  categoria: string;
  descripcionProblema: string;
  archivoAdjuntoURL?: string;
  fechaReporte: number; // Timestamp
  estadoReporte: 'pendiente_revision_admin' | 'en_investigacion' | 'resuelto_compensacion' | 'resuelto_sin_compensacion' | 'rechazado_reporte';
  idServicioOriginalData?: Partial<ServiceRequest>;
  garantiaActivada?: boolean;
  idGarantiaPendiente?: string;
  resolucionAdmin?: string; // Comentario del admin al resolver
  fechaResolucion?: number; // Timestamp
  resueltaPorAdminId?: string;
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
  id: string; // Firestore document ID
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
  autor_uid: string; // UID del usuario que publica la pregunta o solicitud de recomendación
  texto: string; // El texto de la pregunta o solicitud de recomendación
  timestamp: number; // Timestamp de cuándo se creó la recomendación
  respuestas: RespuestaRecomendacion[]; // Array de respuestas
  estado: "activa" | "cerrada"; // Estado de la solicitud de recomendación
}

export interface AvisoComunidad {
  id?: string; // ID del documento de aviso en Firestore
  titulo: string;
  descripcion: string;
  fechaPublicacion: number; // Timestamp
  activo: boolean;
  anclado: boolean;
  fechaExpiracion?: number; // Timestamp, opcional
  autor_uid: string; // Debe coincidir con el embajador_uid de la comunidad
}

export interface CategoriaPropuesta {
  id?: string;
  providerId: string;
  nombre_categoria_propuesta: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fechaCreacion: number; // timestamp
}

export interface AmbassadorData {
  referidos: { id: string; name: string; avatarUrl?: string }[];
  gananciasTotales: number;
  historialComisiones: (HistorialComision & { providerName?: string })[];
  codigoPropio?: string;
}

export interface RelacionUsuarioPrestador {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  serviciosContratados: number;
  ultimoServicioFecha: number; // timestamp
  categoriasServicios: string[]; // array of category IDs
  lastReminderSent?: number; // timestamp of the last reminder sent by the provider
}

export interface Recomendacion {
  id?: string;
  type: 're-hire-suggestion' | 'endorsement';
  usuarioId: string;
  prestadorId: string;
  fechaCreacion: number;
  categoria?: string;
  mensaje?: string;
  estado?: 'pendiente' | 'vista' | 'aceptada' | 'descartada';
  suggestionSource?: 'sistema' | 'invita-prestador';
}

export interface PastClientInfo {
  usuarioId: string;
  nombreUsuario: string;
  avatarUrl?: string;
  ultimoServicioFecha: number;
  ultimaCategoriaId: string;
  ultimaCategoriaNombre: string;
  serviciosContratados: number;
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
  blockDate?: number; // Timestamp
}

export interface RespuestaPreguntaComunidad {
  id?: string;
  preguntaId: string;
  autorId: string;
  texto: string;
  fecha: number;
  prestadorRecomendadoId?: string;
}

export interface PreguntaComunidad {
  id: string;
  idUsuario: string;
  pregunta: string;
  ubicacion?: ProviderLocation;
  fecha: number;
  respuestasCount?: number;
  tags?: string[];
  // Para enriquecer la UI
  nombreUsuario?: string;
  avatarUsuario?: string;
}

export interface NegocioFijo {
  id?: string;
  nombre: string;
  categoria: string;
  direccion: string;
  ubicacion: ProviderLocation;
  logoURL?: string;
  descripcion?: string;
  fotos?: string[];
  video?: string;
  horarios?: {
    [dia: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };
  contacto?: {
    telefono?: string;
    email?: string;
    website?: string;
    whatsapp?: string;
    facebook?: string;
  };
  activo: boolean;
  embajadorId?: string;
  fechaCreacion: number;
  updatedAt?: number;
  calificacion?: number;
  numCalificaciones?: number;
  isPromotedBusiness?: boolean;
  promotionExpiresAt?: number;
}
    

    

    