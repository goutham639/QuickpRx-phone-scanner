import { useState, useCallback } from 'react';
import { useScannerSession } from './hooks/useScannerSession';
import PairCodeInput from './components/PairCodeInput';
import Scanner from './components/Scanner';
import LabelScanner from './components/LabelScanner';

type ScanMode = 'barcode' | 'label';

export default function App() {
  const [mode, setMode] = useState<ScanMode | null>(null);

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
  } = useScannerSession();

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

  // Mode selection screen (mode === null)
  if (mode === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 safe-top safe-bottom">
        {/* QuickPRx Branding */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-blue-800 dark:text-blue-400">
            QuickPRx
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pharmacy Scanner
          </p>
        </div>

        {/* Mode Selection Cards */}
        <div className="w-full max-w-sm space-y-4">
          {/* Barcode Scan Card */}
          <button
            onClick={() => setMode('barcode')}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6
                     hover:shadow-xl transition-shadow text-left
                     border-2 border-transparent hover:border-blue-500"
          >
            <div className="flex items-center gap-4">
              {/* Barcode Icon */}
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
                     border-2 border-transparent hover:border-blue-500"
          >
            <div className="flex items-center gap-4">
              {/* Camera Icon */}
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-xl">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
        </div>

        {/* Footer */}
        <p className="mt-10 text-center text-gray-400 dark:text-gray-500 text-xs max-w-xs">
          Select a scanning mode to connect to your QuickPRx Portal
        </p>
      </div>
    );
  }

  // Label mode
  if (mode === 'label') {
    return (
      <LabelScanner
        onDisconnect={handleLabelDisconnect}
        onModeSwitch={handleModeSwitch}
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
