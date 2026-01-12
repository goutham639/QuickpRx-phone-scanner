export type SessionStatus = 'idle' | 'pairing' | 'paired' | 'scanning' | 'error';

export interface ScannerSessionState {
  status: SessionStatus;
  sessionId: string | null;
  error: string | null;
  scanCount: number;
}

export interface PairResponse {
  session_id: string;
  token: string;
}

export interface WebSocketMessage {
  type: string;
  session_id?: string;
  barcode?: string;
  scanned_at?: string;
  error?: string;
  data?: { id: number; barcode: string; scanned_at: string };
}
