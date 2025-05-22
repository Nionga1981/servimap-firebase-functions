// src/services/requestService.ts
"use client"; 
import type { ServiceRequest, ServiceRequestStatus, PaymentStatus, FixedServiceRequest, HourlyServiceRequest, Provider } from '@/types';
import { mockProviders } from '@/lib/mockData'; // Importar mockProviders

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

  const validPreviousStates: ServiceRequestStatus[] = ['completado_proveedor', 'servicio_iniciado', 'en_camino_proveedor', 'confirmado_proveedor', 'agendado'];
  if (!validPreviousStates.includes(request.status)) {
    console.error(`[RequestService] La solicitud ${requestId} no está en un estado válido (${request.status}) para confirmación por el usuario.`);
    return null; 
  }

  const now = Date.now();
  request.status = 'finalizado_usuario'; 
  request.userConfirmedCompletionAt = now; 
  request.updatedAt = now;
  
  request.ratingWindowExpiresAt = now + SEVEN_DAYS_MS;
  console.log(`[RequestService] Sistema de calificación activado para solicitud ${requestId}. Ventana expira en 7 días.`);

  request.paymentStatus = 'retenido_para_liberacion';
  console.log(`[RequestService] Pago para solicitud ${requestId} ahora está '${request.paymentStatus}'.`);

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
 * Simula el reporte de un problema por parte del usuario.
 */
export const reportServiceIssue = async (
  userId: string,
  requestId: string,
  issueDetails: string
): Promise<ServiceRequest | null> => {
  console.log(`[RequestService] Usuario ${userId} reportando problema para solicitud ${requestId}: ${issueDetails}`);

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.error(`[RequestService] Solicitud ${requestId} no encontrada.`);
    return null;
  }
  
  let request = mockServiceRequests[requestIndex];

  if (request.userId !== userId) {
    console.error(`[RequestService] Usuario ${userId} no es propietario de la solicitud ${requestId}.`);
    return null;
  }

  if (request.status !== 'finalizado_usuario' || (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt)) {
    console.error(`[RequestService] No se puede reportar problema para la solicitud ${requestId}. Estado: ${request.status}, Ventana de disputa expiró: ${request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt}`);
    return null;
  }

  const now = Date.now();
  request.status = 'en_disputa';
  request.paymentStatus = 'congelado_por_disputa'; 
  request.disputeDetails = {
    reportedAt: now,
    reason: issueDetails,
  };
  request.updatedAt = now;
  
  mockServiceRequests[requestIndex] = request;
  console.log(`[RequestService] Problema reportado para solicitud ${requestId}. Pago congelado. Detalles:`, request);
  return request;
};

/**
 * Permite al usuario o al prestador dejar una calificación después de que un servicio ha sido finalizado.
 */
export const addServiceRatingAndReview = async (
  requestId: string,
  evaluatorId: string, // ID del que está calificando (usuario o proveedor)
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
  const canRateStates: ServiceRequestStatus[] = ['finalizado_usuario', 'cerrado_automaticamente', 'cerrado_con_calificacion'];
  if (!canRateStates.includes(request.status)) {
    console.error(`[RequestService] Calificación: Solicitud ${requestId} no está en estado para calificar (estado actual: ${request.status}).`);
    throw new Error(`La solicitud no está en un estado válido para ser calificada.`);
  }

  // Verificar que el evaluador solo pueda calificar una vez
  if (evaluatorRole === 'user' && request.userRating) {
    console.warn(`[RequestService] Calificación: Usuario ${evaluatorId} ya calificó esta solicitud.`);
    throw new Error(`Usuario ya calificó esta solicitud.`);
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
      provider.ratingSum += rating;
      provider.ratingCount += 1;
      provider.rating = parseFloat((provider.ratingSum / provider.ratingCount).toFixed(2)); // Mantener 2 decimales
      mockProviders[providerIndex] = provider;
      console.log(`[RequestService] Calificación del proveedor ${provider.id} actualizada a ${provider.rating}`);
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
 */
const simulateAutoFinalizeServiceAfterGracePeriod = async (requestId: string): Promise<void> => {
  console.log(`[RequestService - BACKEND SIM] Iniciando simulación de finalización automática para ${requestId} en 7 días.`);
  
  // En una app real, esto no sería un setTimeout en el cliente.
  // Se usaría un cron job o función programada en el backend.
  // Para la simulación, podemos simplemente llamar a la lógica de finalización si han pasado 7 días.
  // Este método solo se llamaría conceptualmente desde un proceso de backend.
  
  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) return;

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
    console.log(`[RequestService - BACKEND SIM] Solicitud ${requestId} no apta para finalización automática. Estado: ${request.status}, Pago: ${request.paymentStatus}`);
  }
};

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
    'en_disputa'            
  ];

  const filteredRequests = userRequests.filter(req => relevantStatuses.includes(req.status));

  const mappedRequests = filteredRequests.map(req => {
    let fechaHoraDeseada = '';
    let totalEstimado = 0;

    if (req.serviceType === 'fixed') {
      fechaHoraDeseada = `${req.serviceDate} ${req.serviceTime}`;
      totalEstimado = req.totalAmount || 0;
    } else if (req.serviceType === 'hourly') {
      fechaHoraDeseada = `${req.serviceDate} ${req.startTime}`;
      totalEstimado = req.estimatedTotal;
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
