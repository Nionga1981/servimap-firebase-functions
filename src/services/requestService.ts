
// src/services/requestService.ts
"use client";
import type { ServiceRequest, FixedServiceRequest, HourlyServiceRequest, DemoUser } from '@/types';
import { mockProviders, USER_FIXED_LOCATION, mockDemoUsers as mockUsers } from '@/lib/mockData'; // Assuming mockUsers is exported

// Simulación de una base de datos en memoria para las solicitudes de servicio
let serviceRequests: ServiceRequest[] = [];

const RATING_WINDOW_DAYS = 7; // 7 días para calificar
const STANDARD_WARRANTY_DAYS = 3; // Días de garantía estándar
const PREMIUM_WARRANTY_DAYS = 10; // Días de garantía premium (ejemplo)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getMockUser = (userId: string): DemoUser | undefined => {
  return mockUsers.find(u => u.id === userId);
}

/**
 * Simula la creación de una nueva solicitud de servicio.
 * En una app real, esto interactuaría con Firestore.
 */
export const createServiceRequest = async (
  requestData: Omit<FixedServiceRequest, 'id' | 'createdAt' | 'status'> | Omit<HourlyServiceRequest, 'id' | 'createdAt' | 'status'>
): Promise<ServiceRequest> => {
  console.log('[RequestService] Creando solicitud de servicio (simulado)...', requestData);

  const providerExists = mockProviders.some(p => p.id === requestData.providerId);
  if (!providerExists) {
    throw new Error(`Proveedor con ID ${requestData.providerId} no encontrado.`);
  }

  const newRequest: ServiceRequest = {
    ...requestData,
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
    status: 'agendado', // Estado inicial tras la solicitud del usuario
    paymentStatus: requestData.serviceType === 'fixed' ? 'pendiente_cobro' : 'no_aplica', // Asumiendo que servicios fijos agendados requieren cobro
  };

  serviceRequests.push(newRequest);
  console.log('[RequestService] Solicitud creada:', newRequest);
  return newRequest;
};

/**
 * Simula la obtención de una solicitud de servicio por su ID.
 */
export const getServiceRequestById = async (requestId: string): Promise<ServiceRequest | undefined> => {
  return serviceRequests.find(req => req.id === requestId);
};

/**
 * Simula la actualización del estado de una solicitud por parte del proveedor.
 * Ej: confirmar, rechazar, marcar como en camino, iniciar, completar.
 */
export const updateServiceRequestByProvider = async (
  requestId: string,
  providerId: string,
  newStatus: ServiceRequest['status'],
  providerNotes?: string
): Promise<ServiceRequest> => {
  const requestIndex = serviceRequests.findIndex(req => req.id === requestId && req.providerId === providerId);
  if (requestIndex === -1) {
    throw new Error(`Solicitud ${requestId} no encontrada para el proveedor ${providerId}.`);
  }

  const request = serviceRequests[requestIndex];
  const validTransitionsForProvider: Partial<Record<ServiceRequest['status'], ServiceRequest['status'][]>> = {
    'agendado': ['confirmada_prestador', 'rechazada_prestador', 'cancelada_prestador'],
    'confirmada_prestador': ['en_camino_proveedor', 'cancelada_prestador'], // Asumiendo que el usuario paga/confirma después
    'pagada': ['en_camino_proveedor', 'servicio_iniciado'], // Si es un servicio inmediato pagado
    'en_camino_proveedor': ['servicio_iniciado'],
    'servicio_iniciado': ['completado_por_prestador'],
  };

  if (!validTransitionsForProvider[request.status]?.includes(newStatus)) {
    throw new Error(`Transición de estado inválida de '${request.status}' a '${newStatus}' por el proveedor.`);
  }
  
  request.status = newStatus;
  request.updatedAt = Date.now();

  if (newStatus === 'completado_por_prestador') {
    request.providerMarkedCompleteAt = Date.now();
  }
  if (providerNotes) request.notes = `${request.notes || ''}\nProveedor: ${providerNotes}`;
  
  console.log(`[RequestService] Solicitud ${requestId} actualizada por proveedor a: ${newStatus}`);
  return request;
};

/**
 * Simula la confirmación de finalización del servicio por parte del usuario.
 * Esto marca el servicio como "finalizado" y activa la ventana de calificación/garantía.
 */
