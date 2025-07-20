// src/functions/src/types.ts
import * as admin from "firebase-admin";

export interface ProviderLocation {
  lat: number;
  lng: number;
  pais?: string;
}

export interface UserData {
  fcmTokens?: string[];
  nombre?: string;
  isBlocked?: boolean;
  referidoPor?: string;
  membershipLevel?: "gratuito" | "premium";
}

export interface ProviderData {
  fcmTokens?: string[];
  nombre?: string;
  isBlocked?: boolean;
  isAvailable?: boolean;
  currentLocation?: ProviderLocation | null;
  rating?: number;
  avatarUrl?: string;
  categoryIds?: string[];
  referidoPor?: string;
}

export interface CalificacionDetallada {
  estrellas: number;
  comentario?: string;
  fecha: admin.firestore.Timestamp;
}

export interface DetallesFinancieros {
  montoTotalPagadoPorUsuario?: number;
  comisionSistemaPagoPct?: number;
  comisionSistemaPagoMonto?: number;
  montoNetoProcesador?: number;
  comisionAppPct?: number;
  comisionAppMonto?: number;
  aporteFondoFidelidadMonto?: number;
  montoBrutoParaPrestador?: number;
  montoFinalLiberadoAlPrestador?: number;
  fechaLiberacion?: admin.firestore.Timestamp;
}

export interface HistorialPuntoUsuario {
  servicioId?: string;
  promocionId?: string;
  tipo: "ganados" | "canjeados";
  puntos: number;
  fecha: admin.firestore.Timestamp;
  descripcion?: string;
}

export interface PromocionFidelidad {
  id?: string;
  descripcion: string;
  puntosRequeridos?: number;
  tipoDescuento: "porcentaje" | "monto_fijo";
  valorDescuento: number;
  activo: boolean;
  codigoPromocional: string;
  usosDisponibles?: admin.firestore.FieldValue | number;
  fechaExpiracion?: admin.firestore.Timestamp;
  serviciosAplicables?: string[];
}

export interface Recordatorio {
  id?: string;
  usuarioId: string;
  servicioId: string;
  tipo: "recordatorio_servicio";
  mensaje: string;
  fechaProgramada: admin.firestore.Timestamp;
  enviado: boolean;
  datosAdicionales?: {
    tituloServicio?: string;
    nombrePrestador?: string;
    fechaHoraServicioIso?: string;
  };
}

export type ServiceRequestStatus =
  | "agendado"
  | "pendiente_confirmacion_usuario"
  | "confirmada_prestador"
  | "pagada"
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador"
  | "completado_por_usuario"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "cancelada_admin"
  | "rechazada_prestador"
  | "en_disputa"
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta"
  | "cerrado_forzado_admin";

export type EstadoFinalServicio =
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "rechazada_prestador"
  | "cancelada_admin"
  | "cerrado_forzado_admin";

export const ESTADOS_FINALES_SERVICIO: EstadoFinalServicio[] = [
  "cerrado_automaticamente",
  "cerrado_con_calificacion",
  "cerrado_con_disputa_resuelta",
  "cancelada_usuario",
  "cancelada_prestador",
  "rechazada_prestador",
  "cancelada_admin",
  "cerrado_forzado_admin",
];

export type PaymentStatus =
  | "pendiente_confirmacion_usuario"
  | "retenido_para_liberacion"
  | "liberado_al_proveedor"
  | "congelado_por_disputa"
  | "reembolsado_parcial"
  | "reembolsado_total"
  | "pendiente_cobro"
  | "procesado_exitosamente"
  | "fallido"
  | "no_aplica";

export interface ServiceRequest {
  id: string;
  usuarioId: string;
  prestadorId: string;
  status: ServiceRequestStatus;
  createdAt: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  fechaFinalizacionEfectiva?: admin.firestore.Timestamp;
  titulo?: string;
  actorDelCambioId?: string;
  actorDelCambioRol?: "usuario" | "prestador" | "sistema" | "admin";
  calificacionUsuario?: CalificacionDetallada;
  calificacionPrestador?: CalificacionDetallada;
  paymentStatus?: PaymentStatus;
  metodoPago?: "tarjeta" | "efectivo" | "transferencia" | "wallet";
  originatingQuotationId?: string;
  precio?: number;
  montoCobrado?: number;
  paymentReleasedToProviderAt?: admin.firestore.Timestamp;
  detallesFinancieros?: admin.firestore.FieldValue | DetallesFinancieros;
  comisionesCalculadas?: ComisionesCalculadas;
  walletTransactionId?: string;
  paidWithWallet?: boolean;
  noStripeFees?: boolean;
  promoAplicada?: {
    codigo: string;
    descripcion: string;
    montoDescuento: number;
  };
  serviceDate?: string;
  serviceTime?: string;
  serviceType?: "fixed" | "hourly";
  selectedFixedServices?: { serviceId: string; title: string; price: number }[];
  totalAmount?: number;
  originatingServiceId?: string;
  isRecurringAttempt?: boolean;
  reactivationOfferedBy?: "usuario" | "prestador";
  location?: ProviderLocation | { customAddress: string };
  userConfirmedCompletionAt?: number;
  category?: string;
}

