/**
 * The migration runner. Every phase, guard and safety net lives here; the CLI and
 * the console only call these four operations and render what they report.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { connect, type DbConfig, reseed, setWriteMode } from "@demo/store-db";
import type pg from "pg";
import {
  countOrdersAfter,
  damageInTransit,
  dumpTo,
  fingerprint,
  orderMark,
  placeSmokeOrder,
  restoreFrom,
} from "./data.ts";
import type { AwsSide, OnPremHost, Routing } from "./ports.ts";
import {
  type AwsSideInfo,
  type LogEntry,
  MigrationBusyError,
  type MigrationEvent,
  type MigrationState,
  NothingToRollBackError,
  PastPointOfNoReturnError,
  PHASES,
  type PhaseName,
  type PhaseState,
  StrandedOrdersError,
  type TableFingerprint,
  type Verification,
} from "./types.ts";

export interface MigrationDeps {
  onPremDb: DbConfig;
  awsSide: AwsSide;
  routing: Routing;
  onPremHost: OnPremHost;
  /** Where dumps and the final backup are written. */
  workDir: string;
  /** Persist progress here so a restarted control plane resumes where it was. */
  stateFile?: string;
}

export interface Migration {
  state(): Promise<MigrationState>;
  advance(opts?: { faultInjection?: boolean }): Promise<MigrationState>;
  rollback(opts?: { discardStrandedOrders?: boolean }): Promise<MigrationState>;
  reset(): Promise<MigrationState>;
  subscribe(listener: (event: MigrationEvent) => void): () => void;
  close(): Promise<void>;
}

/** Everything the runner remembers; serving environment and stranded orders are read live. */
interface Progress {
  phases: Record<PhaseName, PhaseState>;
  assessment: TableFingerprint[] | null;
  awsSide: AwsSideInfo | null;
  verification: Verification | null;
  cutoverMark: number | null;
  finalBackup: { path: string; bytes: number } | null;
  log: LogEntry[];
}

const LOG_LIMIT = 200;
const ROLLBACK_SPAN: PhaseName[] = ["freeze", "copy", "verify", "cutover"];

