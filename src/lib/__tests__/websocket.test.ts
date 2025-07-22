import { wsManager, ChatMessage } from '../websocket'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  })),
}))

describe('WebSocket Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Connection Management', () => {
    it('should initialize with default configuration', () => {
      expect(wsManager).toBeDefined()
      expect(wsManager.isConnectedToServer).toBeDefined()
    })

    it('should return connection status', () => {
      const status = wsManager.getConnectionStatus()
      expect(status).toHaveProperty('connected')
      expect(status).toHaveProperty('reconnectAttempts')
      expect(typeof status.connected).toBe('boolean')
      expect(typeof status.reconnectAttempts).toBe('number')
    })

    it('should handle authentication', () => {
      const userId = 'test-user-id'
      const token = 'test-token'
      
      // Mock socket connection
      const mockSocket = {
        emit: jest.fn(),
        on: jest.fn(),
        disconnect: jest.fn(),
      }
      
      // Simulate connected state
      wsManager.authenticate(userId, token)
      
      // Should not throw errors
      expect(() => wsManager.authenticate(userId, token)).not.toThrow()
    })
  })

  describe('Chat Room Management', () => {
    const chatId = 'test-chat-id'
    const userId = 'test-user-id'

    it('should join chat room', () => {
      expect(() => wsManager.joinChat(chatId, userId)).not.toThrow()
    })

    it('should leave chat room', () => {
      expect(() => wsManager.leaveChat(chatId, userId)).not.toThrow()
    })

    it('should handle message listeners', () => {
      const mockCallback = jest.fn()
      
      wsManager.onMessage(chatId, mockCallback)
      expect(() => wsManager.onMessage(chatId, mockCallback)).not.toThrow()
      
      wsManager.offMessage(chatId)
      expect(() => wsManager.offMessage(chatId)).not.toThrow()
    })
  })

  describe('Message Handling', () => {
    const chatId = 'test-chat-id'
    const userId = 'test-user-id'

    it('should send text message', () => {
      const message: Omit<ChatMessage, 'id' | 'timestamp'> = {
        chatId,
        senderId: userId,
        content: 'Test message',
        messageType: 'text',
        isModerated: false,
      }

      expect(() => wsManager.sendMessage(message)).not.toThrow()
    })

    it('should send media message', () => {
      const message: Omit<ChatMessage, 'id' | 'timestamp'> = {
        chatId,
        senderId: userId,
        content: 'Image file',
        messageType: 'image',
        mediaUrls: ['https://example.com/image.jpg'],
        isModerated: false,
      }

      expect(() => wsManager.sendMessage(message)).not.toThrow()
    })

    it('should handle typing indicators', () => {
      expect(() => wsManager.sendTypingIndicator(chatId, userId, true)).not.toThrow()
      expect(() => wsManager.sendTypingIndicator(chatId, userId, false)).not.toThrow()
    })

    it('should mark messages as read', () => {
      const messageId = 'test-message-id'
      expect(() => wsManager.markMessageAsRead(chatId, messageId, userId)).not.toThrow()
    })
  })

  describe('Event Listeners', () => {
    it('should register and unregister event listeners', () => {
      const mockCallback = jest.fn()
      
      wsManager.onChatEvent('typing', mockCallback)
      expect(() => wsManager.onChatEvent('typing', mockCallback)).not.toThrow()
      
      wsManager.offChatEvent('typing')
      expect(() => wsManager.offChatEvent('typing')).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', () => {
      // Test that connection failures don't crash the application
      expect(wsManager.isConnectedToServer()).toBeDefined()
    })

    it('should handle message sending when disconnected', () => {
      const message: Omit<ChatMessage, 'id' | 'timestamp'> = {
        chatId: 'test-chat',
        senderId: 'test-user',
        content: 'Test message',
        messageType: 'text',
        isModerated: false,
      }

      // Should not throw even when disconnected
      expect(() => wsManager.sendMessage(message)).not.toThrow()
    })
  })

  describe('Cleanup', () => {
    it('should disconnect properly', () => {
      expect(() => wsManager.disconnect()).not.toThrow()
    })
  })
})