/**
 * Upload validation utilities for file and image uploads
 */

// File size limits in bytes
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024,       // 5MB for general images
  POST_IMAGE: 8 * 1024 * 1024,  // 8MB for post images (JPG/PNG only)
  VIDEO: 50 * 1024 * 1024,      // 50MB for videos
  DOCUMENT: 100 * 1024 * 1024,  // 100MB for documents/carousels
  AVATAR: 2 * 1024 * 1024,      // 2MB for avatars
  COVER: 5 * 1024 * 1024,       // 5MB for cover images
  MESSAGE_ATTACHMENT: 10 * 1024 * 1024, // 10MB for message attachments
} as const;

// Image dimension limits in pixels
export const IMAGE_DIMENSION_LIMITS = {
  MAX_WIDTH: 4000,
  MAX_HEIGHT: 4000,
  AVATAR_MAX: 1000,    // Square dimension for avatars
  COVER_MAX_WIDTH: 2000,
  COVER_MAX_HEIGHT: 1000,
} as const;

// Post image dimension limits (LinkedIn-style flexible dimensions)
export const POST_IMAGE_LIMITS = {
  MIN_WIDTH: 200,      // Minimum for acceptable quality
  MIN_HEIGHT: 200,     // Minimum for acceptable quality
  MAX_WIDTH: 4096,     // Maximum allowed
  MAX_HEIGHT: 4096,    // Maximum allowed
  RECOMMENDED_WIDTH: 1200,  // For optimal quality
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  DOCUMENTS: ['text/csv', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  POST_DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  MESSAGE_IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  MESSAGE_DOCUMENTS: [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
} as const;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image dimensions
 */
export const validateImageDimensions = (
  file: File,
  maxWidth: number = IMAGE_DIMENSION_LIMITS.MAX_WIDTH,
  maxHeight: number = IMAGE_DIMENSION_LIMITS.MAX_HEIGHT
): Promise<ValidationResult> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      if (img.width > maxWidth || img.height > maxHeight) {
        resolve({
          valid: false,
          error: `Image dimensions should not exceed ${maxWidth}x${maxHeight}px. Current: ${img.width}x${img.height}px`,
        });
      } else {
        resolve({ valid: true });
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        error: 'Failed to load image',
      });
    };
    
    img.src = url;
  });
};

/**
 * Validate file size
 */
