
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { SERVICE_CATEGORIES } from "./constants"; // Asumiendo que tienes este archivo o lo crearás

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- CONSTANTS FOR FINANCIALS & LOYALTY ---
const COMISION_SISTEMA_PAGO_PORCENTAJE = 0.04; // 4% payment processor fee
const COMISION_APP_SERVICIOMAP_PORCENTAJE = 0.06; // 6% ServiMap app commission on original total
const PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD = 0.10; // 10% of ServiMap's commission goes to loyalty
const FACTOR_CONVERSION_PUNTOS = 10; // $10 MXN (or monetary unit) per 1 loyalty point
const DEFAULT_LANGUAGE_CODE = "es";
const HORAS_ANTES_RECORDATORIO_SERVICIO = 24;
const PLAZO_REPORTE_DIAS = 7;
const MINUTOS_VENTANA_CANCELACION = 10;


// --- INTERFACES (Locally defined for Cloud Functions context) ---
export type ServiceRequestStatus =
  | "agendado"
  | "pendiente_confirmacion" // Generally implies provider needs to confirm
  | "pendiente_confirmacion_usuario" // User needs to confirm (e.g., a provider's offer or reactivation)
  | "confirmada_prestador"
  | "pagada"
  | "en_camino_proveedor"
  | "servicio_iniciado"
  | "completado_por_prestador"
  | "completado_por_usuario"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "rechazada_prestador"
  | "en_disputa"
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta";

export type EstadoFinalServicio =
  | "cerrado_automaticamente"
  | "cerrado_con_calificacion"
  | "cerrado_con_disputa_resuelta"
  | "cancelada_usuario"
  | "cancelada_prestador"
  | "rechazada_prestador";

const ESTADOS_FINALES_SERVICIO: EstadoFinalServicio[] = [
  "cerrado_automaticamente", "cerrado_con_calificacion", "cerrado_con_disputa_resuelta",
  "cancelada_usuario", "cancelada_prestador", "rechazada_prestador",
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
export interface UserData {
  fcmTokens?: string[];
  nombre?: string;
  puntosAcumulados?: number;
  historialPuntos?: admin.firestore.FieldValue | HistorialPuntoUsuario[];
  isPremium?: boolean;
  idiomaPreferido?: string;
  favoritos?: string[];
}

export interface ProviderData {
  fcmTokens?: string[];
  nombre?: string;
  aceptaCotizacion?: boolean;
  empresa?: string;
  services?: { category: string; title: string; description: string; price: number }[];
  specialties?: string[];
  isAvailable?: boolean;
  currentLocation?: { lat: number; lng: number; timestamp?: admin.firestore.Timestamp };
  rating?: number;
  avatarUrl?: string;
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
  actorDelCambioRol?: "usuario" | "prestador" | "sistema";
  calificacionUsuario?: CalificacionDetallada;
  calificacionPrestador?: CalificacionDetallada;
  paymentStatus?: PaymentStatus;
  originatingQuotationId?: string;
  precio?: number;
  montoCobrado?: number;
  paymentReleasedToProviderAt?: admin.firestore.Timestamp | number;
  detallesFinancieros?: admin.firestore.FieldValue | DetallesFinancieros;
  serviceDate?: string; // YYYY-MM-DD
  serviceTime?: string; // HH:MM
  reporteActivoId?: string;
  estadoDisputa?: "ninguna" | "abierta" | "resuelta";
  serviceType?: "fixed" | "hourly";
  selectedFixedServices?: { serviceId: string, title: string, price: number }[];
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
  disputeDetails?: { reportedAt: number; reason: string; resolution?: string; resolvedAt?: number; };
  actualStartTime?: admin.firestore.Timestamp | number;
  actualEndTime?: admin.firestore.Timestamp | number;
  actualDurationHours?: number;
  finalTotal?: number;
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
    [uid: string]: { nombre?: string; rol: "usuario" | "prestador" };
  };
  fechaCreacion: admin.firestore.Timestamp;
  ultimaActualizacion?: admin.firestore.Timestamp;
  ultimoMensaje?: {
    texto: string;
    remitenteId: string;
    timestamp: admin.firestore.Timestamp;
  };
  estadoChat?: "activo" | "archivado_usuario" | "archivado_prestador" | "finalizado_servicio";
  conteoNoLeido?: { [uid: string]: number };
}

export type ActivityLogAction =
  | "CAMBIO_ESTADO_SOLICITUD" | "CALIFICACION_USUARIO" | "CALIFICACION_PRESTADOR"
  | "SOLICITUD_CREADA" | "PAGO_RETENIDO" | "PAGO_LIBERADO"
  | "GARANTIA_ACTIVADA" | "INICIO_SESION" | "CIERRE_SESION"
  | "CONFIG_CAMBIADA" | "COTIZACION_CREADA" | "COTIZACION_PRECIO_PROPUESTO"
  | "COTIZACION_ACEPTADA_USUARIO" | "COTIZACION_RECHAZADA" | "CHAT_CREADO"
  | "PUNTOS_FIDELIDAD_GANADOS" | "PUNTOS_FIDELIDAD_CANJEADOS" | "FONDO_FIDELIDAD_APORTE"
  | "PAGO_PROCESADO_DETALLES" | "TRADUCCION_SOLICITADA"
  | "NOTIFICACION_RECORDATORIO_PROGRAMADA" | "NOTIFICACION_RECORDATORIO_ENVIADA"
  | "REGLAS_ZONA_CONSULTADAS" | "ADMIN_ZONA_MODIFICADA"
  | "TICKET_SOPORTE_CREADO" | "TICKET_SOPORTE_ACTUALIZADO"
  | "BUSQUEDA_PRESTADORES" | "REPORTE_PROBLEMA_CREADO" | "GARANTIA_REGISTRADA"
  | "SERVICIO_REACTIVADO_SOLICITUD" | "SERVICIO_REACTIVADO_OFERTA"
  | "SERVICIO_CONFIRMADO_PAGADO";

export interface PromocionFidelidad {
  id?: string;
  descripcion: string;
  puntosRequeridos: number;
  tipoDescuento: "porcentaje" | "monto_fijo";
  valorDescuento: number;
  activo: boolean;
  codigoPromocional?: string;
  usosDisponibles?: admin.firestore.FieldValue | number;
  fechaExpiracion?: admin.firestore.Timestamp;
  serviciosAplicables?: string[];
}

interface IdiomaRecursosFirestore {
  [key: string]: string;
}
interface IdiomaDocumentoFirestore {
  codigo: string;
  nombre: string;
  recursos: IdiomaRecursosFirestore;
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
    [key: string]: any;
  };
}

interface ProviderLocation {
  lat: number;
  lng: number;
}

interface CoordenadaFirestore {
  lat: number;
  lng: number;
}

interface ReglasZonaFirestore {
  tarifaFactor?: number;
  descuentoAbsoluto?: number;
  descuentoPorcentual?: number;
  serviciosRestringidos?: string[];
  serviciosConPrioridad?: string[];
  promocionesActivasIds?: string[];
  mensajeEspecial?: string;
  disponibilidadAfectada?: "restringida_total" | "restringida_parcial" | "mejorada" | "sin_cambio";
}

