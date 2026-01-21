/**
 * Image Pre-Validation Utility
 * Performs lightweight local checks before sending to Vision API
 *
 * Tier 1: No OCR - uses image analysis only
 * - Text density detection (edge-based)
 * - Aspect ratio validation
 * - Color distribution analysis
 */

export interface PreValidationResult {
  isValid: boolean;
  confidence: number; // 0-1 score
  checks: {
    textDensity: CheckResult;
    aspectRatio: CheckResult;
    colorDistribution: CheckResult;
  };
  suggestion?: string;
}

export interface CheckResult {
  passed: boolean;
  value: number;
  threshold: number;
  message?: string;
}

// Configuration thresholds
const CONFIG = {
  // Text density: percentage of image with edge-like features (text regions)
  textDensity: {
    min: 0.02, // At least 2% of image should have text-like edges
    max: 0.60, // More than 60% is likely noise/blur
    ideal: { min: 0.05, max: 0.40 },
  },
  // Aspect ratio: width/height ratio for typical labels
  aspectRatio: {
    min: 0.5,  // Portrait labels
    max: 3.0,  // Wide receipts
    idealMin: 0.8,
    idealMax: 2.5,
  },
  // Color distribution: expecting light background with dark text
  colorDistribution: {
    minLightPixels: 0.30, // At least 30% should be light (background)
    maxLightPixels: 0.95, // Not more than 95% (need some dark text)
    minContrast: 0.15,    // Minimum difference between light and dark regions
  },
  // Analysis settings
  analysis: {
    sampleSize: 200, // Resize to this for faster analysis
    edgeThreshold: 30, // Sobel edge detection threshold
  },
};

/**
 * Validate an image before sending to Vision API
 */
export async function preValidateImage(
  imageSource: HTMLCanvasElement | HTMLVideoElement | Blob
): Promise<PreValidationResult> {
  // Convert to canvas for analysis
  const canvas = await getAnalysisCanvas(imageSource);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return createFailedResult('Could not analyze image');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Run all checks
  const textDensity = analyzeTextDensity(imageData);
  const aspectRatio = analyzeAspectRatio(canvas.width, canvas.height);
  const colorDistribution = analyzeColorDistribution(imageData);

  // Calculate overall confidence
  const checks = { textDensity, aspectRatio, colorDistribution };
  const passedChecks = Object.values(checks).filter(c => c.passed).length;
  const confidence = passedChecks / 3;

  // Determine if valid and provide suggestion
  const isValid = passedChecks >= 2 && textDensity.passed;
  const suggestion = generateSuggestion(checks, isValid);

  return {
    isValid,
    confidence,
    checks,
    suggestion,
  };
}

/**
 * Convert various image sources to a downscaled canvas for analysis
 */
async function getAnalysisCanvas(
  source: HTMLCanvasElement | HTMLVideoElement | Blob
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const targetSize = CONFIG.analysis.sampleSize;

  if (source instanceof Blob) {
    // Load blob as image
    const img = await loadImageFromBlob(source);
    const scale = Math.min(targetSize / img.width, targetSize / img.height);
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else if (source instanceof HTMLVideoElement) {
    const scale = Math.min(targetSize / source.videoWidth, targetSize / source.videoHeight);
    canvas.width = Math.floor(source.videoWidth * scale);
    canvas.height = Math.floor(source.videoHeight * scale);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  } else {
    // HTMLCanvasElement
    const scale = Math.min(targetSize / source.width, targetSize / source.height);
    canvas.width = Math.floor(source.width * scale);
    canvas.height = Math.floor(source.height * scale);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }

  return canvas;
}

/**
 * Load an image from a Blob
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
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
 * Analyze text density using edge detection
 * Text appears as regions with many edges (high frequency content)
 */
function analyzeTextDensity(imageData: ImageData): CheckResult {
  const { width, height, data } = imageData;
  const grayscale = new Uint8Array(width * height);

  // Convert to grayscale
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Apply Sobel edge detection
  let edgePixels = 0;
  const threshold = CONFIG.analysis.edgeThreshold;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Sobel X kernel
      const gx =
        -(grayscale[(y - 1) * width + (x - 1)] ?? 0) + (grayscale[(y - 1) * width + (x + 1)] ?? 0) +
        -2 * (grayscale[y * width + (x - 1)] ?? 0) + 2 * (grayscale[y * width + (x + 1)] ?? 0) +
        -(grayscale[(y + 1) * width + (x - 1)] ?? 0) + (grayscale[(y + 1) * width + (x + 1)] ?? 0);

      // Sobel Y kernel
      const gy =
        -(grayscale[(y - 1) * width + (x - 1)] ?? 0) - 2 * (grayscale[(y - 1) * width + x] ?? 0) - (grayscale[(y - 1) * width + (x + 1)] ?? 0) +
        (grayscale[(y + 1) * width + (x - 1)] ?? 0) + 2 * (grayscale[(y + 1) * width + x] ?? 0) + (grayscale[(y + 1) * width + (x + 1)] ?? 0);

      const magnitude = Math.sqrt(gx * gx + gy * gy);

      if (magnitude > threshold) {
        edgePixels++;
      }
    }
  }

  const totalPixels = (width - 2) * (height - 2);
  const density = edgePixels / totalPixels;

  const passed = density >= CONFIG.textDensity.min && density <= CONFIG.textDensity.max;

  let message: string | undefined;
  if (density < CONFIG.textDensity.min) {
    message = 'No text detected';
  } else if (density > CONFIG.textDensity.max) {
    message = 'Image appears blurry or noisy';
  }

  return {
    passed,
    value: density,
    threshold: CONFIG.textDensity.min,
    message,
  };
}

