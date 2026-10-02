import { existsSync } from "node:fs";
import { connect, dbConfigFromEnv, seedIfEmpty } from "@demo/store-db";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createStoreApp, type ServingEnv } from "./app.ts";

const servingEnv = (process.env.SERVING_ENV ?? "on-prem") as ServingEnv;
const db = connect(dbConfigFromEnv());

// On-prem is the original system, so it seeds itself on first boot. The AWS side
// gets its data only from the migration.
if (process.env.SEED_ON_EMPTY === "true") {
  if (await seedIfEmpty(db)) console.log("seeded empty database");
} else {
  await waitForDatabase();
}

const app = createStoreApp(db, {
  servingEnv,
  dbLabel: process.env.DB_LABEL ?? `postgres ${process.env.DB_HOST ?? "localhost"}`,
});

const webRoot = new URL("../dist", import.meta.url).pathname;
if (existsSync(webRoot)) {
  app.use("/*", serveStatic({ root: webRoot }));
  app.get("*", serveStatic({ path: `${webRoot}/index.html` }));
}

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`store (${servingEnv}) on :${port}`));

async function waitForDatabase() {
  for (let attempt = 1; ; attempt++) {
    try {
      await db.query("select 1");
      return;
    } catch (err) {
      if (attempt >= 60) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
