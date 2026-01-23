import { useEffect, useState, useCallback, useRef } from 'react';
import { useLabelScanSession } from '../hooks/useLabelScanSession';
import { useLabelCapture } from '../hooks/useLabelCapture';
import { useBurstCapture } from '../hooks/useBurstCapture';
import ImageQualityOverlay, { CaptureWarningModal } from './ImageQualityOverlay';
import { IMAGE_CAPTURE_CONFIG } from '../config/imageCapture';
import type { ImageQualityResult } from '../types/imageCapture';
import { preValidateImage, type PreValidationResult } from '../utils/imagePreValidation';

interface LabelScannerProps {
  onDisconnect: () => void;
  onModeSwitch: () => void;
  /** Whether to auto-restore a previous session on mount */
  autoRestore?: boolean;
}

export default function LabelScanner({ onDisconnect, onModeSwitch, autoRestore = false }: LabelScannerProps) {
  const {
    status: sessionStatus,
    sessionId,
    error: sessionError,
    uploadCount,
    join,
    upload,
    disconnect,
    restoreSession,
  } = useLabelScanSession();

  const [isRestoring, setIsRestoring] = useState(false);

  const {
    videoRef,
    status: cameraStatus,
    error: cameraError,
    previewQuality,
    start: startCamera,
    stop: stopCamera,
    captureWithQuality,
  } = useLabelCapture();

  const {
    status: burstStatus,
    framesCaptured,
    captureBurst,
    reset: resetBurst,
  } = useBurstCapture();

  // Local state
  const [code, setCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [burstModeEnabled, setBurstModeEnabled] = useState<boolean>(IMAGE_CAPTURE_CONFIG.enableBurstMode);
  const [showQualityWarning, setShowQualityWarning] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<{
    blob: Blob;
    quality: ImageQualityResult;
  } | null>(null);
  const [burstFeedback, setBurstFeedback] = useState<string | null>(null);
  const [showPreValidationWarning, setShowPreValidationWarning] = useState(false);
  const [pendingPreValidation, setPendingPreValidation] = useState<{
    blob: Blob;
    result: PreValidationResult;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-restore session on mount if requested
  useEffect(() => {
    if (autoRestore && !sessionId && !isRestoring) {
      const doRestore = async () => {
        setIsRestoring(true);
        const success = await restoreSession();
        if (!success) {
          console.log('Label session restoration failed');
        }
        setIsRestoring(false);
      };
      doRestore();
    }
  }, [autoRestore, sessionId, isRestoring, restoreSession]);

  // Auto-focus input on mount (pair code entry state)
  useEffect(() => {
    if (!sessionId && !isRestoring) {
      inputRef.current?.focus();
    }
  }, [sessionId, isRestoring]);

  // Auto-start camera when session joined
  useEffect(() => {
    if (sessionId) {
      startCamera();
    }
    return () => {
      if (sessionId) {
        stopCamera();
      }
    };
  }, [sessionId, startCamera, stopCamera]);

  // Auto-dismiss upload error after 3 seconds
  useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => {
        setUploadError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [uploadError]);

  // Handle code input
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
      setCode(digits);

      // Auto-submit when 6 digits reached
      if (digits.length === 6) {
        join(digits);
      }
    },
    [join]
  );

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (code.length === 6 && sessionStatus !== 'joining') {
        join(code);
      }
    },
    [code, sessionStatus, join]
  );

  // Auto-dismiss burst feedback after 2 seconds
  useEffect(() => {
    if (burstFeedback) {
      const timer = setTimeout(() => {
        setBurstFeedback(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [burstFeedback]);

  // Handle disconnect - defined early to avoid circular dependency
  const handleDisconnect = useCallback(() => {
    stopCamera();
    disconnect();
    onDisconnect();
  }, [stopCamera, disconnect, onDisconnect]);

  /**
   * Process and upload a captured image
   */
  const processAndUpload = useCallback(async (blob: Blob) => {
    // Show success feedback immediately (optimistic)
    setShowSuccess(true);

    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }

    // Upload the image
    const result = await upload(blob);
    if (!result.success) {
      const errorMessage = result.error || 'Upload failed';

      // Check for session expiration
      if (errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('session') ||
          errorMessage.includes('401')) {
        setUploadError('Session expired. Please reconnect.');
        // Disconnect after a short delay to let the user see the message
        setTimeout(() => {
          handleDisconnect();
        }, 2000);
      } else {
        setUploadError(errorMessage);
      }
    }

    // Hide success feedback after 500ms
    setTimeout(() => {
      setShowSuccess(false);
    }, 500);
  }, [upload, handleDisconnect]);

  /**
   * Handle quality warning confirmation
   */
  const handleQualityWarningConfirm = useCallback(async () => {
    if (pendingCapture) {
      await processAndUpload(pendingCapture.blob);
    }
    setShowQualityWarning(false);
    setPendingCapture(null);
  }, [pendingCapture, processAndUpload]);

  /**
   * Handle quality warning cancel
   */
  const handleQualityWarningCancel = useCallback(() => {
    setShowQualityWarning(false);
    setPendingCapture(null);
  }, []);

  /**
   * Handle pre-validation warning confirmation (upload anyway)
   */
  const handlePreValidationConfirm = useCallback(async () => {
    if (pendingPreValidation) {
      await processAndUpload(pendingPreValidation.blob);
    }
    setShowPreValidationWarning(false);
    setPendingPreValidation(null);
  }, [pendingPreValidation, processAndUpload]);

  /**
   * Handle pre-validation warning cancel (retake)
   */
  const handlePreValidationCancel = useCallback(() => {
    setShowPreValidationWarning(false);
    setPendingPreValidation(null);
  }, []);

  // Handle capture button
  const handleCapture = useCallback(async () => {
    // Get video element for burst capture
    const video = videoRef.current;
    if (!video) {
      setUploadError('Camera not available');
      return;
    }

    let capturedBlob: Blob | null = null;
    let capturedQuality: ImageQualityResult | null = null;

    // Burst mode: capture multiple frames and select best
    if (burstModeEnabled && IMAGE_CAPTURE_CONFIG.enableBurstMode) {
      resetBurst();
      const burstResult = await captureBurst(video);

      if (!burstResult) {
        setUploadError('Failed to capture image. Please try again.');
        return;
      }

      capturedBlob = burstResult.bestFrame;
      setBurstFeedback('Best shot selected');

      // Analyze quality of selected frame
      const { quality } = await captureWithQuality();
      capturedQuality = quality;
    } else {
      // Single capture with quality analysis
      const result = await captureWithQuality();
      capturedBlob = result.blob;
      capturedQuality = result.quality;
    }

    if (!capturedBlob) {
      setUploadError('Failed to capture image. Please try again.');
      return;
    }

    // Step 1: Pre-validation - check if this looks like a label at all
    const preValidation = await preValidateImage(capturedBlob);

    if (!preValidation.isValid) {
      // Show pre-validation warning with specific feedback
      setPendingPreValidation({ blob: capturedBlob, result: preValidation });
      setShowPreValidationWarning(true);
      return;
    }

    // Step 2: Check image quality (blur, brightness, contrast)
    if (
      capturedQuality &&
      capturedQuality.overallQuality === 'poor' &&
      IMAGE_CAPTURE_CONFIG.enableQualityChecks
    ) {
      setPendingCapture({ blob: capturedBlob, quality: capturedQuality });
      setShowQualityWarning(true);
      return;
    }

    // Step 3: Process and upload
    await processAndUpload(capturedBlob);
  }, [
    videoRef,
    burstModeEnabled,
    captureBurst,
    captureWithQuality,
    resetBurst,
    processAndUpload,
  ]);

  const isJoining = sessionStatus === 'joining';
  const isConnected = sessionStatus === 'active' || sessionStatus === 'uploading';
  const isCameraActive = cameraStatus === 'active' || cameraStatus === 'capturing';
  const isUploading = sessionStatus === 'uploading';

  // State 0: Restoring session
  if (isRestoring || (autoRestore && !sessionId && sessionStatus === 'joining')) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 safe-top safe-bottom" role="main">
        <div className="flex flex-col items-center">
          <svg
            className="animate-spin h-10 w-10 text-blue-600 mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">Reconnecting to session...</p>
        </div>
      </main>
    );
  }

  // State 1: Pair code entry (no sessionId)
  if (!sessionId) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 safe-top safe-bottom" role="main">
        {/* QuickPRx Branding */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-800 dark:text-blue-400">
            QuickPRx
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Label Scanner
          </p>
        </header>

        {/* Main Card */}
        <section className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6" aria-labelledby="scan-labels-heading">
          <h2 id="scan-labels-heading" className="text-xl font-semibold text-center text-gray-800 dark:text-gray-100 mb-2">
            Scan Labels
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
            Enter the 6-digit code shown on your portal
          </p>

          <form onSubmit={handleSubmit} aria-label="Pairing code form">
            {/* Code Input */}
            <label htmlFor="pair-code" className="sr-only">6-digit pairing code</label>
            <input
              id="pair-code"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              disabled={isJoining}
              placeholder="000000"
              className="w-full text-center text-4xl font-mono tracking-[0.5em] py-4 px-2
                       border-2 border-gray-200 dark:border-gray-600 rounded-xl
                       bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100
                       focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800
                       placeholder:text-gray-300 dark:placeholder:text-gray-600
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all"
              autoComplete="one-time-code"
              aria-describedby={sessionError ? 'pair-error' : undefined}
              aria-invalid={sessionError ? 'true' : 'false'}
            />

            {/* Error Message */}
            {sessionError && (
              <p id="pair-error" className="mt-4 text-center text-red-500 dark:text-red-400 text-sm" role="alert">
                {sessionError}
              </p>
            )}

            {/* Connect Button */}
            <button
              type="submit"
              disabled={code.length !== 6 || isJoining}
              className="w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white
                       bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                       disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-busy={isJoining}
            >
              {isJoining ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </form>
        </section>

        {/* Mode Switch Link */}
        <button
          onClick={onModeSwitch}
          className="mt-6 text-blue-600 dark:text-blue-400 text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          aria-label="Switch to barcode scanning mode"
        >
          Switch to Barcode Scan
        </button>

        {/* Instructions */}
        <footer className="mt-4 text-center text-gray-400 dark:text-gray-500 text-xs max-w-xs">
          Open your QuickPRx Portal, go to Scan Labels, and look for the pairing code
        </footer>
      </main>
    );
  }

  const isBurstCapturing = burstStatus === 'capturing' || burstStatus === 'analyzing';

  // State 2 & 3: Camera active with upload feedback
  return (
    <main className="h-screen flex flex-col bg-black" role="main" aria-label="Label Scanner">
      {/* Pre-Validation Warning Modal */}
      {showPreValidationWarning && pendingPreValidation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prevalidation-warning-title"
          aria-describedby="prevalidation-warning-description"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500 rounded-full p-2" aria-hidden="true">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 id="prevalidation-warning-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Doesn't Look Like a Label
              </h3>
            </div>

            <p id="prevalidation-warning-description" className="text-gray-600 dark:text-gray-300 mb-4">
              {pendingPreValidation.result.suggestion || "This image may not be a prescription label."}
            </p>

            {/* Check details */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm space-y-2">
              <div className="flex items-center gap-2">
                {pendingPreValidation.result.checks.textDensity.passed ? (
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={pendingPreValidation.result.checks.textDensity.passed ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}>
                  Text detection: {pendingPreValidation.result.checks.textDensity.message || 'OK'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {pendingPreValidation.result.checks.colorDistribution.passed ? (
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={pendingPreValidation.result.checks.colorDistribution.passed ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}>
                  Color/contrast: {pendingPreValidation.result.checks.colorDistribution.message || 'OK'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {pendingPreValidation.result.checks.aspectRatio.passed ? (
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={pendingPreValidation.result.checks.aspectRatio.passed ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}>
                  Image framing: {pendingPreValidation.result.checks.aspectRatio.message || 'OK'}
                </span>
              </div>
            </div>

            {/* Confidence indicator */}
            <div className="mb-6 text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Confidence: {Math.round(pendingPreValidation.result.confidence * 100)}%
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePreValidationCancel}
                className="flex-1 py-3 px-4 rounded-xl font-medium text-white
                         bg-blue-600 hover:bg-blue-700 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Retake photo"
              >
                Retake
              </button>
              <button
                onClick={handlePreValidationConfirm}
                className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-700 dark:text-gray-300
                         bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                         transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                aria-label="Upload photo anyway"
              >
                Upload Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quality Warning Modal */}
      {showQualityWarning && pendingCapture && (
        <CaptureWarningModal
          quality={pendingCapture.quality}
          onConfirm={handleQualityWarningConfirm}
          onCancel={handleQualityWarningCancel}
        />
      )}

      {/* Success Feedback Overlay */}
      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-500/80 transition-opacity duration-200"
          role="status"
          aria-live="polite"
        >
          <div className="bg-white rounded-full p-4 mb-4 shadow-lg" aria-hidden="true">
            <svg
              className="w-16 h-16 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg">Photo Uploaded</p>
          {burstFeedback && (
            <p className="text-white/80 text-sm mt-2">{burstFeedback}</p>
          )}
        </div>
      )}

      {/* Burst Mode Feedback Overlay */}
      {isBurstCapturing && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/60" role="status" aria-live="polite">
          <div className="flex flex-col items-center">
            <svg
              className="animate-spin h-12 w-12 text-blue-400 mb-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-white font-medium">
              {burstStatus === 'capturing'
                ? `Capturing... ${framesCaptured}/${IMAGE_CAPTURE_CONFIG.burstFrameCount}`
                : 'Selecting best shot...'}
            </p>
          </div>
        </div>
      )}

      {/* Upload Error Toast */}
      {uploadError && (
        <div className="absolute top-0 left-0 right-0 z-50 safe-top" role="alert" aria-live="assertive">
          <div className="bg-red-600 text-white px-4 py-3 text-center text-sm font-medium">
            {uploadError}
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

        {/* Upload Count Badge */}
        <div
          className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full"
          role="status"
          aria-label={`${uploadCount} ${uploadCount === 1 ? 'upload' : 'uploads'} completed`}
        >
          {uploadCount} {uploadCount === 1 ? 'upload' : 'uploads'}
        </div>

        {/* Disconnect Button */}
        <button
          onClick={handleDisconnect}
          className="text-white p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          aria-label="Disconnect from label scanner session"
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
          aria-label="Camera feed for label scanning"
        />

        {/* Camera Error State */}
        {cameraError && (
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
            <p className="text-white text-center text-lg mb-4">{cameraError}</p>
            <button
              onClick={startCamera}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-black"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Image Quality Overlay */}
        {isCameraActive && !cameraError && IMAGE_CAPTURE_CONFIG.enableQualityChecks && (
          <ImageQualityOverlay
            quality={previewQuality.result}
            isChecking={previewQuality.status === 'checking'}
          />
        )}

        {/* Document Scanner Frame Guide */}
        {isCameraActive && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            {/* Dark overlay with cutout for the frame */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Frame container - typical prescription label aspect ratio (3:2) */}
            <div className="relative z-10 w-[85%] max-w-md aspect-[3/2]">
              {/* Main border with subtle glow */}
              <div className="absolute inset-0 border-2 border-white/60 rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_0_20px_rgba(255,255,255,0.2)]" />

              {/* Animated corner brackets */}
              <div className="absolute -top-1 -left-1 w-12 h-12 border-t-[5px] border-l-[5px] border-green-400 rounded-tl-lg drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
              <div className="absolute -top-1 -right-1 w-12 h-12 border-t-[5px] border-r-[5px] border-green-400 rounded-tr-lg drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
              <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-[5px] border-l-[5px] border-green-400 rounded-bl-lg drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
              <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-[5px] border-r-[5px] border-green-400 rounded-br-lg drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />

              {/* Helper text inside frame */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <p className="text-white text-xs font-medium">
                    Align label here
                  </p>
                </div>
              </div>
            </div>

            {/* Instruction text below frame */}
            <div className="absolute bottom-[15%] left-0 right-0 text-center">
              <div className="inline-flex flex-col items-center gap-2 bg-black/70 backdrop-blur-sm px-6 py-3 rounded-2xl">
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-white text-sm font-medium" role="status">
                  Position label within frame
                </p>
                <p className="text-white/70 text-xs">
                  Hold steady for best results
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Uploading indicator */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50" role="status" aria-live="polite">
            <div className="flex flex-col items-center">
              <svg
                className="animate-spin h-12 w-12 text-white mb-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-white font-medium">Uploading...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <footer className="safe-bottom bg-black/80 backdrop-blur px-4 py-4">
        {/* Mode and Burst Toggle Row */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-gray-400 text-sm">Mode: Label Scan</span>

          {/* Burst Mode Toggle */}
          {IMAGE_CAPTURE_CONFIG.enableBurstMode && (
            <button
              onClick={() => setBurstModeEnabled((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                burstModeEnabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
              aria-pressed={burstModeEnabled}
              aria-label={`Burst mode ${burstModeEnabled ? 'enabled' : 'disabled'}. Captures multiple frames and selects the sharpest.`}
            >
              {/* Burst icon */}
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              Burst {burstModeEnabled ? 'On' : 'Off'}
            </button>
          )}
        </div>

        {/* Capture Button */}
        <button
          onClick={handleCapture}
          disabled={!isCameraActive || isUploading || isBurstCapturing}
          className="w-full py-5 rounded-xl font-semibold text-white
                   bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                   disabled:bg-gray-600 disabled:cursor-not-allowed
                   transition-colors flex items-center justify-center gap-3
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-black"
          aria-label={burstModeEnabled ? 'Capture burst of photos' : 'Capture label photo'}
        >
          {/* Camera icon */}
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
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {burstModeEnabled ? 'Capture Burst' : 'Capture Label'}
        </button>

        {/* Mode switch */}
        <button
          onClick={onModeSwitch}
          className="w-full mt-3 py-3 rounded-xl font-medium text-gray-300
                   bg-gray-700 hover:bg-gray-600 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-black"
          aria-label="Switch to barcode scanning mode"
        >
          Switch to Barcode Scan
        </button>
      </footer>
    </main>
  );
}