export type ActivityLogAction =
  | "CAMBIO_ESTADO_SOLICITUD"
  | "SERVICIO_FINALIZADO"
  | "SERVICIO_CANCELADO"
  | "SERVICIO_EN_DISPUTA"
  | "CALIFICACION_USUARIO"
  | "CALIFICACION_PRESTADOR"
  | "SOLICITUD_CREADA"
  | "PAGO_LIBERADO"
  | "PAGO_INICIADO"
  | "PAGO_COMPLETADO"
  | "REEMBOLSO_PROCESADO"
  | "COTIZACION_PRECIO_PROPUESTO"
  | "COTIZACION_ACEPTADA_USUARIO"
  | "COTIZACION_RECHAZADA"
  | "PUNTOS_FIDELIDAD_GANADOS"
  | "FONDO_FIDELIDAD_APORTE"
  | "PROMO_APLICADA"
  | "NOTIFICACION_RECORDATORIO_PROGRAMADA"
  | "RELACION_USUARIO_PRESTADOR_ACTUALIZADA"
  | "COMISIONES_CALCULADAS"
  | "COMISION_MEMBRESIA_PROCESADA"
  | "WALLET_CREDITO_AGREGADO"
  | "WALLET_DEBITO_REALIZADO"
  | "LOYALTY_BONUS_CALCULATED"
  | "LOYALTY_BONUS_OTORGADO"
  | "WALLET_WITHDRAWAL_INITIATED"
  | "WALLET_WITHDRAWAL_COMPLETED"
  | "WALLET_WITHDRAWAL_FAILED"
  | "WALLET_BALANCE_CONSULTED"
  | "COMISIONES_PROCESADAS_COMPLETAMENTE"
  | "FIXED_BUSINESS_REGISTERED"
  | "BUSINESS_LOCATION_VALIDATED"
  | "BUSINESS_SUBSCRIPTION_PROCESSED"
  | "BUSINESS_SUBSCRIPTION_FAILED"
  | "BUSINESS_PROFILE_UPDATED"
  | "AMBASSADOR_CODE_GENERATED"
  | "REFERRAL_REGISTRATION_TRACKED"
  | "UNIQUE_REGISTRATION_VALIDATED";

export type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador"
  | "precio_propuesto_al_usuario"
  | "rechazada_prestador"
  | "aceptada_por_usuario"
  | "rechazada_usuario"
  | "convertida_a_servicio"
  | "expirada";

export interface SolicitudCotizacionData {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  descripcionProblema: string;
  videoUrl?: string;
  estado: SolicitudCotizacionEstado;
  precioSugerido?: number;
  notasPrestador?: string;
  fechaCreacion: admin.firestore.Timestamp;
  fechaRespuestaPrestador?: admin.firestore.Timestamp;
  fechaRespuestaUsuario?: admin.firestore.Timestamp;
  tituloServicio?: string;
}

export const COMISION_SISTEMA_PAGO_PORCENTAJE = 0.04;
export const COMISION_APP_SERVICIOMAP_PORCENTAJE = 0.06;
export const PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD = 0.1;
export const PORCENTAJE_COMISION_EMBAJADOR = 0.05;
export const FACTOR_CONVERSION_PUNTOS = 10;
export const HORAS_ANTES_RECORDATORIO_SERVICIO = 24;

// Loyalty bonus constants
export const LOYALTY_BONUS_THRESHOLD = 2000; // $2000 USD per bonus
export const LOYALTY_BONUS_AMOUNT = 20; // $20 USD bonus per threshold

// Interfaz unificada para todas las comisiones
export interface Commission {
  id?: string;
  ambassadorId: string;
  type: "service" | "membership";
  sourceId: string; // Service ID o Membership ID
  amount: number;
  percentage: number; // 40%, 50%, 60%, etc.
  status: "pending" | "paid";
  paidAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  // Campos adicionales para compatibilidad y metadata
  metadata?: {
    serviceRequestId?: string;
    membershipType?: MembershipType;
    ambassadorLevel?: "gratuito" | "premium";
    totalAmount?: number;
    originalType?: string;
    providerName?: string;
    [key: string]: any; // Permite campos adicionales
  };
}

// Legacy interface - mantener para compatibilidad durante migración
export interface ComisionData {
  id?: string;
  idUsuarioGanador: string;
  tipo: "servicio_completado" | "servicio_completado_prestador" | "servicio_completado_usuario" | "servicio_completado_ambos";
  monto: number;
  detalle: string;
  fecha: admin.firestore.Timestamp;
  referenciaID: string;
  serviceRequestId?: string;
  totalAmount?: number;
  porcentajeComision?: number;
  embajadorPrestador?: string;
  embajadorUsuario?: string;
  estado?: "pendiente" | "pagada" | "cancelada";
}

export interface ComisionesCalculadas {
  comisionServiMapTotal: number;
  comisionEmbajadorPrestador: number;
  comisionEmbajadorUsuario: number;
  comisionTotalPagada: number;
  comisionServiMapRetenida: number;
  embajadorPrestador?: string;
  embajadorUsuario?: string;
  fechaCalculo: admin.firestore.Timestamp;
}

export type MembershipType = "user_premium" | "fixed_business";

export interface MembershipCommissionData {
  id?: string;
  membershipType: MembershipType;
  amount: number;
  memberId: string;
  ambassadorId: string;
  commissionAmount: number;
  ambassadorLevel: "gratuito" | "premium";
  fecha: admin.firestore.Timestamp;
  referenciaID: string;
  estado?: "pendiente" | "acreditada" | "cancelada";
}

export interface WalletTransaction {
  id?: string;
  userId: string;
  type: "commission" | "bonus" | "payment" | "withdrawal" | "refund" | "withdrawal_fee";
  amount: number;
  description: string;
  sourceId?: string; // Service ID, Membership ID, etc.
  balanceAfter: number;
  createdAt: admin.firestore.Timestamp;
  // Campos adicionales para compatibilidad y debugging
  balanceBefore?: number;
  metadata?: Record<string, unknown>;
}

export interface WalletData {
  // Campos principales (estructura base)
  userId: string;
  balance: number;                 // Saldo actual
  totalEarned: number;             // Total ganado (todos los tipos)
  totalSpent: number;              // Total gastado
  totalWithdrawn: number;          // Total retirado
  bonusesEarned: number;           // Bonos de lealtad ganados
  lastBonusAt?: admin.firestore.Timestamp; // Último bonus otorgado
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  
  // Campos avanzados (breakdown detallado)
  breakdown: {
    totalEarnedFromBonuses: number;     // Parte de totalEarned
    totalEarnedFromCommissions: number; // Parte de totalEarned
    totalEarnedFromRefunds: number;     // Parte de totalEarned
  };
  
  // Límites y configuración
  limits: {
    dailySpendingLimit: number;    // Default: 10000
    withdrawalLimit: number;       // Default: 5000
    dailySpentToday: number;       // Gastado hoy
    lastSpendingDate: string;      // YYYY-MM-DD
    blockedBalance: number;        // Saldo bloqueado
  };
  
