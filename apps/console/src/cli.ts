/**
 * pnpm migrate <command>: drives the same runner the console does, through the
 * control plane, and prints its progress live.
 *
 *   status                          where the migration is
 *   next [--fault]                  run the next phase (--fault: fault injection during Copy)
 *   rollback [--discard-stranded]   return the serving environment to on-prem
 *   reset                           back to before the migration
 */
import type { LogEntry, MigrationState } from "@demo/migration";

const base = process.env.CONSOLE_URL ?? "http://localhost:4000";
const [command = "status", ...flags] = process.argv.slice(2);

const MARK = { pending: " ", running: "…", done: "✓", failed: "✗" } as const;

function printState(s: MigrationState) {
  for (const [name, p] of Object.entries(s.phases)) {
    console.log(`  [${MARK[p.status]}] ${name.padEnd(13)} ${p.error ?? p.summary ?? ""}`);
  }
  console.log(`\n  serving: ${s.serving}   next: ${s.next ?? "(complete)"}`);
  if (s.strandedOrders > 0) console.log(`  stranded orders: ${s.strandedOrders}`);
}

/** Print the runner's log lines as they happen, until aborted. */
async function follow(signal: AbortSignal) {
  const res = await fetch(`${base}/api/events`, { signal }).catch(() => null);
  if (!res?.body) return;
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
        const message = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = message.split("\n").find((l) => l.startsWith("data:"));
        if (message.includes("event: log") && data) {
          const entry = JSON.parse(data.slice(5)) as LogEntry;
          console.log(`  ${entry.at.slice(11, 19)}  ${entry.message}`);
        }
      }
    }
  } catch {
    // aborted once the operation finishes
  }
}

async function operate(path: string, body: unknown) {
  const stop = new AbortController();
  void follow(stop.signal);
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  stop.abort();
  const json = (await res.json()) as MigrationState & { message?: string; count?: number };
  if (!res.ok) {
    console.error(`\n  ${json.message}`);
    if (json.count) console.error("  Run `pnpm migrate rollback --discard-stranded` to confirm.");
    process.exitCode = 1;
    return;
  }
  console.log("");
  printState(json);
}

switch (command) {
  case "status":
    printState((await (await fetch(`${base}/api/state`)).json()) as MigrationState);
    break;
  case "next":
    await operate("/api/advance", { faultInjection: flags.includes("--fault") });
    break;
  case "rollback":
    await operate("/api/rollback", { discardStrandedOrders: flags.includes("--discard-stranded") });
    break;
  case "reset":
    await operate("/api/reset", {});
    break;
  default:
    console.error(`Unknown command "${command}". Use status, next, rollback or reset.`);
    process.exitCode = 1;
}
