// Schedule and Premium Functions - Sistema de agenda y funciones Premium
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  ProviderAvailability,
  ServiceBooking,
  RecurringService,
  EmergencyService,
  PremiumAnalytics,
  InternationalService,
  ProviderSchedule,
  ScheduledService,
  PremiumAnalyticsData,
  PREMIUM_LIMITS,
  PREMIUM_FEATURES
} from "./types";

const db = admin.firestore();

/**
 * 📅 getProviderSchedule
 * Obtiene agenda disponible del prestador con slots libres
 */
export const getProviderSchedule = onCall<{
  providerId: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  userTimezone: string;
}>(
  async (request) => {
    const { providerId, serviceType, startDate, endDate, userTimezone } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📅 Obteniendo agenda del prestador ${providerId}`);

    try {
      // Obtener información del prestador
      const providerDoc = await db.collection("providers").doc(providerId).get();
      if (!providerDoc.exists) {
        throw new HttpsError("not-found", "Prestador no encontrado");
      }

      const providerData = providerDoc.data();
      
      // Intentar obtener horario detallado primero, luego disponibilidad básica
      let schedule: ProviderSchedule | null = null;
      let availability: ProviderAvailability | null = null;
      
      const scheduleDoc = await db.collection("providerSchedules").doc(providerId).get();
      if (scheduleDoc.exists) {
        schedule = scheduleDoc.data() as ProviderSchedule;
      } else {
        const availabilityDoc = await db.collection("providerAvailability").doc(providerId).get();
        if (!availabilityDoc.exists) {
          throw new HttpsError("not-found", "Horario no configurado");
        }
        availability = availabilityDoc.data() as ProviderAvailability;
      }
      
      // Obtener servicios ya agendados - usar nueva estructura
      const bookingsSnapshot = await db.collection("scheduledServices")
        .where("providerId", "==", providerId)
        .where("scheduledDateTime", ">=", admin.firestore.Timestamp.fromDate(new Date(startDate)))
        .where("scheduledDateTime", "<=", admin.firestore.Timestamp.fromDate(new Date(endDate)))
        .where("status", "in", ["confirmed", "pending_confirmation"])
        .get();

      const busySlots = bookingsSnapshot.docs.map(doc => {
        const data = doc.data();
        const endTime = new admin.firestore.Timestamp(
          data.scheduledDateTime.seconds + (data.estimatedDuration || 60) * 60,
          data.scheduledDateTime.nanoseconds
        );
        return {
          start: data.scheduledDateTime,
          end: endTime,
          serviceId: doc.id
        };
      });

      // Calcular precio base del servicio
      const basePrice = providerData.services?.find(
        (s: any) => s.type === serviceType
      )?.price || 0;

      let availableSlots = [];
      
      if (schedule) {
        // Usar estructura detallada ProviderSchedule
        availableSlots = schedule.timeSlots
          .filter(slot => {
            const slotDate = slot.datetime.toDate();
            const requestStart = new Date(startDate);
            const requestEnd = new Date(endDate);
            return slotDate >= requestStart && slotDate <= requestEnd && !slot.isBooked;
          })
          .map(slot => ({
            datetime: slot.datetime,
            duration: slot.duration,
            price: slot.price,
            isEmergency: slot.isEmergencySlot || false
          }));
          
      } else if (availability) {
        // Usar estructura básica ProviderAvailability (fallback)
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const daySchedule = availability.weeklySchedule[dayOfWeek];
          
          if (!daySchedule || !daySchedule.available) continue;

          // Verificar overrides de fecha específica
          const dateStr = date.toISOString().split('T')[0];
          const override = availability.dateOverrides?.find(o => {
            const compareDate = (o.date as any)?.toDate ? (o.date as any).toDate().toISOString().split('T')[0] : o.date;
            return compareDate === dateStr;
          });
          
          if (override && !override.available) continue;

          // Generar slots básicos usando configuración simple
          const slotDuration = availability.settings?.slotDurationMinutes || 60;
          const workingHours = daySchedule.timeSlots || [];
          
          for (const timeSlot of workingHours) {
            const slotTime = new Date(date);
            const [hour, min] = timeSlot.startTime.split(':').map(Number);
            slotTime.setHours(hour, min, 0, 0);
            
            // Verificar si el slot está ocupado
            const slotEndTime = new Date(slotTime);
            slotEndTime.setMinutes(slotEndTime.getMinutes() + slotDuration);
            
            const isOccupied = busySlots.some(busy => {
              const busyStart = busy.start.toDate();
              const busyEnd = busy.end.toDate();
              return (slotTime >= busyStart && slotTime < busyEnd) || 
                     (slotEndTime > busyStart && slotEndTime <= busyEnd);
            });
            
            if (!isOccupied) {
              // Precio base sin detección automática de emergencia
              const price = basePrice;
              
              availableSlots.push({
                datetime: admin.firestore.Timestamp.fromDate(slotTime),
                duration: slotDuration,
                price,
                isEmergency: false // Los prestadores deciden manualmente las emergencias
              });
            }
          }
        }
      }

      return {
        availableSlots,
        busySlots,
        workingHours: schedule?.workingHours || availability?.weeklySchedule || {},
        providerTimezone: schedule?.timezone || availability?.settings?.timeZone || 'America/Mexico_City'
      };

    } catch (error) {
      console.error("❌ Error obteniendo agenda:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error obteniendo agenda");
    }
  }
);

/**
 * 📋 createScheduledService
 * Agenda servicio para fecha/hora específica
 */
export const createScheduledService = onCall<{
  userId: string;
  providerId: string;
  serviceType: string;
  scheduledDateTime: admin.firestore.Timestamp;
  quotationId?: string;
  notes?: string;
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    duration: number;
    time: string;
    dayOfWeek?: number;
  };
}>(
  async (request) => {
    const { 
      providerId, 
      serviceType, 
      scheduledDateTime, 
      quotationId,
      notes,
      isRecurring,
      recurringPattern 
    } = request.data;
    
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📋 Creando servicio programado para ${userId}`);

    try {
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      // Validar disponibilidad del slot - usar nueva estructura
      const conflictingServices = await db.collection("scheduledServices")
        .where("providerId", "==", providerId)
        .where("scheduledDateTime", ">=", new admin.firestore.Timestamp(
          scheduledDateTime.seconds - 3600, // 1 hora antes
          scheduledDateTime.nanoseconds
        ))
        .where("scheduledDateTime", "<=", new admin.firestore.Timestamp(
          scheduledDateTime.seconds + 3600, // 1 hora después
          scheduledDateTime.nanoseconds
        ))
        .where("status", "in", ["confirmed", "pending_confirmation"])
        .get();

      if (!conflictingServices.empty) {
        throw new HttpsError("already-exists", "Horario no disponible");
      }

      // Obtener información del servicio y precio
      const providerDoc = await db.collection("providers").doc(providerId).get();
      if (!providerDoc.exists) {
        throw new HttpsError("not-found", "Prestador no encontrado");
      }

      const providerData = providerDoc.data();
      const service = providerData.services?.find((s: any) => s.type === serviceType);
      
      if (!service) {
        throw new HttpsError("not-found", "Servicio no disponible");
      }

      // Precio base sin incremento automático por horario
      const price = (service as any)?.price || 0;

      // Crear servicio programado con nueva estructura
      const scheduledServiceRef = db.collection("scheduledServices").doc();
      const scheduledServiceData: ScheduledService = {
        userId,
        providerId,
        serviceType,
        scheduledDateTime,
        estimatedDuration: service.estimatedDuration || 60,
        status: "pending_confirmation",
        isRecurring: isRecurring || false,
        isEmergency: false, // Solo true si es solicitud explícita de emergencia
        location: new admin.firestore.GeoPoint(0, 0), // Se actualizará con ubicación del usuario
        notes,
        reminders: {
          sent24h: false,
          sent2h: false,
          sent30min: false
        },
        createdAt: now
      };

      batch.set(scheduledServiceRef, scheduledServiceData);

      // Actualizar slot en ProviderSchedule si existe
      const scheduleDoc = await db.collection("providerSchedules").doc(providerId).get();
      if (scheduleDoc.exists) {
        const schedule = scheduleDoc.data() as ProviderSchedule;
        const updatedSlots = schedule.timeSlots.map(slot => {
          if (slot.datetime.seconds === scheduledDateTime.seconds) {
            return {
              ...slot,
              isBooked: true,
              serviceRequestId: scheduledServiceRef.id
            };
          }
          return slot;
        });

        batch.update(scheduleDoc.ref, {
          timeSlots: updatedSlots,
          lastUpdated: now
        });
      }

      // Si es recurrente y el usuario es Premium, configurar patrón
      if (isRecurring && recurringPattern) {
        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        
        if (userData?.isPremium) {
          const recurringRef = db.collection("recurringServices").doc();
          const recurringData = {
            userId,
            providerId,
            serviceType,
            pattern: {
              ...recurringPattern,
              interval: 1,
              frequency: recurringPattern.frequency === "biweekly" ? "weekly" : recurringPattern.frequency
            } as any,
            startDate: scheduledDateTime,
            nextScheduledDate: scheduledDateTime,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            paymentMethodId: userData.defaultPaymentMethodId || ""
          };
          
          batch.set(recurringRef, recurringData);
        }
      }

      // Crear notificación para el prestador
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        userId: providerId,
        type: "new_scheduled_service",
        title: "Nueva solicitud de servicio programado",
        message: `Tienes una nueva solicitud para ${serviceType} el ${scheduledDateTime.toDate().toLocaleString()}`,
        data: {
          scheduledServiceId: scheduledServiceRef.id,
          userId,
          serviceType,
          scheduledDateTime: scheduledDateTime.toMillis(),
          isEmergency: false
        },
        read: false,
        createdAt: now
      });

      // Retener pago automáticamente (crear transacción pendiente)
      const transactionRef = db.collection("transactions").doc();
      batch.set(transactionRef, {
        userId,
        providerId,
        scheduledServiceId: scheduledServiceRef.id,
        amount: price,
        status: "held",
        type: "service_payment",
        description: `Pago por ${serviceType}`,
        createdAt: now
      });

      await batch.commit();

      console.log(`✅ Servicio programado creado: ${scheduledServiceRef.id}`);

      return {
        scheduledServiceId: scheduledServiceRef.id,
        status: "pending_confirmation",
        price,
        isEmergency: false
      };

    } catch (error) {
      console.error("❌ Error creando servicio programado:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error creando servicio programado");
    }
  }
);

