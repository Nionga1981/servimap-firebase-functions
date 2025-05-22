// src/services/requestService.ts
"use client"; 
import type { ServiceRequest, ServiceRequestStatus, PaymentStatus, FixedServiceRequest, HourlyServiceRequest } from '@/types';

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
export const createServiceRequest = async (requestDataInput: Omit<FixedServiceRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'> | Omit<HourlyServiceRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ServiceRequest> => {
  console.log('[RequestService] Creando nueva solicitud de servicio (simulado):', requestDataInput);
  
  await new Promise(resolve => setTimeout(resolve, 300)); // Simular retraso

  const newId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newRequest: ServiceRequest = {
    ...requestDataInput,
    id: newId,
    status: 'agendado', // Estado inicial
    createdAt: Date.now(),
  } as ServiceRequest; // Asersión de tipo

  mockServiceRequests.push(newRequest);
  console.log(`[RequestService] Solicitud simulada creada con ID: ${newId}`, newRequest);
  return newRequest;
};

/**
 * El usuario confirma que el servicio ha sido finalizado correctamente.
 * Esto activa el sistema de calificación y el proceso de liberación de pago.
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

  // 1. Verificar propiedad de la solicitud
  if (request.userId !== userId) {
    console.error(`[RequestService] Usuario ${userId} no es propietario de la solicitud ${requestId}. Acceso denegado.`);
    // En una app real, lanzarías un error o devolverías un código de estado HTTP apropiado.
    return null; 
  }

  // 2. Verificar que el servicio esté en un estado previo válido para la confirmación del usuario
  //    (ej. el proveedor ya lo marcó como completado, o estaba en curso)
  const validPreviousStates: ServiceRequestStatus[] = ['completado_proveedor', 'servicio_iniciado', 'en_camino_proveedor', 'confirmado_proveedor'];
  if (!validPreviousStates.includes(request.status)) {
    console.error(`[RequestService] La solicitud ${requestId} no está en un estado válido (${request.status}) para confirmación por el usuario.`);
    return null; 
  }

  // 3. Al confirmar:
  const now = Date.now();
  request.status = 'finalizado_usuario'; // Cambiar el estado a "finalizado" por el usuario
  request.userConfirmedCompletionAt = now; // Guardar la fecha de confirmación
  request.updatedAt = now;
  
  // Activar sistema de calificación y cuenta regresiva de 7 días
  request.ratingWindowExpiresAt = now + SEVEN_DAYS_MS;
  console.log(`[RequestService] Sistema de calificación activado para solicitud ${requestId}. Ventana expira en 7 días.`);

  // Retener el pago para liberación después del período de gracia
  request.paymentStatus = 'retenido_para_liberacion';
  console.log(`[RequestService] Pago para solicitud ${requestId} ahora está '${request.paymentStatus}'.`);

  // Simular garantía extendida para premium
  if (MOCK_IS_USER_PREMIUM) { // En una app real, verificarías el estado premium del usuario
    request.warrantyEndDate = new Date(now + EXTENDED_WARRANTY_DAYS_MS).toISOString().split('T')[0];
    console.log(`[RequestService] Usuario premium: Garantía extendida aplicada hasta ${request.warrantyEndDate}`);
  } else {
    request.warrantyEndDate = new Date(now + SEVEN_DAYS_MS).toISOString().split('T')[0]; // Garantía estándar
    console.log(`[RequestService] Usuario no premium: Garantía estándar aplicada hasta ${request.warrantyEndDate}`);
  }
  
  mockServiceRequests[requestIndex] = request; // Actualizar en nuestra "DB" simulada
  console.log(`[RequestService] Solicitud ${requestId} confirmada por el usuario y actualizada:`, request);
  
  // En una app real, esto se manejaría en el backend, no iniciando un timer en el cliente.
  // simulateAutoFinalizationAfterGracePeriod(requestId); 

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
  request.paymentStatus = 'congelado_por_disputa'; // Congelar el pago
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
  
  // Si el usuario califica y no hay disputa, se podría cambiar el estado general de la solicitud.
  // La liberación del pago seguiría la lógica de los 7 días o resolución de disputa.
  if (request.status !== 'en_disputa') {
    request.status = 'cerrado_con_calificacion'; 
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
const simulateAutoFinalizeServiceAfterGracePeriod = async (requestId: string): Promise<void> => {
  // Esta función es conceptual para un backend.
  // En el frontend, no podemos garantizar su ejecución fiable a largo plazo.
  console.log(`[RequestService - BACKEND SIM] Iniciando simulación de finalización automática para ${requestId} en 7 días.`);
  
  // Simular espera
  // await new Promise(resolve => setTimeout(resolve, SEVEN_DAYS_MS + 1000)); // NO USAR ESTO EN CLIENTE REAL

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) return;

  let request = mockServiceRequests[requestIndex];

  // Solo finalizar si está 'finalizado_usuario', no hay disputa, y la ventana de calificación expiró
  if (request.status === 'finalizado_usuario' && 
      request.paymentStatus === 'retenido_para_liberacion' &&
      (!request.ratingWindowExpiresAt || Date.now() > request.ratingWindowExpiresAt)) {
    
    const now = Date.now();
    request.status = 'cerrado_automaticamente';
    request.paymentStatus = 'liberado_al_proveedor'; // Liberar el pago
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
    'confirmado_proveedor', // Asignado
    'en_camino_proveedor',  // Asignado
    'servicio_iniciado',    // En curso
    'completado_proveedor', // Finalizado (pendiente confirmación usuario)
    'finalizado_usuario',   // Finalizado (confirmado por usuario)
    'cerrado_automaticamente', // Cerrado
    'cerrado_con_calificacion', // Cerrado
    'cerrado_con_disputa_resuelta', // Cerrado
    'en_disputa'            // En disputa
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
      id: req.id, // Útil para keys en listas de UI
      estado: req.status,
      prestadorId: req.providerId,
      fechaHoraDeseada,
      ubicacion: req.location,
      totalEstimado,
      yaCalificada: !!req.userRating,
      createdAt: req.createdAt // Para ordenar
    };
  });

  // Agrupar por estado
  const groupedByStatus: Record<string, any[]> = {};
  mappedRequests.forEach(req => {
    if (!groupedByStatus[req.estado]) {
      groupedByStatus[req.estado] = [];
    }
    groupedByStatus[req.estado].push(req);
  });

  // Ordenar dentro de cada grupo por fecha de creación descendente
  for (const status in groupedByStatus) {
    groupedByStatus[status].sort((a, b) => b.createdAt - a.createdAt);
  }
  
  console.log('[RequestService] Solicitudes de usuario filtradas y agrupadas:', groupedByStatus);
  return groupedByStatus;
};


// Para debug: obtener todas las solicitudes simuladas
export const getMockServiceRequests = () => {
  return [...mockServiceRequests];
}

// Para debug: limpiar solicitudes
export const clearMockServiceRequests = () => {
  mockServiceRequests = [];
}
