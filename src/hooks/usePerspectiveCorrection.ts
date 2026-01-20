/**
 * Perspective Correction Hook
 * Uses OpenCV for document detection, edge detection, and perspective correction
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { useOpenCV } from './useOpenCV';
import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';
import type {
  DocumentEdges,
  SkewDetectionResult,
  Point,
  OpenCVWorkerMessage,
  OpenCVWorkerResponse,
} from '../types/imageCapture';

export type PerspectiveCorrectionStatus = 'idle' | 'detecting' | 'correcting' | 'ready' | 'error';

export interface UsePerspectiveCorrection {
  /** Current processing status */
  status: PerspectiveCorrectionStatus;
  /** Whether OpenCV is available */
  isAvailable: boolean;
  /** Last detected edges */
  detectedEdges: DocumentEdges | null;
  /** Last detected skew */
  detectedSkew: SkewDetectionResult | null;
  /** Error message if any */
  error: string | null;
  /** Detect document edges in image */
  detectEdges: (imageData: ImageData) => Promise<DocumentEdges>;
  /** Correct perspective using detected or provided corners */
  correctPerspective: (
    imageData: ImageData,
    corners?: [Point, Point, Point, Point]
  ) => Promise<ImageData | null>;
  /** Detect skew angle */
  detectSkew: (imageData: ImageData) => Promise<SkewDetectionResult>;
  /** Correct skew by angle */
  correctSkew: (imageData: ImageData, angle?: number) => Promise<ImageData | null>;
  /** Auto-process: detect edges, correct perspective, detect and correct skew */
  autoProcess: (imageData: ImageData) => Promise<ImageData>;
}

/**
 * Generate unique ID for worker messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for perspective correction using OpenCV
 */