/**
 * ✅ confirmAppointment
 * Prestador confirma, rechaza o propone horario alternativo
 */
export const confirmAppointment = onCall<{
  serviceRequestId: string;
  providerId: string;
  action: 'confirm' | 'reject' | 'propose_alternative';
  alternativeDateTime?: admin.firestore.Timestamp;
  rejectionReason?: string;
}>(
  async (request) => {
    const { 
      serviceRequestId, 
      action, 
      alternativeDateTime, 
      rejectionReason 
    } = request.data;
    
    const providerId = request.auth?.uid;
    if (!providerId) {
      throw new HttpsError("unauthenticated", "Prestador no autenticado");
    }

    console.log(`✅ Procesando confirmación de cita: ${action}`);

    try {
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      // Obtener servicio programado
      const scheduledServiceDoc = await db.collection("scheduledServices")
        .doc(serviceRequestId)
        .get();
      
      if (!scheduledServiceDoc.exists) {
        throw new HttpsError("not-found", "Servicio programado no encontrado");
      }

      const scheduledService = scheduledServiceDoc.data();
      
      // Validar que el prestador puede modificar la cita
      if (scheduledService.providerId !== providerId) {
        throw new HttpsError("permission-denied", "No autorizado para modificar esta cita");
      }

      // Verificar que el servicio está pendiente de confirmación
      if (scheduledService.status !== "pending_confirmation") {
        throw new HttpsError("invalid-argument", "El servicio no está pendiente de confirmación");
      }

      let newStatus = "";
      let notificationMessage = "";
      
      switch (action) {
        case 'confirm':
          newStatus = "confirmed";
          notificationMessage = "Tu servicio ha sido confirmado";
          
          // Confirmar servicio programado
          batch.update(scheduledServiceDoc.ref, {
            status: "confirmed",
            confirmedAt: now,
            updatedAt: now
          });
          
          // Confirmar transacción
          const transactionQuery = await db.collection("transactions")
            .where("scheduledServiceId", "==", serviceRequestId)
            .get();
          
          transactionQuery.forEach(doc => {
            batch.update(doc.ref, { 
              status: "confirmed",
              updatedAt: now 
            });
          });
          
          // Confirmar slot en ProviderSchedule
          const scheduleDoc = await db.collection("providerSchedules").doc(providerId).get();
          if (scheduleDoc.exists) {
            const schedule = scheduleDoc.data() as ProviderSchedule;
            const updatedSlots = schedule.timeSlots.map(slot => {
              if (slot.serviceRequestId === serviceRequestId) {
                return {
                  ...slot,
                  isBooked: true // Confirmar definitivamente
                };
              }
              return slot;
            });

            batch.update(scheduleDoc.ref, {
              timeSlots: updatedSlots,
              lastUpdated: now
            });
          }
          
          break;
          
        case 'reject':
          newStatus = "cancelled";
          notificationMessage = `Tu servicio fue rechazado: ${rejectionReason || "Sin especificar"}`;
          
          // Cancelar servicio programado
          batch.update(scheduledServiceDoc.ref, {
            status: "cancelled",
            cancellationReason: rejectionReason,
            cancelledAt: now,
            updatedAt: now
          });
          
          // Liberar slot en ProviderSchedule
          const rejectedScheduleDoc = await db.collection("providerSchedules").doc(providerId).get();
          if (rejectedScheduleDoc.exists) {
            const schedule = rejectedScheduleDoc.data() as ProviderSchedule;
            const updatedSlots = schedule.timeSlots.map(slot => {
              if (slot.serviceRequestId === serviceRequestId) {
                return {
                  ...slot,
                  isBooked: false,
                  serviceRequestId: undefined
                };
              }
              return slot;
            });

            batch.update(rejectedScheduleDoc.ref, {
              timeSlots: updatedSlots,
              lastUpdated: now
            });
          }
          
          // Cancelar y reembolsar transacción
          const rejectedTransactionQuery = await db.collection("transactions")
            .where("scheduledServiceId", "==", serviceRequestId)
            .get();
          
          rejectedTransactionQuery.forEach(doc => {
            batch.update(doc.ref, { 
              status: "refunded",
              refundedAt: now,
              refundReason: rejectionReason,
              updatedAt: now 
            });
          });
          
          break;
          
        case 'propose_alternative':
          if (!alternativeDateTime) {
            throw new HttpsError("invalid-argument", "Fecha alternativa requerida");
          }
          
          newStatus = "alternative_proposed";
          notificationMessage = `El prestador propone una fecha alternativa: ${alternativeDateTime.toDate().toLocaleString()}`;
          
          // Crear propuesta alternativa
          const proposalRef = db.collection("alternativeProposals").doc();
          batch.set(proposalRef, {
            serviceRequestId,
            providerId,
            userId: scheduledService.userId,
            originalDateTime: scheduledService.scheduledDateTime,
            proposedDateTime: alternativeDateTime,
            status: "pending",
            createdAt: now
          });
          
          break;
      }

      // Crear notificación para el usuario
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        userId: scheduledService.userId,
        type: `appointment_${action}`,
        title: "Actualización de tu cita",
        message: notificationMessage,
        data: {
          scheduledServiceId: serviceRequestId,
          action,
          providerId,
          serviceType: scheduledService.serviceType,
          scheduledDateTime: scheduledService.scheduledDateTime.toMillis(),
          ...(alternativeDateTime && { alternativeDateTime: alternativeDateTime.toMillis() })
        },
        read: false,
        createdAt: now
      });

      await batch.commit();

      console.log(`✅ Cita procesada: ${action}`);

      return {
        success: true,
        newStatus,
        notificationSent: true
      };

    } catch (error) {
      console.error("❌ Error procesando confirmación:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando confirmación");
    }
  }
);

