// Chat Functions - Implementaciones optimizadas
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  ChatMessage,
  VideoCallSession,
  ModerationResult,
  MAX_FILE_SIZE_MB,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  SUPPORTED_AUDIO_TYPES,
  VIDEO_CALL_DURATION_LIMIT
} from "./types";

const db = admin.firestore();

/**
 * 📎 uploadQuotationMedia
 * Sube fotos/videos para diagnóstico remoto
 */
export const uploadQuotationMedia = onCall<{
  chatId: string;
  userId: string;
  files: Array<{
    data: string; // base64
    type: string;
    size: number;
    name: string;
  }>;
  messageType: 'image' | 'video' | 'audio';
  description?: string;
}>(
  async (request) => {
    const { chatId, userId, files, messageType, description } = request.data;

    try {
      // 1. Validaciones
      if (!files || files.length === 0) {
        throw new HttpsError("invalid-argument", "No se encontraron archivos");
      }

      if (files.length > 5) {
        throw new HttpsError("invalid-argument", "Máximo 5 archivos por vez");
      }

      // Validar tipos y tamaños
      const allowedTypes = messageType === 'image' ? SUPPORTED_IMAGE_TYPES :
                          messageType === 'video' ? SUPPORTED_VIDEO_TYPES :
                          SUPPORTED_AUDIO_TYPES;

      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          throw new HttpsError("invalid-argument", `Tipo ${file.type} no permitido`);
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          throw new HttpsError("invalid-argument", `Archivo muy grande: ${file.name}`);
        }
      }

      // 2. Subir archivos (simulado)
      const mediaUrls: string[] = [];
      const thumbnails: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // En producción: subir a Firebase Storage
        const url = `https://storage.firebase.com/chats/${chatId}/${Date.now()}_${i}_${file.name}`;
        mediaUrls.push(url);

        // Generar thumbnail para videos
        if (messageType === 'video') {
          const thumbnailUrl = `https://storage.firebase.com/chats/${chatId}/thumb_${Date.now()}_${i}.jpg`;
          thumbnails.push(thumbnailUrl);
        }
      }

      // 3. Crear mensajes en el chat
      for (let i = 0; i < mediaUrls.length; i++) {
        const messageRef = db.collection("chatMessages").doc();
        const message: ChatMessage = {
          chatId,
          senderId: userId,
          messageType,
          content: description || `${messageType} compartido`,
          mediaUrls: [mediaUrls[i]], // Usar nueva estructura array
          isModerated: false,
          readBy: [userId], // Nuevo formato array
          timestamp: admin.firestore.Timestamp.now(),
          // Campos de compatibilidad
          message: description || `${messageType} compartido`,
          senderType: "user",
          mediaUrl: mediaUrls[i],
          thumbnailUrl: thumbnails[i] || undefined
        };

        await messageRef.set(message);
      }

      return {
        success: true,
        mediaUrls,
        thumbnails: thumbnails.length > 0 ? thumbnails : undefined
      };

    } catch (error) {
      console.error("❌ Error subiendo media:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error subiendo archivos");
    }
  }
);

/**
 * 📹 initiateVideoCall
 * Inicia videollamada integrada en el chat
 */
export const initiateVideoCall = onCall<{
  chatId: string;
  initiatorId: string;
  recipientId: string;
}>(
  async (request) => {
    const { chatId, initiatorId, recipientId } = request.data;

    try {
      const now = admin.firestore.Timestamp.now();
      const roomId = `room_${chatId}_${Date.now()}`;
      const callLink = `https://servimap.com/video-call/${roomId}`;
      const expiresAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + (VIDEO_CALL_DURATION_LIMIT * 1000)
      );

      // Crear sesión de videollamada
      const sessionRef = db.collection("videoCallSessions").doc();
      const sessionData: VideoCallSession = {
        chatId,
        roomId,
        participantIds: [initiatorId, recipientId], // Usar nueva estructura
        status: "scheduled",
        // Campos de compatibilidad
        initiatorId,
        recipientId,
        callLink,
        expiresAt
      };

      await sessionRef.set(sessionData);

      // Crear mensaje en el chat
      const messageRef = db.collection("chatMessages").doc();
      const callMessage: ChatMessage = {
        chatId,
        senderId: "system",
        messageType: "system",
        content: `📹 Videollamada iniciada`,
        isModerated: false,
        readBy: [], // Nuevo formato array
        timestamp: now,
        // Campos de compatibilidad
        senderType: "system",
        message: `📹 Videollamada iniciada`
      };

      await messageRef.set(callMessage);

      return {
        success: true,
        roomId,
        callLink,
        expiresAt: expiresAt.toMillis()
      };

    } catch (error) {
      console.error("❌ Error iniciando videollamada:", error);
      throw new HttpsError("internal", "Error iniciando videollamada");
    }
  }
);

