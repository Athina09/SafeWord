// Mirrors api/openapi.yaml (Case + extras added by the backend).
export interface Signals {
  call_active: boolean;
  caller_in_contacts: boolean | null;
  screen_shared: boolean;
  behaviour_anomaly: number;
  hour_of_day: number;
  time_to_pay_ms?: number;
}

export interface Case {
  payment_id: string;
  account_id: string;
  state: 'held' | 'released' | 'reversed';
  duress: boolean;
  risk_score: number | null; // null for duress: the risk engine is never called
  reasons: string[];
  amount: number;
  payee_id: string;
  payee_name: string;
  held_at: string | null;
  golden_hour_ends_at: string | null;
  factors?: { feature: string; label: string; value: number }[];
  signals: Signals;
  timeline?: { ts: string; actor: string; event: string; detail: Record<string, unknown> }[];
  payee_graph?: { nodes: { id: string; known_mule: boolean; is_payee: boolean }[]; edges: { src: string; dst: string }[] };
}
