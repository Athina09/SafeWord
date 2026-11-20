import { useState } from 'react';

import type { PinType } from '../api/types';
import { PinPad } from '../components/PinPad';
import { REAL_PIN } from '../settings';

// The real PIN and the SafeWord PIN share this screen and look identical.
// Which type was entered is only decided here, never shown.
export function PinScreen({
  duressPin,
  onSubmit,
  onKey,
}: {
  duressPin: string | null;
  onSubmit: (type: PinType) => void;
  onKey: () => void;
}) {
  const [error, setError] = useState('');
  return (
    <PinPad
      title="Enter UPI PIN"
      error={error}
      onKey={() => {
        setError('');
        onKey();
      }}
      onComplete={(pin) => {
        if (pin === REAL_PIN) onSubmit('normal');
        else if (duressPin && pin === duressPin) onSubmit('duress');
        else setError('Wrong PIN, try again');
      }}
    />
  );
}