  // Información de lealtad
  loyalty: {
    nextThreshold: number;         // 2000, 4000, 6000...
    progressToNext: number;        // Porcentaje 0-100
  };
}

export interface LoyaltyBonusData {
  id?: string;
  userId: string;
  bonusAmount: number;
  thresholdReached: number; // Monto que activó el bonus (ej: $2000)
  totalSpentAtTime: number; // Total gastado al momento del bonus
  fecha: admin.firestore.Timestamp;
  otorgado: boolean;
  walletTransactionId?: string;
  fechaOtorgado?: admin.firestore.Timestamp;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  accountHolderName: string;
  accountType: "checking" | "savings";
  country: string;
  currency: string;
}

export interface WithdrawalData {
  id?: string;
  userId: string;
  amount: number;
  stripeFee: number;
  totalDeducted: number; // amount + stripeFee
  bankDetails: BankDetails;
  stripeTransferId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  fecha: admin.firestore.Timestamp;
  completedAt?: admin.firestore.Timestamp;
  walletTransactionId?: string;
  errorMessage?: string;
}

export interface StripeFeeCalculation {
  baseFee: number;
  percentageFee: number;
  minimumFee: number;
  maximumFee: number;
  country: string;
  currency: string;
}

// Fixed Business System - Estructura Híbrida con Compatibilidad
export interface FixedBusinessData {
  id?: string;
  
  // Campos principales - manteniendo compatibilidad
  businessName: string; // Mantener para compatibilidad
  name?: string; // Nuevo campo opcional
  category: string;
  
  // Ubicación - híbrida para compatibilidad
  location: {
    lat: number;
    lng: number;
    address?: string; // Nuevo campo integrado
    uniqueId?: string; // Nuevo campo para plazas
    isCommercialPlaza?: boolean;
    plazaName?: string;
  };
  address?: string; // Mantener separado para compatibilidad
  uniqueLocationId?: string; // Mantener para compatibilidad
  isCommercialPlaza?: boolean; // Mantener para compatibilidad
  
  // Campos de estado - mantener compatibilidad
  isActive: boolean;
  ambassadorId: string; // Mantener para compatibilidad
  subscriptionStatus: "active" | "payment_pending" | "suspended" | "cancelled";
  
  // Campos de promoción - mantener compatibilidad
  isLaunchPromo?: boolean;
  promoMonths?: number;
  promoEndsAt?: admin.firestore.Timestamp;
  
  // Campos de suscripción - mantener compatibilidad
  monthlyFee?: number;
  nextPaymentDate?: admin.firestore.Timestamp;
  lastPaymentDate?: admin.firestore.Timestamp;
  paymentMethodId?: string;
  
  // Nueva estructura de membresía (opcional)
  membership?: {
    isActive: boolean;
    planType: "monthly";
    amount: number;
    nextPayment: admin.firestore.Timestamp;
    lastPayment?: admin.firestore.Timestamp;
    promoMonths: number;
    registeredBy: string;
    subscriptionStatus: "active" | "payment_pending" | "suspended" | "cancelled";
    paymentMethodId?: string;
  };
  
  // Perfil - mantener estructura existente
  profile?: {
    description?: string;
    photos?: string[];
    video?: string;
    hours?: {
      [day: string]: { open: string; close: string; closed?: boolean };
    };
    contact?: {
      phone?: string;
      email?: string;
      website?: string;
      whatsapp?: string; // Nuevo campo
      facebook?: string; // Nuevo campo
    };
    rating?: number;
    reviewCount?: number;
  };
  
