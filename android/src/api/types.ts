// Mirrors api/openapi.yaml. Change both together, and only after agreeing with Person B.
export type PinType = 'normal' | 'duress';
export type Decision = 'allow' | 'prompt' | 'hold';
export type PaymentStatus = 'pending' | 'success' | 'cancelled' | 'rejected';

export interface Signals {
  call_active: boolean;
  caller_in_contacts: boolean | null;
  screen_shared: boolean;
  behaviour_anomaly: number;
  hour_of_day: number;
  time_to_pay_ms?: number;
}

export interface InitiateRequest {
  account_id: string;
  payee_id: string;
  amount: number;
  pin_type: PinType;
  signals: Signals;
}

export interface InitiateResponse {
  decision: Decision;
  payment_id: string;
  reasons: string[];
  prompt_lang: 'en' | 'hi' | 'ta';
}

export interface StatusResponse {
  payment_id: string;
  status: PaymentStatus;
}

export interface Payee {
  id: string;
  name: string;
  upi_id: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  hold: number;
  daily_limit: number;
  trusted_name: string | null;
  payees: Payee[];
}

export interface Approval {
  payment_id: string;
  senior_name: string;
  payee_name: string;
  amount: number;
  reasons: string[];
}
