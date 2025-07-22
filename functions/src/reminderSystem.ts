import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { TimezoneManager } from './timezoneUtils';

const db = admin.firestore();

/**
 * Sistema completo de recordatorios automáticos para ServiMap
 * Maneja notificaciones 24h, 2h, 30min antes del servicio
 * Incluye confirmaciones de último momento y detección de retrasos
 */

export interface ReminderTemplate {
  type: '24h' | '2h' | '30min' | 'provider_late' | 'service_starting';
  title: string;
  message: string;
  actionButtons?: Array<{
    text: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
}

export interface NotificationPreferences {
  sms: boolean;
  email: boolean;
  push: boolean;
  whatsapp: boolean;
  reminderTiming: {
    reminder24h: boolean;
    reminder2h: boolean;
    reminder30min: boolean;
  };
}

// Plantillas de recordatorios
const REMINDER_TEMPLATES: Record<string, ReminderTemplate> = {
  '24h': {
    type: '24h',
    title: '🔔 Recordatorio: Servicio Mañana',
    message: 'Tu servicio de {serviceType} está programado para mañana {date} a las {time}.\n\n📍 Ubicación: {address}\n👨‍🔧 Prestador: {providerName}\n💰 Total: {price}',
    actionButtons: [
      { text: '✅ Confirmar', action: 'confirm', style: 'primary' },
      { text: '📞 Contactar', action: 'contact', style: 'secondary' },
      { text: '🔄 Reprogramar', action: 'reschedule', style: 'secondary' }
    ]
  },
  '2h': {
    type: '2h',
    title: '⏰ Tu servicio inicia en 2 horas',
    message: 'Tu servicio de {serviceType} está próximo a iniciar.\n\n🕐 Hora: {time}\n👨‍🔧 {providerName} está en camino\n📞 Teléfono: {providerPhone}\n\n¿Todo está listo en {address}?',
    actionButtons: [
      { text: '👍 Todo listo', action: 'ready', style: 'primary' },
      { text: '📞 Llamar prestador', action: 'call_provider', style: 'secondary' },
      { text: '⚠️ Hay un problema', action: 'report_issue', style: 'danger' }
    ]
  },
  '30min': {
    type: '30min',
    title: '🚨 Servicio próximo a iniciar',
    message: 'Tu servicio de {serviceType} inicia pronto.\n\n✓ Confirma que todo esté listo:\n• Acceso libre al área de trabajo\n• Herramientas/materiales preparados\n• Persona de contacto disponible\n\n🚗 {providerName} debería llegar según lo acordado.',
    actionButtons: [
      { text: '✅ Listo y confirmado', action: 'final_confirm', style: 'primary' },
      { text: '❌ Cancelar servicio', action: 'last_minute_cancel', style: 'danger' }
    ]
  },
  'provider_late': {
    type: 'provider_late',
    title: '⏰ Prestador con retraso',
    message: 'Tu prestador {providerName} está retrasado {delayMinutes} minutos.\n\n🕐 Nueva hora estimada: {estimatedArrival}\n📞 Teléfono: {providerPhone}\n\nTe mantendremos informado sobre su ubicación.',
    actionButtons: [
      { text: '📞 Contactar prestador', action: 'call_provider', style: 'primary' },
      { text: '❌ Cancelar por retraso', action: 'cancel_delay', style: 'danger' }
    ]
  },
  'service_starting': {
    type: 'service_starting',
    title: '🎯 ¡Tu servicio está comenzando!',
    message: '{providerName} ha llegado y tu servicio de {serviceType} está iniciando.\n\n⏱️ Duración estimada: {duration} minutos\n💰 Total: {price}\n\n¿El prestador se presentó correctamente?',
    actionButtons: [
      { text: '✅ Sí, todo correcto', action: 'service_started', style: 'primary' },
      { text: '⚠️ Reportar problema', action: 'report_issue', style: 'danger' }
    ]
  }
};

// Función principal para configurar recordatorios
export const setupServiceReminders = onCall(async (request) => {
  const { serviceRequestId, scheduledDateTime, userTimezone, providerInfo } = request.data;
  const userId = request.auth?.uid;

  if (!userId || !serviceRequestId || !scheduledDateTime) {
    throw new HttpsError('invalid-argument', 'Parámetros requeridos: serviceRequestId, scheduledDateTime');
  }

  try {
    const serviceDate = new Date(scheduledDateTime.seconds * 1000);
    const now = new Date();
    const userTz = userTimezone || 'America/Mexico_City';

    // Obtener preferencias de notificación del usuario
    const userDoc = await db.collection('users').doc(userId).get();
    const notificationPrefs: NotificationPreferences = userDoc.data()?.notificationPreferences || {
      sms: true,
      email: true,
      push: true,
      whatsapp: false,
      reminderTiming: { reminder24h: true, reminder2h: true, reminder30min: true }
    };

    const reminders = [];

    // Calcular tiempos de recordatorio en zona horaria del usuario
    const userServiceTime = TimezoneManager.convertFromUTC(
      admin.firestore.Timestamp.fromDate(serviceDate), 
      userTz
    );

    // 24 horas antes
    if (notificationPrefs.reminderTiming.reminder24h) {
      const reminder24h = new Date(userServiceTime.getTime() - (24 * 60 * 60 * 1000));
      if (reminder24h > now) {
        reminders.push({
          type: '24h',
          scheduledFor: TimezoneManager.convertToUTC(reminder24h, userTz),
          template: REMINDER_TEMPLATES['24h'],
          sent: false,
          channels: getEnabledChannels(notificationPrefs)
        });
      }
    }

    // 2 horas antes
    if (notificationPrefs.reminderTiming.reminder2h) {
      const reminder2h = new Date(userServiceTime.getTime() - (2 * 60 * 60 * 1000));
      if (reminder2h > now) {
        reminders.push({
          type: '2h',
          scheduledFor: TimezoneManager.convertToUTC(reminder2h, userTz),
          template: REMINDER_TEMPLATES['2h'],
          sent: false,
          channels: getEnabledChannels(notificationPrefs)
        });
      }
    }

    // Recordatorio próximo al servicio
    if (notificationPrefs.reminderTiming.reminder30min) {
      const reminder30min = new Date(userServiceTime.getTime() - (30 * 60 * 1000));
      if (reminder30min > now) {
        reminders.push({
          type: '30min',
          scheduledFor: TimezoneManager.convertToUTC(reminder30min, userTz),
          template: REMINDER_TEMPLATES['30min'],
          sent: false,
          channels: getEnabledChannels(notificationPrefs)
        });
      }
    }

    // Guardar configuración de recordatorios
    await db.collection('serviceReminders').doc(serviceRequestId).set({
      serviceRequestId,
      userId,
      scheduledDateTime,
      userTimezone: userTz,
      providerInfo: providerInfo || null,
      reminders,
      notificationPreferences: notificationPrefs,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      serviceRequestId,
      remindersScheduled: reminders.length,
      reminders: reminders.map(r => ({
        type: r.type,
        scheduledFor: r.scheduledFor.toDate(),
        channels: r.channels
      }))
    };

  } catch (error) {
    console.error('Error setting up reminders:', error);
    throw new HttpsError('internal', 'Error configurando recordatorios');
  }
});

// Función programada que se ejecuta cada 2 minutos para enviar recordatorios
export const processScheduledReminders = onSchedule('every 2 minutes', async () => {
  const now = admin.firestore.Timestamp.now();
  const twoMinutesAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 2 * 60 * 1000)
  );

  try {
    // Buscar recordatorios que deben enviarse
    const remindersQuery = await db.collection('serviceReminders')
      .where('reminders', 'array-contains-any', [
        { sent: false, scheduledFor: { '<=': now, '>=': twoMinutesAgo } }
      ])
      .get();

    const batch = db.batch();
    let processedCount = 0;

    for (const doc of remindersQuery.docs) {
      const data = doc.data();
      const updatedReminders = [];
      
      for (const reminder of data.reminders) {
        const reminderTime = reminder.scheduledFor.toDate();
        const shouldSend = !reminder.sent && 
                          reminderTime <= now.toDate() && 
                          reminderTime >= twoMinutesAgo.toDate();

        if (shouldSend) {
          // Procesar envío del recordatorio
          await sendReminder({
            ...reminder,
            serviceRequestId: data.serviceRequestId,
            userId: data.userId,
            userTimezone: data.userTimezone,
            scheduledDateTime: data.scheduledDateTime,
            providerInfo: data.providerInfo
          });

          updatedReminders.push({
            ...reminder,
            sent: true,
            sentAt: now
          });

          processedCount++;
        } else {
          updatedReminders.push(reminder);
        }
      }

      // Actualizar documento con recordatorios marcados como enviados
      batch.update(doc.ref, { 
        reminders: updatedReminders,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
    console.log(`Procesados ${processedCount} recordatorios`);

  } catch (error) {
    console.error('Error processing scheduled reminders:', error);
  }
});

// Función para enviar recordatorio individual
async function sendReminder(reminderData: any) {
  try {
    // Obtener datos del servicio para personalizar mensaje
    const serviceDoc = await db.collection('scheduledServices')
      .doc(reminderData.serviceRequestId)
      .get();

    if (!serviceDoc.exists) return;

    const serviceData = serviceDoc.data();
    const userDoc = await db.collection('users').doc(reminderData.userId).get();
    const userData = userDoc.data();

    // Personalizar mensaje con datos reales
    const personalizedMessage = personalizeMessage(
      reminderData.template.message,
      {
        serviceType: serviceData?.serviceType?.replace('_', ' ') || 'Servicio',
        date: TimezoneManager.formatTimeForUser(
          reminderData.scheduledDateTime,
          {
            timezone: reminderData.userTimezone,
            locale: 'es-MX',
            use24HourFormat: false,
            autoDetectTimezone: false
          }
        ),
        time: new Date(reminderData.scheduledDateTime.seconds * 1000).toLocaleTimeString('es-MX', {
          timeZone: reminderData.userTimezone,
          hour: '2-digit',
          minute: '2-digit'
        }),
        address: serviceData?.address || 'Ubicación confirmada',
        providerName: reminderData.providerInfo?.name || 'Tu prestador',
        providerPhone: reminderData.providerInfo?.phone || 'Contacto disponible',
        price: formatPrice(serviceData?.price || 0),
        duration: serviceData?.estimatedDuration || 60
      }
    );

    // Crear notificación en base de datos
    const notificationData = {
      userId: reminderData.userId,
      type: 'service_reminder',
      subtype: reminderData.type,
      title: reminderData.template.title,
      message: personalizedMessage,
      actionButtons: reminderData.template.actionButtons || [],
      data: {
        serviceRequestId: reminderData.serviceRequestId,
        reminderType: reminderData.type,
        scheduledDateTime: reminderData.scheduledDateTime
      },
      channels: reminderData.channels,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      priority: reminderData.type === '30min' ? 'high' : 'normal'
    };

    await db.collection('notifications').add(notificationData);

    // Enviar por diferentes canales
    for (const channel of reminderData.channels) {
      switch (channel) {
        case 'push':
          await sendPushNotification(userData, notificationData);
          break;
        case 'sms':
          await sendSMSReminder(userData, personalizedMessage);
          break;
        case 'email':
          await sendEmailReminder(userData, notificationData);
          break;
        case 'whatsapp':
          await sendWhatsAppReminder(userData, personalizedMessage);
          break;
      }
    }

    console.log(`Recordatorio ${reminderData.type} enviado a usuario ${reminderData.userId}`);

  } catch (error) {
    console.error('Error sending individual reminder:', error);
  }
}

// Función para manejar respuestas a recordatorios
export const handleReminderResponse = onCall(async (request) => {
  const { notificationId, action, serviceRequestId } = request.data;
  const userId = request.auth?.uid;

  if (!userId || !action || !serviceRequestId) {
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
    
    // Verificar autorización
    if (serviceData?.userId !== userId) {
      throw new HttpsError('permission-denied', 'No autorizado');
    }

    let response = {};

    switch (action) {
      case 'confirm':
        await db.collection('scheduledServices').doc(serviceRequestId).update({
          reminderConfirmation: {
            confirmed: true,
            confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            confirmedBy: 'user'
          }
        });
        response = { message: 'Servicio confirmado exitosamente' };
        break;

      case 'ready':
        await db.collection('scheduledServices').doc(serviceRequestId).update({
          userReadyStatus: {
            isReady: true,
            readyAt: admin.firestore.FieldValue.serverTimestamp(),
            readyConfirmedBy: userId
          }
        });
        response = { message: 'Confirmado que estás listo para el servicio' };
        break;

      case 'reschedule':
        // Marcar para reprogramación
        await db.collection('scheduledServices').doc(serviceRequestId).update({
          rescheduleRequest: {
            requested: true,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            requestedBy: userId,
            reason: 'user_request'
          },
          status: 'pending_reschedule'
        });
        response = { 
          message: 'Solicitud de reprogramación enviada',
          requiresNewDate: true 
        };
        break;

      case 'last_minute_cancel':
        const currentTime = new Date();
        const serviceTime = new Date(serviceData?.scheduledDateTime.seconds * 1000);
        const minutesUntilService = (serviceTime.getTime() - currentTime.getTime()) / (1000 * 60);

        await db.collection('scheduledServices').doc(serviceRequestId).update({
          status: 'cancelled',
          cancellation: {
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancelledBy: userId,
            reason: 'last_minute_user_cancel',
            minutesBeforeService: minutesUntilService,
            refundEligible: minutesUntilService > 60
          }
        });

        response = { 
          message: 'Servicio cancelado',
          refundInfo: minutesUntilService > 60 ? 
            'Recibirás reembolso completo' : 
            'Se aplicará cargo por cancelación tardía'
        };
        break;

      case 'report_issue':
        await db.collection('serviceIssues').add({
          serviceRequestId,
          userId,
          issueType: 'reminder_response',
          description: 'Usuario reportó problema desde recordatorio',
          reportedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'open',
          priority: 'high'
        });

        response = { 
          message: 'Problema reportado. Nuestro equipo se contactará contigo pronto'
        };
        break;

      case 'call_provider':
        // Log de intento de contacto
        await db.collection('contactAttempts').add({
          serviceRequestId,
          userId,
          type: 'call_provider',
          initiatedAt: admin.firestore.FieldValue.serverTimestamp(),
          method: 'phone_direct'
        });

        response = { 
          message: 'Redirigiendo a llamada con prestador',
          providerPhone: serviceData?.providerInfo?.phone || null
        };
        break;

      default:
        throw new HttpsError('invalid-argument', 'Acción no válida');
    }

    // Marcar notificación como leída
    if (notificationId) {
      await db.collection('notifications').doc(notificationId).update({
        read: true,
        readAt: admin.firestore.FieldValue.serverTimestamp(),
        actionTaken: action
      });
    }

    return response;

  } catch (error) {
    console.error('Error handling reminder response:', error);
    throw new HttpsError('internal', 'Error procesando respuesta');
  }
});

// Función para detectar y notificar retrasos del prestador
export const detectProviderDelays = onSchedule('every 5 minutes', async () => {
  const now = admin.firestore.Timestamp.now();
  const fiveMinutesAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 5 * 60 * 1000)
  );

  try {
    // Buscar servicios que deberían haber comenzado
    const overdueServicesQuery = await db.collection('scheduledServices')
      .where('status', '==', 'confirmed')
      .where('scheduledDateTime', '<=', fiveMinutesAgo)
      .where('serviceStarted', '==', false)
      .get();

    for (const doc of overdueServicesQuery.docs) {
      const serviceData = doc.data();
      const delayMinutes = Math.round(
        (now.toDate().getTime() - serviceData.scheduledDateTime.toDate().getTime()) / (1000 * 60)
      );

      // Solo notificar si el retraso es significativo (>10 min) y no se ha notificado
      if (delayMinutes >= 10 && !serviceData.delayNotificationSent) {
        const estimatedArrival = new Date(Date.now() + 20 * 60 * 1000); // +20 min estimado

        // Crear notificación de retraso
        const delayMessage = personalizeMessage(
          REMINDER_TEMPLATES['provider_late'].message,
          {
            providerName: serviceData.providerInfo?.name || 'Tu prestador',
            delayMinutes: delayMinutes.toString(),
            estimatedArrival: estimatedArrival.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            providerPhone: serviceData.providerInfo?.phone || 'Contacto disponible'
          }
        );

        await db.collection('notifications').add({
          userId: serviceData.userId,
          type: 'provider_delay',
          title: REMINDER_TEMPLATES['provider_late'].title,
          message: delayMessage,
          actionButtons: REMINDER_TEMPLATES['provider_late'].actionButtons,
          data: {
            serviceRequestId: doc.id,
            delayMinutes,
            estimatedArrival: admin.firestore.Timestamp.fromDate(estimatedArrival)
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          priority: 'high'
        });

        // Marcar como notificado
        await doc.ref.update({
          delayInfo: {
            isDelayed: true,
            delayMinutes,
            detectedAt: now,
            estimatedArrival: admin.firestore.Timestamp.fromDate(estimatedArrival)
          },
          delayNotificationSent: true
        });
      }
    }

  } catch (error) {
    console.error('Error detecting provider delays:', error);
  }
});

// Funciones auxiliares
function getEnabledChannels(prefs: NotificationPreferences): string[] {
  const channels = [];
  if (prefs.push) channels.push('push');
  if (prefs.sms) channels.push('sms');
  if (prefs.email) channels.push('email');
  if (prefs.whatsapp) channels.push('whatsapp');
  return channels;
}

function personalizeMessage(template: string, data: Record<string, string>): string {
  let message = template;
  for (const [key, value] of Object.entries(data)) {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return message;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(price);
}

// Funciones de envío por canal (implementación básica)
async function sendPushNotification(userData: any, notification: any) {
  // Implementar con FCM
  console.log(`Push notification sent to ${userData.email}: ${notification.title}`);
}

async function sendSMSReminder(userData: any, message: string) {
  // Implementar con Twilio u otro proveedor SMS
  console.log(`SMS sent to ${userData.phone}: ${message}`);
}

async function sendEmailReminder(userData: any, notification: any) {
  // Implementar con SendGrid u otro proveedor de email
  console.log(`Email sent to ${userData.email}: ${notification.title}`);
}

async function sendWhatsAppReminder(userData: any, message: string) {
  // Implementar con WhatsApp Business API
  console.log(`WhatsApp sent to ${userData.phone}: ${message}`);
}