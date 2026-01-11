import { useScannerSession } from './hooks/useScannerSession';
import PairCodeInput from './components/PairCodeInput';
import Scanner from './components/Scanner';

export default function App() {
  const {
    status,
    sessionId,
    error,
    scanCount,
    pair,
    sendScan,
    disconnect,
  } = useScannerSession();

  // Flow: No session → PairCodeInput, Has session → Scanner
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
      onScan={sendScan}
      onDisconnect={disconnect}
    />
  );
}
