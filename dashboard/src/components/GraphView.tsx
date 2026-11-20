import type { Case } from '../types';

// Payee neighbourhood from the transaction graph. Arrows show the direction money moved.
export function GraphView({ graph }: { graph: NonNullable<Case['payee_graph']> }) {
  const size = 340;
  const c = size / 2;
  const R = 125;
  const others = graph.nodes.filter((n) => !n.is_payee);
  const pos = new Map<string, [number, number]>();
  graph.nodes.forEach((n) => {
    if (n.is_payee) return pos.set(n.id, [c, c]);
    const i = others.indexOf(n);
    const a = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
    pos.set(n.id, [c + R * Math.cos(a), c + R * Math.sin(a)]);
  });
  const nodeR = (n: (typeof graph.nodes)[number]) => (n.is_payee ? 15 : 9);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} className="graph" role="img" aria-label="Payee transaction graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="arrow" />
          </marker>
        </defs>
        {graph.edges.map((e, i) => {
          const a = pos.get(e.src), b = pos.get(e.dst);
          if (!a || !b) return null;
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
          const ra = nodeR(nodeById.get(e.src)!) + 2, rb = nodeR(nodeById.get(e.dst)!) + 4;
          return <line key={i} x1={a[0] + (dx / len) * ra} y1={a[1] + (dy / len) * ra} x2={b[0] - (dx / len) * rb} y2={b[1] - (dy / len) * rb} className="edge" markerEnd="url(#arrow)" />;
        })}
        {graph.nodes.map((n) => {
          const [x, y] = pos.get(n.id)!;
          const cls = n.known_mule ? 'node mule' : n.is_payee ? 'node payee' : 'node';
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={nodeR(n)} className={cls}><title>{n.id}{n.known_mule ? ' (known mule)' : ''}</title></circle>
              <text x={x} y={y + nodeR(n) + 12} textAnchor="middle" className="node-label">{n.id}</text>
            </g>
          );
        })}
      </svg>
      <ul className="legend inline">
        <li><span className="dot payee" /> Receiving account</li>
        <li><span className="dot mule" /> Known mule</li>
        <li><span className="dot node" /> Other account</li>
      </ul>
    </div>
  );
}