/**
 * 🔄 setupRecurringService
 * Configura servicio recurrente (solo Premium)
 */
export const setupRecurringService = onCall<{
  userId: string;
  providerId: string;
  serviceType: string;
  startDate: admin.firestore.Timestamp;
  pattern: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    duration: number;
    time: string;
    dayOfWeek?: number;
  };
  paymentMethodId: string;
}>(
  async (request) => {
    const { 
      providerId, 
      serviceType, 
      startDate, 
      pattern,
      paymentMethodId 
    } = request.data;
    
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🔄 Configurando servicio recurrente para ${userId}`);

    try {
      // Validar que usuario sea Premium
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.isPremium) {
        throw new HttpsError(
          "permission-denied", 
          "Función disponible solo para usuarios Premium"
        );
      }

      // Validar método de pago
      const paymentMethodDoc = await db.collection("paymentMethods")
        .doc(paymentMethodId)
        .get();
      
      if (!paymentMethodDoc.exists || paymentMethodDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Método de pago no válido");
      }

      // Obtener información del servicio
      const providerDoc = await db.collection("providers").doc(providerId).get();
      const service = providerDoc.data()?.services?.find(
        (s: any) => s.type === serviceType
      );
      
      if (!service) {
        throw new HttpsError("not-found", "Servicio no disponible");
      }

      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      // Crear servicio recurrente
      const recurringRef = db.collection("recurringServices").doc();
      const recurringData = {
        userId,
        providerId,
        serviceType,
        pattern: {
          ...pattern,
          interval: 1,
          frequency: (pattern as any).frequency === "biweekly" ? "weekly" : (pattern as any).frequency
        } as any,
        startDate,
        nextScheduledDate: startDate,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        paymentMethodId,
        totalServices: 0,
        completedServices: 0,
        lastServiceDate: null,
        estimatedMonthlySpend: calculateMonthlySpend((service as any)?.price || 0, pattern.frequency)
      };

      batch.set(recurringRef, recurringData);

      // Programar servicios para los próximos 6 meses
      const scheduledDates = [];
      let currentDate = new Date(startDate.toDate());
      const endDate = new Date(currentDate);
      endDate.setMonth(endDate.getMonth() + pattern.duration);

      while (currentDate <= endDate) {
        // Crear booking para cada fecha
        const bookingRef = db.collection("serviceBookings").doc();
        const bookingDate = admin.firestore.Timestamp.fromDate(currentDate);
        
        batch.set(bookingRef, {
          recurringServiceId: recurringRef.id,
          userId,
          providerId,
          serviceType,
          scheduledDateTime: bookingDate,
          estimatedEndTime: new admin.firestore.Timestamp(
            bookingDate.seconds + (service.estimatedDuration || 60) * 60,
            bookingDate.nanoseconds
          ),
          status: "recurring_scheduled",
          price: (service as any)?.price || 0,
          isRecurring: true,
          createdAt: now,
          updatedAt: now
        });

        scheduledDates.push(currentDate.toISOString());

        // Calcular próxima fecha según frecuencia
        switch (pattern.frequency) {
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'biweekly':
            currentDate.setDate(currentDate.getDate() + 14);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }
      }

      // Notificar al prestador
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        userId: providerId,
        type: "new_recurring_service",
        title: "Nuevo servicio recurrente configurado",
        message: `${userData.displayName} ha configurado un servicio ${pattern.frequency} de ${serviceType}`,
        data: {
          recurringServiceId: recurringRef.id,
          userId,
          pattern,
          scheduledCount: scheduledDates.length
        },
        read: false,
        createdAt: now
      });

      await batch.commit();

      console.log(`✅ Servicio recurrente configurado: ${recurringRef.id}`);

      return {
        recurringServiceId: recurringRef.id,
        scheduledCount: scheduledDates.length,
        nextServiceDate: startDate
      };

    } catch (error) {
      console.error("❌ Error configurando servicio recurrente:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error configurando servicio recurrente");
    }
  }
);

// ❌ FUNCIÓN REMOVIDA: handleEmergencyService
// La detección automática de emergencias ha sido eliminada.
// Ahora las emergencias son completamente discrecionales - solo prestadores
// que voluntariamente se registren para emergencias aparecerán en búsquedas.
// Ver emergencyFunctions.ts para las nuevas funciones de emergencia.

/**
 * 📊 generatePremiumAnalytics
 * Genera analytics avanzados con predicción IA (solo Premium)
 */
export const generatePremiumAnalytics = onCall<{
  userId: string;
  analysisType: 'spending' | 'predictions' | 'recommendations' | 'full';
  timeframe: 'month' | 'quarter' | 'year';
}>(
  async (request) => {
    const { analysisType, timeframe } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📊 Generando analytics Premium para ${userId}`);

    try {
      // Validar que usuario sea Premium
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.isPremium) {
        throw new HttpsError(
          "permission-denied", 
          "Analytics avanzados disponibles solo para usuarios Premium"
        );
      }

      // Calcular fechas según timeframe
      const now = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Obtener historial de servicios
      const servicesSnapshot = await db.collection("serviceRequests")
        .where("userId", "==", userId)
        .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startDate))
        .where("status", "==", "completed")
        .get();

      const services = servicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let analytics: any = {};

      // Análisis de gastos
      if (analysisType === 'spending' || analysisType === 'full') {
        const spendingByCategory: any = {};
        let totalSpent = 0;
        const monthlySpending: any = {};

        services.forEach(service => {
          const category = (service as any)?.serviceType || "unknown";
          const amount = (service as any)?.price || 0 || 0;
          const month = (service as any)?.createdAt || admin.firestore.Timestamp.now().toDate().toISOString().substring(0, 7);

          totalSpent += amount;
          spendingByCategory[category] = (spendingByCategory[category] || 0) + amount;
          monthlySpending[month] = (monthlySpending[month] || 0) + amount;
        });

        const months = Object.keys(monthlySpending).length || 1;
        const monthlyAverage = totalSpent / months;

        // Calcular tendencia
        const sortedMonths = Object.keys(monthlySpending).sort();
        const recentMonths = sortedMonths.slice(-3);
        const olderMonths = sortedMonths.slice(0, 3);
        
        const recentAvg = recentMonths.reduce((sum, month) => 
          sum + monthlySpending[month], 0) / recentMonths.length;
        const olderAvg = olderMonths.reduce((sum, month) => 
          sum + monthlySpending[month], 0) / olderMonths.length || recentAvg;
        
        const trendDirection = recentAvg > olderAvg * 1.1 ? 'increasing' : 
                             recentAvg < olderAvg * 0.9 ? 'decreasing' : 'stable';

        analytics.spendingAnalysis = {
          totalSpent,
          categoryBreakdown: spendingByCategory,
          monthlyAverage,
          trendDirection,
          monthlyDetails: monthlySpending
        };
      }

      // Predicciones
      if (analysisType === 'predictions' || analysisType === 'full') {
        // Analizar patrones de servicio
        const servicePatterns: any = {};
        const dayPatterns: any = {};
        
        services.forEach(service => {
          const type = (service as any)?.serviceType || "unknown";
          const dayOfWeek = (service as any)?.createdAt || admin.firestore.Timestamp.now().toDate().getDay();
          
          servicePatterns[type] = (servicePatterns[type] || 0) + 1;
          dayPatterns[dayOfWeek] = (dayPatterns[dayOfWeek] || 0) + 1;
        });

        // Predecir próximo servicio más probable
        const mostFrequentService = Object.entries(servicePatterns)
          .sort(([,a]: any, [,b]: any) => b - a)[0]?.[0];
        
        const mostFrequentDay = Object.entries(dayPatterns)
          .sort(([,a]: any, [,b]: any) => b - a)[0]?.[0];

        // Calcular días promedio entre servicios del mismo tipo
        const serviceIntervals: any = {};
        const servicesByType = services.reduce((acc: any, service) => {
          const type = (service as any)?.serviceType || "unknown";
          if (!acc[type]) acc[type] = [];
          acc[type].push((service as any)?.createdAt || admin.firestore.Timestamp.now().toDate());
          return acc;
        }, {});

        Object.entries(servicesByType).forEach(([type, dates]: any) => {
          if (dates.length > 1) {
            dates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
            const intervals = [];
            
            for (let i = 1; i < dates.length; i++) {
              const days = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
              intervals.push(days);
            }
            
            serviceIntervals[type] = 
              intervals.reduce((a, b) => a + b, 0) / intervals.length;
          }
        });

        // Predecir fecha del próximo servicio
        const lastServiceDate = services
          .filter(s => (s as any)?.serviceType === mostFrequentService)
          .sort((a, b) => (((b as any)?.createdAt?.seconds || 0) - ((a as any)?.createdAt?.seconds || 0)))[0] as any;

        const avgInterval = serviceIntervals[mostFrequentService] || 30;
        const nextServiceDate = lastServiceDate ? 
          new Date(lastServiceDate.getTime() + avgInterval * 24 * 60 * 60 * 1000) :
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Calcular presupuesto recomendado
        const monthlyAvg = analytics.spendingAnalysis?.monthlyAverage || 
          (analytics.spendingAnalysis?.totalSpent || 0) / ((now.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
        
        analytics.predictions = {
          nextServiceNeeded: mostFrequentService || "cleaning",
          estimatedDate: admin.firestore.Timestamp.fromDate(nextServiceDate),
          budgetRecommendation: Math.ceil(monthlyAvg * 1.1),
          serviceIntervals,
          preferredDayOfWeek: parseInt(mostFrequentDay) || 0
        };
      }

      // Recomendaciones
      if (analysisType === 'recommendations' || analysisType === 'full') {
        // Analizar prestadores frecuentes
        const providerFrequency: any = {};
        const providerRatings: any = {};
        
        for (const service of services) {
          const providerId = (service as any)?.providerId || "unknown";
          providerFrequency[providerId] = (providerFrequency[providerId] || 0) + 1;
          
          // Obtener rating del servicio si existe
          const reviewDoc = await db.collection("reviews")
            .where("serviceRequestId", "==", service.id)
            .where("userId", "==", userId)
            .get();
          
          if (!reviewDoc.empty) {
            const rating = reviewDoc.docs[0].data().rating;
            if (!providerRatings[providerId]) {
              providerRatings[providerId] = { total: 0, count: 0 };
            }
            providerRatings[providerId].total += rating;
            providerRatings[providerId].count += 1;
          }
        }

        // Calcular prestadores preferidos
        const preferredProviders = await Promise.all(
          Object.entries(providerFrequency)
            .sort(([,a]: any, [,b]: any) => b - a)
            .slice(0, 5)
            .map(async ([providerId, frequency]) => {
              const providerDoc = await db.collection("providers").doc(providerId).get();
              const avgRating = providerRatings[providerId] ? 
                providerRatings[providerId].total / providerRatings[providerId].count : 0;
              
              return {
                providerId,
                name: providerDoc.data()?.displayName || "Unknown",
                servicesCompleted: frequency,
                averageRating: avgRating
              };
            })
        );

        // Tips de ahorro
        const costSavingTips = [];
        
        // Analizar horarios más caros
        const servicesByHour = services.reduce((acc: any, service) => {
          const hour = (service as any)?.scheduledDateTime || admin.firestore.Timestamp.now()?.toDate().getHours() || 
                      (service as any)?.createdAt || admin.firestore.Timestamp.now().toDate().getHours();
          if (!acc[hour]) acc[hour] = { count: 0, totalCost: 0 };
          acc[hour].count += 1;
          acc[hour].totalCost += (service as any)?.price || 0 || 0;
          return acc;
        }, {});

        const expensiveHours = Object.entries(servicesByHour)
          .filter(([hour, data]: any) => data.count > 2)
          .map(([hour, data]: any) => ({
            hour: parseInt(hour),
            avgCost: data.totalCost / data.count
          }))
          .sort((a, b) => b.avgCost - a.avgCost);

        if (expensiveHours.length > 0 && expensiveHours[0].avgCost > expensiveHours[expensiveHours.length - 1].avgCost * 1.2) {
          costSavingTips.push({
            tip: "Agenda servicios en horarios no pico",
            savings: `Hasta ${Math.round((expensiveHours[0].avgCost - expensiveHours[expensiveHours.length - 1].avgCost) / expensiveHours[0].avgCost * 100)}% de ahorro`,
            details: `Evita servicios entre ${expensiveHours[0].hour}:00-${expensiveHours[0].hour + 1}:00`
          });
        }

        // Identificar oportunidades de servicios recurrentes
        const recurringOpportunities = Object.entries(analytics.servicePatterns || {})
          .filter(([type, count]: any) => count >= 3)
          .map(([type, count]) => ({
            serviceType: type,
            frequency: Math.round(services.length / (count as number)),
            potentialSavings: "10% con servicio recurrente"
          }));

        analytics.recommendations = {
          costSavingTips,
          preferredProviders,
          recurringOpportunities
        };
      }

      // Guardar analytics en caché
      await db.collection("premiumAnalytics").doc(userId).set({
        userId,
        analysisType,
        timeframe,
        analytics,
        generatedAt: admin.firestore.Timestamp.now(),
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
        )
      }, { merge: true });

      console.log(`✅ Analytics Premium generados para ${userId}`);

      return analytics;

    } catch (error) {
      console.error("❌ Error generando analytics:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error generando analytics");
    }
  }
);

