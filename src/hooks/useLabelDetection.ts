import { useEffect, useRef, useState, RefObject } from 'react';
import { detectDocumentBoundary, type DetectedDocument } from '../utils/documentDetector';

interface UseLabelDetectionResult {
  detectedDoc: DetectedDocument | null;
  isDetecting: boolean;
}

/**
 * Check if two detections are similar (for temporal filtering)
 */
function isSimilarDetection(a: DetectedDocument, b: DetectedDocument): boolean {
  // Compare corner positions - allow 50px tolerance
  const tolerance = 50;

  for (let i = 0; i < 4; i++) {
    const cornerA = a.corners[i];
    const cornerB = b.corners[i];
    if (!cornerA || !cornerB) return false;

    const dx = Math.abs(cornerA.x - cornerB.x);
    const dy = Math.abs(cornerA.y - cornerB.y);

    if (dx > tolerance || dy > tolerance) {
      return false;
    }
  }

  return true;
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
  const lastDetectionRef = useRef<DetectedDocument | null>(null);
  const stableFramesRef = useRef<number>(0);

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
    const detectionInterval = 300; // Detect every 300ms (~3 FPS)

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

        if (detected && detected.confidence > 0.6) {
          // Scale corners back to video dimensions
          const scaleBack = video.videoWidth / canvas.width;
          const scaledDoc: DetectedDocument = {
            ...detected,
            corners: detected.corners.map((corner) => ({
              x: corner.x * scaleBack,
              y: corner.y * scaleBack,
            })) as [typeof detected.corners[0], typeof detected.corners[1], typeof detected.corners[2], typeof detected.corners[3]],
          };

          // Temporal filtering: require 2 consecutive stable detections
          if (lastDetectionRef.current && isSimilarDetection(lastDetectionRef.current, scaledDoc)) {
            stableFramesRef.current += 1;
            if (stableFramesRef.current >= 2) {
              setDetectedDoc(scaledDoc);
            }
          } else {
            stableFramesRef.current = 0;
          }

          lastDetectionRef.current = scaledDoc;
        } else {
          // No detection - clear after 1 frame
          setDetectedDoc(null);
          lastDetectionRef.current = null;
          stableFramesRef.current = 0;
        }
      } catch (error) {
        console.error('Document detection error:', error);
        setDetectedDoc(null);
        lastDetectionRef.current = null;
        stableFramesRef.current = 0;
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
