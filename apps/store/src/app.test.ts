import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { reseed, setWriteMode } from "@demo/store-db";
import { freshDatabase, type TestDatabase } from "@demo/store-db/testing";
import { createStoreApp } from "./app.ts";

let db: TestDatabase;
let app: ReturnType<typeof createStoreApp>;
before(async () => {
  db = await freshDatabase();
  await reseed(db.pool);
  app = createStoreApp(db.pool, { servingEnv: "aws", dbLabel: "RDS test" });
});
after(() => db.drop());

const order = (body: unknown) =>
  app.request("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("every response says which environment served it", async () => {
  const res = await app.request("/api/health");
  assert.equal(res.headers.get("x-served-by"), "aws");
});

test("whoami reports environment, database and write mode", async () => {
  const res = await app.request("/api/whoami");
  assert.deepEqual(await res.json(), {
    servingEnv: "aws",
    database: "RDS test",
    writeMode: "open",
  });
});

test("placing an order stores it and takes stock", async () => {
  const before = (await db.pool.query("select stock from products where id = 1")).rows[0].stock;
  const res = await order({ productId: 1, quantity: 2, customer: "zoe" });
  assert.equal(res.status, 201);
  const { id } = (await res.json()) as { id: number };
  const read = (await (await app.request(`/api/orders/${id}`)).json()) as { customer: string };
  assert.equal(read.customer, "zoe");
  const after = (await db.pool.query("select stock from products where id = 1")).rows[0].stock;
  assert.equal(after, before - 2);
});

test("a frozen store rejects orders with a try-again response", async () => {
  await setWriteMode(db.pool, "frozen");
  const res = await order({ productId: 1, quantity: 1 });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("retry-after"), "5");
  assert.equal(((await res.json()) as { error: string }).error, "frozen");
  await setWriteMode(db.pool, "open");
});

test("rejects invalid orders", async () => {
  assert.equal((await order({ productId: "x" })).status, 400);
  assert.equal((await order({ productId: 1, quantity: 100000 })).status, 409);
});
