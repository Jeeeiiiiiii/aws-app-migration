/** Data operations behind Assess, Copy, Verify and Decommission. Internal to the runner. */
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import { CONTROL_TABLE, type DbConfig, setWriteMode } from "@demo/store-db";
import type pg from "pg";
import type { TableFingerprint } from "./types.ts";

const run = promisify(execFile);

/** Row count and checksum of every store table (the control table is not store data). */
export async function fingerprint(db: pg.Pool): Promise<TableFingerprint[]> {
  const { rows: tables } = await db.query<{ name: string }>(
    `select table_name as name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> $1
      order by table_name`,
    [CONTROL_TABLE],
  );
  const result: TableFingerprint[] = [];
  for (const { name } of tables) {
    const { rows } = await db.query<{ rows: number; checksum: string | null }>(
      `select count(*)::int as rows,
              md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) as checksum
         from ${quoteIdent(name)} t`,
    );
    result.push({ table: name, rows: rows[0]?.rows ?? 0, checksum: rows[0]?.checksum ?? "" });
  }
  return result;
}

/** Dump a database to a file in pg_dump's custom format. Returns the file size. */
export async function dumpTo(db: DbConfig, file: string): Promise<number> {
  await run(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", `--file=${file}`, ...connArgs(db)],
    {
      env: pgEnv(db),
    },
  );
  return (await stat(file)).size;
}

/** Restore a dump over a database, replacing whatever store tables it already has. */
export async function restoreFrom(db: DbConfig, file: string): Promise<void> {
  await run(
    "pg_restore",
    ["--clean", "--if-exists", "--no-owner", "--no-acl", "--exit-on-error", ...connArgs(db), file],
    { env: pgEnv(db) },
  );
}

/** Fault injection: damage data on its way in, so Verify has something to catch. */
export async function damageInTransit(db: pg.Pool): Promise<number> {
  const { rowCount } = await db.query(
    "delete from orders where id in (select id from orders order by md5(id::text) limit 7)",
  );
  return rowCount ?? 0;
}

/** Highest order id; orders above it after cutover are stranded orders. */
export async function orderMark(db: pg.Pool): Promise<number> {
  const { rows } = await db.query<{ mark: number }>(
    "select coalesce(max(id), 0)::int as mark from orders",
  );
  return rows[0]?.mark ?? 0;
}

export async function countOrdersAfter(db: pg.Pool, mark: number): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from orders where id > $1",
    [mark],
  );
  return rows[0]?.n ?? 0;
}

/**
 * Place an order through the AWS side's store and read it back, then remove it so
 * it doesn't count as a difference. The AWS side is frozen (the flag came with the
 * copy), so writes are opened for the duration; no traffic reaches it before cutover.
 */
export async function placeSmokeOrder(
  db: pg.Pool,
  storeUrl: string,
): Promise<{ ok: boolean; orderId?: number; error?: string }> {
  await setWriteMode(db, "open");
  try {
    const placed = await fetch(`${storeUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: 1, quantity: 1, customer: "smoke-test" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (placed.status !== 201)
      return { ok: false, error: `placing the order returned ${placed.status}` };
    const { id } = (await placed.json()) as { id: number };
    const read = await fetch(`${storeUrl}/api/orders/${id}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const order = read.ok ? ((await read.json()) as { customer?: string }) : null;
    await db.query(
      `with gone as (delete from orders where id = $1 returning product_id, quantity)
       update products p set stock = p.stock + gone.quantity from gone where p.id = gone.product_id`,
      [id],
    );
    // Rewind the sequence so the smoke order leaves no trace in the next order id either.
    await db.query(
      "select setval(pg_get_serial_sequence('orders', 'id'), coalesce(max(id), 1), max(id) is not null) from orders",
    );
    if (order?.customer !== "smoke-test")
      return { ok: false, orderId: id, error: "the order could not be read back" };
    return { ok: true, orderId: id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await setWriteMode(db, "frozen");
  }
}

function connArgs(db: DbConfig): string[] {
  return [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--username=${db.user}`,
    `--dbname=${db.database}`,
  ];
}

function pgEnv(db: DbConfig): NodeJS.ProcessEnv {
  return { ...process.env, PGPASSWORD: db.password, PGCONNECT_TIMEOUT: "10" };
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
