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

export interface HourlyService { // Podríamos usar esto si los proveedores listaran explícitamente "servicios por hora"
  id: string;
  title: string; // e.g., "Tutoría de Matemáticas por Hora"
  description: string;
  category: string;
  providerId: string;
  // hourlyRate se toma del perfil del proveedor
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
  | 'agendado' // Solicitud creada, pendiente de confirmación del proveedor
  | 'confirmado_proveedor' // Proveedor ha confirmado la cita/servicio
  | 'en_camino_proveedor' // Proveedor está en camino
  | 'servicio_iniciado' // Proveedor ha llegado e iniciado el servicio
  | 'completado_proveedor' // Proveedor ha marcado el servicio como completado
  | 'finalizado_usuario' // Usuario ha confirmado la finalización del servicio
  | 'cancelado_usuario'
  | 'cancelado_proveedor'
  | 'en_disputa' // Usuario ha reportado un problema
  | 'cerrado_automaticamente' // Cerrado por el sistema tras periodo de gracia sin acción
  | 'cerrado_con_calificacion' // Ambas partes o una ha calificado, o ventana expiró tras calificación
  | 'cerrado_con_disputa_resuelta'; // Disputa resuelta por admin/sistema

export type PaymentStatus =
  | 'pendiente_confirmacion_usuario' 
  | 'retenido_para_liberacion' 
  | 'liberado_al_proveedor' 
  | 'congelado_por_disputa' 
  | 'reembolsado_parcial'
  | 'reembolsado_total';

// Para claridad, aunque no tengamos un sistema de usuarios completo
export interface DemoUser {
  id: string;
  isPremium: boolean;
  name: string;
}


interface BaseServiceRequest {
  id: string; 
  userId: string; // ID del usuario que solicita
  providerId: string; // ID del proveedor del servicio
  
  location: { lat: number; lng: number } | { customAddress: string }; 
  serviceDate: string; // YYYY-MM-DD.

  notes?: string;
  
  status: ServiceRequestStatus;
  createdAt: number; // Timestamp de creación
  updatedAt?: number; // Timestamp de última actualización

  // Campos relacionados con la finalización y pago
  providerMarkedCompleteAt?: number; 
  userConfirmedCompletionAt?: number; // Timestamp cuando el usuario confirma finalización
  paymentStatus?: PaymentStatus;
  paymentReleasedToProviderAt?: number; 
  
  // Campos relacionados con calificación y disputas
  ratingWindowExpiresAt?: number; // Timestamp cuando expira la ventana para calificar/reclamar
  disputeDetails?: {
    reportedAt: number;
    reason: string;
    resolution?: string;
    resolvedAt?: number;
  };
  warrantyEndDate?: string; // YYYY-MM-DD, fecha hasta la cual aplica la garantía
  
  // Calificaciones
  userRating?: { // Calificación emitida por el usuario hacia el proveedor
    rating: number; // 1-5
    comment?: string;
    ratedAt: number;
  };
  providerRating?: { // Calificación emitida por el proveedor hacia el usuario
    rating: number; // 1-5
    comment?: string;
    ratedAt: number;
  };
  mutualRatingCompleted?: boolean; // True si ambas partes han calificado
}

export interface FixedServiceRequest extends BaseServiceRequest {
  serviceType: 'fixed';
  // Para servicios de precio fijo, se podrían listar los IDs de los servicios seleccionados del perfil del proveedor
  selectedFixedServices?: { serviceId: string, title: string, price: number }[]; 
  totalAmount?: number; // Suma de los precios de selectedFixedServices
  serviceTime: string; // HH:MM - Hora específica para el servicio de precio fijo
}

export interface HourlyServiceRequest extends BaseServiceRequest {
  serviceType: 'hourly';
  startTime: string; // HH:MM - Hora de inicio para el servicio por horas
  durationHours: number; // Duración en horas, puede ser fraccional (ej. 1.5)
  hourlyRate: number; // Tarifa por hora del proveedor al momento de la solicitud
  estimatedTotal: number; // durationHours * hourlyRate
  
  // Opcional: para registrar tiempos reales si el proveedor los ajusta
  actualStartTime?: string; 
  actualEndTime?: string;
  actualDurationHours?: number; 
  finalTotal?: number; // Si la duración real cambia
}

export type ServiceRequest = FixedServiceRequest | HourlyServiceRequest;