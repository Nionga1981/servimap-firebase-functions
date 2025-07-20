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
  PREMIUM_LIMITS,
  PREMIUM_FEATURES,
  EMERGENCY_RESPONSE_TIMES
} from "./types";

const db = admin.firestore();

/**
 * 📅 setProviderAvailability
 * Establece la disponibilidad del prestador
 */
export const setProviderAvailability = onCall<{
  weeklySchedule: any;
  dateOverrides?: any[];
  settings: any;
}>(
  async (request) => {
    const { weeklySchedule, dateOverrides = [], settings } = request.data;
    const providerId = request.auth?.uid;

    if (!providerId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📅 Configurando disponibilidad para prestador ${providerId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // Validar configuración básica
      if (!weeklySchedule || Object.keys(weeklySchedule).length === 0) {
        throw new HttpsError("invalid-argument", "Horario semanal requerido");
      }

      // Verificar que el usuario es un prestador
      const providerDoc = await db.collection("providers").doc(providerId).get();
      if (!providerDoc.exists) {
        throw new HttpsError("permission-denied", "Usuario no es un prestador registrado");
      }

      // Configurar disponibilidad por defecto
      const defaultSettings = {
        advanceBookingDays: 30,
        minimumNoticeHours: 2,
        slotDurationMinutes: 60,
        allowEmergencyBookings: false,
        timeZone: "America/Mexico_City",
        ...settings
      };

      const availabilityData: ProviderAvailability = {
        providerId,
        weeklySchedule,
        dateOverrides,
        settings: defaultSettings,
        updatedAt: now,
        createdAt: now
      };

      // Guardar o actualizar disponibilidad
      const availabilityRef = db.collection("providerAvailability").doc(providerId);
      await availabilityRef.set(availabilityData, { merge: true });

      console.log(`✅ Disponibilidad configurada para ${providerId}`);

      return {
        success: true,
        availabilityId: providerId,
        message: "Disponibilidad configurada exitosamente"
      };

    } catch (error) {
      console.error("❌ Error configurando disponibilidad:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error configurando disponibilidad");
    }
  }
);

/**
 * 📋 getProviderAvailability
 * Obtiene la disponibilidad de un prestador
 */
export const getProviderAvailability = onCall<{
  providerId: string;
  startDate: string;
  endDate: string;
}>(
  async (request) => {
    const { providerId, startDate, endDate } = request.data;

    try {
      console.log(`📋 Obteniendo disponibilidad de ${providerId}`);

      // Obtener configuración de disponibilidad
      const availabilityDoc = await db.collection("providerAvailability").doc(providerId).get();
      
      if (!availabilityDoc.exists) {
        throw new HttpsError("not-found", "Prestador no tiene disponibilidad configurada");
      }

      const availability = availabilityDoc.data() as ProviderAvailability;

      // Obtener reservas existentes en el período
      const existingBookings = await db.collection("serviceBookings")
        .where("providerId", "==", providerId)
        .where("scheduledFor", ">=", admin.firestore.Timestamp.fromDate(new Date(startDate)))
        .where("scheduledFor", "<=", admin.firestore.Timestamp.fromDate(new Date(endDate)))
        .where("status", "in", ["pending", "confirmed", "in_progress"])
        .get();

      const bookedSlots = existingBookings.docs.map(doc => {
        const booking = doc.data() as ServiceBooking;
        return {
          date: booking.scheduledFor.toDate().toISOString().split('T')[0],
          timeSlot: booking.timeSlot,
          duration: booking.duration
        };
      });

      // Generar slots disponibles
      const availableSlots = generateAvailableSlots(
        availability,
        new Date(startDate),
        new Date(endDate),
        bookedSlots
      );

      return {
        success: true,
        availability,
        availableSlots,
        bookedSlots: bookedSlots.length
      };

    } catch (error) {
      console.error("❌ Error obteniendo disponibilidad:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error obteniendo disponibilidad");
    }
  }
);

/**
 * 📆 scheduleService
 * Programa un servicio
 */
export const scheduleService = onCall<{
  providerId: string;
  serviceDetails: any;
  scheduledFor: string;
  timeSlot: any;
  serviceType: 'immediate' | 'scheduled' | 'recurring' | 'emergency';
  recurrencePattern?: any;
}>(
  async (request) => {
    const { providerId, serviceDetails, scheduledFor, timeSlot, serviceType, recurrencePattern } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`📆 Programando servicio ${serviceType} para ${userId}`);

    try {
      const now = admin.firestore.Timestamp.now();
      const scheduledTimestamp = admin.firestore.Timestamp.fromDate(new Date(scheduledFor));

      // Verificar límites de usuario
      const userLimits = await checkUserLimits(userId, serviceType);
      if (!userLimits.allowed) {
        throw new HttpsError("resource-exhausted", userLimits.reason);
      }

      // Verificar disponibilidad del prestador
      const isAvailable = await checkProviderAvailability(providerId, scheduledTimestamp, timeSlot);
      if (!isAvailable.available) {
        throw new HttpsError("failed-precondition", isAvailable.reason);
      }

      // Verificar límite de días por adelantado solo para servicios programados
      if (serviceType === 'scheduled') {
        const daysInAdvance = Math.ceil((scheduledTimestamp.toMillis() - now.toMillis()) / (24 * 60 * 60 * 1000));
        const maxAdvanceDays = userLimits.isPremium ? 
          PREMIUM_LIMITS.PREMIUM.MAX_ADVANCE_BOOKING_DAYS : 
          PREMIUM_LIMITS.FREE.MAX_ADVANCE_BOOKING_DAYS;

        if (daysInAdvance > maxAdvanceDays) {
          throw new HttpsError("failed-precondition", 
            `Solo puedes programar servicios hasta ${maxAdvanceDays} días por adelantado. ${userLimits.isPremium ? '' : 'Actualiza a Premium para 90 días.'}`
          );
        }
      }

      // Calcular precio
      const pricing = await calculateServicePricing(
        serviceDetails,
        serviceType,
        userLimits.isPremium,
        recurrencePattern
      );

      // Crear booking
      const bookingRef = db.collection("serviceBookings").doc();
      const bookingData: ServiceBooking = {
        userId,
        providerId,
        serviceType,
        categoryId: serviceDetails.categoryId,
        title: serviceDetails.title,
        description: serviceDetails.description,
        scheduledFor: scheduledTimestamp,
        duration: serviceDetails.duration || 60,
        timeSlot,
        status: 'pending',
        location: serviceDetails.location || { type: 'address' },
        pricing,
        isPremiumService: serviceType === 'recurring' || serviceType === 'emergency',
        premiumFeatures: {
          isEmergency: serviceType === 'emergency',
          isRecurring: serviceType === 'recurring',
          isInternational: serviceDetails.isInternational || false
        },
        recurrencePattern,
        notes: serviceDetails.notes,
        createdAt: now,
        updatedAt: now
      };

      await bookingRef.set(bookingData);

      // Si es recurrente, crear patrón de recurrencia
      if (serviceType === 'recurring' && recurrencePattern) {
        await createRecurringService(bookingRef.id, userId, providerId, serviceDetails, recurrencePattern);
      }

      // Si es emergencia, activar flujo de emergencia
      if (serviceType === 'emergency') {
        await handleEmergencyService(bookingRef.id, userId, providerId, serviceDetails);
      }

      // Notificar al prestador
      await notifyProvider(providerId, {
        type: 'new_booking',
        bookingId: bookingRef.id,
        serviceType,
        scheduledFor: scheduledTimestamp,
        customerName: userLimits.userName
      });

      console.log(`✅ Servicio programado: ${bookingRef.id}`);

      return {
        success: true,
        bookingId: bookingRef.id,
        scheduledFor: scheduledTimestamp.toMillis(),
        pricing,
        message: `Servicio ${serviceType} programado exitosamente`
      };

    } catch (error) {
      console.error("❌ Error programando servicio:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error programando servicio");
    }
  }
);

