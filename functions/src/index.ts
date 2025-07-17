
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {ai} from "../../ai/genkit";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- CONSTANTS FOR FINANCIALS & LOYALTY ---
const COMISION_SISTEMA_PAGO_PORCENTAJE = 0.04;
const COMISION_APP_SERVICIOMAP_PORCENTAJE = 0.06;
const PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD = 0.10;
const PORCENTAJE_COMISION_EMBAJADOR = 0.05;
const FACTOR_CONVERSION_PUNTOS = 10;
const HORAS_ANTES_RECORDATORIO_SERVICIO = 24;


// --- INTERFACES (Locally defined for Cloud Functions context) ---
export type ServiceRequestStatus =
  | "agendado"
  | "pendiente_confirmacion"
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

const ESTADOS_FINALES_SERVICIO: EstadoFinalServicio[] = [
  "cerrado_automaticamente", "cerrado_con_calificacion", "cerrado_con_disputa_resuelta",
  "cancelada_usuario", "cancelada_prestador", "rechazada_prestador", "cancelada_admin", "cerrado_forzado_admin",
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

interface IndicadoresRendimiento {
  puntualidad?: number;
  calidadServicio?: number;
  comunicacion?: number;
  cumplimientoRequerimientos?: number;
}

interface CalificacionDetallada {
  estrellas: number;
  comentario?: string;
  fecha: admin.firestore.Timestamp;
  indicadoresRendimiento?: IndicadoresRendimiento;
  aspectosPositivos?: string[];
  areasDeMejora?: string[];
}

interface DetallesFinancieros {
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
export interface HistorialComision {
  servicioId: string;
  prestadorId: string;
  montoComision: number;
  fecha: admin.firestore.Timestamp;
}
export interface UserData {
  fcmTokens?: string[];
  nombre?: string;
  puntosAcumulados?: number;
  historialPuntos?: admin.firestore.FieldValue | HistorialPuntoUsuario[];
  isPremium?: boolean;
  idiomaPreferido?: string;
  favoritos?: string[];
  codigoPropio?: string;
  referidos?: string[];
  gananciasTotales?: number;
  historialComisiones?: admin.firestore.FieldValue | HistorialComision[];
  isBlocked?: boolean;
  blockReason?: string;
  blockDate?: admin.firestore.Timestamp;
  bonosRecibidos?: { [key: number]: boolean };
  balanceBonos?: number;
  referidoPor?: string;
}

interface ProviderLocation {
  lat: number;
  lng: number;
  pais?: string;
}

export interface ProviderData {
  fcmTokens?: string[];
  nombre?: string;
  isPremium?: boolean;
  aceptaCotizacion?: boolean;
  aceptaViajes?: boolean;
  aceptaTrabajosVirtuales?: boolean;
  empresa?: string;
  services?: {category: string; title: string; description: string; price: number}[];
  specialties?: string[];
  isAvailable?: boolean;
  currentLocation?: ProviderLocation | null;
  rating?: number;
  avatarUrl?: string;
  categoryIds?: string[];
  referidoPor?: string;
  isBlocked?: boolean;
  blockReason?: string;
  blockDate?: admin.firestore.Timestamp;
  membresiaExpira?: admin.firestore.Timestamp;
  recommendationCount?: number;
}

export interface ServiceRequest {
  id: string;
  usuarioId: string;
  prestadorId: string;
  status: ServiceRequestStatus;
  createdAt: admin.firestore.Timestamp | number;
  updatedAt?: admin.firestore.Timestamp | number;
  fechaFinalizacionEfectiva?: admin.firestore.Timestamp | number;
  cancellationWindowExpiresAt?: admin.firestore.Timestamp | number;
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
  paymentReleasedToProviderAt?: admin.firestore.Timestamp | number;
  detallesFinancieros?: admin.firestore.FieldValue | DetallesFinancieros;
  promoAplicada?: {
    codigo: string;
    descripcion: string;
    montoDescuento: number;
  };
  serviceDate?: string; // YYYY-MM-DD
  serviceTime?: string; // HH:MM
  reporteActivoId?: string;
  estadoDisputa?: "ninguna" | "abierta" | "resuelta";
  serviceType?: "fixed" | "hourly";
  selectedFixedServices?: {serviceId: string, title: string, price: number}[];
  totalAmount?: number; // For fixed services array
  durationHours?: number; // For hourly services
  hourlyRate?: number; // For hourly services
  estimatedTotal?: number; // For hourly services
  originatingServiceId?: string;
  isRecurringAttempt?: boolean;
  reactivationOfferedBy?: "usuario" | "prestador";
  mutualRatingCompleted?: boolean;
  location?: ProviderLocation | { customAddress: string };
  notes?: string;
  providerMarkedCompleteAt?: number;
  userConfirmedCompletionAt?: number;
  ratingWindowExpiresAt?: number;
  warrantyEndDate?: string;
  garantiaActiva?: boolean;
  solicitadoPorEmpresaId?: string;
  miembroEmpresaUid?: string;
  paymentIntentId?: string;
  disputeDetails?: {reportedAt: number; reason: string; resolution?: string; resolvedAt?: number;};
  actualStartTime?: admin.firestore.Timestamp | number;
  actualEndTime?: admin.firestore.Timestamp | number;
  actualDurationHours?: number;
  finalTotal?: number;
  category?: string;
}

export type SolicitudCotizacionEstado =
  | "pendiente_revision_prestador" | "precio_propuesto_al_usuario"
  | "rechazada_prestador" | "aceptada_por_usuario"
  | "rechazada_usuario" | "convertida_a_servicio" | "expirada";

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

export interface ChatData {
  id?: string;
  solicitudServicioId: string;
  participantesUids: string[];
  participantesInfo?: {
    [uid: string]: {nombre?: string; rol: "usuario" | "prestador"};
  };
  fechaCreacion: admin.firestore.Timestamp;
  ultimaActualizacion?: admin.firestore.Timestamp;
  ultimoMensaje?: {
    texto: string;
    remitenteId: string;
    timestamp: admin.firestore.Timestamp;
  };
  estadoChat?: "activo" | "archivado_usuario" | "archivado_prestador" | "finalizado_servicio";
  conteoNoLeido?: {[uid: string]: number};
}

export type ActivityLogAction =
  | "CAMBIO_ESTADO_SOLICITUD" | "SERVICIO_FINALIZADO" | "SERVICIO_CANCELADO" | "SERVICIO_EN_DISPUTA"
  | "CALIFICACION_USUARIO" | "CALIFICACION_PRESTADOR"
  | "SOLICITUD_CREADA" | "PAGO_RETENIDO" | "PAGO_LIBERADO"
  | "GARANTIA_ACTIVADA" | "GARANTIA_APROBADA" | "GARANTIA_RECHAZADA"
  | "INICIO_SESION" | "CIERRE_SESION"
  | "CONFIG_CAMBIADA" | "COTIZACION_CREADA" | "COTIZACION_PRECIO_PROPUESTO"
  | "COTIZACION_ACEPTADA_USUARIO" | "COTIZACION_RECHAZADA" | "CHAT_CREADO"
  | "PUNTOS_FIDELIDAD_GANADOS" | "PUNTOS_FIDELIDAD_CANJEADOS" | "FONDO_FIDELIDAD_APORTE"
  | "PAGO_PROCESADO_DETALLES" | "PROMO_APLICADA"
  | "TRADUCCION_SOLICITADA"
  | "NOTIFICACION_RECORDATORIO_PROGRAMADA" | "NOTIFICACION_RECORDATORIO_ENVIADA"
  | "REGLAS_ZONA_CONSULTADAS" | "ADMIN_ZONA_MODIFICADA"
  | "TICKET_SOPORTE_CREADO" | "TICKET_SOPORTE_ACTUALIZADO"
  | "BUSQUEDA_PRESTADORES" | "REPORTE_PROBLEMA_CREADO" | "GARANTIA_REGISTRADA"
  | "SERVICIO_REACTIVADO_SOLICITUD" | "SERVICIO_REACTIVADO_OFERTA"
  | "SERVICIO_CONFIRMADO_PAGADO"
  | "SERVICIO_CANCELADO_CON_PENALIZACION"
  | "SERVICIO_CANCELADO_SIN_PENALIZACION"
  | "COMUNIDAD_SOLICITUD_UNIRSE"
  | "COMUNIDAD_USUARIO_UNIDO"
  | "COMUNIDAD_SOLICITUD_APROBADA"
  | "COMUNIDAD_SOLICITUD_RECHAZADA"
  | "COMUNIDAD_USUARIO_EXPULSADO"
  | "COMUNIDAD_EMBAJADOR_NOTIFICADO_SOLICITUD"
  | "COMUNIDAD_AVISO_CREADO"
  | "COMUNIDAD_AVISO_ACTUALIZADO"
  | "COMUNIDAD_AVISO_ELIMINADO"
  | "COMUNIDAD_NUEVO_AVISO_NOTIFICADO"
  | "COMUNIDAD_PREGUNTA_PUBLICADA"
  | "COMUNIDAD_PREGUNTA_RESPUESTA"
  | "CITA_CREADA"
  | "CITA_CONFIRMADA_PRESTADOR"
  | "CITA_RECHAZADA_PRESTADOR"
  | "CITA_CANCELADA_USUARIO"
  | "CITA_CANCELADA_USUARIO_PENALIZACION"
  | "CITA_PAGO_INICIADO"
  | "CITA_PAGADA"
  | "CITA_COMPLETADA"
  | "CITA_ERROR_PAGO"
  | "CITA_VENTANA_SEGUIMIENTO_DEFINIDA"
  | "CITA_PROVEEDOR_NOTIFICADO_ONLINE"
  | "PROVEEDOR_REGISTRADO"
  | "CATEGORIA_PROPUESTA"
  | "CATEGORIA_APROBADA"
  | "CATEGORIA_RECHAZADA"
  | "EMBAJADOR_COMISION_PAGADA"
  | "EMBAJADOR_COMISION_SUSCRIPCION"
  | "EMBAJADOR_COMISION_AFILIADO"
  | "EMBAJADOR_BONO_ASIGNADO"
  | "RELACION_USUARIO_PRESTADOR_ACTUALIZADA"
  | "RECOMENDACION_RECONTRATACION_CREADA"
  | "RECONTRATACION_RECORDATORIO_ENVIADO"
  | "REPORTE_PROBLEMA_RESUELTO"
  | "NEGOCIO_RECOMENDADO"
  | "ADMIN_CANCEL_SERVICE"
  | "ADMIN_FORCE_COMPLETE_SERVICE"
  | "ADMIN_BLOCK_USER"
  | "ADMIN_UNBLOCK_USER"
  | "PROVIDER_GET_PAST_CLIENTS"
  | "ADMIN_GET_PROVIDERS_FOR_VALIDATION"
  | "ADMIN_GET_PENDING_REPORTS"
  | "ADMIN_GET_ACTIVE_SERVICES"
  | "ADMIN_GET_PENDING_WARRANTIES"
  | "ADMIN_GET_BLOCKED_USERS"
  | "USER_GET_BANNERS"
  | "GET_LATEST_APP_VERSION"
  | "SUGERENCIA_ENVIADA"
  | "ARCHIVO_SOPORTE_REGISTRADO"
  | "SOPORTE_LOG_MANUAL"
  | "METRICA_REGISTRADA"
  | "ADMIN_SETTING_UPDATED"
  | "ADMIN_SETTING_READ";

export interface BonificacionData {
  id?: string;
  usuarioId: string; // ID del embajador
  monto: number;
  motivo: "bono_por_afiliaciones" | "otro" | "afiliacion_exitosa";
  fecha: admin.firestore.Timestamp;
  origen: "sistema" | "admin";
  detalles?: {
    umbralAlcanzado?: number;
    afiliadoId?: string;
    origenTexto?: string;
  };
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

export type RecordatorioTipo =
  | "recordatorio_servicio"
  | "alerta_cancelacion"
  | "alerta_cambio_servicio"
  | "alerta_pago_proximo"
  | "alerta_promocion";

export interface Recordatorio {
  id?: string;
  usuarioId: string;
  servicioId: string;
  tipo: RecordatorioTipo;
  mensaje: string;
  fechaProgramada: admin.firestore.Timestamp;
  enviado: boolean;
  fechaEnvio?: admin.firestore.Timestamp;
  intentosEnvio?: number;
  errorEnvio?: string;
  datosAdicionales?: {
    tituloServicio?: string;
    nombrePrestador?: string;
    fechaHoraServicioIso?: string;
    [key: string]: string | number | boolean;
  };
}

export type EstadoSolicitudSoporte =
  | "pendiente"
  | "en_proceso"
  | "esperando_respuesta_usuario"
  | "resuelto"
  | "cerrado";

export interface SoporteTicketData {
  id?: string;
  solicitanteId: string;
  rolSolicitante: "usuario" | "prestador";
  categoria: string;
  prioridad?: "baja" | "normal" | "alta" | "urgente";
  estado: EstadoSolicitudSoporte;
  descripcion: string;
  etiquetas?: string[];
  historialMensajes?: {
    remitenteId: string;
    mensaje: string;
    timestamp: admin.firestore.Timestamp;
  }[];
  fechaCreacion: admin.firestore.Timestamp;
  fechaActualizacion: admin.firestore.Timestamp;
  asignadoA?: string;
  referenciaId?: string; // e.g., servicioId, pagoId
  adjuntosUrls?: string[];
}

export type CitaEstadoFirestore =
  | "pendiente_confirmacion"
  | "confirmada_prestador"
  | "rechazada_prestador"
  | "cancelada_usuario"
  | "pagada"
  | "completada"
  | "cancelada_prestador"
  | "servicio_iniciado"
  | "en_camino_proveedor"
  | "completado_por_prestador"
  | "completado_por_usuario";

export interface CitaDataFirestore {
  id?: string;
  usuarioId: string;
  prestadorId: string;
  fechaHoraSolicitada: admin.firestore.Timestamp;
  detallesServicio: string;
  ubicacion?: ProviderLocation | { customAddress: string };
  notasAdicionales?: string;
  estado: CitaEstadoFirestore;
  fechaCreacion: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  fechaConfirmacionPrestador?: admin.firestore.Timestamp | null;
  fechaRechazoPrestador?: admin.firestore.Timestamp | null;
  ordenCobroId?: string;
  paymentStatus?: PaymentStatus;
  fechaCobro?: admin.firestore.Timestamp | null;
  montoCobrado?: number | null;
  fechaCancelacion?: admin.firestore.Timestamp | null;
  canceladaPor?: string;
  rolCancelador?: "usuario" | "prestador";
  motivoCancelacion?: string;
  detallesCancelacion?: {
    penalizacionTotalCalculada: number;
    montoParaPlataforma: number;
    montoParaPrestador: number;
    montoReembolsoProgramadoUsuario: number;
    reglaAplicada: ">2h" | "<=2h";
  };
  serviceType?: "fixed" | "hourly";
  precioServicio?: number;
  tarifaPorHora?: number;
  duracionHoras?: number;
  montoTotalEstimado?: number;
  permiteSeguimientoDesdeTimestamp?: admin.firestore.Timestamp;
  notificadoParaEstarEnLinea?: boolean;
}

export interface CategoriaPropuestaData {
  id?: string;
  providerId: string;
  nombrePropuesto: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  fechaCreacion: admin.firestore.Timestamp;
}

export interface RelacionUsuarioPrestadorData {
  usuarioId: string;
  prestadorId: string;
  serviciosContratados: number;
  ultimoServicioFecha: admin.firestore.Timestamp;
  categoriasServicios: string[];
  lastReminderSent?: admin.firestore.Timestamp;
}

export interface RecomendacionData {
  id?: string;
  type: "re-hire-suggestion" | "endorsement";
  usuarioId: string;
  prestadorId: string;
  fechaCreacion: admin.firestore.Timestamp;
  categoria?: string;
  mensaje?: string;
  estado?: "pendiente" | "vista" | "aceptada" | "descartada";
  suggestionSource?: "sistema" | "invita-prestador";
}

export interface MonitoredService {
  id: string;
  status: ServiceRequestStatus;
  userName: string;
  providerName: string;
  serviceTitle: string;
  scheduledDate: number; // Timestamp
  createdAt: number; // Timestamp
}

export interface BlockedUser {
  id: string;
  type: "usuario" | "prestador";
  name?: string;
  email?: string; // Add email if available in your user/provider docs
  isBlocked: boolean;
  blockReason?: string;
  blockDate?: admin.firestore.Timestamp;
}

export interface BannerPublicitario {
  id?: string;
  nombre: string;
  imagenUrl: string;
  linkDestino?: string;
  orden: number;
  activo: boolean;
  dataAiHint?: string;
  fechaInicio?: admin.firestore.Timestamp;
  fechaFin?: admin.firestore.Timestamp;
  regiones?: string[];
  idiomas?: string[];
  categorias?: string[];
}

export interface RespuestaPreguntaComunidadData {
  id?: string;
  autorId: string;
  texto: string;
  fecha: admin.firestore.Timestamp;
  prestadorRecomendadoId?: string;
}

export interface PreguntaComunidadData {
  id?: string;
  idUsuario: string;
  pregunta: string;
  ubicacion?: ProviderLocation;
  fecha: admin.firestore.Timestamp;
  respuestas?: RespuestaPreguntaComunidadData[];
  tags?: string[];
}

export interface TransaccionData {
  id?: string;
  usuarioId: string;
  monto: number;
  fecha: admin.firestore.Timestamp;
  detalle?: string;
}

export interface AppVersionData {
  id?: string;
  numeroVersion: string;
  descripcion: string;
  fechaLanzamiento: admin.firestore.Timestamp;
  visible: boolean;
  obligatoria: boolean;
  linkAndroid?: string;
  linkIOS?: string;
}

export interface SugerenciaUsuarioData {
  id?: string;
  usuarioId: string;
  fechaEnvio: admin.firestore.Timestamp;
  tipo: "mejora" | "bug" | "otra";
  mensaje: string;
  atendida: boolean;
}

export interface ArchivoSoporteData {
  id?: string;
  archivoURL: string;
  tipoArchivo: string;
  descripcion?: string;
  subidoPorRef: string;
  fechaSubida: admin.firestore.Timestamp;
}

export interface BitacoraSoporteData {
  id?: string;
  soporteRef: string; // UID del admin/soporte que realizó la acción
  fechaRegistro: admin.firestore.Timestamp;
  accion: string;
  detalle: string;
  entidadAfectada?: {
    tipo: string;
    id: string;
  };
}

export interface MetricaData {
  id?: string;
  evento: string;
  usuarioRef: string;
  fecha: admin.firestore.Timestamp;
  detalle: string;
}

export interface AdminPanelSettingData {
  valor: boolean;
  descripcion: string;
  fechaUltimoCambio: admin.firestore.Timestamp;
}


/**
 * Helper para enviar notificaciones push a un usuario o prestador.
 * @param {string} userId - El UID del destinatario.
 * @param {"usuario" | "prestador"} userType - El tipo de destinatario.
 * @param {string} title - El título de la notificación.
 * @param {string} body - El cuerpo del mensaje de la notificación.
 * @param {Record<string, string>} [data] - Datos adicionales para enviar en el payload.
 * @return {Promise<void>}
 */
async function sendNotification(
  userId: string,
  userType: "usuario" | "prestador",
  title: string,
  body: string,
  data?: {[key: string]: string}
): Promise<void> {
  const userCol = userType === "usuario" ? "usuarios" : "prestadores";
  const userDoc = await db.collection(userCol).doc(userId).get();
  if (!userDoc.exists) {
    functions.logger.error(`[NotificationHelper] ${userType} ${userId} no encontrado.`);
    return;
  }
  const userData = userDoc.data() as (UserData | ProviderData);
  const tokens = userData.fcmTokens;

  if (tokens && tokens.length > 0) {
    const payload = {notification: {title, body}, data};
    try {
      await admin.messaging().sendToDevice(tokens, payload);
      functions.logger.info(`[NotificationHelper] Notificación enviada a ${userType} ${userId}.`);
    } catch (error) {
      functions.logger.error(`[NotificationHelper] Error enviando notificación a ${userType} ${userId}:`, error);
    }
  } else {
    functions.logger.log(`[NotificationHelper] ${userType} ${userId} no tiene tokens FCM.`);
  }
}

/**
 * Registra una acción importante en la bitácora de eventos del sistema.
 * @param {string} actorId - UID del actor que realiza la acción (o 'sistema').
 * @param {"usuario" | "prestador" | "sistema" | "admin"} actorRol - Rol del actor.
 * @param {ActivityLogAction} accion - El tipo de acción realizada.
 * @param {string} descripcion - Descripción legible de la acción.
 * @param {{tipo: string; id: string}} [entidadAfectada] - La entidad principal afectada.
 * @param {Record<string, unknown>} [detallesAdicionales] - Datos extra en formato JSON.
 * @return {Promise<void>}
 */
async function logActivity(
  actorId: string,
  actorRol: "usuario" | "prestador" | "sistema" | "admin",
  accion: ActivityLogAction,
  descripcion: string,
  entidadAfectada?: {tipo: string; id: string},
  detallesAdicionales?: Record<string, unknown>
): Promise<void> {
  try {
    await db.collection("logEventos").add({
      actorId,
      actorRol,
      accion,
      descripcion,
      fecha: admin.firestore.Timestamp.now(),
      entidadAfectada: entidadAfectada || null,
      detallesAdicionales: detallesAdicionales || null,
    });
    functions.logger.info(`[LogActivityHelper] Log creado: ${descripcion}`);
  } catch (error) {
    functions.logger.error(`[LogActivityHelper] Error al crear log: ${descripcion}`, error);
  }
}

// --- START: Genkit Implementation of interpretarBusqueda ---
const interpretarBusquedaInputSchema = z.object({
  searchQuery: z.string().describe("El texto de búsqueda del usuario a analizar."),
});

const interpretarBusquedaOutputSchema = z.object({
  tipo: z.enum(["prestador", "negocio_fijo"]).describe(
    "El tipo de servicio. 'prestador' para servicios móviles/personas, 'negocio_fijo' para locales físicos."
  ),
  categoria: z.string().describe("La categoría del servicio en español y minúsculas (ej: plomería, electricidad)."),
  idiomaDetectado: z.string().describe("El código ISO 639-1 del idioma detectado (ej: es, en)."),
});

const interpretarBusquedaPrompt = ai.definePrompt({
  name: "interpretarBusquedaPrompt",
  input: {schema: interpretarBusquedaInputSchema},
  output: {schema: interpretarBusquedaOutputSchema},
  prompt: `Analiza la siguiente búsqueda de un usuario y clasifícala.
- "tipo": "prestador" si es un servicio móvil o una persona (ej: plomero, jardinero). "negocio_fijo" si es un lugar (ej: taller, consultorio).
- "categoría": Una categoría simple en español y minúsculas (ej: plomería, jardinería).
- "idiomaDetectado": El código ISO 639-1 del idioma.

Texto de búsqueda: {{{searchQuery}}}`,
});

const interpretarBusquedaFlow = ai.defineFlow(
  {
    name: "interpretarBusquedaFlow",
    inputSchema: interpretarBusquedaInputSchema,
    outputSchema: interpretarBusquedaOutputSchema,
  },
  async (input) => {
    const {output} = await interpretarBusquedaPrompt(input);
    if (!output) {
      throw new Error("La respuesta del modelo de IA fue nula.");
    }
    return output;
  }
);

export const interpretarBusqueda = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const {searchQuery} = req.body;
  if (!searchQuery) {
    res.status(400).send("Falta el parámetro 'searchQuery'");
    return;
  }

  try {
    const result = await interpretarBusquedaFlow({searchQuery});
    res.status(200).json(result);
  } catch (error) {
    console.error("Error en el flujo de interpretarBusqueda:", error);
    res.status(500).send("Error al procesar la solicitud.");
  }
});
// --- END: Genkit Implementation of interpretarBusqueda ---


export const createImmediateServiceRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const usuarioId = context.auth.uid;
  const {providerId, selectedServices, totalAmount, location, metodoPago, codigoPromocion} = data;

  if (!providerId || !Array.isArray(selectedServices) || selectedServices.length === 0 ||
      typeof totalAmount !== "number" || !location || !metodoPago) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan parámetros requeridos o son inválidos.");
  }

  const now = admin.firestore.Timestamp.now();
  const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();
  let montoFinal = totalAmount;
  let promoAplicada: ServiceRequest["promoAplicada"] | undefined = undefined;

  // Lógica de Promoción
  if (codigoPromocion && typeof codigoPromocion === "string") {
    const promoQuery = db.collection("promociones").where("codigoPromocional", "==", codigoPromocion).limit(1);
    const promoSnapshot = await promoQuery.get();

    if (promoSnapshot.empty) {
      throw new functions.https.HttpsError("not-found", "El código de promoción no es válido o ha expirado.");
    }

    const promoDoc = promoSnapshot.docs[0];
    const promoData = promoDoc.data() as PromocionFidelidad;

    const promoExpired = promoData.fechaExpiracion && promoData.fechaExpiracion.toMillis() < now.toMillis();
    const noUsesLeft = typeof promoData.usosDisponibles === "number" && promoData.usosDisponibles <= 0;

    if (!promoData.activo || promoExpired || noUsesLeft) {
      throw new functions.https.HttpsError("failed-precondition", "El código de promoción no está activo o ha expirado.");
    }

    let montoDescuento = 0;
    if (promoData.tipoDescuento === "porcentaje") {
      montoDescuento = totalAmount * (promoData.valorDescuento / 100);
    } else { // monto_fijo
      montoDescuento = promoData.valorDescuento;
    }

    montoFinal = Math.max(0, totalAmount - montoDescuento);
    promoAplicada = {
      codigo: codigoPromocion,
      descripcion: promoData.descripcion,
      montoDescuento: montoDescuento,
    };

    if (typeof promoData.usosDisponibles === "number") {
      await promoDoc.ref.update({usosDisponibles: admin.firestore.FieldValue.increment(-1)});
    }
    const desc = `Usuario aplicó promoción "${codigoPromocion}". Descuento: $${montoDescuento.toFixed(2)}`;
    await logActivity(usuarioId, "usuario", "PROMO_APLICADA", desc, {tipo: "solicitud_servicio", id: nuevaSolicitudRef.id}, promoAplicada);
  }

  const providerDoc = await db.collection("prestadores").doc(providerId).get();
  if (!providerDoc.exists) {
    throw new functions.https.HttpsError("not-found", `Proveedor con ID ${providerId} no encontrado.`);
  }

  const providerData = providerDoc.data() as ProviderData;
  if (providerData.isBlocked) {
    throw new functions.https.HttpsError("failed-precondition", "Este proveedor no puede ser contratado en este momento.");
  }
  const userDoc = await db.collection("usuarios").doc(usuarioId).get();
  const userData = userDoc.data() as UserData;
  if (userData.isBlocked) {
    throw new functions.https.HttpsError("failed-precondition", "Tu cuenta está bloqueada y no puedes contratar servicios.");
  }

  const userBlocksProviderQuery = db.collection("bloqueos").where("bloqueadorRef", "==", usuarioId).where("bloqueadoRef", "==", providerId).limit(1);
  const userBlocksProviderSnap = await userBlocksProviderQuery.get();
  if (!userBlocksProviderSnap.empty) {
    throw new functions.https.HttpsError("permission-denied", "No puedes contratar a este proveedor porque lo has bloqueado.");
  }
  const providerBlocksUserQuery = db.collection("bloqueos").where("bloqueadorRef", "==", providerId).where("bloqueadoRef", "==", usuarioId).limit(1);
  const providerBlocksUserSnap = await providerBlocksUserQuery.get();
  if (!providerBlocksUserSnap.empty) {
    throw new functions.https.HttpsError("permission-denied", "No puedes contratar a este proveedor en este momento.");
  }


  const nuevaSolicitudData: Omit<ServiceRequest, "id" | "serviceType"> & { serviceType: "fixed" } = {
    usuarioId: usuarioId,
    prestadorId: providerId,
    status: "pagada",
    createdAt: now,
    updatedAt: now,
    titulo: `Servicio inmediato: ${selectedServices.map((s: {title: string}) => s.title).join(", ")}`,
    serviceType: "fixed",
    selectedFixedServices: selectedServices,
    totalAmount: totalAmount,
    montoCobrado: montoFinal,
    location: location,
    metodoPago: metodoPago,
    paymentStatus: "retenido_para_liberacion",
    actorDelCambioId: usuarioId,
    actorDelCambioRol: "usuario",
    ...(promoAplicada && {promoAplicada}),
  };

  await nuevaSolicitudRef.set(nuevaSolicitudData);

  const logDesc = `Usuario ${usuarioId} creó y pagó una solicitud #${nuevaSolicitudRef.id} para ${providerId}. Total: $${montoFinal.toFixed(2)}.`;
  await logActivity(
    usuarioId, "usuario", "SOLICITUD_CREADA", logDesc, {tipo: "solicitud_servicio", id: nuevaSolicitudRef.id}, {totalAmount: montoFinal, metodoPago, promoAplicada}
  );

  await sendNotification(
    providerId, "prestador", "¡Nuevo Servicio Inmediato!", `Has recibido un nuevo servicio inmediato de ${usuarioId}. ¡Prepárate!`, {solicitudId: nuevaSolicitudRef.id}
  );

  return {success: true, message: `Servicio solicitado exitosamente. Total: $${montoFinal.toFixed(2)}.`, solicitudId: nuevaSolicitudRef.id};
});