/**
 * Analyze aspect ratio to check if it matches typical label shapes
 */
function analyzeAspectRatio(width: number, height: number): CheckResult {
  const ratio = width / height;
  const { min, max } = CONFIG.aspectRatio;

  const passed = ratio >= min && ratio <= max;

  let message: string | undefined;
  if (ratio < min) {
    message = 'Image is too narrow';
  } else if (ratio > max) {
    message = 'Image is too wide';
  }

  return {
    passed,
    value: ratio,
    threshold: min,
    message,
  };
}

/**
 * Analyze color distribution
 * Prescription labels typically have light backgrounds with dark text
 */
function analyzeColorDistribution(imageData: ImageData): CheckResult {
  const { data } = imageData;
  const totalPixels = data.length / 4;

  let lightPixels = 0;
  let darkPixels = 0;
  let lightSum = 0;
  let darkSum = 0;

  const lightThreshold = 180; // Pixel is considered "light"
  const darkThreshold = 80;   // Pixel is considered "dark"

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const brightness = (r + g + b) / 3;

    if (brightness > lightThreshold) {
      lightPixels++;
      lightSum += brightness;
    } else if (brightness < darkThreshold) {
      darkPixels++;
      darkSum += brightness;
    }
  }

  const lightRatio = lightPixels / totalPixels;
  const darkRatio = darkPixels / totalPixels;

  // Calculate contrast between light and dark regions
  const avgLight = lightPixels > 0 ? lightSum / lightPixels : 0;
  const avgDark = darkPixels > 0 ? darkSum / darkPixels : 128;
  const contrast = (avgLight - avgDark) / 255;

  const { minLightPixels, maxLightPixels, minContrast } = CONFIG.colorDistribution;

  const hasEnoughLight = lightRatio >= minLightPixels && lightRatio <= maxLightPixels;
  const hasEnoughContrast = contrast >= minContrast;
  const hasText = darkRatio >= 0.01; // At least 1% dark pixels (text)

  const passed = hasEnoughLight && hasEnoughContrast && hasText;

  let message: string | undefined;
  if (lightRatio < minLightPixels) {
    message = 'Image is too dark';
  } else if (lightRatio > maxLightPixels) {
    message = 'No text visible';
  } else if (!hasEnoughContrast) {
    message = 'Low contrast - hard to read';
  } else if (!hasText) {
    message = 'No dark text detected';
  }

  return {
    passed,
    value: contrast,
    threshold: minContrast,
    message,
  };
}

/**
 * Generate a user-friendly suggestion based on check results
 */
function generateSuggestion(
  checks: PreValidationResult['checks'],
  isValid: boolean
): string | undefined {
  if (isValid) {
    return undefined;
  }

  // Priority order for suggestions
  if (!checks.textDensity.passed) {
    if (checks.textDensity.value < CONFIG.textDensity.min) {
      return "Can't detect text. Make sure the label is in frame and in focus.";
    } else {
      return 'Image appears blurry. Hold steady and try again.';
    }
  }

  if (!checks.colorDistribution.passed) {
    if (checks.colorDistribution.message?.includes('dark')) {
      return 'Image is too dark. Move to a brighter area.';
    } else if (checks.colorDistribution.message?.includes('contrast')) {
      return 'Low contrast. Adjust angle to reduce glare.';
    } else {
      return "Can't see text on label. Check positioning.";
    }
  }

  if (!checks.aspectRatio.passed) {
    return 'Label may be cut off. Fit the entire label in frame.';
  }

  return 'Please retake the photo.';
}

/**
 * Create a failed validation result
 */
function createFailedResult(message: string): PreValidationResult {
  const failedCheck: CheckResult = {
    passed: false,
    value: 0,
    threshold: 0,
    message,
  };

  return {
    isValid: false,
    confidence: 0,
    checks: {
      textDensity: failedCheck,
      aspectRatio: failedCheck,
      colorDistribution: failedCheck,
    },
    suggestion: message,
  };
}

/**
 * Quick check if an image is likely worth sending to Vision
 * Faster than full validation - just checks text density
 */
export async function quickTextCheck(
  imageSource: HTMLCanvasElement | HTMLVideoElement | Blob
): Promise<{ hasText: boolean; density: number }> {
  const canvas = await getAnalysisCanvas(imageSource);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return { hasText: false, density: 0 };
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = analyzeTextDensity(imageData);

  return {
    hasText: result.passed,
    density: result.value,
  };
}