export const confirmServiceCompletionByUser = async (
  requestId: string,
  userId: string
): Promise<ServiceRequest> => {
  const requestIndex = serviceRequests.findIndex(req => req.id === requestId && req.userId === userId);
  if (requestIndex === -1) {
    throw new Error(`Solicitud ${requestId} no encontrada para el usuario ${userId}.`);
  }

  const request = serviceRequests[requestIndex];
  if (request.status !== 'completado_por_prestador') {
    throw new Error(`El servicio debe ser marcado como 'completado_por_prestador' antes de que el usuario pueda confirmar. Estado actual: ${request.status}`);
  }

  const now = Date.now();
  request.status = 'completado_por_usuario'; // Estado "finalizado"
  request.userConfirmedCompletionAt = now; // `fechaFinalizado`
  request.updatedAt = now;
  request.ratingWindowExpiresAt = now + (RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Calcular y establecer la fecha de fin de garantía
  const user = getMockUser(userId);
  let warrantyDays = STANDARD_WARRANTY_DAYS;
  if (user?.isPremium) {
    // Aquí se podría verificar el tipo de membresía para días de garantía extendida
    // Por ahora, usamos un valor fijo para premium.
    warrantyDays = PREMIUM_WARRANTY_DAYS; 
  }
  const warrantyEndDate = new Date(now + (warrantyDays * 24 * 60 * 60 * 1000));
  request.warrantyEndDate = warrantyEndDate.toISOString().split('T')[0]; // Guardar como YYYY-MM-DD

  console.log(`[RequestService] Servicio ${requestId} confirmado por usuario ${userId}. Ventana de calificación hasta ${new Date(request.ratingWindowExpiresAt).toLocaleString()}. Garantía hasta ${request.warrantyEndDate}.`);
  return request;
};

/**
 * Simula la calificación de un servicio por parte del usuario.
 */
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

  if (request.status !== 'completado_por_usuario' && request.status !== 'cerrado_automaticamente') { // Permitir calificar aunque se cierre auto si aun está en ventana
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
  if (request.calificacionPrestador) {
    request.mutualRatingCompleted = true;
    request.status = 'cerrado_con_calificacion';
  }
  
  console.log(`[RequestService] Usuario ${userId} calificó servicio ${requestId} con ${estrellas} estrellas.`);
  // En un sistema real, aquí se actualizaría el rating promedio del proveedor.
  return request;
};

/**
 * Simula la calificación de un servicio por parte del prestador.
 */
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
   if (request.ratingWindowExpiresAt && Date.now() > request.ratingWindowExpiresAt) {
    // Opcional: permitir al proveedor calificar incluso si la ventana del usuario expiró.
    // console.warn("El proveedor está calificando después de la ventana del usuario.");
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
  // En un sistema real, aquí se actualizaría el rating promedio del usuario.
  return request;
};


/**
 * SIMULACIÓN de una función programada que se ejecutaría diariamente
 * para verificar servicios cuya ventana de calificación expiró y activar garantías si aplica.
 */
export const checkExpiredRatingWindowsAndActivateWarranty = async (): Promise<void> => {
  console.log("[RequestService-Scheduled] Verificando ventanas de calificación expiradas...");
  const now = Date.now();
  let activatedWarranties = 0;

  serviceRequests.forEach(req => {
    if (
      (req.status === 'completado_por_usuario' || req.status === 'cerrado_automaticamente') && // Puede que ya se haya cerrado automáticamente por otra razón
      req.ratingWindowExpiresAt &&
      now > req.ratingWindowExpiresAt &&
      !req.calificacionUsuario && // Si el usuario no ha calificado
      !req.garantiaActiva // Y la garantía no está ya activa
    ) {
      const user = getMockUser(req.userId);
      if (user?.isPremium) {
        req.garantiaActiva = true;
        req.status = 'cerrado_automaticamente'; // Asegurar que esté cerrado
        req.updatedAt = now;
        activatedWarranties++;
        console.log(`[RequestService-Scheduled] Garantía activada para servicio ${req.id} del usuario premium ${req.userId}.`);
        // Aquí se podría enviar una notificación al usuario.
      } else if (req.status === 'completado_por_usuario') {
         // Si no es premium y no calificó, simplemente cerrar.
        req.status = 'cerrado_automaticamente';
        req.updatedAt = now;
        console.log(`[RequestService-Scheduled] Servicio ${req.id} cerrado automáticamente (ventana de calificación expiró, sin calificación de usuario no premium).`);
      }
    }
  });

  if (activatedWarranties > 0) {
    console.log(`[RequestService-Scheduled] Total de garantías activadas: ${activatedWarranties}.`);
  } else {
    console.log("[RequestService-Scheduled] No se activaron nuevas garantías en esta ejecución.");
  }
};

// Simular la ejecución de la función programada de vez en cuando (solo para demo)
// En una app real, esto sería una Cloud Function programada.
if (typeof window !== 'undefined') { // Evitar que se ejecute en el lado del servidor si se importa allí
    setInterval(() => {
        // Descomentar para simular la ejecución automática. ¡Puede ser ruidoso en la consola!
        // checkExpiredRatingWindowsAndActivateWarranty();
    }, 60000 * 5); // Cada 5 minutos para demo
}

// TODO: Añadir funciones para disputas, etc.
// TODO: En una implementación real, estas funciones actualizarían Firestore
// y se adherirían a reglas de seguridad.
