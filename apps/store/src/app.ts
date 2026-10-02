/**
 * The store's HTTP app. The same code runs on-prem and on the AWS side; only its
 * configuration differs. That sameness is what makes this a replatform.
 */
import { getWriteMode } from "@demo/store-db";
import { Hono } from "hono";
import type pg from "pg";

export type ServingEnv = "on-prem" | "aws";

export interface StoreConfig {
  servingEnv: ServingEnv;
  /** Human label for the database, shown on the served-by badge. */
  dbLabel: string;
}

export function createStoreApp(db: pg.Pool, config: StoreConfig): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    await next();
    c.header("x-served-by", config.servingEnv);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/whoami", async (c) =>
    c.json({
      servingEnv: config.servingEnv,
      database: config.dbLabel,
      writeMode: await getWriteMode(db),
    }),
  );

  app.get("/api/products", async (c) => {
    const { rows } = await db.query(
      `select id, sku, name, price_cents as "priceCents", stock from products order by id`,
    );
    return c.json(rows);
  });

  app.get("/api/orders", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 10) || 10, 50);
    const { rows } = await db.query(
      `select o.id::int, o.quantity, o.total_cents as "totalCents", o.customer,
              o.created_at as "createdAt", p.name as "productName"
         from orders o join products p on p.id = o.product_id
        order by o.id desc limit $1`,
      [limit],
    );
    return c.json(rows);
  });

  app.get("/api/orders/:id", async (c) => {
    const { rows } = await db.query(
      `select id::int, product_id as "productId", quantity, total_cents as "totalCents", customer
         from orders where id = $1`,
      [c.req.param("id")],
    );
    return rows[0] ? c.json(rows[0]) : c.json({ error: "not_found" }, 404);
  });

  app.post("/api/orders", async (c) => {
    const body = await c.req.json().catch(() => null);
    const productId = Number(body?.productId);
    const quantity = Number(body?.quantity ?? 1);
    const customer = String(body?.customer ?? "guest").slice(0, 40);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
      return c.json({ error: "invalid_order" }, 400);
    }

    const client = await db.connect();
    try {
      await client.query("begin");
      // Lock the control row so a freeze can't slip in between the check and the insert.
      const mode = await client.query("select write_mode from store_control for share");
      if (mode.rows[0]?.write_mode === "frozen") {
        await client.query("rollback");
        c.header("retry-after", "5");
        return c.json({ error: "frozen", message: "The store is moving. Try again shortly." }, 503);
      }
      const product = await client.query(
        "update products set stock = stock - $2 where id = $1 and stock >= $2 returning price_cents",
        [productId, quantity],
      );
      if (product.rowCount === 0) {
        await client.query("rollback");
        return c.json({ error: "unavailable" }, 409);
      }
      const order = await client.query(
        `insert into orders (product_id, quantity, total_cents, customer)
         values ($1, $2, $3, $4) returning id::int`,
        [productId, quantity, quantity * product.rows[0].price_cents, customer],
      );
      await client.query("commit");
      return c.json({ id: order.rows[0].id }, 201);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  return app;
}
