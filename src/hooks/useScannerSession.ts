import { useRef, useCallback, useState, useEffect } from 'react';
import type { SessionStatus, PairResponse, WebSocketMessage } from '../types';
import { saveSession, getSession, deleteSession } from '../utils/sessionStorage';

export interface UseScannerSession {
  status: SessionStatus;
  sessionId: string | null;
  error: string | null;
  lastScanError: string | null;
  scanCount: number;
  pair: (code: string) => Promise<boolean>;
  sendScan: (barcode: string) => void;
  disconnect: () => void;
  clearScanError: () => void;
  /** Try to restore a previous session */
  restoreSession: () => Promise<boolean>;
  /** Whether a stored session exists */
  hasStoredSession: boolean;
}

// Environment configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://api.quickprx.com';
const WS_URL = API_URL.replace(/^http/, 'ws');

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

// Session validity duration (30 minutes by default)
const SESSION_VALIDITY_MS = 30 * 60 * 1000;

export function useScannerSession(): UseScannerSession {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScanError, setLastScanError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [hasStoredSession, setHasStoredSession] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingScansRef = useRef<WebSocketMessage[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Check for stored session on mount
  useEffect(() => {
    const checkStoredSession = async () => {
      const stored = await getSession('barcode');
      setHasStoredSession(stored !== null);
    };
    checkStoredSession();
  }, []);

  const connectWebSocket = useCallback((token: string) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Reconnecting');
    }

    const wsUrl = `${WS_URL}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setStatus('paired');
      setError(null);

      // Send any pending scans
      while (pendingScansRef.current.length > 0) {
        const scan = pendingScansRef.current.shift();
        if (scan && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(scan));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;

        switch (data.type) {
          case 'connected':
            setStatus('paired');
            break;
          case 'error':
            setError(typeof data.error === 'string' ? data.error : 'Unknown error');
            setStatus('error');
            break;
          case 'session.closed':
            setStatus('idle');
            setSessionId(null);
            setError('Session was closed');
            break;
          case 'scan.confirmed':
            // Server confirmed scan was stored successfully
            break;
          case 'scan.error':
            // Server rejected the scan
            setLastScanError(typeof data.error === 'string' ? data.error : 'Scan failed');
            break;
        }
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    ws.onerror = () => {
      setError('Connection error');
    };

    ws.onclose = (event) => {
      // Reconnect if not intentional close and session still active
      if (
        event.code !== 1000 &&
        tokenRef.current &&
        reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS
      ) {
        reconnectAttemptRef.current++;
        setStatus('pairing');

        reconnectTimeoutRef.current = setTimeout(() => {
          if (tokenRef.current) {
            connectWebSocket(tokenRef.current);
          }
        }, RECONNECT_DELAY);
      } else if (event.code !== 1000) {
        setStatus('error');
        setError('Connection lost. Please reconnect.');
      }
    };

    wsRef.current = ws;
  }, []);

  const pair = useCallback(
    async (code: string): Promise<boolean> => {
      setStatus('pairing');
      setError(null);

      try {
        const response = await fetch(`${API_URL}/v1/scan-sessions/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pair_code: code }),
        });

        if (!response.ok) {
          let errorMessage = 'Failed to pair. Please try again.';
          try {
            const errorData = await response.json();
            // Extract message string - API returns {code, message, details, requestId}
            if (typeof errorData.message === 'string') {
              errorMessage = errorData.message;
            } else if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (response.status === 404) {
              errorMessage = 'Invalid code. Please check and try again.';
            }
          } catch {
            // JSON parse failed, use default message
          }
          setError(errorMessage);
          setStatus('error');
          return false;
        }

        const data = (await response.json()) as PairResponse;
        setSessionId(data.session_id);
        tokenRef.current = data.token;
        setScanCount(0);
        pendingScansRef.current = [];

        // Save session for recovery
        await saveSession({
          id: 'barcode',
          sessionId: data.session_id,
          token: data.token,
          expiresAt: Date.now() + SESSION_VALIDITY_MS,
          createdAt: Date.now(),
          pairCode: code,
        });
        setHasStoredSession(true);

        // Connect WebSocket with token
        connectWebSocket(data.token);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Network error. Please check your connection.';
        setError(message);
        setStatus('error');
        return false;
      }
    },
    [connectWebSocket]
  );

  const sendScan = useCallback((barcode: string) => {
    const message: WebSocketMessage = {
      type: 'scan.submit',
      session_id: sessionIdRef.current || undefined,
      barcode,
      scanned_at: new Date().toISOString(),
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue for later if disconnected
      pendingScansRef.current.push(message);
    }

    setScanCount((prev) => prev + 1);
  }, []);

  const disconnect = useCallback(async () => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }

    // Reset state
    setStatus('idle');
    setSessionId(null);
    setError(null);
    setLastScanError(null);
    setScanCount(0);
    reconnectAttemptRef.current = 0;
    pendingScansRef.current = [];
    tokenRef.current = null;

    // Clear stored session
    await deleteSession('barcode');
    setHasStoredSession(false);
  }, []);

  /**
   * Restore a previous session from storage
   */
  const restoreSession = useCallback(async (): Promise<boolean> => {
    const stored = await getSession('barcode');

    if (!stored) {
      setHasStoredSession(false);
      return false;
    }

    // Session found, restore it
    setSessionId(stored.sessionId);
    tokenRef.current = stored.token;
    setScanCount(0);
    pendingScansRef.current = [];
    setError(null);

    // Reconnect WebSocket
    connectWebSocket(stored.token);

    return true;
  }, [connectWebSocket]);

  const clearScanError = useCallback(() => {
    setLastScanError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []);

  return {
    status,
    sessionId,
    error,
    lastScanError,
    scanCount,
    pair,
    sendScan,
    disconnect,
    clearScanError,
    restoreSession,
    hasStoredSession,
  };
}
