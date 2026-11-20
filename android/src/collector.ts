import type { Signals } from './api/types';

// M2: behaviour features measured on the phone. Raw timings never leave the device;
// only the anomaly score (and time_to_pay_ms) is sent in `signals`.
export interface BehaviourSample {
  typing_cps: number;
  time_to_pay_s: number;
  hesitation_s: number;
  hour_delta: number;
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export class BehaviourTracker {
  private start = Date.now();
  private keys: number[] = [];
  private maxGap = 0;

  begin() {
    this.start = Date.now();
    this.keys = [];
    this.maxGap = 0;
  }

  key() {
    const t = Date.now();
    const last = this.keys[this.keys.length - 1];
    if (last !== undefined) this.maxGap = Math.max(this.maxGap, t - last);
    this.keys.push(t);
  }

  snapshot(usualHour: number, hour: number): BehaviourSample {
    const span = this.keys.length > 1 ? (this.keys[this.keys.length - 1] - this.keys[0]) / 1000 : 0;
    const diff = Math.abs(hour - usualHour);
    return {
      typing_cps: span > 0 ? (this.keys.length - 1) / span : 3.5,
      time_to_pay_s: (Date.now() - this.start) / 1000,
      hesitation_s: this.maxGap / 1000,
      hour_delta: Math.min(diff, 24 - diff),
    };
  }
}

// Stand-in for the TFLite model (data/export_tflite.py): same 4 inputs, one score in [0, 1].
// Weights follow the synthetic distributions in data/generate.py (normal vs coerced users).
export function scoreBehaviour(s: BehaviourSample): number {
  return clamp(
    0.25 * clamp((3.5 - s.typing_cps) / 1.5) +
      0.35 * clamp((s.time_to_pay_s - 25) / 50) +
      0.2 * clamp((s.hesitation_s - 3) / 8) +
      0.2 * clamp(s.hour_delta / 9),
  );
}

export interface Overrides {
  /** true = send the measured behaviour score, false = send the demo panel's value */
  liveBehaviour: boolean;
}

export function collectSignals(
  demo: Signals,
  tracker: BehaviourTracker,
  usualHour: number,
  { liveBehaviour }: Overrides,
): Signals {
  const hour = new Date().getHours();
  const sample = tracker.snapshot(usualHour, hour);
  return {
    ...demo,
    hour_of_day: hour,
    time_to_pay_ms: Math.round(sample.time_to_pay_s * 1000),
    behaviour_anomaly: liveBehaviour ? scoreBehaviour(sample) : demo.behaviour_anomaly,
  };
}
