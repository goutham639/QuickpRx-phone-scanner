/**
 * Image Compression Utility
 * Compresses images to target file size while maintaining readability for OCR
 */

import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  finalQuality: number;
  wasResized: boolean;
}

/**
 * Resize image to fit within max dimensions while maintaining aspect ratio
 */
function resizeImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; wasResized: boolean } {
  let width = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  let height = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  let wasResized = false;

  // Calculate scale factor to fit within bounds
  if (width > maxWidth || height > maxHeight) {
    const scaleX = maxWidth / width;
    const scaleY = maxHeight / height;
    const scale = Math.min(scaleX, scaleY);

    width = Math.round(width * scale);
    height = Math.round(height * scale);
    wasResized = true;
  }

  // Resize canvas and draw
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  return { width, height, wasResized };
}

/**
 * Convert canvas to blob with specified quality
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Compress a Blob image to target file size
 * Uses iterative quality reduction to achieve target size
 */
export async function compressImage(
  inputBlob: Blob,
  options?: {
    targetSizeBytes?: number;
    maxWidth?: number;
    maxHeight?: number;
    initialQuality?: number;
    minQuality?: number;
    qualityStep?: number;
  }
): Promise<CompressionResult> {
  const {
    targetSizeBytes = IMAGE_CAPTURE_CONFIG.targetFileSizeBytes,
    maxWidth = IMAGE_CAPTURE_CONFIG.maxImageWidth,
    maxHeight = IMAGE_CAPTURE_CONFIG.maxImageHeight,
    initialQuality = IMAGE_CAPTURE_CONFIG.initialJpegQuality,
    minQuality = IMAGE_CAPTURE_CONFIG.minJpegQuality,
    qualityStep = IMAGE_CAPTURE_CONFIG.qualityStep,
  } = options || {};

  const originalSize = inputBlob.size;

  // If already small enough and compression is disabled, return as-is
  if (!IMAGE_CAPTURE_CONFIG.enableCompression && originalSize <= targetSizeBytes) {
    return {
      blob: inputBlob,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      finalQuality: 1,
      wasResized: false,
    };
  }

  // Create image from blob
  const img = await createImageFromBlob(inputBlob);

  // Create canvas for manipulation
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Resize if needed
  const { wasResized } = resizeImage(canvas, ctx, img, maxWidth, maxHeight);

  // Try compression at different quality levels
  let quality = initialQuality;
  let blob: Blob | null = null;

  while (quality >= minQuality) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);

    if (!blob) {
      throw new Error('Failed to create blob from canvas');
    }

    // Check if we've reached target size
    if (blob.size <= targetSizeBytes) {
      break;
    }

    // Reduce quality for next iteration
    quality -= qualityStep;
  }

  // Final blob (use last successful compression)
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/jpeg', minQuality);
  }

  if (!blob) {
    throw new Error('Failed to compress image');
  }

  return {
    blob,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: blob.size / originalSize,
    finalQuality: Math.max(quality, minQuality),
    wasResized,
  };
}

/**
 * Create an Image element from a Blob
 */
function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Compress image from canvas directly (more efficient for captured frames)
 */
export async function compressCanvas(
  sourceCanvas: HTMLCanvasElement,
  options?: {
    targetSizeBytes?: number;
    maxWidth?: number;
    maxHeight?: number;
    initialQuality?: number;
    minQuality?: number;
    qualityStep?: number;
  }
): Promise<CompressionResult> {
  const {
    targetSizeBytes = IMAGE_CAPTURE_CONFIG.targetFileSizeBytes,
    maxWidth = IMAGE_CAPTURE_CONFIG.maxImageWidth,
    maxHeight = IMAGE_CAPTURE_CONFIG.maxImageHeight,
    initialQuality = IMAGE_CAPTURE_CONFIG.initialJpegQuality,
    minQuality = IMAGE_CAPTURE_CONFIG.minJpegQuality,
    qualityStep = IMAGE_CAPTURE_CONFIG.qualityStep,
  } = options || {};

  // Create working canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Resize if needed
  const { wasResized } = resizeImage(canvas, ctx, sourceCanvas, maxWidth, maxHeight);

  // Get original size estimate (uncompressed)
  const originalBlob = await canvasToBlob(sourceCanvas, 'image/jpeg', 0.95);
  const originalSize = originalBlob?.size || sourceCanvas.width * sourceCanvas.height * 4;

  // Try compression at different quality levels
  let quality = initialQuality;
  let blob: Blob | null = null;

  while (quality >= minQuality) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);

    if (!blob) {
      throw new Error('Failed to create blob from canvas');
    }

    // Check if we've reached target size
    if (blob.size <= targetSizeBytes) {
      break;
    }

    // Reduce quality for next iteration
    quality -= qualityStep;
  }

  // Final blob
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/jpeg', minQuality);
  }

  if (!blob) {
    throw new Error('Failed to compress image');
  }

  return {
    blob,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: blob.size / originalSize,
    finalQuality: Math.max(quality, minQuality),
    wasResized,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
