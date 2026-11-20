import type { Case } from '../types';

// SHAP contributions: red bars pushed the risk up, green bars pulled it down.
export function FactorChart({ factors }: { factors: NonNullable<Case['factors']> }) {
  if (factors.length === 0) return <p className="muted">No factor breakdown for this case.</p>;
  const max = Math.max(...factors.map((f) => Math.abs(f.value)), 0.5);
  const ordered = [...factors].sort((a, b) => b.value - a.value);
  return (
    <div className="factors" role="list">
      {ordered.map((f) => {
        const pct = (Math.abs(f.value) / max) * 50;
        return (
          <div key={f.feature} className="factor" role="listitem">
            <span className="factor-label">{f.label}</span>
            <div className="factor-track">
              <div className="factor-mid" />
              <div
                className={`factor-bar ${f.value >= 0 ? 'up' : 'down'}`}
                style={{ width: `${pct}%`, left: f.value >= 0 ? '50%' : `${50 - pct}%` }}
                title={`${f.value > 0 ? '+' : ''}${f.value} log-odds`}
              />
            </div>
            <span className="factor-num">{f.value > 0 ? '+' : ''}{f.value.toFixed(1)}</span>
          </div>
        );
      })}
      <div className="factor-axis"><span>lowers risk</span><span>raises risk</span></div>
    </div>
  );
}