export const onServiceStatusChangeSendNotification = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const newValue = change.after.data() as ServiceRequest;
    const previousValue = change.before.data() as ServiceRequest;
    const solicitudId = context.params.solicitudId;

    if (!newValue || !previousValue) return null;
    if (newValue.status === previousValue.status && newValue.paymentStatus === previousValue.paymentStatus) return null;

    functions.logger.log(`[FCM] Solicitud ${solicitudId}. Antes: ${previousValue.status}. Después: ${newValue.status}.`);

    const {usuarioId, prestadorId} = newValue;
    let tituloNotif = "";
    let cuerpoNotif = "";
    let targetUserId: string | null = null;
    let targetUserType: "usuario" | "prestador" | null = null;
    const serviceTitle = newValue.titulo || "un servicio";
    let sendStdNotification = true;

    if (newValue.status !== previousValue.status) {
      switch (newValue.status) {
      case "agendado":
        if (newValue.isRecurringAttempt && newValue.reactivationOfferedBy === "usuario") {
          targetUserId = prestadorId; targetUserType = "prestador";
          tituloNotif = "Solicitud de Reactivación de Servicio";
          cuerpoNotif = `El usuario ${usuarioId} quiere reactivar el servicio "${serviceTitle}".`;
        } else if (!newValue.isRecurringAttempt && previousValue.status !== "pendiente_confirmacion_usuario") {
          targetUserId = prestadorId; targetUserType = "prestador";
          tituloNotif = "Nueva Solicitud de Servicio";
          cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}".`;
        } else {
          sendStdNotification = false;
        }
        break;
      case "pendiente_confirmacion_usuario":
        if (newValue.isRecurringAttempt && newValue.reactivationOfferedBy === "prestador") {
          targetUserId = usuarioId; targetUserType = "usuario";
          tituloNotif = "Oferta de Reactivación de Servicio";
          cuerpoNotif = `El prestador ${prestadorId} te ofrece reactivar el servicio "${serviceTitle}".`;
        } else {
          sendStdNotification = false;
        }
        break;
      case "confirmada_prestador": {
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "¡Cita Confirmada!"; cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido confirmada.`;

        if (newValue.serviceDate && newValue.serviceTime) {
          try {
            const [year, month, day] = newValue.serviceDate.split("-").map(Number);
            const [hour, minute] = newValue.serviceTime.split(":").map(Number);
            const serviceDateTime = new Date(year, month - 1, day, hour, minute);
            const reminderTime = new Date(serviceDateTime.getTime() - HORAS_ANTES_RECORDATORIO_SERVICIO * 60 * 60 * 1000);

            if (reminderTime.getTime() > Date.now()) {
              const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
              const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData)?.nombre || "El prestador" : "El prestador";
              const reminderData: Omit<Recordatorio, "id"> = {
                usuarioId,
                servicioId: solicitudId,
                tipo: "recordatorio_servicio",
                mensaje: `Recordatorio: Tu servicio "${serviceTitle}" con ${nombrePrestador} es mañana a las ${newValue.serviceTime}.`,
                fechaProgramada: admin.firestore.Timestamp.fromDate(reminderTime),
                enviado: false,
                datosAdicionales: {tituloServicio: serviceTitle, nombrePrestador, fechaHoraServicioIso: serviceDateTime.toISOString()},
              };
              const reminderRef = await db.collection("recordatorios").add(reminderData);
              const logDesc = `Recordatorio programado para servicio ${solicitudId}.`;
              await logActivity("sistema", "sistema", "NOTIFICACION_RECORDATORIO_PROGRAMADA", logDesc, {tipo: "recordatorio", id: reminderRef.id});
            }
          } catch (e) {
            functions.logger.error(`Error al parsear fecha/hora para servicio ${solicitudId}`, e);
          }
        }
        break;
      }
      case "rechazada_prestador": case "cancelada_prestador": {
        const statusText = newValue.status === "rechazada_prestador" ? "rechazada" : "cancelada";
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = `Cita ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`;
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido ${statusText} por el prestador.`;
        break;
      }
      case "cancelada_usuario":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "Cita Cancelada por Usuario"; cuerpoNotif = `La cita para "${serviceTitle}" ha sido cancelada por el usuario.`;
        break;
      case "en_camino_proveedor":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "¡Tu Proveedor está en Camino!"; cuerpoNotif = `El proveedor para "${serviceTitle}" está en camino.`;
        break;
      case "servicio_iniciado":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "Servicio Iniciado"; cuerpoNotif = `El proveedor ha iniciado el servicio "${serviceTitle}".`;
        break;
      case "completado_por_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = "Servicio Completado por Prestador";
        cuerpoNotif = `El prestador ha marcado "${serviceTitle}" como completado. Por favor, confirma y califica.`;
        break;
      case "completado_por_usuario":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "¡Servicio Confirmado por Usuario!";
        cuerpoNotif = `El usuario ha confirmado la finalización de "${serviceTitle}". ¡Ya puedes calificarlo!`;
        break;
      }
    }

    if (newValue.paymentStatus !== previousValue.paymentStatus && newValue.paymentStatus === "liberado_al_proveedor") {
      targetUserId = prestadorId; targetUserType = "prestador";
      tituloNotif = "¡Pago Liberado!";
      const montoFinalLiberado = (newValue.detallesFinancieros as DetallesFinancieros)?.montoFinalLiberadoAlPrestador;
      const montoParaMensaje = montoFinalLiberado?.toFixed(2) || (newValue.montoCobrado || newValue.precio || 0).toFixed(2);
      cuerpoNotif = `El pago para el servicio "${serviceTitle}" ha sido liberado. Monto: $${montoParaMensaje}.`;
      sendStdNotification = true;
    }

    if (sendStdNotification && targetUserId && targetUserType && tituloNotif && cuerpoNotif) {
      await sendNotification(targetUserId, targetUserType, tituloNotif, cuerpoNotif, {
        solicitudId, nuevoEstado: newValue.status, nuevoEstadoPago: newValue.paymentStatus || "N/A",
      });
    }
    return null;
  });

