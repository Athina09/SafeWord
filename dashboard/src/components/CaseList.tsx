import type { Case } from '../types';
import { Countdown } from './Countdown';

export function CaseList({ cases, selected, onSelect }: { cases: Case[]; selected: string | null; onSelect: (id: string) => void }) {
  if (cases.length === 0) return <p className="empty">No held payments.</p>;
  return (
    <ul className="cases">
      {cases.map((c) => (
        <li key={c.payment_id}>
          <button className={`case ${c.duress ? 'duress' : ''} ${c.payment_id === selected ? 'selected' : ''}`} onClick={() => onSelect(c.payment_id)}>
            <div className="row">
              <strong>₹{c.amount.toLocaleString('en-IN')}</strong>
              {c.duress ? <span className="badge duress">DURESS</span> : <span className="badge">{c.state}</span>}
            </div>
            <div className="muted">{c.payee_name}</div>
            <div className="row">
              {c.risk_score !== null ? <span className="muted">risk {(c.risk_score * 100).toFixed(0)}%</span> : <span className="muted">silent alarm</span>}
              {c.state === 'held' && <Countdown endsAt={c.golden_hour_ends_at} />}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