export function usePerspectiveCorrection(): UsePerspectiveCorrection {
  const { isReady: isOpenCVReady, load: loadOpenCV } = useOpenCV();
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>>(new Map());

  const [status, setStatus] = useState<PerspectiveCorrectionStatus>('idle');
  const [detectedEdges, setDetectedEdges] = useState<DocumentEdges | null>(null);
  const [detectedSkew, setDetectedSkew] = useState<SkewDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize worker when OpenCV is ready
  useEffect(() => {
    if (!isOpenCVReady) return;

    try {
      const worker = new Worker(
        new URL('../workers/opencv.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<OpenCVWorkerResponse>) => {
        const data = event.data;

        if (data.type === 'ready') {
          return;
        }

        const pending = pendingRef.current.get(data.id);
        if (!pending) return;

        pendingRef.current.delete(data.id);

        switch (data.type) {
          case 'edges':
            pending.resolve(data.edges);
            break;
          case 'corrected':
            pending.resolve(data.imageData);
            break;
          case 'skew':
            pending.resolve(data.result);
            break;
          case 'error':
            pending.reject(new Error(data.error));
            break;
        }
      };

      worker.onerror = (err) => {
        console.error('OpenCV worker error:', err);
        pendingRef.current.forEach(({ reject }) => {
          reject(new Error('Worker error'));
        });
        pendingRef.current.clear();
      };

      // Initialize worker
      worker.postMessage({ type: 'init' } as OpenCVWorkerMessage);
      workerRef.current = worker;

      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch (err) {
      console.error('Failed to create OpenCV worker:', err);
    }
  }, [isOpenCVReady]);

  /**
   * Send message to worker and wait for response
   */
  const sendWorkerMessage = useCallback(
    <T>(message: OpenCVWorkerMessage, transfer?: Transferable[]): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const id = generateId();
        pendingRef.current.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });

        const messageWithId = { ...message, id };
        if (transfer) {
          workerRef.current.postMessage(messageWithId, transfer);
        } else {
          workerRef.current.postMessage(messageWithId);
        }
      });
    },
    []
  );

  /**
   * Detect document edges
   */
  const detectEdges = useCallback(
    async (imageData: ImageData): Promise<DocumentEdges> => {
      if (!isOpenCVReady) {
        // Try to load OpenCV
        const loaded = await loadOpenCV();
        if (!loaded) {
          throw new Error('OpenCV not available');
        }
      }

      setStatus('detecting');
      setError(null);

      try {
        const edges = await sendWorkerMessage<DocumentEdges>({
          type: 'detectEdges',
          imageData,
          id: '',
        });

        setDetectedEdges(edges);
        setStatus('ready');
        return edges;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Detection failed';
        setError(message);
        setStatus('error');
        throw err;
      }
    },
    [isOpenCVReady, loadOpenCV, sendWorkerMessage]
  );

  /**
   * Correct perspective
   */
  const correctPerspective = useCallback(
    async (
      imageData: ImageData,
      corners?: [Point, Point, Point, Point]
    ): Promise<ImageData | null> => {
      // Use provided corners or detected edges
      const cornersToUse = corners || detectedEdges?.corners;

      if (!cornersToUse) {
        // Try to detect edges first
        const edges = await detectEdges(imageData);
        if (!edges.detected || !edges.corners) {
          return null;
        }
        return correctPerspective(imageData, edges.corners);
      }

      setStatus('correcting');
      setError(null);

      try {
        const corrected = await sendWorkerMessage<ImageData>({
          type: 'correctPerspective',
          imageData,
          corners: cornersToUse,
          id: '',
        });

        setStatus('ready');
        return corrected;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Correction failed';
        setError(message);
        setStatus('error');
        return null;
      }
    },
    [detectedEdges, detectEdges, sendWorkerMessage]
  );

  /**
   * Detect skew angle
   */
  const detectSkew = useCallback(
    async (imageData: ImageData): Promise<SkewDetectionResult> => {
      if (!isOpenCVReady) {
        const loaded = await loadOpenCV();
        if (!loaded) {
          throw new Error('OpenCV not available');
        }
      }

      setStatus('detecting');
      setError(null);

      try {
        const skew = await sendWorkerMessage<SkewDetectionResult>({
          type: 'detectSkew',
          imageData,
          id: '',
        });

        setDetectedSkew(skew);
        setStatus('ready');
        return skew;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Skew detection failed';
        setError(message);
        setStatus('error');
        throw err;
      }
    },
    [isOpenCVReady, loadOpenCV, sendWorkerMessage]
  );

  /**
   * Correct skew
   */
  const correctSkew = useCallback(
    async (imageData: ImageData, angle?: number): Promise<ImageData | null> => {
      // Use provided angle or detect it
      let angleToUse = angle ?? detectedSkew?.angle;

      if (angleToUse === undefined) {
        const skew = await detectSkew(imageData);
        if (skew.confidence < IMAGE_CAPTURE_CONFIG.minSkewConfidence) {
          return imageData; // Not confident enough to correct
        }
        angleToUse = skew.angle;
      }

      // Skip if angle is negligible
      if (Math.abs(angleToUse) < 0.5) {
        return imageData;
      }

      setStatus('correcting');
      setError(null);

      try {
        const corrected = await sendWorkerMessage<ImageData>({
          type: 'correctSkew',
          imageData,
          angle: angleToUse,
          id: '',
        });

        setStatus('ready');
        return corrected;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Skew correction failed';
        setError(message);
        setStatus('error');
        return null;
      }
    },
    [detectedSkew, detectSkew, sendWorkerMessage]
  );

  /**
   * Auto-process: detect and correct perspective, then skew
   */
  const autoProcess = useCallback(
    async (imageData: ImageData): Promise<ImageData> => {
      let processed = imageData;

      // Step 1: Detect and correct perspective if enabled
      if (IMAGE_CAPTURE_CONFIG.enablePerspectiveCorrection) {
        try {
          const edges = await detectEdges(processed);
          if (
            edges.detected &&
            edges.corners &&
            edges.confidence >= IMAGE_CAPTURE_CONFIG.minEdgeConfidence
          ) {
            const corrected = await correctPerspective(processed, edges.corners);
            if (corrected) {
              processed = corrected;
            }
          }
        } catch (err) {
          console.warn('Perspective correction failed:', err);
        }
      }

      // Step 2: Detect and correct skew if enabled
      if (IMAGE_CAPTURE_CONFIG.enableAutoRotate) {
        try {
          const skew = await detectSkew(processed);
          if (
            skew.confidence >= IMAGE_CAPTURE_CONFIG.minSkewConfidence &&
            Math.abs(skew.angle) >= 0.5 &&
            Math.abs(skew.angle) <= IMAGE_CAPTURE_CONFIG.maxSkewAngle
          ) {
            const corrected = await correctSkew(processed, skew.angle);
            if (corrected) {
              processed = corrected;
            }
          }
        } catch (err) {
          console.warn('Skew correction failed:', err);
        }
      }

      return processed;
    },
    [detectEdges, correctPerspective, detectSkew, correctSkew]
  );

  return {
    status,
    isAvailable: isOpenCVReady,
    detectedEdges,
    detectedSkew,
    error,
    detectEdges,
    correctPerspective,
    detectSkew,
    correctSkew,
    autoProcess,
  };
}
