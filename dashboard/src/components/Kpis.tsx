import type { Case } from '../types';

const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`);

export function Kpis({ cases }: { cases: Case[] }) {
  const open = cases.filter((c) => c.state === 'held');
  const scored = open.filter((c) => c.risk_score !== null);
  const avg = scored.length ? scored.reduce((a, c) => a + (c.risk_score ?? 0), 0) / scored.length : 0;
  const tiles = [
    { label: 'Open cases', value: String(open.length), tone: '' },
    { label: 'Duress alerts', value: String(open.filter((c) => c.duress).length), tone: open.some((c) => c.duress) ? 'danger' : '' },
    { label: 'Money on hold', value: inr(open.reduce((a, c) => a + c.amount, 0)), tone: '' },
    { label: 'Avg risk (open)', value: scored.length ? `${Math.round(avg * 100)}%` : '–', tone: avg > 0.6 ? 'warn' : '' },
    { label: 'Resolved', value: String(cases.length - open.length), tone: 'ok' },
  ];
  return (
    <div className="kpis">
      {tiles.map((t) => (
        <div key={t.label} className={`kpi ${t.tone}`}>
          <div className="kpi-value">{t.value}</div>
          <div className="kpi-label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}
