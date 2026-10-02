/**
 * Seams the runner reaches the outside world through. Each has a production
 * adapter (adapters/) and an in-memory one for tests.
 */
import type { AwsSideInfo, ServingEnv } from "./types.ts";

/** The AWS side's infrastructure (in production: one CloudFormation stack). */
export interface AwsSide {
  /** Create or update the AWS side and wait until its store answers. Idempotent. */
  deploy(): Promise<AwsSideInfo>;
  /** Current AWS side, or null when it doesn't exist. */
  describe(): Promise<AwsSideInfo | null>;
  /** Remove the AWS side entirely. Idempotent. */
  destroy(): Promise<void>;
}

export type RouteTarget = { env: "on-prem" } | { env: "aws"; loadBalancerDns: string };

/** The record the front door follows (in production: a Route53 CNAME). */
export interface Routing {
  serving(): Promise<ServingEnv>;
  pointAt(target: RouteTarget): Promise<void>;
}

/** The machines on-prem runs on (in production: Docker containers). */
export interface OnPremHost {
  /** Stop on-prem's store and database. */
  decommission(): Promise<void>;
  /** Bring on-prem's store and database back up and wait until the database answers. */
  restore(): Promise<void>;
}
