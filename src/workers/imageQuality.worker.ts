/**
 * Web Worker for off-thread image quality analysis
 * Keeps main thread responsive during quality checks
 */

import type {
  ImageQualityWorkerMessage,
  ImageQualityWorkerResponse,
} from '../types/imageCapture';

// Import analysis functions (will be bundled into worker)
import {
  analyzeImageQuality,
  calculateBlurScore,
} from '../utils/imageAnalysis';

/**
 * Handle incoming messages from main thread
 */
self.onmessage = (event: MessageEvent<ImageQualityWorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'analyze': {
        const result = analyzeImageQuality(message.imageData);
        const response: ImageQualityWorkerResponse = {
          type: 'result',
          result,
          id: message.id,
        };
        self.postMessage(response);
        break;
      }

      case 'analyzeBlur': {
        const score = calculateBlurScore(message.imageData);
        const response: ImageQualityWorkerResponse = {
          type: 'blurScore',
          score,
          id: message.id,
        };
        self.postMessage(response);
        break;
      }

      default: {
        const response: ImageQualityWorkerResponse = {
          type: 'error',
          error: `Unknown message type: ${(message as { type: string }).type}`,
          id: (message as { id: string }).id,
        };
        self.postMessage(response);
      }
    }
  } catch (error) {
    const response: ImageQualityWorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      id: message.id,
    };
    self.postMessage(response);
  }
};

// Notify that worker is ready
self.postMessage({ type: 'ready' });

export {}; // Make this a module
