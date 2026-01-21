/**
 * Image Quality Overlay Component
 * Displays real-time quality feedback during camera preview
 */

import type { ImageQualityResult } from '../types/imageCapture';

interface ImageQualityOverlayProps {
  /** Quality analysis result */
  quality: ImageQualityResult | null;
  /** Whether quality check is in progress */
  isChecking?: boolean;
  /** Whether to show detailed metrics */
  showDetails?: boolean;
}

/**
 * Get quality icon based on overall quality
 */
function QualityIcon({ quality }: { quality: 'good' | 'acceptable' | 'poor' }) {
  switch (quality) {
    case 'good':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'acceptable':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
        </svg>
      );
    case 'poor':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
}

/**
 * Quality badge component
 * Shows unified quality indicator - badge reflects actual issues, not generic "OK"
 */
function QualityBadge({ quality }: { quality: ImageQualityResult }) {
  // If there are issues, show the first issue as the badge label
  // This prevents showing "OK" when there's actually a problem
  const hasIssues = quality.issues.length > 0;

  // Determine color based on whether there are issues
  const colorClass = hasIssues
    ? quality.overallQuality === 'poor'
      ? 'bg-red-500'
      : 'bg-yellow-500'
    : 'bg-green-500';

  // Determine icon based on issues
  const iconQuality = hasIssues
    ? quality.overallQuality === 'poor'
      ? 'poor'
      : 'acceptable'
    : 'good';

  // Label: show "Good" only when no issues, otherwise show primary issue indicator
  const label = hasIssues
    ? quality.issues[0]?.includes('blurry')
      ? 'Blurry'
      : quality.issues[0]?.includes('dark')
      ? 'Too Dark'
      : quality.issues[0]?.includes('bright')
      ? 'Too Bright'
      : quality.issues[0]?.includes('contrast')
      ? 'Low Contrast'
      : 'Check Quality'
    : 'Good';

  return (
    <div
      className={`${colorClass} text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-sm font-medium shadow-lg`}
      role="status"
      aria-label={`Image quality: ${label}`}
    >
      <QualityIcon quality={iconQuality as 'good' | 'acceptable' | 'poor'} />
      {label}
    </div>
  );
}

/**
 * Loading indicator for quality check
 */
function CheckingIndicator() {
  return (
    <div className="bg-gray-700/80 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
      <svg
        className="w-4 h-4 animate-spin"
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
      Checking...
    </div>
  );
}

/**
 * Issue warning display - shows actionable tip for the primary issue
 */
function IssueWarning({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;

  // Get helpful tip based on primary issue
  const primaryIssue = issues[0] || '';
  let tip = '';

  if (primaryIssue.includes('blurry')) {
    tip = 'Hold steady';
  } else if (primaryIssue.includes('dark')) {
    tip = 'Add more light';
  } else if (primaryIssue.includes('bright')) {
    tip = 'Reduce glare';
  } else if (primaryIssue.includes('contrast')) {
    tip = 'Adjust angle';
  }

  // Show additional issues count if more than one
  const additionalCount = issues.length - 1;

  return (
    <div className="mt-2 flex flex-col gap-1">
      {tip && (
        <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full inline-block">
          {tip}
        </div>
      )}
      {additionalCount > 0 && (
        <div className="text-white/70 text-xs">
          +{additionalCount} more {additionalCount === 1 ? 'issue' : 'issues'}
        </div>
      )}
    </div>
  );
}

/**
 * Detailed metrics display
 */
function DetailedMetrics({ quality }: { quality: ImageQualityResult }) {
  return (
    <div className="mt-2 bg-black/60 rounded-lg px-3 py-2 text-xs text-white space-y-1">
      <div className="flex justify-between">
        <span>Sharpness:</span>
        <span className={quality.isSharp ? 'text-green-400' : 'text-red-400'}>
          {quality.blurScore.toFixed(1)}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Brightness:</span>
        <span className={quality.isBrightnessOk ? 'text-green-400' : 'text-red-400'}>
          {quality.brightness.toFixed(0)}%
        </span>
      </div>
      <div className="flex justify-between">
        <span>Contrast:</span>
        <span className={quality.contrast >= 15 ? 'text-green-400' : 'text-yellow-400'}>
          {quality.contrast.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Image Quality Overlay
 * Shows quality feedback over camera preview
 */
export default function ImageQualityOverlay({
  quality,
  isChecking = false,
  showDetails = false,
}: ImageQualityOverlayProps) {
  // Show checking indicator
  if (isChecking && !quality) {
    return (
      <div className="absolute top-4 left-4 z-20">
        <CheckingIndicator />
      </div>
    );
  }

  // No quality data yet
  if (!quality) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-20">
      <QualityBadge quality={quality} />
      <IssueWarning issues={quality.issues} />
      {showDetails && <DetailedMetrics quality={quality} />}
    </div>
  );
}

/**
 * Capture warning modal - shown when user tries to capture with poor quality
 */
export function CaptureWarningModal({
  quality,
  onConfirm,
  onCancel,
}: {
  quality: ImageQualityResult;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quality-warning-title"
      aria-describedby="quality-warning-description"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-yellow-500 rounded-full p-2" aria-hidden="true">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 id="quality-warning-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Image Quality Warning
          </h3>
        </div>

        <p id="quality-warning-description" className="text-gray-600 dark:text-gray-300 mb-4">
          The image quality may affect OCR accuracy:
        </p>

        <ul className="mb-4 space-y-2" aria-label="Quality issues">
          {quality.issues.map((issue, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {issue}
            </li>
          ))}
        </ul>

        {/* Helpful tips based on issues */}
        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Tips to improve:</p>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            {!quality.isSharp && <li>• Hold phone steady and wait for focus</li>}
            {!quality.isBrightnessOk && quality.brightness < 25 && <li>• Move to a brighter area or turn on lights</li>}
            {!quality.isBrightnessOk && quality.brightness > 85 && <li>• Reduce glare or move away from direct light</li>}
            {quality.contrast < 15 && <li>• Ensure good contrast between label and background</li>}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-700 dark:text-gray-300
                     bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                     transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            aria-label="Retake photo with better quality"
          >
            Retake
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl font-medium text-white
                     bg-blue-600 hover:bg-blue-700 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Capture photo anyway despite quality issues"
          >
            Capture Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
