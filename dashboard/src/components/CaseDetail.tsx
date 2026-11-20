import { useEffect, useState } from 'react';

import { api } from '../api';
import type { Case } from '../types';
import { Countdown } from './Countdown';
import { FactorChart } from './FactorChart';
import { GraphView } from './GraphView';
import { RiskGauge } from './RiskGauge';

function Pill({ on, label, danger }: { on: boolean; label: string; danger?: boolean }) {
  return <span className={`pill ${on ? (danger ? 'on-danger' : 'on') : ''}`}>{label}</span>;
}

const CUSTOMER_PHONE = import.meta.env.VITE_CUSTOMER_PHONE ?? ''; // demo: no real customer data

export function CaseDetail({ id, refreshKey, onChanged }: { id: string; refreshKey: number; onChanged: () => void }) {
  const [c, setC] = useState<Case | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<'release' | 'reverse' | null>(null);

  useEffect(() => {
    api.case(id).then(setC).catch((e) => setError(String(e)));
  }, [id, refreshKey]);

  if (!c) return <p className="empty">{error || 'Loading…'}</p>;
  const open = c.state === 'held';
  const s = c.signals;

  const act = async (kind: 'release' | 'reverse') => {
    try {
      await (kind === 'release' ? api.release(id) : api.reverse(id));
      setConfirming(null);
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  const exportReport = async () => {
    const blob = new Blob([JSON.stringify(await api.report(id), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cybercrime-report-${id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="detail">
      {c.duress && (
        <div className="alert">
          Customer entered the SafeWord PIN. Treat as coercion in progress. <Countdown endsAt={c.golden_hour_ends_at} />
        </div>
      )}
      <h2>₹{c.amount.toLocaleString('en-IN')} to {c.payee_name}</h2>
      <p className="muted">Account {c.account_id} · state: {c.state}{c.held_at ? ` · held ${new Date(c.held_at).toLocaleTimeString()}` : ''}</p>

      <div className="grid2">
        <section className="card">
          <h3>Risk</h3>
          {c.risk_score === null ? (
            <p>Not scored: the duress path bypasses the model by design.</p>
          ) : (
            <RiskGauge score={c.risk_score} />
          )}
          <ul className="reasons">{c.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
        <section className="card">
          <h3>Payee network</h3>
          {c.payee_graph && <GraphView graph={c.payee_graph} />}
        </section>
      </div>

      {c.risk_score !== null && (
        <section className="card">
          <h3>Why it was flagged</h3>
          <FactorChart factors={c.factors ?? []} />
        </section>
      )}

      <section className="card">
        <h3>Phone signals</h3>
        <div className="pills">
          <Pill on={s.call_active} danger label="On a call" />
          <Pill on={s.call_active && s.caller_in_contacts !== true} danger label="Unknown caller" />
          <Pill on={s.screen_shared} danger label="Screen shared" />
          <Pill on={s.behaviour_anomaly >= 0.5} danger label={`Behaviour ${s.behaviour_anomaly.toFixed(2)}`} />
          <Pill on={false} label={`Hour ${s.hour_of_day}:00`} />
          {s.time_to_pay_ms != null && <Pill on={false} label={`Paid in ${(s.time_to_pay_ms / 1000).toFixed(0)}s`} />}
        </div>
      </section>

      <section className="card">
        <h3>Timeline</h3>
        <ol className="timeline">
          {c.timeline?.map((t, i) => (
            <li key={i}><span className="tl-dot" /><span className="muted">{new Date(t.ts).toLocaleTimeString()}</span> <strong>{t.event}</strong> <span className="muted">({t.actor})</span></li>
          ))}
        </ol>
      </section>

      <div className="actions">
        {open && confirming === null && (
          <>
            <button className="primary" onClick={() => setConfirming('release')}>Release</button>
            <button className="danger" onClick={() => setConfirming('reverse')}>Reverse</button>
          </>
        )}
        {open && confirming && (
          <>
            <span>{confirming === 'release' ? 'Release this payment to the payee?' : 'Return this money to the customer?'}</span>
            <button className={confirming === 'release' ? 'primary' : 'danger'} onClick={() => act(confirming)}>Confirm {confirming}</button>
            <button onClick={() => setConfirming(null)}>Cancel</button>
          </>
        )}
        {CUSTOMER_PHONE
          ? <a className="btn" href={`tel:${CUSTOMER_PHONE}`}>Call customer</a>
          : <button disabled title="Set VITE_CUSTOMER_PHONE for the demo">Call customer</button>}
        <button onClick={exportReport}>Export cybercrime report</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
