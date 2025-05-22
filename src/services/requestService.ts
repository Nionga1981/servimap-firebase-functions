// src/services/requestService.ts
"use client"; 
import type { ServiceRequest, ServiceRequestStatus, PaymentStatus } from '@/types';

// Simulación de una "base de datos" en memoria para las solicitudes
let mockServiceRequests: ServiceRequest[] = [];

// Simulación de datos del usuario (en una app real, vendría de un contexto de autenticación)
const MOCK_CURRENT_USER_ID = 'currentUserDemoId';
const MOCK_IS_USER_PREMIUM = true; // Cambiar a false para probar el flujo no premium

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EXTENDED_WARRANTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // Para usuarios premium


/**
 * Simula la creación de una solicitud de servicio.
 */
export const createServiceRequest = async (requestDataInput: Omit<ServiceRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ServiceRequest> => {
  console.log('[RequestService] Creando nueva solicitud de servicio (simulado):', requestDataInput);
  
  await new Promise(resolve => setTimeout(resolve, 300)); // Simular retraso

  const newId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newRequest: ServiceRequest = {
    ...requestDataInput,
    id: newId,
    status: 'agendado', // Estado inicial
    createdAt: Date.now(),
  } as ServiceRequest; // Asersión de tipo necesaria por la estructura Omit

  mockServiceRequests.push(newRequest);
  console.log(`[RequestService] Solicitud simulada creada con ID: ${newId}`, newRequest);
  return newRequest;
};

/**
 * Simula la confirmación de finalización de un servicio por parte del usuario.
 */
export const confirmServiceCompletionByUser = async (
  userId: string,
  requestId: string
): Promise<ServiceRequest | null> => {
  console.log(`[RequestService] Usuario ${userId} intentando confirmar finalización para solicitud ${requestId}`);

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.error(`[RequestService] Solicitud ${requestId} no encontrada.`);
    // En una app real, podrías lanzar un error o devolver un código de estado
    return null; 
  }

  let request = mockServiceRequests[requestIndex];

  // 1. Verificar propiedad y estado (simulado)
  if (request.userId !== userId) {
    console.error(`[RequestService] Usuario ${userId} no es propietario de la solicitud ${requestId}.`);
    return null; // O lanzar error de autorización
  }
  // Asumimos que el proveedor ya marcó como completado, por lo que el estado sería 'completado_proveedor'
  // O podría ser 'servicio_iniciado' o 'en_camino_proveedor' si el flujo es más flexible
  const validPreviousStates: ServiceRequestStatus[] = ['completado_proveedor', 'servicio_iniciado', 'en_camino_proveedor'];
  if (!validPreviousStates.includes(request.status)) {
    console.error(`[RequestService] La solicitud ${requestId} no está en un estado válido para confirmación por el usuario. Estado actual: ${request.status}`);
    return null; // O lanzar error
  }

  // 3. Al confirmar:
  const now = Date.now();
  request.status = 'finalizado_usuario';
  request.userConfirmedCompletionAt = now;
  request.updatedAt = now;
  
  // Activar sistema de calificación y cuenta regresiva (simulado)
  request.ratingWindowExpiresAt = now + SEVEN_DAYS_MS;
  console.log(`[RequestService] Sistema de calificación activado para solicitud ${requestId}. Ventana expira en 7 días.`);

  // Iniciar proceso de pago/liberación (simulado)
  request.paymentStatus = 'retenido_para_liberacion';
  console.log(`[RequestService] Pago para solicitud ${requestId} ahora está 'retenido_para_liberacion'. Se liberará al proveedor después del período de gracia o acciones del usuario.`);

  // Simular garantía extendida para premium
  if (MOCK_IS_USER_PREMIUM) {
    request.warrantyEndDate = new Date(now + EXTENDED_WARRANTY_DAYS_MS).toISOString().split('T')[0];
    console.log(`[RequestService] Usuario premium: Garantía extendida aplicada hasta ${request.warrantyEndDate}`);
  } else {
    request.warrantyEndDate = new Date(now + SEVEN_DAYS_MS).toISOString().split('T')[0]; // Garantía estándar
    console.log(`[RequestService] Usuario no premium: Garantía estándar aplicada hasta ${request.warrantyEndDate}`);
  }
  
  mockServiceRequests[requestIndex] = request; // Actualizar en nuestra "DB" simulada
  console.log(`[RequestService] Solicitud ${requestId} confirmada por el usuario y actualizada:`, request);
  
  // En una app real, esto sería una llamada a una función de backend que gestiona los timers
  // simulateAutoFinalization(requestId); 

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

  // Solo se puede reportar un problema si el servicio fue confirmado por el usuario y está dentro de la ventana
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
 * Simula la calificación de un servicio por parte del usuario.
 */
export const addServiceRating = async (
  userId: string,
  requestId: string,
  rating: number,
  comment?: string
): Promise<ServiceRequest | null> => {
  console.log(`[RequestService] Usuario ${userId} calificando solicitud ${requestId} con ${rating} estrellas. Comentario: ${comment}`);

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
  
  // Solo calificar si está en 'finalizado_usuario' y dentro de la ventana de calificación
  if (request.status !== 'finalizado_usuario' || (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt)) {
     console.error(`[RequestService] No se puede calificar la solicitud ${requestId}. Estado: ${request.status}, Ventana de calificación expiró: ${request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt}`);
    return null;
  }

  const now = Date.now();
  request.userRating = {
    rating,
    comment,
    ratedAt: now,
  };
  // Si el usuario califica, y no hay disputa, el pago podría liberarse (dependiendo de la política de negocio)
  // O simplemente se marca como calificado y se espera al final de los 7 días si no hay disputa.
  // Por ahora, solo actualizamos el estado si no hay disputa.
  if (request.status !== 'en_disputa') {
    request.status = 'cerrado_con_calificacion';
    // En un sistema real, si no hay disputa y califica, se podría liberar el pago aquí.
    // request.paymentStatus = 'liberado_al_proveedor';
    // request.paymentReleasedToProviderAt = now;
    console.log(`[RequestService] Solicitud ${requestId} calificada. Pago podría liberarse ahora (simulado).`);
  }
  request.updatedAt = now;

  mockServiceRequests[requestIndex] = request;
  console.log(`[RequestService] Calificación añadida para solicitud ${requestId}:`, request);
  return request;
};


/**
 * SIMULACIÓN DE PROCESO DE BACKEND: Finalizar automáticamente una solicitud después de 7 días si no hay acción.
 * En una app real, esto sería un cron job o función programada en el backend.
 */
const simulateAutoFinalizeService = async (requestId: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, SEVEN_DAYS_MS + 1000)); // Esperar 7 días + 1 segundo

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) return;

  let request = mockServiceRequests[requestIndex];

  // Si el usuario confirmó, no hay disputa, y la ventana de calificación expiró sin que calificara
  if (request.status === 'finalizado_usuario' && 
      (!request.ratingWindowExpiresAt || Date.now() > request.ratingWindowExpiresAt) &&
      request.paymentStatus === 'retenido_para_liberacion') {
    
    const now = Date.now();
    request.status = 'cerrado_automaticamente';
    request.paymentStatus = 'liberado_al_proveedor';
    request.paymentReleasedToProviderAt = now;
    request.updatedAt = now;
    
    mockServiceRequests[requestIndex] = request;
    console.log(`[RequestService - AUTO] Solicitud ${requestId} finalizada automáticamente. Pago liberado.`, request);
  }
};

// Para debug: obtener todas las solicitudes simuladas
export const getMockServiceRequests = () => {
  return [...mockServiceRequests];
}

// Para debug: limpiar solicitudes
export const clearMockServiceRequests = () => {
  mockServiceRequests = [];
}

