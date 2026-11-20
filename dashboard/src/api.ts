import type { Case } from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function req<T>(method: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method });
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const api = {
  cases: () => req<Case[]>('GET', '/cases'),
  case: (id: string) => req<Case>('GET', `/cases/${id}`),
  release: (id: string) => req<unknown>('POST', `/cases/${id}/release`),
  reverse: (id: string) => req<unknown>('POST', `/cases/${id}/reverse`),
  report: (id: string) => req<unknown>('GET', `/cases/${id}/report`),
};