export const validateFileSize = (file: File, maxSize: number): ValidationResult => {
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size should be less than ${maxSizeMB}MB. Current: ${fileSizeMB}MB`,
    };
  }
  return { valid: true };
};

/**
 * Validate file type
 */
export const validateFileType = (file: File, allowedTypes: readonly string[]): ValidationResult => {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }
  return { valid: true };
};

/**
 * Complete validation for avatar uploads
 */
export const validateAvatarUpload = async (file: File): Promise<ValidationResult> => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.IMAGES);
  if (!typeCheck.valid) return typeCheck;
  
  // Check file size
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.AVATAR);
  if (!sizeCheck.valid) return sizeCheck;
  
  // Check dimensions
  const dimensionCheck = await validateImageDimensions(
    file,
    IMAGE_DIMENSION_LIMITS.AVATAR_MAX,
    IMAGE_DIMENSION_LIMITS.AVATAR_MAX
  );
  return dimensionCheck;
};

/**
 * Complete validation for cover image uploads
 */
export const validateCoverImageUpload = async (file: File): Promise<ValidationResult> => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.IMAGES);
  if (!typeCheck.valid) return typeCheck;
  
  // Check file size
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.COVER);
  if (!sizeCheck.valid) return sizeCheck;
  
  // Check dimensions
  const dimensionCheck = await validateImageDimensions(
    file,
    IMAGE_DIMENSION_LIMITS.COVER_MAX_WIDTH,
    IMAGE_DIMENSION_LIMITS.COVER_MAX_HEIGHT
  );
  return dimensionCheck;
};

/**
 * Complete validation for general image uploads
 */
export const validateImageUpload = async (file: File): Promise<ValidationResult> => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.IMAGES);
  if (!typeCheck.valid) return typeCheck;
  
  // Check file size
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.IMAGE);
  if (!sizeCheck.valid) return sizeCheck;
  
  // Check dimensions
  const dimensionCheck = await validateImageDimensions(file);
  return dimensionCheck;
};

/**
 * Validate post image dimensions (LinkedIn-style flexible dimensions)
 * Minimum: 400x400px, Maximum: 4096x4096px
 */
export const validatePostImageDimensions = (file: File): Promise<ValidationResult> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      
      // Check minimum dimensions
      if (width < POST_IMAGE_LIMITS.MIN_WIDTH || height < POST_IMAGE_LIMITS.MIN_HEIGHT) {
        resolve({
          valid: false,
          error: `Image is too small (${width}x${height}px). Minimum size is ${POST_IMAGE_LIMITS.MIN_WIDTH}x${POST_IMAGE_LIMITS.MIN_HEIGHT}px.`,
        });
        return;
      }
      
      // Check maximum dimensions
      if (width > POST_IMAGE_LIMITS.MAX_WIDTH || height > POST_IMAGE_LIMITS.MAX_HEIGHT) {
        resolve({
          valid: false,
          error: `Image is too large (${width}x${height}px). Maximum size is ${POST_IMAGE_LIMITS.MAX_WIDTH}x${POST_IMAGE_LIMITS.MAX_HEIGHT}px.`,
        });
        return;
      }
      
      resolve({ valid: true });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, error: 'Failed to load image' });
    };
    
    img.src = url;
  });
};

/**
 * Resize image to LinkedIn-standard dimensions before upload.
 * Max width: 1200px, max height: 1200px, maintains aspect ratio.
 * Outputs JPEG at 85% quality for optimal size/quality balance.
 * Returns the original file if it's already within limits.
 */
export const resizeImageForUpload = (
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.85
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // If already within limits, return original
      if (img.width <= maxWidth && img.height <= maxHeight) {
        resolve(file);
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = img.width;
      let newHeight = img.height;

      if (newWidth > maxWidth) {
        newHeight = Math.round((newHeight * maxWidth) / newWidth);
        newWidth = maxWidth;
      }
      if (newHeight > maxHeight) {
        newWidth = Math.round((newWidth * maxHeight) / newHeight);
        newHeight = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback to original if canvas fails
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = url;
  });
};

/**
 * Complete validation for post image uploads (8MB limit, specific dimensions)
 */
export const validatePostImageUpload = async (file: File): Promise<ValidationResult> => {
  // Only allow JPG and PNG for posts (best display quality)
  const allowedPostTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const typeCheck = validateFileType(file, allowedPostTypes);
  if (!typeCheck.valid) {
    return {
      valid: false,
      error: 'Invalid image format. Allowed formats: JPG, PNG',
    };
  }
  
  // Check file size (8MB for posts)
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.POST_IMAGE);
  if (!sizeCheck.valid) return sizeCheck;
  
  // Check dimensions match allowed formats
  const dimensionCheck = await validatePostImageDimensions(file);
  return dimensionCheck;
};

/**
 * Complete validation for video uploads (50MB limit)
 */
export const validateVideoUpload = (file: File): ValidationResult => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.VIDEOS);
  if (!typeCheck.valid) {
    return {
      valid: false,
      error: 'Invalid video format. Allowed formats: MP4, WebM, MOV, AVI',
    };
  }
  
  // Check file size (50MB for videos)
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.VIDEO);
  return sizeCheck;
};

/**
 * Complete validation for document uploads (CSV, PDF, etc.)
 */
export const validateDocumentUpload = (file: File): ValidationResult => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.DOCUMENTS);
  if (!typeCheck.valid) return typeCheck;
  
  // Check file size
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.DOCUMENT);
  return sizeCheck;
};

/**
 * Complete validation for post document uploads (PDF, DOC, DOCX - 100MB limit)
 */
export const validatePostDocumentUpload = (file: File): ValidationResult => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.POST_DOCUMENTS);
  if (!typeCheck.valid) {
    return {
      valid: false,
      error: 'Invalid document format. Allowed formats: PDF, DOC, DOCX',
    };
  }
  
  // Check file size (100MB for post documents/carousels)
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.DOCUMENT);
  return sizeCheck;
};

/**
 * Complete validation for message image uploads (10MB limit)
 */
export const validateMessageImageUpload = async (file: File): Promise<ValidationResult> => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.MESSAGE_IMAGES);
  if (!typeCheck.valid) {
    return {
      valid: false,
      error: 'Invalid image format. Allowed formats: JPG, PNG, WebP, GIF',
    };
  }
  
  // Check file size (10MB for message images)
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.MESSAGE_ATTACHMENT);
  if (!sizeCheck.valid) return sizeCheck;
  
  // Check dimensions (more lenient than other uploads)
  const dimensionCheck = await validateImageDimensions(file);
  return dimensionCheck;
};

/**
 * Complete validation for message document uploads (PDF, DOC, DOCX, PPT, PPTX - 10MB limit)
 */
export const validateMessageDocumentUpload = (file: File): ValidationResult => {
  // Check file type
  const typeCheck = validateFileType(file, ALLOWED_FILE_TYPES.MESSAGE_DOCUMENTS);
  if (!typeCheck.valid) {
    return {
      valid: false,
      error: 'Invalid document format. Allowed formats: PDF, DOC, DOCX, PPT, PPTX',
    };
  }
  
  // Check file size (10MB for message documents)
  const sizeCheck = validateFileSize(file, FILE_SIZE_LIMITS.MESSAGE_ATTACHMENT);
  return sizeCheck;
};
