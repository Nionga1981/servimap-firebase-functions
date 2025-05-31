
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
  ubicacionExacta?: ProviderLocation; // User's exact location
}

interface BaseServiceRequest {
  id: string;
  userId: string;
  providerId: string;
  location?: ProviderLocation | { customAddress: string }; // User's location for the service
  serviceDate: string;
  notes?: string;
  status: ServiceRequestStatus;
  createdAt: number;
  updatedAt?: number;
  providerMarkedCompleteAt?: number;
  userConfirmedCompletionAt?: number;
  paymentStatus?: PaymentStatus;
  paymentIntentId?: string;
  paymentReleasedToProviderAt?: number;
  ratingWindowExpiresAt?: number;
  disputeDetails?: {
    reportedAt: number;
    reason: string;
    resolution?: string;
    resolvedAt?: number;
  };
  warrantyEndDate?: string;
  userRating?: {
    rating: number;
    comment?: string;
    ratedAt: number;
  };
  providerRating?: {
    rating: number;
    comment?: string;
    ratedAt: number;
  };
  mutualRatingCompleted?: boolean;
  solicitadoPorEmpresaId?: string;
  miembroEmpresaUid?: string;
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
  orden: number; // Lower number = higher priority for display
  activo: boolean;
  dataAiHint?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface CategoriaServicio {
  id: string;
  nombre: string;
  iconoUrl: string; // URL to an image for the icon
  icon?: LucideIcon; // Optional: if we still want to use Lucide for some defaults
  keywords: string[];
}
