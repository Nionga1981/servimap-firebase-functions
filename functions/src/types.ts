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
  | "COTIZACION_PRECIO_PROPUESTO"
  | "COTIZACION_ACEPTADA_USUARIO"
  | "COTIZACION_RECHAZADA"
  | "PUNTOS_FIDELIDAD_GANADOS"
  | "FONDO_FIDELIDAD_APORTE"
  | "PROMO_APLICADA"
  | "NOTIFICACION_RECORDATORIO_PROGRAMADA"
  | "RELACION_USUARIO_PRESTADOR_ACTUALIZADA";

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
