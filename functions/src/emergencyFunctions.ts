// Emergency Functions - Sistema de emergencias DISCRECIONAL
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// Inicializar Firebase Admin si no está inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * 🚨 getEmergencyProviders
 * Obtiene SOLO prestadores que voluntariamente ofrecen emergencias
 * NO aplica lógica automática de detección de horarios
 */
export const getEmergencyProviders = onCall<{
  serviceType: string;
  userLocation: { lat: number; lng: number };
  urgencyLevel: 'high' | 'critical';
}>(
  async (request) => {
    const { serviceType, userLocation, urgencyLevel } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🚨 Buscando prestadores de emergencia voluntarios para ${serviceType}`);

    try {
      // Verificar que el usuario sea Premium (requisito para emergencias)
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.isPremium) {
        throw new HttpsError(
          "permission-denied", 
          "Servicios de emergencia disponibles solo para usuarios Premium"
        );
      }

      const maxDistance = urgencyLevel === 'critical' ? 10 : 20; // km
      const emergencyProviders = [];

      // Buscar prestadores que voluntariamente habilitaron emergencias
      const providersSnapshot = await db.collection("providers")
        .where("isActive", "==", true)
        .get();

      for (const providerDoc of providersSnapshot.docs) {
        const providerData = providerDoc.data();
        const providerId = providerDoc.id;

        // Verificar si ofrece el tipo de servicio requerido
        const hasService = providerData.services?.some((s: any) => s.type === serviceType);
        if (!hasService) continue;

        // Obtener configuración de emergencias
        const emergencyConfigDoc = await db.collection("emergencyConfigs")
          .doc(providerId)
          .get();

        if (!emergencyConfigDoc.exists) continue;

        const emergencyConfig = emergencyConfigDoc.data();

        // FILTRO PRINCIPAL: Solo prestadores que voluntariamente habilitaron emergencias
        if (!emergencyConfig?.enabled) continue;

        // Verificar si está disponible ahora (toggle manual del prestador)
        if (!emergencyConfig?.availableNow) continue;

        // Verificar si atiende este tipo de emergencia
        if (emergencyConfig?.emergencyTypes && 
            !emergencyConfig?.emergencyTypes.includes(getEmergencyCategory(serviceType))) {
          continue;
        }

        // Calcular distancia
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          providerData.location?.lat || 0,
          providerData.location?.lng || 0
        );

        // Filtrar por distancia máxima configurada por el prestador
        const providerMaxDistance = emergencyConfig?.maxDistance || maxDistance;
        if (distance > providerMaxDistance) continue;

        // Obtener precio base del servicio
        const service = providerData.services?.find((s: any) => s.type === serviceType);
        const basePrice = service?.price || 500;

        // Aplicar sobrecargo PERSONALIZADO del prestador (NO automático)
        const customSurcharge = emergencyConfig?.customSurcharge || 50;
        const emergencyPrice = Math.round(basePrice * (1 + customSurcharge / 100));

        // Obtener rating promedio
        const rating = await getProviderRating(providerId);

        emergencyProviders.push({
          providerId,
          name: providerData.displayName || 'Prestador',
          distance,
          basePrice,
          customSurcharge,
          emergencyPrice,
          estimatedResponseTime: emergencyConfig?.responseTime ? `${emergencyConfig?.responseTime} minutos` : 'A convenir',
          isAvailableNow: emergencyConfig?.availableNow || false,
          emergencyTypes: emergencyConfig?.emergencyTypes || [],
          description: emergencyConfig?.description || '',
          rating: rating.average,
          reviewCount: rating.count,
          phone: providerData.phone,
          location: providerData.location
        });
      }

      // Ordenar por distancia y luego por rating
      emergencyProviders.sort((a, b) => {
        if (Math.abs(a.distance - b.distance) < 2) {
          return (b.rating || 0) - (a.rating || 0);
        }
        return a.distance - b.distance;
      });

      console.log(`✅ Encontrados ${emergencyProviders.length} prestadores de emergencia voluntarios`);

      return {
        emergencyProviders: emergencyProviders.slice(0, 10), // Máximo 10 resultados
        searchCriteria: {
          serviceType,
          urgencyLevel,
          maxDistance,
          providersFound: emergencyProviders.length
        }
      };

    } catch (error) {
      console.error("❌ Error obteniendo prestadores de emergencia:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error obteniendo prestadores de emergencia");
    }
  }
);

/**
 * ⚙️ updateEmergencyConfig
 * Prestador configura su disponibilidad para emergencias
 */
export const updateEmergencyConfig = onCall<{
  enabled: boolean;
  customSurcharge: number;
  availableNow: boolean;
  emergencyTypes: string[];
  responseTime: string;
  maxDistance: number;
  description?: string;
}>(
  async (request) => {
    const { 
      enabled, 
      customSurcharge, 
      availableNow, 
      emergencyTypes, 
      responseTime, 
      maxDistance,
      description 
    } = request.data;
    
    const providerId = request.auth?.uid;
    if (!providerId) {
      throw new HttpsError("unauthenticated", "Prestador no autenticado");
    }

    console.log(`⚙️ Actualizando configuración de emergencias para ${providerId}`);

    try {
      // Validaciones
      if (enabled) {
        if (customSurcharge < 20 || customSurcharge > 200) {
          throw new HttpsError("invalid-argument", "Sobrecargo debe estar entre 20% y 200%");
        }
        
        if (!emergencyTypes || emergencyTypes.length === 0) {
          throw new HttpsError("invalid-argument", "Debe seleccionar al menos un tipo de emergencia");
        }
        
        if (!responseTime || parseInt(responseTime) < 15) {
          throw new HttpsError("invalid-argument", "Tiempo de respuesta mínimo: 15 minutos");
        }
      }

      const now = admin.firestore.Timestamp.now();
      
      const emergencyConfig = {
        providerId,
        enabled,
        customSurcharge: enabled ? customSurcharge : 0,
        availableNow: enabled ? availableNow : false,
        emergencyTypes: enabled ? emergencyTypes : [],
        responseTime: enabled ? responseTime : null,
        maxDistance: enabled ? maxDistance : 15,
        description: description || '',
        lastUpdated: now,
        createdAt: now
      };

      // Guardar configuración
      await db.collection("emergencyConfigs").doc(providerId).set(emergencyConfig, { merge: true });

      // Actualizar flag en el documento del prestador para facilitar búsquedas
      await db.collection("providers").doc(providerId).update({
        hasEmergencyServices: enabled,
        lastUpdated: now
      });

      // Log de auditoría
      await db.collection("emergencyConfigHistory").add({
        providerId,
        action: enabled ? 'enabled' : 'disabled',
        previousConfig: null, // Se podría obtener el anterior
        newConfig: emergencyConfig,
        timestamp: now
      });

      console.log(`✅ Configuración de emergencias ${enabled ? 'habilitada' : 'deshabilitada'} para ${providerId}`);

      return {
        success: true,
        config: emergencyConfig,
        message: enabled ? 
          'Servicios de emergencia habilitados exitosamente' : 
          'Servicios de emergencia deshabilitados'
      };

    } catch (error) {
      console.error("❌ Error actualizando configuración de emergencias:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error actualizando configuración");
    }
  }
);

/**
 * 🔄 toggleEmergencyAvailability
 * Toggle rápido de disponibilidad inmediata para emergencias
 */
export const toggleEmergencyAvailability = onCall<{
  availableNow: boolean;
}>(
  async (request) => {
    const { availableNow } = request.data;
    const providerId = request.auth?.uid;

    if (!providerId) {
      throw new HttpsError("unauthenticated", "Prestador no autenticado");
    }

    console.log(`🔄 Cambiando disponibilidad de emergencia: ${availableNow} para ${providerId}`);

    try {
      // Verificar que tenga emergencias configuradas
      const emergencyConfigDoc = await db.collection("emergencyConfigs").doc(providerId).get();
      
      if (!emergencyConfigDoc.exists || !emergencyConfigDoc.data()?.enabled) {
        throw new HttpsError(
          "failed-precondition", 
          "Primero debe configurar sus servicios de emergencia"
        );
      }

      const now = admin.firestore.Timestamp.now();

      // Actualizar solo el flag de disponibilidad
      await db.collection("emergencyConfigs").doc(providerId).update({
        availableNow,
        lastToggle: now
      });

      // Registrar cambio para analytics
      await db.collection("emergencyAvailabilityLog").add({
        providerId,
        availableNow,
        timestamp: now,
        source: 'manual_toggle'
      });

      console.log(`✅ Disponibilidad de emergencia actualizada: ${availableNow}`);

      return {
        success: true,
        availableNow,
        message: availableNow ? 
          'Ahora apareces disponible para emergencias' : 
          'Ya no apareces disponible para emergencias'
      };

    } catch (error) {
      console.error("❌ Error cambiando disponibilidad:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error cambiando disponibilidad");
    }
  }
);

/**
 * 📞 requestEmergencyService
 * Usuario solicita servicio de emergencia a prestador específico
 */
export const requestEmergencyService = onCall<{
  providerId: string;
  serviceType: string;
  urgencyLevel: 'high' | 'critical';
  userLocation: { lat: number; lng: number };
  description?: string;
  acknowledgedSurcharge: boolean;
  totalPrice: number;
}>(
  async (request) => {
    const { 
      providerId, 
      serviceType, 
      urgencyLevel, 
      userLocation, 
      description,
      acknowledgedSurcharge,
      totalPrice
    } = request.data;
    
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📞 Procesando solicitud de emergencia de ${userId} para ${providerId}`);

    try {
      // Validar que usuario sea Premium
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.data()?.isPremium) {
        throw new HttpsError("permission-denied", "Solo usuarios Premium pueden solicitar emergencias");
      }

      // Verificar que aceptó el sobrecargo
      if (!acknowledgedSurcharge) {
        throw new HttpsError("invalid-argument", "Debe aceptar el sobrecargo de emergencia");
      }

      // Verificar que el prestador sigue disponible
      const emergencyConfigDoc = await db.collection("emergencyConfigs").doc(providerId).get();
      const emergencyConfig = emergencyConfigDoc.data();
      
      if (!emergencyConfig?.enabled || !emergencyConfig?.availableNow) {
        throw new HttpsError("unavailable", "El prestador ya no está disponible para emergencias");
      }

      const now = admin.firestore.Timestamp.now();
      const batch = db.batch();

      // Crear solicitud de emergencia
      const emergencyRequestRef = db.collection("emergencyRequests").doc();
      const emergencyRequest = {
        userId,
        providerId,
        serviceType,
        urgencyLevel,
        userLocation: new admin.firestore.GeoPoint(userLocation.lat, userLocation.lng),
        description: description || '',
        status: 'pending_response',
        totalPrice,
        customSurcharge: emergencyConfig.customSurcharge,
        acknowledgedSurcharge: true,
        estimatedResponseTime: emergencyConfig.responseTime,
        requestedAt: now,
        createdAt: now,
        updatedAt: now
      };

      batch.set(emergencyRequestRef, emergencyRequest);

      // Notificar al prestador
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        userId: providerId,
        type: "emergency_service_request",
        title: "🚨 SOLICITUD DE EMERGENCIA",
        message: `Emergencia de ${serviceType} - Tiempo estimado: ${emergencyConfig.responseTime || 'A convenir'} minutos`,
        data: {
          emergencyRequestId: emergencyRequestRef.id,
          userId,
          serviceType,
          urgencyLevel,
          totalPrice,
          userLocation
        },
        priority: "urgent",
        read: false,
        createdAt: now
      });

      // Crear transacción pendiente (retener pago)
      const transactionRef = db.collection("transactions").doc();
      batch.set(transactionRef, {
        userId,
        providerId,
        emergencyRequestId: emergencyRequestRef.id,
        amount: totalPrice,
        status: "held",
        type: "emergency_payment",
        description: `Pago por emergencia: ${serviceType}`,
        createdAt: now
      });

      await batch.commit();

      console.log(`✅ Solicitud de emergencia creada: ${emergencyRequestRef.id}`);

      return {
        emergencyRequestId: emergencyRequestRef.id,
        status: "pending_response",
        estimatedResponseTime: emergencyConfig.responseTime || 'A convenir',
        totalPrice,
        providerId
      };

    } catch (error) {
      console.error("❌ Error procesando solicitud de emergencia:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando solicitud");
    }
  }
);

