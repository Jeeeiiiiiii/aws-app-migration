/** AwsSide adapter: one CloudFormation stack (infra/stack.yaml). */
import { readFile } from "node:fs/promises";
import {
  type CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  type Stack,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
  waitUntilStackDeleteComplete,
  waitUntilStackUpdateComplete,
} from "@aws-sdk/client-cloudformation";
import type { AwsSide } from "../ports.ts";
import type { AwsSideInfo } from "../types.ts";

export interface CloudFormationAwsSideConfig {
  client: CloudFormationClient;
  stackName: string;
  templatePath: string;
  storeImage: string;
  dbPassword: string;
  /**
   * Host the runner uses to reach the load balancer. In real AWS this is the ALB's
   * DNS name; Floci serves ALB listeners on its own container, so it is "floci".
   */
  loadBalancerHost?: string;
  /** How long to wait for the store behind the load balancer to answer. */
  healthTimeoutMs?: number;
}

export class CloudFormationAwsSide implements AwsSide {
  private readonly config: CloudFormationAwsSideConfig;
  constructor(config: CloudFormationAwsSideConfig) {
    this.config = config;
  }

  async deploy(): Promise<AwsSideInfo> {
    const { client, stackName } = this.config;
    const input = {
      StackName: stackName,
      TemplateBody: await readFile(this.config.templatePath, "utf8"),
      Parameters: [
        { ParameterKey: "StoreImage", ParameterValue: this.config.storeImage },
        { ParameterKey: "DbPassword", ParameterValue: this.config.dbPassword },
      ],
    };
    const waiter = { client, maxWaitTime: 600, minDelay: 2, maxDelay: 5 };
    if (await this.stack()) {
      try {
        await client.send(new UpdateStackCommand(input));
        await waitUntilStackUpdateComplete(waiter, { StackName: stackName });
      } catch (err) {
        if (!/No updates are to be performed/i.test(String(err))) throw err;
      }
    } else {
      await client.send(new CreateStackCommand(input));
      await waitUntilStackCreateComplete(waiter, { StackName: stackName });
    }
    const info = await this.describe();
    if (!info) throw new Error(`Stack ${stackName} has no outputs after deploying.`);
    await waitForStore(info.storeUrl, this.config.healthTimeoutMs ?? 120_000);
    return info;
  }

  async describe(): Promise<AwsSideInfo | null> {
    const stack = await this.stack();
    if (
      !stack ||
      !/_COMPLETE$/.test(stack.StackStatus ?? "") ||
      /DELETE/.test(stack.StackStatus ?? "")
    ) {
      return null;
    }
    const out = (key: string) => {
      const value = stack.Outputs?.find((o) => o.OutputKey === key)?.OutputValue;
      if (!value) throw new Error(`Stack output ${key} is missing.`);
      return value;
    };
    const loadBalancerDns = out("LoadBalancerDns");
    return {
      db: {
        host: out("DbHost"),
        port: Number(out("DbPort")),
        database: "store",
        user: "store",
        password: this.config.dbPassword,
      },
      storeUrl: `http://${this.config.loadBalancerHost ?? loadBalancerDns}:${out("ListenerPort")}`,
      loadBalancerDns,
    };
  }

  async destroy(): Promise<void> {
    const { client, stackName } = this.config;
    if (!(await this.stack())) return;
    await client.send(new DeleteStackCommand({ StackName: stackName }));
    await waitUntilStackDeleteComplete(
      { client, maxWaitTime: 600, minDelay: 2, maxDelay: 5 },
      { StackName: stackName },
    );
  }

  private async stack(): Promise<Stack | null> {
    try {
      const res = await this.config.client.send(
        new DescribeStacksCommand({ StackName: this.config.stackName }),
      );
      const stack = res.Stacks?.[0] ?? null;
      return stack?.StackStatus === "DELETE_COMPLETE" ? null : stack;
    } catch (err) {
      if (/does not exist/i.test(String(err))) return null;
      throw err;
    }
  }
}

async function waitForStore(storeUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${storeUrl}/api/health`, { signal: AbortSignal.timeout(3_000) });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline)
      throw new Error(`The store behind ${storeUrl} did not answer in time.`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}