/**
 * 🤖 moderateChatWithAI
 * Sistema avanzado de moderación IA para prevenir intercambio de contactos
 */
export const moderateChatWithAI = onCall<{
  chatId: string;
  senderId: string;
  message: string;
  messageType: 'text' | 'image' | 'video';
}>(
  async (request): Promise<ModerationResult> => {
    const { chatId, senderId, message, messageType } = request.data;

    try {
      // Solo moderar texto por ahora
      if (messageType !== 'text') {
        return {
          isAllowed: true,
          confidence: 1.0
        };
      }

      console.log(`🤖 Moderando mensaje de ${senderId} en chat ${chatId}`);

      // 1. Patrones avanzados de detección
      const phonePattern = /(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/gi;
      const emailPattern = /\S+@\S+\.\S+/gi;
      
      // Frases de evasión (case insensitive)
      const evasionPhrases = [
        "te pago directo",
        "sin comisión", 
        "fuera de la app",
        "mi whatsapp",
        "hablemos por",
        "te doy descuento",
        "sin la aplicación",
        "por fuera",
        "directo contigo",
        "evitar comisión",
        "sin intermediarios"
      ];

      // Direcciones físicas
      const addressKeywords = [
        "calle", "avenida", "colonia", "entre", "esquina",
        "boulevard", "paseo", "plaza", "sector", "barrio",
        "carrera", "transversal", "diagonal", "circular"
      ];

      const detectedViolations: string[] = [];
      const violationDetails: any[] = [];
      let severityScore = 0;
      let isAllowed = true;

      // 2. Detectar números de teléfono
      const phoneMatches = message.match(phonePattern);
      if (phoneMatches) {
        detectedViolations.push("phone_number");
        violationDetails.push({
          type: "phone_number",
          matches: phoneMatches,
          severity: 3 // Alto
        });
        severityScore += 3;
      }

      // 3. Detectar emails
      const emailMatches = message.match(emailPattern);
      if (emailMatches) {
        detectedViolations.push("email");
        violationDetails.push({
          type: "email", 
          matches: emailMatches,
          severity: 3 // Alto
        });
        severityScore += 3;
      }

      // 4. Detectar frases de evasión
      const lowerMessage = message.toLowerCase();
      const foundEvasionPhrases = evasionPhrases.filter(phrase => 
        lowerMessage.includes(phrase.toLowerCase())
      );
      if (foundEvasionPhrases.length > 0) {
        detectedViolations.push("evasion_phrase");
        violationDetails.push({
          type: "evasion_phrase",
          matches: foundEvasionPhrases,
          severity: 2 // Medio
        });
        severityScore += 2;
      }

      // 5. Detectar direcciones físicas (solo si hay contexto sospechoso)
      const foundAddressKeywords = addressKeywords.filter(keyword => 
        lowerMessage.includes(keyword)
      );
      if (foundAddressKeywords.length > 0 && (phoneMatches || emailMatches)) {
        detectedViolations.push("physical_address");
        violationDetails.push({
          type: "physical_address",
          matches: foundAddressKeywords,
          severity: 1 // Bajo
        });
        severityScore += 1;
      }

      // 6. Registrar historial de infracciones del usuario
      await recordModerationViolation(senderId, chatId, {
        message,
        violations: violationDetails,
        severityScore,
        timestamp: admin.firestore.Timestamp.now()
      });

      // 7. Determinar acción basada en severidad e historial
      const userViolationHistory = await getUserViolationHistory(senderId);
      const actionResult = await determineAction(senderId, severityScore, userViolationHistory);

      // 8. Construir resultado
      if (detectedViolations.length > 0) {
        isAllowed = actionResult.action === 'allow_with_warning';
        
        const result: ModerationResult = {
          isAllowed,
          confidence: 0.95,
          detectedViolations,
          reason: actionResult.reason,
          warningMessage: actionResult.warningMessage,
          action: actionResult.action,
          severityScore,
          violationDetails
        };

        // 9. Aplicar acción automática si es necesario
        if (actionResult.action !== 'allow' && actionResult.action !== 'allow_with_warning') {
          await applyAutomaticAction(senderId, actionResult);
        }

        return result;
      }

      // Mensaje limpio
      return {
        isAllowed: true,
        confidence: 1.0
      };

    } catch (error) {
      console.error("❌ Error en moderación avanzada:", error);
      
      // Log error for debugging
      await logModerationError(senderId, chatId, message, error);
      
      // En caso de error, permitir el mensaje pero logear
      return {
        isAllowed: true,
        confidence: 0.0,
        reason: "Error en sistema de moderación"
      };
    }
  }
);

/**
 * 📊 Registrar violación de moderación
 */
async function recordModerationViolation(
  userId: string, 
  chatId: string, 
  violationData: any
) {
  try {
    const violationRef = db.collection("moderationViolations").doc();
    await violationRef.set({
      userId,
      chatId,
      ...violationData,
      id: violationRef.id
    });
  } catch (error) {
    console.error("Error registrando violación:", error);
  }
}

/**
 * 📈 Obtener historial de violaciones del usuario
 */
async function getUserViolationHistory(userId: string) {
  try {
    const last30Days = admin.firestore.Timestamp.fromMillis(
      Date.now() - (30 * 24 * 60 * 60 * 1000)
    );

    const violationsSnapshot = await db
      .collection("moderationViolations")
      .where("userId", "==", userId)
      .where("timestamp", ">=", last30Days)
      .orderBy("timestamp", "desc")
      .get();

    return violationsSnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("Error obteniendo historial:", error);
    return [];
  }
}

/**
 * ⚖️ Determinar acción automática
 */
async function determineAction(userId: string, severityScore: number, history: any[]) {
  const violationCount = history.length;
  const recentSevereViolations = history.filter(v => v.severityScore >= 3).length;
  
  // Severidad alta inmediata (teléfono/email)
  if (severityScore >= 3) {
    if (violationCount === 0) {
      return {
        action: 'allow_with_warning',
        reason: 'Primera violación detectada - Warning emitido',
        warningMessage: '⚠️ ADVERTENCIA: No compartas información de contacto. Próxima vez se aplicarán restricciones.'
      };
    } else if (violationCount === 1 || recentSevereViolations === 1) {
      return {
        action: 'temporary_block',
        reason: 'Segunda violación - Bloqueo temporal 24h',
        warningMessage: '🚫 BLOQUEADO: Intercambio de contacto detectado. Bloqueado por 24 horas.',
        blockDurationHours: 24
      };
    } else {
      return {
        action: 'suspension',
        reason: 'Múltiples violaciones - Suspensión para revisión manual',
        warningMessage: '🔒 SUSPENDIDO: Cuenta suspendida por violaciones repetidas. Contacta soporte.',
        requiresManualReview: true
      };
    }
  }
  
  // Severidad media (frases de evasión)
  if (severityScore >= 2) {
    if (violationCount < 2) {
      return {
        action: 'allow_with_warning',
        reason: 'Violación media - Warning preventivo',
        warningMessage: '⚠️ Evita frases que sugieran evadir la plataforma.'
      };
    } else {
      return {
        action: 'temporary_block',
        reason: 'Violaciones repetidas - Bloqueo temporal',
        warningMessage: '🚫 Bloqueado temporalmente por violaciones repetidas.',
        blockDurationHours: 12
      };
    }
  }

  // Severidad baja - solo warning
  return {
    action: 'allow_with_warning',
    reason: 'Violación menor detectada',
    warningMessage: '💡 Recuerda mantener la comunicación dentro de ServiMap.'
  };
}

/**
 * 🔨 Aplicar acción automática
 */
async function applyAutomaticAction(userId: string, actionResult: any) {
  try {
    const now = admin.firestore.Timestamp.now();
    
    if (actionResult.action === 'temporary_block') {
      const unblockAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + (actionResult.blockDurationHours * 60 * 60 * 1000)
      );
      
      await db.collection("userModerationStatus").doc(userId).set({
        status: 'temporarily_blocked',
        blockedAt: now,
        unblockAt,
        reason: actionResult.reason,
        blockType: 'chat_restriction'
      }, { merge: true });
      
      // Notificar al usuario
      await sendModerationNotification(userId, {
        type: 'temporary_block',
        message: actionResult.warningMessage,
        unblockAt: unblockAt.toMillis()
      });
      
    } else if (actionResult.action === 'suspension') {
      await db.collection("userModerationStatus").doc(userId).set({
        status: 'suspended',
        suspendedAt: now,
        reason: actionResult.reason,
        requiresManualReview: true
      }, { merge: true });
      
      // Notificar administradores
      await notifyAdministrators({
        type: 'user_suspended',
        userId,
        reason: actionResult.reason,
        requiresReview: true
      });
    }
    
    // Log de la acción
    await logModerationAction(userId, actionResult);
    
  } catch (error) {
    console.error("Error aplicando acción automática:", error);
  }
}

