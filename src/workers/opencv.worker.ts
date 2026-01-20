/**
 * OpenCV Web Worker
 * Performs OpenCV operations off the main thread
 * Note: opencv.js must be loaded in main thread first due to WASM limitations
 */

import type {
  OpenCVWorkerMessage,
  OpenCVWorkerResponse,
  DocumentEdges,
  SkewDetectionResult,
  Point,
} from '../types/imageCapture';
import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';

// OpenCV type placeholder (loaded from main thread)
declare const cv: {
  matFromImageData(imageData: ImageData): Mat;
  Mat: new () => Mat;
  MatVector: new () => MatVector;
  Size: new (width: number, height: number) => Size;
  Point: new (x: number, y: number) => CVPoint;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  COLOR_RGBA2GRAY: number;
  THRESH_BINARY: number;
  THRESH_OTSU: number;
  LINE_AA: number;
  INTER_LINEAR: number;
  BORDER_CONSTANT: number;
  cvtColor(src: Mat, dst: Mat, code: number): void;
  GaussianBlur(src: Mat, dst: Mat, ksize: Size, sigmaX: number): void;
  Canny(src: Mat, dst: Mat, threshold1: number, threshold2: number): void;
  dilate(src: Mat, dst: Mat, kernel: Mat): void;
  findContours(src: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number): void;
  contourArea(contour: Mat): number;
  arcLength(contour: Mat, closed: boolean): number;
  approxPolyDP(curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean): void;
  getPerspectiveTransform(src: Mat, dst: Mat): Mat;
  warpPerspective(src: Mat, dst: Mat, M: Mat, dsize: Size): void;
  HoughLinesP(src: Mat, lines: Mat, rho: number, theta: number, threshold: number, minLineLength: number, maxLineGap: number): void;
  getRotationMatrix2D(center: CVPoint, angle: number, scale: number): Mat;
  warpAffine(src: Mat, dst: Mat, M: Mat, dsize: Size, flags?: number, borderMode?: number): void;
  threshold(src: Mat, dst: Mat, thresh: number, maxval: number, type: number): void;
};

interface Mat {
  rows: number;
  cols: number;
  data: Uint8Array;
  data32S: Int32Array;
  floatPtr(row: number): Float32Array;
  delete(): void;
  clone(): Mat;
  size(): Size;
}

interface MatVector {
  size(): number;
  get(index: number): Mat;
  delete(): void;
}

interface Size {
  width: number;
  height: number;
}

interface CVPoint {
  x: number;
  y: number;
}

let isReady = false;

/**
 * Sort corners in order: topLeft, topRight, bottomRight, bottomLeft
 */
function sortCorners(points: Point[]): [Point, Point, Point, Point] {
  // Ensure we have at least 4 points
  const defaultPoint: Point = { x: 0, y: 0 };
  const p0 = points[0] ?? defaultPoint;
  const p1 = points[1] ?? defaultPoint;
  const p2 = points[2] ?? defaultPoint;
  const p3 = points[3] ?? defaultPoint;

  // Find center
  const centerX = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const centerY = points.reduce((sum, p) => sum + p.y, 0) / 4;

  // Classify points by quadrant relative to center
  const topLeft = points.find((p) => p.x < centerX && p.y < centerY) ?? p0;
  const topRight = points.find((p) => p.x >= centerX && p.y < centerY) ?? p1;
  const bottomRight = points.find((p) => p.x >= centerX && p.y >= centerY) ?? p2;
  const bottomLeft = points.find((p) => p.x < centerX && p.y >= centerY) ?? p3;

  return [topLeft, topRight, bottomRight, bottomLeft];
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Detect document edges using Canny + findContours
 */
function detectDocumentEdges(imageData: ImageData): DocumentEdges {
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const dilated = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Canny edge detection
    cv.Canny(blurred, edges, 50, 150);

    // Dilate to connect edges
    cv.dilate(edges, dilated, new cv.Mat());

    // Find contours
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = imageData.width * imageData.height;
    const minArea = imageArea * IMAGE_CAPTURE_CONFIG.minDocumentAreaRatio;

    let bestContour: Mat | null = null;
    let bestArea = 0;

    // Find largest quadrilateral contour
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area > minArea && area > bestArea) {
        const perimeter = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        // Looking for quadrilateral (4 points)
        if (approx.rows === 4) {
          bestContour = approx;
          bestArea = area;
        } else {
          approx.delete();
        }
      }
    }

    if (bestContour) {
      // Extract corner points
      const points: Point[] = [];
      for (let i = 0; i < 4; i++) {
        points.push({
          x: bestContour.data32S[i * 2] ?? 0,
          y: bestContour.data32S[i * 2 + 1] ?? 0,
        });
      }
      bestContour.delete();

      const sortedCorners = sortCorners(points);
      const confidence = Math.min(1, bestArea / (imageArea * 0.5));

      return {
        corners: sortedCorners,
        confidence,
        detected: true,
      };
    }

    return {
      corners: null,
      confidence: 0,
      detected: false,
    };
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    contours.delete();
    hierarchy.delete();
  }
}

