/**
 * The front door: the single address shoppers use. It sends each request wherever
 * the Route53 record currently points, and records what happened for the console.
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { type Env, TrafficLog } from "./traffic.ts";

export interface Upstream {
  env: Env;
  url: string;
  /** The record's value, shown in the console. */
  recordValue: string;
}

export interface FrontDoorDeps {
  /** Where traffic should go now (the adapter caches per the record's TTL). */
  upstream: () => Promise<Upstream>;
  traffic?: TrafficLog;
}

const HOP_BY_HOP = ["connection", "keep-alive", "transfer-encoding", "host", "content-length"];

export function createFrontDoor({ upstream, traffic = new TrafficLog() }: FrontDoorDeps): Hono {
  const app = new Hono();

  app.get("/__front-door/status", async (c) => c.json(await upstream()));

  app.get("/__front-door/traffic", (c) =>
    streamSSE(c, async (stream) => {
      let last = Date.now() - 120_000;
      while (!stream.aborted) {
        const seconds = traffic.since(last);
        if (seconds.length > 0) {
          last = seconds.at(-1)?.t ?? last;
          const target = await upstream().catch(() => null);
          await stream.writeSSE({ event: "traffic", data: JSON.stringify({ seconds, target }) });
        }
        await stream.sleep(1000);
      }
    }),
  );

  app.all("*", async (c) => {
    const target = await upstream();
    const url = new URL(c.req.path + new URL(c.req.url).search, target.url);
    const headers = new Headers(c.req.raw.headers);
    for (const h of HOP_BY_HOP) headers.delete(h);
    try {
      const res = await fetch(url, {
        method: c.req.method,
        headers,
        body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.arrayBuffer(),
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      const servedBy = res.headers.get("x-served-by");
      traffic.record(
        servedBy === "aws" || servedBy === "on-prem" ? servedBy : target.env,
        res.status,
      );
      const out = new Headers(res.headers);
      for (const h of HOP_BY_HOP) out.delete(h);
      out.delete("content-encoding");
      return new Response(res.body, { status: res.status, headers: out });
    } catch {
      traffic.record(target.env, 502);
      return c.json({ error: "upstream_unreachable", env: target.env }, 502);
    }
  });

  return app;
}
