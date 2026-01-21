import { useState, useCallback, useEffect } from 'react';
import { useScannerSession } from './hooks/useScannerSession';
import PairCodeInput from './components/PairCodeInput';
import Scanner from './components/Scanner';
import LabelScanner from './components/LabelScanner';
import { getSession } from './utils/sessionStorage';

type ScanMode = 'barcode' | 'label';
type RestoreState = 'checking' | 'idle' | 'restoring';

export default function App() {
  const [mode, setMode] = useState<ScanMode | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>('checking');
  const [pendingRestore, setPendingRestore] = useState<ScanMode | null>(null);

  const {
    status,
    sessionId,
    error,
    lastScanError,
    scanCount,
    pair,
    sendScan,
    disconnect,
    clearScanError,
    restoreSession: restoreBarcodeSession,
  } = useScannerSession();

  // Check for stored sessions on mount and auto-restore
  useEffect(() => {
    const checkAndRestoreSessions = async () => {
      try {
        // Check both session types
        const [barcodeSession, labelSession] = await Promise.all([
          getSession('barcode'),
          getSession('label'),
        ]);

        // Prefer the most recently created session
        if (barcodeSession && labelSession) {
          // Both exist, use most recent
          if (barcodeSession.createdAt > labelSession.createdAt) {
            setPendingRestore('barcode');
            setMode('barcode');
          } else {
            setPendingRestore('label');
            setMode('label');
          }
        } else if (barcodeSession) {
          setPendingRestore('barcode');
          setMode('barcode');
        } else if (labelSession) {
          setPendingRestore('label');
          setMode('label');
        }

        setRestoreState('idle');
      } catch (error) {
        console.warn('Failed to check stored sessions:', error);
        setRestoreState('idle');
      }
    };

    checkAndRestoreSessions();
  }, []);

  // Restore barcode session when mode is set and we have a pending restore
  useEffect(() => {
    const restoreBarcode = async () => {
      if (mode === 'barcode' && pendingRestore === 'barcode' && restoreState === 'idle') {
        setRestoreState('restoring');
        const success = await restoreBarcodeSession();
        if (!success) {
          // Restoration failed, clear the pending restore
          // User will see the pairing screen
          console.log('Barcode session restoration failed');
        }
        setPendingRestore(null);
        setRestoreState('idle');
      }
    };

    restoreBarcode();
  }, [mode, pendingRestore, restoreState, restoreBarcodeSession]);

  // Handle mode switch between barcode and label
  const handleModeSwitch = useCallback(() => {
    setMode((current) => (current === 'barcode' ? 'label' : 'barcode'));
  }, []);

  // Handle disconnect from barcode scanner (return to mode selection)
  const handleBarcodeDisconnect = useCallback(() => {
    disconnect();
    setMode(null);
  }, [disconnect]);

  // Handle disconnect from label scanner (return to mode selection)
  const handleLabelDisconnect = useCallback(() => {
    setMode(null);
  }, []);

  // Show loading screen while checking for stored sessions
  if (restoreState === 'checking') {
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
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  // Show restoring screen while reconnecting to a session
  if (restoreState === 'restoring') {
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

  // Mode selection screen (mode === null)
  if (mode === null) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 safe-top safe-bottom" role="main">
        {/* QuickPRx Branding */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-blue-800 dark:text-blue-400">
            QuickPRx
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pharmacy Scanner
          </p>
        </header>

        {/* Mode Selection Cards */}
        <nav className="w-full max-w-sm space-y-4" aria-label="Scanner mode selection">
          {/* Barcode Scan Card */}
          <button
            onClick={() => setMode('barcode')}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6
                     hover:shadow-xl transition-shadow text-left
                     border-2 border-transparent hover:border-blue-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Scan Barcode - Real-time barcode scanning"
          >
            <div className="flex items-center gap-4">
              {/* Barcode Icon */}
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl" aria-hidden="true">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Scan Barcode
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Real-time barcode scanning
                </p>
              </div>
            </div>
          </button>

          {/* Label Scan Card */}
          <button
            onClick={() => setMode('label')}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6
                     hover:shadow-xl transition-shadow text-left
                     border-2 border-transparent hover:border-blue-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Scan Label - Photo-based label capture"
          >
            <div className="flex items-center gap-4">
              {/* Camera Icon */}
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-xl" aria-hidden="true">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
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
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Scan Label
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Photo-based label capture
                </p>
              </div>
            </div>
          </button>
        </nav>

        {/* Footer */}
        <footer className="mt-10 text-center text-gray-400 dark:text-gray-500 text-xs max-w-xs">
          Select a scanning mode to connect to your QuickPRx Portal
        </footer>
      </main>
    );
  }

  // Label mode
  if (mode === 'label') {
    return (
      <LabelScanner
        onDisconnect={handleLabelDisconnect}
        onModeSwitch={handleModeSwitch}
        autoRestore={pendingRestore === 'label'}
      />
    );
  }

  // Barcode mode - existing flow
  // Flow: No session -> PairCodeInput, Has session -> Scanner
  if (!sessionId) {
    return (
      <PairCodeInput
        onPair={pair}
        isLoading={status === 'pairing'}
        error={error}
      />
    );
  }

  return (
    <Scanner
      status={status}
      scanCount={scanCount}
      scanError={lastScanError}
      onScan={sendScan}
      onDisconnect={handleBarcodeDisconnect}
      onClearScanError={clearScanError}
    />
  );
}
