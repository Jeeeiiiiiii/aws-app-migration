/**
 * The control plane: hosts the one migration runner and exposes it over HTTP.
 * The console UI and the CLI are both clients of this; neither runs phases itself.
 */
import {
  type Migration,
  MigrationBusyError,
  NothingToRollBackError,
  PastPointOfNoReturnError,
  StrandedOrdersError,
} from "@demo/migration";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export interface ControlPlaneDeps {
  migration: Migration;
  /** The front door's traffic feed, relayed to the console. */
  frontDoorUrl?: string;
}

export function createControlPlane({ migration, frontDoorUrl }: ControlPlaneDeps): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof StrandedOrdersError) {
      return c.json({ error: "stranded_orders", message: err.message, count: err.count }, 409);
    }
    if (
      err instanceof MigrationBusyError ||
      err instanceof PastPointOfNoReturnError ||
      err instanceof NothingToRollBackError
    ) {
      return c.json({ error: err.name, message: err.message }, 409);
    }
    console.error(err);
    return c.json({ error: "internal", message: err.message }, 500);
  });

  app.get("/api/state", async (c) => c.json(await migration.state()));

  app.post("/api/advance", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await migration.advance({ faultInjection: body?.faultInjection === true }));
  });

  app.post("/api/rollback", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(
      await migration.rollback({ discardStrandedOrders: body?.discardStrandedOrders === true }),
    );
  });

  app.post("/api/reset", async (c) => c.json(await migration.reset()));

  /** Live progress: every log line, plus the full state whenever it changes. */
  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      let queue: Promise<unknown> = Promise.resolve();
      const send = (event: string, data: () => Promise<unknown> | unknown) => {
        queue = queue
          .then(async () => stream.writeSSE({ event, data: JSON.stringify(await data()) }))
          .catch(() => {});
      };
      const unsubscribe = migration.subscribe((event) => {
        if (event.type === "log") send("log", () => event.entry);
        else send("state", () => migration.state());
      });
      stream.onAbort(unsubscribe);
      send("state", () => migration.state());
      // Stranded orders and the serving environment change without runner events.
      while (!stream.aborted) {
        await stream.sleep(2000);
        send("state", () => migration.state());
      }
      unsubscribe();
    }),
  );

  app.get("/api/traffic", async (c) => {
    if (!frontDoorUrl) return c.json({ error: "no_front_door" }, 404);
    const upstream = await fetch(`${frontDoorUrl}/__front-door/traffic`, {
      signal: c.req.raw.signal,
    });
    return new Response(upstream.body, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    });
  });

  return app;
}