interface ZonaPreferenteFirestore {
  id?: string;
  nombre: string;
  poligono: CoordenadaFirestore[];
  reglas: ReglasZonaFirestore;
  activa: boolean;
  prioridad?: number;
  descripcion?: string;
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

interface PrestadorBuscado {
  id: string;
  nombre: string;
  empresa?: string;
  distanciaKm: number;
  calificacion: number;
  avatarUrl?: string;
  categoriaPrincipal?: string;
}

interface ReporteServicioData {
  id?: string;
  idServicio: string;
  idUsuarioReportante: string;
  rolReportante: "usuario" | "prestador";
  descripcionProblema: string;
  archivoAdjuntoURL?: string;
  fechaReporte: admin.firestore.Timestamp;
  estadoReporte: "pendiente_revision_admin" | "en_investigacion" | "resuelto_compensacion" | "resuelto_sin_compensacion" | "rechazado_reporte";
  idServicioOriginalData?: Partial<ServiceRequest>;
  garantiaActivada?: boolean;
  idGarantiaPendiente?: string;
}

interface GarantiaPendienteData {
  id?: string;
  idServicio: string;
  idUsuario: string;
  idPrestador: string;
  idReporte: string;
  fechaSolicitudGarantia: admin.firestore.Timestamp;
  estadoGarantia: "pendiente_revision" | "aprobada_compensacion" | "aprobada_re_servicio" | "rechazada_garantia";
  detallesServicioOriginal?: Partial<ServiceRequest>;
  descripcionProblemaOriginal: string;
  fechaResolucion?: admin.firestore.Timestamp;
  notasResolucion?: string;
  resueltaPorAdminId?: string;
}

interface ServicioConfirmadoData {
  userId: string;
  providerId: string;
  serviceDetails?: string;
  paymentAmount: number;
  status: "confirmado";
  confirmadoEn: admin.firestore.Timestamp;
  puedeCancelarHasta: admin.firestore.Timestamp;
  iniciado: boolean;
}

interface PagoPendienteData {
  userId: string;
  providerId: string;
  paymentAmount: number;
  retenido: boolean;
  status: "esperando_calificacion";
  creadoEn: admin.firestore.Timestamp;
}


// --- Helper para enviar notificaciones ---
async function sendNotification(userId: string, userType: "usuario" | "prestador", title: string, body: string, data?: {[key: string]: string}) {
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

// --- Helper para crear logs de actividad ---
async function logActivity(
  actorId: string,
  actorRol: "usuario" | "prestador" | "sistema" | "admin",
  accion: ActivityLogAction,
  descripcion: string,
  entidadAfectada?: {tipo: string; id: string},
  detallesAdicionales?: Record<string, any>
) {
  try {
    await db.collection("logs_actividad").add({
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


export const onServiceStatusChangeSendNotification = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const newValue = change.after.data() as ServiceRequest;
    const previousValue = change.before.data() as ServiceRequest;
    const solicitudId = context.params.solicitudId;

    if (!newValue || !previousValue) {
      functions.logger.log(`[FCM Trigger ${solicitudId}] No new or previous data, exiting.`);
      return null;
    }
    if (newValue.status === previousValue.status && newValue.paymentStatus === previousValue.paymentStatus) return null;

    functions.logger.log(`[FCM Trigger ${solicitudId}] Estado/Pago cambiado. Antes: ${previousValue.status}, ${previousValue.paymentStatus}. Después: ${newValue.status}, ${newValue.paymentStatus}.`);

    const usuarioId = newValue.usuarioId;
    const prestadorId = newValue.prestadorId;
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
          cuerpoNotif = `El usuario ${newValue.usuarioId} quiere reactivar el servicio "${serviceTitle}". Por favor, confirma la nueva fecha/hora.`;
        } else if (!newValue.isRecurringAttempt && previousValue.status !== "pendiente_confirmacion_usuario") { // Standard new request, not a response to offer
          targetUserId = prestadorId; targetUserType = "prestador";
          tituloNotif = "Nueva Solicitud de Servicio";
          cuerpoNotif = `Has recibido una nueva solicitud para "${serviceTitle}".`;
        } else {
          sendStdNotification = false; // Avoid double notification if reactivation already sent one
        }
        break;
      case "pendiente_confirmacion_usuario":
        if (newValue.isRecurringAttempt && newValue.reactivationOfferedBy === "prestador") {
          targetUserId = usuarioId; targetUserType = "usuario";
          tituloNotif = "Oferta de Reactivación de Servicio";
          cuerpoNotif = `El prestador ${newValue.prestadorId} te ofrece reactivar el servicio "${serviceTitle}". Por favor, confirma si deseas continuar.`;
        } else { // Could be other scenarios leading to this state, handle if needed.
          sendStdNotification = false;
        }
        break;
      case "confirmada_prestador":
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
                usuarioId: usuarioId,
                servicioId: solicitudId,
                tipo: "recordatorio_servicio",
                mensaje: `Recordatorio: Tu servicio "${serviceTitle}" con ${nombrePrestador} es mañana a las ${newValue.serviceTime}.`,
                fechaProgramada: admin.firestore.Timestamp.fromDate(reminderTime),
                enviado: false,
                datosAdicionales: {
                  tituloServicio: serviceTitle,
                  nombrePrestador: nombrePrestador,
                  fechaHoraServicioIso: serviceDateTime.toISOString(),
                },
              };
              const reminderRef = await db.collection("recordatorios").add(reminderData);
              functions.logger.info(`[Reminder Scheduled] Recordatorio programado para servicio ${solicitudId} en ${reminderTime.toISOString()}. ID: ${reminderRef.id}`);
              await logActivity("sistema", "sistema", "NOTIFICACION_RECORDATORIO_PROGRAMADA", `Recordatorio programado para servicio ${solicitudId}.`, {tipo: "recordatorio", id: reminderRef.id});
            }
          } catch (e) {
            functions.logger.error(`[Reminder Scheduling Error] Error al parsear fecha/hora para servicio ${solicitudId}: ${newValue.serviceDate} ${newValue.serviceTime}`, e);
          }
        }
        break;
      case "rechazada_prestador": case "cancelada_prestador":
        targetUserId = usuarioId; targetUserType = "usuario";
        tituloNotif = `Cita ${newValue.status === "rechazada_prestador" ? "Rechazada" : "Cancelada"}`;
        cuerpoNotif = `Tu cita para "${serviceTitle}" ha sido ${newValue.status === "rechazada_prestador" ? "rechazada" : "cancelada"} por el prestador.`;
        break;
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
        tituloNotif = "Servicio Completado por Prestador"; cuerpoNotif = `El prestador ha marcado "${serviceTitle}" como completado. Por favor, confirma y califica.`;
        break;
      case "completado_por_usuario":
        targetUserId = prestadorId; targetUserType = "prestador";
        tituloNotif = "¡Servicio Confirmado por Usuario!"; cuerpoNotif = `El usuario ha confirmado la finalización de "${serviceTitle}". ¡Ya puedes calificarlo!`;
        break;
      }
    }

    if (newValue.paymentStatus !== previousValue.paymentStatus && newValue.paymentStatus === "liberado_al_proveedor") {
      targetUserId = prestadorId; targetUserType = "prestador";
      tituloNotif = "¡Pago Liberado!";
      const montoFinalLiberado = (newValue.detallesFinancieros as DetallesFinancieros)?.montoFinalLiberadoAlPrestador;
      const montoParaMensaje = montoFinalLiberado !== undefined ? montoFinalLiberado.toFixed(2) : (newValue.montoCobrado || newValue.precio || 0).toFixed(2);
      cuerpoNotif = `El pago para el servicio "${serviceTitle}" ha sido liberado a tu cuenta. Monto: $${montoParaMensaje}.`;
      sendStdNotification = true;
    }

    if (sendStdNotification && targetUserId && targetUserType && tituloNotif && cuerpoNotif) {
      await sendNotification(targetUserId, targetUserType, tituloNotif, cuerpoNotif, {solicitudId, nuevoEstado: newValue.status, nuevoEstadoPago: newValue.paymentStatus || "N/A"});
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
      const descLog = `Solicitud ${solicitudId} cambió de ${beforeData.status} a ${afterData.status} por ${actorRol} ${actorId}.`;
      await logActivity(actorId, actorRol, "CAMBIO_ESTADO_SOLICITUD", descLog, {tipo: "solicitud_servicio", id: solicitudId}, {estadoAnterior: beforeData.status, estadoNuevo: afterData.status});
      if (ESTADOS_FINALES_SERVICIO.includes(afterData.status as EstadoFinalServicio) && !ESTADOS_FINALES_SERVICIO.includes(beforeData.status as EstadoFinalServicio)) {
        updatesToServiceRequest.fechaFinalizacionEfectiva = now;
      }
    }

    if (!beforeData.calificacionUsuario && afterData.calificacionUsuario) {
      const descLog = `Usuario ${afterData.usuarioId} calificó servicio ${solicitudId} (Prestador: ${afterData.prestadorId}) con ${afterData.calificacionUsuario.estrellas} estrellas.`;
      await logActivity(afterData.usuarioId, "usuario", "CALIFICACION_USUARIO", descLog, {tipo: "solicitud_servicio", id: solicitudId}, {
        estrellas: afterData.calificacionUsuario.estrellas,
        comentario: afterData.calificacionUsuario.comentario || "",
        indicadores: afterData.calificacionUsuario.indicadoresRendimiento,
        aspectosPositivos: afterData.calificacionUsuario.aspectosPositivos,
        areasDeMejora: afterData.calificacionUsuario.areasDeMejora,
      });
    }

    if (!beforeData.calificacionPrestador && afterData.calificacionPrestador) {
      const descLog = `Prestador ${afterData.prestadorId} calificó a usuario ${afterData.usuarioId} en servicio ${solicitudId} con ${afterData.calificacionPrestador.estrellas} estrellas.`;
      await logActivity(afterData.prestadorId, "prestador", "CALIFICACION_PRESTADOR", descLog, {tipo: "solicitud_servicio", id: solicitudId}, {
        estrellas: afterData.calificacionPrestador.estrellas,
        comentario: afterData.calificacionPrestador.comentario || "",
      });
    }

    const isFinalizedState = ESTADOS_FINALES_SERVICIO.includes(afterData.status as EstadoFinalServicio);
    const wasNotFinalizedBefore = !ESTADOS_FINALES_SERVICIO.includes(beforeData.status as EstadoFinalServicio);

    if ((isFinalizedState && wasNotFinalizedBefore && afterData.paymentStatus === "retenido_para_liberacion") ||
        (beforeData.paymentStatus === "retenido_para_liberacion" && afterData.paymentStatus === "liberado_al_proveedor" && isFinalizedState && beforeData.status !== afterData.status && afterData.status !== "en_disputa")) {
      const montoTotalPagadoPorUsuario = afterData.montoCobrado || afterData.precio || 0;
      let detallesFinancierosNuevos: DetallesFinancieros = {...(afterData.detallesFinancieros as DetallesFinancieros || {})};

      if (montoTotalPagadoPorUsuario > 0 && !detallesFinancierosNuevos.montoFinalLiberadoAlPrestador) {
        detallesFinancierosNuevos.montoTotalPagadoPorUsuario = montoTotalPagadoPorUsuario;
        detallesFinancierosNuevos.comisionSistemaPagoPct = COMISION_SISTEMA_PAGO_PORCENTAJE;
        detallesFinancierosNuevos.comisionSistemaPagoMonto = montoTotalPagadoPorUsuario * COMISION_SISTEMA_PAGO_PORCENTAJE;
        detallesFinancierosNuevos.montoNetoProcesador = montoTotalPagadoPorUsuario - (detallesFinancierosNuevos.comisionSistemaPagoMonto || 0);
        detallesFinancierosNuevos.comisionAppPct = COMISION_APP_SERVICIOMAP_PORCENTAJE;
        detallesFinancierosNuevos.comisionAppMonto = montoTotalPagadoPorUsuario * COMISION_APP_SERVICIOMAP_PORCENTAJE;
        detallesFinancierosNuevos.aporteFondoFidelidadMonto = (detallesFinancierosNuevos.comisionAppMonto || 0) * PORCENTAJE_COMISION_APP_PARA_FONDO_FIDELIDAD;
        detallesFinancierosNuevos.montoBrutoParaPrestador = (detallesFinancierosNuevos.montoNetoProcesador || 0) - (detallesFinancierosNuevos.comisionAppMonto || 0);
        detallesFinancierosNuevos.montoFinalLiberadoAlPrestador = detallesFinancierosNuevos.montoBrutoParaPrestador;
        detallesFinancierosNuevos.fechaLiberacion = now;

        updatesToServiceRequest.paymentStatus = "liberado_al_proveedor";
        updatesToServiceRequest.paymentReleasedToProviderAt = now;
        updatesToServiceRequest.detallesFinancieros = detallesFinancierosNuevos;

        await logActivity("sistema", "sistema", "PAGO_LIBERADO", `Pago para servicio ${solicitudId} liberado. Prestador recibe $${detallesFinancierosNuevos.montoFinalLiberadoAlPrestador?.toFixed(2)}.`, {tipo: "solicitud_servicio", id: solicitudId}, detallesFinancierosNuevos);
        await logActivity("sistema", "sistema", "PAGO_PROCESADO_DETALLES", `Detalles financieros procesados para ${solicitudId}.`, {tipo: "solicitud_servicio", id: solicitudId}, detallesFinancierosNuevos);

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
              nombre: `Usuario ${afterData.usuarioId.substring(0, 5)}`, fcmTokens: [], isPremium: false,
            }, {merge: true});
          }
          await logActivity(afterData.usuarioId, "usuario", "PUNTOS_FIDELIDAD_GANADOS", `Usuario ganó ${pointsEarned} puntos por servicio ${solicitudId}.`, {tipo: "usuario", id: afterData.usuarioId}, {puntos: pointsEarned, servicioId});
        }

        if (detallesFinancierosNuevos.aporteFondoFidelidadMonto && detallesFinancierosNuevos.aporteFondoFidelidadMonto > 0) {
          const fundRef = db.collection("fondoFidelidad").doc("global");
          const fundHistoryEntry = {
            servicioId: solicitudId, montoServicio: montoTotalPagadoPorUsuario,
            comisionPlataformaCalculada: detallesFinancierosNuevos.comisionAppMonto,
            montoAportadoAlFondo: detallesFinancierosNuevos.aporteFondoFidelidadMonto, fecha: now,
          };
          const fundDoc = await fundRef.get();
          if (fundDoc.exists) {
            await fundRef.update({
              totalAcumulado: admin.firestore.FieldValue.increment(detallesFinancierosNuevos.aporteFondoFidelidadMonto),
              registros: admin.firestore.FieldValue.arrayUnion(fundHistoryEntry),
            });
          } else {
            await fundRef.set({
              totalAcumulado: detallesFinancierosNuevos.aporteFondoFidelidadMonto,
              registros: [fundHistoryEntry],
            });
          }
          await logActivity("sistema", "sistema", "FONDO_FIDELIDAD_APORTE", `Aporte de ${detallesFinancierosNuevos.aporteFondoFidelidadMonto.toFixed(2)} al fondo de fidelidad por servicio ${solicitudId}.`, {tipo: "fondo_fidelidad", id: "global"}, {monto: detallesFinancierosNuevos.aporteFondoFidelidadMonto, servicioId});
        }
      }
    }

    if (Object.keys(updatesToServiceRequest).length > 1 || updatesToServiceRequest.fechaFinalizacionEfectiva || updatesToServiceRequest.detallesFinancieros) {
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

    if (!beforeData || !afterData) return null;

    const usuarioId = afterData.usuarioId;
    const prestadorId = afterData.prestadorId;
    const prestadorDoc = await db.collection("prestadores").doc(prestadorId).get();
    const nombrePrestador = prestadorDoc.exists ? (prestadorDoc.data() as ProviderData).nombre || "El prestador" : "El prestador";
    const tituloServicio = afterData.tituloServicio || "tu cotización";
    let notifTitle = ""; let notifBody = ""; let logDesc = ""; let logAction: ActivityLogAction | null = null;

    if (afterData.estado !== beforeData.estado) {
      if (afterData.estado === "precio_propuesto_al_usuario" && beforeData.estado === "pendiente_revision_prestador") {
        notifTitle = "¡Cotización Actualizada!";
        notifBody = `${nombrePrestador} ha propuesto un precio de $${afterData.precioSugerido} para ${tituloServicio}. Revisa y acepta o rechaza.`;
        logAction = "COTIZACION_PRECIO_PROPUESTO";
        logDesc = `${nombrePrestador} (ID: ${prestadorId}) propuso precio $${afterData.precioSugerido} para cotización ${cotizacionId} de usuario ${usuarioId}.`;
      } else if (afterData.estado === "rechazada_prestador" && beforeData.estado === "pendiente_revision_prestador") {
        notifTitle = "Cotización Rechazada";
        notifBody = `${nombrePrestador} ha tenido que rechazar tu solicitud de cotización para ${tituloServicio}. ${afterData.notasPrestador || ""}`;
        logAction = "COTIZACION_RECHAZADA";
        logDesc = `${nombrePrestador} (ID: ${prestadorId}) rechazó cotización ${cotizacionId}. Motivo: ${afterData.notasPrestador || "No especificado"}`;
      }
    }
    if (notifTitle && notifBody) await sendNotification(usuarioId, "usuario", notifTitle, notifBody, {cotizacionId: cotizacionId, nuevoEstado: afterData.estado});
    if (logAction && logDesc) await logActivity(prestadorId, "prestador", logAction, logDesc, {tipo: "solicitud_cotizacion", id: cotizacionId}, {precioSugerido: afterData.precioSugerido, notasPrestador: afterData.notasPrestador});
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
      if (cotizacionData.estado !== "precio_propuesto_al_usuario") throw new functions.https.HttpsError("failed-precondition", `Estado inválido: ${cotizacionData.estado}`);
      if (typeof cotizacionData.precioSugerido !== "number" || cotizacionData.precioSugerido <= 0) throw new functions.https.HttpsError("failed-precondition", "Precio sugerido inválido.");

      const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();
      const ahora = admin.firestore.Timestamp.now();

      const tomorrow = new Date(ahora.toDate());
      tomorrow.setDate(tomorrow.getDate() + 1);
      const serviceDateStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, "0")}-${tomorrow.getDate().toString().padStart(2, "0")}`;
      const serviceTimeStr = "10:00";

      const nuevaSolicitudData: Omit<ServiceRequest, "id"> = {
        usuarioId: usuarioId, prestadorId: cotizacionData.prestadorId, status: "confirmada_prestador",
        createdAt: ahora, updatedAt: ahora, titulo: cotizacionData.tituloServicio || `Servicio de cotización ${cotizacionId.substring(0, 5)}`,
        precio: cotizacionData.precioSugerido,
        montoCobrado: cotizacionData.precioSugerido,
        paymentStatus: "retenido_para_liberacion", // Asumimos que aceptar la cotización implica retener el pago
        originatingQuotationId: cotizacionId,
        actorDelCambioId: usuarioId,
        actorDelCambioRol: "usuario",
        serviceDate: serviceDateStr,
        serviceTime: serviceTimeStr,
        serviceType: "fixed",
      };
      transaction.set(nuevaSolicitudRef, nuevaSolicitudData);
      transaction.update(cotizacionRef, {estado: "convertida_a_servicio", fechaRespuestaUsuario: ahora});

      await logActivity(usuarioId, "usuario", "COTIZACION_ACEPTADA_USUARIO", `Usuario aceptó cotización ${cotizacionId}. Nueva solicitud ID: ${nuevaSolicitudRef.id}.`, {tipo: "solicitud_cotizacion", id: cotizacionId}, {nuevaSolicitudServicioId: nuevaSolicitudRef.id, precioAceptado: cotizacionData.precioSugerido});
      await sendNotification(cotizacionData.prestadorId, "prestador", "¡Cotización Aceptada!", `Usuario aceptó tu cotización de $${cotizacionData.precioSugerido} para "${cotizacionData.tituloServicio || "el servicio"}". Se ha creado una solicitud de servicio.`, {solicitudId: nuevaSolicitudRef.id, cotizacionId: cotizacionId});
      return {success: true, message: "Cotización aceptada y servicio creado.", servicioId: nuevaSolicitudRef.id};
    });
  } catch (error: any) {
    functions.logger.error(`Error al aceptar cotización ${cotizacionId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar.", error.message);
  }
});