/**
 * Apply perspective correction to straighten document
 */
function correctPerspective(
  imageData: ImageData,
  corners: [Point, Point, Point, Point]
): ImageData {
  const src = cv.matFromImageData(imageData);
  const dst = new cv.Mat();

  try {
    const [topLeft, topRight, bottomRight, bottomLeft] = corners;

    // Calculate output dimensions
    const widthTop = distance(topLeft, topRight);
    const widthBottom = distance(bottomLeft, bottomRight);
    const width = Math.max(widthTop, widthBottom);

    const heightLeft = distance(topLeft, bottomLeft);
    const heightRight = distance(topRight, bottomRight);
    const height = Math.max(heightLeft, heightRight);

    // Source points
    const srcPoints = cv.matFromImageData(
      new ImageData(new Uint8ClampedArray([
        topLeft.x, topLeft.y, 0, 0,
        topRight.x, topRight.y, 0, 0,
        bottomRight.x, bottomRight.y, 0, 0,
        bottomLeft.x, bottomLeft.y, 0, 0,
      ]), 4, 2)
    );

    // Destination points (rectangle)
    const dstPoints = cv.matFromImageData(
      new ImageData(new Uint8ClampedArray([
        0, 0, 0, 0,
        width, 0, 0, 0,
        width, height, 0, 0,
        0, height, 0, 0,
      ]), 4, 2)
    );

    // Get perspective transform matrix
    const M = cv.getPerspectiveTransform(srcPoints, dstPoints);

    // Apply transform
    cv.warpPerspective(src, dst, M, new cv.Size(width, height));

    // Convert back to ImageData
    const result = new ImageData(
      new Uint8ClampedArray(dst.data),
      dst.cols,
      dst.rows
    );

    srcPoints.delete();
    dstPoints.delete();
    M.delete();

    return result;
  } finally {
    src.delete();
    dst.delete();
  }
}

/**
 * Detect skew angle using Hough line detection
 */
