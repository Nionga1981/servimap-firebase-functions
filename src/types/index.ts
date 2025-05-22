// src/types/index.ts

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number; // Precio base para servicios fijos, o sin uso si es por hora directamente en el proveedor
  category: string; // Category ID
  imageUrl?: string;
  dataAiHint?: string;
  providerId: string;
  // hourlyRate?: boolean; // Eliminado, la capacidad por hora se define en el proveedor
}

export interface Provider {
  id: string;
  name: string;
  avatarUrl: string;
  dataAiHint?: string;
  rating: number;
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
  allowsHourlyServices?: boolean; // El proveedor ofrece servicios por hora en general
  hourlyRate?: number; // Tarifa general por hora del proveedor
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'provider' | 'system';
  text: string;
  timestamp: number;
  isSafe?: boolean;
  safetyReason?: string;
}

// Estados detallados para ServiceRequest
export type ServiceRequestStatus =
  | 'agendado' // Solicitado por usuario, pendiente de confirmación del proveedor
  | 'confirmado_proveedor' // Proveedor confirmó la cita/servicio
  | 'en_camino_proveedor' // Proveedor está en ruta
  | 'servicio_iniciado' // Servicio ha comenzado
  | 'completado_proveedor' // Proveedor marcó el servicio como completado
  | 'finalizado_usuario' // Usuario confirmó la finalización del servicio (equivalente a "finalizado" desde la perspectiva del usuario)
  | 'cancelado_usuario'
  | 'cancelado_proveedor'
  | 'en_disputa' // Usuario reportó un problema
  | 'cerrado_automaticamente' // Cerrado después del período de gracia sin acción del usuario
  | 'cerrado_con_calificacion' // Cerrado después de que el usuario calificó
  | 'cerrado_con_disputa_resuelta'; // Disputa resuelta

export type PaymentStatus =
  | 'pendiente_confirmacion_usuario' // El pago está pendiente hasta que el usuario confirme el servicio
  | 'retenido_para_liberacion' // Usuario confirmó, pago retenido durante el periodo de gracia/calificación
  | 'liberado_al_proveedor' // Pago liberado al proveedor
  | 'congelado_por_disputa' // Pago congelado debido a una disputa
  | 'reembolsado_parcial'
  | 'reembolsado_total';

interface BaseServiceRequest {
  // IDs and core info
  id: string; 
  userId: string;
  providerId: string;
  
  // Location and Timing
  location: { lat: number; lng: number } | { customAddress: string }; // Ajustado para ser más claro
  serviceDate: string; // YYYY-MM-DD.

  // Details
  notes?: string;
  
  // Status and Timestamps
  status: ServiceRequestStatus;
  createdAt: number; 
  updatedAt?: number; 

  // Post-completion flow fields
  providerMarkedCompleteAt?: number; 
  userConfirmedCompletionAt?: number; // Fecha de confirmación por el usuario
  paymentStatus?: PaymentStatus;
  paymentReleasedToProviderAt?: number; 
  ratingWindowExpiresAt?: number; // 7 días (o más para premium) después de userConfirmedCompletionAt
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
}

export interface FixedServiceRequest extends BaseServiceRequest {
  serviceType: 'fixed';
  selectedFixedServices?: { serviceId: string, title: string, price: number }[]; // Para "Contratar Ahora"
  totalAmount?: number; 
  serviceTime: string; // HH:MM, hora específica para el servicio de precio fijo
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
