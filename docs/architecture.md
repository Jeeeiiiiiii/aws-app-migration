# Architecture

Module design for the demo in [spec.md](./spec.md). Vocabulary: domain terms from
[GLOSSARY.md](../GLOSSARY.md); design terms (module, interface, seam, adapter, depth)
from the `codebase-design` skill.

## Modules at a glance

```
 shopper ─▶ synthetic traffic ─▶ FRONT DOOR :8080 ──reads──▶ Route53 record
                                     │  └─ records every request (env, status) ─▶ traffic feed
                        ┌────────────┴─────────────┐
                        ▼                          ▼
              store (on-prem)            ALB ─▶ store (AWS side, ECS)
                        │                          │
              postgres (on-prem)           RDS postgres (AWS side)
                        ▲                          ▲
                        └──── MIGRATION RUNNER ────┘  (+ CloudFormation, Route53, Docker)
                                     ▲
                       control plane (console server: HTTP + SSE)
                          ▲                         ▲
                  console UI (React)         CLI (pnpm migrate …)
```

| Module | Kind | Depth notes |
|---|---|---|
| `packages/migration` | **The deep module.** Migration runner. | Small interface (4 operations + events), hides phase ordering, guards, copy, verification, rollback rules, stranded-order accounting. |
| `apps/store` | One image, run twice. | Same code on-prem and on the AWS side; only config differs. That *is* the replatform. |
| `apps/front-door` | Small proxy. | Resolves upstream from the Route53 record; is also the single observation point for traffic. |
| `apps/traffic` | Synthetic traffic. | Deliberately dumb: shops through the front door, records nothing itself. |
| `apps/console` | Control plane + UI. | Hosts the one runner instance; the UI and CLI are both clients of it. |
| `infra/stack.yaml` | CloudFormation. | RDS, ECS cluster/service, ALB, Route53 record. |

## The migration runner (`packages/migration`)

### Interface

```ts
createMigration(deps: MigrationDeps): Migration

interface Migration {
  /** Current snapshot: each phase's status, serving environment, stranded-order count. */
  state(): MigrationState

  /** Run the next phase. Options apply to that phase only. */
  advance(opts?: { faultInjection?: boolean }): Promise<MigrationState>

  /** Return the serving environment to on-prem. */
  rollback(opts?: { discardStrandedOrders?: boolean }): Promise<MigrationState>

  /** Remove the AWS side, restore on-prem with seed data, back to "before". */
  reset(): Promise<MigrationState>

  /** Progress events for live display: phase started/progress/finished/failed, log lines. */
  subscribe(listener: (e: MigrationEvent) => void): () => void
}
```

What a caller must know (the rest of the interface):

- **Ordering is the runner's job, not the caller's.** There is no `runPhase(name)`;
  `advance()` always runs the next phase in the fixed order. Callers cannot run phases
  out of order, so no caller can get it wrong.
- **One operation at a time.** Calling any operation while one is running rejects with
  `MigrationBusyError`.
- **A failed Verify sends the migration back to Copy.** The next `advance()` re-runs Copy
  (fault injection off unless asked again), then Verify. Cutover is unreachable until
  Verify passes.
- **Rollback** is allowed from Freeze through Cutover. After Cutover, if there are
  stranded orders and `discardStrandedOrders` isn't set, it rejects with
  `StrandedOrdersError { count }`; the caller shows the count and asks to confirm.
  After Decommission it rejects with `PastPointOfNoReturnError`.
- **Failures are states, not crashes.** A phase that fails leaves `state()` showing which
  phase failed and why; the operation's promise resolves with that state. Only misuse
  (busy, stranded, past point of no return) rejects.

### What it hides

- The phase table and the guard logic above.
- **Copy:** `pg_dump` of on-prem, restore into RDS, optional fault injection (deletes a
  few order rows mid-flight).
- **Verify:** per-table row counts and checksums (md5 over rows in primary-key order),
  excluding the store's control table, plus a smoke order placed directly against the
  AWS side's load balancer and read back.
- **Freeze / lift:** sets the store's write mode in the relevant database (see below).
- **Stranded orders:** counted as orders on the AWS side newer than the cutover mark.
- **Decommission:** final backup (`pg_dump` to a file kept in a volume), then stop and
  remove the on-prem containers.

### Seams and adapters

Classified per `codebase-design/DEEPENING.md`:

| Dependency | Category | Seam |
|---|---|---|
| Postgres (on-prem and RDS) | Local-substitutable | **No port.** Tests run real Postgres containers. |
| CloudFormation (deploy/outputs/delete stack) | True external | **Port `AwsSide`**: `deploy()`, `outputs()`, `destroy()`. Adapters: AWS SDK (Floci in practice, real AWS in principle) and in-memory fake. |
| Route53 record | True external | **Port `Routing`**: `serving()`, `pointAt(env)`. Adapters: AWS SDK and in-memory fake. |
| On-prem containers (stop/start) | Local, but slow and destructive | **Port `OnPremHost`**: `decommission()`, `restore()`. Adapters: Docker socket and fake. |

Each port has two adapters (production and test), so each seam is real. Phases are an
**internal seam**: each phase is a small object the runner's own tests can use, but
it never appears in the interface.

### Why one long-lived host

ADR 0001 needs the CLI and console to drive the *same* runner. The runner holds state
and streams events, so it lives in one process: the console server (control plane).
The CLI is an HTTP client of that server, not a second runner. Two runners racing over
the same environments is the failure this rules out.

## Freeze lives in the store's own database

The store reads its write mode from a one-row control table in whatever database it is
connected to. Freezing on-prem sets it there; Copy carries the frozen flag to RDS, so
the AWS side also starts frozen; Cutover lifts it on the AWS side after the record
flips. No extra coordination channel, and nothing can write to the AWS side before
Cutover. The control table is excluded from Verify.

## Traffic observation

The front door records every request it proxies (time, upstream environment, status)
and exposes them as a feed. The console charts that feed. Synthetic traffic stays a
dumb shopper, and any real browser request through the front door shows up on the chart
too.

## Networking

Floci launches RDS and ECS containers itself. It has a `floci.services.docker-network`
setting; the plan is to point it at the compose network so every container, ours and
Floci's, shares one network. To be confirmed during the build; fallback is publishing
Floci's proxy and listener ports.
