'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  Paperclip, 
  Image, 
  Camera, 
  Mic, 
  Video,
  Phone,
  MoreVertical,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useWebSocket, ChatMessage } from '../../lib/websocket';

interface RealTimeChatInterfaceProps {
  chatId: string;
  currentUserId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  onQuotationRequest?: () => void;
  onVideoCall?: () => void;
  onVoiceCall?: () => void;
}

const RealTimeChatInterface: React.FC<RealTimeChatInterfaceProps> = ({
  chatId,
  currentUserId,
  recipientId,
  recipientName,
  recipientAvatar,
  onQuotationRequest,
  onVideoCall,
  onVoiceCall
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [recipientTyping, setRecipientTyping] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    wsManager, 
    isConnected, 
    sendMessage, 
    onMessage, 
    offMessage, 
    joinChat, 
    leaveChat,
    sendTypingIndicator,
    markMessageAsRead 
  } = useWebSocket();

  // Join chat room on component mount
  useEffect(() => {
    if (isConnected && chatId && currentUserId) {
      joinChat(chatId, currentUserId);
      loadChatHistory();
    }

    return () => {
      if (chatId && currentUserId) {
        leaveChat(chatId, currentUserId);
      }
    };
  }, [isConnected, chatId, currentUserId]);

  // Set up message listener
  useEffect(() => {
    if (chatId) {
      onMessage(chatId, handleNewMessage);
      
      return () => {
        offMessage(chatId);
      };
    }
  }, [chatId]);

  // Set up event listeners for typing and online status
  useEffect(() => {
    wsManager.onChatEvent('typing', handleTypingEvent);
    wsManager.onChatEvent('user_status', handleUserStatusEvent);
    wsManager.onChatEvent('message_read', handleMessageReadEvent);

    return () => {
      wsManager.offChatEvent('typing');
      wsManager.offChatEvent('user_status');
      wsManager.offChatEvent('message_read');
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat/${chatId}/messages`);
      if (response.ok) {
        const chatHistory = await response.json();
        setMessages(chatHistory.messages || []);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleNewMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      // Avoid duplicates
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) return prev;
      
      return [...prev, message].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });

    // Mark as read if message is from recipient
    if (message.senderId === recipientId) {
      markMessageAsRead(chatId, message.id, currentUserId);
    }
  }, [chatId, currentUserId, recipientId]);

  const handleTypingEvent = useCallback((event: any) => {
    if (event.data.chatId === chatId && event.data.userId === recipientId) {
      setRecipientTyping(event.data.isTyping);
    }
  }, [chatId, recipientId]);

  const handleUserStatusEvent = useCallback((event: any) => {
    if (event.data.userId === recipientId) {
      setIsRecipientOnline(event.data.isOnline);
    }
  }, [recipientId]);

  const handleMessageReadEvent = useCallback((event: any) => {
    if (event.data.chatId === chatId) {
      // Update message read status
      setMessages(prev => prev.map(msg => 
        msg.id === event.data.messageId 
          ? { ...msg, isRead: true }
          : msg
      ));
    }
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;

    const messageData: Omit<ChatMessage, 'id' | 'timestamp'> = {
      chatId,
      senderId: currentUserId,
      content: newMessage.trim(),
      messageType: 'text',
      isModerated: false
    };

    try {
      const sentMessage = sendMessage(messageData);
      
      // Optimistically add message to UI
      if (sentMessage) {
        setMessages(prev => [...prev, sentMessage as ChatMessage]);
      }
      
      setNewMessage('');
      
      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        sendTypingIndicator(chatId, currentUserId, false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error toast
      alert('Error enviando mensaje. Inténtalo de nuevo.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(chatId, currentUserId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(chatId, currentUserId, false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    
    try {
      // Upload file to Firebase Storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);

      const uploadResponse = await fetch('/api/chat/upload-media', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { mediaUrl } = await uploadResponse.json();

      // Send message with media
      const messageData: Omit<ChatMessage, 'id' | 'timestamp'> = {
        chatId,
        senderId: currentUserId,
        content: file.name,
        messageType: file.type.startsWith('image/') ? 'image' : 
                    file.type.startsWith('video/') ? 'video' : 'audio',
        mediaUrls: [mediaUrl],
        isModerated: false
      };

      const sentMessage = sendMessage(messageData);
      if (sentMessage) {
        setMessages(prev => [...prev, sentMessage as ChatMessage]);
      }

    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Error subiendo archivo. Inténtalo de nuevo.');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatMessageTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageStatus = (message: ChatMessage) => {
    if (message.senderId !== currentUserId) return null;
    
    if (message.isRead) {
      return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    }
    
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={recipientAvatar || '/default-avatar.png'}
              alt={recipientName}
              className="w-10 h-10 rounded-full"
            />
            {isRecipientOnline && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{recipientName}</h3>
            <div className="flex items-center space-x-2 text-sm">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`${isRecipientOnline ? 'text-green-600' : 'text-gray-500'}`}>
                {recipientTyping ? 'Escribiendo...' : 
                 isRecipientOnline ? 'En línea' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onVoiceCall && (
            <button
              onClick={onVoiceCall}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Phone className="w-5 h-5" />
            </button>
          )}
          {onVideoCall && (
            <button
              onClick={onVideoCall}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Video className="w-5 h-5" />
            </button>
          )}
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="flex items-center justify-center p-2 bg-yellow-50 border-b border-yellow-200">
          <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
          <span className="text-sm text-yellow-800">
            Conectando... Los mensajes se enviarán cuando se restablezca la conexión.
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.senderId === currentUserId
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              } ${message.isModerated ? 'opacity-50 border-2 border-red-300' : ''}`}
            >
              {message.messageType === 'text' && (
                <p className="text-sm">{message.content}</p>
              )}
              
              {message.messageType === 'image' && message.mediaUrls && (
                <div>
                  <img
                    src={message.mediaUrls[0]}
                    alt="Imagen compartida"
                    className="max-w-full h-auto rounded-lg mb-1"
                  />
                  {message.content && (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              )}
              
              {message.messageType === 'video' && message.mediaUrls && (
                <div>
                  <video
                    src={message.mediaUrls[0]}
                    controls
                    className="max-w-full h-auto rounded-lg mb-1"
                  />
                  {message.content && (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              )}

              <div className={`flex items-center justify-between mt-1 ${
                message.senderId === currentUserId ? 'text-blue-100' : 'text-gray-500'
              }`}>
                <span className="text-xs">
                  {formatMessageTime(message.timestamp)}
                </span>
                {getMessageStatus(message)}
              </div>
              
              {message.isModerated && (
                <div className="mt-1 text-xs text-red-600">
                  ⚠️ Mensaje moderado
                </div>
              )}
            </div>
          </div>
        ))}
        
        {recipientTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-xs text-gray-500 ml-2">escribiendo...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t p-4">
        <div className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingMedia}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingMedia}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <Image className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Escribe un mensaje..." : "Sin conexión..."}
              disabled={!isConnected || uploadingMedia}
              className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected || uploadingMedia}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
          
          {onQuotationRequest && (
            <button
              onClick={onQuotationRequest}
              className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors text-sm font-medium"
            >
              💰 Cotizar
            </button>
          )}
        </div>
        
        {uploadingMedia && (
          <div className="mt-2 text-sm text-gray-600 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            Subiendo archivo...
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeChatInterface;