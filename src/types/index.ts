
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

export interface DemoUser {
  id: string;
  isPremium: boolean;
  name: string;
  idiomaPreferido?: 'es' | 'en';
  ubicacionExacta?: ProviderLocation;
  fcmTokens?: string[];
  puntosAcumulados?: number;
  historialPuntos?: HistorialPuntoUsuario[];
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
  fechaLiberacion?: number;
}

interface BaseServiceRequest {
  id: string;
  userId: string;
  providerId: string;
  location?: ProviderLocation | { customAddress: string };
  serviceDate: string;
  notes?: string;
  status: ServiceRequestStatus;
  createdAt: number;
  updatedAt?: number;
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
}

export interface FixedServiceRequest extends BaseServiceRequest {
  serviceType: 'fixed';
  selectedFixedServices?: { serviceId: string, title: string, price: number }[];
  totalAmount?: number; 
  serviceTime: string;
}

export interface HourlyServiceRequest extends BaseServiceRequest {
  serviceType: 'hourly';
  startTime: string;
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
  | 'PAGO_PROCESADO_DETALLES';


export interface ActivityLog {
  id?: string;
  actorId: string;
  actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin';
  accion: ActivityLogAction;
  descripcion: string;
  fecha: number; // timestamp
  entidadAfectada?: {
    tipo: 'solicitud_servicio' | 'usuario' | 'prestador' | 'pago' | 'solicitud_cotizacion' | 'chat' | 'promocion_fidelidad' | 'fondo_fidelidad';
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
  usosDisponibles?: number; 
  fechaExpiracion?: number; 
  serviciosAplicables?: string[]; 
}