/**
 * 📧 Enviar notificación de moderación
 */
async function sendModerationNotification(userId: string, notification: any) {
  try {
    // En producción: enviar push notification y/o email
    console.log(`📧 Notificación de moderación enviada a ${userId}:`, notification);
    
    // Crear notificación en BD
    await db.collection("notifications").add({
      userId,
      type: 'moderation',
      ...notification,
      createdAt: admin.firestore.Timestamp.now(),
      read: false
    });
  } catch (error) {
    console.error("Error enviando notificación:", error);
  }
}

/**
 * 👨‍💼 Notificar administradores
 */
async function notifyAdministrators(alert: any) {
  try {
    console.log("🚨 Alerta para administradores:", alert);
    
    // Crear alerta en BD para dashboard de admin
    await db.collection("adminAlerts").add({
      ...alert,
      createdAt: admin.firestore.Timestamp.now(),
      resolved: false,
      priority: 'high'
    });
  } catch (error) {
    console.error("Error notificando administradores:", error);
  }
}

/**
 * 📝 Log de acción de moderación
 */
async function logModerationAction(userId: string, action: any) {
  try {
    await db.collection("moderationLogs").add({
      userId,
      action: action.action,
      reason: action.reason,
      timestamp: admin.firestore.Timestamp.now(),
      automated: true
    });
  } catch (error) {
    console.error("Error logging acción:", error);
  }
}

