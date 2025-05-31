
// src/types/index.ts
import type { LucideIcon } from 'lucide-react';

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  dataAiHint?: string;
  providerId: string;
  hourlyRate?: never; // Ensure this is not present for fixed-price services
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
  isAvailable: boolean; // General availability toggle by provider
  estadoOnline: boolean; // Real-time online status for immediate services
  ubicacionAproximada: ProviderLocation;
  ubicacionExacta?: ProviderLocation;
  currentLocation?: ProviderLocation | null;
  lastConnection?: number;
  specialties?: string[];
  allowsHourlyServices?: boolean;
  hourlyRate?: number;
  idiomasHablados?: string[];
  fcmTokens?: string[];
  aceptaCotizacion?: boolean; // New field for quotations
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

export interface DemoUser {
  id: string;
  isPremium: boolean;
  name: string;
  idiomaPreferido?: 'es' | 'en';
  ubicacionExacta?: ProviderLocation;
  fcmTokens?: string[];
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
  originatingQuotationId?: string; // Link back to quotation if created from one
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
  | 'CHAT_CREADO';

export interface ActivityLog {
  id?: string;
  actorId: string;
  actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin';
  accion: ActivityLogAction;
  descripcion: string;
  fecha: number;
  entidadAfectada?: {
    tipo: 'solicitud_servicio' | 'usuario' | 'prestador' | 'pago' | 'solicitud_cotizacion' | 'chat';
    id: string;
  };
  detallesAdicionales?: Record<string, any>;
}

// --- New Types for Quotation and Chat ---
export type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador" // User submitted, provider needs to review
  | "precio_propuesto_al_usuario" // Provider reviewed, proposed a price, user needs to accept/reject
  | "rechazada_prestador"          // Provider rejected the quote request
  | "aceptada_por_usuario"         // User accepted the proposed price, ready to become service_request
  | "rechazada_usuario"            // User rejected the proposed price
  | "convertida_a_servicio"      // Quotation has been successfully converted to a service_request
  | "expirada";                    // Quotation expired before action was taken

export interface SolicitudCotizacion {
  id?: string; // Firestore auto-ID
  usuarioId: string;
  prestadorId: string;
  descripcionProblema: string; // User's description
  videoUrl?: string; // Optional URL to video in Firebase Storage
  estado: SolicitudCotizacionEstado;
  precioSugerido?: number; // Set by provider
  notasPrestador?: string; // Provider's notes on the quote
  fechaCreacion: number; // Timestamp
  fechaRespuestaPrestador?: number; // Timestamp
  fechaRespuestaUsuario?: number; // Timestamp
  tituloServicio?: string; // e.g., "Cotización para reparación de techo"
  categoriaServicioId?: string; // Optional, if user selected a category
}

export interface MensajeChat {
  id?: string; // Firestore auto-ID
  remitenteId: string; // userId or providerId
  texto: string;
  timestamp: number; // Timestamp
  tipo?: "texto" | "imagen" | "video_link"; // Optional, for rich messages
  urlAdjunto?: string; // Optional, for images/videos
  leidoPor?: string[]; // Array of UIDs who have read the message
}

export interface Chat {
  id?: string; // Can be the solicitudServicioId
  solicitudServicioId: string;
  participantesUids: string[]; // [userId, providerId]
  participantesInfo?: { // Optional, for quicker display of names/avatars
    [uid: string]: { nombre?: string; avatarUrl?: string; rol: 'usuario' | 'prestador' };
  };
  fechaCreacion: number; // Timestamp
  ultimaActualizacion: number; // Timestamp for the last message or status change
  ultimoMensaje?: { // For previews in chat lists
    texto: string;
    remitenteId: string;
    timestamp: number;
  };
  estadoChat?: "activo" | "archivado_usuario" | "archivado_prestador" | "finalizado_servicio";
  conteoNoLeido?: { // Unread count for each participant
    [uid: string]: number;
  };
  // Subcollection: mensajes (MensajeChat[])
}
