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
}

export interface Provider {
  id: string;
  name: string;
  avatarUrl: string;
  dataAiHint?: string;
  rating: number; // Este será el promedio calculado: ratingSum / ratingCount
  ratingCount: number; // Número total de calificaciones recibidas
  ratingSum: number; // Suma de todas las calificaciones recibidas
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
  | 'cerrado_con_disputa_resuelta';

export type PaymentStatus =
  | 'pendiente_confirmacion_usuario' 
  | 'retenido_para_liberacion' 
  | 'liberado_al_proveedor' 
  | 'congelado_por_disputa' 
  | 'reembolsado_parcial'
  | 'reembolsado_total';

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
  warrantyEndDate?: string; 
  userRating?: { // Calificación emitida por el usuario hacia el proveedor
    rating: number;
    comment?: string;
    ratedAt: number;
  };
  providerRating?: { // Calificación emitida por el proveedor hacia el usuario
    rating: number;
    comment?: string;
    ratedAt: number;
  };
  mutualRatingCompleted?: boolean; // True si ambas partes han calificado
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
