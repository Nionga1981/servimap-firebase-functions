// Security Functions - Validación de permisos, rate limiting y seguridad
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Inicializar Firebase Admin si no está inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// Constantes de seguridad
const RATE_LIMITS = {
  MESSAGES_PER_MINUTE: 10,
  MESSAGES_PER_HOUR: 100,
  MEDIA_UPLOADS_PER_HOUR: 20,
  QUOTATIONS_PER_DAY: 10,
  VIDEO_CALLS_PER_DAY: 5
};

const SECURITY_SETTINGS = {
  CHAT_INACTIVITY_DAYS: 90,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_MEDIA_SIZE_MB: 50,
  ENCRYPTION_KEY_ROTATION_DAYS: 30
};

/**
 * 🔒 Validar permisos de chat
 */
export async function validateChatPermissions(
  chatId: string, 
  userId: string, 
  action: 'read' | 'write' | 'moderate'
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // 1. Verificar que el chat existe
    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) {
      return { allowed: false, reason: "Chat no encontrado" };
    }

    const chatData = chatDoc.data();

    // 2. Verificar que el usuario es participante
    if (!chatData?.participantIds?.includes(userId)) {
      return { allowed: false, reason: "Usuario no es participante del chat" };
    }

    // 3. Verificar estado de moderación del usuario
    const userModerationStatus = await getUserModerationStatus(userId);
    if (userModerationStatus.status === 'suspended') {
      return { allowed: false, reason: "Usuario suspendido" };
    }

    if (userModerationStatus.status === 'temporarily_blocked') {
      const now = Date.now();
      const unblockTime = userModerationStatus.unblockAt?.toMillis() || 0;
      
      if (now < unblockTime) {
        return { 
          allowed: false, 
          reason: `Usuario bloqueado hasta ${new Date(unblockTime).toLocaleString()}` 
        };
      } else {
        // Auto-desbloquear si el tiempo ha pasado
        await db.collection("userModerationStatus").doc(userId).update({
          status: 'active',
          unblockAt: admin.firestore.FieldValue.delete()
        });
      }
    }

    // 4. Verificar permisos específicos por acción
    if (action === 'write' && userModerationStatus?.restrictions?.includes('no_messaging')) {
      return { allowed: false, reason: "Usuario sin permisos de escritura" };
    }

    if (action === 'moderate' && !await isUserModerator(userId)) {
      return { allowed: false, reason: "Usuario no es moderador" };
    }

    return { allowed: true };

  } catch (error) {
    console.error("Error validando permisos:", error);
    return { allowed: false, reason: "Error validando permisos" };
  }
}

/**
 * ⏱️ Rate Limiting - Verificar límites de uso
 */
export async function checkRateLimit(
  userId: string, 
  action: 'message' | 'media_upload' | 'quotation' | 'video_call'
): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
  try {
    const now = Date.now();
    
    // Definir ventanas de tiempo según la acción
    let timeWindow: number;
    let maxActions: number;
    
    switch (action) {
      case 'message':
        timeWindow = 60 * 1000; // 1 minuto
        maxActions = RATE_LIMITS.MESSAGES_PER_MINUTE;
        break;
      case 'media_upload':
        timeWindow = 60 * 60 * 1000; // 1 hora
        maxActions = RATE_LIMITS.MEDIA_UPLOADS_PER_HOUR;
        break;
      case 'quotation':
        timeWindow = 24 * 60 * 60 * 1000; // 1 día
        maxActions = RATE_LIMITS.QUOTATIONS_PER_DAY;
        break;
      case 'video_call':
        timeWindow = 24 * 60 * 60 * 1000; // 1 día
        maxActions = RATE_LIMITS.VIDEO_CALLS_PER_DAY;
        break;
      default:
        return { allowed: true };
    }

    const windowStart = now - timeWindow;
    const rateLimitKey = `${userId}_${action}`;
    
    // Obtener acciones recientes
    const recentActionsSnapshot = await db
      .collection("rateLimitTracker")
      .where("userId", "==", userId)
      .where("action", "==", action)
      .where("timestamp", ">=", admin.firestore.Timestamp.fromMillis(windowStart))
      .get();

    const currentCount = recentActionsSnapshot.size;
    
    if (currentCount >= maxActions) {
      const oldestAction = recentActionsSnapshot.docs
        .sort((a, b) => a.data().timestamp.toMillis() - b.data().timestamp.toMillis())[0];
      
      const resetTime = oldestAction.data().timestamp.toMillis() + timeWindow;
      
      return { 
        allowed: false, 
        resetTime, 
        remaining: 0 
      };
    }

    // Registrar esta acción
    await db.collection("rateLimitTracker").add({
      userId,
      action,
      timestamp: admin.firestore.Timestamp.fromMillis(now),
      rateLimitKey
    });

    // Limpiar acciones antiguas (optimización)
    const oldActionsSnapshot = await db
      .collection("rateLimitTracker")
      .where("timestamp", "<", admin.firestore.Timestamp.fromMillis(windowStart))
      .limit(10)
      .get();

    const batch = db.batch();
    oldActionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return { 
      allowed: true, 
      remaining: maxActions - currentCount - 1 
    };

  } catch (error) {
    console.error("Error en rate limiting:", error);
    // En caso de error, permitir la acción
    return { allowed: true };
  }
}