/**
 * 🌍 enableInternationalServices
 * Habilita servicios internacionales (solo Premium)
 */
export const enableInternationalServices = onCall<{
  userId: string;
  targetCountry: string;
  targetCity: string;
  serviceType: string;
  stayDuration: number;
  language: string;
}>(
  async (request) => {
    const { 
      targetCountry, 
      targetCity, 
      serviceType, 
      stayDuration,
      language 
    } = request.data;
    
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🌍 Habilitando servicios internacionales para ${userId}`);

    try {
      // Validar que usuario sea Premium
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.isPremium) {
        throw new HttpsError(
          "permission-denied", 
          "Servicios internacionales disponibles solo para usuarios Premium"
        );
      }

      // Verificar cobertura en el país
      const countryDoc = await db.collection("supportedCountries")
        .doc(targetCountry.toUpperCase())
        .get();
      
      if (!countryDoc.exists || !countryDoc.data()?.isActive) {
        return {
          isAvailable: false,
          availableProviders: 0,
          priceRange: { min: 0, max: 0, currency: "USD" },
          localRegulations: [],
          estimatedResponse: "No disponible en este país"
        };
      }

      const countryData = countryDoc.data();
      
      // Buscar prestadores en la ciudad objetivo
      const providersSnapshot = await db.collection("providers")
        .where("country", "==", targetCountry.toUpperCase())
        .where("city", "==", targetCity)
        .where("services.type", "array-contains", serviceType)
        .where("acceptsInternational", "==", true)
        .where("languages", "array-contains", language)
        .limit(50)
        .get();

      if (providersSnapshot.empty) {
        return {
          isAvailable: false,
          availableProviders: 0,
          priceRange: { min: 0, max: 0, currency: countryData.currency },
          localRegulations: countryData.regulations || [],
          estimatedResponse: "No hay prestadores disponibles en esta ciudad"
        };
      }

      // Calcular rango de precios
      const prices = providersSnapshot.docs
        .map(doc => {
          const service = doc.data().services.find((s: any) => s.type === serviceType);
          return service?.price || 0;
        })
        .filter(price => price > 0);

      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        currency: countryData.currency
      };

      // Guardar configuración internacional del usuario
      const internationalRef = db.collection("internationalServices").doc();
      await internationalRef.set({
        userId,
        targetCountry,
        targetCity,
        serviceType,
        stayDuration,
        language,
        status: "active",
        availableProviders: providersSnapshot.size,
        priceRange,
        createdAt: admin.firestore.Timestamp.now(),
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + stayDuration * 24 * 60 * 60 * 1000)
        )
      });

      // Crear notificación de bienvenida
      await db.collection("notifications").add({
        userId,
        type: "international_services_enabled",
        title: `Servicios habilitados en ${targetCity}, ${targetCountry}`,
        message: `Tienes ${providersSnapshot.size} prestadores disponibles para ${serviceType}`,
        data: {
          internationalServiceId: internationalRef.id,
          targetCountry,
          targetCity,
          serviceType
        },
        read: false,
        createdAt: admin.firestore.Timestamp.now()
      });

      console.log(`✅ Servicios internacionales habilitados en ${targetCity}`);

      return {
        isAvailable: true,
        availableProviders: providersSnapshot.size,
        priceRange,
        localRegulations: countryData.regulations || [],
        estimatedResponse: countryData.averageResponseTime || "1-2 horas"
      };

    } catch (error) {
      console.error("❌ Error habilitando servicios internacionales:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error habilitando servicios internacionales");
    }
  }
);

/**
 * 📧 sendScheduleReminders
 * Envía recordatorios automáticos de citas programadas
 */
export const sendScheduleReminders = onSchedule({
  schedule: "every 30 minutes",
  timeZone: "America/Mexico_City",
}, async (context) => {
  console.log("📧 Ejecutando envío de recordatorios programados");

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();
  
  try {
    // Recordatorios de 24 horas
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const services24h = await db.collection("scheduledServices")
      .where("status", "==", "confirmed")
      .where("scheduledDateTime", ">=", now)
      .where("scheduledDateTime", "<=", admin.firestore.Timestamp.fromDate(tomorrow))
      .where("reminders.sent24h", "==", false)
      .get();

    let reminders24h = 0;
    
    for (const serviceDoc of services24h.docs) {
      const service = serviceDoc.data();
      
      // Crear recordatorio para usuario
      const userReminderRef = db.collection("notifications").doc();
      batch.set(userReminderRef, {
        userId: service.userId,
        type: "service_reminder_24h",
        title: "Recordatorio de servicio mañana",
        message: `Tu servicio de ${(service as any)?.serviceType || "unknown"} está programado para mañana a las ${(service as any)?.scheduledDateTime || admin.firestore.Timestamp.now().toDate().toLocaleTimeString()}`,
        data: {
          scheduledServiceId: serviceDoc.id,
          serviceType: (service as any)?.serviceType || "unknown",
          providerId: (service as any)?.providerId || "unknown",
          scheduledDateTime: (service as any)?.scheduledDateTime || admin.firestore.Timestamp.now().toMillis()
        },
        read: false,
        createdAt: now
      });

      // Crear recordatorio para prestador
      const providerReminderRef = db.collection("notifications").doc();
      batch.set(providerReminderRef, {
        userId: (service as any)?.providerId || "unknown",
        type: "service_reminder_24h",
        title: "Servicio programado para mañana",
        message: `Tienes un servicio de ${(service as any)?.serviceType || "unknown"} programado para mañana a las ${(service as any)?.scheduledDateTime || admin.firestore.Timestamp.now().toDate().toLocaleTimeString()}`,
        data: {
          scheduledServiceId: serviceDoc.id,
          serviceType: (service as any)?.serviceType || "unknown",
          userId: service.userId,
          scheduledDateTime: (service as any)?.scheduledDateTime || admin.firestore.Timestamp.now().toMillis()
        },
        read: false,
        createdAt: now
      });

      // Marcar recordatorio como enviado
      batch.update(serviceDoc.ref, {
        "reminders.sent24h": true,
        updatedAt: now
      });

      reminders24h++;
    }

    // Recordatorios de 2 horas
    const in2Hours = new Date();
    in2Hours.setHours(in2Hours.getHours() + 2);
    
    const services2h = await db.collection("scheduledServices")
      .where("status", "==", "confirmed")
      .where("scheduledDateTime", ">=", now)
      .where("scheduledDateTime", "<=", admin.firestore.Timestamp.fromDate(in2Hours))
      .where("reminders.sent2h", "==", false)
      .get();

    let reminders2h = 0;
    
    for (const serviceDoc of services2h.docs) {
      const service = serviceDoc.data();
      
      // Crear recordatorio para usuario
      const userReminderRef = db.collection("notifications").doc();
      batch.set(userReminderRef, {
        userId: service.userId,
        type: "service_reminder_2h",
        title: "Tu servicio comienza en 2 horas",
        message: `Prepárate para tu servicio de ${(service as any)?.serviceType || "unknown"} a las ${(service as any)?.scheduledDateTime || admin.firestore.Timestamp.now().toDate().toLocaleTimeString()}`,
        data: {
          scheduledServiceId: serviceDoc.id,
          serviceType: (service as any)?.serviceType || "unknown",
          providerId: (service as any)?.providerId || "unknown",
          scheduledDateTime: (service as any)?.scheduledDateTime || admin.firestore.Timestamp.now().toMillis()
        },
        priority: "high",
        read: false,
        createdAt: now
      });

      // Marcar recordatorio como enviado
      batch.update(serviceDoc.ref, {
        "reminders.sent2h": true,
        updatedAt: now
      });

      reminders2h++;
    }

    // Recordatorios próximos al servicio
    const in30Min = new Date();
    in30Min.setMinutes(in30Min.getMinutes() + 30);
    
    const services30min = await db.collection("scheduledServices")
      .where("status", "==", "confirmed")
      .where("scheduledDateTime", ">=", now)
      .where("scheduledDateTime", "<=", admin.firestore.Timestamp.fromDate(in30Min))
      .where("reminders.sent30min", "==", false)
      .get();

    let reminders30min = 0;
    
    for (const serviceDoc of services30min.docs) {
      const service = serviceDoc.data();
      
      // Obtener información del prestador para la ubicación
      const providerDoc = await db.collection("providers").doc((service as any)?.providerId || "unknown").get();
      const providerData = providerDoc.data();
      
      // Crear recordatorio urgente para usuario
      const userReminderRef = db.collection("notifications").doc();
      batch.set(userReminderRef, {
        userId: service.userId,
        type: "service_reminder_30min",
        title: "⏰ Tu servicio comienza pronto",
        message: `${(service as any)?.serviceType || "unknown"} con ${providerData?.displayName}. Dirección: ${providerData?.address || "Por confirmar"}`,
        data: {
          scheduledServiceId: serviceDoc.id,
          serviceType: (service as any)?.serviceType || "unknown",
          providerId: (service as any)?.providerId || "unknown",
          scheduledDateTime: (service as any)?.scheduledDateTime || admin.firestore.Timestamp.now().toMillis(),
          providerLocation: providerData?.location,
          allowReschedule: true
        },
        priority: "urgent",
        read: false,
        createdAt: now
      });

      // Marcar recordatorio como enviado
      batch.update(serviceDoc.ref, {
        "reminders.sent30min": true,
        updatedAt: now
      });

      reminders30min++;
    }

    // Procesar confirmaciones recibidas
    let confirmationsReceived = 0;
    const confirmationDocs = await db.collection("bookingConfirmations")
      .where("processed", "==", false)
      .get();

    confirmationDocs.forEach(doc => {
      batch.update(doc.ref, {
        processed: true,
        processedAt: now
      });
      confirmationsReceived++;
    });

    // Procesar solicitudes de reprogramación
    let reschedulingRequests = 0;
    const rescheduleDocs = await db.collection("reschedulingRequests")
      .where("status", "==", "pending")
      .get();

    reschedulingRequests = rescheduleDocs.size;

    await batch.commit();

    console.log(`✅ Recordatorios enviados: 24h=${reminders24h}, 2h=${reminders2h}, 30min=${reminders30min}`);
    console.log(`📊 Confirmaciones recibidas: ${confirmationsReceived}, Reprogramaciones: ${reschedulingRequests}`);
    // Scheduled functions should not return values

  } catch (error) {
    console.error("❌ Error enviando recordatorios:", error);
    throw error;
  }
});

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

function checkCurrentAvailability(availability: any): boolean {
  if (!availability) return false;
  
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const daySchedule = availability.weeklySchedule?.[dayOfWeek];
  if (!daySchedule || !daySchedule.isAvailable) return false;
  
  // Verificar si está en horario de trabajo
  for (const period of daySchedule.periods || []) {
    const [startHour, startMin] = period.start.split(':').map(Number);
    const [endHour, endMin] = period.end.split(':').map(Number);
    
    const periodStart = startHour * 60 + startMin;
    const periodEnd = endHour * 60 + endMin;
    
    if (currentTime >= periodStart && currentTime <= periodEnd) {
      return true;
    }
  }
  
  return false;
}

function calculateMonthlySpend(price: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return price * 4.33; // promedio de semanas por mes
    case 'biweekly':
      return price * 2.17;
    case 'monthly':
      return price;
    default:
      return price;
  }
}

// ===== FUNCIONES ADICIONALES PARA NUEVAS ESTRUCTURAS =====

/**
 * 🔧 initializeProviderSchedule
 * Inicializa la estructura detallada de horarios para un prestador
 */
export const initializeProviderSchedule = onCall<{
  providerId: string;
  workingHours: ProviderSchedule['workingHours'];
  emergencyAvailable?: boolean;
  maxDailyServices?: number;
  bufferTime?: number;
  timezone?: string;
}>(
  async (request) => {
    const { 
      providerId, 
      workingHours, 
      emergencyAvailable = false,
      maxDailyServices = 8,
      bufferTime = 30,
      timezone = 'America/Mexico_City'
    } = request.data;
    
    const currentUserId = request.auth?.uid;
    if (!currentUserId || currentUserId !== providerId) {
      throw new HttpsError("permission-denied", "Solo el prestador puede configurar su horario");
    }

    console.log(`🔧 Inicializando horario detallado para ${providerId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // Validar horarios de trabajo
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of days) {
        const daySchedule = workingHours[day as keyof ProviderSchedule['workingHours']];
        if (daySchedule.isAvailable && (!daySchedule.start || !daySchedule.end)) {
          throw new HttpsError("invalid-argument", `Horario incompleto para ${day}`);
        }
      }

      // Crear estructura detallada de horarios
      const providerSchedule: ProviderSchedule = {
        providerId,
        workingHours,
        timeSlots: [], // Se generarán dinámicamente
        emergencyAvailable,
        maxDailyServices,
        bufferTime,
        timezone,
        lastUpdated: now
      };

      // Guardar en la nueva colección
      await db.collection("providerSchedules").doc(providerId).set(providerSchedule);

      // Generar slots para los próximos 30 días
      await generateTimeSlots(providerId, 30);

      console.log(`✅ Horario detallado inicializado para ${providerId}`);

      return {
        success: true,
        message: "Horario detallado configurado exitosamente",
        slotsGenerated: true
      };

    } catch (error) {
      console.error("❌ Error inicializando horario:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error inicializando horario");
    }
  }
);