/**
 * 🐛 Log de errores de moderación
 */
async function logModerationError(userId: string, chatId: string, message: string, error: any) {
  try {
    await db.collection("moderationErrors").add({
      userId,
      chatId,
      message: message.substring(0, 100), // Primeros 100 chars
      error: error.message,
      timestamp: admin.firestore.Timestamp.now()
    });
  } catch (logError) {
    console.error("Error logging error de moderación:", logError);
  }
}

/**
 * 📝 getChatHistory
 * Obtiene historial completo del chat
 */
export const getChatHistory = onCall<{
  chatId: string;
  userId: string;
  limit?: number;
  before?: admin.firestore.Timestamp;
}>(
  async (request) => {
    const { chatId, userId, limit = 50, before } = request.data;

    try {
      // 1. Validar acceso al chat
      const chatDoc = await db.collection("chats").doc(chatId).get();
      if (!chatDoc.exists) {
        throw new HttpsError("not-found", "Chat no encontrado");
      }

      const chatData = chatDoc.data();
      // Verificar acceso usando nueva estructura participantIds
      if (!chatData?.participantIds?.includes(userId)) {
        throw new HttpsError("permission-denied", "No autorizado para este chat");
      }

      // 2. Obtener mensajes
      let query = db.collection("chatMessages")
        .where("chatId", "==", chatId)
        .orderBy("createdAt", "desc")
        .limit(limit);

      if (before) {
        query = query.where("createdAt", "<", before);
      }

      const messagesSnapshot = await query.get();
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 3. Marcar mensajes como leídos (nueva estructura array)
      const readTimestamp = admin.firestore.Timestamp.now();

      const batch = db.batch();
      messagesSnapshot.docs.forEach(doc => {
        const messageData = doc.data();
        if (!messageData.readBy?.includes(userId)) {
          batch.update(doc.ref, {
            readBy: admin.firestore.FieldValue.arrayUnion(userId)
          });
        }
      });

      await batch.commit();

      return {
        success: true,
        messages: messages.reverse(), // Ordenar cronológicamente
        hasMore: messagesSnapshot.docs.length === limit
      };

    } catch (error) {
      console.error("❌ Error obteniendo historial:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error obteniendo historial");
    }
  }
);

/**
 * 💬 sendChatMessage
 * Envía mensaje en el chat con validaciones
 */