  // Estadísticas nuevas (opcional)
  stats?: {
    views: number;
    clicks: number;
    monthlyViews: number;
    totalCommissions: number;
  };
  
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface BusinessLocationData {
  id?: string;
  lat: number;
  lng: number;
  businessCount: number;
  isCommercialPlaza: boolean;
  plazaName?: string;
  businesses: string[]; // Array of business IDs
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Ambassadors Collection - Estructura Híbrida con Compatibilidad
export interface AmbassadorData {
  id?: string;
  userId: string;
  ambassadorCode: string;
  referralLink: string;
  
  // Compatibilidad - mantener ambos campos
  level?: "gratuito" | "premium"; // Campo existente
  isPremium?: boolean; // Campo nuevo
  isActive: boolean;
  
  createdAt: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  
  // Estadísticas híbridas
  stats: {
    totalReferrals: number;
    activeReferrals?: number; // Nuevo campo
    totalCommissions?: number; // Nuevo campo  
    totalCommissionsEarned?: number; // Campo existente
    monthlyCommissions?: number; // Nuevo campo
    userReferrals: number;
    providerReferrals: number;
    businessReferrals: number;
  };
  
  // Campos de compatibilidad
  assignedBusinesses?: string[]; // Campo existente
  
  // Nueva estructura de referidos (opcional)
  referrals?: {
    users: string[];
    providers: string[];
    businesses: string[];
  };
}

// Referrals Collection - Estructura Individual de Tracking
export interface ReferralData {
  id?: string;
  ambassadorId: string;
  ambassadorCode: string; // Para auditoría
  referredId: string; // ID del usuario/provider/business referido
  referredType: "user" | "provider" | "business";
  status: "active" | "inactive" | "suspended";
  
  // Comisiones tracking
  totalCommissions: number; // Total generado por este referido
  lastCommission?: admin.firestore.Timestamp;
  commissionsThisMonth: number;
  
  // Metadata del referido
  metadata?: {
    name?: string;
    businessName?: string;
    category?: string;
    membershipLevel?: string;
  };
  
  createdAt: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  deactivatedAt?: admin.firestore.Timestamp;
}

// Legacy interface para compatibilidad durante migración
export interface ReferralRegistrationData {
  id?: string;
  ambassadorId: string;
  ambassadorCode: string;
  newUserId: string;
  registrationType: "user" | "provider" | "business";
  createdAt: admin.firestore.Timestamp;
  
  // Metadata
  metadata?: {
    businessId?: string;
    businessName?: string;
    email?: string;
    phone?: string;
    isLaunchPromotion?: boolean;
    immediateCommission?: number;
  };
}

// Business Analytics Collection (nueva)
export interface BusinessAnalyticsData {
  id?: string;
  businessId: string;
  period: string; // YYYY-MM format
  
  // Métricas del período
  views: number;
  clicks: number;
  contactClicks: number;
  phoneClicks: number;
  whatsappClicks: number;
  
  // Performance
  clickThroughRate: number; // CTR
  averageViewDuration: number; // En segundos
  
  // Demográficos
  viewsByHour: Record<string, number>; // "00"-"23"
  topReferrers: string[]; // URLs de referencia
  
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Ambassador Performance Analytics (nueva)
export interface AmbassadorAnalyticsData {
  id?: string;
  ambassadorId: string;
  period: string; // YYYY-MM format
  
  // Métricas del período
  newReferrals: number;
  activeReferrals: number;
  totalCommissions: number;
  avgCommissionPerReferral: number;
  
  // Desglose por tipo
  referralBreakdown: {
    users: number;
    providers: number;
    businesses: number;
  };
  
  // Performance
  conversionRate: number; // % de links que resultan en registro
  retentionRate: number; // % de referidos que siguen activos
  
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Business subscription constants
export const FIXED_BUSINESS_MONTHLY_FEE = 25; // $25 USD
export const BUSINESS_LOCATION_RADIUS = 10; // 10 meters
export const NEARBY_BUSINESS_RADIUS = 2000; // 2km
export const MAX_BUSINESS_PHOTOS = 3;
export const PAYMENT_GRACE_PERIOD_DAYS = 7;

// Launch promotion constants
export const LAUNCH_PROMOTION_PERIOD_END = new Date('2025-04-30T23:59:59Z'); // Fin del período de lanzamiento
export const LAUNCH_PROMO_MONTHS = 3; // 3 meses gratis
export const LAUNCH_PROMO_PAYMENT = 25; // $25 USD pago único
export const LAUNCH_PROMO_AMBASSADOR_COMMISSION = 12.5; // $12.50 USD comisión inmediata (50% de $25)

// Chat and Quotation System Types
export interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
  category: 'labor' | 'materials' | 'other';
  subtotal?: number;
}

export interface CustomQuotationData {
  id?: string;
  chatId: string;
  providerId: string;
  userId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    category: string;
  }>;
  totalAmount: number;
  estimatedTime: string;
  validUntil: admin.firestore.Timestamp;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'negotiating';
  notes?: string;
  counterOffers?: Array<{
    amount: number;
    message?: string;
    timestamp: admin.firestore.Timestamp;
    senderId: string;
  }>;
  createdAt: admin.firestore.Timestamp;
  
  // Campos de compatibilidad
  quotationItems?: QuotationItem[];
  breakdown?: {
    laborTotal: number;
    materialsTotal: number;
    otherTotal: number;
    itemCount: number;
  };
}

export interface ChatData {
  id?: string;
  participantIds: [string, string]; // [userId, providerId]
  serviceRequestId?: string;
  status: 'active' | 'quotation_pending' | 'quotation_sent' | 'completed' | 'closed';
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: admin.firestore.Timestamp;
  };
  hasActiveVideoCall: boolean;
  moderationFlags: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  
  // Campos adicionales para compatibilidad con funciones existentes
  userId?: string; // Helper para acceso rápido
  providerId?: string; // Helper para acceso rápido
  serviceType?: string; // Metadata adicional
}

export interface ChatMessage {
  id?: string;
  chatId: string;
  senderId: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'quotation' | 'system';
  content: string;
  mediaUrls?: string[];
  quotationId?: string;
  isModerated: boolean;
  moderationReason?: string;
  readBy: string[]; // Array de userIds que han leído
  timestamp: admin.firestore.Timestamp;
  
  // Campos de compatibilidad
  message?: string; // Alias para content
  senderType?: 'user' | 'provider' | 'system';
  mediaUrl?: string; // Para un solo archivo
  thumbnailUrl?: string;
}

export interface VideoCallSession {
  id?: string;
  chatId: string;
  roomId: string;
  participantIds: string[];
  status: 'scheduled' | 'active' | 'ended';
  startedAt?: admin.firestore.Timestamp;
  endedAt?: admin.firestore.Timestamp;
  duration?: number; // en segundos
  recordingUrl?: string;
  
