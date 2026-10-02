import type { LogEntry } from "./api.ts";
import { clock } from "./api.ts";

/**
 * The drawing's revision block, kept as the migration's log. Rev A is the system as
 * found; every cutover, rollback or decommission issues the next revision.
 */
export function revisionLetters(log: LogEntry[]): Map<LogEntry, string> {
  const letters = new Map<LogEntry, string>();
  let n = 0;
  for (const entry of log) {
    if (entry.milestone && entry.milestone !== "reset")
      letters.set(entry, String.fromCharCode(66 + n++));
  }
  return letters;
}

export function Revisions({ log }: { log: LogEntry[] }) {
  const letters = revisionLetters(log);
  const rows = [...log].reverse().slice(0, 60);
  return (
    <div className="revision-scroll">
      <table className="revisions">
        <thead>
          <tr>
            <th className="rev">Rev</th>
            <th>Time</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr
              key={`${entry.at}-${entry.message}`}
              data-milestone={entry.milestone}
              data-level={entry.level}
            >
              <td className="rev">
                {letters.has(entry) && <span className="delta">{letters.get(entry)}</span>}
              </td>
              <td className="time num">{clock(entry.at)}</td>
              <td className="desc">{entry.message}</td>
            </tr>
          ))}
          <tr>
            <td className="rev">
              <span className="delta">A</span>
            </td>
            <td className="time num">—</td>
            <td className="desc">Issued: the store as found, on-prem.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