export const sendChatMessage = onCall<{
  chatId: string;
  senderId: string;
  message: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'quotation';
  mediaUrl?: string;
}>(
  async (request) => {
    const { chatId, senderId, message, messageType, mediaUrl } = request.data;

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Validaciones de seguridad
      // Importar funciones de seguridad
      const { validateChatPermissions, checkRateLimit, encryptSensitiveMessage } = 
        await import("./securityFunctions");

      // Validar permisos
      const permissionCheck = await validateChatPermissions(chatId, senderId, 'write');
      if (!permissionCheck.allowed) {
        throw new HttpsError("permission-denied", permissionCheck.reason || "Sin permisos");
      }

      // Verificar rate limiting
      const rateLimitCheck = await checkRateLimit(senderId, 'message');
      if (!rateLimitCheck.allowed) {
        const resetTime = rateLimitCheck.resetTime ? new Date(rateLimitCheck.resetTime).toLocaleTimeString() : 'pronto';
        throw new HttpsError("resource-exhausted", `Límite de mensajes alcanzado. Intenta de nuevo a las ${resetTime}`);
      }

      // 2. Validar acceso al chat
      const chatDoc = await db.collection("chats").doc(chatId).get();
      if (!chatDoc.exists) {
        throw new HttpsError("not-found", "Chat no encontrado");
      }

      const chatData = chatDoc.data();
      // Verificar acceso usando nueva estructura participantIds
      if (!chatData?.participantIds?.includes(senderId)) {
        throw new HttpsError("permission-denied", "No autorizado para este chat");
      }

      // Determinar tipo de sender basado en participantIds
      const [userId, providerId] = chatData.participantIds;
      const senderType = senderId === userId ? 'user' : 'provider';
      const recipientId = senderId === userId ? providerId : userId;

      // 3. Moderar mensaje si es texto
      let moderationResult: any = { isAllowed: true, confidence: 1.0 };
      
      if (messageType === 'text') {
        try {
          const moderateChatWithAI = (await import("./chatFunctions")).moderateChatWithAI;
          const moderationRequest = await moderateChatWithAI.run({
            data: {
              chatId,
              senderId,
              message,
              messageType: 'text'
            }
          });
          
          moderationResult = moderationRequest;
        } catch (moderationError) {
          console.error("Error en moderación:", moderationError);
          // Continuar con mensaje si falla la moderación
        }

        if (!moderationResult.isAllowed) {
          throw new HttpsError("permission-denied", 
            moderationResult.warningMessage || "Mensaje no permitido por moderación"
          );
        }
      }

      // 4. Encriptar mensaje si contiene información sensible
      const encryptionResult = encryptSensitiveMessage(message, {
        messageType,
        chatId,
        senderId
      });

      // 5. Crear mensaje
      const messageRef = db.collection("chatMessages").doc();
      const chatMessage: ChatMessage = {
        chatId,
        senderId,
        messageType,
        content: encryptionResult.encrypted ? '[MENSAJE_ENCRIPTADO]' : message,
        mediaUrls: mediaUrl ? [mediaUrl] : undefined,
        isModerated: moderationResult.severityScore ? moderationResult.severityScore > 0 : false,
        moderationReason: moderationResult.reason,
        readBy: [senderId], // Nuevo formato array
        timestamp: now,
        // Campos de compatibilidad
        senderType,
        message: encryptionResult.encrypted ? '[MENSAJE_ENCRIPTADO]' : message,
        mediaUrl,
        // Campos de seguridad
        encrypted: encryptionResult.encrypted || false,
        encryptedContent: encryptionResult.encryptedContent,
        encryptionMethod: encryptionResult.encryptionMethod,
        moderationScore: moderationResult.severityScore || 0,
        rateLimitRemaining: rateLimitCheck.remaining
      };

      await messageRef.set(chatMessage);

      // 6. Actualizar chat con nueva estructura
      const lastMessageText = encryptionResult.encrypted ? 
        '🔒 Mensaje encriptado' : 
        message.substring(0, 100);

      await chatDoc.ref.update({
        lastMessage: {
          text: lastMessageText,
          senderId,
          timestamp: now
        },
        updatedAt: now,
        moderationFlags: moderationResult.severityScore ? 
          admin.firestore.FieldValue.increment(moderationResult.severityScore) : 
          chatData.moderationFlags || 0
      });

      // 7. Log de actividad de seguridad
      if (encryptionResult.encrypted || moderationResult.severityScore > 0) {
        await db.collection("securityActivityLogs").add({
          type: 'message_security_event',
          chatId,
          senderId,
          messageId: messageRef.id,
          encrypted: encryptionResult.encrypted,
          moderationScore: moderationResult.severityScore || 0,
          rateLimitStatus: {
            allowed: rateLimitCheck.allowed,
            remaining: rateLimitCheck.remaining
          },
          timestamp: now
        });
      }

      return {
        success: true,
        messageId: messageRef.id,
        timestamp: now.toMillis()
      };

    } catch (error) {
      console.error("❌ Error enviando mensaje:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error enviando mensaje");
    }
  }
);