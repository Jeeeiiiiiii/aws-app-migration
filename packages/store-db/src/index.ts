/**
 * The store's database: schema, deterministic seed data and write mode.
 * Shared by the store (which serves it) and the migration runner (which
 * freezes, copies, verifies and resets it).
 */
import pg from "pg";

export type WriteMode = "open" | "frozen";

/** Table the store reads its write mode from. Not store data: excluded from Verify. */
export const CONTROL_TABLE = "store_control";

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function dbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    host: env.DB_HOST ?? "localhost",
    port: Number(env.DB_PORT ?? 5432),
    database: env.DB_NAME ?? "store",
    user: env.DB_USER ?? "store",
    password: env.DB_PASSWORD ?? "store",
  };
}

export function connect(config: DbConfig): pg.Pool {
  return new pg.Pool({ ...config, max: 5, connectionTimeoutMillis: 5_000 });
}

const SCHEMA = `
create table if not exists products (
  id          serial primary key,
  sku         text not null unique,
  name        text not null,
  price_cents integer not null check (price_cents > 0),
  stock       integer not null check (stock >= 0)
);
create table if not exists orders (
  id          bigserial primary key,
  product_id  integer not null references products(id),
  quantity    integer not null check (quantity > 0),
  total_cents integer not null,
  customer    text not null,
  created_at  timestamptz not null default now()
);
create table if not exists ${CONTROL_TABLE} (
  singleton   boolean primary key default true check (singleton),
  write_mode  text not null default 'open' check (write_mode in ('open', 'frozen'))
);
insert into ${CONTROL_TABLE} (singleton) values (true) on conflict do nothing;
`;

export async function ensureSchema(db: pg.Pool): Promise<void> {
  await db.query(SCHEMA);
}

/** Drop everything and load the same seed data every time. */
export async function reseed(db: pg.Pool): Promise<void> {
  await db.query(`drop table if exists orders, products, ${CONTROL_TABLE} cascade`);
  await ensureSchema(db);
  await seed(db);
}

/** Seed an empty database; does nothing if products already exist. */
export async function seedIfEmpty(db: pg.Pool): Promise<boolean> {
  await ensureSchema(db);
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from products");
  if ((rows[0]?.n ?? 0) > 0) return false;
  await seed(db);
  return true;
}

export const SEED_PRODUCTS = 40;
export const SEED_ORDERS = 960;

async function seed(db: pg.Pool): Promise<void> {
  const rand = mulberry32(20261002);
  const adjectives = ["Field", "Harbor", "Summit", "Atlas", "Granite", "Cedar", "Pilot", "Delta"];
  const nouns = ["Backpack", "Lantern", "Thermos", "Notebook", "Compass"];
  const products = Array.from({ length: SEED_PRODUCTS }, (_, i) => {
    const name = `${adjectives[i % adjectives.length]} ${nouns[Math.floor(i / adjectives.length) % nouns.length]}`;
    return {
      sku: `SKU-${String(i + 1).padStart(4, "0")}`,
      name,
      price: 900 + Math.floor(rand() * 15000),
      stock: 50 + Math.floor(rand() * 400),
    };
  });
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into products (sku, name, price_cents, stock)
       select * from unnest($1::text[], $2::text[], $3::int[], $4::int[])`,
      [
        products.map((p) => p.sku),
        products.map((p) => p.name),
        products.map((p) => p.price),
        products.map((p) => p.stock),
      ],
    );
    const customers = ["ana", "ben", "chen", "dara", "eli", "femi", "gus", "hana", "ivo", "jun"];
    const start = Date.UTC(2026, 0, 1);
    const orders = Array.from({ length: SEED_ORDERS }, (_, i) => {
      const productIndex = Math.floor(rand() * SEED_PRODUCTS);
      const quantity = 1 + Math.floor(rand() * 3);
      return {
        productId: productIndex + 1,
        quantity,
        total: quantity * (products[productIndex]?.price ?? 0),
        customer: customers[Math.floor(rand() * customers.length)] ?? "ana",
        createdAt: new Date(start + i * 3_600_000).toISOString(),
      };
    });
    await client.query(
      `insert into orders (product_id, quantity, total_cents, customer, created_at)
       select * from unnest($1::int[], $2::int[], $3::int[], $4::text[], $5::timestamptz[])`,
      [
        orders.map((o) => o.productId),
        orders.map((o) => o.quantity),
        orders.map((o) => o.total),
        orders.map((o) => o.customer),
        orders.map((o) => o.createdAt),
      ],
    );
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function getWriteMode(db: pg.Pool): Promise<WriteMode> {
  const { rows } = await db.query<{ write_mode: WriteMode }>(
    `select write_mode from ${CONTROL_TABLE}`,
  );
  return rows[0]?.write_mode ?? "open";
}

export async function setWriteMode(db: pg.Pool, mode: WriteMode): Promise<void> {
  await db.query(`update ${CONTROL_TABLE} set write_mode = $1`, [mode]);
}

/** Small deterministic PRNG so every seed (and every Reset) produces identical data. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
