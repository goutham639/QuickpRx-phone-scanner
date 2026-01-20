/**
 * Burst Capture Hook
 * Captures multiple frames rapidly and selects the sharpest one
 */

import { useRef, useCallback, useState } from 'react';
import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';
import { calculateBlurScore } from '../utils/imageAnalysis';
import type { BurstCaptureResult } from '../types/imageCapture';

export type BurstCaptureStatus = 'idle' | 'capturing' | 'analyzing' | 'complete';

export interface UseBurstCapture {
  /** Current burst capture status */
  status: BurstCaptureStatus;
  /** Number of frames captured so far */
  framesCaptured: number;
  /** Index of best frame after analysis (0-indexed) */
  bestFrameIndex: number | null;
  /** Capture burst of frames from video element */
  captureBurst: (
    video: HTMLVideoElement,
    frameCount?: number
  ) => Promise<BurstCaptureResult | null>;
  /** Reset state */
  reset: () => void;
}

/**
 * Helper to convert canvas to blob
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
 * Helper to get ImageData from video frame
 */
function getVideoFrameData(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): ImageData {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Wait for specified milliseconds
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hook for burst capture functionality
 * Captures N frames rapidly and returns the sharpest
 */
export function useBurstCapture(): UseBurstCapture {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<BurstCaptureStatus>('idle');
  const [framesCaptured, setFramesCaptured] = useState(0);
  const [bestFrameIndex, setBestFrameIndex] = useState<number | null>(null);

  /**
   * Capture burst of frames from video
   */
  const captureBurst = useCallback(
    async (
      video: HTMLVideoElement,
      frameCount: number = IMAGE_CAPTURE_CONFIG.burstFrameCount
    ): Promise<BurstCaptureResult | null> => {
      // Ensure video is ready
      if (video.readyState < video.HAVE_CURRENT_DATA) {
        return null;
      }

      setStatus('capturing');
      setFramesCaptured(0);
      setBestFrameIndex(null);

      // Lazy init canvas
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setStatus('idle');
        return null;
      }

      const frames: Blob[] = [];
      const imageDataArray: ImageData[] = [];

      try {
        // Capture frames at intervals
        for (let i = 0; i < frameCount; i++) {
          // Get frame data for analysis
          const imageData = getVideoFrameData(video, canvas, ctx);
          imageDataArray.push(imageData);

          // Convert to blob for storage
          const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
          if (blob) {
            frames.push(blob);
            setFramesCaptured(i + 1);
          }

          // Wait between frames (except after last)
          if (i < frameCount - 1) {
            await wait(IMAGE_CAPTURE_CONFIG.burstFrameInterval);
          }
        }

        // If no frames captured, return null
        if (frames.length === 0) {
          setStatus('idle');
          return null;
        }

        setStatus('analyzing');

        // Analyze blur scores for each frame
        const scores = imageDataArray.map((imageData) => calculateBlurScore(imageData));

        // Find best frame (highest blur score = sharpest)
        let bestIdx = 0;
        let bestScore = scores[0] ?? 0;

        for (let i = 1; i < scores.length; i++) {
          const currentScore = scores[i] ?? 0;
          if (currentScore > bestScore) {
            bestScore = currentScore;
            bestIdx = i;
          }
        }

        setBestFrameIndex(bestIdx);
        setStatus('complete');

        const bestFrame = frames[bestIdx];
        if (!bestFrame) {
          setStatus('idle');
          return null;
        }

        return {
          frames,
          scores,
          bestFrameIndex: bestIdx,
          bestFrame,
        };
      } catch (error) {
        console.error('Burst capture error:', error);
        setStatus('idle');
        return null;
      }
    },
    []
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setFramesCaptured(0);
    setBestFrameIndex(null);
  }, []);

  return {
    status,
    framesCaptured,
    bestFrameIndex,
    captureBurst,
    reset,
  };
}
