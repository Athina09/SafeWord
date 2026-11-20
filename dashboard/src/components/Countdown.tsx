import { useEffect, useState } from 'react';

// Golden hour: the window in which a fraudulent transfer can still be recovered.
export function Countdown({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endsAt) return null;
  const left = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  if (left === 0) return <span className="countdown late">Golden hour passed</span>;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return <span className={`countdown ${left < 600 ? 'late' : ''}`}>{mm}:{ss} left</span>;
}