function detectSkewAngle(imageData: ImageData): SkewDetectionResult {
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  const lines = new cv.Mat();

  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Threshold
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    // Detect lines using Hough transform
    cv.HoughLinesP(binary, lines, 1, Math.PI / 180, 100, 50, 10);

    if (lines.rows === 0) {
      return { angle: 0, confidence: 0 };
    }

    // Calculate angles of all lines
    const angles: number[] = [];
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4] ?? 0;
      const y1 = lines.data32S[i * 4 + 1] ?? 0;
      const x2 = lines.data32S[i * 4 + 2] ?? 0;
      const y2 = lines.data32S[i * 4 + 3] ?? 0;

      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

      // Normalize to -45 to 45 range (assuming mostly horizontal/vertical lines)
      let normalized = angle;
      while (normalized > 45) normalized -= 90;
      while (normalized < -45) normalized += 90;

      // Only consider small angles (likely text skew)
      if (Math.abs(normalized) <= IMAGE_CAPTURE_CONFIG.maxSkewAngle) {
        angles.push(normalized);
      }
    }

    if (angles.length === 0) {
      return { angle: 0, confidence: 0 };
    }

    // Calculate median angle
    angles.sort((a, b) => a - b);
    const median = angles[Math.floor(angles.length / 2)] ?? 0;

    // Confidence based on consistency of angles
    const variance =
      angles.reduce((sum, a) => sum + Math.pow(a - median, 2), 0) / angles.length;
    const confidence = Math.max(0, 1 - variance / 100);

    return {
      angle: median,
      confidence,
    };
  } finally {
    src.delete();
    gray.delete();
    binary.delete();
    lines.delete();
  }
}

/**
 * Correct skew by rotating image
 */
function correctSkew(imageData: ImageData, angle: number): ImageData {
  const src = cv.matFromImageData(imageData);
  const dst = new cv.Mat();

  try {
    const center = new cv.Point(src.cols / 2, src.rows / 2);
    const M = cv.getRotationMatrix2D(center, angle, 1.0);

    cv.warpAffine(
      src,
      dst,
      M,
      new cv.Size(src.cols, src.rows),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT
    );

    const result = new ImageData(
      new Uint8ClampedArray(dst.data),
      dst.cols,
      dst.rows
    );

    M.delete();
    return result;
  } finally {
    src.delete();
    dst.delete();
  }
}

/**
 * Handle incoming messages
 */
self.onmessage = (event: MessageEvent<OpenCVWorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'init': {
        // OpenCV should already be loaded in main thread
        // Worker just needs to verify it's available
        isReady = typeof cv !== 'undefined';
        const response: OpenCVWorkerResponse = { type: 'ready' };
        self.postMessage(response);
        break;
      }

      case 'detectEdges': {
        if (!isReady) {
          throw new Error('OpenCV not initialized');
        }
        const edges = detectDocumentEdges(message.imageData);
        const response: OpenCVWorkerResponse = {
          type: 'edges',
          edges,
          id: message.id,
        };
        self.postMessage(response);
        break;
      }

      case 'correctPerspective': {
        if (!isReady) {
          throw new Error('OpenCV not initialized');
        }
        const corrected = correctPerspective(message.imageData, message.corners);
        const response: OpenCVWorkerResponse = {
          type: 'corrected',
          imageData: corrected,
          id: message.id,
        };
        // Transfer the buffer for efficiency
        (self as unknown as Worker).postMessage(response, [corrected.data.buffer]);
        break;
      }

      case 'detectSkew': {
        if (!isReady) {
          throw new Error('OpenCV not initialized');
        }
        const skew = detectSkewAngle(message.imageData);
        const response: OpenCVWorkerResponse = {
          type: 'skew',
          result: skew,
          id: message.id,
        };
        self.postMessage(response);
        break;
      }

      case 'correctSkew': {
        if (!isReady) {
          throw new Error('OpenCV not initialized');
        }
        const corrected = correctSkew(message.imageData, message.angle);
        const response: OpenCVWorkerResponse = {
          type: 'corrected',
          imageData: corrected,
          id: message.id,
        };
        (self as unknown as Worker).postMessage(response, [corrected.data.buffer]);
        break;
      }

      default: {
        const response: OpenCVWorkerResponse = {
          type: 'error',
          error: `Unknown message type: ${(message as { type: string }).type}`,
          id: (message as { id: string }).id,
        };
        self.postMessage(response);
      }
    }
  } catch (error) {
    const response: OpenCVWorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      id: (message as { id: string }).id,
    };
    self.postMessage(response);
  }
};

export {};
