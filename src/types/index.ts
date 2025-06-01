
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
  | 'pendiente_confirmacion'
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

interface BaseServiceRequest {
  id: string;
  userId: string;
  providerId: string;
  location?: ProviderLocation | { customAddress: string };
  serviceDate: string; // YYYY-MM-DD
  serviceTime: string; // HH:MM
  notes?: string;
  status: ServiceRequestStatus;
  createdAt: number;
  updatedAt?: number;
  fechaFinalizacionEfectiva?: number; // Timestamp of when it reached a terminal state
  providerMarkedCompleteAt?: number;
  userConfirmedCompletionAt?: number;
  ratingWindowExpiresAt?: number;
  calificacionUsuario?: {
    estrellas: number;
    comentario?: string;
    fecha: number;
  };
  calificacionPrestador?: {
    estrellas: number;
    comentario?: string;
    fecha: number;
  };
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
  warrantyEndDate?: string;
  garantiaActiva?: boolean;
  solicitadoPorEmpresaId?: string;
  miembroEmpresaUid?: string;
  titulo?: string;
  originatingQuotationId?: string;
  precio?: number;
  montoCobrado?: number; // Can be used as montoTotalPagadoPorUsuario
  detallesFinancieros?: DetallesFinancieros;
  actorDelCambioId?: string; // Who triggered the last relevant change
  actorDelCambioRol?: 'usuario' | 'prestador' | 'sistema'; // Role of the actor
}

export interface FixedServiceRequest extends BaseServiceRequest {
  serviceType: 'fixed';
  selectedFixedServices?: { serviceId: string, title: string, price: number }[];
  totalAmount?: number;
  // serviceTime is already in BaseServiceRequest
}

export interface HourlyServiceRequest extends BaseServiceRequest {
  serviceType: 'hourly';
  // startTime is serviceTime in BaseServiceRequest
  durationHours: number;
  hourlyRate: number;
  estimatedTotal: number;
  actualStartTime?: number;
  actualEndTime?: number;
  actualDurationHours?: number;
  finalTotal?: number;
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
  | 'ADMIN_ZONA_MODIFICADA';


export interface ActivityLog {
  id?: string;
  actorId: string;
  actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin';
  accion: ActivityLogAction;
  descripcion: string;
  fecha: number; // timestamp
  entidadAfectada?: {
    tipo: 'solicitud_servicio' | 'usuario' | 'prestador' | 'pago' | 'solicitud_cotizacion' | 'chat' | 'promocion_fidelidad' | 'fondo_fidelidad' | 'idioma' | 'recordatorio' | 'zona_preferente';
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

// Loyalty Program Types
export interface FondoFidelidad {
  id?: 'global'; // Singleton document
  totalAcumulado: number;
  // registros?: RegistroFondoFidelidad[]; // Could be a subcollection
}

export interface RegistroFondoFidelidad {
  id?: string;
  servicioId: string;
  montoServicio: number;
  comisionPlataformaCalculada: number;
  montoAportadoAlFondo: number;
  fecha: number; // timestamp
}

export interface PromocionFidelidad {
  id?: string;
  descripcion: string;
  puntosRequeridos: number;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: number;
  activo: boolean;
  codigoPromocional?: string;
  usosDisponibles?: number; // Firestore FieldValue.increment(-1)
  fechaExpiracion?: number; // timestamp
  serviciosAplicables?: string[];
}

// Reminder System Types
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
  fechaProgramada: number; // Timestamp
  enviado: boolean;
  fechaEnvio?: number; // Timestamp
  intentosEnvio?: number;
  errorEnvio?: string;
  datosAdicionales?: {
    tituloServicio?: string;
    nombrePrestador?: string;
    fechaHoraServicioIso?: string; // ISO string for easy formatting
    [key: string]: any; // Allow other relevant data
  };
}

// Preferred Zones Types
export interface Coordenada { // Equivalent to ProviderLocation if needed
  lat: number;
  lng: number;
}

export interface ReglasZona {
  tarifaFactor?: number; // e.g., 1.1 for +10% (applied to base price), 0.9 for -10%
  descuentoAbsoluto?: number; // e.g., 5 for $5 off, applied after factor
  descuentoPorcentual?: number; // e.g., 0.15 for 15% off, applied after factor and absolute
  serviciosRestringidos?: string[]; // Array of service category IDs not available
  serviciosConPrioridad?: string[]; // Array of service category IDs to highlight
  promocionesActivasIds?: string[]; // Specific promotion IDs active in this zone
  mensajeEspecial?: string; // e.g., "¡Estás en una zona con envío gratis!"
  disponibilidadAfectada?: 'restringida_total' | 'restringida_parcial' | 'mejorada' | 'sin_cambio';
}

export interface ZonaPreferente {
  id?: string;
  nombre: string;
  poligono: Coordenada[]; // Array of {lat, lng} defining the polygon vertices in order
  reglas: ReglasZona;
  activa: boolean;
  prioridad?: number; // For overlapping zones, higher number means higher priority
  descripcion?: string; // Optional internal description
}

```