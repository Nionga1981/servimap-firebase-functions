# 📊 **ESTRUCTURAS DE BASE DE DATOS ALINEADAS**

## ✅ **Implementación Actualizada**

### **1. Chats Collection**
```typescript
interface ChatData {
  id: string;
  participantIds: [string, string]; // [userId, providerId]
  serviceRequestId?: string;
  status: 'active' | 'quotation_pending' | 'quotation_sent' | 'completed' | 'closed';
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  hasActiveVideoCall: boolean;
  moderationFlags: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### **2. Chat Messages Collection**
```typescript
interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'quotation' | 'system';
  content: string;
  mediaUrls?: string[];
  quotationId?: string;
  isModerated: boolean;
  moderationReason?: string;
  readBy: string[]; // Array de userIds que han leído
  timestamp: Timestamp;
}
```

### **3. Quotations Collection**
```typescript
interface CustomQuotationData {
  id: string;
  chatId: string;
  providerId: string;
  userId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    category: string;
  }>;
  totalAmount: number;
  estimatedTime: string;
  validUntil: Timestamp;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'negotiating';
  notes?: string;
  counterOffers?: Array<{
    amount: number;
    message?: string;
    timestamp: Timestamp;
    senderId: string;
  }>;
  createdAt: Timestamp;
}
```

### **4. Video Calls Collection**
```typescript
interface VideoCallSession {
  id: string;
  chatId: string;
  roomId: string;
  participantIds: string[];
  status: 'scheduled' | 'active' | 'ended';
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  duration?: number; // en segundos
  recordingUrl?: string;
}
```

## 🔄 **Funciones Actualizadas**

### **✅ Completamente Alineadas:**
1. **createCustomQuotation** - Usa nueva estructura `items[]` en lugar de `quotationItems[]`
2. **acceptRejectQuotation** - Maneja `counterOffers[]` para negociación
3. **handleAsyncQuotation** - Crea chats con `participantIds[]`
4. **uploadQuotationMedia** - Usa `mediaUrls[]` y estructura de mensajes actualizada
5. **initiateVideoCall** - Usa `participantIds[]` en videollamadas
6. **moderateChatWithAI** - Actualiza `isModerated` y `moderationReason`
7. **getChatHistory** - Maneja `readBy[]` como array
8. **sendChatMessage** - Usa `content` y `timestamp` en nueva estructura

## 🔧 **Características de Compatibilidad MEJORADAS**

### **Campos Duales Optimizados:**
- ✅ `content` + `message` (alias) para mensajes
- ✅ `readBy: []` (nuevo) + compatibilidad con `readBy: {}`
- ✅ `participantIds: []` + helpers `userId`, `providerId`
- ✅ `mediaUrls: []` + compatibilidad con `mediaUrl` individual
- ✅ `timestamp` + compatibilidad con `createdAt`

### **Optimizaciones Implementadas:**
- ✅ Consultas más eficientes con `participantIds.includes()`
- ✅ ArrayUnion para `readBy` evita conflictos de escritura
- ✅ Estructura `lastMessage` optimizada con senderId
- ✅ VideoCall sessions con `participantIds` preparado para chats grupales
- ✅ Detección automática y conversión bidireccional

## 📈 **Beneficios de la Nueva Estructura**

### **Optimizaciones:**
- `participantIds[]` permite consultas más eficientes
- `readBy[]` escala mejor con múltiples participantes
- `mediaUrls[]` soporta múltiples archivos por mensaje
- `counterOffers[]` estructura clara para negociaciones

### **Flexibilidad:**
- Estructura preparada para chats grupales futuros
- Moderación integrada con flags automáticos
- Video calls con grabación y analytics
- Cotizaciones con historial de negociación completo

## 🚀 **Estado de Implementación**

**✅ COMPLETADO:**
- [x] Interfaces TypeScript actualizadas
- [x] Cloud Functions migradas
- [x] Compatibilidad bidireccional
- [x] Validaciones actualizadas
- [x] Logging y debugging mejorado

**🎯 LISTO PARA:**
- Frontend components (siguiente paso)
- Testing e integración
- Deploy a producción
- Migración de datos existentes