/**
 * Hook for image quality analysis using Web Worker
 * Provides off-thread image quality checks
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import type {
  ImageQualityResult,
  ImageQualityWorkerMessage,
  ImageQualityWorkerResponse,
} from '../types/imageCapture';
import { analyzeImageQualityFast } from '../utils/imageAnalysis';

export interface UseImageQuality {
  /** Whether the worker is ready */
  isReady: boolean;
  /** Analyze image quality (async, runs in worker) */
  analyzeQuality: (imageData: ImageData) => Promise<ImageQualityResult>;
  /** Get blur score only (async, runs in worker) */
  getBlurScore: (imageData: ImageData) => Promise<number>;
  /** Quick synchronous analysis for preview (runs on main thread) */
  analyzeQualitySync: (imageData: ImageData) => ImageQualityResult;
}

/**
 * Generate unique ID for worker messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for image quality analysis
 * Uses Web Worker for heavy computation, with fallback to main thread
 */
export function useImageQuality(): UseImageQuality {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>>(new Map());
  const [isReady, setIsReady] = useState(false);

  // Initialize worker
  useEffect(() => {
    try {
      // Create worker using Vite's worker import syntax
      const worker = new Worker(
        new URL('../workers/imageQuality.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<ImageQualityWorkerResponse | { type: 'ready' }>) => {
        const data = event.data;

        if (data.type === 'ready') {
          setIsReady(true);
          return;
        }

        const pending = pendingRef.current.get(data.id);
        if (!pending) return;

        pendingRef.current.delete(data.id);

        switch (data.type) {
          case 'result':
            pending.resolve(data.result);
            break;
          case 'blurScore':
            pending.resolve(data.score);
            break;
          case 'error':
            pending.reject(new Error(data.error));
            break;
        }
      };

      worker.onerror = (error) => {
        console.error('Image quality worker error:', error);
        // Reject all pending promises
        pendingRef.current.forEach(({ reject }) => {
          reject(new Error('Worker error'));
        });
        pendingRef.current.clear();
      };

      workerRef.current = worker;

      return () => {
        worker.terminate();
        workerRef.current = null;
        setIsReady(false);
      };
    } catch (error) {
      // Worker creation failed, fallback to sync analysis
      console.warn('Failed to create image quality worker, using sync fallback:', error);
      setIsReady(true); // Mark as ready to use sync fallback
    }
  }, []);

  /**
   * Analyze image quality in worker
   */
  const analyzeQuality = useCallback(async (imageData: ImageData): Promise<ImageQualityResult> => {
    // If worker not available, use sync fallback
    if (!workerRef.current) {
      return analyzeImageQualityFast(imageData);
    }

    return new Promise((resolve, reject) => {
      const id = generateId();
      pendingRef.current.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const message: ImageQualityWorkerMessage = {
        type: 'analyze',
        imageData,
        id,
      };

      workerRef.current!.postMessage(message, [imageData.data.buffer]);
    });
  }, []);

  /**
   * Get blur score only in worker
   */
  const getBlurScore = useCallback(async (imageData: ImageData): Promise<number> => {
    // If worker not available, use sync fallback
    if (!workerRef.current) {
      const result = analyzeImageQualityFast(imageData);
      return result.blurScore;
    }

    return new Promise((resolve, reject) => {
      const id = generateId();
      pendingRef.current.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const message: ImageQualityWorkerMessage = {
        type: 'analyzeBlur',
        imageData,
        id,
      };

      workerRef.current!.postMessage(message, [imageData.data.buffer]);
    });
  }, []);

  /**
   * Synchronous quality analysis for preview (main thread)
   */
  const analyzeQualitySync = useCallback((imageData: ImageData): ImageQualityResult => {
    return analyzeImageQualityFast(imageData);
  }, []);

  return {
    isReady,
    analyzeQuality,
    getBlurScore,
    analyzeQualitySync,
  };
}