export const onServiceConfirmedCreateChatRoom = functions.firestore
  .document("solicitudes_servicio/{solicitudId}")
  .onUpdate(async (change, context) => {
    const solicitudId = context.params.solicitudId;
    const afterData = change.after.data() as ServiceRequest | undefined;
    const beforeData = change.before.data() as ServiceRequest | undefined;
    if (!afterData || !beforeData) return null;

    const chatTriggerStatus: ServiceRequestStatus = "confirmada_prestador";
    if (afterData.status === chatTriggerStatus && beforeData.status !== chatTriggerStatus) {
      functions.logger.info(`[ChatCreate ${solicitudId}] Creando sala de chat.`);
      const usuarioId = afterData.usuarioId; const prestadorId = afterData.prestadorId;
      const chatDocRef = db.collection("chats").doc(solicitudId);
      try {
        const chatDoc = await chatDocRef.get();
        if (chatDoc.exists) {
          functions.logger.info(`Chat ${solicitudId} ya existe.`); return null;
        }

        const usuarioInfoDoc = await db.collection("usuarios").doc(usuarioId).get();
        const prestadorInfoDoc = await db.collection("prestadores").doc(prestadorId).get();
        const ahora = admin.firestore.Timestamp.now();
        const nuevoChatData: ChatData = {
          solicitudServicioId: solicitudId, participantesUids: [usuarioId, prestadorId].sort(),
          participantesInfo: {
            [usuarioId]: {nombre: (usuarioInfoDoc.data() as UserData)?.nombre || `Usuario ${usuarioId.substring(0, 5)}`, rol: "usuario"},
            [prestadorId]: {nombre: (prestadorInfoDoc.data() as ProviderData)?.nombre || `Prestador ${prestadorId.substring(0, 5)}`, rol: "prestador"},
          },
          fechaCreacion: ahora, ultimaActualizacion: ahora, estadoChat: "activo", conteoNoLeido: {[usuarioId]: 0, [prestadorId]: 0}
        };
        await chatDocRef.set(nuevoChatData);
        await logActivity("sistema", "sistema", "CHAT_CREADO", `Chat creado para solicitud ${solicitudId}.`, {tipo: "chat", id: solicitudId}, {solicitudServicioId: solicitudId});
        const serviceTitle = afterData.titulo || "el servicio";
        await sendNotification(usuarioId, "usuario", "Chat Habilitado", `Ya puedes chatear sobre "${serviceTitle}".`, {chatId: solicitudId, solicitudId: solicitudId});
        await sendNotification(prestadorId, "prestador", "Chat Habilitado", `Ya puedes chatear sobre "${serviceTitle}".`, {chatId: solicitudId, solicitudId: solicitudId});
      } catch (error) {
        functions.logger.error(`[ChatCreate ${solicitudId}] Error:`, error);
      }
    }
    return null;
  });

