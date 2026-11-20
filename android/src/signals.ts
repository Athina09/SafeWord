import type { Signals } from './api/types';

// Phase 1: values come from the hidden demo-signals panel. Phase 2 (M2) swaps in real hooks.
export function defaultSignals(): Signals {
  return {
    call_active: false,
    caller_in_contacts: true,
    screen_shared: false,
    behaviour_anomaly: 0.05,
    hour_of_day: new Date().getHours(),
  };
}
