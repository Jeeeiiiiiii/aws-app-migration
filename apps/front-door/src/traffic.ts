/** Per-second tallies of what the front door served, by environment and outcome. */

export type Env = "on-prem" | "aws";
export type Outcome = "ok" | "rejected" | "failed";

export interface Tally {
  ok: number;
  /** Writes refused by a frozen store (503). */
  rejected: number;
  /** The upstream was unreachable or erred. */
  failed: number;
}

export interface TrafficSecond {
  /** Start of the second, ms since epoch. */
  t: number;
  "on-prem": Tally;
  aws: Tally;
}

export function outcomeOf(status: number): Outcome {
  if (status === 503) return "rejected";
  if (status >= 500) return "failed";
  return "ok";
}

export class TrafficLog {
  private readonly seconds: TrafficSecond[] = [];
  private readonly keep: number;
  constructor(keepSeconds = 300) {
    this.keep = keepSeconds;
  }

  record(env: Env, status: number, at = Date.now()): void {
    const t = Math.floor(at / 1000) * 1000;
    let second = this.seconds.at(-1);
    if (!second || second.t !== t) {
      second = { t, "on-prem": empty(), aws: empty() };
      this.seconds.push(second);
      if (this.seconds.length > this.keep) this.seconds.shift();
    }
    second[env][outcomeOf(status)]++;
  }

  /** Completed seconds after `since`, oldest first, with empty seconds filled in. */
  since(since: number, now = Date.now()): TrafficSecond[] {
    const current = Math.floor(now / 1000) * 1000;
    const out: TrafficSecond[] = [];
    const first = Math.max(since + 1000, current - this.keep * 1000);
    for (let t = Math.floor(first / 1000) * 1000; t < current; t += 1000) {
      out.push(this.seconds.find((s) => s.t === t) ?? { t, "on-prem": empty(), aws: empty() });
    }
    return out;
  }
}

function empty(): Tally {
  return { ok: 0, rejected: 0, failed: 0 };
}