/**
 * 📅 generateTimeSlots
 * Genera slots de tiempo específicos para un prestador
 */
async function generateTimeSlots(providerId: string, daysAhead: number = 30): Promise<void> {
  const scheduleDoc = await db.collection("providerSchedules").doc(providerId).get();
  if (!scheduleDoc.exists) {
    throw new Error("Horario no encontrado");
  }

  const schedule = scheduleDoc.data() as ProviderSchedule;
  const providerDoc = await db.collection("providers").doc(providerId).get();
  const providerServices = providerDoc.data()?.services || [];

  const newSlots = [];
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof ProviderSchedule['workingHours'];
    const daySchedule = schedule.workingHours[dayName];

    if (!daySchedule.isAvailable) continue;

    const [startHour, startMin] = daySchedule.start.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end.split(':').map(Number);

    const dayStart = new Date(date);
    dayStart.setHours(startHour, startMin, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, endMin, 0, 0);

    // Generar slots cada hora con buffer time
    for (let time = new Date(dayStart); time < dayEnd; time.setMinutes(time.getMinutes() + 60 + schedule.bufferTime)) {
      const slotEnd = new Date(time);
      slotEnd.setMinutes(slotEnd.getMinutes() + 60);

      if (slotEnd > dayEnd) break;

      // Precio base sin incremento automático por horario
      const basePrice = providerServices[0]?.price || 500;

      newSlots.push({
        datetime: admin.firestore.Timestamp.fromDate(time),
        duration: 60,
        isBooked: false,
        price: basePrice,
        isEmergencySlot: false // Los prestadores manejan emergencias separadamente
      });
    }
  }

  // Actualizar los slots en la base de datos
  await db.collection("providerSchedules").doc(providerId).update({
    timeSlots: newSlots,
    lastUpdated: admin.firestore.Timestamp.now()
  });
}

