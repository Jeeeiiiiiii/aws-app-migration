import { useEffect, useRef } from "react";
import type { FrontDoorTarget, MigrationState } from "./api.ts";

/**
 * The system drawn as a technical drawing, read live: where the front door is
 * sending traffic, what exists, what is frozen, what is being copied. At cutover the
 * route redraws and a revision cloud rings the changed part of the drawing.
 */
export function Schematic({
  state,
  target,
  revision,
  rps,
}: {
  state: MigrationState;
  target: FrontDoorTarget | null;
  revision: string;
  rps: number;
}) {
  const p = state.phases;
  const awsBuilt = !!state.awsSide && p.prepare.status === "done";
  const decommissioned = p.decommission.status === "done";
  const frozen = p.freeze.status === "done" && p.cutover.status !== "done";
  const copying = p.copy.status === "running";
  const flowingTo = target?.env ?? state.serving;
  const cutOver = p.cutover.status === "done" && state.serving === "aws";
  const justCutOver = cutOver && Date.now() - Date.parse(p.cutover.finishedAt ?? "") < 15_000;
  const recordValue =
    target?.recordValue ??
    (state.serving === "aws" ? state.awsSide?.loadBalancerDns : "store-onprem");

  // On a narrow screen, keep the part of the drawing that matters in view: the
  // front door and whichever route it is using.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = flowingTo === "aws" ? 100 : 60;
  }, [flowingTo]);

  const onPremState = decommissioned ? "void" : frozen ? "frozen" : "live";
  const awsState = awsBuilt ? "live" : "phantom";

  return (
    <div className="schematic-scroll" ref={scroller}>
      <svg
        className="schematic"
        viewBox="0 0 820 352"
        role="img"
        aria-label={`System drawing: traffic goes to ${flowingTo}. ${awsBuilt ? "The AWS side exists." : "The AWS side is not built."} ${decommissioned ? "On-prem is decommissioned." : frozen ? "On-prem is frozen." : ""}`}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0 8 4 0 8" fill="none" stroke="var(--line)" strokeWidth="1.2" />
          </marker>
        </defs>

        {/* Record the front door follows */}
        <g className="node">
          <rect x="150" y="16" width="196" height="66" />
          <text x="162" y="37" className="t-label">
            Route53 record
          </text>
          <text x="162" y="56" className="t-mono">
            store.demo.internal
          </text>
          <text x="162" y="72" className="t-mono">
            → {abbreviate(recordValue ?? "")}
          </text>
        </g>
        <path className="wire" d="M224 82 V128" strokeDasharray="2 3" />

        {/* Shoppers and front door */}
        <g className="node">
          <rect x="16" y="133" width="100" height="50" />
          <text x="28" y="155" className="t-label">
            Shoppers
          </text>
          <text x="28" y="172" className="t-sub">
            synthetic traffic
          </text>
        </g>
        <path
          className="route"
          data-active="true"
          style={{ "--route-color": "var(--line)" } as React.CSSProperties}
          d="M116 158 H160"
        />
        {rps > 0 && <path className="flow" d="M116 158 H160" />}

        <g className="node">
          <rect x="160" y="128" width="128" height="60" />
          <text x="172" y="152" className="t-label">
            Front door
          </text>
          <text x="172" y="170" className="t-mono">
            localhost:8080
          </text>
        </g>

        {/* Routes out of the front door */}
        <Route
          d="M288 150 H322 V82 H380"
          active={flowingTo === "on-prem"}
          superseded={cutOver && flowingTo === "aws"}
          color="var(--onprem)"
          flowing={rps > 0}
        />
        <Route
          d="M288 166 H312 V244 H350"
          active={flowingTo === "aws"}
          color="var(--aws)"
          flowing={rps > 0}
        />

        {/* On-prem */}
        <rect className="zone" x="352" y="16" width="452" height="128" />
        <text x="366" y="34" className="t-zone">
          {decommissioned ? "ON-PREM · DECOMMISSIONED" : "ON-PREM · DOCKER"}
        </text>
        <Node
          x={380}
          y={50}
          w={150}
          title="Store"
          sub={frozen ? "frozen · writes rejected" : "container"}
          state={onPremState}
          signal={frozen}
        />
        <path className="wire" d="M530 80 H620" />
        <Node
          x={620}
          y={50}
          w={164}
          title="Postgres"
          sub={frozen ? "read-only for the copy" : "on-prem database"}
          state={onPremState}
          signal={frozen}
        />

        {/* Copy: drawn as a dimension line from source to target */}
        {awsBuilt && !decommissioned && (p.copy.status !== "pending" || copying) && (
          <g>
            <path
              className="dimension"
              data-active={copying}
              d="M738 110 V214"
              markerEnd="url(#arrow)"
              markerStart={copying ? undefined : "url(#arrow)"}
            />
            <text x="728" y="126" textAnchor="end" className="t-mono">
              pg_dump → pg_restore
            </text>
            <text
              x="728"
              y="139"
              textAnchor="end"
              className={p.copy.status === "failed" ? "t-mono t-signal" : "t-mono"}
            >
              {copying ? "copying…" : p.verify.status === "failed" ? "copy damaged" : "copied"}
            </text>
          </g>
        )}

        {/* AWS side */}
        <rect className="zone" x="330" y="180" width="474" height="142" />
        <text x="504" y="198" className="t-zone">
          {awsBuilt ? "AWS SIDE · US-EAST-1 · FLOCI" : "AWS SIDE · NOT BUILT"}
        </text>
        <Node x={350} y={214} w={124} title="Load balancer" sub="ALB :8080" state={awsState} />
        <path className="wire" d="M474 244 H500" opacity={awsBuilt ? 0.7 : 0.3} />
        <Node x={500} y={214} w={130} title="Store" sub="ECS Fargate" state={awsState} />
        <path className="wire" d="M630 244 H650" opacity={awsBuilt ? 0.7 : 0.3} />
        <Node x={650} y={214} w={134} title="Postgres" sub="RDS" state={awsState} />
        {awsBuilt && (
          <text x="792" y="316" textAnchor="end" className="t-sub">
            ECS runs the locally built image; in real AWS it would be pulled from ECR.
          </text>
        )}

        {/* Revision: the cutover changed this part of the drawing */}
        {cutOver && (
          <g key={p.cutover.finishedAt}>
            <path
              className="rev-cloud"
              data-drawing={justCutOver}
              pathLength={1}
              d={cloud(298, 190, 186, 104, 10)}
            />
            <g className="rev-delta" data-drawing={justCutOver} transform="translate(484 190)">
              <polygon points="0,-12 12,9 -12,9" />
              <text x="0" y="6" textAnchor="middle">
                {revision}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

function Route({
  d,
  active,
  color,
  flowing,
  superseded = false,
}: {
  d: string;
  active: boolean;
  color: string;
  flowing: boolean;
  superseded?: boolean;
}) {
  return (
    <g>
      <path
        className="route"
        data-active={active}
        data-superseded={superseded}
        style={{ "--route-color": color } as React.CSSProperties}
        d={d}
      />
      {active && flowing && <path className="flow" d={d} />}
    </g>
  );
}

function Node({
  x,
  y,
  w,
  title,
  sub,
  state,
  signal = false,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  sub: string;
  state: "live" | "phantom" | "void" | "frozen";
  signal?: boolean;
}) {
  return (
    <g className="node" data-state={state}>
      <rect x={x} y={y} width={w} height={60} />
      <text x={x + 12} y={y + 24} className="t-label">
        {title}
      </text>
      <text x={x + 12} y={y + 42} className={signal ? "t-sub t-signal" : "t-sub"}>
        {sub}
      </text>
      {state === "void" && (
        <path
          className="strike"
          d={`M${x} ${y} L${x + w} ${y + 60} M${x + w} ${y} L${x} ${y + 60}`}
        />
      )}
    </g>
  );
}

/** A revision cloud: scallops around a rectangle, bulging outward. */
function cloud(x: number, y: number, w: number, h: number, r: number): string {
  const along = (len: number) => Math.max(1, Math.round(len / (r * 2)));
  const parts: string[] = [`M${x} ${y}`];
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const n = along(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 1; i <= n; i++) {
      const px = x0 + ((x1 - x0) * i) / n;
      const py = y0 + ((y1 - y0) * i) / n;
      const radius = Math.hypot(x1 - x0, y1 - y0) / n / 2;
      parts.push(
        `A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${px.toFixed(2)} ${py.toFixed(2)}`,
      );
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
  return parts.join(" ");
}

function abbreviate(value: string): string {
  return value.length > 26 ? `${value.slice(0, 12)}…${value.slice(-11)}` : value;
}