  // Campos de compatibilidad
  initiatorId?: string;
  recipientId?: string;
  callLink?: string;
  expiresAt?: admin.firestore.Timestamp;
}

export interface ModerationResult {
  isAllowed: boolean;
  reason?: string;
  warningMessage?: string;
  confidence: number;
  detectedViolations?: string[];
  action?: 'allow' | 'allow_with_warning' | 'temporary_block' | 'suspension';
  severityScore?: number;
  violationDetails?: any[];
}

// Activity log actions for chat system
export type ChatActivityLogAction = 
  | "QUOTATION_CREATED"
  | "QUOTATION_ACCEPTED"
  | "QUOTATION_REJECTED"
  | "QUOTATION_NEGOTIATED"
  | "CHAT_MESSAGE_SENT"
  | "CHAT_MESSAGE_MODERATED"
  | "VIDEO_CALL_INITIATED"
  | "VIDEO_CALL_ENDED"
  | "MEDIA_UPLOADED"
  | "ASYNC_QUOTATION_REQUESTED";

// Constants for chat system
export const MAX_FILE_SIZE_MB = 50; // 50MB max file size
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const SUPPORTED_AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/m4a'];
export const VIDEO_CALL_DURATION_LIMIT = 3600; // 1 hour in seconds
export const QUOTATION_VALIDITY_DAYS = 7; // Quotations valid for 7 days
export const MAX_QUOTATION_ITEMS = 20; // Max items per quotation

// Security and Moderation Types
export interface UserModerationStatus {
  id?: string;
  userId: string;
  status: 'active' | 'temporarily_blocked' | 'suspended' | 'under_review';
  blockedAt?: admin.firestore.Timestamp;
  unblockAt?: admin.firestore.Timestamp;
  suspendedAt?: admin.firestore.Timestamp;
  reason?: string;
  blockType?: 'chat_restriction' | 'platform_ban' | 'service_restriction';
  restrictions?: string[];
  requiresManualReview?: boolean;
  lastUpdated: admin.firestore.Timestamp;
}

export interface ModerationViolation {
  id?: string;
  userId: string;
  chatId: string;
  message: string;
  violations: Array<{
    type: 'phone_number' | 'email' | 'evasion_phrase' | 'physical_address' | 'spam';
    matches: string[];
    severity: number; // 1-3 (low, medium, high)
  }>;
  severityScore: number;
  timestamp: admin.firestore.Timestamp;
  actionTaken?: 'warning' | 'temporary_block' | 'suspension';
  reviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: admin.firestore.Timestamp;
}

export interface RateLimitTracker {
  id?: string;
  userId: string;
  action: 'message' | 'media_upload' | 'quotation' | 'video_call';
  timestamp: admin.firestore.Timestamp;
  rateLimitKey: string;
  metadata?: {
    chatId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface EncryptionKey {
  id?: string;
  keyId: string;
  status: 'active' | 'deprecated' | 'revoked';
  algorithm: string;
  createdAt: admin.firestore.Timestamp;
  deprecatedAt?: admin.firestore.Timestamp;
  revokedAt?: admin.firestore.Timestamp;
  rotationReason?: 'scheduled_rotation' | 'security_breach' | 'manual_rotation';
}

export interface ChatDeletionLog {
  id?: string;
  chatId: string;
  reason: 'auto_cleanup_inactive' | 'user_request' | 'violation_cleanup' | 'manual_admin';
  participantIds: string[];
  lastActivity: admin.firestore.Timestamp;
  messageCount: number;
  deletedAt: admin.firestore.Timestamp;
  deletedBy?: string; // userId if manual deletion
  metadata?: {
    status: string;
    createdAt: admin.firestore.Timestamp;
    hasActiveVideoCall: boolean;
    totalViolations?: number;
  };
}

export interface SecurityAuditReport {
  id?: string;
  period: {
    startDate: string;
    endDate: string;
  };
  generatedAt: number;
  generatedBy?: string;
  
  moderationStats: {
    totalViolations: number;
    violationsByType: Record<string, number>;
    actionsTaken: number;
    actionsByType: Record<string, number>;
    averageSeverityScore: number;
  };
  
  rateLimitStats: {
    totalActions: number;
    actionsByType: Record<string, number>;
    violationsCount: number;
    topViolators?: Array<{
      userId: string;
      violationCount: number;
    }>;
  };
  
  cleanupStats: {
    deletedChats: number;
    deletionReasons: Record<string, number>;
    messagesDeleted: number;
    storageFreed?: number; // in MB
  };
  
  securityHealth: {
    systemStatus: 'operational' | 'degraded' | 'critical';
    lastKeyRotation: admin.firestore.Timestamp | null;
    encryptionStatus: 'active' | 'key_rotation_needed' | 'compromised';
    activeThreats: number;
    resolvedThreats: number;
  };
  
  recommendations?: string[];
  details?: any;
}

export interface ModerationNotification {
  id?: string;
  userId: string;
  type: 'warning' | 'temporary_block' | 'suspension' | 'unblock' | 'account_review';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  actionRequired?: boolean;
  expiresAt?: admin.firestore.Timestamp;
  relatedViolationId?: string;
  createdAt: admin.firestore.Timestamp;
}

export interface AdminAlert {
  id?: string;
  type: 'user_suspended' | 'security_breach' | 'system_error' | 'threshold_exceeded';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedUserId?: string;
  affectedChatId?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  assignedTo?: string;
  escalated?: boolean;
}

// Security Constants
export const MODERATION_SEVERITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
} as const;

export const MODERATION_ACTIONS = {
  ALLOW: 'allow',
  ALLOW_WITH_WARNING: 'allow_with_warning',
  TEMPORARY_BLOCK: 'temporary_block',
  SUSPENSION: 'suspension'
} as const;

export const USER_MODERATION_STATUS = {
  ACTIVE: 'active',
  TEMPORARILY_BLOCKED: 'temporarily_blocked',
  SUSPENDED: 'suspended',
  UNDER_REVIEW: 'under_review'
} as const;

// Rate Limiting Constants
export const RATE_LIMIT_WINDOWS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
} as const;

// Community System Types
export interface CommunityData {
  id?: string;
  name: string;
  description: string;
  type: 'condominio' | 'privada' | 'colonia' | 'expats' | 'sector' | 'corporativo' | 'educativo' | 'otro';
  location: {
    lat: number;
    lng: number;
    address: string;
    radius: number; // Radio en metros
    city: string;
    state: string;
    country: string;
  };
  
  // Configuración de la comunidad
  settings: {
    isPrivate: boolean; // Requiere aprobación para unirse
    allowRecommendations: boolean;
    allowBusinesses: boolean;
    requireVerification: boolean; // Verificar residencia/pertenencia
    maxMembers: number;
    autoApproveRadius: number; // Auto-aprobar dentro de X metros
  };
  
  // Estadísticas
  stats: {
    totalMembers: number;
    activeMembers: number; // Activos últimos 30 días
    totalProviders: number;
    localBusinesses: number;
    recommendationsThisMonth: number;
    averageRating: number;
  };
  
  // Moderación
  moderation: {
    adminIds: string[]; // Administradores de la comunidad
    moderatorIds: string[]; // Moderadores
    rules: string[];
    bannedUsers: string[];
    pendingRequests: number;
  };
  
  // Metadata
  coverImage?: string;
  tags: string[]; // Para búsqueda y categorización
  verified: boolean; // Verificada por ServiMap
  featured: boolean; // Destacada en la app
  createdBy: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  
  // Campos de actividad
  lastActivityAt: admin.firestore.Timestamp;
  popularProviders: string[]; // Top prestadores locales
  trendingServices: string[]; // Servicios más solicitados
}

export interface CommunityMembership {
  id?: string;
  communityId: string;
  userId: string;
  role: 'member' | 'moderator' | 'admin' | 'owner';
  status: 'pending' | 'approved' | 'rejected' | 'banned';
  
  // Información del miembro
  memberInfo: {
    displayName: string;
    profileImage?: string;
    isProvider: boolean;
    isBusinessOwner: boolean;
    categories?: string[]; // Si es prestador
    verifiedResident: boolean;
    joinReason?: string; // Por qué quiere unirse
  };
  
