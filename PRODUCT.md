# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated during design interview: TypeScript monorepo, Hono APIs, React + Vite frontends, Node 22 with native type stripping. Local AWS via the Floci emulator. See docs/spec.md.

## Users

Primary: the builder, learning how a real cloud migration works by running one end to end. Secondary: people the builder shows it to (teammates, interviewers, portfolio viewers), usually watching a screen share or a recording while the builder narrates.

## Product Purpose

A demo of a **replatform migration**: a small orders store moves from an on-prem environment (Docker) to the AWS side (ECS + RDS on a local emulator) while synthetic shoppers keep using it. Success is a viewer who has never done a migration understanding, in a few minutes, the phases, the risk (data), the safety nets (verify, rollback), and the moment of cutover, because they watched each happen.

## Positioning

Not slides about migration: a real migration that runs, can fail visibly, and can be replayed. Every number on screen comes from the running system (requests, row counts, checksums, record values), not from a script.

## Operating Context

- Two surfaces: the **store** (a shopper's view, with a served-by badge) and the **migration console** (the operator's view, driven by the builder, often while presenting).
- The console is used in sessions of 5 to 15 minutes, stepping through phases, sometimes triggering fault injection or rollback on purpose, then Reset to replay.
- Also driven from a terminal via the CLI; the console must reflect CLI-driven progress live.
- Terms are fixed in GLOSSARY.md (on-prem, AWS side, freeze, copy, verify, cutover, decommission, rollback, reset, stranded order).

## Capabilities and Constraints

- Phases run in a fixed order: Assess, Prepare, Freeze, Copy, Verify, Cutover, Decommission. Rollback from Freeze through Cutover; Decommission is the point of no return; Reset replays.
- Freeze rejects writes (visible as errors); rollback after cutover discards stranded orders after an explicit confirmation showing the count.
- Emulator gaps are shown honestly in the product: no ECR push, no DMS.
- Everything runs locally from one `docker compose up`.

## Evidence on Hand

- All data is synthetic: seeded store data (40 products, 960 orders) and synthetic traffic. Label it as such where a viewer could mistake it for real business data.
- No customers, benchmarks, or claims about real AWS performance exist; none may be invented.

## Product Principles

1. Show, don't narrate: every state on screen is read from the running system.
2. Failure is a feature: safety nets must be visibly exercised, not just described.
3. One vocabulary everywhere: the glossary's terms in UI, CLI, docs, and code.
4. Honest about the emulator: gaps are labeled, never faked.
5. Replayable: any state can return to "before" in one action.
