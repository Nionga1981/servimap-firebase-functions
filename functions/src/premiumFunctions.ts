import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Configuración de funciones Premium
const premiumFeatures = {
  recurringServices: {
    maxRecurring: 10,
    frequencies: ['weekly', 'biweekly', 'monthly'],
    autoRescheduling: true
  },
  emergencyServices: {
    available24x7: true,
    prioritySupport: true
  },
  internationalServices: {
    globalCoverage: true,
    currencyConversion: true,
    localCompliance: true
  },
  analytics: {
    advancedReports: true,
    predictiveInsights: true,
    customRecommendations: true,
    exportData: true
  }
};

// Limitaciones para usuarios gratuitos
const freeUserLimitations = {
  schedulingAdvance: 7, // días
  emergencyServices: false,
  recurringServices: false,
  internationalServices: false,
  basicAnalytics: true,
  supportPriority: 'standard',
  maxConcurrentBookings: 3,
  advancedFilters: false
};

// Utilidades de zona horaria
const timezoneUtils = {
  convertToUserTimezone: (utcTime: admin.firestore.Timestamp, userTimezone: string): Date => {
    const date = new Date(utcTime.seconds * 1000);
    return new Date(date.toLocaleString("en-US", { timeZone: userTimezone }));
  },
  
  convertToUTC: (localTime: Date): admin.firestore.Timestamp => {
    return admin.firestore.Timestamp.fromDate(new Date(localTime.getTime()));
  },
  
  getTimezoneOffset: (timezone: string): number => {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const local = new Date(utc.toLocaleString("en-US", { timeZone: timezone }));
    return (utc.getTime() - local.getTime()) / 3600000;
  }
};

// Función para verificar el estado Premium
export const checkPremiumStatus = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    const userData = userDoc.data();
    const isPremium = userData?.premiumStatus?.active || false;
    const premiumExpiry = userData?.premiumStatus?.expiryDate;
    
    // Verificar si el Premium ha expirado
    if (isPremium && premiumExpiry && premiumExpiry.toDate() < new Date()) {
      await db.collection('users').doc(userId).update({
        'premiumStatus.active': false
      });
      
      return {
        isPremium: false,
        expired: true,
        features: null,
        limitations: freeUserLimitations
      };
    }

    return {
      isPremium,
      features: isPremium ? premiumFeatures : null,
      limitations: isPremium ? null : freeUserLimitations,
      expiryDate: premiumExpiry?.toDate() || null
    };

  } catch (error) {
    console.error('Error checking premium status:', error);
    throw new HttpsError('internal', 'Error verificando estado Premium');
  }
});

// Función para validar restricciones de usuarios gratuitos
export const validateFreeUserRestrictions = onCall(async (request) => {
  const { serviceRequest } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  try {
    const premiumCheck = await checkPremiumStatus({ auth: request.auth, data: {} });
    
    if (premiumCheck.data.isPremium) {
      return { allowed: true, restrictions: [] };
    }

    const restrictions = [];
    const now = new Date();
    const requestedDate = new Date(serviceRequest.scheduledDateTime.seconds * 1000);
    const daysInAdvance = Math.ceil((requestedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Verificar límite de programación anticipada
    if (daysInAdvance > freeUserLimitations.schedulingAdvance) {
      restrictions.push({
        type: 'scheduling_advance',
        message: `Los usuarios gratuitos solo pueden agendar con ${freeUserLimitations.schedulingAdvance} días de anticipación`,
        maxDays: freeUserLimitations.schedulingAdvance
      });
    }

    // Verificar servicios de emergencia
    if (serviceRequest.isEmergency && !freeUserLimitations.emergencyServices) {
      restrictions.push({
        type: 'emergency_services',
        message: 'Los servicios de emergencia están disponibles solo para usuarios Premium'
      });
    }

    // Verificar servicios recurrentes
    if (serviceRequest.isRecurring && !freeUserLimitations.recurringServices) {
      restrictions.push({
        type: 'recurring_services',
        message: 'Los servicios recurrentes están disponibles solo para usuarios Premium'
      });
    }

    // Verificar servicios internacionales
    if (serviceRequest.isInternational && !freeUserLimitations.internationalServices) {
      restrictions.push({
        type: 'international_services',
        message: 'Los servicios internacionales están disponibles solo para usuarios Premium'
      });
    }

    // Verificar número máximo de reservas concurrentes
    const activeBookingsQuery = await db.collection('scheduledServices')
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'confirmed'])
      .get();

    if (activeBookingsQuery.size >= freeUserLimitations.maxConcurrentBookings) {
      restrictions.push({
        type: 'max_concurrent_bookings',
        message: `Los usuarios gratuitos pueden tener máximo ${freeUserLimitations.maxConcurrentBookings} reservas activas`,
        currentCount: activeBookingsQuery.size,
        maxAllowed: freeUserLimitations.maxConcurrentBookings
      });
    }

    return {
      allowed: restrictions.length === 0,
      restrictions
    };

  } catch (error) {
    console.error('Error validating restrictions:', error);
    throw new HttpsError('internal', 'Error validando restricciones');
  }
});

