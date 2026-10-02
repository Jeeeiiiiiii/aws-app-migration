import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createFrontDoor, type Upstream } from "./app.ts";
import { TrafficLog } from "./traffic.ts";

const servers: ReturnType<typeof serve>[] = [];
async function fakeStore(env: "on-prem" | "aws", frozen = false): Promise<string> {
  const app = new Hono();
  app.get("/api/products", (c) => {
    c.header("x-served-by", env);
    return c.json([{ id: 1 }]);
  });
  app.post("/api/orders", (c) => {
    c.header("x-served-by", env);
    return frozen ? c.json({ error: "frozen" }, 503) : c.json({ id: 1 }, 201);
  });
  const server = serve({ fetch: app.fetch, port: 0 });
  servers.push(server);
  await new Promise((r) => server.once("listening", r));
  return `http://localhost:${(server.address() as AddressInfo).port}`;
}

let onPremUrl: string;
let awsUrl: string;
before(async () => {
  onPremUrl = await fakeStore("on-prem", true);
  awsUrl = await fakeStore("aws");
});
after(() => {
  for (const s of servers) s.close();
});

test("sends traffic wherever the record points and tallies it per environment", async () => {
  let target: Upstream = { env: "on-prem", url: onPremUrl, recordValue: "store-onprem" };
  const traffic = new TrafficLog();
  const door = createFrontDoor({ upstream: async () => target, traffic });

  const before = Date.now();
  const r1 = await door.request("/api/products");
  assert.equal(r1.headers.get("x-served-by"), "on-prem");
  assert.equal((await door.request("/api/orders", { method: "POST", body: "{}" })).status, 503);

  target = { env: "aws", url: awsUrl, recordValue: "store-alb.elb" };
  const r2 = await door.request("/api/orders", { method: "POST", body: "{}" });
  assert.equal(r2.status, 201);
  assert.equal(r2.headers.get("x-served-by"), "aws");

  const seconds = traffic.since(before - 1000, Date.now() + 1000);
  const total = (env: "on-prem" | "aws", k: "ok" | "rejected" | "failed") =>
    seconds.reduce((n, s) => n + s[env][k], 0);
  assert.equal(total("on-prem", "ok"), 1);
  assert.equal(total("on-prem", "rejected"), 1);
  assert.equal(total("aws", "ok"), 1);
});

test("an unreachable upstream is a failed request, not a crash", async () => {
  const traffic = new TrafficLog();
  const door = createFrontDoor({
    upstream: async () => ({ env: "aws", url: "http://127.0.0.1:9", recordValue: "x" }),
    traffic,
  });
  const before = Date.now();
  assert.equal((await door.request("/api/products")).status, 502);
  const seconds = traffic.since(before - 1000, Date.now() + 1000);
  assert.equal(
    seconds.reduce((n, s) => n + s.aws.failed, 0),
    1,
  );
});

test("traffic log fills quiet seconds so the chart keeps time", () => {
  const log = new TrafficLog();
  log.record("on-prem", 200, 10_000);
  log.record("aws", 200, 13_500);
  const seconds = log.since(9_000, 15_000);
  assert.deepEqual(
    seconds.map((s) => s.t),
    [10_000, 11_000, 12_000, 13_000, 14_000],
  );
  assert.equal(seconds[3]?.aws.ok, 1);
});