export const canjearPuntosPromocion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida para canjear puntos.");
  }
  const usuarioId = context.auth.uid;
  const {promocionId} = data;

  if (!promocionId || typeof promocionId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'promocionId'.");
  }

  const usuarioRef = db.collection("usuarios").doc(usuarioId);
  const promocionRef = db.collection("promociones").doc(promocionId);
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const usuarioDoc = await transaction.get(usuarioRef);
      const promocionDoc = await transaction.get(promocionRef);

      if (!usuarioDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      }
      if (!promocionDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Promoción ${promocionId} no encontrada.`);
      }

      const usuarioData = usuarioDoc.data() as UserData;
      const promocionData = promocionDoc.data() as PromocionFidelidad;

      if (!promocionData.activo) {
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción no está activa.");
      }
      if (promocionData.fechaExpiracion && promocionData.fechaExpiracion.toMillis() < now.toMillis()) {
        transaction.update(promocionRef, {activo: false});
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción ha expirado.");
      }
      if (typeof promocionData.usosDisponibles === "number" && promocionData.usosDisponibles <= 0) {
        transaction.update(promocionRef, {activo: false});
        throw new functions.https.HttpsError("failed-precondition", "Esta promoción se ha agotado.");
      }
      if ((usuarioData.puntosAcumulados || 0) < promocionData.puntosRequeridos) {
        throw new functions.https.HttpsError("failed-precondition", `No tienes suficientes puntos. Necesitas ${promocionData.puntosRequeridos}, tienes ${usuarioData.puntosAcumulados || 0}.`);
      }

      const historialCanje: HistorialPuntoUsuario = {
        promocionId: promocionId,
        tipo: "canjeados",
        puntos: -promocionData.puntosRequeridos,
        fecha: now,
        descripcion: `Canje de promoción: ${promocionData.descripcion}`,
      };
      transaction.update(usuarioRef, {
        puntosAcumulados: admin.firestore.FieldValue.increment(-promocionData.puntosRequeridos),
        historialPuntos: admin.firestore.FieldValue.arrayUnion(historialCanje),
      });

      if (typeof promocionData.usosDisponibles === "number") {
        transaction.update(promocionRef, {
          usosDisponibles: admin.firestore.FieldValue.increment(-1),
        });
      }

      await logActivity(usuarioId, "usuario", "PUNTOS_FIDELIDAD_CANJEADOS", `Usuario canjeó ${promocionData.puntosRequeridos} puntos por promoción '${promocionData.descripcion}'.`, {tipo: "promocion_fidelidad", id: promocionId}, {puntosGastados: promocionData.puntosRequeridos, promocionId});

      return {
        success: true,
        message: `¡Promoción "${promocionData.descripcion}" canjeada exitosamente!`,
        descuentoAplicable: {
          tipo: promocionData.tipoDescuento,
          valor: promocionData.valorDescuento,
          codigo: promocionData.codigoPromocional,
        },
      };
    });
  } catch (error: any) {
    functions.logger.error(`Error al canjear puntos para promoción ${promocionId} por usuario ${usuarioId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar el canje de puntos.", error.message);
  }
});

export const obtenerTraduccion = functions.https.onCall(async (data, context) => {
  const {claveUnica, idiomaSolicitado} = data;

  if (!claveUnica || typeof claveUnica !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'claveUnica' (string).");
  }
  if (!idiomaSolicitado || typeof idiomaSolicitado !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'idiomaSolicitado' (string, ej: 'es', 'en').");
  }

  const logActorId = context.auth?.uid || "sistema_anonimo";
  const logActorRol = context.auth?.uid ? "usuario" : "sistema";

  try {
    const idiomaRef = db.collection("idiomas").doc(idiomaSolicitado);
    const docSnap = await idiomaRef.get();
    let textoTraducido: string | undefined = undefined;

    if (docSnap.exists) {
      const idiomaData = docSnap.data() as IdiomaDocumentoFirestore;
      textoTraducido = idiomaData.recursos?.[claveUnica];
    }

    if (textoTraducido === undefined && idiomaSolicitado !== DEFAULT_LANGUAGE_CODE) {
      functions.logger.warn(`[obtenerTraduccion] Clave '${claveUnica}' no encontrada en idioma '${idiomaSolicitado}'. Intentando con idioma por defecto '${DEFAULT_LANGUAGE_CODE}'.`);
      const defaultIdiomaRef = db.collection("idiomas").doc(DEFAULT_LANGUAGE_CODE);
      const defaultDocSnap = await defaultIdiomaRef.get();
      if (defaultDocSnap.exists) {
        const defaultIdiomaData = defaultDocSnap.data() as IdiomaDocumentoFirestore;
        textoTraducido = defaultIdiomaData.recursos?.[claveUnica];
      }
    }

    if (textoTraducido === undefined) {
      functions.logger.error(`[obtenerTraduccion] Clave '${claveUnica}' no encontrada en idioma '${idiomaSolicitado}' ni en el idioma por defecto.`);
      await logActivity(logActorId, logActorRol, "TRADUCCION_SOLICITADA", `Clave de traducción no encontrada: ${claveUnica} para idioma ${idiomaSolicitado}.`, {tipo: "idioma", id: idiomaSolicitado}, {clave: claveUnica, resultado: "no_encontrada"});
      return {traduccion: `[${claveUnica}]`, idiomaDevuelto: null, error: "Clave de traducción no encontrada."};
    }

    await logActivity(logActorId, logActorRol, "TRADUCCION_SOLICITADA", `Traducción solicitada para clave: ${claveUnica}, idioma: ${idiomaSolicitado}.`, {tipo: "idioma", id: idiomaSolicitado}, {clave: claveUnica, resultado: "encontrada"});
    return {traduccion: textoTraducido, idiomaDevuelto: idiomaSolicitado};
  } catch (error: any) {
    functions.logger.error(`[obtenerTraduccion] Error al obtener traducción para clave '${claveUnica}', idioma '${idiomaSolicitado}':`, error);
    await logActivity(logActorId, logActorRol, "TRADUCCION_SOLICITADA", `Error al obtener traducción para clave: ${claveUnica}, idioma: ${idiomaSolicitado}.`, {tipo: "idioma", id: idiomaSolicitado}, {clave: claveUnica, error: error.message});
    throw new functions.https.HttpsError("internal", "Error al procesar la solicitud de traducción.", error.message);
  }
});

