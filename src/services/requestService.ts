
// src/services/requestService.ts
"use client";
import type { ServiceRequest, FixedServiceRequest, HourlyServiceRequest, DemoUser, PaymentStatus, ServiceRequestStatus, ActivityLog, ActivityLogAction } from '@/types';
import { mockProviders, USER_FIXED_LOCATION, mockDemoUsers as mockUsers } from '@/lib/mockData';

// Simulación de una base de datos en memoria para las solicitudes de servicio
let serviceRequests: ServiceRequest[] = [];
let activityLogs: ActivityLog[] = []; // Simulación de la colección de logs

const RATING_WINDOW_DAYS = 7; // 7 días para calificar
const STANDARD_WARRANTY_DAYS = 3; 
const PREMIUM_WARRANTY_DAYS = 10;

const getMockUser = (userId: string): DemoUser | undefined => {
  return mockUsers.find(u => u.id === userId);
}

// --- MOCK PUSH NOTIFICATION FUNCTION ---
interface NotificationDetails {
  recipientId: string;
  recipientType: 'user' | 'provider';
  title: string;
  body: string;
  data?: { [key: string]: string }; // For additional data like requestId
}

const sendPushNotificationMock = (details: NotificationDetails) => {
  console.log(`[Mock FCM] Sending Push Notification:
    To: ${details.recipientType} ${details.recipientId}
    Title: ${details.title}
    Body: ${details.body}
    Data: ${JSON.stringify(details.data || {})}`);
  // In a real Cloud Function, this would use admin.messaging().sendToDevice(...)
};
// --- END MOCK PUSH NOTIFICATION FUNCTION ---

// --- MOCK ACTIVITY LOG FUNCTION (Client-Side Simulation) ---
const logActivity = (
  actorId: string,
  actorRol: 'usuario' | 'prestador' | 'sistema' | 'admin',
  accion: ActivityLogAction,
  descripcion: string,
  entidadAfectada?: { tipo: ActivityLog['entidadAfectada']['tipo'], id: string },
  detallesAdicionales?: Record<string, any>
) => {
  const newLog: ActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    actorId,
    actorRol,
    accion,
    descripcion,
    fecha: Date.now(),
    ...(entidadAfectada && { entidadAfectada }),
    ...(detallesAdicionales && { detallesAdicionales }),
  };
  activityLogs.push(newLog);
  console.log(`[Activity Log Simulated] ${newLog.descripcion}`, newLog);
  // En una aplicación real, esta lógica estaría principalmente en el backend (Cloud Functions)
  // para asegurar que los logs se escriban de forma confiable.
};
// --- END MOCK ACTIVITY LOG FUNCTION ---