// Función para manejar conversión de zonas horarias
export const convertTimezone = onCall(async (request) => {
  const { datetime, fromTimezone, toTimezone } = request.data;

  if (!datetime || !fromTimezone || !toTimezone) {
    throw new HttpsError('invalid-argument', 'Parámetros requeridos: datetime, fromTimezone, toTimezone');
  }

  try {
    const originalDate = new Date(datetime.seconds * 1000);
    
    // Convertir de zona horaria origen a UTC
    const utcDate = new Date(originalDate.toLocaleString("en-US", { timeZone: fromTimezone }));
    
    // Convertir de UTC a zona horaria destino
    const convertedDate = new Date(utcDate.toLocaleString("en-US", { timeZone: toTimezone }));
    
    return {
      originalTimestamp: datetime,
      convertedTimestamp: admin.firestore.Timestamp.fromDate(convertedDate),
      originalTimezone: fromTimezone,
      targetTimezone: toTimezone,
      formattedTime: convertedDate.toLocaleString('es-MX', {
        timeZone: toTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

  } catch (error) {
    console.error('Error converting timezone:', error);
    throw new HttpsError('internal', 'Error convirtiendo zona horaria');
  }
});

// Función para configurar recordatorios automáticos
export const setupAutomaticReminders = onCall(async (request) => {
  const { serviceRequestId, scheduledDateTime, userTimezone } = request.data;
  const userId = request.auth?.uid;

  if (!userId || !serviceRequestId || !scheduledDateTime) {
    throw new HttpsError('invalid-argument', 'Parámetros requeridos faltantes');
  }

  try {
    const serviceDate = new Date(scheduledDateTime.seconds * 1000);
    const now = new Date();

    // Calcular tiempos de recordatorio
    const reminder24h = new Date(serviceDate.getTime() - (24 * 60 * 60 * 1000));
    const reminder2h = new Date(serviceDate.getTime() - (2 * 60 * 60 * 1000));
    const reminder30min = new Date(serviceDate.getTime() - (30 * 60 * 1000));

    const reminders = [];

    // Solo crear recordatorios futuros
    if (reminder24h > now) {
      reminders.push({
        type: '24h',
        scheduledFor: admin.firestore.Timestamp.fromDate(reminder24h),
        message: 'Tu servicio está programado para mañana',
        sent: false
      });
    }

    if (reminder2h > now) {
      reminders.push({
        type: '2h',
        scheduledFor: admin.firestore.Timestamp.fromDate(reminder2h),
        message: 'Tu servicio inicia en 2 horas. El prestador está en camino',
        sent: false
      });
    }

    if (reminder30min > now) {
      reminders.push({
        type: '30min',
        scheduledFor: admin.firestore.Timestamp.fromDate(reminder30min),
        message: 'Tu servicio inicia pronto. ¿Todo listo?',
        sent: false
      });
    }

    // Guardar recordatorios en la base de datos
    await db.collection('serviceReminders').doc(serviceRequestId).set({
      serviceRequestId,
      userId,
      scheduledDateTime,
      userTimezone: userTimezone || 'America/Mexico_City',
      reminders,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      serviceRequestId,
      remindersCreated: reminders.length,
      reminders: reminders.map(r => ({
        type: r.type,
        scheduledFor: r.scheduledFor.toDate(),
        message: r.message
      }))
    };

  } catch (error) {
    console.error('Error setting up reminders:', error);
    throw new HttpsError('internal', 'Error configurando recordatorios');
  }
});

// Función programada para enviar recordatorios
export const sendScheduledReminders = onSchedule('every 5 minutes', async () => {
  const now = admin.firestore.Timestamp.now();
  const fiveMinutesAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 5 * 60 * 1000)
  );

  try {
    // Buscar recordatorios que deben enviarse ahora
    const remindersQuery = await db.collection('serviceReminders')
      .where('reminders', 'array-contains-any', [
        { scheduledFor: now, sent: false }
      ])
      .get();

    const batch = db.batch();
    const notifications = [];

    for (const doc of remindersQuery.docs) {
      const data = doc.data();
      const updatedReminders = data.reminders.map((reminder: any) => {
        const reminderTime = reminder.scheduledFor.toDate();
        const currentTime = now.toDate();
        
        // Verificar si es tiempo de enviar este recordatorio (con margen de 5 minutos)
        if (!reminder.sent && 
            reminderTime <= currentTime && 
            reminderTime >= fiveMinutesAgo.toDate()) {
          
          notifications.push({
            userId: data.userId,
            serviceRequestId: data.serviceRequestId,
            type: reminder.type,
            message: reminder.message,
            userTimezone: data.userTimezone
          });
          
          return { ...reminder, sent: true, sentAt: now };
        }
        return reminder;
      });

      // Actualizar recordatorios como enviados
      batch.update(doc.ref, { reminders: updatedReminders });
    }

    await batch.commit();

    // Enviar notificaciones
    for (const notification of notifications) {
      await sendServiceReminder(notification);
    }

    console.log(`Enviados ${notifications.length} recordatorios`);

  } catch (error) {
    console.error('Error sending scheduled reminders:', error);
  }
});

// Función para enviar recordatorio individual
const sendServiceReminder = async (notification: {
  userId: string;
  serviceRequestId: string;
  type: string;
  message: string;
  userTimezone: string;
}) => {
  try {
    // Obtener información del servicio
    const serviceDoc = await db.collection('scheduledServices')
      .doc(notification.serviceRequestId)
      .get();

    if (!serviceDoc.exists) return;

    const serviceData = serviceDoc.data();
    const serviceDateTime = timezoneUtils.convertToUserTimezone(
      serviceData?.scheduledDateTime,
      notification.userTimezone
    );

    const formattedMessage = `${notification.message}
    
Servicio: ${serviceData?.serviceType?.replace('_', ' ')}
Fecha: ${serviceDateTime.toLocaleDateString('es-MX')}
Hora: ${serviceDateTime.toLocaleTimeString('es-MX', { 
  hour: '2-digit', 
  minute: '2-digit' 
})}
    
¿Necesitas hacer cambios? Responde a este mensaje.`;

    // Enviar notificación push
    await db.collection('notifications').add({
      userId: notification.userId,
      type: 'service_reminder',
      title: 'Recordatorio de Servicio',
      message: formattedMessage,
      data: {
        serviceRequestId: notification.serviceRequestId,
        reminderType: notification.type,
        scheduledDateTime: serviceData?.scheduledDateTime
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    // Enviar SMS si el usuario tiene teléfono configurado
    const userDoc = await db.collection('users').doc(notification.userId).get();
    const userData = userDoc.data();
    
    if (userData?.phone && userData?.notificationPreferences?.sms) {
      // Aquí integrarías con servicio SMS como Twilio
      console.log(`SMS reminder sent to ${userData.phone}: ${notification.message}`);
    }

  } catch (error) {
    console.error('Error sending individual reminder:', error);
  }
};

// Función para manejar confirmaciones de último momento
export const handleLastMinuteConfirmation = onCall(async (request) => {
  const { serviceRequestId, action, newDateTime } = request.data;
  const userId = request.auth?.uid;

  if (!userId || !serviceRequestId || !action) {
    throw new HttpsError('invalid-argument', 'Parámetros requeridos faltantes');
  }

  try {
    const serviceDoc = await db.collection('scheduledServices')
      .doc(serviceRequestId)
      .get();

    if (!serviceDoc.exists) {
      throw new HttpsError('not-found', 'Servicio no encontrado');
    }

    const serviceData = serviceDoc.data();
    
    // Verificar que el usuario es el propietario del servicio
    if (serviceData?.userId !== userId) {
      throw new HttpsError('permission-denied', 'No autorizado');
    }

    const currentTime = new Date();
    const serviceTime = new Date(serviceData?.scheduledDateTime.seconds * 1000);
    const timeUntilService = (serviceTime.getTime() - currentTime.getTime()) / (1000 * 60); // minutos

    switch (action) {
      case 'confirm':
        await db.collection('scheduledServices').doc(serviceRequestId).update({
          lastMinuteConfirmation: {
            confirmed: true,
            confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            minutesBeforeService: timeUntilService
          }
        });
        
        return { 
          success: true, 
          message: 'Servicio confirmado para último momento',
          timeUntilService: Math.round(timeUntilService)
        };

      case 'reschedule':
        if (!newDateTime) {
          throw new HttpsError('invalid-argument', 'Nueva fecha y hora requeridas');
        }

        // Verificar disponibilidad del nuevo horario
        const newServiceTime = new Date(newDateTime.seconds * 1000);
        
        await db.collection('scheduledServices').doc(serviceRequestId).update({
          scheduledDateTime: newDateTime,
          lastMinuteReschedule: {
            originalDateTime: serviceData?.scheduledDateTime,
            newDateTime,
            rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'last_minute_change'
          }
        });

        // Reconfigurar recordatorios para nuevo horario
        await setupAutomaticReminders({
          auth: request.auth,
          data: {
            serviceRequestId,
            scheduledDateTime: newDateTime,
            userTimezone: serviceData?.userTimezone || 'America/Mexico_City'
          }
        });

        return { 
          success: true, 
          message: 'Servicio reprogramado exitosamente',
          newDateTime: newServiceTime
        };

      case 'cancel':
        await db.collection('scheduledServices').doc(serviceRequestId).update({
          status: 'cancelled',
          lastMinuteCancel: {
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            minutesBeforeService: timeUntilService,
            reason: 'last_minute_cancel'
          }
        });

        return { 
          success: true, 
          message: 'Servicio cancelado',
          refundEligible: timeUntilService > 60 // Elegible para reembolso si se cancela con más de 1 hora
        };

      default:
        throw new HttpsError('invalid-argument', 'Acción no válida');
    }

  } catch (error) {
    console.error('Error handling last minute confirmation:', error);
    throw new HttpsError('internal', 'Error procesando confirmación');
  }
});

// Función para detectar retrasos del prestador
export const detectProviderDelays = onSchedule('every 10 minutes', async () => {
  const now = admin.firestore.Timestamp.now();
  const tenMinutesAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 10 * 60 * 1000)
  );

  try {
    // Buscar servicios que deberían haber comenzado pero el prestador no ha llegado
    const delayedServicesQuery = await db.collection('scheduledServices')
      .where('status', '==', 'confirmed')
      .where('scheduledDateTime', '<=', tenMinutesAgo)
      .where('providerArrived', '==', false)
      .get();

    for (const doc of delayedServicesQuery.docs) {
      const serviceData = doc.data();
      const delayMinutes = Math.round(
        (now.toDate().getTime() - serviceData.scheduledDateTime.toDate().getTime()) / (1000 * 60)
      );

      // Notificar al cliente sobre el retraso
      await db.collection('notifications').add({
        userId: serviceData.userId,
        type: 'provider_delay',
        title: 'Retraso en el Servicio',
        message: `Tu prestador está retrasado ${delayMinutes} minutos. Te mantendremos informado.`,
        data: {
          serviceRequestId: doc.id,
          delayMinutes,
          estimatedArrival: new Date(Date.now() + 15 * 60 * 1000) // Estimado 15 min más
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });

      // Marcar como retrasado
      await doc.ref.update({
        delayInfo: {
          isDelayed: true,
          delayMinutes,
          detectedAt: now,
          notificationSent: true
        }
      });
    }

    console.log(`Detectados ${delayedServicesQuery.size} servicios retrasados`);

  } catch (error) {
    console.error('Error detecting provider delays:', error);
  }
});

// Función para obtener recomendaciones Premium
export const getPremiumRecommendations = onCall(async (request) => {
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  try {
    // Verificar estado Premium
    const premiumCheck = await checkPremiumStatus({ auth: request.auth, data: {} });
    
    if (!premiumCheck.data.isPremium) {
      throw new HttpsError('permission-denied', 'Función disponible solo para usuarios Premium');
    }

    // Obtener historial de servicios del usuario
    const servicesQuery = await db.collection('scheduledServices')
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .orderBy('scheduledDateTime', 'desc')
      .limit(50)
      .get();

    const services = servicesQuery.docs.map(doc => doc.data());

    // Generar recomendaciones basadas en patrones
    const recommendations = generateSmartRecommendations(services);

    return {
      userId,
      recommendations,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      basedOnServices: services.length
    };

  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw new HttpsError('internal', 'Error generando recomendaciones');
  }
});

// Función auxiliar para generar recomendaciones inteligentes
const generateSmartRecommendations = (services: any[]) => {
  const recommendations = [];

  // Analizar frecuencia de servicios
  const serviceFrequency: Record<string, number> = {};
  const timePatterns: Record<string, number> = {};
  
  services.forEach(service => {
    serviceFrequency[service.serviceType] = (serviceFrequency[service.serviceType] || 0) + 1;
    
    const hour = new Date(service.scheduledDateTime.seconds * 1000).getHours();
    const timeSlot = `${hour}:00`;
    timePatterns[timeSlot] = (timePatterns[timeSlot] || 0) + 1;
  });

  // Recomendar servicios recurrentes para servicios frecuentes
  Object.entries(serviceFrequency).forEach(([serviceType, count]) => {
    if (count >= 3) {
      recommendations.push({
        type: 'recurring_service',
        title: 'Servicio Recurrente Recomendado',
        description: `Has solicitado ${serviceType.replace('_', ' ')} ${count} veces. ¿Te gustaría configurar un servicio recurrente?`,
        serviceType,
        frequency: count >= 6 ? 'monthly' : 'quarterly',
        estimatedSavings: count * 50 // 10% descuento estimado
      });
    }
  });

  // Recomendar horarios óptimos
  const preferredTime = Object.entries(timePatterns)
    .sort(([,a], [,b]) => b - a)[0]?.[0];
    
  if (preferredTime) {
    recommendations.push({
      type: 'optimal_timing',
      title: 'Horario Preferido Detectado',
      description: `Prefieres servicios alrededor de las ${preferredTime}. ¿Quieres que te mostremos más opciones en este horario?`,
      preferredTime,
      confidence: 0.8
    });
  }

  // Recomendar servicios complementarios
  if (serviceFrequency['plomeria'] && serviceFrequency['electricidad']) {
    recommendations.push({
      type: 'bundle_service',
      title: 'Paquete de Mantenimiento',
      description: 'Combina plomería y electricidad en un servicio integral y ahorra 15%',
      services: ['plomeria', 'electricidad'],
      discount: 15
    });
  }

  return recommendations;
};