export const enviarRecordatoriosProgramados = functions.pubsub
  .schedule("every 15 minutes")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const remindersQuery = db.collection("recordatorios")
      .where("enviado", "==", false)
      .where("fechaProgramada", "<=", now);

    const snapshot = await remindersQuery.get();
    if (snapshot.empty) {
      functions.logger.log("[EnviarRecordatorios] No hay recordatorios para enviar.");
      return null;
    }

    const promises = snapshot.docs.map(async (doc) => {
      const reminder = doc.data() as Recordatorio;
      const reminderId = doc.id;

      try {
        const userDoc = await db.collection("usuarios").doc(reminder.usuarioId).get();
        if (!userDoc.exists) {
          functions.logger.error(`[EnviarRecordatorios] Usuario ${reminder.usuarioId} no encontrado para recordatorio ${reminderId}.`);
          await doc.ref.update({enviado: true, errorEnvio: "Usuario no encontrado"});
          return;
        }
        const userData = userDoc.data() as UserData;
        const tokens = userData.fcmTokens;

        if (tokens && tokens.length > 0) {
          let finalMessage = reminder.mensaje;
          if (reminder.datosAdicionales?.tituloServicio && reminder.datosAdicionales?.nombrePrestador && reminder.datosAdicionales?.fechaHoraServicioIso) {
            const serviceDateTime = new Date(reminder.datosAdicionales.fechaHoraServicioIso);
            const formattedTime = serviceDateTime.toLocaleTimeString("es-MX", {hour: "2-digit", minute: "2-digit"});
            finalMessage = `Recordatorio: Tu servicio "${reminder.datosAdicionales.tituloServicio}" con ${reminder.datosAdicionales.nombrePrestador} es hoy a las ${formattedTime}.`;
          }

          const payload = {
            notification: {
              title: "Recordatorio de Servicio",
              body: finalMessage,
            },
            data: {
              servicioId: reminder.servicioId,
              tipoRecordatorio: reminder.tipo,
            },
          };
          await admin.messaging().sendToDevice(tokens, payload);
          await doc.ref.update({enviado: true, fechaEnvio: admin.firestore.Timestamp.now(), errorEnvio: null, intentosEnvio: admin.firestore.FieldValue.increment(1)});
          functions.logger.info(`[EnviarRecordatorios] Recordatorio ${reminderId} enviado a usuario ${reminder.usuarioId}.`);
          await logActivity("sistema", "sistema", "NOTIFICACION_RECORDATORIO_ENVIADA", `Recordatorio ${reminder.tipo} enviado a usuario ${reminder.usuarioId} para servicio ${reminder.servicioId}.`, {tipo: "recordatorio", id: reminderId});
        } else {
          functions.logger.warn(`[EnviarRecordatorios] Usuario ${reminder.usuarioId} no tiene tokens FCM para recordatorio ${reminderId}.`);
          await doc.ref.update({enviado: true, errorEnvio: "Sin tokens FCM", fechaEnvio: admin.firestore.Timestamp.now()});
        }
      } catch (error: any) {
        functions.logger.error(`[EnviarRecordatorios] Error enviando recordatorio ${reminderId}:`, error);
        const intentos = (reminder.intentosEnvio || 0) + 1;
        if (intentos >= 3) {
          await doc.ref.update({enviado: true, errorEnvio: `Error tras ${intentos} intentos: ${error.message}`, intentosEnvio: intentos});
        } else {
          await doc.ref.update({errorEnvio: error.message, intentosEnvio: intentos});
        }
      }
    });

    await Promise.all(promises);
    return null;
  });

function isPointInPolygon(point: CoordenadaFirestore, polygon: CoordenadaFirestore[]): boolean {
  let crossings = 0;
  const n = polygon.length;
  if (n < 3) return false;

  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];

    if (((p1.lat <= point.lat && point.lat < p2.lat) || (p2.lat <= point.lat && point.lat < p1.lat)) &&
        (point.lng < (p2.lng - p1.lng) * (point.lat - p1.lat) / (p2.lat - p1.lat) + p1.lng)) {
      crossings++;
    }
  }
  return crossings % 2 === 1;
}

export const verificarReglasDeZona = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida para verificar reglas de zona.");
  }
  const actorId = context.auth.uid;
  const {lat, lng} = data;

  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren coordenadas 'lat' y 'lng' numéricas.");
  }
  const puntoUsuario: CoordenadaFirestore = {lat, lng};

  try {
    const zonasSnapshot = await db.collection("zonas_preferentes").where("activa", "==", true).orderBy("prioridad", "desc").get();
    let zonaAplicada: ZonaPreferenteFirestore | null = null;

    if (!zonasSnapshot.empty) {
      for (const doc of zonasSnapshot.docs) {
        const zona = doc.data() as ZonaPreferenteFirestore;
        if (zona.poligono && zona.poligono.length >= 3) {
          if (isPointInPolygon(puntoUsuario, zona.poligono)) {
            zonaAplicada = {id: doc.id, ...zona};
            break;
          }
        }
      }
    }

    if (zonaAplicada) {
      await logActivity(actorId, "usuario", "REGLAS_ZONA_CONSULTADAS", `Usuario en zona preferente '${zonaAplicada.nombre}' (ID: ${zonaAplicada.id}).`, {tipo: "zona_preferente", id: zonaAplicada.id || "N/A"}, {lat, lng});
      return {
        enZona: true,
        zonaId: zonaAplicada.id,
        nombreZona: zonaAplicada.nombre,
        reglas: zonaAplicada.reglas,
        descripcion: zonaAplicada.descripcion,
      };
    } else {
      await logActivity(actorId, "usuario", "REGLAS_ZONA_CONSULTADAS", "Usuario no se encuentra en ninguna zona preferente activa.", undefined, {lat, lng});
      return {enZona: false, zonaId: null, nombreZona: null, reglas: null};
    }
  } catch (error: any) {
    functions.logger.error("Error al verificar reglas de zona:", error);
    await logActivity(actorId, "usuario", "REGLAS_ZONA_CONSULTADAS", `Error al verificar zona para ${lat},${lng}: ${error.message}`, undefined, {lat, lng, error: error.message});
    throw new functions.https.HttpsError("internal", "Error al procesar la verificación de zona.", error.message);
  }
});

export const onZoneChangeLog = functions.firestore
  .document("zonas_preferentes/{zonaId}")
  .onWrite(async (change, context) => {
    const zonaId = context.params.zonaId;
    const adminActorId = "admin_sistema";

    if (!change.before.exists) {
      const newData = change.after.data() as ZonaPreferenteFirestore;
      await logActivity(adminActorId, "admin", "ADMIN_ZONA_MODIFICADA", `Nueva zona preferente creada: '${newData.nombre}' (ID: ${zonaId}).`, {tipo: "zona_preferente", id: zonaId}, {accionRealizada: "creacion", detalles: newData});
    } else if (!change.after.exists) {
      const oldData = change.before.data() as ZonaPreferenteFirestore;
      await logActivity(adminActorId, "admin", "ADMIN_ZONA_MODIFICADA", `Zona preferente eliminada: '${oldData.nombre}' (ID: ${zonaId}).`, {tipo: "zona_preferente", id: zonaId}, {accionRealizada: "eliminacion"});
    } else {
      const newData = change.after.data() as ZonaPreferenteFirestore;
      const oldData = change.before.data() as ZonaPreferenteFirestore;
      await logActivity(adminActorId, "admin", "ADMIN_ZONA_MODIFICADA", `Zona preferente actualizada: '${newData.nombre}' (ID: ${zonaId}). Activa: ${newData.activa}.`, {tipo: "zona_preferente", id: zonaId}, {accionRealizada: "actualizacion", cambios: {old: oldData, new: newData}});
    }
    return null;
  });

