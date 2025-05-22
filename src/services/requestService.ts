// src/services/requestService.ts
"use client"; 
import type { ServiceRequest, ServiceRequestStatus, PaymentStatus, FixedServiceRequest, HourlyServiceRequest, Provider } from '@/types';
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData'; // Importar mockProviders

// Simulación de una "base de datos" en memoria para las solicitudes
let mockServiceRequests: ServiceRequest[] = [];

// Simulación de datos del usuario (en una app real, vendría de un contexto de autenticación)
const MOCK_CURRENT_USER_ID = 'currentUserDemoId';
const MOCK_IS_USER_PREMIUM = true; 

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EXTENDED_WARRANTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; 


/**
 * Simula la creación de una solicitud de servicio.
 */
export const createServiceRequest = async (requestDataInput: Omit<FixedServiceRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'> | Omit<HourlyServiceRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ServiceRequest> => {
  console.log('[RequestService] Creando nueva solicitud de servicio (simulado):', requestDataInput);
  
  await new Promise(resolve => setTimeout(resolve, 300)); 

  const newId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newRequest: ServiceRequest = {
    ...requestDataInput,
    id: newId,
    status: 'agendado', 
    createdAt: Date.now(),
  } as ServiceRequest; 

  mockServiceRequests.push(newRequest);
  console.log(`[RequestService] Solicitud simulada creada con ID: ${newId}`, newRequest);
  return newRequest;
};

/**
 * El usuario confirma que el servicio ha sido finalizado correctamente.
 */
export const confirmServiceCompletionByUser = async (
  userId: string,
  requestId: string
): Promise<ServiceRequest | null> => {
  console.log(`[RequestService] Usuario ${userId} confirmando finalización para solicitud ${requestId}`);

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.error(`[RequestService] Solicitud ${requestId} no encontrada.`);
    return null; 
  }

  let request = mockServiceRequests[requestIndex];

  if (request.userId !== userId) {
    console.error(`[RequestService] Usuario ${userId} no es propietario de la solicitud ${requestId}. Acceso denegado.`);
    return null; 
  }

  // El usuario puede confirmar si el proveedor la marcó como completa, o incluso si está en camino/iniciada (flujo flexible para demo)
  const validPreviousStates: ServiceRequestStatus[] = ['completado_proveedor', 'servicio_iniciado', 'en_camino_proveedor', 'confirmado_proveedor', 'agendado'];
  if (!validPreviousStates.includes(request.status)) {
    console.error(`[RequestService] La solicitud ${requestId} no está en un estado válido (${request.status}) para confirmación por el usuario.`);
    return null; 
  }

  const now = Date.now();
  request.status = 'finalizado_usuario'; 
  request.userConfirmedCompletionAt = now; 
  request.updatedAt = now;
  
  // Activar sistema de calificación y ventana de 7 días
  request.ratingWindowExpiresAt = now + SEVEN_DAYS_MS;
  console.log(`[RequestService] Sistema de calificación mutua activado para solicitud ${requestId}. Ventana expira en 7 días.`);

  // Retener el pago hasta que pase la ventana de calificación/disputa
  request.paymentStatus = 'retenido_para_liberacion';
  console.log(`[RequestService] Pago para solicitud ${requestId} ahora está '${request.paymentStatus}'. Se liberará al proveedor después de 7 días si no hay reclamos.`);

  // Aplicar garantía
  if (MOCK_IS_USER_PREMIUM) { 
    request.warrantyEndDate = new Date(now + EXTENDED_WARRANTY_DAYS_MS).toISOString().split('T')[0];
    console.log(`[RequestService] Usuario premium: Garantía extendida aplicada hasta ${request.warrantyEndDate}`);
  } else {
    request.warrantyEndDate = new Date(now + SEVEN_DAYS_MS).toISOString().split('T')[0]; 
    console.log(`[RequestService] Usuario no premium: Garantía estándar aplicada hasta ${request.warrantyEndDate}`);
  }
  
  mockServiceRequests[requestIndex] = request; 
  console.log(`[RequestService] Solicitud ${requestId} confirmada por el usuario y actualizada:`, request);
  
  return request;
};