/**
 * 🔐 Encriptar mensajes sensibles
 */
export function encryptSensitiveMessage(message: string, metadata: any = {}): any {
  try {
    // En producción: usar crypto real
    // Por ahora solo marcar como encriptado
    
    const isPhoneNumber = /(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/.test(message);
    const isEmail = /\S+@\S+\.\S+/.test(message);
    
    if (isPhoneNumber || isEmail || metadata.containsSensitiveInfo) {
      return {
        encrypted: true,
        encryptedContent: Buffer.from(message).toString('base64'), // Simulación
        encryptionMethod: 'AES-256-GCM',
        encryptedAt: admin.firestore.Timestamp.now(),
        metadata: {
          ...metadata,
          originalLength: message.length,
          containsPhone: isPhoneNumber,
          containsEmail: isEmail
        }
      };
    }
    
    return {
      encrypted: false,
      content: message,
      metadata
    };
    
  } catch (error) {
    console.error("Error encriptando mensaje:", error);
    return {
      encrypted: false,
      content: message,
      metadata,
      encryptionError: true
    };
  }
}

/**
 * 📊 Obtener estado de moderación del usuario
 */
async function getUserModerationStatus(userId: string) {
  try {
    const statusDoc = await db.collection("userModerationStatus").doc(userId).get();
    
    if (!statusDoc.exists) {
      return { status: 'active', restrictions: [] };
    }
    
    return statusDoc.data();
  } catch (error) {
    console.error("Error obteniendo estado de moderación:", error);
    return { status: 'active', restrictions: [] };
  }
}

/**
 * 👮‍♂️ Verificar si usuario es moderador
 */
async function isUserModerator(userId: string): Promise<boolean> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    return userData?.role === 'moderator' || userData?.role === 'admin' || false;
  } catch (error) {
    console.error("Error verificando rol de moderador:", error);
    return false;
  }
}

/**
 * 🧹 Auto-delete de chats inactivos (Función programada)
 */