/**
 * 🔄 createRecurringService
 * Crea un servicio recurrente (Premium)
 */
async function createRecurringService(
  parentBookingId: string,
  userId: string,
  providerId: string,
  serviceDetails: any,
  pattern: any
) {
  try {
    const now = admin.firestore.Timestamp.now();

    const recurringServiceData: RecurringService = {
      parentBookingId,
      userId,
      providerId,
      pattern,
      serviceTemplate: {
        categoryId: serviceDetails.categoryId,
        title: serviceDetails.title,
        description: serviceDetails.description,
        duration: serviceDetails.duration || 60,
        basePrice: serviceDetails.basePrice
      },
      isActive: true,
      totalBookings: 0,
      completedBookings: 0,
      settings: {
        autoConfirm: true,
        sendReminders: true,
        allowRescheduling: true
      },
      nextScheduledDate: calculateNextOccurrence(pattern, now),
      createdAt: now,
      updatedAt: now
    };

    const recurringRef = db.collection("recurringServices").doc();
    await recurringRef.set(recurringServiceData);

    console.log(`✅ Servicio recurrente creado: ${recurringRef.id}`);
    return recurringRef.id;

  } catch (error) {
    console.error("❌ Error creando servicio recurrente:", error);
    throw error;
  }
}

/**
 * 🚨 handleEmergencyService
 * Maneja servicio de emergencia (Premium)
 */
async function handleEmergencyService(
  bookingId: string,
  userId: string,
  providerId: string,
  serviceDetails: any
) {
  try {
    const now = admin.firestore.Timestamp.now();

    const emergencyData: EmergencyService = {
      bookingId,
      userId,
      providerId,
      emergencyType: serviceDetails.emergencyType || 'other',
      urgencyLevel: serviceDetails.urgencyLevel || 'high',
      description: serviceDetails.description,
      location: {
        address: serviceDetails.location.address,
        coordinates: serviceDetails.location.coordinates,
        accessInstructions: serviceDetails.location.accessInstructions
      },
      requestedAt: now,
      responseTime: EMERGENCY_RESPONSE_TIMES[serviceDetails.urgencyLevel?.toUpperCase() || 'HIGH'],
      status: 'searching',
      emergencyFee: calculateEmergencyFee(serviceDetails.urgencyLevel),
      totalCost: 0,
      updates: [{
        timestamp: now,
        message: "Emergencia registrada, buscando prestador disponible",
        type: 'system'
      }],
      createdAt: now
    };

    const emergencyRef = db.collection("emergencyServices").doc();
    await emergencyRef.set(emergencyData);

    // Notificar a prestadores de emergencia disponibles
    await notifyEmergencyProviders(serviceDetails, emergencyData);

    console.log(`🚨 Servicio de emergencia creado: ${emergencyRef.id}`);
    return emergencyRef.id;

  } catch (error) {
    console.error("❌ Error manejando emergencia:", error);
    throw error;
  }
}

/**
 * 🔍 searchAvailableProviders
 * Busca prestadores disponibles para una fecha/hora específica
 */
export const searchAvailableProviders = onCall<{
  categoryId: string;
  date: string;
  timeSlot: any;
  location?: any;
  serviceType: string;
}>(
  async (request) => {
    const { categoryId, date, timeSlot, location, serviceType } = request.data;
    const userId = request.auth?.uid;

    try {
      console.log(`🔍 Buscando prestadores para ${categoryId} en ${date}`);

      const scheduledTimestamp = admin.firestore.Timestamp.fromDate(new Date(date));

      // Obtener prestadores de la categoría
      const providersSnapshot = await db.collection("providers")
        .where("categoryIds", "array-contains", categoryId)
        .where("isActive", "==", true)
        .get();

      const availableProviders = [];

      for (const providerDoc of providersSnapshot.docs) {
        const providerId = providerDoc.id;
        const providerData = providerDoc.data();

        // Verificar disponibilidad específica
        const availability = await checkProviderAvailability(providerId, scheduledTimestamp, timeSlot);
        
        if (availability.available) {
          // Verificar si acepta el tipo de servicio
          if (serviceType === 'emergency' && !providerData.allowEmergencyServices) {
            continue;
          }

          availableProviders.push({
            id: providerId,
            ...providerData,
            availability: availability.details,
            distance: location ? calculateDistance(location, providerData.location) : null
          });
        }
      }

      // Ordenar por distancia y rating
      availableProviders.sort((a, b) => {
        if (a.distance && b.distance) {
          return a.distance - b.distance;
        }
        return (b.rating || 0) - (a.rating || 0);
      });

      return {
        success: true,
        providers: availableProviders,
        totalFound: availableProviders.length,
        searchCriteria: { categoryId, date, timeSlot, serviceType }
      };

    } catch (error) {
      console.error("❌ Error buscando prestadores:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error buscando prestadores disponibles");
    }
  }
);