/**
 * Permite al usuario reportar un problema con un servicio finalizado.
 */
export const reportServiceIssue = async (
  userId: string,
  requestId: string,
  issueDetails: string // Motivo y comentario del problema
): Promise<ServiceRequest | null> => {
  console.log(`[RequestService] Usuario ${userId} reportando problema para solicitud ${requestId}. Detalles: ${issueDetails}`);

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.error(`[RequestService] Reporte de problema: Solicitud ${requestId} no encontrada.`);
    return null;
  }
  
  let request = mockServiceRequests[requestIndex];

  // Verificar propiedad
  if (request.userId !== userId) {
    console.error(`[RequestService] Reporte de problema: Usuario ${userId} no es propietario de la solicitud ${requestId}.`);
    return null;
  }

  // Verificar que la solicitud esté en estado 'finalizado_usuario' y dentro de la ventana de 7 días
  const canReportIssueStates: ServiceRequestStatus[] = ['finalizado_usuario'];
  if (!canReportIssueStates.includes(request.status)) {
     console.error(`[RequestService] Reporte de problema: Solicitud ${requestId} no está en estado 'finalizado_usuario' (estado actual: ${request.status}).`);
    return null;
  }
  if (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt) {
    console.error(`[RequestService] Reporte de problema: La ventana para reportar problemas para la solicitud ${requestId} ha expirado.`);
    return null;
  }

  const now = Date.now();
  // 1. Cambiar el estado de la solicitud a "en disputa"
  request.status = 'en_disputa';
  request.updatedAt = now;

  // 2. Crear (simular) un documento en la colección "reclamos"
  const claimDocument = {
    solicitudId: requestId,
    usuarioId: userId,
    prestadorId: request.providerId,
    motivo: issueDetails.substring(0, 100), // Tomar una parte como motivo
    comentario: issueDetails,
    fechaCreacion: now,
    estadoReclamo: 'abierto', // Estado inicial del reclamo
  };
  console.log('[RequestService] Simulación: Creando documento en "reclamos":', claimDocument);
  // En una app real: await addDoc(collection(db, "reclamos"), claimDocument);

  // 3. Detener la liberación del pago automáticamente
  request.paymentStatus = 'congelado_por_disputa';
  console.log(`[RequestService] Reporte de problema: Pago para solicitud ${requestId} ahora está '${request.paymentStatus}'.`);

  // 4. Notificar al prestador y marcar el servicio como en revisión (simulación)
  request.disputeDetails = {
    reportedAt: now,
    reason: issueDetails,
  };
  console.log(`[RequestService] Simulación: Notificando al prestador ${request.providerId} sobre el problema y marcando el servicio como en revisión.`);
  
  mockServiceRequests[requestIndex] = request;
  console.log(`[RequestService] Problema reportado para solicitud ${requestId}. Estado y pago actualizados. Detalles:`, request);
  return request;
};

/**
 * Permite al usuario o al prestador dejar una calificación después de que un servicio ha sido finalizado.
 */
