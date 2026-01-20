/**
 * OpenCV.js Lazy Loader Hook
 * Loads opencv.js only when advanced features are enabled
 * Caches in IndexedDB to avoid re-downloading
 */

import { useCallback, useState, useEffect } from 'react';
import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';
import type { OpenCVStatus } from '../types/imageCapture';

// OpenCV type - cv object has complex API, use any for now
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenCVInstance = any;

// Global cv instance placeholder
declare global {
  interface Window {
    cv: OpenCVInstance | undefined;
    Module: {
      onRuntimeInitialized?: () => void;
    };
  }
}

export interface UseOpenCV {
  /** Current loading status */
  status: OpenCVStatus;
  /** Error message if loading failed */
  error: string | null;
  /** Whether OpenCV is ready to use */
  isReady: boolean;
  /** Load OpenCV (call when user enables advanced features) */
  load: () => Promise<boolean>;
  /** Get the cv instance */
  cv: typeof window.cv;
}

// Singleton state for OpenCV loading
let globalStatus: OpenCVStatus = 'idle';
let globalError: string | null = null;
let loadPromise: Promise<boolean> | null = null;
const listeners: Set<() => void> = new Set();

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Open IndexedDB for caching
 */
async function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('opencv-cache', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('scripts')) {
        db.createObjectStore('scripts');
      }
    };
  });
}

/**
 * Get cached script from IndexedDB
 */
async function getCachedScript(db: IDBDatabase): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction('scripts', 'readonly');
      const store = transaction.objectStore('scripts');
      const request = store.get(IMAGE_CAPTURE_CONFIG.opencvCacheKey);

      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result || null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Cache script in IndexedDB
 */
async function cacheScript(db: IDBDatabase, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('scripts', 'readwrite');
      const store = transaction.objectStore('scripts');
      const request = store.put(script, IMAGE_CAPTURE_CONFIG.opencvCacheKey);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Load and execute script
 */
function executeScript(scriptContent: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Set up callback for when OpenCV is ready
      window.Module = {
        onRuntimeInitialized: () => {
          resolve();
        },
      };

      // Create and execute script
      const script = document.createElement('script');
      script.textContent = scriptContent;
      script.onerror = () => reject(new Error('Failed to execute OpenCV script'));
      document.head.appendChild(script);

      // Timeout fallback (OpenCV takes time to initialize)
      setTimeout(() => {
        if (window.cv) {
          resolve();
        }
      }, 5000);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetch script from CDN
 */
async function fetchScript(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenCV: ${response.status}`);
  }
  return response.text();
}

/**
 * Core loading function (singleton)
 */
async function loadOpenCVCore(): Promise<boolean> {
  // Already loaded
  if (window.cv) {
    globalStatus = 'ready';
    notifyListeners();
    return true;
  }

  // Already loading
  if (loadPromise) {
    return loadPromise;
  }

  globalStatus = 'loading';
  globalError = null;
  notifyListeners();

  loadPromise = (async () => {
    try {
      // Try to get cached version
      let scriptContent: string | null = null;
      let db: IDBDatabase | null = null;

      try {
        db = await openCache();
        scriptContent = await getCachedScript(db);
      } catch (cacheError) {
        console.warn('IndexedDB cache unavailable:', cacheError);
      }

      // Fetch if not cached
      if (!scriptContent) {
        scriptContent = await fetchScript(IMAGE_CAPTURE_CONFIG.opencvCdnUrl);

        // Cache for next time
        if (db && scriptContent) {
          try {
            await cacheScript(db, scriptContent);
          } catch (cacheError) {
            console.warn('Failed to cache OpenCV:', cacheError);
          }
        }
      }

      // Execute the script
      await executeScript(scriptContent);

      // Verify cv is available
      if (!window.cv) {
        throw new Error('OpenCV failed to initialize');
      }

      globalStatus = 'ready';
      globalError = null;
      notifyListeners();
      return true;
    } catch (err) {
      globalStatus = 'error';
      globalError = err instanceof Error ? err.message : 'Failed to load OpenCV';
      notifyListeners();
      loadPromise = null; // Allow retry
      return false;
    }
  })();

  return loadPromise;
}

/**
 * Hook for lazy loading OpenCV.js
 * Uses singleton pattern to ensure only one instance is loaded
 */
export function useOpenCV(): UseOpenCV {
  const [, forceUpdate] = useState({});

  // Subscribe to global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  /**
   * Load OpenCV
   */
  const load = useCallback(async (): Promise<boolean> => {
    return loadOpenCVCore();
  }, []);

  return {
    status: globalStatus,
    error: globalError,
    isReady: globalStatus === 'ready',
    load,
    cv: window.cv,
  };
}

/**
 * Check if OpenCV is already loaded
 */
export function isOpenCVReady(): boolean {
  return globalStatus === 'ready' && !!window.cv;
}

/**
 * Get OpenCV instance (throws if not ready)
 */
export function getOpenCV(): typeof window.cv {
  if (!window.cv) {
    throw new Error('OpenCV not loaded. Call useOpenCV().load() first.');
  }
  return window.cv;
}
