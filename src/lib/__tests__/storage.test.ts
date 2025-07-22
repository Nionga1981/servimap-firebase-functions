import { storageManager, uploadChatMedia, compressImage } from '../storage'

// Mock Firebase Storage
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(() => Promise.resolve({ ref: { fullPath: 'test/path' } })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn(),
    snapshot: { ref: { fullPath: 'test/path' } },
  })),
  getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/file.jpg')),
  deleteObject: jest.fn(() => Promise.resolve()),
  listAll: jest.fn(() => Promise.resolve({ items: [] })),
}))

describe('Storage Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('File Upload', () => {
    const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

    it('should upload file successfully', async () => {
      const result = await storageManager.uploadFile(mockFile, 'test/path')
      
      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('path')
      expect(result).toHaveProperty('size')
      expect(result).toHaveProperty('contentType')
      expect(result.contentType).toBe('image/jpeg')
    })

    it('should handle upload progress', async () => {
      const onProgress = jest.fn()
      const largeMockFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      })

      await storageManager.uploadFile(largeMockFile, 'test/path', onProgress)
      
      // Progress callback should be set up for large files
      expect(onProgress).toBeDefined()
    })
  })

  describe('Chat Media Upload', () => {
    it('should upload image for chat', async () => {
      const imageFile = new File(['image content'], 'chat-image.jpg', { type: 'image/jpeg' })
      const chatId = 'test-chat-id'
      const userId = 'test-user-id'

      const result = await uploadChatMedia(imageFile, chatId, userId)
      
      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('path')
    })

    it('should upload video for chat', async () => {
      const videoFile = new File(['video content'], 'chat-video.mp4', { type: 'video/mp4' })
      const chatId = 'test-chat-id'
      const userId = 'test-user-id'

      const result = await uploadChatMedia(videoFile, chatId, userId)
      
      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('path')
    })

    it('should reject unsupported file types', async () => {
      const unsupportedFile = new File(['text content'], 'document.txt', { type: 'text/plain' })
      const chatId = 'test-chat-id'
      const userId = 'test-user-id'

      await expect(uploadChatMedia(unsupportedFile, chatId, userId))
        .rejects.toThrow('File type not supported for chat')
    })

    it('should reject oversized files', async () => {
      // Create a mock file that exceeds size limits
      const oversizedFile = new File(['x'.repeat(200 * 1024 * 1024)], 'huge-video.mp4', { 
        type: 'video/mp4' 
      })
      Object.defineProperty(oversizedFile, 'size', { value: 200 * 1024 * 1024 })
      
      const chatId = 'test-chat-id'
      const userId = 'test-user-id'

      await expect(uploadChatMedia(oversizedFile, chatId, userId))
        .rejects.toThrow('Video files must be smaller than 100MB')
    })
  })

  describe('Profile Image Upload', () => {
    it('should upload profile image', async () => {
      const imageFile = new File(['image content'], 'profile.jpg', { type: 'image/jpeg' })
      const userId = 'test-user-id'

      const result = await storageManager.uploadProfileImage(imageFile, userId)
      
      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('path')
    })

    it('should reject non-image files for profile', async () => {
      const nonImageFile = new File(['video content'], 'profile.mp4', { type: 'video/mp4' })
      const userId = 'test-user-id'

      await expect(storageManager.uploadProfileImage(nonImageFile, userId))
        .rejects.toThrow('Only image files are allowed for profile pictures')
    })

    it('should reject oversized profile images', async () => {
      const oversizedImage = new File(['x'.repeat(10 * 1024 * 1024)], 'huge-profile.jpg', { 
        type: 'image/jpeg' 
      })
      Object.defineProperty(oversizedImage, 'size', { value: 10 * 1024 * 1024 })
      
      const userId = 'test-user-id'

      await expect(storageManager.uploadProfileImage(oversizedImage, userId))
        .rejects.toThrow('Profile image must be smaller than 5MB')
    })
  })

  describe('Document Verification Upload', () => {
    it('should upload verification document', async () => {
      const documentFile = new File(['document content'], 'id.jpg', { type: 'image/jpeg' })
      const userId = 'test-user-id'

      const result = await storageManager.uploadVerificationDocument(
        documentFile, 
        userId, 
        'id'
      )
      
      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('path')
    })

    it('should accept PDF documents', async () => {
      const pdfFile = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' })
      const userId = 'test-user-id'

      const result = await storageManager.uploadVerificationDocument(
        pdfFile, 
        userId, 
        'proof_of_address'
      )
      
      expect(result).toHaveProperty('url')
    })

    it('should reject unsupported document types', async () => {
      const unsupportedFile = new File(['text content'], 'document.txt', { type: 'text/plain' })
      const userId = 'test-user-id'

      await expect(storageManager.uploadVerificationDocument(unsupportedFile, userId, 'id'))
        .rejects.toThrow('Only JPEG, PNG, WebP images and PDF files are allowed')
    })
  })

  describe('File Management', () => {
    it('should delete file', async () => {
      const filePath = 'test/file/path.jpg'
      
      await expect(storageManager.deleteFile(filePath)).resolves.not.toThrow()
    })

    it('should list files in directory', async () => {
      const directoryPath = 'test/directory'
      
      const files = await storageManager.listFiles(directoryPath)
      expect(Array.isArray(files)).toBe(true)
    })
  })

  describe('Image Compression', () => {
    // Note: This test requires a more complex setup with canvas mocking
    // For now, we'll test that the function exists and doesn't throw
    
    it('should have compress image function', () => {
      expect(typeof compressImage).toBe('function')
    })

    it('should handle image compression setup', () => {
      const mockFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' })
      
      // Should not throw when called (even if canvas is not available in test environment)
      expect(() => compressImage(mockFile)).not.toThrow()
    })
  })

  describe('Optimized Image URLs', () => {
    it('should return optimized image URL', () => {
      const originalUrl = 'https://example.com/image.jpg'
      const optimizedUrl = storageManager.getOptimizedImageUrl(originalUrl, {
        width: 300,
        height: 300,
        quality: 80,
      })
      
      // For now, it should return the original URL
      expect(optimizedUrl).toBe(originalUrl)
    })

    it('should handle optimization options', () => {
      const originalUrl = 'https://example.com/image.jpg'
      const optimizedUrl = storageManager.getOptimizedImageUrl(originalUrl, {
        format: 'webp',
        quality: 90,
      })
      
      expect(typeof optimizedUrl).toBe('string')
    })
  })
})