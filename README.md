# aws-app-migration

A hands-on **replatform migration** you can watch. A small orders store moves from
"on-prem" (Docker) to AWS (ECS Fargate + RDS Postgres behind a load balancer, on the
[Floci](https://github.com/floci-io/floci-ui) local AWS emulator), while synthetic
shoppers keep using it. Every phase is real: CloudFormation builds the AWS side,
`pg_dump`/`pg_restore` copy the data, checksums verify it, and a Route53 record
change cuts the traffic over.

Design and decisions: [docs/spec.md](docs/spec.md), [docs/architecture.md](docs/architecture.md),
[docs/adr](docs/adr). Terms: [GLOSSARY.md](GLOSSARY.md).

## Run it

Needs Docker (Compose v2) and nothing else.

```sh
docker compose up --build
```

| Open | What it is |
|---|---|
| <http://localhost:4000> | **Migration console**: the system drawing, live traffic, phases, rollback and reset |
| <http://localhost:8080> | **The store**, through the front door, with its *served by* badge |

Drive the migration from the console, or from a terminal (needs Node 22.18+ and pnpm):

```sh
pnpm install
pnpm migrate status
pnpm migrate next            # run the next phase
pnpm migrate next --fault    # during Copy: lose some orders in transit, watch Verify block cutover
pnpm migrate rollback        # back to on-prem (asks before discarding stranded orders)
pnpm migrate reset           # back to before, to replay
```

The console and the CLI drive the same runner, so each shows what the other did.

## The phases

| Phase | What actually happens |
|---|---|
| Assess | Row counts and checksums of every on-prem table |
| Prepare | `CloudFormation` deploys RDS, an ECS Fargate service and an ALB; waits until the store answers |
| Freeze | On-prem rejects writes (shoppers get *try again*), so the data can't change mid-move |
| Copy | `pg_dump` on-prem, `pg_restore` into RDS |
| Verify | Every table's row count and checksum must match, then a smoke order goes through the AWS side. A mismatch blocks cutover and sends you back to Copy |
| Cutover | The Route53 record now points at the load balancer; the front door follows within the record's 5s TTL |
| Decommission | A final backup is kept, then on-prem's containers are stopped. Point of no return |

**Rollback** works from Freeze through Cutover. After cutover, orders placed on AWS
(*stranded orders*) would be lost, so it shows the count and asks you to confirm.

## What's in here

```
apps/store         the store: one image, run on-prem by compose and on the AWS side by ECS
apps/front-door    the public address; follows the Route53 record, records every request
apps/traffic       synthetic shoppers
apps/console       control plane (hosts the runner, HTTP + SSE), console UI, CLI
packages/migration the migration runner: phases, guards, safety nets, adapters
packages/store-db  the store's schema, seed data and write mode
infra/stack.yaml   the AWS side as one CloudFormation stack
e2e/               the whole migration end to end on Floci
```

## Develop

```sh
docker run -d --name test-pg -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16-alpine
pnpm lint && pnpm typecheck && pnpm test   # unit tests use real Postgres; Copy needs pg_dump 16 on PATH
docker compose up -d --build && pnpm test:e2e
```

Node runs the TypeScript directly (type stripping), so there is no build step for the
servers; only the two web UIs are built with Vite.

## Honest about the emulator

- **No ECR push.** Floci's registry can't accept pushes reliably, so the ECS task uses the
  locally built store image ([ADR 0004](docs/adr/0004-ecs-uses-local-image-not-ecr.md)).
- **No DMS.** Data moves offline with `pg_dump`/`pg_restore` behind a write freeze
  ([ADR 0005](docs/adr/0005-offline-copy-with-write-freeze.md)).
- **Load balancer names don't resolve.** Floci serves ALB listeners on its own container,
  so the front door maps the record's ALB name to `floci:8080`. In real AWS it would just
  resolve the name.
- Floci runs as root in compose so it can start the RDS and ECS containers through the
  Docker socket.

Behind a TLS-inspecting proxy, pass its CA to the image build:
`EXTRA_CA_CERT=/path/to/ca.pem docker compose build`.

## Project skills

`.claude/skills/` holds the skills used to design and review this project
(sources in [.claude/skills/THIRD_PARTY.md](.claude/skills/THIRD_PARTY.md)):
`/grill-me` → `codebase-design` → `/improve-codebase-architecture` → `archify` →
`/code-review` and `/spec-review`, plus `impeccable`, `taste-skill` and `emil-design-eng` for the UI.