export const createServiceRequest = async (
  requestData: Omit<FixedServiceRequest, 'id' | 'createdAt' | 'status' | 'paymentStatus'> | Omit<HourlyServiceRequest, 'id' | 'createdAt' | 'status' | 'paymentStatus'>
): Promise<ServiceRequest> => {
  console.log('[RequestService] Creando solicitud de servicio (simulado)...', requestData);

  const providerExists = mockProviders.some(p => p.id === requestData.providerId);
  if (!providerExists) {
    throw new Error(`Proveedor con ID ${requestData.providerId} no encontrado.`);
  }
  
  const providerDetails = mockProviders.find(p => p.id === requestData.providerId);

  let paymentStatus: PaymentStatus;
  let initialStatus: ServiceRequestStatus = 'agendado';

  if (requestData.serviceType === 'fixed') {
    // Si tiene selectedFixedServices y totalAmount, podría ser un "contratar ahora"
    if ((requestData as FixedServiceRequest).selectedFixedServices && (requestData as FixedServiceRequest).totalAmount) {
        paymentStatus = 'retenido_para_liberacion'; // Asumimos pago inmediato y retención
        initialStatus = 'pagada'; // Y el servicio está listo para iniciar o en camino
        logActivity(requestData.userId, 'usuario', 'PAGO_RETENIDO', `Pago retenido para nueva solicitud fija (ID temporal). Monto: ${(requestData as FixedServiceRequest).totalAmount}`);
    } else {
        paymentStatus = 'pendiente_cobro'; // Cita agendada, pago pendiente
    }
  } else { // hourly
    paymentStatus = 'no_aplica'; // Típicamente facturado después de la finalización del servicio
  }


  const newRequest: ServiceRequest = {
    ...requestData,
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
    status: initialStatus,
    paymentStatus: paymentStatus,
    titulo: requestData.serviceType === 'fixed' ? (requestData as FixedServiceRequest).selectedFixedServices?.[0]?.title || 'Servicio Agendado' : 'Servicio por Horas',
  };

  serviceRequests.push(newRequest);
  console.log('[RequestService] Solicitud creada:', newRequest);

  logActivity(
    requestData.userId,
    'usuario',
    'SOLICITUD_CREADA',
    `Usuario ${requestData.userId} creó solicitud para prestador ${requestData.providerId}. Tipo: ${requestData.serviceType}.`,
    { tipo: 'solicitud_servicio', id: newRequest.id },
    { detalles: requestData.notes || "Sin notas" }
  );


  // Notify Provider of new request
  sendPushNotificationMock({
    recipientId: newRequest.providerId,
    recipientType: 'provider',
    title: 'Nueva Solicitud de Servicio',
    body: `Has recibido una nueva solicitud de ${providerDetails?.name || 'un usuario'} para "${newRequest.titulo}".`,
    data: { requestId: newRequest.id, type: 'NEW_SERVICE_REQUEST' },
  });

  return newRequest;
};

export const getServiceRequestById = async (requestId: string): Promise<ServiceRequest | undefined> => {
  return serviceRequests.find(req => req.id === requestId);
};

