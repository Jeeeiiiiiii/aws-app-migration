/** OnPremHost adapter: on-prem's containers, driven through the Docker Engine API. */
import { request } from "node:http";
import type { OnPremHost } from "../ports.ts";

export interface DockerOnPremHostConfig {
  /** Container names, database first: it starts first and stops last. */
  containers: string[];
  socketPath?: string;
  /** Resolves once on-prem's database answers again after a restore. */
  waitUntilReady: () => Promise<void>;
}

export class DockerOnPremHost implements OnPremHost {
  private readonly config: DockerOnPremHostConfig;
  constructor(config: DockerOnPremHostConfig) {
    this.config = config;
  }

  async decommission(): Promise<void> {
    for (const name of [...this.config.containers].reverse()) {
      await this.call("POST", `/containers/${encodeURIComponent(name)}/stop?t=5`);
    }
  }

  async restore(): Promise<void> {
    for (const name of this.config.containers) {
      await this.call("POST", `/containers/${encodeURIComponent(name)}/start`);
    }
    await this.config.waitUntilReady();
  }

  private call(method: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = request(
        { socketPath: this.config.socketPath ?? "/var/run/docker.sock", method, path },
        (res) => {
          res.resume();
          // 304: already in the requested state.
          if (res.statusCode && (res.statusCode < 300 || res.statusCode === 304)) resolve();
          else reject(new Error(`Docker ${method} ${path} returned ${res.statusCode}`));
        },
      );
      req.on("error", reject);
      req.end();
    });
  }
}
