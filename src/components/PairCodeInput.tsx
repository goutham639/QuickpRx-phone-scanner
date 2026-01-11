import { useState, useCallback, useRef, useEffect } from 'react';

interface PairCodeInputProps {
  onPair: (code: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export default function PairCodeInput({ onPair, isLoading, error }: PairCodeInputProps) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Filter to digits only
      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
      setCode(digits);

      // Auto-submit when 6 digits reached
      if (digits.length === 6) {
        onPair(digits);
      }
    },
    [onPair]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (code.length === 6 && !isLoading) {
        onPair(code);
      }
    },
    [code, isLoading, onPair]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      {/* QuickPRx Branding */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-blue-800 dark:text-blue-400">
          QuickPRx
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pharmacy Scanner
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-center text-gray-800 dark:text-gray-100 mb-2">
          Scan to Portal
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
          Enter the 6-digit code shown on your portal
        </p>

        <form onSubmit={handleSubmit}>
          {/* Code Input */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="000000"
            className="w-full text-center text-4xl font-mono tracking-[0.5em] py-4 px-2
                     border-2 border-gray-200 dark:border-gray-600 rounded-xl
                     bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100
                     focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800
                     placeholder:text-gray-300 dark:placeholder:text-gray-600
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all"
            autoComplete="one-time-code"
          />

          {/* Error Message */}
          {error && (
            <p className="mt-4 text-center text-red-500 dark:text-red-400 text-sm">
              {error}
            </p>
          )}

          {/* Connect Button */}
          <button
            type="submit"
            disabled={code.length !== 6 || isLoading}
            className="w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white
                     bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                     disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
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
      </div>

      {/* Instructions */}
      <p className="mt-8 text-center text-gray-400 dark:text-gray-500 text-xs max-w-xs">
        Open your QuickPRx Portal, go to Scan Labels, and look for the pairing code
      </p>
    </div>
  );
}