export const updateServiceRequestByProvider = async (
  requestId: string,
  providerId: string,
  newStatus: ServiceRequestStatus, // Explicitly type newStatus
  providerNotes?: string
): Promise<ServiceRequest> => {
  const requestIndex = serviceRequests.findIndex(req => req.id === requestId && req.providerId === providerId);
  if (requestIndex === -1) {
    throw new Error(`Solicitud ${requestId} no encontrada para el proveedor ${providerId}.`);
  }

  const request = serviceRequests[requestIndex];
  const oldStatus = request.status;

  const validTransitionsForProvider: Partial<Record<ServiceRequestStatus, ServiceRequestStatus[]>> = {
    'agendado': ['confirmada_prestador', 'rechazada_prestador', 'cancelada_prestador'],
    'confirmada_prestador': ['en_camino_proveedor', 'cancelada_prestador'],
    'pagada': ['en_camino_proveedor', 'servicio_iniciado', 'cancelada_prestador'], // Prestador puede cancelar si ya está pagada
    'en_camino_proveedor': ['servicio_iniciado', 'cancelada_prestador'], // Podría cancelar en camino
    'servicio_iniciado': ['completado_por_prestador', 'cancelada_prestador'], // Podría cancelar si algo sale mal
  };

  if (!validTransitionsForProvider[request.status]?.includes(newStatus)) {
    throw new Error(`Transición de estado inválida de '${request.status}' a '${newStatus}' por el proveedor.`);
  }
  
  request.status = newStatus;
  request.updatedAt = Date.now();

  let userNotifTitle = '';
  let userNotifBody = '';

  if (newStatus === 'confirmada_prestador') {
    // Para citas (agendado -> confirmada_prestador), ahora podría estar pendiente de cobro
    if (request.paymentStatus === 'pendiente_cobro') {
      // Aquí se podría simular un intento de cobro automático, si es el flujo deseado
      // request.paymentStatus = 'retenido_para_liberacion'; // Si el cobro es exitoso
    }
    userNotifTitle = '¡Cita Confirmada!';
    userNotifBody = `Tu cita con ${mockProviders.find(p=>p.id === providerId)?.name || 'el proveedor'} ha sido confirmada.`;
  } else if (newStatus === 'rechazada_prestador' || newStatus === 'cancelada_prestador') {
    userNotifTitle = `Cita ${newStatus === 'rechazada_prestador' ? 'Rechazada' : 'Cancelada'}`;
    userNotifBody = `Tu cita con ${mockProviders.find(p=>p.id === providerId)?.name || 'el proveedor'} ha sido ${newStatus === 'rechazada_prestador' ? 'rechazada' : 'cancelada'} por el proveedor.`;
    if (request.paymentStatus === 'retenido_para_liberacion') {
        request.paymentStatus = 'reembolsado_total'; 
        userNotifBody += ' Se procesará un reembolso.';
        logActivity('sistema', 'sistema', 'PAGO_LIBERADO', `Reembolso total procesado para solicitud ${request.id} debido a cancelación/rechazo del proveedor.`, { tipo: 'solicitud_servicio', id: request.id });
    }
  } else if (newStatus === 'en_camino_proveedor') {
    userNotifTitle = '¡Tu Proveedor está en Camino!';
    userNotifBody = `${mockProviders.find(p=>p.id === providerId)?.name || 'El proveedor'} para "${request.titulo}" está en camino.`;
  } else if (newStatus === 'servicio_iniciado') {
    userNotifTitle = 'Servicio Iniciado';
    userNotifBody = `El proveedor ha iniciado el servicio "${request.titulo}".`;
  } else if (newStatus === 'completado_por_prestador') {
    request.providerMarkedCompleteAt = Date.now();
    userNotifTitle = 'Servicio Completado por Prestador';
    userNotifBody = `El prestador ha marcado "${request.titulo}" como completado. Por favor, confirma y califica.`;
  }

  // El log de cambio de estado se manejará por el trigger de Firestore.
  // Pero si queremos loguear la acción del proveedor específicamente:
  // logActivity(providerId, 'prestador', 'CAMBIO_ESTADO_SOLICITUD', `Proveedor actualizó estado de ${oldStatus} a ${newStatus} para solicitud ${request.id}`, { tipo: 'solicitud_servicio', id: request.id }, { estadoAnterior: oldStatus, estadoNuevo: newStatus, notasProveedor: providerNotes });


  if (userNotifTitle && userNotifBody) {
    sendPushNotificationMock({
      recipientId: request.userId,
      recipientType: 'user',
      title: userNotifTitle,
      body: userNotifBody,
      data: { requestId: request.id, type: 'SERVICE_STATUS_UPDATE', newStatus: request.status, oldStatus },
    });
  }

  if (providerNotes) request.notes = `${request.notes || ''}\nProveedor: ${providerNotes}`;
  
  console.log(`[RequestService] Solicitud ${requestId} actualizada por proveedor ${providerId} de ${oldStatus} a: ${newStatus}`);
  return request;
};

export const confirmServiceCompletionByUser = async (
  requestId: string,
  userId: string
): Promise<ServiceRequest> => {
  const requestIndex = serviceRequests.findIndex(req => req.id === requestId && req.userId === userId);
  if (requestIndex === -1) {
    throw new Error(`Solicitud ${requestId} no encontrada para el usuario ${userId}.`);
  }

  const request = serviceRequests[requestIndex];
  const oldStatus = request.status;

  if (request.status !== 'completado_por_prestador') {
    throw new Error(`El servicio debe ser marcado como 'completado_por_prestador' antes de que el usuario pueda confirmar. Estado actual: ${request.status}`);
  }

  const now = Date.now();
  request.status = 'completado_por_usuario';
  request.userConfirmedCompletionAt = now; 
  request.updatedAt = now;
  request.ratingWindowExpiresAt = now + (RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  
  if (request.serviceType === 'fixed' && request.paymentStatus !== 'retenido_para_liberacion' && request.paymentStatus !== 'procesado_exitosamente') {
    // This might indicate an issue in prior flow, but for robustness if it was a "pay later" fixed appointment:
    // request.paymentStatus = 'retenido_para_liberacion'; // Assuming payment is now processed/confirmed
    // For simplicity, we'll assume payment was 'retenido_para_liberacion' if it's a fixed service.
    // This implies that for fixed services, payment retention happens before provider marks complete.
  }


  const user = getMockUser(userId);
  let warrantyDays = STANDARD_WARRANTY_DAYS;
  if (user?.isPremium) {
    warrantyDays = PREMIUM_WARRANTY_DAYS; 
  }
  const warrantyEndDate = new Date(now + (warrantyDays * 24 * 60 * 60 * 1000));
  request.warrantyEndDate = warrantyEndDate.toISOString().split('T')[0];

  console.log(`[RequestService] Servicio ${requestId} confirmado por usuario ${userId} de ${oldStatus} a completado_por_usuario. Ventana de calificación hasta ${new Date(request.ratingWindowExpiresAt).toLocaleString()}. Garantía hasta ${request.warrantyEndDate}.`);
  
  // El log de cambio de estado se maneja por el trigger de Firestore.

  sendPushNotificationMock({
    recipientId: request.providerId,
    recipientType: 'provider',
    title: '¡Servicio Confirmado por Usuario!',
    body: `El usuario ha confirmado la finalización del servicio "${request.titulo}". ¡Ya puedes calificarlo!`,
    data: { requestId: request.id, type: 'USER_CONFIRMED_COMPLETION' },
  });
  
  return request;
};

export const rateServiceByUser = async (
  requestId: string,
  userId: string,
  estrellas: number,
  comentario?: string
): Promise<ServiceRequest> => {
  const requestIndex = serviceRequests.findIndex(req => req.id === requestId && req.userId === userId);
  if (requestIndex === -1) {
    throw new Error(`Solicitud ${requestId} no encontrada para el usuario ${userId}.`);
  }
  const request = serviceRequests[requestIndex];

  if (request.status !== 'completado_por_usuario' && request.status !== 'cerrado_automaticamente') { 
    throw new Error(`Solo se pueden calificar servicios en estado 'completado_por_usuario' o 'cerrado_automaticamente'. Estado actual: ${request.status}`);
  }
  if (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt) {
    // Aún permitir calificar si la ventana expiró pero el servicio no se ha cerrado por completo (raro, pero posible)
    // throw new Error("La ventana para calificar este servicio ha expirado.");
    console.warn(`[RequestService] Usuario ${userId} calificando servicio ${requestId} después de la ventana de expiración.`);
  }
  if (request.calificacionUsuario) {
    throw new Error("Ya has calificado este servicio.");
  }

  request.calificacionUsuario = { estrellas, comentario, fecha: Date.now() };
  request.updatedAt = Date.now();
  
  logActivity(
    userId,
    'usuario',
    'CALIFICACION_USUARIO',
    `Usuario ${userId} calificó servicio ${requestId} para prestador ${request.providerId} con ${estrellas} estrellas.`,
    { tipo: 'solicitud_servicio', id: requestId },
    { estrellas, comentario: comentario || "" }
  );

  let notificationSentToProvider = false;

  if (request.calificacionPrestador) {
    request.mutualRatingCompleted = true;
    request.status = 'cerrado_con_calificacion'; // Este es un cambio de estado, el trigger de Firestore lo logueará
  }
  
  if (request.paymentStatus === 'retenido_para_liberacion') {
    request.paymentStatus = 'liberado_al_proveedor';
    request.paymentReleasedToProviderAt = Date.now();
    console.log(`[RequestService] Pago para servicio ${requestId} liberado al proveedor debido a calificación del usuario.`);
    
    logActivity(
      'sistema', // O userId si la acción de calificar gatilla el pago
      'sistema', 
      'PAGO_LIBERADO', 
      `Pago para solicitud ${requestId} liberado al proveedor ${request.providerId} tras calificación del usuario.`,
      { tipo: 'solicitud_servicio', id: requestId }
    );

    sendPushNotificationMock({
        recipientId: request.providerId,
        recipientType: 'provider',
        title: '¡Pago Liberado y Calificación Recibida!',
        body: `El usuario ha calificado tu servicio "${request.titulo}" y el pago ha sido liberado.`,
        data: { requestId: request.id, type: 'PAYMENT_RELEASED_USER_RATED' },
    });
    notificationSentToProvider = true;
  }
  
  if(!notificationSentToProvider) {
     sendPushNotificationMock({
        recipientId: request.providerId,
        recipientType: 'provider',
        title: '¡Calificación Recibida!',
        body: `El usuario ha calificado tu servicio "${request.titulo}". Estrellas: ${estrellas}.`,
        data: { requestId: request.id, type: 'USER_RATED_SERVICE' },
    });
  }

  console.log(`[RequestService] Usuario ${userId} calificó servicio ${requestId} con ${estrellas} estrellas.`);
  return request;
};

export const rateServiceByProvider = async (
  requestId: string,
  providerId: string,
  estrellas: number,
  comentario?: string
): Promise<ServiceRequest> => {
  const requestIndex = serviceRequests.findIndex(req => req.id === requestId && req.providerId === providerId);
  if (requestIndex === -1) {
    throw new Error(`Solicitud ${requestId} no encontrada para el proveedor ${providerId}.`);
  }
  const request = serviceRequests[requestIndex];

  if (request.status !== 'completado_por_usuario' && request.status !== 'cerrado_automaticamente' && request.status !== 'cerrado_con_calificacion') {
    throw new Error(`El prestador solo puede calificar servicios que el usuario haya confirmado o estén cerrados. Estado actual: ${request.status}`);
  }
  if (request.calificacionPrestador) {
    throw new Error("Ya has calificado a este usuario para este servicio.");
  }

  request.calificacionPrestador = { estrellas, comentario, fecha: Date.now() };
  request.updatedAt = Date.now();

  logActivity(
    providerId,
    'prestador',
    'CALIFICACION_PRESTADOR',
    `Proveedor ${providerId} calificó al usuario ${request.userId} del servicio ${requestId} con ${estrellas} estrellas.`,
    { tipo: 'solicitud_servicio', id: requestId },
    { estrellas, comentario: comentario || "" }
  );

  if (request.calificacionUsuario) {
    request.mutualRatingCompleted = true;
    request.status = 'cerrado_con_calificacion'; // Este es un cambio de estado, el trigger de Firestore lo logueará
  }
  
  console.log(`[RequestService] Proveedor ${providerId} calificó al usuario del servicio ${requestId} con ${estrellas} estrellas.`);
  
  sendPushNotificationMock({
    recipientId: request.userId,
    recipientType: 'user',
    title: '¡Has Sido Calificado!',
    body: `${mockProviders.find(p=>p.id === providerId)?.name || 'El proveedor'} te ha calificado por el servicio "${request.titulo}". Estrellas: ${estrellas}.`,
    data: { requestId: request.id, type: 'PROVIDER_RATED_USER' },
  });
  
  return request;
};


export const checkExpiredRatingWindowsAndActivateWarranty = async (): Promise<void> => {
  console.log("[RequestService-Scheduled] Verificando ventanas de calificación expiradas...");
  const now = Date.now();
  let processedCount = 0;

  serviceRequests.forEach(req => {
    let statusChanged = false;
    const oldStatus = req.status;
    let logDetails: Record<string, any> = {};

    if (
      (req.status === 'completado_por_usuario' || req.status === 'cerrado_automaticamente') && // Puede que ya esté cerrado_automaticamente por otra razón
      req.ratingWindowExpiresAt &&
      now > req.ratingWindowExpiresAt &&
      !req.calificacionUsuario // Solo si el usuario no ha calificado
    ) {
      logDetails.ventanaExpirada = true;
      if (req.paymentStatus === 'retenido_para_liberacion') {
        req.paymentStatus = 'liberado_al_proveedor';
        req.paymentReleasedToProviderAt = now;
        req.updatedAt = now;
        statusChanged = true;
        logDetails.pagoLiberado = true;
        console.log(`[RequestService-Scheduled] Pago para servicio ${req.id} liberado automáticamente al proveedor (ventana expiró).`);
        
        logActivity(
          'sistema', 
          'sistema', 
          'PAGO_LIBERADO', 
          `Pago para solicitud ${req.id} liberado automáticamente (ventana de calificación expiró).`,
          { tipo: 'solicitud_servicio', id: req.id }
        );

        sendPushNotificationMock({
          recipientId: req.providerId,
          recipientType: 'provider',
          title: 'Pago Liberado Automáticamente',
          body: `El pago por el servicio (ID: ${req.id.substring(0,6)}...) ha sido liberado automáticamente.`,
          data: { requestId: req.id, type: 'PAYMENT_RELEASED_AUTO_EXPIRED_WINDOW' },
        });
      }

      if (!req.garantiaActiva) {
        const user = getMockUser(req.userId);
        if (user?.isPremium) {
          req.garantiaActiva = true;
          req.updatedAt = now; // Asegurar que updatedAt se actualice
          statusChanged = true;
          logDetails.garantiaActivada = true;
          console.log(`[RequestService-Scheduled] Garantía activada para servicio ${req.id} del usuario premium ${req.userId}.`);
          
          logActivity(
            'sistema',
            'sistema',
            'GARANTIA_ACTIVADA',
            `Garantía activada automáticamente para solicitud ${req.id} de usuario premium ${req.userId}.`,
            { tipo: 'solicitud_servicio', id: req.id }
          );
          
          sendPushNotificationMock({
            recipientId: req.userId,
            recipientType: 'user',
            title: 'Garantía Premium Activada',
            body: `Tu garantía premium para el servicio (ID: ${req.id.substring(0,6)}...) ha sido activada.`,
            data: { requestId: req.id, type: 'PREMIUM_WARRANTY_ACTIVATED' },
          });
        }
      }
      
      if (req.status === 'completado_por_usuario') { // Solo cambiar a cerrado_automaticamente si no lo estaba ya
          req.status = 'cerrado_automaticamente';
          req.updatedAt = now;
          statusChanged = true;
          // El log de cambio de estado se maneja por el trigger de Firestore,
          // pero podríamos añadir un log específico de "cierre por expiración" aquí si es útil.
          console.log(`[RequestService-Scheduled] Servicio ${req.id} (estado anterior: ${oldStatus}) cerrado automáticamente (ventana de calificación expiró, sin calificación de usuario).`);
          logActivity(
            'sistema',
            'sistema',
            'CAMBIO_ESTADO_SOLICITUD',
            `Servicio ${req.id} cerrado automáticamente (ventana expiró). Estado anterior: ${oldStatus}, nuevo: cerrado_automaticamente.`,
            { tipo: 'solicitud_servicio', id: req.id },
            { ...logDetails, estadoAnterior: oldStatus, estadoNuevo: 'cerrado_automaticamente' }
          );
      }
      
      if (statusChanged) processedCount++;
    }
  });

  if (processedCount > 0) {
    console.log(`[RequestService-Scheduled] Total de servicios procesados por expiración de ventana: ${processedCount}.`);
  } else {
    console.log("[RequestService-Scheduled] No se procesaron servicios por expiración de ventana en esta ejecución.");
  }
};

// Simulación de ejecución periódica (en cliente)
if (typeof window !== 'undefined') { 
    setInterval(() => {
        // checkExpiredRatingWindowsAndActivateWarranty(); // Comentado para reducir ruido en consola durante desarrollo
    }, 60000 * 5); // Cada 5 minutos
}

// Función para obtener logs (solo para demo en cliente)
export const getActivityLogs = async (): Promise<ActivityLog[]> => {
  return [...activityLogs].sort((a, b) => b.fecha - a.fecha); // Devolver una copia ordenada
};

    