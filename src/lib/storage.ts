// Firebase Storage utilities for file uploads
import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll,
  UploadTaskSnapshot 
} from 'firebase/storage';
import { storage } from './firebase';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  contentType: string;
}

class StorageManager {
  // Upload file with progress tracking
  async uploadFile(
    file: File,
    path: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const fullPath = `${path}/${fileName}`;
      const storageRef = ref(storage, fullPath);

      // Use resumable upload for files larger than 1MB
      if (file.size > 1024 * 1024) {
        return this.uploadWithProgress(file, storageRef, onProgress);
      } else {
        return this.uploadDirect(file, storageRef);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  private async uploadWithProgress(
    file: File,
    storageRef: any,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          if (onProgress) {
            const progress: UploadProgress = {
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            };
            onProgress(progress);
          }
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadURL,
              path: storageRef.fullPath,
              size: file.size,
              contentType: file.type
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  private async uploadDirect(file: File, storageRef: any): Promise<UploadResult> {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return {
      url: downloadURL,
      path: storageRef.fullPath,
      size: file.size,
      contentType: file.type
    };
  }

  // Upload chat media (images, videos, audio)
  async uploadChatMedia(
    file: File,
    chatId: string,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate file type and size
    this.validateChatFile(file);
    
    const path = `chat/${chatId}/${userId}`;
    return this.uploadFile(file, path, onProgress);
  }

  // Upload user profile images
  async uploadProfileImage(
    file: File,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate image file
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed for profile pictures');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error('Profile image must be smaller than 5MB');
    }

    const path = `profiles/${userId}`;
    return this.uploadFile(file, path, onProgress);
  }

  // Upload document verification files
  async uploadVerificationDocument(
    file: File,
    userId: string,
    documentType: 'id' | 'proof_of_address' | 'license',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate document file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, WebP images and PDF files are allowed for verification documents');
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Document file must be smaller than 10MB');
    }

    const path = `verification/${userId}/${documentType}`;
    return this.uploadFile(file, path, onProgress);
  }

  // Upload business portfolio images
  async uploadPortfolioImage(
    file: File,
    providerId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate image file
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed for portfolio');
    }

    if (file.size > 8 * 1024 * 1024) { // 8MB limit
      throw new Error('Portfolio image must be smaller than 8MB');
    }

    const path = `portfolios/${providerId}`;
    return this.uploadFile(file, path, onProgress);
  }

  // Upload service quotation attachments
  async uploadQuotationAttachment(
    file: File,
    quotationId: string,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate file
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'video/mp4', 'video/webm'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not allowed for quotation attachments');
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('Attachment file must be smaller than 50MB');
    }

    const path = `quotations/${quotationId}/${userId}`;
    return this.uploadFile(file, path, onProgress);
  }

  // Delete file from storage
  async deleteFile(filePath: string): Promise<void> {
    try {
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      console.log('File deleted successfully:', filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  // List files in a directory
  async listFiles(path: string): Promise<string[]> {
    try {
      const storageRef = ref(storage, path);
      const result = await listAll(storageRef);
      
      const urls = await Promise.all(
        result.items.map(item => getDownloadURL(item))
      );
      
      return urls;
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${(error as Error).message}`);
    }
  }

  // Validate chat file
  private validateChatFile(file: File): void {
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      // Videos
      'video/mp4', 'video/webm', 'video/quicktime',
      // Audio
      'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not supported for chat. Supported: Images, Videos, Audio');
    }

    // Size limits by type
    if (file.type.startsWith('image/') && file.size > 10 * 1024 * 1024) { // 10MB for images
      throw new Error('Image files must be smaller than 10MB');
    }

    if (file.type.startsWith('video/') && file.size > 100 * 1024 * 1024) { // 100MB for videos
      throw new Error('Video files must be smaller than 100MB');
    }

    if (file.type.startsWith('audio/') && file.size > 25 * 1024 * 1024) { // 25MB for audio
      throw new Error('Audio files must be smaller than 25MB');
    }
  }

  // Get optimized image URL with transformations
  getOptimizedImageUrl(originalUrl: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}): string {
    // This would typically use Firebase's image transformation service
    // or a CDN like Cloudinary for optimization
    
    // For now, return original URL
    // In production, you would implement image transformations
    return originalUrl;
  }

  // Upload logo for businesses or providers
  async uploadLogo(
    file: File,
    type: 'prestador' | 'negocio',
    id: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate logo file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Solo se permiten archivos de imagen (JPEG, PNG, WebP, SVG) para logos');
    }

    if (file.size > 1 * 1024 * 1024) { // 1MB limit for logos
      throw new Error('El logo debe ser menor a 1MB');
    }

    // Compress image if it's not SVG
    let processedFile = file;
    if (file.type !== 'image/svg+xml') {
      processedFile = await this.compressImage(file, 512, 0.9); // Max 512px for logos
    }

    // Determine path based on type
    const basePath = type === 'prestador' ? 'prestadores/logos' : 'negociosFijos/logos';
    const fileName = `${id}.${this.getFileExtension(processedFile.type)}`;
    const fullPath = `${basePath}/${fileName}`;
    
    // Delete existing logo if any
    try {
      await this.deleteFile(fullPath);
    } catch (error) {
      // Ignore error if file doesn't exist
      console.log('No existing logo to delete');
    }

    // Upload new logo
    const storageRef = ref(storage, fullPath);
    const result = await this.uploadDirect(processedFile, storageRef);
    
    return result;
  }

  // Helper function to get file extension from MIME type
  private getFileExtension(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    return mimeToExt[mimeType] || 'png';
  }

  // Compress image before upload
  async compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        }, file.type, quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

// Singleton instance
export const storageManager = new StorageManager();

// Convenience functions
export const uploadChatMedia = storageManager.uploadChatMedia.bind(storageManager);
export const uploadProfileImage = storageManager.uploadProfileImage.bind(storageManager);
export const uploadVerificationDocument = storageManager.uploadVerificationDocument.bind(storageManager);
export const uploadPortfolioImage = storageManager.uploadPortfolioImage.bind(storageManager);
export const uploadQuotationAttachment = storageManager.uploadQuotationAttachment.bind(storageManager);
export const uploadLogo = storageManager.uploadLogo.bind(storageManager);
export const deleteFile = storageManager.deleteFile.bind(storageManager);
export const compressImage = storageManager.compressImage.bind(storageManager);