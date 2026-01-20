/**
 * Session Storage Utility
 * Persists session tokens in IndexedDB for session recovery after page refresh
 */

const DB_NAME = 'quickprx-scanner';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export interface StoredSession {
  id: string; // 'barcode' or 'label'
  sessionId: string;
  token: string;
  expiresAt?: number; // Unix timestamp
  createdAt: number;
  pairCode?: string;
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create sessions store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save a session to IndexedDB
 */
export async function saveSession(session: StoredSession): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put(session);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to save session'));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.warn('Session storage not available:', error);
  }
}

/**
 * Get a session from IndexedDB
 */
export async function getSession(id: 'barcode' | 'label'): Promise<StoredSession | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(id);

      request.onsuccess = () => {
        const session = request.result as StoredSession | undefined;

        // Check if session exists and is not expired
        if (session) {
          const now = Date.now();

          // Check expiration if set
          if (session.expiresAt && session.expiresAt < now) {
            // Session expired, delete it
            deleteSession(id);
            resolve(null);
            return;
          }

          // Session is valid
          resolve(session);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to get session'));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.warn('Session storage not available:', error);
    return null;
  }
}

/**
 * Delete a session from IndexedDB
 */
export async function deleteSession(id: 'barcode' | 'label'): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete session'));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.warn('Session storage not available:', error);
  }
}

/**
 * Clear all sessions from IndexedDB
 */
export async function clearAllSessions(): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to clear sessions'));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.warn('Session storage not available:', error);
  }
}

/**
 * Check if IndexedDB is available
 */
export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