  // Estadísticas del miembro
  memberStats: {
    recommendationsGiven: number;
    recommendationsReceived: number;
    helpfulVotes: number;
    communityScore: number; // Puntuación dentro de la comunidad
    lastActiveAt: admin.firestore.Timestamp;
  };
  
  // Verificación
  verification: {
    method?: 'address' | 'invitation' | 'admin_approval' | 'location_based';
    verifiedBy?: string; // ID del verificador
    verifiedAt?: admin.firestore.Timestamp;
    verificationData?: {
      address?: string;
      invitedBy?: string;
      documents?: string[]; // URLs de documentos
    };
  };
  
  requestedAt: admin.firestore.Timestamp;
  approvedAt?: admin.firestore.Timestamp;
  joinedAt?: admin.firestore.Timestamp;
  leftAt?: admin.firestore.Timestamp;
}

export interface CommunityRecommendation {
  id?: string;
  communityId: string;
  requesterId: string;
  
  // Contenido de la solicitud
  content: {
    title: string;
    description: string;
    category: string;
    urgency: 'low' | 'medium' | 'high' | 'emergency';
    budget?: {
      min: number;
      max: number;
      currency: string;
    };
    location?: {
      lat: number;
      lng: number;
      address: string;
    };
    mediaUrls?: string[]; // Fotos del problema
    preferredTime?: admin.firestore.Timestamp;
  };
  
  // Tags y menciones
  tags: {
    providerIds: string[]; // Prestadores taggeados
    businessIds: string[]; // Negocios taggeados
    serviceCategories: string[];
    keywords: string[];
  };
  
  // Responses y recomendaciones
  responses: Array<{
    responderId: string;
    responderType: 'member' | 'provider' | 'business';
    responseType: 'recommendation' | 'offer' | 'comment';
    content: string;
    recommendedProviderId?: string;
    recommendedBusinessId?: string;
    rating?: number; // Si ha usado el servicio antes
    price?: number;
    availability?: string;
    timestamp: admin.firestore.Timestamp;
    helpfulVotes: number;
    votedBy: string[];
  }>;
  
  // Estado y métricas
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'expired';
  priority: number; // Calculado por algoritmo
  viewCount: number;
  responseCount: number;
  helpfulResponsesCount: number;
  
  // Resolución
  resolution?: {
    resolvedBy: string; // ID del que resolvió
    chosenProvider?: string;
    chosenBusiness?: string;
    satisfactionRating?: number;
    followUpComment?: string;
    resolvedAt: admin.firestore.Timestamp;
  };
  
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  expiresAt?: admin.firestore.Timestamp;
}

export interface CommunityFeedActivity {
  id?: string;
  communityId: string;
  activityType: 'recommendation_posted' | 'recommendation_responded' | 'member_joined' | 'business_verified' | 'provider_featured' | 'community_update';
  
  // Actor de la actividad
  actor: {
    userId: string;
    displayName: string;
    profileImage?: string;
    role: string;
  };
  
  // Contenido específico por tipo
  content: {
    recommendationId?: string;
    recommendationTitle?: string;
    responseContent?: string;
    newMemberName?: string;
    businessName?: string;
    providerName?: string;
    updateDescription?: string;
    category?: string;
  };
  
  // Métricas de engagement
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
    likedBy: string[];
  };
  
  // Visibilidad
  visibility: 'public' | 'members_only' | 'moderators_only';
  featured: boolean;
  pinned: boolean;
  
  createdAt: admin.firestore.Timestamp;
  relevanceScore: number; // Para algoritmo de feed
}

export interface CommunityProvider {
  id?: string;
  communityId: string;
  providerId: string;
  
  // Estado en la comunidad
  status: 'active' | 'featured' | 'suspended' | 'pending_verification';
  priority: number; // Prioridad en búsquedas (1-100)
  
  // Métricas locales
  localMetrics: {
    communityRating: number; // Rating específico de la comunidad
    communityReviews: number;
    jobsCompletedInCommunity: number;
    recommendationsReceived: number;
    responseTime: number; // Tiempo promedio de respuesta
    localExperience: number; // Años trabajando en la zona
  };
  
  // Verificación local
  localVerification: {
    isLocalResident: boolean;
    businessAddress?: string;
    servicesLocalArea: boolean;
    verifiedByMembers: string[]; // IDs de miembros que lo verificaron
    verificationScore: number; // 0-100
  };
  
  // Promoción local
  promotion: {
    isFeatured: boolean;
    featuredUntil?: admin.firestore.Timestamp;
    specialOffers: Array<{
      title: string;
      description: string;
      discount: number;
      validUntil: admin.firestore.Timestamp;
      communityExclusive: boolean;
    }>;
  };
  
  addedAt: admin.firestore.Timestamp;
  lastActiveAt: admin.firestore.Timestamp;
  featuredAt?: admin.firestore.Timestamp;
}

export interface CommunityBusiness {
  id?: string;
  communityId: string;
  businessId: string;
  
  // Estado en la comunidad
  status: 'active' | 'featured' | 'verified' | 'pending' | 'suspended';
  businessType: 'local_business' | 'franchise' | 'chain_store' | 'service_provider';
  
  // Información local
  localInfo: {
    isLocallyOwned: boolean;
    yearsInCommunity: number;
    employeesFromCommunity: number;
    communityInvolvement: string[]; // Eventos, patrocinios, etc.
    preferredByMembers: number; // Miembros que lo prefieren
  };
  
  // Métricas comunitarias
  communityMetrics: {
    communityRating: number;
    communityReviews: number;
    ordersFromCommunity: number;
    recommendationsReceived: number;
    communityDiscountUsage: number;
  };
  
  // Programa "Consume Local"
  consumeLocalProgram: {
    participates: boolean;
    discountForMembers: number; // Porcentaje de descuento
    loyaltyProgram: boolean;
    communityEvents: boolean; // Patrocina/organiza eventos
    localSuppliers: boolean; // Usa proveedores locales
    communityPoints: number; // Puntos ganados por ser local
  };
  
  verifiedAt?: admin.firestore.Timestamp;
  verifiedBy?: string; // ID del verificador
  addedAt: admin.firestore.Timestamp;
  featuredAt?: admin.firestore.Timestamp;
}

