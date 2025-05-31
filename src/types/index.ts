
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
  ubicacionAproximada: ProviderLocation; // For browsing
  ubicacionExacta?: ProviderLocation; // For accepted services, could be same as currentLocation
  currentLocation?: ProviderLocation | null; // For real-time updates if available and sharing
  lastConnection?: number;
  specialties?: string[];
  allowsHourlyServices?: boolean;
  hourlyRate?: number;
  idiomasHablados?: string[];
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
  | 'pendiente_confirmacion' // Usuario agenda, pendiente confirmación prestador (para citas)
  | 'confirmada_prestador'   // Prestador confirma, pendiente pago/confirmación usuario (para citas)
  | 'pagada'                 // Cita pagada y confirmada
  | 'en_camino_proveedor'
  | 'servicio_iniciado'
  | 'completado_por_prestador' // Prestador marca como completado
  | 'completado_por_usuario'   // Usuario confirma finalización (equivale a "finalizado")
  | 'cancelada_usuario'
  | 'cancelada_prestador'
  | 'rechazada_prestador'    // Prestador rechaza la cita
  | 'en_disputa'
  | 'cerrado_automaticamente'  // Cerrado por sistema (ej. ventana de calificación expiró)
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
  ubicacionExacta?: ProviderLocation; // User's exact location
}

interface BaseServiceRequest {
  id: string;
  userId: string;
  providerId: string;
  location?: ProviderLocation | { customAddress: string }; // User's location for the service
  serviceDate: string; // YYYY-MM-DD
  notes?: string;
  status: ServiceRequestStatus;
  createdAt: number; // Timestamp
  updatedAt?: number; // Timestamp

  // Fields related to service completion and rating
  providerMarkedCompleteAt?: number; // Timestamp
  userConfirmedCompletionAt?: number; // Timestamp (este es `fechaFinalizado`)
  ratingWindowExpiresAt?: number; // Timestamp (userConfirmedCompletionAt + 7 days)
  
  calificacionUsuario?: {
    estrellas: number; // 1 a 5
    comentario?: string;
    fecha: number; // Timestamp
  };
  calificacionPrestador?: {
    estrellas: number; // 1 a 5
    comentario?: string;
    fecha: number; // Timestamp
  };
  mutualRatingCompleted?: boolean; // True si ambos han calificado

  // Fields related to payment
  paymentStatus?: PaymentStatus;
  paymentIntentId?: string;
  paymentReleasedToProviderAt?: number; // Timestamp

  // Fields related to disputes and warranty
  disputeDetails?: {
    reportedAt: number; // Timestamp
    reason: string;
    resolution?: string;
    resolvedAt?: number; // Timestamp
  };
  warrantyEndDate?: string; // YYYY-MM-DD (calculado basado en premium status y fecha finalización)
  garantiaActiva?: boolean; // Activada automáticamente si no hay calificación y usuario es premium

  // Fields for corporate accounts
  solicitadoPorEmpresaId?: string;
  miembroEmpresaUid?: string;
}

export interface FixedServiceRequest extends BaseServiceRequest {
  serviceType: 'fixed';
  selectedFixedServices?: { serviceId: string, title: string, price: number }[];
  totalAmount?: number;
  serviceTime: string; // HH:MM
}

export interface HourlyServiceRequest extends BaseServiceRequest {
  serviceType: 'hourly';
  startTime: string; // HH:MM
  durationHours: number;
  hourlyRate: number;
  estimatedTotal: number;
  actualStartTime?: number; // Timestamp
  actualEndTime?: number; // Timestamp
  actualDurationHours?: number;
  finalTotal?: number;
}

export type ServiceRequest = FixedServiceRequest | HourlyServiceRequest;

export interface Membresia {
  id: string;
  rol: 'usuario' | 'prestador';
  tipoMembresia: string; // Ej: "premium_mensual_usuario", "gratis_prestador"
  fechaInicio: string; // ISO Date string
  fechaExpiracion: string; // ISO Date string
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
  orden: number; // Lower number = higher priority for display
  activo: boolean;
  dataAiHint?: string;
  fechaInicio?: string; // ISO Date string
  fechaFin?: string; // ISO Date string
}

export interface CategoriaServicio {
  id: string;
  nombre: string;
  iconoUrl: string; // URL to an image for the icon, e.g., from placehold.co or Firebase Storage
  icon?: LucideIcon; // Optional: if we still want to use Lucide for some defaults or in UI
  keywords: string[];
}

// Estructuras para Cuentas Empresariales
export interface MiembroEmpresa {
  uid: string;
  nombre?: string;
  email?: string;
  rolEnEmpresa?: string; // Ej: "Comprador", "Administrador Junior"
  activo: boolean;
  fechaAgregado: number; // Timestamp
}

export interface MetodoPagoEmpresa {
  idMetodoPago: string;
  tipo: string; // Ej: "tarjeta_credito"
  ultimosDigitos?: string;
  predeterminado: boolean;
  fechaAgregado: number; // Timestamp
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
    // ... otros datos fiscales
  };
  fechaCreacion: number; // Timestamp
  updatedAt: number; // Timestamp
}

