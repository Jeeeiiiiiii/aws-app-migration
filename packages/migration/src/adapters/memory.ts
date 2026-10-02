/** In-memory adapters for tests and for running the runner without an emulator. */
import type { AwsSide, OnPremHost, RouteTarget, Routing } from "../ports.ts";
import type { AwsSideInfo, ServingEnv } from "../types.ts";

export class MemoryAwsSide implements AwsSide {
  deployed = false;
  private readonly info: AwsSideInfo;
  constructor(info: AwsSideInfo) {
    this.info = info;
  }
  async deploy() {
    this.deployed = true;
    return this.info;
  }
  async describe() {
    return this.deployed ? this.info : null;
  }
  async destroy() {
    this.deployed = false;
  }
}

export class MemoryRouting implements Routing {
  target: RouteTarget = { env: "on-prem" };
  async serving(): Promise<ServingEnv> {
    return this.target.env;
  }
  async pointAt(target: RouteTarget) {
    this.target = target;
  }
}

export class MemoryOnPremHost implements OnPremHost {
  running = true;
  async decommission() {
    this.running = false;
  }
  async restore() {
    this.running = true;
  }
}