export async function createMigration(deps: MigrationDeps): Promise<Migration> {
  const onPrem = connect(deps.onPremDb);
  let aws: pg.Pool | null = null;
  let progress = (await load(deps.stateFile)) ?? blank();
  let busy = false;
  const listeners = new Set<(e: MigrationEvent) => void>();

  await mkdir(deps.workDir, { recursive: true });

  const emit = (event: MigrationEvent) => {
    for (const l of listeners) l(event);
  };
  const log = (message: string, level: LogEntry["level"] = "info", phase?: PhaseName) => {
    const entry: LogEntry = { at: new Date().toISOString(), level, phase, message };
    progress.log = [...progress.log, entry].slice(-LOG_LIMIT);
    emit({ type: "log", entry });
  };
  const changed = async () => {
    if (deps.stateFile) await writeFile(deps.stateFile, JSON.stringify(progress, null, 2));
    emit({ type: "changed" });
  };
  const awsDb = (): pg.Pool => {
    if (!progress.awsSide) throw new Error("The AWS side doesn't exist yet.");
    aws ??= connect(progress.awsSide.db);
    return aws;
  };
  const closeAws = async () => {
    await aws?.end();
    aws = null;
  };
  const done = (phase: PhaseName) => progress.phases[phase].status === "done";

  /** Run one operation exclusively; misuse rejects, phase failures become state. */
  const exclusive = async (op: () => Promise<void>): Promise<MigrationState> => {
    if (busy) throw new MigrationBusyError();
    busy = true;
    emit({ type: "changed" });
    try {
      await op();
    } finally {
      busy = false;
      await changed();
    }
    return state();
  };

  const phaseWork: Record<PhaseName, (opts: { faultInjection?: boolean }) => Promise<string>> = {
    async assess() {
      progress.assessment = await fingerprint(onPrem);
      const rows = progress.assessment.map((t) => `${t.rows} ${t.table}`).join(", ");
      return `On-prem holds ${rows}.`;
    },
    async prepare() {
      log(
        "Deploying the AWS side (CloudFormation stack: RDS, ECS, load balancer).",
        "info",
        "prepare",
      );
      await closeAws();
      progress.awsSide = await deps.awsSide.deploy();
      return `AWS side is up behind ${progress.awsSide.loadBalancerDns}, empty and receiving no traffic.`;
    },
    async freeze() {
      await setWriteMode(onPrem, "frozen");
      return "On-prem is rejecting writes; shoppers are told to try again.";
    },
    async copy({ faultInjection }) {
      const file = join(deps.workDir, "copy.dump");
      const bytes = await dumpTo(deps.onPremDb, file);
      log(`Dumped on-prem (${formatBytes(bytes)}). Restoring into RDS.`, "info", "copy");
      // The AWS side may have been redeployed; never reuse a pool to an old database.
      await closeAws();
      await restoreFrom(progress.awsSide?.db ?? fail("The AWS side doesn't exist yet."), file);
      await rm(file, { force: true });
      if (faultInjection) {
        const removed = await damageInTransit(awsDb());
        log(`Fault injection: ${removed} orders were lost in transit.`, "warn", "copy");
      }
      return `Copied ${formatBytes(bytes)} from on-prem into RDS.`;
    },
    async verify() {
      const [source, target] = await Promise.all([fingerprint(onPrem), fingerprint(awsDb())]);
      const tables = source.map((s) => {
        const t = target.find((x) => x.table === s.table) ?? null;
        return {
          table: s.table,
          onPrem: s,
          aws: t,
          match: !!t && t.rows === s.rows && t.checksum === s.checksum,
        };
      });
      const dataMatches = tables.every((t) => t.match);
      const smokeOrder = dataMatches
        ? await placeSmokeOrder(awsDb(), progress.awsSide?.storeUrl ?? "")
        : null;
      progress.verification = { passed: dataMatches && !!smokeOrder?.ok, tables, smokeOrder };
      if (!dataMatches) {
        const bad = tables
          .filter((t) => !t.match)
          .map((t) => `${t.table} (${t.aws?.rows ?? 0} of ${t.onPrem.rows} rows)`);
        throw new Error(
          `Data differs: ${bad.join(", ")}. Cutover is blocked; the next step re-runs Copy.`,
        );
      }
      if (!smokeOrder?.ok)
        throw new Error(`Smoke order failed: ${smokeOrder?.error}. Cutover is blocked.`);
      return `All ${tables.length} tables match and smoke order #${smokeOrder.orderId} went through the AWS side.`;
    },
    async cutover() {
      const info = progress.awsSide ?? fail("The AWS side doesn't exist yet.");
      progress.cutoverMark = await orderMark(awsDb());
      await deps.routing.pointAt({ env: "aws", loadBalancerDns: info.loadBalancerDns });
      log(`Route53 record now points at ${info.loadBalancerDns}.`, "info", "cutover");
      await setWriteMode(awsDb(), "open");
      return "The front door sends traffic to the AWS side, and it is accepting writes.";
    },
    async decommission() {
      const path = join(deps.workDir, `final-backup-${Date.now()}.dump`);
      const bytes = await dumpTo(deps.onPremDb, path);
      progress.finalBackup = { path, bytes };
      log(`Final backup kept at ${path} (${formatBytes(bytes)}).`, "info", "decommission");
      await deps.onPremHost.decommission();
      return "On-prem is switched off. This is the point of no return.";
    },
  };

  async function runPhase(phase: PhaseName, opts: { faultInjection?: boolean }) {
    progress.phases[phase] = { status: "running", startedAt: new Date().toISOString() };
    log(`${title(phase)} started.`, "info", phase);
    await changed();
    try {
      const summary = await phaseWork[phase](opts);
      progress.phases[phase] = {
        ...progress.phases[phase],
        status: "done",
        finishedAt: new Date().toISOString(),
        summary,
      };
      log(summary, "info", phase);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      progress.phases[phase] = {
        ...progress.phases[phase],
        status: "failed",
        finishedAt: new Date().toISOString(),
        error,
      };
      log(error, "error", phase);
    }
  }

  function nextPhase(): PhaseName | null {
    // A failed Verify sends the migration back to Copy.
    if (progress.phases.verify.status === "failed") return "copy";
    return PHASES.find((name) => progress.phases[name].status !== "done") ?? null;
  }

  async function strandedOrders(): Promise<number> {
    if (!done("cutover") || done("decommission") || progress.cutoverMark === null) return 0;
    try {
      return await countOrdersAfter(awsDb(), progress.cutoverMark);
    } catch {
      return 0;
    }
  }

  async function state(): Promise<MigrationState> {
    const frozenOrCutOver = ROLLBACK_SPAN.some((p) => progress.phases[p].status !== "pending");
    return {
      phases: structuredClone(progress.phases),
      next: nextPhase(),
      busy,
      serving: await deps.routing.serving(),
      strandedOrders: await strandedOrders(),
      canRollback: frozenOrCutOver && !done("decommission"),
      assessment: progress.assessment,
      awsSide: progress.awsSide,
      verification: progress.verification,
      finalBackup: progress.finalBackup,
      log: progress.log,
    };
  }

  return {
    state,

    advance: (opts = {}) =>
      exclusive(async () => {
        const phase = nextPhase();
        if (!phase) return;
        if (phase === "copy" && progress.phases.verify.status === "failed") {
          progress.phases.verify = { status: "pending" };
          progress.verification = null;
        }
        await runPhase(phase, phase === "copy" ? opts : {});
      }),

    rollback: (opts = {}) =>
      exclusive(async () => {
        if (done("decommission")) throw new PastPointOfNoReturnError();
        if (ROLLBACK_SPAN.every((p) => progress.phases[p].status === "pending"))
          throw new NothingToRollBackError();
        if (done("cutover")) {
          const stranded = await strandedOrders();
          if (stranded > 0 && !opts.discardStrandedOrders) throw new StrandedOrdersError(stranded);
          await setWriteMode(awsDb(), "frozen");
          await deps.routing.pointAt({ env: "on-prem" });
          log(
            stranded > 0
              ? `Route53 record points back at on-prem. ${stranded} stranded orders were discarded.`
              : "Route53 record points back at on-prem.",
            stranded > 0 ? "warn" : "info",
          );
        }
        await setWriteMode(onPrem, "open");
        for (const p of ROLLBACK_SPAN) progress.phases[p] = { status: "pending" };
        progress.verification = null;
        progress.cutoverMark = null;
        log("Rolled back: on-prem is serving and accepting writes. The AWS side is kept.", "warn");
      }),

    reset: () =>
      exclusive(async () => {
        log("Reset started: removing the AWS side and restoring on-prem.", "warn");
        await deps.routing.pointAt({ env: "on-prem" });
        await closeAws();
        await deps.awsSide.destroy();
        await deps.onPremHost.restore();
        await reseed(onPrem);
        for (const entry of [progress.finalBackup?.path].filter(Boolean) as string[]) {
          await rm(entry, { force: true });
        }
        progress = blank();
        log("Reset complete: on-prem is serving seed data; the AWS side does not exist.");
      }),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async close() {
      await closeAws();
      await onPrem.end();
    },
  };
}

function blank(): Progress {
  return {
    phases: Object.fromEntries(PHASES.map((p) => [p, { status: "pending" }])) as Record<
      PhaseName,
      PhaseState
    >,
    assessment: null,
    awsSide: null,
    verification: null,
    cutoverMark: null,
    finalBackup: null,
    log: [],
  };
}

async function load(file: string | undefined): Promise<Progress | null> {
  if (!file) return null;
  try {
    const progress = JSON.parse(await readFile(file, "utf8")) as Progress;
    // An operation can't still be running in a process that just started.
    for (const p of PHASES) {
      if (progress.phases[p].status === "running") {
        progress.phases[p] = {
          ...progress.phases[p],
          status: "failed",
          error: "Interrupted by a restart.",
        };
      }
    }
    return progress;
  } catch {
    return null;
  }
}

function title(phase: PhaseName): string {
  return phase[0]?.toUpperCase() + phase.slice(1);
}

function formatBytes(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function fail(message: string): never {
  throw new Error(message);
}
