import { useEffect, useState, useCallback, useRef } from 'react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { SessionStatus } from '../types';
import ScanFeedback from './ScanFeedback';

interface ScannerProps {
  status: SessionStatus;
  scanCount: number;
  scanError: string | null;
  onScan: (barcode: string) => void;
  onDisconnect: () => void;
  onClearScanError: () => void;
}

// Time in ms before showing "having trouble" hint
const DETECTION_HINT_DELAY = 15000;

export default function Scanner({
  status,
  scanCount,
  scanError,
  onScan,
  onDisconnect,
  onClearScanError,
}: ScannerProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [feedbackBarcode, setFeedbackBarcode] = useState<string | null>(null);
  const [showDetectionHint, setShowDetectionHint] = useState(false);
  const detectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset detection hint timer
  const resetDetectionTimer = useCallback(() => {
    setShowDetectionHint(false);
    if (detectionTimerRef.current) {
      clearTimeout(detectionTimerRef.current);
    }
    detectionTimerRef.current = setTimeout(() => {
      setShowDetectionHint(true);
    }, DETECTION_HINT_DELAY);
  }, []);

  const handleScan = useCallback(
    (barcode: string) => {
      if (isPaused) return;

      // Reset the detection hint timer since we got a successful scan
      resetDetectionTimer();

      // Send to session
      onScan(barcode);

      // Show feedback
      setLastBarcode(barcode);
      setFeedbackBarcode(barcode);

      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    },
    [onScan, isPaused, resetDetectionTimer]
  );

  const { videoRef, isActive, error, start, stop } = useBarcodeScanner(handleScan);

  // Auto-dismiss scan error after 2 seconds
  useEffect(() => {
    if (scanError) {
      const timer = setTimeout(() => {
        onClearScanError();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanError, onClearScanError]);

  // Auto-start camera on mount
  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  // Start detection hint timer when camera becomes active
  useEffect(() => {
    if (isActive && !isPaused) {
      resetDetectionTimer();
    } else {
      // Clear timer when paused or not active
      if (detectionTimerRef.current) {
        clearTimeout(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
      setShowDetectionHint(false);
    }

    return () => {
      if (detectionTimerRef.current) {
        clearTimeout(detectionTimerRef.current);
      }
    };
  }, [isActive, isPaused, resetDetectionTimer]);

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      start();
      setIsPaused(false);
    } else {
      stop();
      setIsPaused(true);
    }
  }, [isPaused, start, stop]);

  const handleFeedbackComplete = useCallback(() => {
    setFeedbackBarcode(null);
  }, []);

  const isConnected = status === 'paired' || status === 'scanning';

  return (
    <main className="h-screen flex flex-col bg-black" role="main" aria-label="Barcode Scanner">
      {/* Scan Feedback Overlay */}
      <ScanFeedback barcode={feedbackBarcode} onComplete={handleFeedbackComplete} />

      {/* Scan Error Toast */}
      {scanError && (
        <div className="absolute top-0 left-0 right-0 z-50 safe-top" role="alert" aria-live="assertive">
          <div className="bg-red-600 text-white px-4 py-3 text-center text-sm font-medium">
            {scanError}
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="safe-top bg-black/80 backdrop-blur flex items-center justify-between px-4 py-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
            aria-hidden="true"
          />
          <span className="text-white text-sm">
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>

        {/* Scan Count Badge */}
        <div
          className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full"
          role="status"
          aria-label={`${scanCount} ${scanCount === 1 ? 'scan' : 'scans'} completed`}
        >
          {scanCount} {scanCount === 1 ? 'scan' : 'scans'}
        </div>

        {/* Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="text-white p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          aria-label="Disconnect from scanner session"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden" role="region" aria-label="Camera viewfinder">
        {/* Video Element */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          aria-label="Camera feed for barcode scanning"
        />

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6" role="alert">
            <svg
              className="w-16 h-16 text-red-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-white text-center text-lg mb-4">{error}</p>
            <button
              onClick={start}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-black"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Scanning Frame Overlay (when camera active) */}
        {isActive && !error && (
          <>
            {/* Darkened corners */}
            <div className="absolute inset-0" aria-hidden="true">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-72 h-48">
                  {/* Corner brackets with drop shadows for visibility on light backgrounds */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" />
                </div>
              </div>
            </div>

            {/* Instruction Text */}
            <div className="absolute top-1/2 left-0 right-0 mt-32 text-center space-y-2">
              <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full" role="status">
                Point camera at barcode
              </p>
              {showDetectionHint && (
                <p className="text-yellow-300 text-xs bg-black/60 inline-block px-4 py-2 rounded-full animate-pulse" role="alert">
                  Having trouble? Make sure barcode is well-lit and in focus
                </p>
              )}
            </div>

            {/* Scanning line animation */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
              <div className="w-72 h-48 overflow-hidden relative">
                <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-lg shadow-red-500/50 animate-scan" />
              </div>
            </div>
          </>
        )}

        {/* Paused State */}
        {isPaused && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70" role="status" aria-live="polite">
            <p className="text-white text-xl font-semibold">Scanning Paused</p>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <footer className="safe-bottom bg-black/80 backdrop-blur px-4 py-4">
        {/* Last Scanned */}
        <div className="mb-4 text-center min-h-[2rem]" role="status" aria-live="polite">
          {lastBarcode ? (
            <p className="text-gray-300 text-sm">
              Last: <span className="font-mono text-white">{lastBarcode}</span>
            </p>
          ) : (
            <p className="text-gray-500 text-sm">No barcodes scanned yet</p>
          )}
        </div>

        {/* Pause/Resume Button */}
        <button
          onClick={handlePauseResume}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black
                     ${isPaused ? 'bg-green-600 hover:bg-green-700 focus:ring-green-400' : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-400'}`}
          aria-pressed={isPaused}
          aria-label={isPaused ? 'Resume barcode scanning' : 'Pause barcode scanning'}
        >
          {isPaused ? 'Resume Scanning' : 'Pause Scanning'}
        </button>
      </footer>

      {/* Scanning Animation Styles */}
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: calc(100% - 2px); }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
