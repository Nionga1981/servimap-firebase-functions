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
  services: Service[]; // Lista de servicios de precio fijo
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
  // gallery?: GalleryItem[]; // Consider fetching gallery separately or embedding a small sample
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
  | 'confirmado_proveedor'
  | 'en_camino_proveedor'
  | 'servicio_iniciado'
  | 'completado_proveedor' 
  | 'finalizado_usuario'
  | 'cancelado_usuario'
  | 'cancelado_proveedor'
  | 'en_disputa'
  | 'cerrado_automaticamente'
  | 'cerrado_con_calificacion'
  | 'cerrado_con_disputa_resuelta'
  | 'pagada'; // Estado después de procesarCobroTrasConfirmacion

export type PaymentStatus =
  | 'pendiente_confirmacion_usuario' 
  | 'retenido_para_liberacion' 
  | 'liberado_al_proveedor' 
  | 'congelado_por_disputa' 
  | 'reembolsado_parcial'
  | 'reembolsado_total'
  | 'pendiente_cobro' // Estado intermedio para citas
  | 'procesado_exitosamente' // Pago de cita procesado
  | 'fallido'; // Fallo en el pago de cita

export interface DemoUser {
  id: string;
  isPremium: boolean;
  name: string;
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
  userConfirmedCompletionAt?: number;
  paymentStatus?: PaymentStatus;
  paymentReleasedToProviderAt?: number; 
  ratingWindowExpiresAt?: number;
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
  actualStartTime?: string; 
  actualEndTime?: string;
  actualDurationHours?: number; 
  finalTotal?: number; 
}

export type ServiceRequest = FixedServiceRequest | HourlyServiceRequest;

export interface Membresia {
  id: string; // Será el UID del usuario o prestador
  rol: 'usuario' | 'prestador';
  tipoMembresia: string; // Ej: "gratis", "premium_mensual_usuario", "premium_anual_prestador"
  fechaInicio: string; // ISO Date string
  fechaExpiracion: string; // ISO Date string
  estadoMembresia: 'activa' | 'vencida' | 'cancelada' | 'pendiente_pago';
  beneficiosAdicionales?: {
    descuentoComisionPorcentaje?: number; // Para prestadores, ej. 3 (para 3%)
    prioridadAgenda?: boolean; // Para usuarios
    garantiaExtendidaDias?: number; // Para usuarios (ej. 7 días extra)
    // otros beneficios...
  };
  stripeSubscriptionId?: string;
  mercadoPagoSubscriptionId?: string;
  ultimoPaymentIntentId?: string;
}