/**
 * ✅ respondToEmergencyRequest
 * Prestador responde a solicitud de emergencia
 */
export const respondToEmergencyRequest = onCall<{
  emergencyRequestId: string;
  response: 'accept' | 'reject';
  estimatedArrival?: string;
  rejectionReason?: string;
}>(
  async (request) => {
    const { emergencyRequestId, response, estimatedArrival, rejectionReason } = request.data;
    const providerId = request.auth?.uid;

    if (!providerId) {
      throw new HttpsError("unauthenticated", "Prestador no autenticado");
    }

    console.log(`✅ Prestador ${providerId} responde: ${response} a emergencia ${emergencyRequestId}`);

    try {
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      // Obtener solicitud de emergencia
      const emergencyRequestDoc = await db.collection("emergencyRequests")
        .doc(emergencyRequestId)
        .get();

      if (!emergencyRequestDoc.exists) {
        throw new HttpsError("not-found", "Solicitud de emergencia no encontrada");
      }

      const emergencyRequestData = emergencyRequestDoc.data();
      
      if (emergencyRequestData?.providerId !== providerId) {
        throw new HttpsError("permission-denied", "No autorizado");
      }

      if (emergencyRequestData?.status !== 'pending_response') {
        throw new HttpsError("invalid-argument", "La solicitud ya fue procesada");
      }

      let newStatus = '';
      let notificationMessage = '';

      if (response === 'accept') {
        newStatus = 'accepted';
        notificationMessage = `Tu emergencia fue aceptada. Llegada estimada: ${estimatedArrival || 'En camino'}`;
        
        // Actualizar solicitud
        batch.update(emergencyRequestDoc.ref, {
          status: newStatus,
          acceptedAt: now,
          estimatedArrival: estimatedArrival || '',
          updatedAt: now
        });

        // Confirmar transacción
        const transactionQuery = await db.collection("transactions")
          .where("emergencyRequestId", "==", emergencyRequestId)
          .get();
        
        transactionQuery.forEach(doc => {
          batch.update(doc.ref, { 
            status: "confirmed",
            confirmedAt: now
          });
        });

      } else {
        newStatus = 'rejected';
        notificationMessage = `Tu solicitud de emergencia fue rechazada: ${rejectionReason || 'Sin especificar'}`;
        
        // Actualizar solicitud
        batch.update(emergencyRequestDoc.ref, {
          status: newStatus,
          rejectedAt: now,
          rejectionReason: rejectionReason || '',
          updatedAt: now
        });

        // Reembolsar transacción
        const transactionQuery = await db.collection("transactions")
          .where("emergencyRequestId", "==", emergencyRequestId)
          .get();
        
        transactionQuery.forEach(doc => {
          batch.update(doc.ref, { 
            status: "refunded",
            refundedAt: now,
            refundReason: rejectionReason
          });
        });
      }

      // Notificar al usuario
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        userId: emergencyRequestData?.userId || "",
        type: `emergency_${response}`,
        title: response === 'accept' ? "🚨 Emergencia Aceptada" : "❌ Emergencia Rechazada",
        message: notificationMessage,
        data: {
          emergencyRequestId,
          providerId,
          response,
          estimatedArrival,
          rejectionReason
        },
        priority: "urgent",
        read: false,
        createdAt: now
      });

      await batch.commit();

      console.log(`✅ Respuesta de emergencia procesada: ${response}`);

      return {
        success: true,
        status: newStatus,
        message: response === 'accept' ? 
          'Emergencia aceptada exitosamente' : 
          'Emergencia rechazada'
      };

    } catch (error) {
      console.error("❌ Error respondiendo a emergencia:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando respuesta");
    }
  }
);

// Funciones auxiliares

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getEmergencyCategory(serviceType: string): string {
  const categoryMap: Record<string, string> = {
    'plumbing': 'plumbing',
    'plumber': 'plumbing',
    'electrical': 'electrical',
    'electrician': 'electrical',
    'locksmith': 'locksmith',
    'appliance_repair': 'appliance',
    'hvac': 'hvac',
    'cleaning': 'cleaning',
    'security': 'security',
    'glass_repair': 'glass'
  };
  
  return categoryMap[serviceType] || 'general';
}

async function getProviderRating(providerId: string): Promise<{ average: number; count: number }> {
  try {
    const reviewsSnapshot = await db.collection("reviews")
      .where("providerId", "==", providerId)
      .get();

    if (reviewsSnapshot.empty) {
      return { average: 0, count: 0 };
    }

    const ratings = reviewsSnapshot.docs.map(doc => doc.data().rating || 0);
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

    return {
      average: Math.round(average * 10) / 10,
      count: ratings.length
    };
  } catch (error) {
    console.error("Error getting provider rating:", error);
    return { average: 0, count: 0 };
  }
}