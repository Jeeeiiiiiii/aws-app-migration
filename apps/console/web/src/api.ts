import type { TrafficSecond } from "@demo/front-door/traffic";
import type { MigrationState } from "@demo/migration";
import { useEffect, useState } from "react";

export type { LogEntry, MigrationState, PhaseName, PhaseState } from "@demo/migration";
export type { TrafficSecond };

/** The runner's state, live over SSE from the control plane. */
export function useMigration(): { state: MigrationState | null; connected: boolean } {
  const [state, setState] = useState<MigrationState | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("state", (e) => {
      setState(JSON.parse((e as MessageEvent).data) as MigrationState);
      setConnected(true);
    });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);
  return { state, connected };
}

export interface FrontDoorTarget {
  env: "on-prem" | "aws";
  url: string;
  recordValue: string;
}

export const WINDOW_SECONDS = 120;

/** The front door's per-second traffic, over the last two minutes. */
export function useTraffic(): { seconds: TrafficSecond[]; target: FrontDoorTarget | null } {
  const [seconds, setSeconds] = useState<TrafficSecond[]>([]);
  const [target, setTarget] = useState<FrontDoorTarget | null>(null);
  useEffect(() => {
    const source = new EventSource("/api/traffic");
    source.addEventListener("traffic", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        seconds: TrafficSecond[];
        target: FrontDoorTarget | null;
      };
      if (data.target) setTarget(data.target);
      setSeconds((prev) => {
        const byTime = new Map(prev.map((s) => [s.t, s]));
        for (const s of data.seconds) byTime.set(s.t, s);
        return [...byTime.values()].sort((a, b) => a.t - b.t).slice(-WINDOW_SECONDS);
      });
    });
    return () => source.close();
  }, []);
  return { seconds, target };
}

export interface CallResult {
  ok: boolean;
  status: number;
  body: { message?: string; count?: number; error?: string };
}

export async function call(path: string, body: unknown = {}): Promise<CallResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, body: await res.json() };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: { message: `The control plane is unreachable (${err}).` },
    };
  }
}

export function clock(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour12: false }) : "";
}