export const logSolicitudServicioChanges = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const solicitudId = context.params.solicitudId;
    const beforeData = change.before.data() as ServiceRequest | undefined;
    const afterData = change.after.data() as ServiceRequest | undefined;

    if (!beforeData || !afterData) {
      functions.logger.warn(`[LogTrigger ${solicitudId}] Datos antes o después no disponibles.`);
      return null;
    }

    const actorId = afterData.actorDelCambioId || "sistema";
    const actorRol: "usuario" | "prestador" | "sistema" | "admin" = afterData.actorDelCambioRol || "sistema";
    const now = admin.firestore.Timestamp.now();
    const updatesToServiceRequest: Partial<ServiceRequest> & {updatedAt?: admin.firestore.Timestamp} = {updatedAt: now};


    if (beforeData.status !== afterData.status) {
      let logAction: ActivityLogAction = "CAMBIO_ESTADO_SOLICITUD";
      let logDescription = `Solicitud ${solicitudId} cambió de ${beforeData.status} a ${afterData.status}.`;

      const newStatus = afterData.status as ServiceRequestStatus;
      const isFinalState = ESTADOS_FINALES_SERVICIO.includes(newStatus as EstadoFinalServicio);
      const isCancelledState = newStatus.startsWith("cancelada_") || newStatus === "rechazada_prestador";
      const isDisputeState = newStatus === "en_disputa";

      if (isFinalState && !isCancelledState) {
        logAction = "SERVICIO_FINALIZADO";
        logDescription = `Servicio ${solicitudId} finalizado por ${actorRol}. Estado final: ${newStatus}.`;
      } else if (isCancelledState) {
        logAction = "SERVICIO_CANCELADO";
        logDescription = `Servicio ${solicitudId} cancelado por ${actorRol}. Estado: ${newStatus}.`;
      } else if (isDisputeState) {
        logAction = "SERVICIO_EN_DISPUTA";
        logDescription = `Servicio ${solicitudId} puesto en disputa por ${actorRol}.`;
      }

      await logActivity(
        actorId, actorRol, logAction, logDescription, {tipo: "solicitud_servicio", id: solicitudId},
        {estadoAnterior: beforeData.status, estadoNuevo: afterData.status}
      );

      if (afterData.status === "completado_por_usuario") {
        updatesToServiceRequest.userConfirmedCompletionAt = now.toMillis();
      }

      if (isFinalState && !ESTADOS_FINALES_SERVICIO.includes(beforeData.status as EstadoFinalServicio)) {
        updatesToServiceRequest.fechaFinalizacionEfectiva = now;
      }
    }

    if (!beforeData.calificacionUsuario && afterData.calificacionUsuario) {
      const descLog = `Usuario ${afterData.usuarioId} calificó servicio ${solicitudId} con ${afterData.calificacionUsuario.estrellas} estrellas.`;
      await logActivity(afterData.usuarioId, "usuario", "CALIFICACION_USUARIO", descLog, {tipo: "solicitud_servicio", id: solicitudId}, {
        estrellas: afterData.calificacionUsuario.estrellas,
        comentario: afterData.calificacionUsuario.comentario || "",
      });
    }

    if (!beforeData.calificacionPrestador && afterData.calificacionPrestador) {
      const descLog = `Prestador ${afterData.prestadorId} calificó a usuario ${afterData.usuarioId} en servicio ${solicitudId}.`;
      await logActivity(
        afterData.prestadorId, "prestador", "CALIFICACION_PRESTADOR", descLog, {tipo: "solicitud_servicio", id: solicitudId},
        {estrellas: afterData.calificacionPrestador.estrellas, comentario: afterData.calificacionPrestador.comentario || ""}
      );
    }

    const isFinalizedState = ESTADOS_FINALES_SERVICIO.includes(afterData.status as EstadoFinalServicio);
    const wasNotFinalizedBefore = !ESTADOS_FINALES_SERVICIO.includes(beforeData.status as EstadoFinalServicio);

    if (isFinalizedState && wasNotFinalizedBefore) {
      const relationshipId = `${afterData.usuarioId}_${afterData.prestadorId}`;
      const relationshipRef = db.collection("relacionesUsuarioPrestador").doc(relationshipId);
      const providerDoc = await db.collection("prestadores").doc(afterData.prestadorId).get();
      let serviceCategory = afterData.category;
      if (!serviceCategory && providerDoc.exists) {
        serviceCategory = (providerDoc.data() as ProviderData).categoryIds?.[0] || "general";
      }

      if (serviceCategory) {
        try {
          await db.runTransaction(async (transaction) => {
            const relDoc = await transaction.get(relationshipRef);
            if (relDoc.exists) {
              transaction.update(relationshipRef, {
                serviciosContratados: admin.firestore.FieldValue.increment(1),
                ultimoServicioFecha: now,
                categoriasServicios: admin.firestore.FieldValue.arrayUnion(serviceCategory),
              });
            } else {
              transaction.set(relationshipRef, {
                usuarioId: afterData.usuarioId,
                prestadorId: afterData.prestadorId,
                serviciosContratados: 1,
                ultimoServicioFecha: now,
                categoriasServicios: [serviceCategory],
              });
            }
          });
          const logDesc = `Relación entre ${afterData.usuarioId} y ${afterData.prestadorId} actualizada.`;
          await logActivity("sistema", "sistema", "RELACION_USUARIO_PRESTADOR_ACTUALIZADA", logDesc, {tipo: "relacionUsuarioPrestador", id: relationshipId});
        } catch (e) {
          functions.logger.error(`Error actualizando relación para ${relationshipId}:`, e);
        }
      }
    }

    const shouldReleasePayment = (isFinalizedState && wasNotFinalizedBefore && afterData.paymentStatus === "retenido_para_liberacion") ||
        (beforeData.paymentStatus === "retenido_para_liberacion" && afterData.paymentStatus === "liberado_al_proveedor" && isFinalState && afterData.status !== "en_disputa");

    if (shouldReleasePayment) {
      const montoTotalPagadoPorUsuario = afterData.montoCobrado || afterData.precio || 0;
      const detallesFinancierosNuevos: DetallesFinancieros = {...(afterData.detallesFinancieros as DetallesFinancieros || {})};

      if (montoTotalPagadoPorUsuario > 0 && !detallesFinancierosNuevos.montoFinalLiberadoAlPrestador) {
        detallesFinancierosNuevos.montoTotalPagadoPorUsuario = montoTotalPagadoPorUsuario;
        detallesFinancierosNuevos.comisionSistemaPagoPct = COMISION_SISTEMA_PAGO_PORCENTAJE;
        detallesFinancierosNuevos.comisionSistemaPagoMonto = montoTotalPagadoPorUsuario * COMISION_SISTEMA_PAGO_PORCENTAJE;
        detallesFinancierosNuevos.montoNetoProcesador = montoTotalPagadoPorUsuario - (detallesFinancierosNuevos.comisionSistemaPagoMonto || 0);
        detallesFinancierosNuevos.comisionAppPct = COMISION_APP_SERVICIOMAP_PORCENTAJE;
        detallesFinancierosNuevos.comisionAppMonto = montoTotalPagadoPorUsuario * COMISION_APP_SERVICIOMAP_PORCENTAJE;
        const comisionApp = detallesFinancierosNuevos.comisionAppMonto || 0;
        detallesFinancierosNuevos.aporteFondoFidelidadMonto = comisionApp * PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD;
        const montoNeto = detallesFinancierosNuevos.montoNetoProcesador || 0;
        detallesFinancierosNuevos.montoBrutoParaPrestador = montoNeto - comisionApp;
        detallesFinancierosNuevos.montoFinalLiberadoAlPrestador = detallesFinancierosNuevos.montoBrutoParaPrestador;
        detallesFinancierosNuevos.fechaLiberacion = now;

        updatesToServiceRequest.paymentStatus = "liberado_al_proveedor";
        updatesToServiceRequest.paymentReleasedToProviderAt = now;
        updatesToServiceRequest.detallesFinancieros = detallesFinancierosNuevos;

        const logDesc = `Pago para servicio ${solicitudId} liberado.`;
        await logActivity("sistema", "sistema", "PAGO_LIBERADO", logDesc, {tipo: "solicitud_servicio", id: solicitudId}, detallesFinancierosNuevos);

        const pointsEarned = Math.floor(montoTotalPagadoPorUsuario / FACTOR_CONVERSION_PUNTOS);
        if (pointsEarned > 0) {
          const userRef = db.collection("usuarios").doc(afterData.usuarioId);
          const userHistoryEntry: HistorialPuntoUsuario = {
            servicioId: solicitudId, tipo: "ganados", puntos: pointsEarned, fecha: now,
            descripcion: `Puntos por servicio: ${afterData.titulo || solicitudId.substring(0, 6)}`,
          };
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            await userRef.update({
              puntosAcumulados: admin.firestore.FieldValue.increment(pointsEarned),
              historialPuntos: admin.firestore.FieldValue.arrayUnion(userHistoryEntry),
            });
          } else {
            await userRef.set({
              puntosAcumulados: pointsEarned, historialPuntos: [userHistoryEntry],
            }, {merge: true});
          }
          await logActivity(
            afterData.usuarioId, "usuario", "PUNTOS_FIDELIDAD_GANADOS", `Usuario ganó ${pointsEarned} puntos.`,
            {tipo: "usuario", id: afterData.usuarioId}, {puntos: pointsEarned, servicioId}
          );
        }

        const providerDoc = await db.collection("prestadores").doc(afterData.prestadorId).get();
        if (providerDoc.exists) {
          const providerData = providerDoc.data() as ProviderData;
          if (providerData.referidoPor) {
            const embajadorUID = providerData.referidoPor;
            const comisionAppMonto = detallesFinancierosNuevos.comisionAppMonto || 0;
            const comisionEmbajador = comisionAppMonto * PORCENTAJE_COMISION_EMBAJADOR;
            if (comisionEmbajador > 0) {
              await db.collection("comisiones").add({
                idUsuarioGanador: embajadorUID,
                tipo: "servicio_completado",
                monto: comisionEmbajador,
                detalle: `Comisión por servicio de ${providerData.nombre}`,
                fecha: now,
                referenciaID: solicitudId,
              });
            }
          }
        }

        const aportefondo = detallesFinancierosNuevos.aporteFondoFidelidadMonto || 0;
        if (aportefondo > 0) {
          const fundRef = db.collection("fondoFidelidad").doc("global");
          const fundHistoryEntry = {
            servicioId: solicitudId,
            montoAportadoAlFondo: aportefondo,
            fecha: now,
          };
          const fundDoc = await fundRef.get();
          if (fundDoc.exists) {
            await fundRef.update({
              totalAcumulado: admin.firestore.FieldValue.increment(aportefondo),
              registros: admin.firestore.FieldValue.arrayUnion(fundHistoryEntry),
            });
          } else {
            await fundRef.set({totalAcumulado: aportefondo, registros: [fundHistoryEntry]});
          }
          const desc = `Aporte de ${aportefondo.toFixed(2)} al fondo de fidelidad por servicio ${solicitudId}.`;
          await logActivity("sistema", "sistema", "FONDO_FIDELIDAD_APORTE", desc, {tipo: "fondo_fidelidad", id: "global"}, {monto: aportefondo, servicioId});
        }
      }
    }

    if (Object.keys(updatesToServiceRequest).length > 1) {
      await change.after.ref.update(updatesToServiceRequest);
    }
    return null;
  });


