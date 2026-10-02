# Spec: replatform migration demo

A hands-on, presentable demo of a real-world **replatform migration**: a small
TypeScript orders app moves from "on-prem" (Docker) to AWS (ECS + RDS on the
[Floci](https://github.com/floci-io/floci-ui) local emulator), and every phase is
visible while it happens. Terms are defined in [GLOSSARY.md](../GLOSSARY.md);
decisions with lasting consequences are in [docs/adr](./adr).

## Audience

The builder's own learning first, but clean enough to show others (portfolio,
team, interviews): a clear README and a polished console, no tutorial hand-holding.

## System

| Part | What it is |
|---|---|
| `apps/store` | Orders app: products and orders, ~1,000 seeded rows. Hono API + React/Vite. Shows a served-by badge: environment and database currently serving the request. |
| `apps/console` | Migration console: phase timeline, live traffic chart, before/after views, Rollback, Reset, fault-injection toggle. React/Vite, live over SSE. Dark "mission control" theme with a light toggle. |
| `packages/migration` | The migration runner: each phase defined once, driven by both the CLI (`pnpm migrate <phase>`) and the console. See ADR 0001. |
| Front door | Proxy at `localhost:8080`, the stand-in for the public domain. Routes to whatever the Route53 record names. See ADR 0002. |
| Traffic generator | Synthetic users that browse and place orders continuously. |
| Infra | One CloudFormation stack: RDS Postgres, ECS Fargate service, ALB, Route53 record. See ADR 0003, 0004. |
| Startup | `docker compose up` starts everything, including Floci configured so it can launch real containers. |

## Phases

1. **Assess**: inventory the on-prem side (tables, row counts, app version).
2. **Prepare**: deploy the CloudFormation stack.
3. **Freeze**: on-prem stops accepting writes; reads keep working.
4. **Copy**: pg_dump on-prem, restore into RDS.
5. **Verify**: per-table row counts and checksums, plus a smoke order through the AWS side. A failure blocks Cutover.
6. **Cutover**: point the Route53 record at the AWS load balancer, then lift the freeze.
7. **Decommission**: take a final backup, then remove the on-prem app and database. Point of no return.

**Rollback** is available from Freeze through Cutover. **Reset** returns everything to
the starting state so the demo can be replayed.

**Fault injection**: a console toggle that corrupts data during Copy, so Verify visibly
blocks Cutover.

## Testing

- Unit tests for each phase against a real Postgres.
- One end-to-end test: full migration on Floci, asserting the served-by badge flips.
- GitHub Actions: lint, typecheck, unit tests on every push; end-to-end locally and as a manual workflow.

## Out of scope for v1 (stretch)

- Online (near-zero downtime) copy with continuous replication.
- Weighted Route53 canary.
- Terraform variant of the infra.

## Emulator gaps (documented, not hidden)

- No ECR push: ECS runs the locally built image (ADR 0004).
- No DMS: data is copied with pg_dump/restore (ADR 0005).
- Emulated endpoints live on Floci's Docker bridge IP, not `localhost`.
- Floci needs access to the host Docker socket group to start real containers.
