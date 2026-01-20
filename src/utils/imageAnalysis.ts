/**
 * Pure JavaScript image quality analysis algorithms
 * Zero external dependencies - runs in main thread or web worker
 */

import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';
import type { ImageQualityResult } from '../types/imageCapture';

/**
 * Laplacian kernel for edge/blur detection
 * [0,  1,  0]
 * [1, -4,  1]
 * [0,  1,  0]
 */
const LAPLACIAN_KERNEL = [0, 1, 0, 1, -4, 1, 0, 1, 0];

/**
 * Convert RGB to grayscale luminance
 * Using ITU-R BT.709 coefficients
 */
function rgbToLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Extract grayscale luminance array from ImageData
 * Returns values normalized to 0-255 range
 */
export function extractGrayscale(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const grayscale = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    grayscale[i] = Math.round(rgbToLuminance(r, g, b));
  }

  return grayscale;
}

/**
 * Apply 3x3 convolution kernel to grayscale image
 * Returns float array of convolution results
 */
function convolve3x3(
  grayscale: Uint8Array,
  width: number,
  height: number,
  kernel: number[]
): Float32Array {
  const result = new Float32Array((width - 2) * (height - 2));

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;

      // Apply 3x3 kernel
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIdx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          const pixelVal = grayscale[pixelIdx] ?? 0;
          const kernelVal = kernel[kernelIdx] ?? 0;
          sum += pixelVal * kernelVal;
        }
      }

      result[(y - 1) * (width - 2) + (x - 1)] = sum;
    }
  }

  return result;
}

/**
 * Calculate variance of an array
 */
function calculateVariance(data: Float32Array | Uint8Array): number {
  if (data.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] ?? 0;
  }
  const mean = sum / data.length;

  let variance = 0;
  for (let i = 0; i < data.length; i++) {
    const diff = (data[i] ?? 0) - mean;
    variance += diff * diff;
  }

  return variance / data.length;
}

/**
 * Calculate mean of an array
 */
function calculateMean(data: Uint8Array): number {
  if (data.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] ?? 0;
  }

  return sum / data.length;
}

/**
 * Calculate standard deviation of an array
 */
function calculateStdDev(data: Uint8Array): number {
  return Math.sqrt(calculateVariance(new Float32Array(data)));
}

/**
 * Detect blur using Laplacian variance method
 * Higher score = sharper image
 *
 * The Laplacian operator highlights rapid intensity changes (edges).
 * A blurry image has fewer sharp edges, resulting in lower variance.
 *
 * Typical thresholds:
 * - < 20: Very blurry
 * - 20-50: Somewhat blurry
 * - 50-100: Acceptable
 * - > 100: Sharp
 */
export function calculateBlurScore(imageData: ImageData): number {
  const { width, height } = imageData;
  const grayscale = extractGrayscale(imageData);
  const laplacian = convolve3x3(grayscale, width, height, LAPLACIAN_KERNEL);
  const variance = calculateVariance(laplacian);

  // Normalize to a more intuitive scale
  // Square root to compress the range, then scale
  return Math.sqrt(variance);
}

/**
 * Calculate blur score optimized for a downsampled image
 * Uses a sampling approach for faster analysis during preview
 */
export function calculateBlurScoreFast(
  imageData: ImageData,
  sampleSize = 200
): number {
  const { width, height, data } = imageData;

  // Sample center region for faster analysis
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const halfSample = Math.floor(sampleSize / 2);

  const startX = Math.max(0, centerX - halfSample);
  const startY = Math.max(0, centerY - halfSample);
  const endX = Math.min(width, centerX + halfSample);
  const endY = Math.min(height, centerY + halfSample);

  const sampleWidth = endX - startX;
  const sampleHeight = endY - startY;
  const grayscale = new Uint8Array(sampleWidth * sampleHeight);

  // Extract grayscale from sample region
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y - startY) * sampleWidth + (x - startX);
      const r = data[srcIdx] ?? 0;
      const g = data[srcIdx + 1] ?? 0;
      const b = data[srcIdx + 2] ?? 0;
      grayscale[dstIdx] = Math.round(rgbToLuminance(r, g, b));
    }
  }

  const laplacian = convolve3x3(grayscale, sampleWidth, sampleHeight, LAPLACIAN_KERNEL);
  return Math.sqrt(calculateVariance(laplacian));
}

/**
 * Calculate mean brightness (0-100 scale)
 * Based on average luminance of all pixels
 */
export function calculateBrightness(imageData: ImageData): number {
  const grayscale = extractGrayscale(imageData);
  const mean = calculateMean(grayscale);

  // Convert 0-255 to 0-100 scale
  return (mean / 255) * 100;
}

/**
 * Calculate contrast as standard deviation of luminance (0-100 scale)
 * Higher value = more contrast
 */