/**
 * ✅ confirmBooking
 * Confirma una reserva (prestador)
 */
export const confirmBooking = onCall<{
  bookingId: string;
  action: 'confirm' | 'reschedule' | 'cancel';
  newTimeSlot?: any;
  newDate?: string;
  reason?: string;
}>(
  async (request) => {
    const { bookingId, action, newTimeSlot, newDate, reason } = request.data;
    const providerId = request.auth?.uid;

    if (!providerId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      console.log(`✅ ${action} booking ${bookingId} por ${providerId}`);

      const bookingDoc = await db.collection("serviceBookings").doc(bookingId).get();
      
      if (!bookingDoc.exists) {
        throw new HttpsError("not-found", "Reserva no encontrada");
      }

      const booking = bookingDoc.data() as ServiceBooking;

      if (booking.providerId !== providerId) {
        throw new HttpsError("permission-denied", "No autorizado para esta reserva");
      }

      const now = admin.firestore.Timestamp.now();
      let updateData: any = { updatedAt: now };

      switch (action) {
        case 'confirm':
          updateData = {
            ...updateData,
            status: 'confirmed',
            confirmedAt: now
          };
          break;

        case 'reschedule':
          if (!newTimeSlot || !newDate) {
            throw new HttpsError("invalid-argument", "Nueva fecha y hora requeridas");
          }
          
          updateData = {
            ...updateData,
            status: 'rescheduled',
            scheduledFor: admin.firestore.Timestamp.fromDate(new Date(newDate)),
            timeSlot: newTimeSlot,
            'rescheduleHistory': admin.firestore.FieldValue.arrayUnion({
              originalDate: booking.scheduledFor,
              originalTimeSlot: booking.timeSlot,
              newDate: admin.firestore.Timestamp.fromDate(new Date(newDate)),
              newTimeSlot,
              reason,
              timestamp: now
            })
          };
          break;

        case 'cancel':
          updateData = {
            ...updateData,
            status: 'cancelled',
            cancellationReason: reason,
            cancelledAt: now
          };
          break;
      }

      await bookingDoc.ref.update(updateData);

      // Notificar al usuario
      await notifyUser(booking.userId, {
        type: `booking_${action}`,
        bookingId,
        message: `Tu reserva ha sido ${action === 'confirm' ? 'confirmada' : 
                                      action === 'reschedule' ? 'reprogramada' : 'cancelada'}`,
        newDetails: action === 'reschedule' ? { date: newDate, timeSlot: newTimeSlot } : undefined
      });

      return {
        success: true,
        bookingId,
        action,
        message: `Reserva ${action} exitosamente`
      };

    } catch (error) {
      console.error("❌ Error confirmando booking:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando confirmación");
    }
  }
);

/**
 * 📊 generatePremiumAnalytics
 * Genera analytics avanzados para usuarios Premium
 */
export const generatePremiumAnalytics = onCall<{
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  includeForecasting?: boolean;
}>(
  async (request) => {
    const { period, includeForecasting = true } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      console.log(`📊 Generando analytics ${period} para usuario Premium ${userId}`);

      // Verificar que el usuario es Premium
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.membershipLevel || userData.membershipLevel !== "premium") {
        throw new HttpsError("permission-denied", "Función solo disponible para usuarios Premium");
      }

      const startDate = getStartDateForPeriod(period);
      const endDate = admin.firestore.Timestamp.now();

      // Obtener datos de servicios del usuario
      const servicesSnapshot = await db.collection("serviceBookings")
        .where("userId", "==", userId)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .get();

      const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calcular métricas
      const usageMetrics = calculateUsageMetrics(services);
      
      // Generar predicciones con IA (simulado)
      const predictions = includeForecasting ? await generateAIPredictions(userId, services) : undefined;

      // Obtener benchmarks
      const benchmarks = await getBenchmarkData(period);

      // Generar insights
      const insights = generateInsights(services, usageMetrics, benchmarks);

      const analyticsData: PremiumAnalytics = {
        userId,
        period: {
          startDate,
          endDate,
          type: period
        },
        usageMetrics,
        predictions: predictions || {
          nextServiceNeeds: [],
          budgetForecast: { nextMonth: 0, nextQuarter: 0, seasonalTrends: [] },
          providerRecommendations: []
        },
        benchmarks,
        insights,
        generatedAt: admin.firestore.Timestamp.now(),
        processingTime: 0
      };

      // Guardar analytics
      const analyticsRef = db.collection("premiumAnalytics").doc();
      await analyticsRef.set(analyticsData);

      console.log(`✅ Analytics generados: ${analyticsRef.id}`);

      return {
        success: true,
        analyticsId: analyticsRef.id,
        analytics: analyticsData,
        message: "Analytics Premium generados exitosamente"
      };

    } catch (error) {
      console.error("❌ Error generando analytics:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error generando analytics Premium");
    }
  }
);

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Genera slots disponibles basado en la configuración
 */
