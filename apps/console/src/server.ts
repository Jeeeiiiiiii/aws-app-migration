import { existsSync } from "node:fs";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { Route53Client } from "@aws-sdk/client-route-53";
import { createMigration } from "@demo/migration";
import { CloudFormationAwsSide, DockerOnPremHost, Route53Routing } from "@demo/migration/adapters";
import { connect, dbConfigFromEnv } from "@demo/store-db";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createControlPlane } from "./app.ts";

const env = (name: string, fallback: string): string => process.env[name] ?? fallback;

const onPremDb = dbConfigFromEnv();
const routing = new Route53Routing({
  client: new Route53Client({}),
  zone: env("ROUTE53_ZONE", "demo.internal."),
  record: env("ROUTE53_RECORD", "store.demo.internal."),
  onPremHost: env("ON_PREM_HOST", "store-onprem"),
});

const migration = await createMigration({
  onPremDb,
  awsSide: new CloudFormationAwsSide({
    client: new CloudFormationClient({}),
    stackName: env("STACK_NAME", "store-aws"),
    templatePath: env(
      "STACK_TEMPLATE",
      new URL("../../../infra/stack.yaml", import.meta.url).pathname,
    ),
    storeImage: env("STORE_IMAGE", "aws-app-migration-store:latest"),
    dbPassword: env("AWS_DB_PASSWORD", "aws-side-secret"),
    loadBalancerHost: process.env.LOAD_BALANCER_HOST,
  }),
  routing,
  onPremHost: new DockerOnPremHost({
    containers: env("ON_PREM_CONTAINERS", "store-onprem-db,store-onprem").split(","),
    waitUntilReady: () => waitForDatabase(),
  }),
  workDir: env("WORK_DIR", "/data/migration"),
  stateFile: env("STATE_FILE", "/data/migration/state.json"),
});

// The record exists before any migration, as it would for a real domain.
await retry(() => routing.ensureRecord(), 30, 2000);

const app = createControlPlane({ migration, frontDoorUrl: process.env.FRONT_DOOR_URL });
const webRoot = new URL("../dist", import.meta.url).pathname;
if (existsSync(webRoot)) {
  app.use("/*", serveStatic({ root: webRoot }));
  app.get("*", serveStatic({ path: `${webRoot}/index.html` }));
}

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port }, () => console.log(`console on :${port}`));

async function waitForDatabase() {
  const db = connect(onPremDb);
  try {
    await retry(() => db.query("select 1"), 60, 1000);
  } finally {
    await db.end();
  }
}

async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
