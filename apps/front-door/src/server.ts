import { ListHostedZonesByNameCommand, Route53Client } from "@aws-sdk/client-route-53";
import { readRecord } from "@demo/migration/adapters";
import { serve } from "@hono/node-server";
import { createFrontDoor, type Upstream } from "./app.ts";

const zone = process.env.ROUTE53_ZONE ?? "demo.internal.";
const record = process.env.ROUTE53_RECORD ?? "store.demo.internal.";
const onPremHost = process.env.ON_PREM_HOST ?? "store-onprem";
const onPremPort = process.env.ON_PREM_PORT ?? "3000";
// In real AWS the record's value (the ALB's DNS name) resolves and serves on port 80.
// Floci's ALB names don't resolve on our network; its listeners live on the Floci container.
const lbHost = process.env.LOAD_BALANCER_HOST;
const lbPort = process.env.LOAD_BALANCER_PORT ?? "8080";
// Like a DNS resolver, keep each answer for the record's TTL (the runner sets 5s),
// so cutover reaches the front door a few seconds after the record changes.
const ttlMs = Number(process.env.RECORD_TTL_MS ?? 5000);

const route53 = new Route53Client({});
const onPrem: Upstream = {
  env: "on-prem",
  url: `http://${onPremHost}:${onPremPort}`,
  recordValue: onPremHost,
};
let cached: { upstream: Upstream; until: number } | null = null;
let zoneId: string | null = null;

async function upstream(): Promise<Upstream> {
  if (cached && Date.now() < cached.until) return cached.upstream;
  try {
    zoneId ??= await findZone();
    const value = (await readRecord(route53, zoneId, record)) ?? onPremHost;
    const next: Upstream =
      value === onPremHost
        ? onPrem
        : { env: "aws", url: `http://${lbHost ?? value}:${lbPort}`, recordValue: value };
    cached = { upstream: next, until: Date.now() + ttlMs };
    return next;
  } catch (err) {
    console.warn(`route53 unavailable (${err}); keeping last answer`);
    return cached?.upstream ?? onPrem;
  }
}

async function findZone(): Promise<string> {
  const res = await route53.send(new ListHostedZonesByNameCommand({ DNSName: zone }));
  const id = res.HostedZones?.find((z) => z.Name === zone)?.Id;
  if (!id) throw new Error(`hosted zone ${zone} not found`);
  return id;
}

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: createFrontDoor({ upstream }).fetch, port }, () =>
  console.log(`front door on :${port}`),
);