function generateAvailableSlots(
  availability: ProviderAvailability,
  startDate: Date,
  endDate: Date,
  bookedSlots: any[]
): any[] {
  const slots = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.toLocaleDateString('en', { weekday: 'lowercase' });
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Verificar horario semanal
    const daySchedule = availability.weeklySchedule[dayOfWeek];
    if (daySchedule?.available) {
      // Verificar overrides específicos
      const override = availability.dateOverrides.find(o => 
        o.date.toDate().toISOString().split('T')[0] === dateString
      );
      
      const timeSlots = override?.timeSlots || daySchedule.timeSlots;
      
      if (override && !override.available) {
        // Día no disponible por override
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Generar slots para el día
      timeSlots.forEach(slot => {
        const daySlots = generateTimeSlotsForDay(
          currentDate,
          slot,
          availability.settings.slotDurationMinutes,
          bookedSlots.filter(b => b.date === dateString)
        );
        slots.push(...daySlots);
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Genera slots de tiempo para un día específico
 */
function generateTimeSlotsForDay(
  date: Date,
  timeSlot: any,
  duration: number,
  bookedSlots: any[]
): any[] {
  const slots = [];
  const [startHour, startMin] = timeSlot.startTime.split(':').map(Number);
  const [endHour, endMin] = timeSlot.endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  for (let minutes = startMinutes; minutes < endMinutes; minutes += duration) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    
    const slotEndMinutes = minutes + duration;
    const endHourSlot = Math.floor(slotEndMinutes / 60);
    const endMinSlot = slotEndMinutes % 60;
    const endTimeString = `${endHourSlot.toString().padStart(2, '0')}:${endMinSlot.toString().padStart(2, '0')}`;
    
    // Verificar si el slot está disponible
    const isBooked = bookedSlots.some(booking => 
      booking.timeSlot.startTime <= timeString && booking.timeSlot.endTime > timeString
    );
    
    if (!isBooked && slotEndMinutes <= endMinutes) {
      slots.push({
        date: date.toISOString().split('T')[0],
        startTime: timeString,
        endTime: endTimeString,
        available: true
      });
    }
  }
  
  return slots;
}

/**
 * Verifica disponibilidad del prestador
 */
async function checkProviderAvailability(
  providerId: string,
  scheduledFor: admin.firestore.Timestamp,
  timeSlot: any
): Promise<{ available: boolean; reason?: string; details?: any }> {
  try {
    const availabilityDoc = await db.collection("providerAvailability").doc(providerId).get();
    
    if (!availabilityDoc.exists) {
      return { available: false, reason: "Prestador no tiene disponibilidad configurada" };
    }

    const availability = availabilityDoc.data() as ProviderAvailability;
    const date = scheduledFor.toDate();
    const dayOfWeek = date.toLocaleDateString('en', { weekday: 'lowercase' });
    const dateString = date.toISOString().split('T')[0];

    // Verificar horario semanal
    const daySchedule = availability.weeklySchedule[dayOfWeek];
    if (!daySchedule?.available) {
      return { available: false, reason: "Prestador no disponible ese día de la semana" };
    }

    // Verificar overrides
    const override = availability.dateOverrides.find(o => 
      o.date.toDate().toISOString().split('T')[0] === dateString
    );
    
    if (override && !override.available) {
      return { available: false, reason: override.reason || "Prestador no disponible esa fecha" };
    }

    // Verificar conflictos existentes
    const existingBookings = await db.collection("serviceBookings")
      .where("providerId", "==", providerId)
      .where("scheduledFor", "==", scheduledFor)
      .where("status", "in", ["pending", "confirmed", "in_progress"])
      .get();

    const hasConflict = existingBookings.docs.some(doc => {
      const booking = doc.data() as ServiceBooking;
      return timeSlotOverlaps(timeSlot, booking.timeSlot);
    });

    if (hasConflict) {
      return { available: false, reason: "Horario ya reservado" };
    }

    return { available: true, details: { daySchedule, override } };

  } catch (error) {
    console.error("Error verificando disponibilidad:", error);
    return { available: false, reason: "Error verificando disponibilidad" };
  }
}

/**
 * Verifica límites del usuario
 */
async function checkUserLimits(userId: string, serviceType: string) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    const isPremium = userData?.membershipLevel === "premium";
    const limits = isPremium ? PREMIUM_LIMITS.PREMIUM : PREMIUM_LIMITS.FREE;

    // SOLO verificar funciones específicamente Premium
    if (serviceType === 'recurring' && !limits.RECURRING_SERVICES) {
      return { 
        allowed: false, 
        reason: "Servicios recurrentes solo disponibles para usuarios Premium",
        isPremium 
      };
    }

    if (serviceType === 'emergency' && !limits.EMERGENCY_SERVICES) {
      return { 
        allowed: false, 
        reason: "Servicios de emergencia solo disponibles para usuarios Premium",
        isPremium 
      };
    }

    // Para servicios regulares ('immediate' y 'scheduled'), verificar solo límites mensuales
    if (serviceType === 'immediate' || serviceType === 'scheduled') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyBookings = await db.collection("serviceBookings")
        .where("userId", "==", userId)
        .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
        .get();

      if (monthlyBookings.size >= limits.MAX_MONTHLY_BOOKINGS) {
        return { 
          allowed: false, 
          reason: `Límite mensual alcanzado (${limits.MAX_MONTHLY_BOOKINGS} servicios). ${isPremium ? '' : 'Actualiza a Premium para más servicios.'}`,
          isPremium 
        };
      }

      return { 
        allowed: true, 
        isPremium,
        userName: userData?.name || 'Usuario',
        remainingBookings: limits.MAX_MONTHLY_BOOKINGS - monthlyBookings.size
      };
    }

    // Para otros tipos de servicio (international, etc.), permitir con verificación Premium
    return { 
      allowed: true, 
      isPremium,
      userName: userData?.name || 'Usuario',
      remainingBookings: limits.MAX_MONTHLY_BOOKINGS
    };

  } catch (error) {
    console.error("Error verificando límites:", error);
    return { allowed: true, isPremium: false, userName: 'Usuario' };
  }
}

/**
 * Calcula precios del servicio
 */
async function calculateServicePricing(
  serviceDetails: any,
  serviceType: string,
  isPremium: boolean,
  recurrencePattern?: any
) {
  const basePrice = serviceDetails.basePrice || 100;
  let emergencyFee = 0;
  let recurringDiscount = 0;

  if (serviceType === 'emergency') {
    emergencyFee = calculateEmergencyFee(serviceDetails.urgencyLevel);
  }

  if (serviceType === 'recurring' && recurrencePattern) {
    recurringDiscount = calculateRecurringDiscount(recurrencePattern);
  }

  const totalPrice = basePrice + emergencyFee - recurringDiscount;

  return {
    basePrice,
    emergencyFee: emergencyFee || undefined,
    recurringDiscount: recurringDiscount || undefined,
    totalPrice,
    currency: 'MXN'
  };
}

/**
 * Calcula tarifa de emergencia
 */
function calculateEmergencyFee(urgencyLevel: string): number {
  switch (urgencyLevel) {
    case 'life_threatening': return 500;
    case 'critical': return 300;
    case 'high': return 150;
    default: return 100;
  }
}

/**
 * Calcula descuento recurrente
 */
function calculateRecurringDiscount(pattern: any): number {
  const baseDiscount = 50; // $50 descuento base
  
  switch (pattern.frequency) {
    case 'weekly': return baseDiscount * 2;
    case 'monthly': return baseDiscount;
    case 'daily': return baseDiscount * 3;
    default: return baseDiscount;
  }
}

/**
 * Verifica solapamiento de horarios
 */
function timeSlotOverlaps(slot1: any, slot2: any): boolean {
  return slot1.startTime < slot2.endTime && slot1.endTime > slot2.startTime;
}

/**
 * Calcula distancia entre dos puntos
 */
function calculateDistance(location1: any, location2: any): number {
  if (!location1?.coordinates || !location2?.coordinates) return 0;
  
  const R = 6371; // Radio de la Tierra en km
  const dLat = (location2.coordinates.lat - location1.coordinates.lat) * Math.PI / 180;
  const dLon = (location2.coordinates.lng - location1.coordinates.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(location1.coordinates.lat * Math.PI / 180) * 
            Math.cos(location2.coordinates.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Notifica al prestador
 */
async function notifyProvider(providerId: string, notification: any) {
  try {
    await db.collection("notifications").add({
      userId: providerId,
      type: notification.type,
      title: 'Nueva Reserva',
      message: `Tienes una nueva reserva programada`,
      data: notification,
      createdAt: admin.firestore.Timestamp.now(),
      read: false
    });
  } catch (error) {
    console.error("Error notificando prestador:", error);
  }
}

/**
 * Notifica al usuario
 */
async function notifyUser(userId: string, notification: any) {
  try {
    await db.collection("notifications").add({
      userId,
      type: notification.type,
      title: 'Actualización de Reserva',
      message: notification.message,
      data: notification,
      createdAt: admin.firestore.Timestamp.now(),
      read: false
    });
  } catch (error) {
    console.error("Error notificando usuario:", error);
  }
}

/**
 * Calcula siguiente ocurrencia para servicios recurrentes
 */
function calculateNextOccurrence(pattern: any, fromDate: admin.firestore.Timestamp): admin.firestore.Timestamp {
  const date = fromDate.toDate();
  
  switch (pattern.frequency) {
    case 'daily':
      date.setDate(date.getDate() + pattern.interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * pattern.interval));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + pattern.interval);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + pattern.interval);
      break;
  }
  
  return admin.firestore.Timestamp.fromDate(date);
}

/**
 * Funciones para analytics Premium (placeholders para IA)
 */
function calculateUsageMetrics(services: any[]) {
  const totalServices = services.length;
  const recurringServices = services.filter(s => s.serviceType === 'recurring').length;
  const emergencyServices = services.filter(s => s.serviceType === 'emergency').length;
  const totalSpent = services.reduce((sum, s) => sum + (s.pricing?.totalPrice || 0), 0);

  return {
    totalServices,
    recurringServices,
    emergencyServices,
    averageServiceCost: totalServices > 0 ? totalSpent / totalServices : 0,
    totalSpent,
    preferredCategories: [],
    preferredProviders: []
  };
}

async function generateAIPredictions(userId: string, services: any[]) {
  // En una implementación real, aquí iría la lógica de IA
  return {
    nextServiceNeeds: [],
    budgetForecast: { nextMonth: 0, nextQuarter: 0, seasonalTrends: [] },
    providerRecommendations: []
  };
}

async function getBenchmarkData(period: string) {
  return {
    avgServicesPerUser: 3.5,
    avgSpendingPerUser: 1250,
    categoryTrends: []
  };
}

function generateInsights(services: any[], metrics: any, benchmarks: any) {
  return [
    {
      type: 'trend' as const,
      title: 'Patrón de uso identificado',
      description: 'Tus servicios muestran un patrón consistente',
      actionable: true,
      impact: 'medium' as const
    }
  ];
}

function getStartDateForPeriod(period: string): admin.firestore.Timestamp {
  const now = new Date();
  
  switch (period) {
    case 'weekly':
      now.setDate(now.getDate() - 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() - 1);
      break;
    case 'quarterly':
      now.setMonth(now.getMonth() - 3);
      break;
    case 'yearly':
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return admin.firestore.Timestamp.fromDate(now);
}

async function notifyEmergencyProviders(serviceDetails: any, emergencyData: EmergencyService) {
  // En una implementación real, notificaría a prestadores de emergencia cercanos
  console.log("Notificando prestadores de emergencia...");
}

/**
 * 🔄 manageRecurringServices
 * Gestiona servicios recurrentes (Premium)
 */
export const manageRecurringServices = onCall<{
  recurringServiceId: string;
  action: 'pause' | 'resume' | 'modify' | 'cancel';
  modifications?: any;
}>(
  async (request) => {
    const { recurringServiceId, action, modifications } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      console.log(`🔄 ${action} servicio recurrente ${recurringServiceId}`);

      const recurringDoc = await db.collection("recurringServices").doc(recurringServiceId).get();
      
      if (!recurringDoc.exists) {
        throw new HttpsError("not-found", "Servicio recurrente no encontrado");
      }

      const recurringService = recurringDoc.data() as RecurringService;

      if (recurringService.userId !== userId) {
        throw new HttpsError("permission-denied", "No autorizado para este servicio");
      }

      const now = admin.firestore.Timestamp.now();
      let updateData: any = { updatedAt: now };

      switch (action) {
        case 'pause':
          updateData.isActive = false;
          updateData.pausedAt = now;
          break;

        case 'resume':
          updateData.isActive = true;
          updateData.pausedAt = admin.firestore.FieldValue.delete();
          updateData.nextScheduledDate = calculateNextOccurrence(recurringService.pattern, now);
          break;

        case 'modify':
          if (modifications) {
            updateData = { ...updateData, ...modifications };
            if (modifications.pattern) {
              updateData.nextScheduledDate = calculateNextOccurrence(modifications.pattern, now);
            }
          }
          break;

        case 'cancel':
          updateData.isActive = false;
          updateData.cancelledAt = now;
          updateData.nextScheduledDate = admin.firestore.FieldValue.delete();
          break;
      }

      await recurringDoc.ref.update(updateData);

      // Log de la acción
      await db.collection("recurringServiceLogs").add({
        recurringServiceId,
        userId,
        action,
        modifications,
        timestamp: now
      });

      return {
        success: true,
        recurringServiceId,
        action,
        message: `Servicio recurrente ${action} exitosamente`
      };

    } catch (error) {
      console.error("❌ Error gestionando servicio recurrente:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error gestionando servicio recurrente");
    }
  }
);

/**
 * 🚨 requestEmergencyService
 * Solicita servicio de emergencia 24/7 (Premium)
 */
export const requestEmergencyService = onCall<{
  emergencyType: string;
  urgencyLevel: 'high' | 'critical' | 'life_threatening';
  description: string;
  location: any;
  contactInfo: any;
}>(
  async (request) => {
    const { emergencyType, urgencyLevel, description, location, contactInfo } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      console.log(`🚨 Emergencia ${urgencyLevel} solicitada por ${userId}`);

      // Verificar que el usuario es Premium
      const userLimits = await checkUserLimits(userId, 'emergency');
      if (!userLimits.allowed) {
        throw new HttpsError("permission-denied", userLimits.reason);
      }

      const now = admin.firestore.Timestamp.now();

      // Crear booking de emergencia
      const bookingRef = db.collection("serviceBookings").doc();
      const emergencyBooking: ServiceBooking = {
        userId,
        providerId: '', // Se asignará cuando se encuentre prestador
        serviceType: 'emergency',
        categoryId: emergencyType,
        title: `Emergencia: ${emergencyType}`,
        description,
        scheduledFor: now, // Inmediato
        duration: 120, // 2 horas por defecto
        timeSlot: {
          startTime: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString('en-GB', { hour12: false })
        },
        status: 'pending',
        location,
        pricing: {
          basePrice: 200,
          emergencyFee: calculateEmergencyFee(urgencyLevel),
          totalPrice: 200 + calculateEmergencyFee(urgencyLevel),
          currency: 'MXN'
        },
        isPremiumService: true,
        premiumFeatures: {
          isEmergency: true,
          isRecurring: false,
          isInternational: false
        },
        createdAt: now,
        updatedAt: now
      };

      await bookingRef.set(emergencyBooking);

      // Crear registro de emergencia
      const emergencyRef = db.collection("emergencyServices").doc();
      const emergencyData: EmergencyService = {
        bookingId: bookingRef.id,
        userId,
        providerId: '',
        emergencyType: emergencyType as any,
        urgencyLevel,
        description,
        location: {
          address: location.address,
          coordinates: location.coordinates,
          accessInstructions: location.accessInstructions
        },
        requestedAt: now,
        responseTime: EMERGENCY_RESPONSE_TIMES[urgencyLevel.toUpperCase() as keyof typeof EMERGENCY_RESPONSE_TIMES],
        status: 'searching',
        emergencyFee: calculateEmergencyFee(urgencyLevel),
        totalCost: emergencyBooking.pricing.totalPrice,
        updates: [{
          timestamp: now,
          message: `Emergencia ${urgencyLevel} registrada - Buscando prestador disponible`,
          type: 'system'
        }],
        createdAt: now
      };

      await emergencyRef.set(emergencyData);

      // Activar búsqueda urgente de prestadores
      await searchEmergencyProviders(emergencyData, urgencyLevel);

      // Programar seguimiento automático
      await scheduleEmergencyFollowUp(emergencyRef.id, urgencyLevel);

      return {
        success: true,
        emergencyId: emergencyRef.id,
        bookingId: bookingRef.id,
        estimatedResponseTime: emergencyData.responseTime,
        totalCost: emergencyData.totalCost,
        message: "Emergencia registrada - Buscando prestador disponible"
      };

    } catch (error) {
      console.error("❌ Error solicitando emergencia:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando emergencia");
    }
  }
);

