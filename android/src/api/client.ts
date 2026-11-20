import type { Account, Approval, InitiateRequest, InitiateResponse, Payee, Signals, StatusResponse } from './types';

// Set EXPO_PUBLIC_API_URL to Person B's FastAPI server. Unset = built-in stub so the app runs alone.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// ---- stub (no backend): mirrors the demo scenarios. Duress never inspects signals or amount. ----
const stubAccount: Account = {
  id: 'demo-senior-1',
  name: 'Kamala Devi',
  balance: 250000,
  hold: 0,
  daily_limit: 50000,
  trusted_name: 'Ravi (son)',
  payees: [
    { id: 'p1', name: 'Sharma General Store', upi_id: 'sharma@demo' },
    { id: 'p2', name: 'New Payee (unverified)', upi_id: 'new@demo' },
  ],
};

function stubInitiate(req: InitiateRequest): InitiateResponse {
  const payment_id = `stub-${Date.now()}`;
  if (req.pin_type === 'duress') return { decision: 'hold', payment_id, reasons: [], prompt_lang: 'en' };
  if (req.signals.call_active && req.amount >= 100000) {
    return {
      decision: 'hold',
      payment_id,
      reasons: ['You are on a call with a number that is not in your contacts', 'This is a large payment'],
      prompt_lang: 'en',
    };
  }
  if (req.signals.call_active) {
    return { decision: 'prompt', payment_id, reasons: ['You are on a phone call while making this payment'], prompt_lang: 'en' };
  }
  stubAccount.balance -= req.amount;
  return { decision: 'allow', payment_id, reasons: [], prompt_lang: 'en' };
}

export const api = {
  usingBackend: Boolean(BASE_URL),
  getAccount: (id: string): Promise<Account> =>
    BASE_URL ? request('GET', `/accounts/${id}`) : Promise.resolve({ ...stubAccount, payees: [...stubAccount.payees] }),
  initiatePayment: (req: InitiateRequest): Promise<InitiateResponse> =>
    BASE_URL ? request('POST', '/payments/initiate', req) : Promise.resolve(stubInitiate(req)),
  confirmPayment: (id: string): Promise<StatusResponse> =>
    BASE_URL ? request('POST', `/payments/${id}/confirm`) : Promise.resolve({ payment_id: id, status: 'success' }),
  cancelPayment: (id: string): Promise<StatusResponse> =>
    BASE_URL ? request('POST', `/payments/${id}/cancel`) : Promise.resolve({ payment_id: id, status: 'cancelled' }),
  getApprovals: (): Promise<Approval[]> => (BASE_URL ? request('GET', '/approvals/pending') : Promise.resolve([])),
  decideApproval: (id: string, approve: boolean): Promise<unknown> =>
    BASE_URL ? request('POST', `/approvals/${id}`, { approve }) : Promise.resolve({ ok: true }),
  addPayee: (account_id: string, name: string, upi_id: string, signals: Signals): Promise<Payee> => {
    if (BASE_URL) return request('POST', '/payees', { account_id, name, upi_id, signals });
    const payee = { id: `p_${Date.now()}`, name, upi_id };
    stubAccount.payees.push(payee);
    return Promise.resolve(payee);
  },
  setLimit: (account_id: string, daily_limit: number, signals: Signals): Promise<{ daily_limit: number }> => {
    if (BASE_URL) return request('PATCH', '/limits', { account_id, daily_limit, signals });
    stubAccount.daily_limit = daily_limit;
    return Promise.resolve({ daily_limit });
  },
};