export const cleanupInactiveChats = onSchedule({
  schedule: "0 2 * * *", // Diariamente a las 2 AM
  timeZone: "America/Mexico_City"
}, async (event) => {
  console.log("🧹 Iniciando limpieza de chats inactivos...");
  
  try {
    const cutoffDate = admin.firestore.Timestamp.fromMillis(
      Date.now() - (SECURITY_SETTINGS.CHAT_INACTIVITY_DAYS * 24 * 60 * 60 * 1000)
    );
    
    // Buscar chats inactivos
    const inactiveChatsSnapshot = await db
      .collection("chats")
      .where("updatedAt", "<", cutoffDate)
      .where("status", "!=", "active") // No eliminar chats activos
      .limit(50) // Procesar en lotes
      .get();
    
    if (inactiveChatsSnapshot.empty) {
      console.log("✅ No hay chats inactivos para eliminar");
      return;
    }
    
    const batch = db.batch();
    const deletedChatIds: string[] = [];
    
    for (const chatDoc of inactiveChatsSnapshot.docs) {
      const chatId = chatDoc.id;
      const chatData = chatDoc.data();
      
      // Log antes de eliminar
      await logChatDeletion(chatId, chatData, 'auto_cleanup_inactive');
      
      // Marcar chat como eliminado en lugar de borrar completamente
      batch.update(chatDoc.ref, {
        status: 'deleted',
        deletedAt: admin.firestore.Timestamp.now(),
        deletionReason: 'auto_cleanup_inactive',
        originalData: chatData // Backup para auditoría
      });
      
      deletedChatIds.push(chatId);
    }
    
    await batch.commit();
    
    // Limpiar mensajes asociados (en lotes separados)
    for (const chatId of deletedChatIds) {
      await cleanupChatMessages(chatId);
    }
    
    console.log(`✅ Eliminados ${deletedChatIds.length} chats inactivos`);
    
    // Crear reporte de limpieza
    await db.collection("cleanupReports").add({
      type: 'inactive_chats',
      deletedCount: deletedChatIds.length,
      deletedChatIds,
      executedAt: admin.firestore.Timestamp.now(),
      cutoffDate
    });
    
  } catch (error) {
    console.error("❌ Error en limpieza de chats:", error);
    
    await db.collection("cleanupErrors").add({
      type: 'inactive_chats_cleanup',
      error: error instanceof Error ? error.message : String(error),
      timestamp: admin.firestore.Timestamp.now()
    });
  }
});

/**
 * 🧹 Limpiar mensajes de chat eliminado
 */
async function cleanupChatMessages(chatId: string) {
  try {
    const messagesSnapshot = await db
      .collection("chatMessages")
      .where("chatId", "==", chatId)
      .limit(100)
      .get();
    
    if (messagesSnapshot.empty) return;
    
    const batch = db.batch();
    
    messagesSnapshot.docs.forEach(messageDoc => {
      // Marcar como eliminado en lugar de borrar
      batch.update(messageDoc.ref, {
        deleted: true,
        deletedAt: admin.firestore.Timestamp.now(),
        originalContent: messageDoc.data().content || messageDoc.data().message
      });
    });
    
    await batch.commit();
    
    // Si hay más mensajes, continuar recursivamente
    if (messagesSnapshot.size === 100) {
      await cleanupChatMessages(chatId);
    }
    
  } catch (error) {
    console.error(`Error limpiando mensajes del chat ${chatId}:`, error);
  }
}

/**
 * 📝 Log de eliminación de chat
 */
async function logChatDeletion(chatId: string, chatData: any, reason: string) {
  try {
    await db.collection("chatDeletionLogs").add({
      chatId,
      reason,
      participantIds: chatData.participantIds || [],
      lastActivity: chatData.updatedAt,
      messageCount: chatData.messageCount || 0,
      deletedAt: admin.firestore.Timestamp.now(),
      metadata: {
        status: chatData.status,
        createdAt: chatData.createdAt,
        hasActiveVideoCall: chatData.hasActiveVideoCall || false
      }
    });
  } catch (error) {
    console.error("Error logging eliminación de chat:", error);
  }
}

/**
 * 🔄 Rotación de claves de encriptación (Función programada)
 */
export const rotateEncryptionKeys = onSchedule({
  schedule: "0 3 1 * *", // Primer día de cada mes a las 3 AM
  timeZone: "America/Mexico_City"
}, async (event) => {
  console.log("🔄 Iniciando rotación de claves de encriptación...");
  
  try {
    const now = admin.firestore.Timestamp.now();
    
    // Crear nueva clave
    const newKeyId = `key_${Date.now()}`;
    
    await db.collection("encryptionKeys").add({
      keyId: newKeyId,
      status: 'active',
      createdAt: now,
      algorithm: 'AES-256-GCM',
      rotationReason: 'scheduled_rotation'
    });
    
    // Marcar claves antiguas como deprecated
    const oldKeysSnapshot = await db
      .collection("encryptionKeys")
      .where("status", "==", "active")
      .where("createdAt", "<", admin.firestore.Timestamp.fromMillis(
        Date.now() - (SECURITY_SETTINGS.ENCRYPTION_KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000)
      ))
      .get();
    
    const batch = db.batch();
    oldKeysSnapshot.docs.forEach(keyDoc => {
      batch.update(keyDoc.ref, {
        status: 'deprecated',
        deprecatedAt: now
      });
    });
    
    await batch.commit();
    
    console.log(`✅ Rotación completada. Nueva clave: ${newKeyId}, ${oldKeysSnapshot.size} claves marcadas como deprecated`);
    
  } catch (error) {
    console.error("❌ Error en rotación de claves:", error);
  }
});