/**
 * 🌍 requestInternationalService
 * Solicita servicio internacional (Premium)
 */
export const requestInternationalService = onCall<{
  serviceType: string;
  originCountry: string;
  destinationCountry: string;
  serviceDetails: any;
  regionalSettings: any;
}>(
  async (request) => {
    const { serviceType, originCountry, destinationCountry, serviceDetails, regionalSettings } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      console.log(`🌍 Servicio internacional ${serviceType} solicitado: ${originCountry} -> ${destinationCountry}`);

      // Verificar que el usuario es Premium para servicios internacionales
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      const isPremium = userData?.membershipLevel === "premium";
      
      if (!isPremium) {
        throw new HttpsError("permission-denied", "Servicios internacionales solo disponibles para usuarios Premium");
      }

      const now = admin.firestore.Timestamp.now();

      // Calcular precios internacionales
      const internationalPricing = await calculateInternationalPricing(
        serviceDetails.basePrice,
        originCountry,
        destinationCountry,
        regionalSettings.currency
      );

      // Crear booking internacional
      const bookingRef = db.collection("serviceBookings").doc();
      const internationalBooking: ServiceBooking = {
        userId,
        providerId: '', // Se asignará después
        serviceType: 'scheduled',
        categoryId: serviceDetails.categoryId,
        title: `Servicio Internacional: ${serviceDetails.title}`,
        description: serviceDetails.description,
        scheduledFor: admin.firestore.Timestamp.fromDate(new Date(serviceDetails.scheduledFor)),
        duration: serviceDetails.duration || 60,
        timeSlot: serviceDetails.timeSlot,
        status: 'pending',
        location: {
          type: 'virtual',
          notes: `Servicio entre ${originCountry} y ${destinationCountry}`
        },
        pricing: internationalPricing,
        isPremiumService: true,
        premiumFeatures: {
          isEmergency: false,
          isRecurring: false,
          isInternational: true
        },
        createdAt: now,
        updatedAt: now
      };

      await bookingRef.set(internationalBooking);

      // Crear registro de servicio internacional
      const internationalRef = db.collection("internationalServices").doc();
      const internationalData: InternationalService = {
        bookingId: bookingRef.id,
        userId,
        providerId: '',
        originCountry,
        destinationCountry,
        serviceCountry: destinationCountry,
        serviceType: serviceType as any,
        regionalSettings,
        pricing: internationalPricing,
        compliance: {
          requiredDocuments: getRequiredDocuments(serviceType, destinationCountry),
          providedDocuments: [],
          verificationStatus: 'pending'
        },
        communicationChannel: serviceDetails.communicationChannel || 'video',
        translationRequired: serviceDetails.translationRequired || false,
        createdAt: now,
        updatedAt: now
      };

      await internationalRef.set(internationalData);

      // Buscar prestadores internacionales
      await searchInternationalProviders(internationalData);

      return {
        success: true,
        internationalServiceId: internationalRef.id,
        bookingId: bookingRef.id,
        pricing: internationalPricing,
        requiredDocuments: internationalData.compliance.requiredDocuments,
        message: "Servicio internacional registrado exitosamente"
      };

    } catch (error) {
      console.error("❌ Error solicitando servicio internacional:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando servicio internacional");
    }
  }
);

