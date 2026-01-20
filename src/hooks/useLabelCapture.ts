import { useRef, useCallback, useState, useEffect } from 'react';
import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';
import { analyzeImageQualityFast } from '../utils/imageAnalysis';
import { compressCanvas } from '../utils/imageCompression';
import type { ImageQualityResult, PreviewQualityState } from '../types/imageCapture';

export type LabelCaptureStatus = 'idle' | 'starting' | 'active' | 'capturing' | 'error';

export interface UseLabelCapture {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: LabelCaptureStatus;
  error: string | null;
  previewQuality: PreviewQualityState;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Promise<Blob | null>;
  captureWithQuality: () => Promise<{ blob: Blob | null; quality: ImageQualityResult | null }>;
  getImageData: () => ImageData | null;
}

/**
 * Helper to promisify canvas.toBlob callback
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
 * Hook for camera access and photo capture for label scanning.
 * Higher resolution (1920x1080) optimized for OCR quality.
 *
 * Usage:
 * ```tsx
 * const { videoRef, status, error, start, stop, capture } = useLabelCapture();
 *
 * // Start camera
 * await start();
 *
 * // Take photo
 * const blob = await capture();
 *
 * // Stop camera
 * stop();
 * ```
 */
export function useLabelCapture(): UseLabelCapture {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityCheckIntervalRef = useRef<number | null>(null);

  const [status, setStatus] = useState<LabelCaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previewQuality, setPreviewQuality] = useState<PreviewQualityState>({
    status: 'idle',
    result: null,
    lastChecked: 0,
  });

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');

    try {
      // Request higher resolution for OCR quality
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // play() can be interrupted by unmount - catch and ignore AbortError
        try {
          await videoRef.current.play();
        } catch (playError) {
          // Ignore AbortError (play interrupted by new load/unmount)
          if (playError instanceof Error && playError.name !== 'AbortError') {
            throw playError;
          }
          return; // Don't continue if play was aborted
        }
      }

      setStatus('active');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access camera';

      if (
        message.includes('Permission denied') ||
        message.includes('NotAllowedError')
      ) {
        setError(
          'Camera permission denied. Please allow camera access and try again.'
        );
      } else if (message.includes('NotFoundError')) {
        setError('No camera found on this device.');
      } else {
        setError(message);
      }

      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    // Stop quality check loop
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }

    // Stop all stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus('idle');
    setPreviewQuality({ status: 'idle', result: null, lastChecked: 0 });
  }, []);

  /**
   * Get current frame as ImageData (for quality analysis)
   */
  const getImageData = useCallback((): ImageData | null => {
    if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_CURRENT_DATA) {
      return null;
    }

    const video = videoRef.current;

    // Lazy init canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const capture = useCallback(async (): Promise<Blob | null> => {
    if (!streamRef.current || !videoRef.current) {
      return null;
    }

    const video = videoRef.current;

    // Ensure video has data
    if (video.readyState < video.HAVE_CURRENT_DATA) {
      return null;
    }

    setStatus('capturing');

    // Lazy init canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;

    // Set canvas to video dimensions (actual rendered dimensions)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('active');
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Compress image if enabled
    let blob: Blob | null;
    if (IMAGE_CAPTURE_CONFIG.enableCompression) {
      try {
        const result = await compressCanvas(canvas);
        blob = result.blob;
      } catch {
        // Fallback to uncompressed if compression fails
        blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
      }
    } else {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
    }

    setStatus('active');

    return blob;
  }, []);

  /**
   * Capture frame with quality analysis
   */
  const captureWithQuality = useCallback(async (): Promise<{
    blob: Blob | null;
    quality: ImageQualityResult | null;
  }> => {
    if (!streamRef.current || !videoRef.current) {
      return { blob: null, quality: null };
    }

    const video = videoRef.current;

    if (video.readyState < video.HAVE_CURRENT_DATA) {
      return { blob: null, quality: null };
    }

    setStatus('capturing');

    // Lazy init canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('active');
      return { blob: null, quality: null };
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get ImageData for quality analysis
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const quality = IMAGE_CAPTURE_CONFIG.enableQualityChecks
      ? analyzeImageQualityFast(imageData)
      : null;

    // Compress image if enabled
    let blob: Blob | null;
    if (IMAGE_CAPTURE_CONFIG.enableCompression) {
      try {
        const result = await compressCanvas(canvas);
        blob = result.blob;
      } catch {
        // Fallback to uncompressed if compression fails
        blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
      }
    } else {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
    }

    setStatus('active');

    return { blob, quality };
  }, []);

  // Start quality check loop when camera is active
  useEffect(() => {
    if (status !== 'active' || !IMAGE_CAPTURE_CONFIG.enableQualityChecks) {
      return;
    }

    const intervalMs = 1000 / IMAGE_CAPTURE_CONFIG.previewQualityFps;

    const checkQuality = () => {
      const imageData = getImageData();
      if (!imageData) return;

      setPreviewQuality((prev) => ({
        ...prev,
        status: 'checking',
      }));

      try {
        const result = analyzeImageQualityFast(imageData);
        setPreviewQuality({
          status: 'ready',
          result,
          lastChecked: Date.now(),
        });
      } catch (err) {
        setPreviewQuality((prev) => ({
          ...prev,
          status: 'error',
        }));
      }
    };

    // Initial check
    checkQuality();

    // Start interval
    qualityCheckIntervalRef.current = window.setInterval(checkQuality, intervalMs);

    return () => {
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
        qualityCheckIntervalRef.current = null;
      }
    };
  }, [status, getImageData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    status,
    error,
    previewQuality,
    start,
    stop,
    capture,
    captureWithQuality,
    getImageData,
  };
}
