import { useEffect, useRef, useState } from "react";
import { type TrafficSecond, WINDOW_SECONDS } from "./api.ts";

/** Stack order, bottom to top. Colours validated with the dataviz palette checks. */
const SERIES = [
  { key: "onPrem", label: "Served on-prem", color: "var(--onprem)" },
  { key: "aws", label: "Served by AWS", color: "var(--aws)" },
  { key: "rejected", label: "Writes rejected (freeze)", color: "var(--rejected)" },
  { key: "failed", label: "Failed", color: "var(--failed)" },
] as const;
type Key = (typeof SERIES)[number]["key"];

function values(s: TrafficSecond): Record<Key, number> {
  return {
    onPrem: s["on-prem"].ok,
    aws: s.aws.ok,
    rejected: s["on-prem"].rejected + s.aws.rejected,
    failed: s["on-prem"].failed + s.aws.failed,
  };
}

const PAD = { top: 8, right: 8, bottom: 22, left: 34 };
const GAP = 2;

export function TrafficChart({ seconds }: { seconds: TrafficSecond[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [height, setHeight] = useState(180);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setWidth(entry.contentRect.width);
      setHeight(Math.max(180, entry.contentRect.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Always draw the full window, newest on the right, so time keeps its place.
  const now = seconds.at(-1)?.t ?? Math.floor(Date.now() / 1000) * 1000;
  const slots = Array.from({ length: WINDOW_SECONDS }, (_, i) => {
    const t = now - (WINDOW_SECONDS - 1 - i) * 1000;
    const s = seconds.find((x) => x.t === t);
    return { t, v: s ? values(s) : null };
  });

  const max = niceMax(
    Math.max(4, ...slots.map(({ v }) => (v ? v.onPrem + v.aws + v.rejected + v.failed : 0))),
  );
  const plotW = Math.max(100, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const slotW = plotW / WINDOW_SECONDS;
  const barW = Math.min(24, Math.max(1, slotW - GAP));
  const y = (n: number) => PAD.top + plotH - (n / max) * plotH;
  const ticks = [0, max / 2, max];
  const latest = [...slots].reverse().find((s) => s.v)?.v ?? null;

  const hovered = hover === null ? null : slots[hover];

  return (
    <div className="chart-wrap">
      <ul className="legend" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key}>
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
            <span className="num now">{latest ? `${latest[s.key]}/s` : "–"}</span>
          </li>
        ))}
      </ul>
      <div ref={ref} className="chart" onPointerLeave={() => setHover(null)}>
        <svg
          height={height}
          role="img"
          aria-label="Requests per second through the front door, last two minutes, by outcome"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="axis-text" x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {[120, 90, 60, 30].map((ago) => (
            <text
              key={ago}
              className="axis-text"
              x={PAD.left + plotW - (ago / WINDOW_SECONDS) * plotW}
              y={height - 6}
              textAnchor="middle"
            >
              −{ago}s
            </text>
          ))}
          <text className="axis-text" x={PAD.left + plotW} y={height - 6} textAnchor="end">
            now
          </text>

          {hovered && hover !== null && (
            <rect
              className="hover-band"
              x={PAD.left + hover * slotW}
              y={PAD.top}
              width={slotW}
              height={plotH}
            />
          )}

          {slots.map(({ t, v }, i) => {
            if (!v) return null;
            const x = PAD.left + i * slotW + (slotW - barW) / 2;
            let base = 0;
            const parts = SERIES.filter((s) => v[s.key] > 0);
            return (
              <g key={t}>
                {parts.map((s, j) => {
                  const top = base + v[s.key];
                  const y0 = y(base);
                  const y1 = y(top);
                  base = top;
                  // 2px surface gap between stacked segments; only the top segment gets the rounded end.
                  const h = Math.max(0, y0 - y1 - (j > 0 ? GAP : 0));
                  const isTop = j === parts.length - 1;
                  return (
                    <Segment
                      key={s.key}
                      x={x}
                      y={y1}
                      w={barW}
                      h={h}
                      color={s.color}
                      round={isTop}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Hit targets: whole column height, wider than the mark */}
          {slots.map(({ t }, i) => (
            <rect
              key={`hit-${t}`}
              x={PAD.left + i * slotW}
              y={PAD.top}
              width={slotW}
              height={plotH}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {hovered?.v && hover !== null && (
          <div
            className="tooltip"
            style={{
              left: Math.min(Math.max(PAD.left + (hover + 0.5) * slotW, 90), width - 90) + 14,
              top: 40,
            }}
          >
            <div className="num" style={{ color: "var(--ink-3)", marginBottom: 4 }}>
              {new Date(hovered.t).toLocaleTimeString([], { hour12: false })}
            </div>
            {SERIES.map((s) => (
              <div className="row" key={s.key}>
                <span
                  className="swatch"
                  style={{ width: 8, height: 8, borderRadius: 2, background: s.color }}
                />
                {s.label}
                <span className="num value">{hovered.v?.[s.key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>Show the last 10 seconds as a table</summary>
        <table>
          <thead>
            <tr>
              <th>Second</th>
              {SERIES.map((s) => (
                <th key={s.key}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots
              .filter((s) => s.v)
              .slice(-10)
              .reverse()
              .map(({ t, v }) => (
                <tr key={t}>
                  <td className="num">{new Date(t).toLocaleTimeString([], { hour12: false })}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="num">
                      {v?.[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** A column segment: square at the bottom, 4px rounded data-end on top when it is the top of the stack. */
function Segment({
  x,
  y,
  w,
  h,
  color,
  round,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
}) {
  if (h <= 0) return null;
  const r = round ? Math.min(4, w / 2, h) : 0;
  const d = `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
  return <path d={d} fill={color} />;
}

function niceMax(n: number): number {
  const step = Math.max(1, 10 ** Math.floor(Math.log10(n)));
  // Even multiples only, so the midline tick is a whole number of requests.
  for (const m of [1, 2, 4, 6, 8, 10]) {
    if (m * step >= n) return m * step;
  }
  return 10 * step;
}