/**
 * 📈 getUserPremiumInsights
 * Obtiene insights avanzados para usuario Premium
 */
export const getUserPremiumInsights = onCall<{
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
  includeForecasting?: boolean;
}>(
  async (request) => {
    const { timeframe = 'month', includeForecasting = true } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      console.log(`📈 Generando insights Premium para ${userId}`);

      // Verificar Premium
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists || userDoc.data()?.membershipLevel !== "premium") {
        throw new HttpsError("permission-denied", "Función solo disponible para usuarios Premium");
      }

      // Obtener analytics existentes más recientes
      const recentAnalyticsSnapshot = await db.collection("premiumAnalytics")
        .where("userId", "==", userId)
        .orderBy("generatedAt", "desc")
        .limit(1)
        .get();

      let analytics = null;
      if (!recentAnalyticsSnapshot.empty) {
        analytics = recentAnalyticsSnapshot.docs[0].data();
      }

      // Si no hay analytics o son antiguos, generar nuevos
      const shouldGenerateNew = !analytics || 
        (Date.now() - analytics.generatedAt.toMillis()) > (24 * 60 * 60 * 1000); // 24 horas

      if (shouldGenerateNew) {
        const generateResult = await generatePremiumAnalytics.run({
          data: { period: timeframe, includeForecasting }
        });
        analytics = generateResult.analytics;
      }

      // Generar insights específicos en tiempo real
      const realTimeInsights = await generateRealTimeInsights(userId, timeframe);

      return {
        success: true,
        analytics,
        realTimeInsights,
        generatedAt: admin.firestore.Timestamp.now().toMillis(),
        message: "Insights Premium generados exitosamente"
      };

    } catch (error) {
      console.error("❌ Error generando insights:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error generando insights Premium");
    }
  }
);

