// WebSocket client for real-time chat functionality
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'quotation';
  timestamp: Date;
  isModerated: boolean;
  mediaUrls?: string[];
  quotationId?: string;
}

export interface ChatEvent {
  type: 'message' | 'typing' | 'user_joined' | 'user_left' | 'message_read';
  data: any;
  chatId: string;
  userId: string;
}

class WebSocketManager {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private chatListeners: Map<string, (message: ChatMessage) => void> = new Map();
  private eventListeners: Map<string, (event: ChatEvent) => void> = new Map();

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // In production, this would be your WebSocket server URL
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      
      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      this.handleConnectionError();
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason);
      this.isConnected = false;
      this.handleDisconnection(reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.handleConnectionError();
    });

    // Chat message events
    this.socket.on('new_message', (message: ChatMessage) => {
      this.handleNewMessage(message);
    });

    this.socket.on('message_updated', (message: ChatMessage) => {
      this.handleMessageUpdate(message);
    });

    this.socket.on('typing_indicator', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      this.handleTypingIndicator(data);
    });

    this.socket.on('user_online_status', (data: { userId: string; isOnline: boolean }) => {
      this.handleUserOnlineStatus(data);
    });

    this.socket.on('message_read', (data: { chatId: string; messageId: string; userId: string }) => {
      this.handleMessageRead(data);
    });

    // Moderation events
    this.socket.on('message_moderated', (data: { chatId: string; messageId: string; reason: string }) => {
      this.handleMessageModerated(data);
    });
  }

  private handleConnectionError() {
    this.reconnectAttempts++;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Falling back to polling mode.');
      this.enablePollingFallback();
    }
  }

  private handleDisconnection(reason: string) {
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, try to reconnect
      setTimeout(() => {
        this.connect();
      }, 2000);
    }
  }

  private enablePollingFallback() {
    // Fallback to HTTP polling for chat updates
    console.log('🔄 Enabling polling fallback for chat updates');
    // This would implement periodic API calls to check for new messages
  }

  // Public API methods

  public authenticate(userId: string, token: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('authenticate', { userId, token });
    }
  }

  public joinChat(chatId: string, userId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_chat', { chatId, userId });
      console.log(`🏠 Joined chat room: ${chatId}`);
    }
  }

  public leaveChat(chatId: string, userId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_chat', { chatId, userId });
      console.log(`🚪 Left chat room: ${chatId}`);
    }
  }

  public sendMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>) {
    if (this.socket && this.isConnected) {
      const messageWithTimestamp = {
        ...message,
        id: `temp_${Date.now()}`, // Temporary ID until server confirms
        timestamp: new Date(),
      };

      this.socket.emit('send_message', messageWithTimestamp);
      return messageWithTimestamp;
    } else {
      console.warn('⚠️ WebSocket not connected. Message will be sent via HTTP.');
      return this.sendMessageViaHTTP(message);
    }
  }

  private async sendMessageViaHTTP(message: Omit<ChatMessage, 'id' | 'timestamp'>) {
    try {
      const response = await fetch('/api/chat/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error('Failed to send message via HTTP');
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  public sendTypingIndicator(chatId: string, userId: string, isTyping: boolean) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { chatId, userId, isTyping });
    }
  }

  public markMessageAsRead(chatId: string, messageId: string, userId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_read', { chatId, messageId, userId });
    }
  }

  // Event listeners

  public onMessage(chatId: string, callback: (message: ChatMessage) => void) {
    this.chatListeners.set(chatId, callback);
  }

  public offMessage(chatId: string) {
    this.chatListeners.delete(chatId);
  }

  public onChatEvent(eventType: string, callback: (event: ChatEvent) => void) {
    this.eventListeners.set(eventType, callback);
  }

  public offChatEvent(eventType: string) {
    this.eventListeners.delete(eventType);
  }

  // Private event handlers

  private handleNewMessage(message: ChatMessage) {
    const listener = this.chatListeners.get(message.chatId);
    if (listener) {
      listener(message);
    }
  }

  private handleMessageUpdate(message: ChatMessage) {
    // Handle message updates (edits, moderation, etc.)
    const listener = this.chatListeners.get(message.chatId);
    if (listener) {
      listener(message);
    }
  }

  private handleTypingIndicator(data: { chatId: string; userId: string; isTyping: boolean }) {
    const listener = this.eventListeners.get('typing');
    if (listener) {
      listener({
        type: 'typing',
        data,
        chatId: data.chatId,
        userId: data.userId,
      });
    }
  }

  private handleUserOnlineStatus(data: { userId: string; isOnline: boolean }) {
    const listener = this.eventListeners.get('user_status');
    if (listener) {
      listener({
        type: 'user_joined',
        data,
        chatId: '',
        userId: data.userId,
      });
    }
  }

  private handleMessageRead(data: { chatId: string; messageId: string; userId: string }) {
    const listener = this.eventListeners.get('message_read');
    if (listener) {
      listener({
        type: 'message_read',
        data,
        chatId: data.chatId,
        userId: data.userId,
      });
    }
  }

  private handleMessageModerated(data: { chatId: string; messageId: string; reason: string }) {
    console.warn('🤖 Message moderated:', data);
    const listener = this.eventListeners.get('moderation');
    if (listener) {
      listener({
        type: 'message',
        data,
        chatId: data.chatId,
        userId: '',
      });
    }
  }

  // Utility methods

  public isConnectedToServer(): boolean {
    return this.isConnected;
  }

  public getConnectionStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// React hook for using WebSocket in components
export const useWebSocket = () => {
  return {
    wsManager,
    isConnected: wsManager.isConnectedToServer(),
    sendMessage: wsManager.sendMessage.bind(wsManager),
    onMessage: wsManager.onMessage.bind(wsManager),
    offMessage: wsManager.offMessage.bind(wsManager),
    joinChat: wsManager.joinChat.bind(wsManager),
    leaveChat: wsManager.leaveChat.bind(wsManager),
    sendTypingIndicator: wsManager.sendTypingIndicator.bind(wsManager),
    markMessageAsRead: wsManager.markMessageAsRead.bind(wsManager),
  };
};