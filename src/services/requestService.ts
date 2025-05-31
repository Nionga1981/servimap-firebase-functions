
// src/services/requestService.ts
"use client";
import type { ServiceRequest, FixedServiceRequest, HourlyServiceRequest, DemoUser, PaymentStatus, ServiceRequestStatus } from '@/types';
import { mockProviders, USER_FIXED_LOCATION, mockDemoUsers as mockUsers } from '@/lib/mockData';

// Simulación de una base de datos en memoria para las solicitudes de servicio
let serviceRequests: ServiceRequest[] = [];

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
  if (requestData.serviceType === 'fixed') {
    // For fixed services, assume payment is processed and status becomes "retenido_para_liberacion" if it's an immediate hire.
    // If it's an appointment, it might start as "pendiente_cobro".
    // For this simulation, we'll assume it's an immediate request or an appointment that just got paid.
    paymentStatus = 'retenido_para_liberacion';
  } else { // hourly
    paymentStatus = 'no_aplica'; // Typically billed after service completion
  }

  const newRequest: ServiceRequest = {
    ...requestData,
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
    status: 'agendado', // Initial status when user requests
    paymentStatus: paymentStatus,
  };

  serviceRequests.push(newRequest);
  console.log('[RequestService] Solicitud creada:', newRequest);

  // Notify Provider of new request
  sendPushNotificationMock({
    recipientId: newRequest.providerId,
    recipientType: 'provider',
    title: 'Nueva Solicitud de Servicio',
    body: `Has recibido una nueva solicitud de ${providerDetails?.name || 'un usuario'} para "${requestData.serviceType === 'fixed' ? requestData.selectedFixedServices?.[0]?.title || 'un servicio' : 'un servicio por horas'}".`,
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
    'pagada': ['en_camino_proveedor', 'servicio_iniciado'],
    'en_camino_proveedor': ['servicio_iniciado'],
    'servicio_iniciado': ['completado_por_prestador'],
  };

  if (!validTransitionsForProvider[request.status]?.includes(newStatus)) {
    throw new Error(`Transición de estado inválida de '${request.status}' a '${newStatus}' por el proveedor.`);
  }
  
  request.status = newStatus;
  request.updatedAt = Date.now();

  let userNotifTitle = '';
  let userNotifBody = '';

  if (newStatus === 'confirmada_prestador') {
    request.paymentStatus = request.serviceType === 'fixed' ? 'retenido_para_liberacion' : 'pendiente_cobro'; // Retain if fixed, or pending for hourly
    userNotifTitle = '¡Servicio Confirmado!';
    userNotifBody = `Tu solicitud de servicio con ${mockProviders.find(p=>p.id === providerId)?.name || 'el proveedor'} ha sido confirmada.`;
  } else if (newStatus === 'rechazada_prestador' || newStatus === 'cancelada_prestador') {
    userNotifTitle = 'Servicio Cancelado/Rechazado';
    userNotifBody = `Tu solicitud de servicio con ${mockProviders.find(p=>p.id === providerId)?.name || 'el proveedor'} ha sido ${newStatus === 'rechazada_prestador' ? 'rechazada' : 'cancelada'}.`;
    // Handle potential refunds if payment was already 'retenido_para_liberacion'
    if (request.paymentStatus === 'retenido_para_liberacion') {
        request.paymentStatus = 'reembolsado_total'; // Simulate refund
        userNotifBody += ' Se procesará un reembolso.';
    }
  } else if (newStatus === 'en_camino_proveedor') {
    userNotifTitle = '¡Proveedor en Camino!';
    userNotifBody = `${mockProviders.find(p=>p.id === providerId)?.name || 'El proveedor'} está en camino.`;
  } else if (newStatus === 'servicio_iniciado') {
    userNotifTitle = 'Servicio Iniciado';
    userNotifBody = `${mockProviders.find(p=>p.id === providerId)?.name || 'El proveedor'} ha iniciado el servicio.`;
  } else if (newStatus === 'completado_por_prestador') {
    request.providerMarkedCompleteAt = Date.now();
    userNotifTitle = 'Servicio Marcado como Completado';
    userNotifBody = `${mockProviders.find(p=>p.id === providerId)?.name || 'El proveedor'} ha marcado el servicio como completado. Por favor, confirma la finalización.`;
  }

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
  
  // Ensure payment status is 'retenido_para_liberacion' if it was processed for fixed services
  if (request.serviceType === 'fixed' && request.paymentStatus !== 'retenido_para_liberacion') {
    // This might indicate an issue in prior flow, but for robustness:
    // request.paymentStatus = 'retenido_para_liberacion';
    // console.warn(`[RequestService] Payment status for ${requestId} was not 'retenido_para_liberacion' upon user completion. Review flow.`);
  }


  const user = getMockUser(userId);
  let warrantyDays = STANDARD_WARRANTY_DAYS;
  if (user?.isPremium) {
    warrantyDays = PREMIUM_WARRANTY_DAYS; 
  }
  const warrantyEndDate = new Date(now + (warrantyDays * 24 * 60 * 60 * 1000));
  request.warrantyEndDate = warrantyEndDate.toISOString().split('T')[0];

  console.log(`[RequestService] Servicio ${requestId} confirmado por usuario ${userId} de ${oldStatus} a completado_por_usuario. Ventana de calificación hasta ${new Date(request.ratingWindowExpiresAt).toLocaleString()}. Garantía hasta ${request.warrantyEndDate}.`);
  
  sendPushNotificationMock({
    recipientId: request.providerId,
    recipientType: 'provider',
    title: '¡Servicio Confirmado por Usuario!',
    body: `El usuario ha confirmado la finalización del servicio "${request.serviceType === 'fixed' ? request.selectedFixedServices?.[0]?.title || 'servicio' : 'servicio por horas'}". Ya puedes calificar al usuario.`,
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
    throw new Error("La ventana para calificar este servicio ha expirado.");
  }
  if (request.calificacionUsuario) {
    throw new Error("Ya has calificado este servicio.");
  }

  request.calificacionUsuario = { estrellas, comentario, fecha: Date.now() };
  request.updatedAt = Date.now();
  
  let notificationSentToProvider = false;

  if (request.calificacionPrestador) {
    request.mutualRatingCompleted = true;
    request.status = 'cerrado_con_calificacion';
  }
  
  // Liberar pago si estaba retenido y el usuario califica
  if (request.paymentStatus === 'retenido_para_liberacion') {
    request.paymentStatus = 'liberado_al_proveedor';
    request.paymentReleasedToProviderAt = Date.now();
    console.log(`[RequestService] Pago para servicio ${requestId} liberado al proveedor debido a calificación del usuario.`);
    sendPushNotificationMock({
        recipientId: request.providerId,
        recipientType: 'provider',
        title: '¡Pago Liberado y Calificación Recibida!',
        body: `El usuario ha calificado tu servicio y el pago de $${(request as FixedServiceRequest).totalAmount || (request as HourlyServiceRequest).finalTotal || 'N/A'} ha sido liberado.`,
        data: { requestId: request.id, type: 'PAYMENT_RELEASED_USER_RATED' },
    });
    notificationSentToProvider = true;
  }
  
  if(!notificationSentToProvider) {
     sendPushNotificationMock({
        recipientId: request.providerId,
        recipientType: 'provider',
        title: '¡Calificación Recibida!',
        body: `El usuario ha calificado tu servicio. Estrellas: ${estrellas}.`,
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
    throw new Error(`El prestador solo puede calificar servicios que el usuario haya confirmado. Estado actual: ${request.status}`);
  }
  if (request.calificacionPrestador) {
    throw new Error("Ya has calificado a este usuario para este servicio.");
  }

  request.calificacionPrestador = { estrellas, comentario, fecha: Date.now() };
  request.updatedAt = Date.now();
  if (request.calificacionUsuario) {
    request.mutualRatingCompleted = true;
    request.status = 'cerrado_con_calificacion';
  }
  
  console.log(`[RequestService] Proveedor ${providerId} calificó al usuario del servicio ${requestId} con ${estrellas} estrellas.`);
  
  sendPushNotificationMock({
    recipientId: request.userId,
    recipientType: 'user',
    title: '¡Has Sido Calificado!',
    body: `${mockProviders.find(p=>p.id === providerId)?.name || 'El proveedor'} te ha calificado por el servicio. Estrellas: ${estrellas}.`,
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

    if (
      (req.status === 'completado_por_usuario' || req.status === 'cerrado_automaticamente') &&
      req.ratingWindowExpiresAt &&
      now > req.ratingWindowExpiresAt &&
      !req.calificacionUsuario 
    ) {
      // Liberar pago si está retenido y el usuario no calificó
      if (req.paymentStatus === 'retenido_para_liberacion') {
        req.paymentStatus = 'liberado_al_proveedor';
        req.paymentReleasedToProviderAt = now;
        req.updatedAt = now;
        statusChanged = true;
        console.log(`[RequestService-Scheduled] Pago para servicio ${req.id} liberado automáticamente al proveedor (ventana expiró).`);
        sendPushNotificationMock({
          recipientId: req.providerId,
          recipientType: 'provider',
          title: 'Pago Liberado Automáticamente',
          body: `El pago por el servicio (ID: ${req.id.substring(0,6)}...) ha sido liberado automáticamente.`,
          data: { requestId: req.id, type: 'PAYMENT_RELEASED_AUTO_EXPIRED_WINDOW' },
        });
      }

      // Activar garantía si el usuario es premium y no ha calificado
      if (!req.garantiaActiva) {
        const user = getMockUser(req.userId);
        if (user?.isPremium) {
          req.garantiaActiva = true;
          req.updatedAt = now; // Asegurar que updatedAt se actualice
          statusChanged = true;
          console.log(`[RequestService-Scheduled] Garantía activada para servicio ${req.id} del usuario premium ${req.userId}.`);
          sendPushNotificationMock({
            recipientId: req.userId,
            recipientType: 'user',
            title: 'Garantía Premium Activada',
            body: `Tu garantía premium para el servicio (ID: ${req.id.substring(0,6)}...) ha sido activada.`,
            data: { requestId: req.id, type: 'PREMIUM_WARRANTY_ACTIVATED' },
          });
        }
      }
      
      // Cerrar el servicio si aún no estaba cerrado_automaticamente
      if (req.status === 'completado_por_usuario') {
          req.status = 'cerrado_automaticamente';
          req.updatedAt = now; // Asegurar que updatedAt se actualice
          statusChanged = true;
          console.log(`[RequestService-Scheduled] Servicio ${req.id} (estado anterior: ${oldStatus}) cerrado automáticamente (ventana de calificación expiró, sin calificación de usuario).`);
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

if (typeof window !== 'undefined') { 
    setInterval(() => {
        // checkExpiredRatingWindowsAndActivateWarranty(); // Puede ser ruidoso
    }, 60000 * 5); 
}