export function calculateContrast(imageData: ImageData): number {
  const grayscale = extractGrayscale(imageData);
  const stdDev = calculateStdDev(grayscale);

  // Normalize: max theoretical std dev is ~127 (half of 255)
  // Scale to 0-100
  return (stdDev / 127) * 100;
}

/**
 * Build luminance histogram (256 bins)
 */
export function buildHistogram(imageData: ImageData): Uint32Array {
  const grayscale = extractGrayscale(imageData);
  const histogram = new Uint32Array(256);

  for (let i = 0; i < grayscale.length; i++) {
    const val = grayscale[i] ?? 0;
    const histVal = histogram[val] ?? 0;
    histogram[val] = histVal + 1;
  }

  return histogram;
}

/**
 * Analyze overall image quality
 * Returns comprehensive quality result
 */
export function analyzeImageQuality(imageData: ImageData): ImageQualityResult {
  const config = IMAGE_CAPTURE_CONFIG;

  // Calculate metrics
  const blurScore = calculateBlurScore(imageData);
  const brightness = calculateBrightness(imageData);
  const contrast = calculateContrast(imageData);

  // Evaluate against thresholds
  const isSharp = blurScore >= config.minBlurScore;
  const isBrightnessOk =
    brightness >= config.minBrightness && brightness <= config.maxBrightness;
  const isContrastOk = contrast >= config.minContrast;

  // Collect issues
  const issues: string[] = [];

  if (!isSharp) {
    issues.push('Image is blurry - hold steady');
  }

  if (brightness < config.minBrightness) {
    issues.push('Too dark - increase lighting');
  } else if (brightness > config.maxBrightness) {
    issues.push('Too bright - reduce lighting or glare');
  }

  if (!isContrastOk) {
    issues.push('Low contrast - adjust position');
  }

  // Determine overall quality
  let overallQuality: 'good' | 'acceptable' | 'poor';

  if (isSharp && isBrightnessOk && isContrastOk) {
    overallQuality = 'good';
  } else if (issues.length === 1 && (blurScore >= config.minBlurScore * 0.7 || isBrightnessOk)) {
    overallQuality = 'acceptable';
  } else {
    overallQuality = 'poor';
  }

  return {
    blurScore,
    isSharp,
    brightness,
    isBrightnessOk,
    contrast,
    overallQuality,
    issues,
  };
}

/**
 * Quick quality check for preview (optimized for speed)
 * Uses sampling to reduce computation time
 */
export function analyzeImageQualityFast(imageData: ImageData): ImageQualityResult {
  const config = IMAGE_CAPTURE_CONFIG;

  // Use fast blur calculation with sampling
  const blurScore = calculateBlurScoreFast(imageData);
  const brightness = calculateBrightness(imageData);
  const contrast = calculateContrast(imageData);

  const isSharp = blurScore >= config.minBlurScore;
  const isBrightnessOk =
    brightness >= config.minBrightness && brightness <= config.maxBrightness;
  const isContrastOk = contrast >= config.minContrast;

  const issues: string[] = [];

  if (!isSharp) {
    issues.push('Image is blurry - hold steady');
  }

  if (brightness < config.minBrightness) {
    issues.push('Too dark - increase lighting');
  } else if (brightness > config.maxBrightness) {
    issues.push('Too bright - reduce lighting or glare');
  }

  if (!isContrastOk) {
    issues.push('Low contrast - adjust position');
  }

  let overallQuality: 'good' | 'acceptable' | 'poor';

  if (isSharp && isBrightnessOk && isContrastOk) {
    overallQuality = 'good';
  } else if (issues.length === 1 && (blurScore >= config.minBlurScore * 0.7 || isBrightnessOk)) {
    overallQuality = 'acceptable';
  } else {
    overallQuality = 'poor';
  }

  return {
    blurScore,
    isSharp,
    brightness,
    isBrightnessOk,
    contrast,
    overallQuality,
    issues,
  };
}

/**
 * Compare two images by blur score
 * Returns the index of the sharper image (0 or 1)
 */
export function compareSharpness(image1: ImageData, image2: ImageData): number {
  const score1 = calculateBlurScore(image1);
  const score2 = calculateBlurScore(image2);
  return score1 >= score2 ? 0 : 1;
}

/**
 * Find the sharpest image from an array of ImageData
 * Returns the index of the sharpest image
 */
export function findSharpestImage(images: ImageData[]): number {
  if (images.length === 0) return -1;
  if (images.length === 1) return 0;

  const firstImage = images[0];
  if (!firstImage) return -1;

  let bestIndex = 0;
  let bestScore = calculateBlurScore(firstImage);

  for (let i = 1; i < images.length; i++) {
    const img = images[i];
    if (!img) continue;
    const score = calculateBlurScore(img);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}
