import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  Camera, 
  Video, 
  Phone, 
  MoreVertical,
  AlertTriangle,
  Clock,
  CheckCircle,
  Circle,
  Paperclip,
  Smile
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import MediaUploader from './MediaUploader';
import QuotationViewer from './QuotationViewer';
import VideoCallInterface from './VideoCallInterface';

const ChatInterface = ({ 
  chatId, 
  userId, 
  userType, // 'user' | 'provider'
  onQuotationCreate,
  onVideoCallStart,
  onServiceRequest 
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [moderationWarning, setModerationWarning] = useState('');
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [quotations, setQuotations] = useState([]);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll al final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cargar historial del chat
  useEffect(() => {
    loadChatHistory();
    const interval = setInterval(loadChatHistory, 3000); // Polling cada 3s
    return () => clearInterval(interval);
  }, [chatId]);

  const loadChatHistory = async () => {
    try {
      const getChatHistory = firebase.functions().httpsCallable('getChatHistory');
      const result = await getChatHistory({
        chatId,
        userId,
        limit: 50
      });

      if (result.data.success) {
        setMessages(result.data.messages);
        
        // Extraer cotizaciones de los mensajes
        const quotationMessages = result.data.messages.filter(
          msg => msg.messageType === 'quotation' && msg.quotationId
        );
        
        if (quotationMessages.length > 0) {
          await loadQuotations(quotationMessages.map(m => m.quotationId));
        }
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
      setError('Error cargando mensajes');
    }
  };

  const loadQuotations = async (quotationIds) => {
    try {
      // En producción: llamar a función para obtener cotizaciones
      // Por ahora simular datos
      const mockQuotations = quotationIds.map(id => ({
        id,
        totalAmount: 250.00,
        status: 'pending',
        items: [
          { description: 'Diagnóstico', quantity: 1, unitPrice: 50, total: 50 },
          { description: 'Reparación', quantity: 1, unitPrice: 200, total: 200 }
        ],
        estimatedTime: '2-3 horas',
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }));
      
      setQuotations(mockQuotations);
    } catch (err) {
      console.error('Error cargando cotizaciones:', err);
    }
  };

  // Moderar mensaje en tiempo real
  const moderateMessage = async (message) => {
    if (!message.trim()) return { isAllowed: true };

    try {
      const moderateChatWithAI = firebase.functions().httpsCallable('moderateChatWithAI');
      const result = await moderateChatWithAI({
        chatId,
        senderId: userId,
        message,
        messageType: 'text'
      });

      return result.data;
    } catch (err) {
      console.error('Error en moderación:', err);
      return { isAllowed: true }; // Permitir en caso de error
    }
  };

  // Enviar mensaje
  const sendMessage = async () => {
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    setModerationWarning('');

    try {
      // Moderar mensaje primero
      const moderationResult = await moderateMessage(newMessage);
      
      if (!moderationResult.isAllowed) {
        setModerationWarning(moderationResult.warningMessage || 'Mensaje no permitido');
        setLoading(false);
        return;
      }

      // Enviar mensaje
      const sendChatMessage = firebase.functions().httpsCallable('sendChatMessage');
      const result = await sendChatMessage({
        chatId,
        senderId: userId,
        message: newMessage,
        messageType: 'text'
      });

      if (result.data.success) {
        setNewMessage('');
        await loadChatHistory(); // Recargar mensajes
      }
    } catch (err) {
      console.error('Error enviando mensaje:', err);
      setError('Error enviando mensaje: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejar Enter para enviar
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Detectar escritura
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    setModerationWarning('');
    
    // Simular indicador de escritura
    setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  // Iniciar videollamada
  const startVideoCall = async () => {
    try {
      const initiateVideoCall = firebase.functions().httpsCallable('initiateVideoCall');
      const otherUserId = userType === 'user' ? 'provider_id' : 'user_id'; // En producción obtener del chat
      
      const result = await initiateVideoCall({
        chatId,
        initiatorId: userId,
        recipientId: otherUserId
      });

      if (result.data.success) {
        setActiveVideoCall({
          roomId: result.data.roomId,
          callLink: result.data.callLink,
          expiresAt: result.data.expiresAt
        });
        
        if (onVideoCallStart) {
          onVideoCallStart(result.data);
        }
      }
    } catch (err) {
      console.error('Error iniciando videollamada:', err);
      setError('Error iniciando videollamada');
    }
  };

  // Renderizar mensaje individual
  const renderMessage = (message, index) => {
    const isOwn = message.senderId === userId;
    const isSystem = message.senderType === 'system';
    const isQuotation = message.messageType === 'quotation';
    
    // Buscar cotización si es mensaje de cotización
    const quotation = isQuotation ? quotations.find(q => q.id === message.quotationId) : null;

    return (
      <div
        key={message.id || index}
        className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'} ${isSystem ? 'justify-center' : ''}`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            isSystem 
              ? 'bg-gray-100 text-gray-600 text-sm italic'
              : isOwn 
                ? 'bg-[#3ce923] text-white' 
                : 'bg-gray-100 text-gray-800'
          }`}
        >
          {/* Mensaje de cotización */}
          {isQuotation && quotation && (
            <QuotationViewer 
              quotation={quotation}
              userType={userType}
              onAccept={() => onQuotationAccept(quotation.id)}
              onReject={() => onQuotationReject(quotation.id)}
              onNegotiate={(amount) => onQuotationNegotiate(quotation.id, amount)}
              compact={true}
            />
          )}
          
          {/* Mensaje de texto */}
          {!isQuotation && (
            <>
              <p className="text-sm">{message.content || message.message}</p>
              
              {/* Media attachments */}
              {message.mediaUrls && message.mediaUrls.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.mediaUrls.map((url, idx) => (
                    <div key={idx}>
                      {message.messageType === 'image' && (
                        <img 
                          src={url} 
                          alt="Imagen compartida"
                          className="max-w-full h-32 object-cover rounded border"
                        />
                      )}
                      {message.messageType === 'video' && (
                        <video 
                          src={url} 
                          controls
                          className="max-w-full h-32 rounded border"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Timestamp y estado */}
              <div className={`flex items-center justify-between mt-1 text-xs ${
                isOwn ? 'text-green-100' : 'text-gray-500'
              }`}>
                <span>
                  {new Date(message.timestamp?.toMillis() || message.createdAt?.toMillis()).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                
                {isOwn && (
                  <div className="flex space-x-1">
                    {message.readBy?.length > 1 ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Manejar acciones de cotización
  const onQuotationAccept = async (quotationId) => {
    try {
      const acceptRejectQuotation = firebase.functions().httpsCallable('acceptRejectQuotation');
      const result = await acceptRejectQuotation({
        quotationId,
        userId,
        action: 'accept'
      });

      if (result.data.success && onServiceRequest) {
        onServiceRequest(result.data.serviceRequestId);
      }
      
      await loadChatHistory();
    } catch (err) {
      console.error('Error aceptando cotización:', err);
      setError('Error aceptando cotización');
    }
  };

  const onQuotationReject = async (quotationId) => {
    try {
      const acceptRejectQuotation = firebase.functions().httpsCallable('acceptRejectQuotation');
      await acceptRejectQuotation({
        quotationId,
        userId,
        action: 'reject'
      });
      
      await loadChatHistory();
    } catch (err) {
      console.error('Error rechazando cotización:', err);
      setError('Error rechazando cotización');
    }
  };

  const onQuotationNegotiate = async (quotationId, counterOffer) => {
    try {
      const acceptRejectQuotation = firebase.functions().httpsCallable('acceptRejectQuotation');
      await acceptRejectQuotation({
        quotationId,
        userId,
        action: 'negotiate',
        counterOffer
      });
      
      await loadChatHistory();
    } catch (err) {
      console.error('Error negociando cotización:', err);
      setError('Error enviando contraoferta');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header del chat */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-[#ac7afc] rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {userType === 'user' ? 'P' : 'U'}
              </span>
            </div>
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              isOnline ? 'bg-[#3ce923]' : 'bg-gray-400'
            }`}></div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900">
              {userType === 'user' ? 'Prestador' : 'Usuario'}
            </h3>
            <p className="text-sm text-gray-500">
              {isOnline ? 'En línea' : 'Desconectado'}
              {isTyping && ' • escribiendo...'}
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={startVideoCall}
            className="text-[#60cdff] border-[#60cdff] hover:bg-blue-50"
          >
            <Video className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Área de mensajes */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#ac7afc] rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Inicia la conversación!
            </h3>
            <p className="text-gray-600">
              {userType === 'provider' 
                ? 'Envía una cotización detallada al usuario'
                : 'Describe tu problema y envía fotos si es necesario'
              }
            </p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive" className="mx-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {moderationWarning && (
        <Alert className="mx-4 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {moderationWarning}
          </AlertDescription>
        </Alert>
      )}

      {/* Input area */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-end space-x-2">
          {/* Botón de archivos */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMediaUploader(true)}
            className="mb-2"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* Botón de cámara */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMediaUploader(true)}
            className="mb-2"
          >
            <Camera className="w-4 h-4" />
          </Button>

          {/* Input de texto */}
          <div className="flex-1">
            <Input
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Escribe un mensaje..."
              disabled={loading}
              className="min-h-10"
              multiline
            />
          </div>

          {/* Botón enviar */}
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || loading}
            className="bg-[#3ce923] hover:bg-green-600 mb-2"
          >
            <Send className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
          </Button>

          {/* Botón cotización (solo providers) */}
          {userType === 'provider' && (
            <Button
              onClick={onQuotationCreate}
              className="bg-[#FFD700] hover:bg-yellow-500 text-black mb-2"
            >
              Cotizar
            </Button>
          )}
        </div>
      </div>

      {/* Media Uploader Modal */}
      {showMediaUploader && (
        <MediaUploader
          chatId={chatId}
          userId={userId}
          onClose={() => setShowMediaUploader(false)}
          onUploadComplete={loadChatHistory}
        />
      )}

      {/* Video Call Interface */}
      {activeVideoCall && (
        <VideoCallInterface
          roomId={activeVideoCall.roomId}
          userId={userId}
          onCallEnd={() => setActiveVideoCall(null)}
        />
      )}
    </div>
  );
};

export default ChatInterface;