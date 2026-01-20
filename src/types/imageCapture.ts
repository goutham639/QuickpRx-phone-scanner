/**
 * Image capture and quality analysis types
 */

/** Quality analysis result from image processing */
export interface ImageQualityResult {
  /** Blur score - higher is sharper (variance of Laplacian) */
  blurScore: number;
  /** Whether the image passes the blur threshold */
  isSharp: boolean;
  /** Mean brightness (0-100 scale) */
  brightness: number;
  /** Whether brightness is within acceptable range */
  isBrightnessOk: boolean;
  /** Contrast as standard deviation of luminance (0-100 scale) */
  contrast: number;
  /** Overall quality assessment */
  overallQuality: 'good' | 'acceptable' | 'poor';
  /** Human-readable quality issues */
  issues: string[];
}

/** Quality check status during preview */
export type QualityCheckStatus = 'idle' | 'checking' | 'ready' | 'error';

/** Preview quality state for real-time feedback */
export interface PreviewQualityState {
  status: QualityCheckStatus;
  result: ImageQualityResult | null;
  lastChecked: number;
}

/** Burst capture result */
export interface BurstCaptureResult {
  /** All captured frames as blobs */
  frames: Blob[];
  /** Quality scores for each frame */
  scores: number[];
  /** Index of the best frame */
  bestFrameIndex: number;
  /** The best frame blob */
  bestFrame: Blob;
}

/** OpenCV loading status */
export type OpenCVStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Document edge detection result */
export interface DocumentEdges {
  /** Four corners of detected document [topLeft, topRight, bottomRight, bottomLeft] */
  corners: [Point, Point, Point, Point] | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether edges were detected successfully */
  detected: boolean;
}

/** Point coordinates */
export interface Point {
  x: number;
  y: number;
}

/** Perspective correction result */
export interface PerspectiveCorrectionResult {
  /** Corrected image as blob */
  correctedImage: Blob;
  /** Original detected edges */
  originalEdges: DocumentEdges;
  /** Whether correction was applied */
  correctionApplied: boolean;
}

/** Skew detection result */
export interface SkewDetectionResult {
  /** Detected skew angle in degrees */
  angle: number;
  /** Confidence score (0-1) */
  confidence: number;
}

/** Worker message types for image quality worker */
export type ImageQualityWorkerMessage =
  | { type: 'analyze'; imageData: ImageData; id: string }
  | { type: 'analyzeBlur'; imageData: ImageData; id: string };

/** Worker response types */
export type ImageQualityWorkerResponse =
  | { type: 'result'; result: ImageQualityResult; id: string }
  | { type: 'blurScore'; score: number; id: string }
  | { type: 'error'; error: string; id: string };

/** OpenCV worker message types */
export type OpenCVWorkerMessage =
  | { type: 'init' }
  | { type: 'detectEdges'; imageData: ImageData; id: string }
  | { type: 'correctPerspective'; imageData: ImageData; corners: [Point, Point, Point, Point]; id: string }
  | { type: 'detectSkew'; imageData: ImageData; id: string }
  | { type: 'correctSkew'; imageData: ImageData; angle: number; id: string };

/** OpenCV worker response types */
export type OpenCVWorkerResponse =
  | { type: 'ready' }
  | { type: 'edges'; edges: DocumentEdges; id: string }
  | { type: 'corrected'; imageData: ImageData; id: string }
  | { type: 'skew'; result: SkewDetectionResult; id: string }
  | { type: 'error'; error: string; id: string };
