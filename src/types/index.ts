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
  hourlyRate?: boolean; // Indica si este servicio específico se puede contratar por hora, o si el proveedor tiene una tarifa general por hora.
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

// Nuevos estados para ServiceRequest
export type ServiceRequestStatus =
  | 'agendado' // Solicitado por usuario, pendiente de confirmación del proveedor
  | 'confirmado_proveedor' // Proveedor confirmó la cita/servicio
  | 'en_camino_proveedor' // Proveedor está en ruta (para servicios inmediatos u horarios)
  | 'servicio_iniciado' // Servicio ha comenzado (especialmente para servicios por hora)
  | 'completado_proveedor' // Proveedor marcó el servicio como completado
  | 'finalizado_usuario' // Usuario confirmó la finalización del servicio
  | 'cancelado_usuario'
  | 'cancelado_proveedor'
  | 'en_disputa' // Usuario reportó un problema
  | 'cerrado_automaticamente' // Cerrado después del período de gracia sin acción del usuario
  | 'cerrado_con_calificacion' // Cerrado después de que el usuario calificó
  | 'cerrado_con_disputa_resuelta';

export type PaymentStatus =
  | 'pendiente_confirmacion_usuario'
  | 'retenido_para_liberacion'
  | 'liberado_al_proveedor'
  | 'congelado_por_disputa'
  | 'reembolsado_parcial'
  | 'reembolsado_total';

interface BaseServiceRequest {
  // IDs and core info
  id: string; // Será auto-generado por el backend en una app real
  userId: string;
  providerId: string;
  
  // Location and Timing
  location: { lat: number; lng: number } | { custom: string };
  serviceDate: string; // YYYY-MM-DD. Para servicios agendados.

  // Details
  notes?: string;
  
  // Status and Timestamps
  status: ServiceRequestStatus;
  createdAt: number; // Timestamp de creación
  updatedAt?: number; // Timestamp de última actualización

  // Post-completion flow fields
  providerMarkedCompleteAt?: number; // Timestamp cuando el proveedor marca como completado
  userConfirmedCompletionAt?: number; // Timestamp cuando el usuario confirma
  paymentStatus?: PaymentStatus;
  paymentReleasedToProviderAt?: number; // Timestamp de liberación del pago
  ratingWindowExpiresAt?: number; // 7 días (o más para premium) después de userConfirmedCompletionAt
  disputeDetails?: {
    reportedAt: number;
    reason: string;
    resolution?: string;
    resolvedAt?: number;
  };
  warrantyEndDate?: string; // Calculada según el tipo de usuario (premium o no)
  userRating?: {
    rating: number;
    comment?: string;
    ratedAt: number;
  };
  providerRating?: { // Si el proveedor también califica al usuario
    rating: number;
    comment?: string;
    ratedAt: number;
  };
}

export interface FixedServiceRequest extends BaseServiceRequest {
  serviceType: 'fixed';
  // Para servicios de precio fijo, podríamos querer una lista de los items seleccionados
  // si el "Contratar Ahora" permite múltiples servicios de precio fijo.
  selectedFixedServices?: { serviceId: string, title: string, price: number }[];
  totalAmount?: number; // Calculado de selectedFixedServices o un precio fijo único
  serviceTime: string; // HH:MM, hora específica para el servicio de precio fijo
}

export interface HourlyServiceRequest extends BaseServiceRequest {
  serviceType: 'hourly';
  startTime: string; // HH:MM, hora de inicio para servicio por horas
  durationHours: number; // Duración solicitada/acordada inicialmente
  hourlyRate: number; // Tarifa por hora del proveedor en el momento de la solicitud
  estimatedTotal: number; // durationHours * hourlyRate
  
  // Estos podrían ser actualizados por el proveedor si la duración real cambia
  actualStartTime?: string; 
  actualEndTime?: string;
  actualDurationHours?: number; 
  finalTotal?: number; // Calculado con actualDurationHours
}

export type ServiceRequest = FixedServiceRequest | HourlyServiceRequest;

