import { useEffect, useState } from 'react';

interface ScanFeedbackProps {
  barcode: string | null;
  onComplete: () => void;
}

export default function ScanFeedback({ barcode, onComplete }: ScanFeedbackProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (barcode) {
      setVisible(true);

      // Fade out after 500ms
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [barcode, onComplete]);

  if (!barcode) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center
                  bg-green-500/80 transition-opacity duration-200
                  ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Checkmark Icon */}
      <div className="bg-white rounded-full p-4 mb-4 shadow-lg">
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

      {/* Scanned Value */}
      <p className="text-white font-mono text-lg px-4 py-2 bg-black/20 rounded-lg">
        {barcode}
      </p>
    </div>
  );
}
