// Semicircle gauge for the model's fraud probability.
const ARC = Math.PI * 80;

export function RiskGauge({ score }: { score: number }) {
  const tone = score >= 0.6 ? 'danger' : score >= 0.25 ? 'warn' : 'ok';
  const label = score >= 0.6 ? 'High' : score >= 0.25 ? 'Medium' : 'Low';
  return (
    <svg viewBox="0 0 180 112" className="gauge" role="img" aria-label={`Risk ${Math.round(score * 100)} percent`}>
      <path d="M 10 100 A 80 80 0 0 1 170 100" className="gauge-track" />
      <path d="M 10 100 A 80 80 0 0 1 170 100" className={`gauge-fill ${tone}`} strokeDasharray={`${ARC * score} ${ARC}`} />
      <text x="90" y="84" textAnchor="middle" className="gauge-value">{Math.round(score * 100)}%</text>
      <text x="90" y="104" textAnchor="middle" className="gauge-label">{label} risk</text>
    </svg>
  );
}