export const crearSolicitudSoporte = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const solicitanteId = context.auth.uid;
  const {
    categoria,
    descripcion,
    rolSolicitante,
    prioridad,
    referenciaId,
    adjuntosUrls,
  } = data;

  if (!categoria || typeof categoria !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'categoria' es requerido.");
  }
  if (!descripcion || typeof descripcion !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'descripcion' es requerido.");
  }
  if (!rolSolicitante || (rolSolicitante !== "usuario" && rolSolicitante !== "prestador")) {
    throw new functions.https.HttpsError("invalid-argument", "El campo 'rolSolicitante' debe ser 'usuario' o 'prestador'.");
  }

  const now = admin.firestore.Timestamp.now();

  const nuevaSolicitudData: Omit<SoporteTicketData, "id" | "etiquetas"> = {
    solicitanteId: solicitanteId,
    rolSolicitante: rolSolicitante as "usuario" | "prestador",
    categoria: categoria,
    estado: "pendiente",
    descripcion: descripcion,
    historialMensajes: [
      {
        remitenteId: solicitanteId,
        mensaje: descripcion,
        timestamp: now,
      },
    ],
    fechaCreacion: now,
    fechaActualizacion: now,
    ...(prioridad && {prioridad: prioridad as SoporteTicketData["prioridad"]}),
    ...(referenciaId && {referenciaId: referenciaId as string}),
    ...(adjuntosUrls && Array.isArray(adjuntosUrls) && {adjuntosUrls: adjuntosUrls as string[]}),
  };

  try {
    const solicitudRef = await db.collection("tickets_soporte").add(nuevaSolicitudData);
    await logActivity(
      solicitanteId,
      rolSolicitante as "usuario" | "prestador",
      "TICKET_SOPORTE_CREADO",
      `Nuevo ticket de soporte #${solicitudRef.id} creado por ${rolSolicitante} ${solicitanteId}. Categoría: ${categoria}.`,
      {tipo: "ticket_soporte", id: solicitudRef.id},
      {categoria, prioridad: prioridad || "normal"}
    );

    return {
      success: true,
      message: "Tu solicitud de soporte ha sido enviada. Nuestro equipo te contactará pronto.",
      ticketId: solicitudRef.id,
    };
  } catch (error: any) {
    functions.logger.error(`Error al crear ticket de soporte para ${solicitanteId}:`, error);
    await logActivity(
      solicitanteId,
      rolSolicitante as "usuario" | "prestador",
      "TICKET_SOPORTE_CREADO",
      `Error al crear ticket de soporte. Categoría: ${categoria}. Error: ${error.message}`,
      undefined,
      {categoria, error: error.message}
    );
    throw new functions.https.HttpsError("internal", "No se pudo registrar tu solicitud de soporte.", error.message);
  }
});

