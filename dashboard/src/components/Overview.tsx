import type { Case } from '../types';

const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`);

// Shown when no case is selected: what is happening right now.
export function Overview({ cases }: { cases: Case[] }) {
  return (
    <div className="overview">
      <section className="card">
        <h3>Held payments</h3>
        <HeldBars cases={cases} />
      </section>
      <section className="card">
        <h3>Outcomes</h3>
        <Donut cases={cases} />
      </section>
    </div>
  );
}

function HeldBars({ cases }: { cases: Case[] }) {
  const items = [...cases].filter((c) => c.held_at).sort((a, b) => a.held_at!.localeCompare(b.held_at!)).slice(-14);
  if (items.length === 0) return <p className="muted">Nothing held yet.</p>;
  const W = 460, H = 190, pad = 28;
  const max = Math.sqrt(Math.max(...items.map((c) => c.amount)));
  const bw = Math.min(34, (W - pad * 2) / items.length - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Held payments by amount">
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="axis" />
      {items.map((c, i) => {
        const h = (Math.sqrt(c.amount) / max) * (H - pad * 2 - 8);
        const x = pad + i * ((W - pad * 2) / items.length) + 3;
        const tone = c.duress ? 'danger' : c.state !== 'held' ? 'muted' : (c.risk_score ?? 0) >= 0.6 ? 'warn' : 'ok';
        return (
          <g key={c.payment_id}>
            <rect x={x} y={H - pad - h} width={bw} height={h} rx={4} className={`bar ${tone}`}>
              <title>{`₹${c.amount.toLocaleString('en-IN')} to ${c.payee_name}${c.duress ? ' (duress)' : ''}`}</title>
            </rect>
            <text x={x + bw / 2} y={H - pad - h - 5} textAnchor="middle" className="bar-label">{inr(c.amount)}</text>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" className="axis-label">{new Date(c.held_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ cases }: { cases: Case[] }) {
  const parts = [
    { label: 'Open', n: cases.filter((c) => c.state === 'held').length, cls: 'warn' },
    { label: 'Released', n: cases.filter((c) => c.state === 'released').length, cls: 'ok' },
    { label: 'Reversed', n: cases.filter((c) => c.state === 'reversed').length, cls: 'danger' },
  ];
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (total === 0) return <p className="muted">No cases yet.</p>;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Case outcomes">
        <circle cx="70" cy="70" r={R} className="donut-track" />
        {parts.map((p) => {
          const len = (p.n / total) * C;
          const el = <circle key={p.label} cx="70" cy="70" r={R} className={`donut-seg ${p.cls}`} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-total">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="axis-label">cases</text>
      </svg>
      <ul className="legend">
        {parts.map((p) => <li key={p.label}><span className={`dot ${p.cls}`} /> {p.label} <strong>{p.n}</strong></li>)}
      </ul>
    </div>
  );
}
