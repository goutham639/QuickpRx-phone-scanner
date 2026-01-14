import { useRef, useCallback, useState, useEffect } from 'react';

export type LabelCaptureStatus = 'idle' | 'starting' | 'active' | 'capturing' | 'error';

export interface UseLabelCapture {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: LabelCaptureStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Promise<Blob | null>;
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

  const [status, setStatus] = useState<LabelCaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);

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

    // Convert to JPEG blob with 0.85 quality
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);

    setStatus('active');

    return blob;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    status,
    error,
    start,
    stop,
    capture,
  };
}
