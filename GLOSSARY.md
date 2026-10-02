# AWS App Migration

A demo of a replatform migration: an orders store moves from an on-prem environment to AWS while synthetic users keep shopping, and each step of the move is visible.

## Environments

**On-prem**:
The environment the store runs in before the migration; the source of the move.
_Avoid_: Legacy, old system, source environment, local

**AWS side**:
The environment the store runs in after the migration; the destination of the move.
_Avoid_: Cloud, target, new system

**Serving environment**:
The environment that real store traffic currently reaches.
_Avoid_: Active side, live environment

**Front door**:
The single public address users reach the store through, regardless of the serving environment.
_Avoid_: Proxy, gateway, entrypoint

## The migration

**Migration**:
The whole move of the store, its data and its traffic from on-prem to the AWS side.
_Avoid_: Deployment, transfer

**Replatform**:
A migration strategy that moves an application with small changes so it runs on managed services, without rewriting it.
_Avoid_: Lift-and-shift (that is rehost), modernization

**Phase**:
One named step of the migration, completed in a fixed order.
_Avoid_: Stage, step, task

**Assess**:
The phase that takes inventory of what exists on-prem before anything moves.

**Prepare**:
The phase that brings the AWS side into existence, empty of data and receiving no traffic.
_Avoid_: Provision, bootstrap

**Freeze**:
The phase during which on-prem rejects writes so its data cannot change while being moved; shoppers are told to try again.
_Avoid_: Maintenance mode, lock, write lock

**Copy**:
The phase that moves the store's data from on-prem to the AWS side.
_Avoid_: Sync, replication, data migration

**Verify**:
The phase that proves the AWS side holds the same data as on-prem and actually works.
_Avoid_: Validate, check, test

**Smoke order**:
An order placed through the AWS side during Verify to prove it works end to end.
_Avoid_: Test order, canary order

**Cutover**:
The moment the front door starts sending traffic to the AWS side instead of on-prem.
_Avoid_: Switchover, go-live, flip

**Decommission**:
The phase that removes on-prem after cutover, ending the possibility of rollback.
_Avoid_: Teardown, shutdown, retire

**Final backup**:
The last copy of on-prem data, kept after decommission.
_Avoid_: Snapshot, archive

**Point of no return**:
The moment after which rollback is impossible; decommission.

**Rollback**:
Abandoning the migration and returning the serving environment to on-prem.
_Avoid_: Revert, undo, abort

**Stranded order**:
An order placed on the AWS side after cutover, which a rollback would discard.
_Avoid_: Lost order, orphan

**Reset**:
Returning the whole demo to its state before the migration so it can be replayed.
_Avoid_: Rollback (a rollback keeps the AWS side; a reset removes it)

## Demonstration

**Synthetic traffic**:
Simulated shoppers that browse and place orders continuously so the migration's effect on users is visible.
_Avoid_: Load test, traffic generator, fake users

**Fault injection**:
Deliberately damaging data during copy to show verify blocking the cutover.
_Avoid_: Chaos, sabotage, break mode

**Served-by badge**:
The mark on every store page naming the serving environment and its database.
_Avoid_: Environment banner, indicator
