import { useRef, useCallback, useState, useEffect } from 'react';
import type { LabelScanSessionStatus, LabelScanJoinResponse, LabelScanUploadResponse } from '../types';
import { saveSession, getSession, deleteSession } from '../utils/sessionStorage';

export interface UseLabelScanSession {
  status: LabelScanSessionStatus;
  sessionId: string | null;
  error: string | null;
  uploadCount: number;
  join: (code: string) => Promise<boolean>;
  upload: (imageBlob: Blob) => Promise<{ success: boolean; scanItemId?: string; error?: string }>;
  disconnect: () => void;
  /** Try to restore a previous session */
  restoreSession: () => Promise<boolean>;
  /** Whether a stored session exists */
  hasStoredSession: boolean;
}

// Environment configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://api.quickprx.com';

// Session validity duration (30 minutes by default)
const SESSION_VALIDITY_MS = 30 * 60 * 1000;

export function useLabelScanSession(): UseLabelScanSession {
  const [status, setStatus] = useState<LabelScanSessionStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const [hasStoredSession, setHasStoredSession] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Check for stored session on mount
  useEffect(() => {
    const checkStoredSession = async () => {
      const stored = await getSession('label');
      setHasStoredSession(stored !== null);
    };
    checkStoredSession();
  }, []);

  const join = useCallback(async (code: string): Promise<boolean> => {
    setStatus('joining');
    setError(null);

    try {
      const response = await fetch(`${API_URL}/v1/label-scan/sessions/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pair_code: code }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to join. Please try again.';
        try {
          const errorData = await response.json();
          if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (response.status === 404) {
            errorMessage = 'Invalid code. Please check and try again.';
          } else if (response.status === 400) {
            errorMessage = 'Code is required.';
          }
        } catch {
          // JSON parse failed, use default message
        }
        setError(errorMessage);
        setStatus('error');
        return false;
      }

      const data = (await response.json()) as LabelScanJoinResponse;
      setSessionId(data.session_id);
      sessionIdRef.current = data.session_id;
      tokenRef.current = data.token;
      setUploadCount(0);
      setStatus('active');

      // Save session for recovery
      await saveSession({
        id: 'label',
        sessionId: data.session_id,
        token: data.token,
        expiresAt: Date.now() + SESSION_VALIDITY_MS,
        createdAt: Date.now(),
        pairCode: code,
      });
      setHasStoredSession(true);

      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Network error. Please check your connection.';
      setError(message);
      setStatus('error');
      return false;
    }
  }, []);

  const upload = useCallback(
    async (imageBlob: Blob): Promise<{ success: boolean; scanItemId?: string; error?: string }> => {
      if (!sessionIdRef.current || !tokenRef.current) {
        return { success: false, error: 'Not connected to a session' };
      }

      const previousStatus = status;
      setStatus('uploading');

      try {
        const formData = new FormData();
        formData.append('image', imageBlob);

        const response = await fetch(
          `${API_URL}/v1/label-scan/sessions/${sessionIdRef.current}/upload`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokenRef.current}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          let errorMessage = 'Upload failed. Please try again.';
          try {
            const errorData = await response.json();
            if (typeof errorData.message === 'string') {
              errorMessage = errorData.message;
            } else if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (response.status === 401) {
              errorMessage = 'Session expired. Please reconnect.';
            } else if (response.status === 403) {
              errorMessage = 'Invalid session token.';
            } else if (response.status === 400) {
              errorMessage = 'Upload failed. Please try again.';
            }
          } catch {
            // JSON parse failed, use default message
          }
          setStatus(previousStatus === 'uploading' ? 'active' : previousStatus);
          return { success: false, error: errorMessage };
        }

        const data = (await response.json()) as LabelScanUploadResponse;
        setUploadCount((prev) => prev + 1);
        setStatus('active');
        return { success: true, scanItemId: data.scan_item.pk };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Network error. Please check your connection.';
        setStatus(previousStatus === 'uploading' ? 'active' : previousStatus);
        return { success: false, error: message };
      }
    },
    [status]
  );

  const disconnect = useCallback(async () => {
    // Notify server that phone is leaving the session
    if (sessionIdRef.current && tokenRef.current) {
      try {
        await fetch(`${API_URL}/v1/label-scan/sessions/${sessionIdRef.current}/leave`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
          },
        });
      } catch (err) {
        // Ignore errors - we're disconnecting anyway
        console.warn('Failed to notify server of disconnect:', err);
      }
    }

    // Clear local state
    setStatus('idle');
    setSessionId(null);
    setError(null);
    setUploadCount(0);
    tokenRef.current = null;
    sessionIdRef.current = null;

    // Clear stored session
    await deleteSession('label');
    setHasStoredSession(false);
  }, []);

  // Auto-disconnect when page unloads or component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use fetch with keepalive for reliable delivery during page unload
      if (sessionIdRef.current && tokenRef.current) {
        const url = `${API_URL}/v1/label-scan/sessions/${sessionIdRef.current}/leave`;

        fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
          },
          keepalive: true,
        }).catch(() => {
          // Ignore errors during unload
        });
      }
    };

    // Add event listener for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also disconnect on unmount
      handleBeforeUnload();
    };
  }, []); // Empty deps - we use refs to access current values

  /**
   * Restore a previous session from storage
   * Validates the token is still active before restoring
   */
  const restoreSession = useCallback(async (): Promise<boolean> => {
    const stored = await getSession('label');

    if (!stored) {
      setHasStoredSession(false);
      return false;
    }

    // Validate the token is still active by making a test request
    setStatus('joining');
    setError(null);

    try {
      // Try to get session status to validate token
      const response = await fetch(
        `${API_URL}/v1/label-scan/sessions/${stored.sessionId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${stored.token}`,
          },
        }
      );

      if (!response.ok) {
        // Token is invalid or session expired
        await deleteSession('label');
        setHasStoredSession(false);
        setStatus('idle');

        if (response.status === 401 || response.status === 403) {
          setError('Session expired. Please reconnect.');
        } else if (response.status === 404) {
          setError('Session no longer exists. Please reconnect.');
        } else {
          setError('Failed to restore session. Please reconnect.');
        }

        return false;
      }

      // Session is valid, restore it
      setSessionId(stored.sessionId);
      sessionIdRef.current = stored.sessionId;
      tokenRef.current = stored.token;
      setStatus('active');
      setError(null);

      return true;
    } catch (err) {
      // Network error - still try to restore (offline support)
      // The upload will fail if the session is invalid
      console.warn('Could not validate session, restoring anyway:', err);

      setSessionId(stored.sessionId);
      sessionIdRef.current = stored.sessionId;
      tokenRef.current = stored.token;
      setStatus('active');
      setError(null);

      return true;
    }
  }, []);

  return {
    status,
    sessionId,
    error,
    uploadCount,
    join,
    upload,
    disconnect,
    restoreSession,
    hasStoredSession,
  };
}
