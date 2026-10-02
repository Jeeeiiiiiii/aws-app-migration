import type { MigrationState, PhaseName } from "./api.ts";
import { clock } from "./api.ts";
import { DoneIcon, FailedIcon, PendingIcon, RunningIcon } from "./icons.tsx";

const TITLES: Record<PhaseName, string> = {
  assess: "Assess",
  prepare: "Prepare",
  freeze: "Freeze",
  copy: "Copy",
  verify: "Verify",
  cutover: "Cutover",
  decommission: "Decommission",
};

/** What each phase will do, shown while it is still ahead. */
const PLAN: Record<PhaseName, string> = {
  assess: "Take inventory of on-prem: tables, row counts, checksums.",
  prepare: "Deploy the AWS side with CloudFormation: RDS, ECS service, load balancer.",
  freeze: "On-prem stops accepting writes so its data can't change while it moves.",
  copy: "pg_dump on-prem, pg_restore into RDS.",
  verify: "Compare every table's rows and checksum, then place a smoke order on AWS.",
  cutover: "Point the Route53 record at the load balancer and open AWS for writes.",
  decommission: "Keep a final backup, then switch on-prem off. Point of no return.",
};

export function Schedule({ state }: { state: MigrationState }) {
  return (
    <ol className="schedule">
      {(Object.keys(TITLES) as PhaseName[]).map((name) => {
        const p = state.phases[name];
        const isNext = state.next === name && p.status !== "running";
        return (
          <li key={name} className="phase" data-status={p.status} data-next={isNext}>
            <span className="glyph">{GLYPH[p.status]}</span>
            <span className="name">
              {TITLES[name]}
              <span className="visually-hidden">: {p.status}</span>
              <span className="when">{clock(p.finishedAt ?? p.startedAt)}</span>
            </span>
            <span className="detail">
              {p.status === "failed" ? p.error : p.status === "done" ? p.summary : PLAN[name]}
              {name === "assess" && p.status === "done" && state.assessment && (
                <Fingerprints
                  rows={state.assessment.map((t) => ({ table: t.table, onPrem: `${t.rows} rows` }))}
                />
              )}
              {name === "verify" && state.verification && <VerifyTable state={state} />}
              {name === "prepare" && p.status !== "pending" && (
                <span className="note">
                  {" "}
                  In real AWS this step also pushes the store image to ECR; Floci can't, so ECS runs
                  the local image.
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const GLYPH = {
  pending: <PendingIcon />,
  running: <RunningIcon />,
  done: <DoneIcon />,
  failed: <FailedIcon />,
};

function Fingerprints({ rows }: { rows: { table: string; onPrem: string }[] }) {
  return (
    <table className="fingerprints">
      <tbody>
        {rows.map((r) => (
          <tr key={r.table}>
            <td>{r.table}</td>
            <td className="num">{r.onPrem}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VerifyTable({ state }: { state: MigrationState }) {
  const v = state.verification;
  if (!v) return null;
  return (
    <table className="fingerprints">
      <thead>
        <tr>
          <th>Table</th>
          <th>On-prem</th>
          <th>AWS</th>
          <th>Checksum</th>
        </tr>
      </thead>
      <tbody>
        {v.tables.map((t) => (
          <tr key={t.table} className={t.match ? undefined : "mismatch"}>
            <td>{t.table}</td>
            <td className="num">{t.onPrem.rows}</td>
            <td className="num">{t.aws?.rows ?? "–"}</td>
            <td className="num">
              {t.onPrem.checksum.slice(0, 6)} {t.match ? "=" : "≠"}{" "}
              {t.aws?.checksum.slice(0, 6) ?? "–"}
            </td>
          </tr>
        ))}
        {v.smokeOrder && (
          <tr className={v.smokeOrder.ok ? undefined : "mismatch"}>
            <td colSpan={3}>Smoke order through the AWS side</td>
            <td className="num">{v.smokeOrder.ok ? `#${v.smokeOrder.orderId} ok` : "failed"}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