export const addServiceRatingAndReview = async (
  requestId: string,
  evaluatorId: string, 
  evaluatorRole: 'user' | 'provider',
  rating: number,
  comment?: string
): Promise<ServiceRequest | null> => {
  console.log(`[RequestService] ${evaluatorRole} ${evaluatorId} calificando solicitud ${requestId} con ${rating} estrellas. Comentario: ${comment}`);

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.error(`[RequestService] Calificación: Solicitud ${requestId} no encontrada.`);
    throw new Error(`Solicitud ${requestId} no encontrada.`);
  }

  let request = mockServiceRequests[requestIndex];

  // Verificar que la solicitud esté en un estado apto para calificar
  // El usuario puede calificar si está 'finalizado_usuario' y dentro de la ventana.
  // El proveedor podría calificar también en estos estados.
  const canRateStates: ServiceRequestStatus[] = ['finalizado_usuario', 'cerrado_automaticamente', 'cerrado_con_calificacion'];
  if (!canRateStates.includes(request.status)) {
    console.error(`[RequestService] Calificación: Solicitud ${requestId} no está en estado para calificar (estado actual: ${request.status}).`);
    throw new Error(`La solicitud no está en un estado válido para ser calificada.`);
  }

  // Verificar que esté dentro de la ventana de calificación, si está definida
  if (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt) {
    console.error(`[RequestService] Calificación: La ventana para calificar la solicitud ${requestId} ha expirado.`);
    // Opcionalmente, permitir calificar fuera de ventana pero sin impacto en pago, o mostrar error.
    // Por ahora, lanzaremos un error para ser estrictos con la ventana.
    throw new Error(`La ventana para calificar esta solicitud ha expirado.`);
  }


  // Verificar que el evaluador solo pueda calificar una vez
  if (evaluatorRole === 'user' && request.userRating) {
    console.warn(`[RequestService] Calificación: Usuario ${evaluatorId} ya calificó esta solicitud.`);
    throw new Error(`Ya has calificado esta solicitud.`);
  }
  if (evaluatorRole === 'provider' && request.providerRating) {
    console.warn(`[RequestService] Calificación: Proveedor ${evaluatorId} ya calificó esta solicitud.`);
    throw new Error(`Proveedor ya calificó esta solicitud.`);
  }

  const now = Date.now();
  const newRatingDetail = { rating, comment, ratedAt: now };

  if (evaluatorRole === 'user') {
    request.userRating = newRatingDetail;
    // Actualizar calificación del proveedor
    const providerIndex = mockProviders.findIndex(p => p.id === request.providerId);
    if (providerIndex !== -1) {
      const provider = mockProviders[providerIndex];
      provider.ratingSum = (provider.ratingSum || 0) + rating;
      provider.ratingCount = (provider.ratingCount || 0) + 1;
      provider.rating = parseFloat((provider.ratingSum / provider.ratingCount).toFixed(2)); // Mantener 2 decimales
      mockProviders[providerIndex] = provider;
      console.log(`[RequestService] Calificación del proveedor ${provider.id} actualizada a ${provider.rating} (${provider.ratingCount} reseñas)`);
    }
  } else { // evaluatorRole === 'provider'
    request.providerRating = newRatingDetail;
    // Lógica para actualizar la calificación del usuario (si tuviéramos una colección de usuarios)
    console.log(`[RequestService] Proveedor ${evaluatorId} calificó al usuario ${request.userId}. (Actualización de perfil de usuario no implementada en simulación).`);
  }

  // Verificar si ambas partes han calificado
  if (request.userRating && request.providerRating) {
    request.mutualRatingCompleted = true;
    console.log(`[RequestService] Calificación mutua completada para solicitud ${requestId}.`);
  }
  
  // Actualizar estado de la solicitud si es necesario (ej. si estaba 'finalizado_usuario' y ahora se califica)
  if(request.status === 'finalizado_usuario' || request.status === 'cerrado_automaticamente') {
      request.status = 'cerrado_con_calificacion';
  }
  request.updatedAt = now;

  mockServiceRequests[requestIndex] = request;
  console.log(`[RequestService] Calificación añadida para solicitud ${requestId}:`, request);
  return request;
};


/**
 * SIMULACIÓN DE PROCESO DE BACKEND: Finalizar automáticamente una solicitud después de 7 días si no hay acción.
 * Esta función solo se llamaría conceptualmente desde un proceso de backend.
 */