export interface CommunityModeration {
  id?: string;
  communityId: string;
  
  // Configuración de moderación
  settings: {
    autoModerationEnabled: boolean;
    requireApprovalForPosts: boolean;
    allowGuestRecommendations: boolean;
    maxRecommendationsPerDay: number;
    bannedWords: string[];
    reportThreshold: number; // Reportes antes de acción automática
  };
  
  // Reportes pendientes
  pendingReports: Array<{
    reportId: string;
    reportedContentId: string;
    reportedContentType: 'recommendation' | 'response' | 'member' | 'business';
    reportedBy: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
    createdAt: admin.firestore.Timestamp;
  }>;
  
  // Acciones tomadas
  moderationActions: Array<{
    actionType: 'warning' | 'post_removal' | 'member_suspension' | 'member_ban';
    targetId: string;
    targetType: 'member' | 'recommendation' | 'response';
    moderatorId: string;
    reason: string;
    duration?: number; // En días para suspensiones
    timestamp: admin.firestore.Timestamp;
  }>;
  
  // Estadísticas
  stats: {
    totalReports: number;
    resolvedReports: number;
    activeModerators: number;
    averageResolutionTime: number; // En horas
    autoModerationAccuracy: number; // Porcentaje
  };
  
  updatedAt: admin.firestore.Timestamp;
}

// Community Activity Log
export interface CommunityActivityLog {
  id?: string;
  communityId: string;
  activityType: 'member_joined' | 'member_left' | 'recommendation_posted' | 'business_added' | 'provider_verified' | 'moderation_action';
  actorId: string;
  targetId?: string; // ID del objeto afectado
  metadata: Record<string, any>;
  timestamp: admin.firestore.Timestamp;
  visibility: 'public' | 'moderators_only' | 'admins_only';
}

// Community Search and Discovery
export interface CommunitySearchIndex {
  id?: string;
  communityId: string;
  searchTerms: string[];
  categories: string[];
  location: {
    lat: number;
    lng: number;
    city: string;
    state: string;
  };
  memberCount: number;
  activityScore: number; // Para ranking en búsquedas
  popularityScore: number;
  updatedAt: admin.firestore.Timestamp;
}

// Constants for Community System
export const COMMUNITY_TYPES = {
  CONDOMINIO: 'condominio',
  PRIVADA: 'privada', 
  COLONIA: 'colonia',
  EXPATS: 'expats',
  SECTOR: 'sector',
  CORPORATIVO: 'corporativo',
  EDUCATIVO: 'educativo',
  OTRO: 'otro'
} as const;

export const COMMUNITY_ROLES = {
  MEMBER: 'member',
  MODERATOR: 'moderator', 
  ADMIN: 'admin',
  OWNER: 'owner'
} as const;

export const RECOMMENDATION_URGENCY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high', 
  EMERGENCY: 'emergency'
} as const;

export const COMMUNITY_LIMITS = {
  MAX_MEMBERS_FREE: 500,
  MAX_MEMBERS_PREMIUM: 5000,
  MAX_RECOMMENDATIONS_PER_DAY: 10,
  MAX_TAGS_PER_RECOMMENDATION: 5,
  RECOMMENDATION_EXPIRY_DAYS: 30,
  MIN_ADMIN_COUNT: 1,
  MAX_ADMIN_COUNT: 10
} as const;

// ============================================
// SISTEMA DE AGENDA Y FUNCIONES PREMIUM
// ============================================

// Agenda y Disponibilidad
export interface ProviderAvailability {
  id?: string;
  providerId: string;
  
  // Horarios regulares
  weeklySchedule: {
    [key: string]: { // 'monday', 'tuesday', etc.
      available: boolean;
      timeSlots: Array<{
        startTime: string; // "09:00"
        endTime: string;   // "17:00"
        maxBookings: number;
      }>;
    };
  };
  
  // Fechas específicas (excepciones)
  dateOverrides: Array<{
    date: admin.firestore.Timestamp;
    available: boolean;
    timeSlots?: Array<{
      startTime: string;
      endTime: string;
      maxBookings: number;
    }>;
    reason?: string; // "Vacaciones", "Emergencia personal"
  }>;
  
  // Configuración
  settings: {
    advanceBookingDays: number; // Máximo días por adelantado
    minimumNoticeHours: number; // Mínimo aviso para citas
    slotDurationMinutes: number; // Duración de cada slot
    allowEmergencyBookings: boolean; // Solo Premium
    timeZone: string;
  };
  
  updatedAt: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
}

export interface ServiceBooking {
  id?: string;
  
  // Participantes
  userId: string;
  providerId: string;
  
  // Servicio
  serviceType: 'immediate' | 'scheduled' | 'recurring' | 'emergency';
  categoryId: string;
  title: string;
  description: string;
  
  // Programación
  scheduledFor: admin.firestore.Timestamp;
  duration: number; // minutos
  timeSlot: {
    startTime: string;
    endTime: string;
  };
  
  // Status
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
  
  // Ubicación
  location: {
    type: 'address' | 'coordinates' | 'virtual';
    address?: string;
    coordinates?: { lat: number; lng: number };
    notes?: string;
  };
  
  // Pricing
  pricing: {
    basePrice: number;
    emergencyFee?: number; // Premium
    recurringDiscount?: number; // Premium
    totalPrice: number;
    currency: string;
  };
  
  // Premium features
  isPremiumService: boolean;
  premiumFeatures?: {
    isEmergency?: boolean;
    isRecurring?: boolean;
    isInternational?: boolean;
  };
  
  // Recurrencia (Premium)
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // cada X días/semanas/meses
    endDate?: admin.firestore.Timestamp;
    maxOccurrences?: number;
  };
  
  // Metadata
  notes?: string;
  attachments?: string[];
  
  // Timestamps
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  confirmedAt?: admin.firestore.Timestamp;
  completedAt?: admin.firestore.Timestamp;
}

export interface RecurringService {
  id?: string;
  parentBookingId: string;
  userId: string;
  providerId: string;
  
