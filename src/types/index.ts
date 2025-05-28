// src/types/index.ts

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number; 
  category: string; 
  imageUrl?: string;
  dataAiHint?: string;
  providerId: string;
  hourlyRate?: never; // Asegura que los servicios de precio fijo no tengan tarifa por hora
}

export interface GalleryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  description?: string;
  dataAiHint?: string; // For image items
}

export interface ProviderGallery {
  providerId: string;
  items: GalleryItem[];
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
  location?: { lat: number; lng: number };
  specialties?: string[];
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: number;
  } | null;
  lastConnection?: number;
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
  | 'agendado' // Usuario agenda, pendiente de confirmación del prestador (para citas)
  | 'pendiente_confirmacion' // Similar a agendado, usado por el flujo de `agendarCitaConPrestador`
  | 'confirmada_prestador' // Prestador confirma la cita
  | 'pagada' // Cita pagada
  | 'en_camino_proveedor'
  | 'servicio_iniciado'
  | 'completado_por_prestador' // Prestador marca como completado
  | 'completado_por_usuario'   // Usuario confirma finalización
  | 'cancelada_usuario'
  | 'cancelada_prestador'
  | 'rechazada_prestador'    // Prestador rechaza la cita
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
  | 'no_aplica'; // Para citas que aún no llegan al punto de cobro

export interface DemoUser {
  id: string;
  isPremium: boolean;
  name: string;
  idiomaPreferido?: 'es' | 'en';
}

interface BaseServiceRequest {
  id: string; 
  userId: string; 
  providerId: string;
  location: { lat: number; lng: number } | { customAddress: string }; 
  serviceDate: string; // YYYY-MM-DD.
  notes?: string;
  status: ServiceRequestStatus;
  createdAt: number; 
  updatedAt?: number;
  providerMarkedCompleteAt?: number; 
  userConfirmedCompletionAt?: number; // Timestamp de cuando el usuario confirma
  paymentStatus?: PaymentStatus;
  paymentIntentId?: string; // ID de la intención de pago (Stripe, etc.)
  paymentReleasedToProviderAt?: number; 
  ratingWindowExpiresAt?: number; // Timestamp de cuando expira la ventana para calificar/disputar
  disputeDetails?: {
    reportedAt: number;
    reason: string;
    resolution?: string;
    resolvedAt?: number;
  };
  warrantyEndDate?: string; // YYYY-MM-DD
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

export interface BannerAd {
  id: string;
  nombre: string; // For admin reference
  imageUrl: string;
  enlaceUrl: string;
  prioridad: number; // Higher number = higher priority
  activo: boolean;
  dataAiHint?: string;
  // Optional scheduling fields
  fechaInicio?: string; // ISO string date
  fechaFin?: string;   // ISO string date
}