/**
 * 📋 createScheduledServiceDetailed
 * Crea un servicio programado usando la nueva estructura detallada
 */
export const createScheduledServiceDetailed = onCall<{
  providerId: string;
  serviceType: string;
  scheduledDateTime: admin.firestore.Timestamp;
  notes?: string;
  isEmergency?: boolean;
}>(
  async (request) => {
    const { providerId, serviceType, scheduledDateTime, notes, isEmergency = false } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📋 Creando servicio programado detallado para ${userId}`);

    try {
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      // Verificar disponibilidad en providerSchedules
      const scheduleDoc = await db.collection("providerSchedules").doc(providerId).get();
      if (!scheduleDoc.exists) {
        throw new HttpsError("not-found", "Horario del prestador no encontrado");
      }

      const schedule = scheduleDoc.data() as ProviderSchedule;
      const requestedSlot = schedule.timeSlots.find(slot => 
        slot.datetime.seconds === scheduledDateTime.seconds && !slot.isBooked
      );

      if (!requestedSlot) {
        throw new HttpsError("unavailable", "Horario no disponible");
      }

      // Obtener información del usuario y prestador
      const [userDoc, providerDoc] = await Promise.all([
        db.collection("users").doc(userId).get(),
        db.collection("providers").doc(providerId).get()
      ]);

      if (!userDoc.exists || !providerDoc.exists) {
        throw new HttpsError("not-found", "Usuario o prestador no encontrado");
      }

      const userData = userDoc.data();
      const providerData = providerDoc.data();
      const service = providerData?.services?.find((s: any) => s.type === serviceType);

      if (!service) {
        throw new HttpsError("not-found", "Servicio no disponible");
      }

      // Crear servicio programado detallado
      const scheduledServiceRef = db.collection("scheduledServices").doc();
      const scheduledServiceData: ScheduledService = {
        userId,
        providerId,
        serviceType,
        scheduledDateTime,
        estimatedDuration: service.estimatedDuration || 60,
        status: "pending_confirmation",
        isRecurring: false,
        isEmergency: isEmergency, // Solo si es solicitud explícita
        location: new admin.firestore.GeoPoint(
          userData?.location?.lat || 0,
          userData?.location?.lng || 0
        ),
        notes,
        reminders: {
          sent24h: false,
          sent2h: false,
          sent30min: false
        },
        createdAt: now
      };

      batch.set(scheduledServiceRef, scheduledServiceData);

      // Marcar slot como ocupado
      const updatedSlots = schedule.timeSlots.map(slot => {
        if (slot.datetime.seconds === scheduledDateTime.seconds) {
          return {
            ...slot,
            isBooked: true,
            serviceRequestId: scheduledServiceRef.id
          };
        }
        return slot;
      });

      batch.update(scheduleDoc.ref, {
        timeSlots: updatedSlots,
        lastUpdated: now
      });

      // Crear notificación para el prestador
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        userId: providerId,
        type: "new_scheduled_service_detailed",
        title: "Nueva cita programada",
        message: `${userData?.displayName || 'Un usuario'} ha programado ${serviceType} para ${scheduledDateTime.toDate().toLocaleString()}`,
        data: {
          scheduledServiceId: scheduledServiceRef.id,
          userId,
          serviceType,
          scheduledDateTime: scheduledDateTime.toMillis(),
          isEmergency: false
        },
        read: false,
        createdAt: now
      });

      await batch.commit();

      console.log(`✅ Servicio programado detallado creado: ${scheduledServiceRef.id}`);

      return {
        scheduledServiceId: scheduledServiceRef.id,
        status: "pending_confirmation",
        price: requestedSlot.price,
        isEmergency: isEmergency
      };

    } catch (error) {
      console.error("❌ Error creando servicio programado detallado:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error creando servicio programado");
    }
  }
);

/**
 * 📊 generateDetailedPremiumAnalytics
 * Genera analytics detallados usando la nueva estructura PremiumAnalyticsData
 */
export const generateDetailedPremiumAnalytics = onCall<{
  analysisType: 'spending' | 'predictions' | 'recommendations' | 'full';
}>(
  async (request) => {
    const { analysisType } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📊 Generando analytics detallados para ${userId}`);

    try {
      // Validar que usuario sea Premium
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.data()?.isPremium) {
        throw new HttpsError("permission-denied", "Función disponible solo para usuarios Premium");
      }

      const now = admin.firestore.Timestamp.now();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Obtener datos de servicios programados
      const scheduledServicesSnapshot = await db.collection("scheduledServices")
        .where("userId", "==", userId)
        .where("status", "==", "completed")
        .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(oneYearAgo))
        .get();

      const completedServices = scheduledServicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calcular datos de gasto
      let totalLifetimeSpent = 0;
      const monthlySpending: Record<string, number> = {};
      const categoryCount: Record<string, number> = {};

      completedServices.forEach((service: any) => {
        // Obtener precio del servicio (asumir precio promedio si no está disponible)
        const servicePrice = (service as any)?.price || 0 || 500;
        totalLifetimeSpent += servicePrice;

        const monthKey = (service as any)?.createdAt || admin.firestore.Timestamp.now().toDate().toISOString().substring(0, 7);
        monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + servicePrice;

        categoryCount[(service as any)?.serviceType || "unknown"] = (categoryCount[(service as any)?.serviceType || "unknown"] || 0) + 1;
      });

      const monthlyAverage = Object.values(monthlySpending).reduce((a, b) => a + b, 0) / 
                           Math.max(Object.keys(monthlySpending).length, 1);

      const favoriteCategories = Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category]) => category);

      const peakUsageMonths = Object.entries(monthlySpending)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([month]) => month);

      // Predicciones
      const mostFrequentService = favoriteCategories[0] || 'cleaning';
      const serviceHistory = completedServices
        .filter((s: any) => s.serviceType === mostFrequentService)
        .sort((a: any, b: any) => ((a.createdAt as any)?.seconds || 0) - ((b.createdAt as any)?.seconds || 0));

      let avgDaysBetweenServices = 30;
      if (serviceHistory.length > 1) {
        const intervals = [];
        for (let i = 1; i < serviceHistory.length; i++) {
          const days = ((((serviceHistory[i] as any).createdAt as any)?.seconds || 0) - (((serviceHistory[i-1] as any).createdAt as any)?.seconds || 0)) / (24 * 60 * 60);
          intervals.push(days);
        }
        avgDaysBetweenServices = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      const lastServiceDate = serviceHistory.length > 0 ? 
        ((serviceHistory[serviceHistory.length - 1] as any).createdAt as any)?.toDate?.() || new Date() :
        new Date();

      const nextServiceDate = new Date(lastServiceDate);
      nextServiceDate.setDate(nextServiceDate.getDate() + avgDaysBetweenServices);

      // Crear estructura detallada
      const detailedAnalytics: PremiumAnalyticsData = {
        userId,
        lastAnalysis: now,
        spendingData: {
          totalLifetimeSpent,
          monthlyAverage,
          favoriteCategories,
          peakUsageMonths
        },
        predictions: {
          nextServicePrediction: {
            serviceType: mostFrequentService,
            estimatedDate: admin.firestore.Timestamp.fromDate(nextServiceDate),
            confidence: Math.min(serviceHistory.length * 0.2, 0.9)
          },
          budgetForecast: {
            nextMonth: Math.ceil(monthlyAverage),
            nextQuarter: Math.ceil(monthlyAverage * 3),
            yearEnd: Math.ceil(monthlyAverage * 12)
          }
        },
        recommendations: {
          costSavings: [
            {
              tip: "Programa servicios en horarios no pico",
              potentialSavings: Math.ceil(monthlyAverage * 0.15),
              actionType: "schedule_optimization"
            },
            {
              tip: "Considera servicios recurrentes para obtener descuentos",
              potentialSavings: Math.ceil(monthlyAverage * 0.1),
              actionType: "recurring_setup"
            }
          ],
          recurringOpportunities: favoriteCategories.map(category => ({
            serviceType: category,
            frequency: "monthly",
            estimatedSavings: Math.ceil(monthlyAverage * 0.1)
          })),
          providerRecommendations: [] // Se completaría con lógica adicional
        },
        generatedAt: now
      };

      // Guardar en la nueva colección
      await db.collection("premiumAnalyticsData").doc(userId).set(detailedAnalytics);

      console.log(`✅ Analytics detallados generados para ${userId}`);

      return detailedAnalytics;

    } catch (error) {
      console.error("❌ Error generando analytics detallados:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error generando analytics detallados");
    }
  }
);

/**
 * 🔄 updateScheduleSlots
 * Función programada para actualizar slots de tiempo diariamente
 */
export const updateScheduleSlots = onSchedule({
  schedule: "0 0 * * *", // Diariamente a medianoche
  timeZone: "America/Mexico_City",
}, async (context) => {
  console.log("🔄 Actualizando slots de horarios para todos los prestadores");

  try {
    const providersSnapshot = await db.collection("providerSchedules").get();
    const batch = db.batch();

    for (const doc of providersSnapshot.docs) {
      const providerId = doc.id;
      
      // Regenerar slots para los próximos 30 días
      await generateTimeSlots(providerId, 30);
      
      // Limpiar slots vencidos (más de 1 día en el pasado)
      const schedule = doc.data() as ProviderSchedule;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const updatedSlots = schedule.timeSlots.filter(slot => 
        slot.datetime.toDate() > yesterday
      );

      batch.update(doc.ref, {
        timeSlots: updatedSlots,
        lastUpdated: admin.firestore.Timestamp.now()
      });
    }

    await batch.commit();
    console.log(`✅ Slots actualizados para ${providersSnapshot.size} prestadores`);

  } catch (error) {
    console.error("❌ Error actualizando slots:", error);
    throw error;
  }
});