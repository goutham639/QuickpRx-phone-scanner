import { useEffect, useRef, useState, RefObject } from 'react';
import { detectDocumentBoundary, type DetectedDocument } from '../utils/documentDetector';

interface UseLabelDetectionResult {
  detectedDoc: DetectedDocument | null;
  isDetecting: boolean;
}

/**
 * Hook to detect label boundaries in real-time from video feed
 */
export function useLabelDetection(
  videoRef: RefObject<HTMLVideoElement>,
  enabled: boolean = true
): UseLabelDetectionResult {
  const [detectedDoc, setDetectedDoc] = useState<DetectedDocument | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !videoRef.current) {
      setDetectedDoc(null);
      return;
    }

    const video = videoRef.current;

    // Create off-screen canvas for analysis
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) return;

    let lastDetectionTime = 0;
    const detectionInterval = 500; // Detect every 500ms (2 FPS)

    const detectFrame = () => {
      if (!video || !video.videoWidth || !video.videoHeight) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      const now = Date.now();
      if (now - lastDetectionTime < detectionInterval) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      lastDetectionTime = now;
      setIsDetecting(true);

      // Downscale for faster processing (320px width)
      const scale = 320 / video.videoWidth;
      canvas.width = 320;
      canvas.height = Math.floor(video.videoHeight * scale);

      // Draw current video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Detect document
      try {
        const detected = detectDocumentBoundary(imageData);

        if (detected && detected.confidence > 0.3) {
          // Scale corners back to video dimensions
          const scaleBack = video.videoWidth / canvas.width;
          const scaledDoc: DetectedDocument = {
            ...detected,
            corners: detected.corners.map((corner) => ({
              x: corner.x * scaleBack,
              y: corner.y * scaleBack,
            })) as [typeof detected.corners[0], typeof detected.corners[1], typeof detected.corners[2], typeof detected.corners[3]],
          };
          setDetectedDoc(scaledDoc);
        } else {
          setDetectedDoc(null);
        }
      } catch (error) {
        console.error('Document detection error:', error);
        setDetectedDoc(null);
      }

      setIsDetecting(false);
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    // Start detection loop
    animationFrameRef.current = requestAnimationFrame(detectFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef, enabled]);

  return {
    detectedDoc,
    isDetecting,
  };
}
