import { useState } from "react";
import { type CallResult, call, type MigrationState } from "./api.ts";
import { HoldButton } from "./HoldButton.tsx";

const ACTION: Record<string, string> = {
  assess: "Run Assess",
  prepare: "Run Prepare",
  freeze: "Freeze on-prem",
  copy: "Copy data",
  verify: "Verify",
  cutover: "Cut over to AWS",
  decommission: "Hold to decommission on-prem",
};

export function Controls({ state }: { state: MigrationState }) {
  const [fault, setFault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [pending, setPending] = useState(false);

  const run = async (path: string, body: unknown = {}) => {
    setPending(true);
    setError(null);
    const res: CallResult = await call(path, body);
    setPending(false);
    if (res.status === 409 && res.body.error === "stranded_orders") {
      setConfirmRollback(true);
      return;
    }
    if (!res.ok) setError(res.body.message ?? `Request failed (${res.status}).`);
    if (path === "/api/advance") setFault(false);
    if (res.ok) setConfirmRollback(false);
  };

  const busy = state.busy || pending;
  const running = Object.entries(state.phases).find(([, p]) => p.status === "running")?.[0];
  const next = state.next;

  return (
    <div className="controls">
      {next === "decommission" ? (
        <HoldButton className="btn primary" disabled={busy} onConfirm={() => run("/api/advance")}>
          {ACTION.decommission}
        </HoldButton>
      ) : (
        <button
          type="button"
          className="btn primary"
          disabled={busy || !next}
          onClick={() => run("/api/advance", { faultInjection: next === "copy" && fault })}
        >
          {running ? `Running ${running}…` : next ? ACTION[next] : "Migration complete"}
        </button>
      )}

      <label className="toggle">
        <input
          type="checkbox"
          checked={fault}
          disabled={next !== "copy" || busy}
          onChange={(e) => setFault(e.target.checked)}
        />
        Fault injection: lose orders in transit during the next Copy
      </label>

      {confirmRollback && state.strandedOrders > 0 ? (
        <div className="confirm" role="alert">
          <span>
            Rolling back now discards <strong className="num">{state.strandedOrders}</strong>{" "}
            stranded order
            {state.strandedOrders === 1 ? "" : "s"} placed on AWS since cutover. Shoppers keep
            ordering, so this number grows until you confirm.
          </span>
          <div className="btn-row">
            <HoldButton
              disabled={busy}
              onConfirm={() => run("/api/rollback", { discardStrandedOrders: true })}
            >
              Hold to discard and roll back
            </HoldButton>
            <button type="button" className="btn" onClick={() => setConfirmRollback(false)}>
              Keep serving from AWS
            </button>
          </div>
        </div>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={busy || !state.canRollback}
            onClick={() => run("/api/rollback")}
          >
            Roll back to on-prem
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => run("/api/reset")}>
            Reset demo
          </button>
        </div>
      )}

      {error && (
        <p className="error-line" role="alert">
          {error}
        </p>
      )}
      {!state.canRollback && state.phases.decommission.status === "done" && (
        <p className="hint">
          On-prem is decommissioned: rollback is no longer possible. Reset replays the demo.
        </p>
      )}
    </div>
  );
}
