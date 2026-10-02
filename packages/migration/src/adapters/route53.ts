/** Routing adapter: the Route53 CNAME the front door follows. */
import {
  ChangeResourceRecordSetsCommand,
  CreateHostedZoneCommand,
  ListHostedZonesByNameCommand,
  ListResourceRecordSetsCommand,
  type Route53Client,
} from "@aws-sdk/client-route-53";
import type { RouteTarget, Routing } from "../ports.ts";
import type { ServingEnv } from "../types.ts";

export interface Route53RoutingConfig {
  client: Route53Client;
  /** Hosted zone, e.g. "demo.internal." */
  zone: string;
  /** Record the front door follows, e.g. "store.demo.internal." */
  record: string;
  /** Hostname on-prem's store answers on; the record's value before cutover. */
  onPremHost: string;
}

export class Route53Routing implements Routing {
  private readonly config: Route53RoutingConfig;
  private zoneId: string | null = null;
  constructor(config: Route53RoutingConfig) {
    this.config = config;
  }

  async serving(): Promise<ServingEnv> {
    const value = await readRecord(this.config.client, await this.zone(), this.config.record);
    return value === null || value === this.config.onPremHost ? "on-prem" : "aws";
  }

  async pointAt(target: RouteTarget): Promise<void> {
    const value = target.env === "on-prem" ? this.config.onPremHost : target.loadBalancerDns;
    await this.config.client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: await this.zone(),
        ChangeBatch: {
          Changes: [
            {
              Action: "UPSERT",
              ResourceRecordSet: {
                Name: this.config.record,
                Type: "CNAME",
                TTL: 5,
                ResourceRecords: [{ Value: value }],
              },
            },
          ],
        },
      }),
    );
  }

  /** The zone and record exist before any migration, as they would for a real domain. */
  async ensureRecord(): Promise<void> {
    const zoneId = await this.zone();
    if ((await readRecord(this.config.client, zoneId, this.config.record)) === null) {
      await this.pointAt({ env: "on-prem" });
    }
  }

  private async zone(): Promise<string> {
    if (this.zoneId) return this.zoneId;
    const { client, zone } = this.config;
    const found = await client.send(new ListHostedZonesByNameCommand({ DNSName: zone }));
    const existing = found.HostedZones?.find((z) => z.Name === zone);
    const id =
      existing?.Id ??
      (
        await client.send(
          new CreateHostedZoneCommand({ Name: zone, CallerReference: `store-${Date.now()}` }),
        )
      ).HostedZone?.Id;
    if (!id) throw new Error(`Could not find or create hosted zone ${zone}.`);
    this.zoneId = id;
    return id;
  }
}

/** Current value of a CNAME record, or null when it doesn't exist. */
export async function readRecord(
  client: Route53Client,
  zoneId: string,
  record: string,
): Promise<string | null> {
  const res = await client.send(
    new ListResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      StartRecordName: record,
      StartRecordType: "CNAME",
      MaxItems: 1,
    }),
  );
  const set = res.ResourceRecordSets?.find((r) => r.Name === record && r.Type === "CNAME");
  return set?.ResourceRecords?.[0]?.Value ?? null;
}
