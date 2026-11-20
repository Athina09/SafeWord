import { useCallback, useEffect, useState } from 'react';

import { api } from './api';
import { CaseDetail } from './components/CaseDetail';
import { CaseList } from './components/CaseList';
import { Kpis } from './components/Kpis';
import { Overview } from './components/Overview';
import type { Case } from './types';

const POLL_MS = 3000;

export default function App() {
  const [cases, setCases] = useState<Case[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setCases(await api.cases());
      setError('');
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const open = cases.filter((c) => c.state === 'held');
  const visible = showAll ? cases : open;
  const duressOpen = open.filter((c) => c.duress).length;

  return (
    <div className="app">
      <header>
        <h1>SafeWord · Fraud team</h1>
        <span className="muted">{open.length} open</span>
        {duressOpen > 0 && <span className="badge duress">{duressOpen} DURESS</span>}
        <label className="toggle"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show resolved</label>
        {error && <span className="error">{error}</span>}
      </header>
      <Kpis cases={cases} />
      <main>
        <aside><CaseList cases={visible} selected={selected} onSelect={setSelected} /></aside>
        <section className="pane">
          {selected ? <CaseDetail id={selected} refreshKey={tick} onChanged={load} /> : <><Overview cases={cases} /><p className="empty">Select a case to investigate. Duress alerts appear first.</p></>}
        </section>
      </main>
    </div>
  );
}
