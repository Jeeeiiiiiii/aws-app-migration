import type { DbConfig } from "@demo/store-db";

export const PHASES = [
  "assess",
  "prepare",
  "freeze",
  "copy",
  "verify",
  "cutover",
  "decommission",
] as const;
export type PhaseName = (typeof PHASES)[number];
export type PhaseStatus = "pending" | "running" | "done" | "failed";
export type ServingEnv = "on-prem" | "aws";

export interface PhaseState {
  status: PhaseStatus;
  startedAt?: string;
  finishedAt?: string;
  /** One line describing the outcome, in glossary language. */
  summary?: string;
  error?: string;
}

export interface TableFingerprint {
  table: string;
  rows: number;
  checksum: string;
}

export interface Verification {
  passed: boolean;
  tables: {
    table: string;
    onPrem: TableFingerprint;
    aws: TableFingerprint | null;
    match: boolean;
  }[];
  smokeOrder: { ok: boolean; orderId?: number; error?: string } | null;
}

export interface LogEntry {
  at: string;
  level: "info" | "warn" | "error";
  phase?: PhaseName;
  message: string;
}

export interface MigrationState {
  phases: Record<PhaseName, PhaseState>;
  /** The phase the next advance() would run, or null when the migration is complete. */
  next: PhaseName | null;
  busy: boolean;
  serving: ServingEnv;
  /** Orders placed on the AWS side since cutover; only counted between cutover and decommission. */
  strandedOrders: number;
  canRollback: boolean;
  assessment: TableFingerprint[] | null;
  awsSide: AwsSideInfo | null;
  verification: Verification | null;
  finalBackup: { path: string; bytes: number } | null;
  log: LogEntry[];
}

export type MigrationEvent = { type: "log"; entry: LogEntry } | { type: "changed" };

/** What the AWS side exposes once it exists. */
export interface AwsSideInfo {
  db: DbConfig;
  /** Base URL of the store behind the load balancer, reachable from the runner. */
  storeUrl: string;
  /** Load balancer DNS name: the value the Route53 record takes at cutover. */
  loadBalancerDns: string;
}

export class MigrationBusyError extends Error {
  constructor() {
    super("Another migration operation is already running.");
    this.name = "MigrationBusyError";
  }
}

export class StrandedOrdersError extends Error {
  readonly count: number;
  constructor(count: number) {
    super(
      `Rolling back now discards ${count} stranded order${count === 1 ? "" : "s"} placed on AWS.`,
    );
    this.name = "StrandedOrdersError";
    this.count = count;
  }
}

export class PastPointOfNoReturnError extends Error {
  constructor() {
    super("On-prem has been decommissioned; rollback is no longer possible. Use reset to replay.");
    this.name = "PastPointOfNoReturnError";
  }
}

export class NothingToRollBackError extends Error {
  constructor() {
    super("Nothing to roll back: on-prem is still serving and accepting writes.");
    this.name = "NothingToRollBackError";
  }
}