const simulateAutoFinalizeServiceAfterGracePeriod = async (requestId: string): Promise<void> => {
  console.log(`[RequestService - BACKEND SIM] Iniciando simulación de finalización automática para ${requestId}.`);
  
  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.warn(`[RequestService - BACKEND SIM] Solicitud ${requestId} no encontrada para auto-finalización.`);
    return;
  }

  let request = mockServiceRequests[requestIndex];

  // Solo finalizar si está 'finalizado_usuario', no hay disputa, y la ventana de calificación expiró
  if (request.status === 'finalizado_usuario' && 
      request.paymentStatus === 'retenido_para_liberacion' &&
      (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt)) {
    
    const now = Date.now();
    request.status = 'cerrado_automaticamente';
    request.paymentStatus = 'liberado_al_proveedor'; 
    request.paymentReleasedToProviderAt = now;
    request.updatedAt = now;
    
    mockServiceRequests[requestIndex] = request;
    console.log(`[RequestService - BACKEND SIM] Solicitud ${requestId} finalizada automáticamente. Pago liberado.`, request);
  } else {
    // console.log(`[RequestService - BACKEND SIM] Solicitud ${requestId} no apta para finalización automática. Estado: ${request.status}, Pago: ${request.paymentStatus}, Vence: ${new Date(request.ratingWindowExpiresAt || 0 ).toLocaleString()}`);
  }
};

// Simular la ejecución periódica de la finalización automática (esto es muy básico)
// En una app real, un cron job en el backend haría esto.
// setInterval(() => {
//   console.log("[RequestService - BACKEND SIM] Ejecutando revisión de auto-finalización de solicitudes...");
//   mockServiceRequests.forEach(req => {
//     if (req.status === 'finalizado_usuario' && req.paymentStatus === 'retenido_para_liberacion') {
//       simulateAutoFinalizeServiceAfterGracePeriod(req.id);
//     }
//   });
// }, 60000); // Cada minuto para la demo

/**
 * Obtiene todas las solicitudes de servicio para un usuario, filtradas y agrupadas por estado.
 */
export const getUserServiceRequests = async (userId: string): Promise<Record<string, any[]>> => {
  console.log(`[RequestService] Obteniendo solicitudes para usuario ${userId}`);

  const userRequests = mockServiceRequests.filter(req => req.userId === userId);

  const relevantStatuses: ServiceRequestStatus[] = [
    'confirmado_proveedor', 
    'en_camino_proveedor',  
    'servicio_iniciado',    
    'completado_proveedor', 
    'finalizado_usuario',   
    'cerrado_automaticamente', 
    'cerrado_con_calificacion', 
    'cerrado_con_disputa_resuelta', 
    'en_disputa',
    'agendado' // Añadido para ver solicitudes recién creadas           
  ];

  const filteredRequests = userRequests.filter(req => relevantStatuses.includes(req.status));

  const mappedRequests = filteredRequests.map(req => {
    let fechaHoraDeseada = '';
    let totalEstimado = 0;

    if (req.serviceType === 'fixed') {
      fechaHoraDeseada = `${req.serviceDate} ${req.serviceTime}`;
      // totalEstimado = req.totalAmount || 0; // Si hubiera servicios seleccionados
      totalEstimado = req.selectedFixedServices?.reduce((sum, s) => sum + s.price, 0) || 0;

    } else if (req.serviceType === 'hourly') {
      fechaHoraDeseada = `${req.serviceDate} ${req.startTime}`;
      totalEstimado = req.estimatedTotal || 0;
    }

    return {
      id: req.id, 
      estado: req.status,
      prestadorId: req.providerId,
      fechaHoraDeseada,
      ubicacion: req.location,
      totalEstimado,
      yaCalificada: !!req.userRating,
      createdAt: req.createdAt 
    };
  });

  const groupedByStatus: Record<string, any[]> = {};
  mappedRequests.forEach(req => {
    if (!groupedByStatus[req.estado]) {
      groupedByStatus[req.estado] = [];
    }
    groupedByStatus[req.estado].push(req);
  });

  for (const status in groupedByStatus) {
    groupedByStatus[status].sort((a, b) => b.createdAt - a.createdAt);
  }
  
  console.log('[RequestService] Solicitudes de usuario filtradas y agrupadas:', groupedByStatus);
  return groupedByStatus;
};


export const getMockServiceRequests = () => {
  return [...mockServiceRequests];
}

export const clearMockServiceRequests = () => {
  mockServiceRequests = [];
}
