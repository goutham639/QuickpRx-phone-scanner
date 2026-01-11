import { useEffect, useState, useCallback } from 'react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { SessionStatus } from '../types';
import ScanFeedback from './ScanFeedback';

interface ScannerProps {
  status: SessionStatus;
  scanCount: number;
  onScan: (barcode: string) => void;
  onDisconnect: () => void;
}

export default function Scanner({
  status,
  scanCount,
  onScan,
  onDisconnect,
}: ScannerProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [feedbackBarcode, setFeedbackBarcode] = useState<string | null>(null);

  const handleScan = useCallback(
    (barcode: string) => {
      if (isPaused) return;

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
    [onScan, isPaused]
  );

  const { videoRef, isActive, error, start, stop } = useBarcodeScanner(handleScan);

  // Auto-start camera on mount
  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

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
    <div className="h-screen flex flex-col bg-black">
      {/* Scan Feedback Overlay */}
      <ScanFeedback barcode={feedbackBarcode} onComplete={handleFeedbackComplete} />

      {/* Header Bar */}
      <div className="safe-top bg-black/80 backdrop-blur flex items-center justify-between px-4 py-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-white text-sm">
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>

        {/* Scan Count Badge */}
        <div className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full">
          {scanCount} {scanCount === 1 ? 'scan' : 'scans'}
        </div>

        {/* Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Disconnect"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        {/* Video Element */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6">
            <svg
              className="w-16 h-16 text-red-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Scanning Frame Overlay (when camera active) */}
        {isActive && !error && (
          <>
            {/* Darkened corners */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-72 h-48">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
                </div>
              </div>
            </div>

            {/* Instruction Text */}
            <div className="absolute top-1/2 left-0 right-0 mt-32 text-center">
              <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                Point camera at barcode
              </p>
            </div>

            {/* Scanning line animation */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-48 overflow-hidden relative">
                <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-lg shadow-red-500/50 animate-scan" />
              </div>
            </div>
          </>
        )}

        {/* Paused State */}
        {isPaused && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-white text-xl font-semibold">Scanning Paused</p>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="safe-bottom bg-black/80 backdrop-blur px-4 py-4">
        {/* Last Scanned */}
        <div className="mb-4 text-center min-h-[2rem]">
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
          className={`w-full py-4 rounded-xl font-semibold text-white transition-colors
                     ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
        >
          {isPaused ? 'Resume Scanning' : 'Pause Scanning'}
        </button>
      </div>

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
    </div>
  );
}