// ============================================
// FUNCIONES AUXILIARES ADICIONALES
// ============================================

/**
 * Busca prestadores de emergencia disponibles
 */
async function searchEmergencyProviders(emergencyData: EmergencyService, urgencyLevel: string) {
  try {
    console.log(`🔍 Buscando prestadores de emergencia para ${emergencyData.emergencyType}`);

    // Obtener prestadores que aceptan emergencias
    const emergencyProvidersSnapshot = await db.collection("providers")
      .where("categoryIds", "array-contains", emergencyData.emergencyType)
      .where("allowEmergencyServices", "==", true)
      .where("isActive", "==", true)
      .get();

    const notificationPromises = emergencyProvidersSnapshot.docs.map(async (providerDoc) => {
      const providerId = providerDoc.id;
      const providerData = providerDoc.data();

      // Calcular distancia
      const distance = calculateDistance(
        { coordinates: emergencyData.location.coordinates },
        { coordinates: providerData.location?.coordinates }
      );

      // Solo notificar a prestadores cercanos (< 20km)
      if (distance < 20) {
        await db.collection("emergencyNotifications").add({
          providerId,
          emergencyId: emergencyData.id,
          urgencyLevel,
          distance,
          emergencyFee: emergencyData.emergencyFee,
          location: emergencyData.location,
          sentAt: admin.firestore.Timestamp.now(),
          status: 'sent'
        });

        // En una implementación real, enviaría push notification inmediata
        console.log(`📲 Notificación de emergencia enviada a ${providerId}`);
      }
    });

    await Promise.all(notificationPromises);

  } catch (error) {
    console.error("Error buscando prestadores de emergencia:", error);
  }
}

/**
 * Programa seguimiento de emergencia
 */
async function scheduleEmergencyFollowUp(emergencyId: string, urgencyLevel: string) {
  // En una implementación real, programaría funciones de seguimiento
  console.log(`⏰ Seguimiento programado para emergencia ${emergencyId} - nivel ${urgencyLevel}`);
}

/**
 * Calcula precios internacionales
 */