export const rateServiceByUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const userId = context.auth.uid;
  const {
    servicioId,
    estrellas,
    comentario,
    indicadoresRendimiento,
    aspectosPositivos,
    areasDeMejora,
  } = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'servicioId'.");
  }
  if (typeof estrellas !== "number" || estrellas < 1 || estrellas > 5) {
    throw new functions.https.HttpsError("invalid-argument", "La 'calificacion' (estrellas) debe ser un número entre 1 y 5.");
  }

  const servicioRef = db.collection("solicitudes_servicio").doc(servicioId);

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceRequest;

      if (servicioData.usuarioId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No puedes calificar este servicio.");
      }
      if (servicioData.status !== "completado_por_usuario" && servicioData.status !== "cerrado_automaticamente") {
        throw new functions.https.HttpsError("failed-precondition", `Solo se pueden calificar servicios en estado 'completado_por_usuario' o 'cerrado_automaticamente'. Estado actual: ${servicioData.status}`);
      }
      if (servicioData.calificacionUsuario) {
        throw new functions.https.HttpsError("already-exists", "Ya has calificado este servicio.");
      }

      const now = admin.firestore.Timestamp.now();
      const nuevaCalificacion: CalificacionDetallada = {
        estrellas: estrellas,
        fecha: now,
        ...(comentario && {comentario: comentario as string}),
        ...(indicadoresRendimiento && {indicadoresRendimiento: indicadoresRendimiento as IndicadoresRendimiento}),
        ...(aspectosPositivos && Array.isArray(aspectosPositivos) && {aspectosPositivos: aspectosPositivos as string[]}),
        ...(areasDeMejora && Array.isArray(areasDeMejora) && {areasDeMejora: areasDeMejora as string[]}),
      };

      const updates: Partial<ServiceRequest> & {updatedAt: admin.firestore.Timestamp} = {
        calificacionUsuario: nuevaCalificacion,
        updatedAt: now,
      };

      if (servicioData.calificacionPrestador) {
        updates.mutualRatingCompleted = true;
      }

      if (servicioData.status !== "en_disputa") {
        updates.status = "cerrado_con_calificacion";
      }


      transaction.update(servicioRef, updates);
      return {success: true, message: "Calificación registrada exitosamente."};
    });
  } catch (error: any) {
    functions.logger.error(`Error al calificar servicio ${servicioId} por usuario ${userId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la calificación.", error.message);
  }
});

export const buscarPrestadoresInteligente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const {textoBusqueda, latUsuario, lngUsuario} = data;

  if (!textoBusqueda || typeof textoBusqueda !== "string" || typeof latUsuario !== "number" || typeof lngUsuario !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Se requieren 'textoBusqueda', 'latUsuario' y 'lngUsuario'.");
  }

  const textoBusquedaLower = textoBusqueda.toLowerCase();

  try {
    const prestadoresSnapshot = await db.collection("prestadores").get();
    const prestadoresCandidatos: PrestadorBuscado[] = [];

    for (const doc of prestadoresSnapshot.docs) {
      const provider = doc.data() as ProviderData;
      if (!provider.isAvailable || !provider.currentLocation) continue;

      let match = false;
      if (provider.nombre?.toLowerCase().includes(textoBusquedaLower)) match = true;
      if (!match && provider.empresa?.toLowerCase().includes(textoBusquedaLower)) match = true;
      if (!match && provider.specialties?.some((s) => s.toLowerCase().includes(textoBusquedaLower))) match = true;

      if (!match && provider.services) {
        for (const service of provider.services) {
          if (service.title.toLowerCase().includes(textoBusquedaLower)) {
            match = true; break;
          }
          if (service.description.toLowerCase().includes(textoBusquedaLower)) {
            match = true; break;
          }
          const categoryInfo = SERVICE_CATEGORIES.find((c) => c.id === service.category);
          if (categoryInfo?.name.toLowerCase().includes(textoBusquedaLower)) {
            match = true; break;
          }
          if (categoryInfo?.keywords.some((k) => k.toLowerCase().includes(textoBusquedaLower))) {
            match = true; break;
          }
        }
      }

      if (match) {
        const distanciaKm = calculateDistance(
          latUsuario,
          lngUsuario,
          provider.currentLocation.lat,
          provider.currentLocation.lng
        );

        prestadoresCandidatos.push({
          id: doc.id,
          nombre: provider.nombre || "N/A",
          empresa: provider.empresa,
          distanciaKm: parseFloat(distanciaKm.toFixed(1)),
          calificacion: provider.rating || 0,
          avatarUrl: provider.avatarUrl,
          categoriaPrincipal: provider.services?.[0]?.category ? (SERVICE_CATEGORIES.find(c=>c.id === provider.services?.[0]?.category)?.name || provider.services?.[0]?.category) : "General",
        });
      }
    }

    prestadoresCandidatos.sort((a, b) => {
      if (a.distanciaKm < b.distanciaKm) return -1;
      if (a.distanciaKm > b.distanciaKm) return 1;
      if (a.calificacion > b.calificacion) return -1;
      if (a.calificacion < b.calificacion) return 1;
      return 0;
    });

    await logActivity(context.auth.uid, "usuario", "BUSQUEDA_PRESTADORES", `Usuario buscó: "${textoBusqueda}". Resultados: ${prestadoresCandidatos.length}.`, undefined, {texto: textoBusqueda, lat: latUsuario, lng: lngUsuario});

    return prestadoresCandidatos;
  } catch (error: any) {
    functions.logger.error("Error en buscarPrestadoresInteligente:", error);
    throw new functions.https.HttpsError("internal", "Error al buscar prestadores.", error.message);
  }
});


const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


export const reportarProblemaServicio = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const idUsuarioReportante = context.auth.uid;
  const { idServicio, rol, descripcionProblema, archivoAdjuntoURL } = data;

  if (!idServicio || typeof idServicio !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'idServicio'.");
  }
  if (!rol || (rol !== "usuario" && rol !== "prestador")) {
    throw new functions.https.HttpsError("invalid-argument", "El 'rol' del reportante ('usuario' o 'prestador') es requerido.");
  }
  if (!descripcionProblema || typeof descripcionProblema !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'descripcionProblema'.");
  }

  const servicioRef = db.collection("solicitudes_servicio").doc(idServicio);
  const reportesRef = db.collection("reportes");
  const garantiasRef = db.collection("garantiasPendientes");
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${idServicio} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceRequest;

      if (idUsuarioReportante !== servicioData.usuarioId && idUsuarioReportante !== servicioData.prestadorId) {
        throw new functions.https.HttpsError("permission-denied", "No participaste en este servicio.");
      }
      if (rol === "usuario" && idUsuarioReportante !== servicioData.usuarioId) {
        throw new functions.https.HttpsError("permission-denied", "Tu rol no coincide con tu participación en este servicio.");
      }
      if (rol === "prestador" && idUsuarioReportante !== servicioData.prestadorId) {
        throw new functions.https.HttpsError("permission-denied", "Tu rol no coincide con tu participación en este servicio.");
      }

      if (!servicioData.fechaFinalizacionEfectiva) {
        throw new functions.https.HttpsError("failed-precondition", "El servicio aún no ha finalizado para poder reportar un problema.");
      }

      const fechaFinalizacion = (servicioData.fechaFinalizacionEfectiva as admin.firestore.Timestamp).toDate();
      const plazoMaximoReporte = new Date(fechaFinalizacion.getTime() + PLAZO_REPORTE_DIAS * 24 * 60 * 60 * 1000);

      if (now.toDate() > plazoMaximoReporte) {
        // return {status: "error", message: "El plazo para reportar problemas para este servicio ha expirado."}; // Return for callable
        throw new functions.https.HttpsError("failed-precondition", "El plazo para reportar problemas para este servicio ha expirado.");
      }

      if (servicioData.reporteActivoId) {
        const reporteExistenteDoc = await transaction.get(reportesRef.doc(servicioData.reporteActivoId));
        if (reporteExistenteDoc.exists) {
           // return {status: "error", message: "Ya existe un reporte activo para este servicio."};
           throw new functions.https.HttpsError("already-exists", "Ya existe un reporte activo para este servicio.");
        }
      }

      const nuevoReporteRef = reportesRef.doc();
      const reporteData: ReporteServicioData = {
        idServicio: idServicio,
        idUsuarioReportante: idUsuarioReportante,
        rolReportante: rol as "usuario" | "prestador",
        descripcionProblema: descripcionProblema,
        fechaReporte: now,
        estadoReporte: "pendiente_revision_admin",
        garantiaActivada: false,
        ...(archivoAdjuntoURL && {archivoAdjuntoURL: archivoAdjuntoURL as string}),
        idServicioOriginalData: {
          titulo: servicioData.titulo,
          status: servicioData.status,
          paymentStatus: servicioData.paymentStatus,
          montoCobrado: servicioData.montoCobrado
        }
      };
      transaction.set(nuevoReporteRef, reporteData);

      const updateServicio: Partial<ServiceRequest> = {
        reporteActivoId: nuevoReporteRef.id,
        estadoDisputa: "abierta",
        updatedAt: now,
      };
      if (servicioData.paymentStatus === "retenido_para_liberacion" || servicioData.paymentStatus === "liberado_al_proveedor") {
        updateServicio.paymentStatus = "congelado_por_disputa";
      }
      transaction.update(servicioRef, updateServicio);

      await logActivity(idUsuarioReportante, rol as "usuario" | "prestador", "REPORTE_PROBLEMA_CREADO", `Reporte #${nuevoReporteRef.id} creado para servicio ${idServicio} por ${rol} ${idUsuarioReportante}.`, {tipo: "reporte_servicio", id: nuevoReporteRef.id}, {descripcion: descripcionProblema});

      const contraparteId = rol === "usuario" ? servicioData.prestadorId : servicioData.usuarioId;
      const contraparteRol = rol === "usuario" ? "prestador" : "usuario";
      await sendNotification(contraparteId, contraparteRol, "Reporte de Problema Recibido", `Se ha registrado un reporte para el servicio "${servicioData.titulo || idServicio}". Un administrador lo revisará pronto.`, {servicioId: idServicio, reporteId: nuevoReporteRef.id});

      if (rol === "usuario") {
        const usuarioDocSnap = await db.collection("usuarios").doc(idUsuarioReportante).get();
        const esPremium = (usuarioDocSnap.data() as UserData)?.isPremium || false;

        if (esPremium) {
          const nuevaGarantiaRef = garantiasRef.doc();
          const garantiaData: GarantiaPendienteData = {
            idServicio: idServicio,
            idUsuario: idUsuarioReportante,
            idPrestador: servicioData.prestadorId,
            idReporte: nuevoReporteRef.id,
            fechaSolicitudGarantia: now,
            estadoGarantia: "pendiente_revision",
            descripcionProblemaOriginal: descripcionProblema,
            detallesServicioOriginal: { titulo: servicioData.titulo, status: servicioData.status }
          };
          transaction.set(nuevaGarantiaRef, garantiaData);
          transaction.update(nuevoReporteRef, { garantiaActivada: true, idGarantiaPendiente: nuevaGarantiaRef.id });

          await logActivity(idUsuarioReportante, "usuario", "GARANTIA_REGISTRADA", `Garantía #${nuevaGarantiaRef.id} registrada para reporte ${nuevoReporteRef.id} de usuario premium.`, {tipo: "garantia", id: nuevaGarantiaRef.id});
          return { status: "garantiaActivada", reporteId: nuevoReporteRef.id, garantiaId: nuevaGarantiaRef.id };
        }
      }
      return { status: "reporteRegistrado", reporteId: nuevoReporteRef.id };
    });
  } catch (error: any) {
    functions.logger.error(`Error al reportar problema para servicio ${idServicio}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar el reporte.", error.message);
  }
});


export const reactivarServicioRecurrente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un usuario autenticado.");
  }
  const initiatorId = context.auth.uid;
  const { idServicioAnterior, accion, notasIniciador, nuevaFecha, nuevaHora } = data;

  if (!idServicioAnterior || typeof idServicioAnterior !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'idServicioAnterior'.");
  }
  if (!accion || (accion !== "solicitar_nuevamente" && accion !== "ofrecer_nuevamente")) {
    throw new functions.https.HttpsError("invalid-argument", "La 'accion' debe ser 'solicitar_nuevamente' o 'ofrecer_nuevamente'.");
  }

  const servicioAnteriorRef = db.collection("solicitudes_servicio").doc(idServicioAnterior);

  try {
    const servicioAnteriorDoc = await servicioAnteriorRef.get();
    if (!servicioAnteriorDoc.exists) {
      throw new functions.https.HttpsError("not-found", `Servicio anterior con ID ${idServicioAnterior} no encontrado.`);
    }
    const servicioAnteriorData = servicioAnteriorDoc.data() as ServiceRequest;

    let initiatorRoleInOldService: "usuario" | "prestador";
    if (initiatorId === servicioAnteriorData.usuarioId) {
      initiatorRoleInOldService = "usuario";
    } else if (initiatorId === servicioAnteriorData.prestadorId) {
      initiatorRoleInOldService = "prestador";
    } else {
      throw new functions.https.HttpsError("permission-denied", "No participaste en el servicio anterior.");
    }

    if (accion === "solicitar_nuevamente" && initiatorRoleInOldService !== "usuario") {
      throw new functions.https.HttpsError("failed-precondition", "Solo el usuario original puede 'solicitar_nuevamente'.");
    }
    if (accion === "ofrecer_nuevamente" && initiatorRoleInOldService !== "prestador") {
      throw new functions.https.HttpsError("failed-precondition", "Solo el prestador original puede 'ofrecer_nuevamente'.");
    }

    const now = admin.firestore.Timestamp.now();
    const nuevaSolicitudRef = db.collection("solicitudes_servicio").doc();

    const newServiceRequestData: Partial<ServiceRequest> = {
      usuarioId: servicioAnteriorData.usuarioId,
      prestadorId: servicioAnteriorData.prestadorId,
      titulo: `Reactivación: ${servicioAnteriorData.titulo || "Servicio Anterior"}`,
      serviceType: servicioAnteriorData.serviceType,
      location: servicioAnteriorData.location,
      notes: notasIniciador || `Reactivación de servicio: ${idServicioAnterior}`,
      precio: servicioAnteriorData.precio,
      hourlyRate: servicioAnteriorData.hourlyRate,
      durationHours: servicioAnteriorData.durationHours,
      selectedFixedServices: servicioAnteriorData.selectedFixedServices,
      totalAmount: servicioAnteriorData.totalAmount,
      estimatedTotal: servicioAnteriorData.estimatedTotal,
      originatingServiceId: idServicioAnterior,
      isRecurringAttempt: true,
      actorDelCambioId: initiatorId,
      actorDelCambioRol: initiatorRoleInOldService,
      createdAt: now,
      updatedAt: now,
      paymentStatus: "no_aplica", // Payment will be handled upon confirmation
    };

    if (nuevaFecha) newServiceRequestData.serviceDate = nuevaFecha;
    if (nuevaHora) newServiceRequestData.serviceTime = nuevaHora;

    let targetNotificationUserId = "";
    let targetNotificationUserType: "usuario" | "prestador" = "usuario";
    let notificationTitle = "";
    let notificationBody = "";
    let logAction: ActivityLogAction = "SOLICITUD_CREADA";

    if (accion === "solicitar_nuevamente") {
      newServiceRequestData.status = "agendado"; // Provider needs to confirm
      newServiceRequestData.reactivationOfferedBy = "usuario";
      targetNotificationUserId = servicioAnteriorData.prestadorId;
      targetNotificationUserType = "prestador";
      notificationTitle = "Solicitud de Reactivación de Servicio";
      notificationBody = `El usuario ${initiatorId} desea reactivar el servicio "${servicioAnteriorData.titulo || idServicioAnterior}". Por favor, revisa y confirma los detalles.`;
      logAction = "SERVICIO_REACTIVADO_SOLICITUD";
    } else { // "ofrecer_nuevamente"
      newServiceRequestData.status = "pendiente_confirmacion_usuario"; // User needs to confirm
      newServiceRequestData.reactivationOfferedBy = "prestador";
      targetNotificationUserId = servicioAnteriorData.usuarioId;
      targetNotificationUserType = "usuario";
      notificationTitle = "Oferta para Reactivar Servicio";
      notificationBody = `El prestador ${initiatorId} te ofrece reactivar el servicio "${servicioAnteriorData.titulo || idServicioAnterior}". Por favor, revisa y confirma si deseas proceder.`;
      logAction = "SERVICIO_REACTIVADO_OFERTA";
    }

    await nuevaSolicitudRef.set(newServiceRequestData);

    await logActivity(
      initiatorId,
      initiatorRoleInOldService,
      logAction,
      `Intento de reactivación (${accion}) para servicio anterior ${idServicioAnterior}. Nueva solicitud: ${nuevaSolicitudRef.id}.`,
      { tipo: "solicitud_servicio", id: nuevaSolicitudRef.id },
      { idServicioAnterior, notas: notasIniciador }
    );

    await sendNotification(targetNotificationUserId, targetNotificationUserType, notificationTitle, notificationBody, {
      newServiceRequestId: nuevaSolicitudRef.id,
      originatingServiceId: idServicioAnterior,
    });

    return { success: true, newServiceRequestId: nuevaSolicitudRef.id };
  } catch (error: any) {
    functions.logger.error(`Error en reactivarServicioRecurrente para ${idServicioAnterior}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al procesar la reactivación del servicio.", error.message);
  }
});