  // Configuración de recurrencia
  pattern: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
    dayOfMonth?: number; // Para mensual/anual
    endDate?: admin.firestore.Timestamp;
    maxOccurrences?: number;
  };
  
  // Servicio base
  serviceTemplate: {
    categoryId: string;
    title: string;
    description: string;
    duration: number;
    basePrice: number;
  };
  
  // Status
  isActive: boolean;
  totalBookings: number;
  completedBookings: number;
  
  // Configuración
  settings: {
    autoConfirm: boolean;
    sendReminders: boolean;
    allowRescheduling: boolean;
  };
  
  // Next occurrence
  nextScheduledDate?: admin.firestore.Timestamp;
  
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface EmergencyService {
  id?: string;
  bookingId: string;
  userId: string;
  providerId: string;
  
  // Tipo de emergencia
  emergencyType: 'plumbing' | 'electrical' | 'security' | 'medical' | 'technical' | 'other';
  urgencyLevel: 'high' | 'critical' | 'life_threatening';
  
  // Detalles
  description: string;
  location: {
    address: string;
    coordinates: { lat: number; lng: number };
    accessInstructions?: string;
  };
  
  // Timeline
  requestedAt: admin.firestore.Timestamp;
  responseTime: number; // minutes
  estimatedArrival?: admin.firestore.Timestamp;
  arrivedAt?: admin.firestore.Timestamp;
  resolvedAt?: admin.firestore.Timestamp;
  
  // Status tracking
  status: 'searching' | 'assigned' | 'en_route' | 'on_site' | 'resolved' | 'cancelled';
  
  // Premium pricing
  emergencyFee: number;
  totalCost: number;
  
  // Communication
  updates: Array<{
    timestamp: admin.firestore.Timestamp;
    message: string;
    type: 'system' | 'provider' | 'user';
  }>;
  
  createdAt: admin.firestore.Timestamp;
}

export interface PremiumAnalytics {
  id?: string;
  userId: string;
  
  // Período de análisis
  period: {
    startDate: admin.firestore.Timestamp;
    endDate: admin.firestore.Timestamp;
    type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  };
  
  // Métricas de uso
  usageMetrics: {
    totalServices: number;
    recurringServices: number;
    emergencyServices: number;
    averageServiceCost: number;
    totalSpent: number;
    preferredCategories: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
    preferredProviders: Array<{
      providerId: string;
      providerName: string;
      serviceCount: number;
      averageRating: number;
    }>;
  };
  
  // Análisis predictivo (IA)
  predictions: {
    nextServiceNeeds: Array<{
      category: string;
      probability: number;
      suggestedDate: admin.firestore.Timestamp;
      reason: string;
    }>;
    budgetForecast: {
      nextMonth: number;
      nextQuarter: number;
      seasonalTrends: Array<{
        month: number;
        avgSpending: number;
      }>;
    };
    providerRecommendations: Array<{
      providerId: string;
      providerName: string;
      matchScore: number;
      reasons: string[];
    }>;
  };
  
  // Comparativas
  benchmarks: {
    avgServicesPerUser: number;
    avgSpendingPerUser: number;
    categoryTrends: Array<{
      category: string;
      growthRate: number;
      marketShare: number;
    }>;
  };
  
  // Generado por IA
  insights: Array<{
    type: 'cost_saving' | 'efficiency' | 'trend' | 'recommendation';
    title: string;
    description: string;
    actionable: boolean;
    impact: 'low' | 'medium' | 'high';
  }>;
  
  generatedAt: admin.firestore.Timestamp;
  processingTime: number; // segundos
}

export interface InternationalService {
  id?: string;
  bookingId: string;
  userId: string;
  providerId: string;
  
  // Ubicaciones
  originCountry: string;
  destinationCountry: string;
  serviceCountry: string;
  
  // Tipo de servicio internacional
  serviceType: 'remote_consultation' | 'digital_service' | 'shipping_coordination' | 'travel_service' | 'virtual_support';
  
  // Configuración regional
  regionalSettings: {
    timezone: string;
    currency: string;
    language: string;
    regulations?: string[];
  };
  
  // Precios internacionales
  pricing: {
    basePriceUSD: number;
    exchangeRate: number;
    localPrice: number;
    localCurrency: string;
    internationalFee: number;
    taxes?: Array<{
      name: string;
      amount: number;
      percentage: number;
    }>;
    totalPrice: number;
  };
  
  // Compliance
  compliance: {
    requiredDocuments: string[];
    providedDocuments: string[];
    verificationStatus: 'pending' | 'verified' | 'rejected';
    regulatoryNotes?: string;
  };
  
  // Communication
  communicationChannel: 'video' | 'voice' | 'chat' | 'email';
  translationRequired: boolean;
  translatorAssigned?: string;
  
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Premium Features Configuration
export const PREMIUM_FEATURES = {
  RECURRING_SERVICES: 'recurring_services',
  EMERGENCY_24_7: 'emergency_24_7',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  INTERNATIONAL_SERVICES: 'international_services',
  PRIORITY_SUPPORT: 'priority_support',
  CUSTOM_BRANDING: 'custom_branding'
} as const;

export const PREMIUM_LIMITS = {
  FREE: {
    MAX_MONTHLY_BOOKINGS: 15, // Más generoso para usuarios gratuitos
    MAX_ADVANCE_BOOKING_DAYS: 30, // Permitir booking con más anticipación
    ANALYTICS_HISTORY_MONTHS: 1,
    EMERGENCY_SERVICES: false, // Solo Premium
    RECURRING_SERVICES: false, // Solo Premium
    INTERNATIONAL_SERVICES: false // Solo Premium
  },
  PREMIUM: {
    MAX_MONTHLY_BOOKINGS: 100,
    MAX_ADVANCE_BOOKING_DAYS: 90,
    ANALYTICS_HISTORY_MONTHS: 24,
    EMERGENCY_SERVICES: true,
    RECURRING_SERVICES: true,
    INTERNATIONAL_SERVICES: true
  }
} as const;

export const EMERGENCY_RESPONSE_TIMES = {
  HIGH: 60, // 1 hour
  CRITICAL: 30, // 30 minutes
  LIFE_THREATENING: 15 // 15 minutes
} as const;
