// src/services/requestService.ts
"use client"; 
import type { ServiceRequest } from '@/types';
// USER_FIXED_LOCATION might not be needed here if this service is purely for creating requests
// and doesn't itself determine a default location. Let's remove it for now to simplify.
// import { USER_FIXED_LOCATION } from '@/lib/mockData'; 

/**
 * Simula la creación de una solicitud de servicio.
 * En una aplicación real, esto interactuaría con Firestore u otro backend.
 */
export const createServiceRequest = async (requestData: ServiceRequest): Promise<{ id: string }> => {
  console.log('[RequestService] Creando nueva solicitud de servicio (simulado):', requestData);
  
  // Simular un pequeño retraso como si fuera una llamada a API
  await new Promise(resolve => setTimeout(resolve, 500));

  const simulatedRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  console.log(`[RequestService] Solicitud simulada creada con ID: ${simulatedRequestId}`);
  
  // Validaciones básicas
  if (!requestData.userId || !requestData.providerId) {
    console.error("[RequestService] Error: Faltan IDs de usuario o proveedor.", requestData);
    throw new Error("Faltan IDs de usuario o proveedor.");
  }

  if (requestData.serviceType === 'fixed') {
    if (!requestData.serviceDate || !requestData.serviceTime) {
      console.warn("[RequestService] Advertencia: Faltan fecha u hora para servicio de precio fijo. Solicitud creada de todas formas para demo.", requestData);
      // En una app real, esto podría ser un error que impida la creación
      // throw new Error("Faltan fecha o hora para servicio de precio fijo.");
    }
  } else if (requestData.serviceType === 'hourly') {
    if (!requestData.serviceDate || !requestData.startTime || requestData.durationHours === undefined || requestData.durationHours <= 0) {
       console.error("[RequestService] Error: Faltan datos esenciales o duración inválida para servicio por horas.", requestData);
       throw new Error("Datos incompletos o duración inválida para servicio por horas.");
    }
    if (requestData.hourlyRate === undefined || requestData.estimatedTotal === undefined) {
      console.error("[RequestService] Error: Falta tarifa por hora o total estimado para servicio por horas.", requestData);
      throw new Error("Falta tarifa por hora o total estimado para servicio por horas.");
    }
  } else {
    console.error("[RequestService] Error: Tipo de servicio desconocido.", requestData);
    throw new Error("Tipo de servicio desconocido.");
  }

  // Devolver un ID de solicitud simulado
  return { id: simulatedRequestId };
};
