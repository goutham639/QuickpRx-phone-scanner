import { useRef, useCallback, useState, useEffect } from 'react';
import { BarcodeDetector } from 'barcode-detector';

export interface UseBarcodeScanner {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  debounceMs = 2000
): UseBarcodeScanner {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const rafRef = useRef<number>();
  const lastBarcodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize detector once
  useEffect(() => {
    detectorRef.current = new BarcodeDetector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'qr_code'],
    });
  }, []);

  const detect = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || !streamRef.current) {
      return;
    }

    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);

      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        const now = Date.now();

        // Debounce by value - don't fire same barcode within debounceMs
        if (
          barcode?.rawValue &&
          (barcode.rawValue !== lastBarcodeRef.current ||
            now - lastScanTimeRef.current > debounceMs)
        ) {
          lastBarcodeRef.current = barcode.rawValue;
          lastScanTimeRef.current = now;
          onScan(barcode.rawValue);
        }
      }
    } catch (err) {
      // Detection errors are not fatal, just continue
      console.debug('Detection frame error:', err);
    }

    // Continue detection loop
    rafRef.current = requestAnimationFrame(detect);
  }, [onScan, debounceMs]);

  const start = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
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

      setIsActive(true);

      // Start detection loop
      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access camera';

      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (message.includes('NotFoundError')) {
        setError('No camera found on this device.');
      } else {
        setError(message);
      }

      setIsActive(false);
    }
  }, [detect]);

  const stop = useCallback(() => {
    // Cancel animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
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

    // Reset debounce state
    lastBarcodeRef.current = '';
    lastScanTimeRef.current = 0;

    setIsActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    isActive,
    error,
    start,
    stop,
  };
}
