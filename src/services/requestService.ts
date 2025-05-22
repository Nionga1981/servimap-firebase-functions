// src/services/requestService.ts
"use client"; 
import type { ServiceRequest, ServiceRequestStatus, PaymentStatus, FixedServiceRequest, HourlyServiceRequest, Provider, DemoUser } from '@/types';
import { mockProviders, USER_FIXED_LOCATION } from '@/lib/mockData'; 

// Simulación de una "base de datos" en memoria para las solicitudes
let mockServiceRequests: ServiceRequest[] = [];

// Simulación de datos del usuario (en una app real, vendría de un contexto de autenticación)
const MOCK_CURRENT_USER_ID = 'currentUserDemoId';

// Simulación de una "base de datos" de usuarios para verificar el estado premium
const mockUsers: DemoUser[] = [
  { id: 'currentUserDemoId', isPremium: true, name: 'Usuario Premium Demo' },
  { id: 'standardUserDemoId', isPremium: false, name: 'Usuario Estándar Demo' },
];

const getMockUser = (userId: string): DemoUser | undefined => {
  return mockUsers.find(u => u.id === userId);
}

const RATING_GRACE_PERIOD_DAYS = 7; // 7 días para calificar o reportar problemas
const STANDARD_WARRANTY_DAYS = 3;
const PREMIUM_WARRANTY_DAYS = 7;


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
    updatedAt: Date.now(),
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
  // Para ser más estricto, el proveedor debería marcarla como 'completado_proveedor' primero.
  const validPreviousStates: ServiceRequestStatus[] = ['completado_proveedor', 'servicio_iniciado', 'en_camino_proveedor', 'confirmado_proveedor', 'agendado'];
  if (!validPreviousStates.includes(request.status)) {
    console.error(`[RequestService] La solicitud ${requestId} no está en un estado válido (${request.status}) para confirmación por el usuario.`);
    return null; 
  }

  const now = Date.now();
  request.status = 'finalizado_usuario'; 
  request.userConfirmedCompletionAt = now; 
  request.updatedAt = now;
  
  // Activar sistema de calificación y ventana de gracia para reclamos
  request.ratingWindowExpiresAt = now + (RATING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[RequestService] Sistema de calificación/reclamo activado para solicitud ${requestId}. Ventana expira en ${RATING_GRACE_PERIOD_DAYS} días.`);

  // Retener el pago hasta que pase la ventana de calificación/disputa
  request.paymentStatus = 'retenido_para_liberacion';
  console.log(`[RequestService] Pago para solicitud ${requestId} ahora está '${request.paymentStatus}'. Se liberará al proveedor después de ${RATING_GRACE_PERIOD_DAYS} días si no hay reclamos.`);

  // Aplicar garantía
  const user = getMockUser(userId);
  const warrantyDurationDays = user?.isPremium ? PREMIUM_WARRANTY_DAYS : STANDARD_WARRANTY_DAYS;
  request.warrantyEndDate = new Date(now + (warrantyDurationDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  console.log(`[RequestService] Usuario ${user?.isPremium ? 'premium' : 'estándar'}: Garantía de ${warrantyDurationDays} días aplicada hasta ${request.warrantyEndDate}`);
  
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
  issueDetails: string 
): Promise<ServiceRequest | null> => {
  console.log(`[RequestService] Usuario ${userId} reportando problema para solicitud ${requestId}. Detalles: ${issueDetails}`);

  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.error(`[RequestService] Reporte de problema: Solicitud ${requestId} no encontrada.`);
    return null;
  }
  
  let request = mockServiceRequests[requestIndex];

  if (request.userId !== userId) {
    console.error(`[RequestService] Reporte de problema: Usuario ${userId} no es propietario de la solicitud ${requestId}.`);
    return null;
  }

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
  request.status = 'en_disputa';
  request.updatedAt = now;

  const claimDocument = {
    solicitudId: requestId,
    usuarioId: userId,
    prestadorId: request.providerId,
    motivo: issueDetails.substring(0, 100), 
    comentario: issueDetails,
    fechaCreacion: now,
    estadoReclamo: 'abierto', 
  };
  console.log('[RequestService] Simulación: Creando documento en "reclamos":', claimDocument);

  request.paymentStatus = 'congelado_por_disputa';
  console.log(`[RequestService] Reporte de problema: Pago para solicitud ${requestId} ahora está '${request.paymentStatus}'.`);

  request.disputeDetails = {
    reportedAt: now,
    reason: issueDetails,
  };
  console.log(`[RequestService] Simulación: Notificando al prestador ${request.providerId} sobre el problema.`);
  
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

  const canRateStates: ServiceRequestStatus[] = ['finalizado_usuario', 'cerrado_automaticamente', 'cerrado_con_calificacion'];
  if (!canRateStates.includes(request.status)) {
    console.error(`[RequestService] Calificación: Solicitud ${requestId} no está en estado para calificar (estado actual: ${request.status}).`);
    throw new Error(`La solicitud no está en un estado válido para ser calificada.`);
  }

  if (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt && request.status !== 'cerrado_automaticamente') {
    // Permitir calificar si se cerró automáticamente, pero no si la ventana activa expiró
    console.error(`[RequestService] Calificación: La ventana para calificar la solicitud ${requestId} ha expirado.`);
    throw new Error(`La ventana para calificar esta solicitud ha expirado.`);
  }

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
    const providerIndex = mockProviders.findIndex(p => p.id === request.providerId);
    if (providerIndex !== -1) {
      const provider = mockProviders[providerIndex];
      provider.ratingSum = (provider.ratingSum || 0) + rating;
      provider.ratingCount = (provider.ratingCount || 0) + 1;
      provider.rating = parseFloat((provider.ratingSum / provider.ratingCount).toFixed(2)); 
      mockProviders[providerIndex] = provider;
      console.log(`[RequestService] Calificación del proveedor ${provider.id} actualizada a ${provider.rating} (${provider.ratingCount} reseñas)`);
    }
  } else { 
    request.providerRating = newRatingDetail;
    console.log(`[RequestService] Proveedor ${evaluatorId} calificó al usuario ${request.userId}. (Actualización de perfil de usuario no implementada en simulación).`);
  }

  if (request.userRating && request.providerRating) {
    request.mutualRatingCompleted = true;
    console.log(`[RequestService] Calificación mutua completada para solicitud ${requestId}.`);
  }
  
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
  console.log(`[RequestService - BACKEND SIM] Iniciando simulación de finalización automática para ${requestId}.`);
  
  const requestIndex = mockServiceRequests.findIndex(req => req.id === requestId);
  if (requestIndex === -1) {
    console.warn(`[RequestService - BACKEND SIM] Solicitud ${requestId} no encontrada para auto-finalización.`);
    return;
  }

  let request = mockServiceRequests[requestIndex];

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
  }
};

// Para simular la ejecución periódica (esto es muy básico)
// setInterval(() => {
//   console.log("[RequestService - BACKEND SIM] Ejecutando revisión de auto-finalización de solicitudes...");
//   mockServiceRequests.forEach(req => {
//     if (req.status === 'finalizado_usuario' && req.paymentStatus === 'retenido_para_liberacion') {
//       simulateAutoFinalizeServiceAfterGracePeriod(req.id);
//     }
//   });
// }, 60000 * 5); // Cada 5 minutos para la demo

/**
 * Obtiene todas las solicitudes de servicio para un usuario, filtradas y agrupadas por estado.
 */
export const getUserServiceRequests = async (userId: string): Promise<Record<string, any[]>> => {
  console.log(`[RequestService] Obteniendo solicitudes para usuario ${userId}`);

  const userRequests = mockServiceRequests.filter(req => req.userId === userId);

  const relevantStatuses: ServiceRequestStatus[] = [
    'agendado',
    'confirmado_proveedor', 
    'en_camino_proveedor',  
    'servicio_iniciado',    
    'completado_proveedor', 
    'finalizado_usuario',   
    'cerrado_automaticamente', 
    'cerrado_con_calificacion', 
    'cerrado_con_disputa_resuelta', 
    'en_disputa',          
  ];

  const filteredRequests = userRequests.filter(req => relevantStatuses.includes(req.status));

  const mappedRequests = filteredRequests.map(req => {
    let fechaHoraDeseada = '';
    let totalEstimado = 0;

    if (req.serviceType === 'fixed') {
      fechaHoraDeseada = `${req.serviceDate} ${req.serviceTime || ''}`.trim();
      totalEstimado = req.totalAmount || req.selectedFixedServices?.reduce((sum, s) => sum + s.price, 0) || 0;

    } else if (req.serviceType === 'hourly') {
      fechaHoraDeseada = `${req.serviceDate} ${req.startTime || ''}`.trim();
      totalEstimado = req.estimatedTotal || 0;
    }

    return {
      id: req.id, 
      estado: req.status,
      prestadorId: req.providerId,
      fechaHoraDeseada,
      ubicacion: req.location,
      totalEstimado,
      yaCalificada: !!req.userRating, // El usuario ya calificó a este proveedor para esta solicitud
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

/**
 * Determina si una solicitud de servicio todavía está dentro del período de garantía.
 */
export const isServiceRequestUnderWarranty = async (
  requestId: string,
  userId: string
): Promise<{ isUnderWarranty: boolean; daysRemaining?: number; message: string }> => {
  console.log(`[RequestService] Verificando garantía para solicitud ${requestId} del usuario ${userId}`);

  const request = mockServiceRequests.find(req => req.id === requestId);

  if (!request) {
    return { isUnderWarranty: false, message: "Solicitud no encontrada." };
  }

  if (request.userId !== userId) {
    return { isUnderWarranty: false, message: "No eres el propietario de esta solicitud." };
  }

  const completedStates: ServiceRequestStatus[] = [
    'finalizado_usuario', 
    'cerrado_automaticamente', 
    'cerrado_con_calificacion', 
    'cerrado_con_disputa_resuelta'
  ];

  if (!completedStates.includes(request.status)) {
    return { isUnderWarranty: false, message: `El servicio no está en un estado completado (actual: ${request.status}). La garantía aún no aplica o ya no es relevante.`};
  }

  if (!request.warrantyEndDate) {
    return { isUnderWarranty: false, message: "No se pudo determinar la fecha de fin de garantía para esta solicitud." };
  }

  const now = Date.now();
  const warrantyEndDateMs = new Date(request.warrantyEndDate).setHours(23, 59, 59, 999); // Considerar todo el día de fin de garantía

  if (now <= warrantyEndDateMs) {
    const diffMs = warrantyEndDateMs - now;
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { 
      isUnderWarranty: true, 
      daysRemaining: daysRemaining, 
      message: `El servicio está bajo garantía. Quedan ${daysRemaining} día(s). Finaliza el ${request.warrantyEndDate}.` 
    };
  } else {
    return { 
      isUnderWarranty: false, 
      message: `El período de garantía para este servicio finalizó el ${request.warrantyEndDate}.` 
    };
  }
};


// --- Funciones de ayuda para la simulación ---
export const getMockServiceRequests = (): ServiceRequest[] => {
  // Devuelve una copia para evitar mutaciones externas directas del array simulado
  return JSON.parse(JSON.stringify(mockServiceRequests)); 
}

export const clearMockServiceRequests = (): void => {
  mockServiceRequests = [];
  console.log("[RequestService] Todas las solicitudes simuladas han sido borradas.");
}

export const addMockServiceRequest = (request: ServiceRequest): void => {
  mockServiceRequests.push(request);
   console.log(`[RequestService] Solicitud simulada añadida manualmente: ${request.id}`);
}
// --- Fin de Funciones de ayuda ---
