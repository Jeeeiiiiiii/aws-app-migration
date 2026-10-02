/**
 * End to end: the whole migration on Floci, through the control plane and the front
 * door, with synthetic traffic running. Needs `docker compose up` first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const consoleUrl = process.env.CONSOLE_URL ?? "http://localhost:4000";
const frontDoor = process.env.FRONT_DOOR_URL ?? "http://localhost:8080";

type Phase = { status: string; error?: string };
type State = {
  phases: Record<string, Phase>;
  next: string | null;
  serving: string;
  strandedOrders: number;
  verification: { passed: boolean } | null;
};

async function call(
  path: string,
  body?: unknown,
): Promise<{ status: number; json: State & { count?: number } }> {
  const res = await fetch(`${consoleUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as State & { count?: number } };
}

const advance = async (opts = {}) => (await call("/api/advance", opts)).json;

async function whoami(): Promise<{ servingEnv: string; database: string }> {
  return (await (await fetch(`${frontDoor}/api/whoami`)).json()) as {
    servingEnv: string;
    database: string;
  };
}

/** The front door follows the record within its TTL. */
async function eventuallyServedBy(env: string) {
  const deadline = Date.now() + 20_000;
  for (;;) {
    if ((await whoami()).servingEnv === env) return;
    assert.ok(Date.now() < deadline, `front door never reached ${env}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

test("a full migration with a caught fault, a rollback and a reset", {
  timeout: 600_000,
}, async () => {
  let s = (await call("/api/reset", {})).json;
  assert.equal(s.next, "assess");
  await eventuallyServedBy("on-prem");

  await advance(); // assess
  s = await advance(); // prepare: real CloudFormation stack on Floci
  assert.equal(s.phases.prepare?.status, "done", s.phases.prepare?.error);

  s = await advance(); // freeze
  const frozen = await fetch(`${frontDoor}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId: 1 }),
  });
  assert.equal(frozen.status, 503, "on-prem rejects writes during the freeze");

  await advance({ faultInjection: true }); // copy, damaged
  s = await advance(); // verify
  assert.equal(s.phases.verify?.status, "failed");
  assert.equal(s.next, "copy", "a failed verify sends the migration back to copy");

  await advance(); // clean copy
  s = await advance(); // verify
  assert.equal(s.verification?.passed, true);

  s = await advance(); // cutover
  assert.equal(s.serving, "aws");
  await eventuallyServedBy("aws");
  assert.match((await whoami()).database, /RDS/);

  // Synthetic traffic places orders on AWS; rolling back must ask before discarding them.
  await new Promise((r) => setTimeout(r, 3000));
  const refused = await call("/api/rollback", {});
  assert.equal(refused.status, 409);
  assert.ok((refused.json.count ?? 0) > 0, "stranded orders are counted");
  s = (await call("/api/rollback", { discardStrandedOrders: true })).json;
  assert.equal(s.serving, "on-prem");
  await eventuallyServedBy("on-prem");

  for (const phase of ["freeze", "copy", "verify", "cutover", "decommission"]) {
    s = await advance();
    assert.equal(s.phases[phase]?.status, "done", `${phase}: ${s.phases[phase]?.error}`);
  }
  assert.equal(s.next, null);
  await eventuallyServedBy("aws");
  assert.equal(
    (await call("/api/rollback", {})).status,
    409,
    "no rollback past the point of no return",
  );

  s = (await call("/api/reset", {})).json;
  assert.equal(s.next, "assess");
  await eventuallyServedBy("on-prem");
});
