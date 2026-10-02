import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Migration,
  type MigrationState,
  PastPointOfNoReturnError,
  StrandedOrdersError,
} from "@demo/migration";
import { createControlPlane } from "./app.ts";

const state = { next: "assess" } as MigrationState;

function fakeMigration(overrides: Partial<Migration> = {}): Migration & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    state: async () => state,
    advance: async (opts) => {
      calls.push(["advance", opts]);
      return state;
    },
    rollback: async (opts) => {
      calls.push(["rollback", opts]);
      return state;
    },
    reset: async () => state,
    subscribe: () => () => {},
    close: async () => {},
    ...overrides,
  };
}

const post = (app: ReturnType<typeof createControlPlane>, path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("advance passes fault injection through only when explicitly true", async () => {
  const migration = fakeMigration();
  const app = createControlPlane({ migration });
  await post(app, "/api/advance", { faultInjection: true });
  await post(app, "/api/advance", { faultInjection: "yes" });
  assert.deepEqual(migration.calls, [
    ["advance", { faultInjection: true }],
    ["advance", { faultInjection: false }],
  ]);
});

test("stranded orders come back as 409 with the count, so clients can ask to confirm", async () => {
  const app = createControlPlane({
    migration: fakeMigration({
      rollback: async () => {
        throw new StrandedOrdersError(12);
      },
    }),
  });
  const res = await post(app, "/api/rollback", {});
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error: string; count: number };
  assert.equal(body.error, "stranded_orders");
  assert.equal(body.count, 12);
});

test("misuse is a 409 with the runner's explanation", async () => {
  const app = createControlPlane({
    migration: fakeMigration({
      rollback: async () => {
        throw new PastPointOfNoReturnError();
      },
    }),
  });
  const res = await post(app, "/api/rollback", { discardStrandedOrders: true });
  assert.equal(res.status, 409);
  assert.match(((await res.json()) as { message: string }).message, /decommissioned/);
});
