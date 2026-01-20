/**
 * Configuration for image capture and quality analysis
 */
export const IMAGE_CAPTURE_CONFIG = {
  // Always on (pure JS)
  enableQualityChecks: true,
  enableBurstMode: true,

  // Off by default (requires opencv.js)
  enablePerspectiveCorrection: false,
  enableAutoRotate: false,

  // Quality thresholds
  /** Minimum blur score (Laplacian variance) - below this is considered blurry */
  minBlurScore: 30,
  /** Minimum acceptable brightness (0-100) */
  minBrightness: 25,
  /** Maximum acceptable brightness (0-100) */
  maxBrightness: 85,
  /** Minimum contrast (std dev of luminance, 0-100) */
  minContrast: 15,

  // Burst mode settings
  /** Number of frames to capture in burst mode */
  burstFrameCount: 3,
  /** Interval between burst frames in milliseconds */
  burstFrameInterval: 100,

  // Preview quality check settings
  /** Target FPS for preview quality checks */
  previewQualityFps: 2,
  /** Debounce time for quality checks in milliseconds */
  qualityCheckDebounce: 500,

  // OpenCV settings
  /** CDN URL for opencv.js (lazy loaded) */
  opencvCdnUrl: 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.7.0-release.1/dist/opencv.js',
  /** IndexedDB key for caching opencv.js */
  opencvCacheKey: 'opencv-js-cached',

  // Perspective correction settings
  /** Minimum confidence for edge detection to apply correction */
  minEdgeConfidence: 0.7,
  /** Minimum area ratio for detected document (vs image size) */
  minDocumentAreaRatio: 0.1,

  // Skew correction settings
  /** Maximum skew angle to auto-correct (degrees) */
  maxSkewAngle: 15,
  /** Minimum confidence for skew detection */
  minSkewConfidence: 0.6,
} as const;

export type ImageCaptureConfig = typeof IMAGE_CAPTURE_CONFIG;
