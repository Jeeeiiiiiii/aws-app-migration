import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  getWriteMode,
  reseed,
  SEED_ORDERS,
  SEED_PRODUCTS,
  seedIfEmpty,
  setWriteMode,
} from "./index.ts";
import { freshDatabase, type TestDatabase } from "./testing.ts";

let db: TestDatabase;
before(async () => {
  db = await freshDatabase();
});
after(() => db.drop());

test("seeds an empty database once", async () => {
  assert.equal(await seedIfEmpty(db.pool), true);
  assert.equal(await seedIfEmpty(db.pool), false);
  const { rows } = await db.pool.query(
    "select (select count(*) from products)::int p, (select count(*) from orders)::int o",
  );
  assert.deepEqual(rows[0], { p: SEED_PRODUCTS, o: SEED_ORDERS });
});

test("reseed produces identical data every time", async () => {
  const digest = async () =>
    (await db.pool.query("select md5(string_agg(o::text, '|' order by o.id)) d from orders o"))
      .rows[0].d;
  await reseed(db.pool);
  const first = await digest();
  await db.pool.query("delete from orders where id < 10");
  await reseed(db.pool);
  assert.equal(await digest(), first);
});

test("write mode starts open and can be frozen", async () => {
  await reseed(db.pool);
  assert.equal(await getWriteMode(db.pool), "open");
  await setWriteMode(db.pool, "frozen");
  assert.equal(await getWriteMode(db.pool), "frozen");
});