export const startServiceByProvider = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "La función debe ser llamada por un prestador autenticado.");
  }
  const providerId = context.auth.uid;
  const { servicioId } = data;

  if (!servicioId || typeof servicioId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'servicioId'.");
  }

  const servicioRef = db.collection("solicitudes_servicio").doc(servicioId);

  try {
    return await db.runTransaction(async (transaction) => {
      const servicioDoc = await transaction.get(servicioRef);
      if (!servicioDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio con ID ${servicioId} no encontrado.`);
      }
      const servicioData = servicioDoc.data() as ServiceRequest;

      if (servicioData.prestadorId !== providerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el prestador asignado a este servicio.");
      }

      const validPreviousStates: ServiceRequestStatus[] = ["confirmada_prestador", "pagada", "en_camino_proveedor"];
      if (!validPreviousStates.includes(servicioData.status)) {
        throw new functions.https.HttpsError("failed-precondition", `No se puede iniciar el servicio desde el estado actual '${servicioData.status}'. Estados válidos previos: ${validPreviousStates.join(", ")}.`);
      }

      const now = admin.firestore.Timestamp.now();
      const updates: Partial<ServiceRequest> = {
        status: "servicio_iniciado",
        actualStartTime: now,
        updatedAt: now,
        actorDelCambioId: providerId,
        actorDelCambioRol: "prestador",
      };

      transaction.update(servicioRef, updates);

      await logActivity(
        providerId,
        "prestador",
        "CAMBIO_ESTADO_SOLICITUD",
        `Prestador ${providerId} inició el servicio ${servicioId}.`,
        { tipo: "solicitud_servicio", id: servicioId },
        { estadoAnterior: servicioData.status, estadoNuevo: "servicio_iniciado" }
      );

      await sendNotification(
        servicioData.usuarioId,
        "usuario",
        "¡Servicio Iniciado!",
        `El prestador ${providerId} (ID: ${providerId.substring(0,5)}) ha comenzado el servicio "${servicioData.titulo || "reservado"}".`,
        { servicioId: servicioId, nuevoEstado: "servicio_iniciado" }
      );

      return { success: true, message: "Servicio marcado como iniciado correctamente." };
    });
  } catch (error: any) {
    functions.logger.error(`Error al iniciar servicio ${servicioId} por prestador ${providerId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al iniciar el servicio.", error.message);
  }
});

export const confirmServiceAndHandlePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Autenticación requerida.");
  }
  const userId = context.auth.uid;
  const { serviceId, serviceDetails, paymentAmount } = data;

  if (!serviceId || typeof serviceId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'serviceId'.");
  }
  if (typeof paymentAmount !== "number" || paymentAmount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere 'paymentAmount' válido y positivo.");
  }

  const originalServiceRef = db.collection("solicitudes_servicio").doc(serviceId);
  const servicioConfirmadoRef = db.collection("serviciosConfirmados").doc(serviceId);
  const pagoPendienteRef = db.collection("pagosPendientes").doc(serviceId);
  const now = admin.firestore.Timestamp.now();

  try {
    return await db.runTransaction(async (transaction) => {
      const originalServiceDoc = await transaction.get(originalServiceRef);
      if (!originalServiceDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Servicio original con ID ${serviceId} no encontrado.`);
      }
      const originalServiceData = originalServiceDoc.data() as ServiceRequest;

      if (originalServiceData.usuarioId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el usuario de este servicio.");
      }

      // Validate current state of the original service
      // Example: Allow confirmation if provider has confirmed and payment is pending
      if (originalServiceData.status !== "confirmada_prestador" && originalServiceData.status !== "pendiente_confirmacion_usuario") {
        // If status is 'pendiente_confirmacion_usuario', it means the provider offered a reactivation and user is now accepting.
        // If 'confirmada_prestador', it means provider confirmed a user's request, and user is now paying/finalizing.
        throw new functions.https.HttpsError("failed-precondition", `El servicio no está en un estado válido para confirmación y pago. Estado actual: ${originalServiceData.status}`);
      }
      if (originalServiceData.paymentStatus !== "pendiente_cobro" && originalServiceData.paymentStatus !== "no_aplica") {
         // Allow 'no_aplica' if it's a reactivation offer being accepted
        if (!(originalServiceData.isRecurringAttempt && originalServiceData.reactivationOfferedBy === "prestador" && originalServiceData.paymentStatus === "no_aplica")) {
             throw new functions.https.HttpsError("failed-precondition", `El estado de pago del servicio no es 'pendiente_cobro' o no es una oferta de reactivación válida. Estado pago: ${originalServiceData.paymentStatus}`);
        }
      }


      // 1. Create ServicioConfirmado document
      const servicioConfirmadoPayload: ServicioConfirmadoData = {
        userId: userId,
        providerId: originalServiceData.prestadorId,
        paymentAmount: paymentAmount,
        status: "confirmado",
        confirmadoEn: now,
        puedeCancelarHasta: admin.firestore.Timestamp.fromMillis(now.toMillis() + MINUTOS_VENTANA_CANCELACION * 60 * 1000),
        iniciado: false, // Service is confirmed, not yet started
        ...(serviceDetails && { serviceDetails: serviceDetails as string }),
      };
      transaction.set(servicioConfirmadoRef, servicioConfirmadoPayload);

      // 2. Create PagoPendiente document
      const pagoPendientePayload: PagoPendienteData = {
        userId: userId,
        providerId: originalServiceData.prestadorId,
        paymentAmount: paymentAmount,
        retenido: true,
        status: "esperando_calificacion",
        creadoEn: now,
      };
      transaction.set(pagoPendienteRef, pagoPendientePayload);

      // 3. Update original ServiceRequest document
      const updateOriginalService: Partial<ServiceRequest> = {
        status: "pagada", // Service is now considered paid and confirmed by user
        paymentStatus: "retenido_para_liberacion",
        montoCobrado: paymentAmount,
        updatedAt: now,
        actorDelCambioId: userId,
        actorDelCambioRol: "usuario",
        cancellationWindowExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + MINUTOS_VENTANA_CANCELACION * 60 * 1000),
        paymentIntentId: `sim_pi_${serviceId}_${now.toMillis()}`, // Simulated payment intent ID
      };
      transaction.update(originalServiceRef, updateOriginalService);

      // 4. Log Activity
      await logActivity(
        userId,
        "usuario",
        "SERVICIO_CONFIRMADO_PAGADO",
        `Usuario confirmó y pagó servicio ${serviceId}. Monto: ${paymentAmount}. Detalles: ${serviceDetails || "N/A"}`,
        { tipo: "solicitud_servicio", id: serviceId },
        { paymentAmount, serviceDetails: serviceDetails || "N/A" }
      );

      // 5. Notify Provider
      await sendNotification(
        originalServiceData.prestadorId,
        "prestador",
        "¡Servicio Confirmado y Pagado!",
        `El usuario ha confirmado y pagado el servicio "${originalServiceData.titulo || serviceId}". Monto: $${paymentAmount}.`,
        { serviceId: serviceId, status: "pagada" }
      );

      return { success: true, message: "Servicio confirmado y pago retenido exitosamente." };
    });
  } catch (error: any) {
    functions.logger.error(`Error en confirmServiceAndHandlePayment para servicio ${serviceId}:`, error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Error al confirmar el servicio y procesar el pago.", error.message);
  }
});
