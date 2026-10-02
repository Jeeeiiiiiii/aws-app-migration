import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { createStoreApp } from "@demo/store/app";
import { getWriteMode, reseed } from "@demo/store-db";
import { freshDatabase, type TestDatabase } from "@demo/store-db/testing";
import { serve } from "@hono/node-server";
import { MemoryAwsSide, MemoryOnPremHost, MemoryRouting } from "./adapters/memory.ts";
import { createMigration, type Migration } from "./migration.ts";
import { PastPointOfNoReturnError, type PhaseName, StrandedOrdersError } from "./types.ts";

let onPrem: TestDatabase;
let aws: TestDatabase;
let server: ReturnType<typeof serve>;
let routing: MemoryRouting;
let host: MemoryOnPremHost;
let awsSide: MemoryAwsSide;
let migration: Migration;
let storeUrl: string;

beforeEach(async () => {
  onPrem = await freshDatabase();
  aws = await freshDatabase();
  await reseed(onPrem.pool);
  // The AWS side's store: the real store app, on a real port, over the AWS database.
  server = serve({
    fetch: createStoreApp(aws.pool, { servingEnv: "aws", dbLabel: "RDS" }).fetch,
    port: 0,
  });
  await new Promise((r) => server.once("listening", r));
  storeUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  routing = new MemoryRouting();
  host = new MemoryOnPremHost();
  awsSide = new MemoryAwsSide({ db: aws.config, storeUrl, loadBalancerDns: "store-alb.elb.test" });
  migration = await createMigration({
    onPremDb: onPrem.config,
    awsSide,
    routing,
    onPremHost: host,
    workDir: await mkdtemp(join(tmpdir(), "migration-")),
  });
});

afterEach(async () => {
  await migration.close();
  server.close();
  await onPrem.drop();
  await aws.drop();
});

async function advanceThrough(last: PhaseName, opts = {}) {
  for (;;) {
    const s = await migration.advance(opts);
    const phase = Object.entries(s.phases).find(([, p]) => p.status === "failed");
    if (phase) assert.fail(`${phase[0]} failed: ${phase[1].error}`);
    if (s.phases[last].status === "done") return s;
  }
}

const placeOrder = (url: string) =>
  fetch(`${url}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId: 2, quantity: 1, customer: "shopper" }),
  });

test("phases run in order and the migration ends served from AWS with on-prem decommissioned", async () => {
  const start = await migration.state();
  assert.equal(start.next, "assess");
  assert.equal(start.serving, "on-prem");

  const s = await advanceThrough("decommission");
  assert.equal(s.next, null);
  assert.equal(s.serving, "aws");
  assert.deepEqual(routing.target, { env: "aws", loadBalancerDns: "store-alb.elb.test" });
  assert.equal(host.running, false);
  assert.ok(s.finalBackup && s.finalBackup.bytes > 0);
  assert.equal(await getWriteMode(aws.pool), "open");
  assert.ok(s.verification?.passed);
  assert.ok(s.verification?.smokeOrder?.ok);
});

test("freeze makes on-prem reject writes", async () => {
  await advanceThrough("freeze");
  assert.equal(await getWriteMode(onPrem.pool), "frozen");
});

test("verify leaves no trace of the smoke order", async () => {
  await advanceThrough("verify");
  const snapshot = async (db: TestDatabase) =>
    (
      await db.pool.query(
        "select (select count(*) from orders)::int as orders, (select sum(stock) from products)::int as stock",
      )
    ).rows[0];
  assert.deepEqual(await snapshot(aws), await snapshot(onPrem));
  assert.equal(await getWriteMode(aws.pool), "frozen", "AWS side stays frozen until cutover");
});

test("fault injection makes verify fail and block cutover; the next step re-runs copy", async () => {
  await advanceThrough("freeze");
  await migration.advance({ faultInjection: true }); // copy, damaged
  const failed = await migration.advance(); // verify
  assert.equal(failed.phases.verify.status, "failed");
  assert.match(failed.phases.verify.error ?? "", /orders/);
  assert.equal(failed.next, "copy");
  assert.equal(failed.serving, "on-prem");

  await migration.advance(); // clean copy
  const verified = await migration.advance();
  assert.equal(verified.phases.verify.status, "done");
  assert.equal(verified.next, "cutover");
});

test("rollback before cutover reopens on-prem and keeps the AWS side", async () => {
  await advanceThrough("copy");
  const s = await migration.rollback();
  assert.equal(await getWriteMode(onPrem.pool), "open");
  assert.equal(s.next, "freeze");
  assert.equal(s.phases.prepare.status, "done");
  assert.equal(awsSide.deployed, true);
});

test("rollback after cutover refuses to discard stranded orders without confirmation", async () => {
  await advanceThrough("cutover");
  assert.equal((await placeOrder(storeUrl)).status, 201);
  assert.equal((await placeOrder(storeUrl)).status, 201);
  assert.equal((await migration.state()).strandedOrders, 2);

  await assert.rejects(migration.rollback(), (err: unknown) => {
    assert.ok(err instanceof StrandedOrdersError);
    assert.equal(err.count, 2);
    return true;
  });
  assert.equal((await migration.state()).serving, "aws");

  const s = await migration.rollback({ discardStrandedOrders: true });
  assert.equal(s.serving, "on-prem");
  assert.equal(await getWriteMode(onPrem.pool), "open");
  assert.equal(await getWriteMode(aws.pool), "frozen");
});

test("decommission is the point of no return; reset replays from the start", async () => {
  await advanceThrough("decommission");
  await assert.rejects(migration.rollback(), PastPointOfNoReturnError);

  const s = await migration.reset();
  assert.equal(s.next, "assess");
  assert.equal(s.serving, "on-prem");
  assert.equal(host.running, true);
  assert.equal(awsSide.deployed, false);
  assert.equal(await getWriteMode(onPrem.pool), "open");
});

test("only one operation runs at a time", async () => {
  const first = migration.advance();
  await assert.rejects(migration.advance(), /already running/);
  await first;
});