async function calculateInternationalPricing(
  basePrice: number,
  originCountry: string,
  destinationCountry: string,
  currency: string
) {
  // Simulación de cálculo de precios internacionales
  const basePriceUSD = basePrice * 0.056; // Conversión MXN -> USD
  const exchangeRate = await getExchangeRate('USD', currency);
  const localPrice = basePriceUSD * exchangeRate;
  const internationalFee = basePriceUSD * 0.15; // 15% fee internacional
  
  return {
    basePriceUSD,
    exchangeRate,
    localPrice,
    localCurrency: currency,
    internationalFee,
    taxes: [],
    totalPrice: localPrice + internationalFee
  };
}

/**
 * Obtiene documentos requeridos por país
 */
function getRequiredDocuments(serviceType: string, country: string): string[] {
  // En una implementación real, tendría una base de datos de regulaciones
  const baseDocuments = ['passport', 'service_agreement'];
  
  if (country === 'US') {
    baseDocuments.push('tax_id');
  }
  
  return baseDocuments;
}

/**
 * Busca prestadores internacionales
 */
async function searchInternationalProviders(internationalData: InternationalService) {
  console.log(`🌍 Buscando prestadores internacionales para ${internationalData.serviceType}`);
  // En una implementación real, buscaría en base de datos de prestadores internacionales
}

/**
 * Obtiene tipo de cambio
 */
async function getExchangeRate(from: string, to: string): Promise<number> {
  // En una implementación real, consultaría API de tipos de cambio
  const rates: { [key: string]: number } = {
    'USD': 1,
    'MXN': 17.8,
    'EUR': 0.92,
    'CAD': 1.36
  };
  
  return rates[to] / rates[from];
}

/**
 * Genera insights en tiempo real
 */
async function generateRealTimeInsights(userId: string, timeframe: string) {
  // Simulación de insights en tiempo real
  return {
    costOptimization: {
      potential_savings: 150,
      recommendations: [
        "Considera servicios recurrentes para ahorrar 20%",
        "Prestadores locales pueden reducir costos en 15%"
      ]
    },
    usage_patterns: {
      peak_hours: ["10:00-12:00", "14:00-16:00"],
      preferred_days: ["martes", "jueves"],
      seasonal_trends: "Incremento de 25% en servicios de hogar durante invierno"
    },
    provider_insights: {
      top_rated: "ElectricPro",
      fastest_response: "PlumberFast",
      best_value: "HandyMan Local"
    }
  };
}

/**
 * 🕐 Función programada: Procesar servicios recurrentes
 */
export const processRecurringServices = onSchedule({
  schedule: "0 6 * * *", // Diariamente a las 6 AM
  timeZone: "America/Mexico_City"
}, async (event) => {
  console.log("🔄 Procesando servicios recurrentes programados...");
  
  try {
    const now = admin.firestore.Timestamp.now();
    const tomorrow = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);
    
    // Buscar servicios recurrentes que deben ejecutarse
    const recurringServicesSnapshot = await db.collection("recurringServices")
      .where("isActive", "==", true)
      .where("nextScheduledDate", "<=", tomorrow)
      .get();
    
    console.log(`📋 Encontrados ${recurringServicesSnapshot.size} servicios recurrentes a procesar`);
    
    for (const recurringDoc of recurringServicesSnapshot.docs) {
      const recurringService = recurringDoc.data() as RecurringService;
      
      try {
        // Crear booking automático
        await createAutomaticBooking(recurringService);
        
        // Actualizar siguiente fecha
        const nextDate = calculateNextOccurrence(recurringService.pattern, recurringService.nextScheduledDate!);
        
        await recurringDoc.ref.update({
          nextScheduledDate: nextDate,
          totalBookings: admin.firestore.FieldValue.increment(1),
          updatedAt: now
        });
        
      } catch (error) {
        console.error(`Error procesando servicio recurrente ${recurringDoc.id}:`, error);
      }
    }
    
    console.log("✅ Procesamiento de servicios recurrentes completado");
    
  } catch (error) {
    console.error("❌ Error en procesamiento de servicios recurrentes:", error);
  }
});

/**
 * Crea booking automático para servicio recurrente
 */
async function createAutomaticBooking(recurringService: RecurringService) {
  const bookingRef = db.collection("serviceBookings").doc();
  const now = admin.firestore.Timestamp.now();
  
  const automaticBooking: ServiceBooking = {
    userId: recurringService.userId,
    providerId: recurringService.providerId,
    serviceType: 'recurring',
    categoryId: recurringService.serviceTemplate.categoryId,
    title: `[Recurrente] ${recurringService.serviceTemplate.title}`,
    description: recurringService.serviceTemplate.description,
    scheduledFor: recurringService.nextScheduledDate!,
    duration: recurringService.serviceTemplate.duration,
    timeSlot: {
      startTime: "09:00", // Hora por defecto, puede ser configurada
      endTime: "10:00"
    },
    status: recurringService.settings.autoConfirm ? 'confirmed' : 'pending',
    location: { type: 'address' },
    pricing: {
      basePrice: recurringService.serviceTemplate.basePrice,
      recurringDiscount: 50,
      totalPrice: recurringService.serviceTemplate.basePrice - 50,
      currency: 'MXN'
    },
    isPremiumService: true,
    premiumFeatures: {
      isEmergency: false,
      isRecurring: true,
      isInternational: false
    },
    createdAt: now,
    updatedAt: now
  };
  
  await bookingRef.set(automaticBooking);
  
  // Notificar tanto al usuario como al prestador
  await Promise.all([
    notifyUser(recurringService.userId, {
      type: 'recurring_booking_created',
      bookingId: bookingRef.id,
      message: 'Tu servicio recurrente ha sido programado automáticamente'
    }),
    notifyProvider(recurringService.providerId, {
      type: 'recurring_booking_created',
      bookingId: bookingRef.id,
      message: 'Nuevo servicio recurrente programado'
    })
  ]);
  
  console.log(`✅ Booking automático creado: ${bookingRef.id}`);
}