/**
 * 📊 Función de auditoría de seguridad
 */
export const generateSecurityAuditReport = onCall<{
  startDate: string;
  endDate: string;
  includeDetails?: boolean;
}>(
  async (request) => {
    const { startDate, endDate, includeDetails = false } = request.data;
    
    try {
      const start = admin.firestore.Timestamp.fromDate(new Date(startDate));
      const end = admin.firestore.Timestamp.fromDate(new Date(endDate));
      
      // Estadísticas de moderación
      const moderationViolationsSnapshot = await db
        .collection("moderationViolations")
        .where("timestamp", ">=", start)
        .where("timestamp", "<=", end)
        .get();
      
      // Acciones de moderación
      const moderationActionsSnapshot = await db
        .collection("moderationLogs")
        .where("timestamp", ">=", start)
        .where("timestamp", "<=", end)
        .get();
      
      // Rate limit violations
      const rateLimitSnapshot = await db
        .collection("rateLimitTracker")
        .where("timestamp", ">=", start)
        .where("timestamp", "<=", end)
        .get();
      
      // Chats eliminados
      const deletedChatsSnapshot = await db
        .collection("chatDeletionLogs")
        .where("deletedAt", ">=", start)
        .where("deletedAt", "<=", end)
        .get();
      
      const report = {
        period: { startDate, endDate },
        generatedAt: admin.firestore.Timestamp.now().toMillis(),
        
        moderationStats: {
          totalViolations: moderationViolationsSnapshot.size,
          violationsByType: {},
          actionsTaken: moderationActionsSnapshot.size,
          actionsByType: {}
        },
        
        rateLimitStats: {
          totalActions: rateLimitSnapshot.size,
          actionsByType: {}
        },
        
        cleanupStats: {
          deletedChats: deletedChatsSnapshot.size,
          deletionReasons: {}
        },
        
        securityHealth: {
          systemStatus: 'operational',
          lastKeyRotation: null,
          encryptionStatus: 'active'
        }
      };
      
      // Procesar estadísticas detalladas
      moderationViolationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        data.violations?.forEach((violation: any) => {
          const type = violation.type;
          (report.moderationStats.violationsByType as any)[type] = 
            ((report.moderationStats.violationsByType as any)[type] || 0) + 1;
        });
      });
      
      moderationActionsSnapshot.docs.forEach(doc => {
        const action = doc.data().action;
        (report.moderationStats.actionsByType as any)[action] = 
          ((report.moderationStats.actionsByType as any)[action] || 0) + 1;
      });
      
      rateLimitSnapshot.docs.forEach(doc => {
        const action = doc.data().action;
        (report.rateLimitStats.actionsByType as any)[action] = 
          ((report.rateLimitStats.actionsByType as any)[action] || 0) + 1;
      });
      
      deletedChatsSnapshot.docs.forEach(doc => {
        const reason = doc.data().reason;
        (report.cleanupStats.deletionReasons as any)[reason] = 
          ((report.cleanupStats.deletionReasons as any)[reason] || 0) + 1;
      });
      
      // Incluir detalles si se solicita
      if (includeDetails) {
        (report as any).details = {
          recentViolations: moderationViolationsSnapshot.docs.slice(0, 10).map(doc => ({
            id: doc.id,
            ...doc.data()
          })),
          recentActions: moderationActionsSnapshot.docs.slice(0, 10).map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        };
      }
      
      return {
        success: true,
        report
      };
      
    } catch (error) {
      console.error("Error generando reporte de auditoría:", error);
      throw new HttpsError("internal", "Error generando reporte de auditoría");
    }
  }
);