export const onQuotationResponseNotifyUser = functions.firestore
  .document("solicitudes_cotizacion/{cotizacionId}")
  .onUpdate(async (change, context) => {
    const cotizacionId = context.params.cotizacionId;
    const beforeData = change.before.data() as SolicitudCotizacionData | undefined;
    const afterData = change.after.data() as SolicitudCotizacionData | undefined;

    if (!beforeData || !afterData || afterData.estado === beforeData.estado) return null;

    const {usuarioId, prestadorId} = afterData;
    const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
    const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData).nombre || "El prestador" : "El prestador";
    const tituloServicio = afterData.tituloServicio || "tu cotización";
    let notifTitle = "";
    let notifBody = "";
    let logDesc = "";
    let logAction: ActivityLogAction | null = null;

    if (afterData.estado === "precio_propuesto_al_usuario" && beforeData.estado === "pendiente_revision_prestador") {
      notifTitle = "¡Cotización Actualizada!";
      notifBody = `${nombrePrestador} ha propuesto un precio de $${afterData.precioSugerido} para ${tituloServicio}.`;
      logAction = "COTIZACION_PRECIO_PROPUESTO";
      logDesc = `${nombrePrestador} propuso precio para cotización ${cotizacionId}.`;
    } else if (afterData.estado === "rechazada_prestador" && beforeData.estado === "pendiente_revision_prestador") {
      notifTitle = "Cotización Rechazada";
      notifBody = `${nombrePrestador} ha rechazado tu solicitud para ${tituloServicio}.`;
      logAction = "COTIZACION_RECHAZADA";
      logDesc = `${nombrePrestador} rechazó cotización ${cotizacionId}.`;
    }

    if (notifTitle && notifBody) {
      await sendNotification(usuarioId, "usuario", notifTitle, notifBody, {cotizacionId: cotizacionId});
    }
    if (logAction && logDesc) {
      await logActivity(prestadorId, "prestador", logAction, logDesc, {tipo: "solicitud_cotizacion", id: cotizacionId});
    }
    return null;
  });

export const acceptQuotationAndCreateServiceRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  const usuarioId = context.auth.uid;
  const {cotizacionId} = data;
  if (!cotizacionId || typeof cotizacionId !== "string") throw new functions.https.HttpsError("invalid-argument", "Se requiere 'cotizacionId'.");

  const cotizacionRef = db.collection("solicitudes_cotizacion").doc(cotizacionId);
  try {
    return await db.runTransaction(async (transaction) => {
      const cotizacionDoc = await transaction.get(cotizacionRef);
      if (!cotizacionDoc.exists) throw new functions.https.HttpsError("not-found", `Cotización ${cotizacionId} no encontrada.`);
      const cotizacionData = cotizacionDoc.data() as SolicitudCotizacionData;

      if (cotizacionData.usuarioId !== usuarioId) throw new functions.https.HttpsError("permission-denied", "No eres el propietario.");
      if (cotizacionData.estado !== "precio_propuesto_al_usuario") throw new functions.https.HttpsError("failed-precondition", "Estado inválido.");
      if (typeof cotizacionData.precioSugerido !== "number" || cotizacionData.precioSugerido <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "Precio sugerido inválido.");
      }

      const {prestadorId} = cotizacionData;
      const [prestadorDoc, usuarioDoc] = await Promise.all([
        transaction.get(db.collection("prestadores").doc(prestadorId)),
        transaction.get(db.collection("usuarios").doc(usuarioId)),
      ]);
      if (!prestadorDoc.exists || prestadorDoc.data()?.isBlocked) {
        throw new functions.https.HttpsError("failed-precondition", "Este proveedor no puede ser contratado.");
      }
      if (usuarioDoc.data()?.isBlocked) {
        throw new functions.https.HttpsError("failed-precondition", "Tu cuenta está bloqueada.");
      }

      const userBlocksProviderQuery = db.collection("bloqueos").where("bloqueadorRef", "==", usuarioId).where("bloqueadoRef", "==", prestadorId).limit(1);
      const userBlocksProviderSnap = await transaction.get(userBlocksProviderQuery);
      if (!userBlocksProviderSnap.empty) {
        throw new functions.https.HttpsError("permission-denied", "No puedes contratar a este proveedor porque lo has bloqueado.");
      }
      const providerBlocksUserQuery = db.collection("bloqueos").where("bloqueadorRef", "==", prestadorId).where("bloqueadoRef", "==", usuarioId).limit(1);
      const providerBlocksUserSnap = await transaction.get(providerBlocksUserQuery);
      if (!providerBlocksUserSnap.empty) {
        throw new functions.https.HttpsError("permission-denied", "No puedes contratar a este proveedor.");
      }

      const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();
      const ahora = admin.firestore.Timestamp.now();
      const tomorrow = new Date(ahora.toDate());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const serviceDateStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, "0")}-${tomorrow.getDate().toString().padStart(2, "0")}`;

      const nuevaSolicitudData: Omit<ServiceRequest, "id"> = {
        usuarioId: usuarioId,
        prestadorId: prestadorId,
        status: "confirmada_prestador",
        createdAt: ahora,
        updatedAt: ahora,
        titulo: cotizacionData.tituloServicio || "Servicio de cotización",
        precio: cotizacionData.precioSugerido,
        montoCobrado: cotizacionData.precioSugerido,
        paymentStatus: "retenido_para_liberacion",
        originatingQuotationId: cotizacionId,
        actorDelCambioId: usuarioId,
        actorDelCambioRol: "usuario",
        serviceDate: serviceDateStr,
        serviceTime: "10:00",
        serviceType: "fixed",
      };
      transaction.set(nuevaSolicitudRef, nuevaSolicitudData);
      transaction.update(cotizacionRef, {estado: "convertida_a_servicio", fechaRespuestaUsuario: ahora});

      const logDesc = `Usuario aceptó cotización ${cotizacionId}. Nueva solicitud ID: ${nuevaSolicitudRef.id}.`;
      await logActivity(usuarioId, "usuario", "COTIZACION_ACEPTADA_USUARIO", logDesc, {tipo: "solicitud_cotizacion", id: cotizacionId});
      const notifBody = "El usuario ha aceptado tu cotización y se ha generado una nueva solicitud de servicio.";
      await sendNotification(prestadorId, "prestador", "¡Cotización Aceptada!", notifBody, {solicitudId: nuevaSolicitudRef.id, cotizacionId});
      return {success: true, message: "Cotización aceptada y servicio creado.", servicioId: nuevaSolicitudRef.id};
    });
  } catch (error: any) {
    functions.logger.error(`Error al aceptar cotización ${cotizacionId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar.", error.message);
  }
});
