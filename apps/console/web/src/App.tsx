import { useEffect, useState } from "react";
import { useMigration, useTraffic } from "./api.ts";
import { Controls } from "./Controls.tsx";
import { MoonIcon, SunIcon } from "./icons.tsx";
import { Revisions, revisionLetters } from "./Revisions.tsx";
import { Schedule } from "./Schedule.tsx";
import { Schematic } from "./Schematic.tsx";
import { TrafficChart } from "./TrafficChart.tsx";

type Theme = "dark" | "light";

function storedTheme(): Theme {
  try {
    return localStorage.getItem("console-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function App() {
  const { state, connected } = useMigration();
  const { seconds, target } = useTraffic();
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("console-theme", theme);
    } catch {
      // per-viewer convenience only
    }
  }, [theme]);

  const last = seconds.at(-1);
  const rps = last
    ? Object.values(last["on-prem"])
        .concat(Object.values(last.aws))
        .reduce((a, b) => a + b, 0)
    : 0;
  const letters = state ? [...revisionLetters(state.log).values()] : [];
  const revision = letters.at(-1) ?? "A";
  const serving = target?.env ?? state?.serving;

  return (
    <div className="sheet">
      <header className="topbar">
        <h1>Store migration</h1>
        <span className="drawing-no num">rev {revision}</span>
        <span className="spacer" />
        {!connected && <span className="connection">Reconnecting to the control plane…</span>}
        {serving && (
          <span className="serving">
            <span className="label">Shoppers are served by</span>
            <span className="env-tag" data-env={serving}>
              {serving === "aws" ? "AWS" : "On-prem"}
            </span>
          </span>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={theme === "dark" ? "Switch to light sheet" : "Switch to dark sheet"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {state ? (
        <div className="layout">
          <div className="main-col">
            <section className="panel" aria-labelledby="drawing">
              <header>
                <h2 id="drawing">System drawing</h2>
                <span className="aside">live from the control plane and the front door</span>
              </header>
              <Schematic state={state} target={target} revision={revision} rps={rps} />
            </section>
            <section className="panel" aria-labelledby="traffic">
              <header>
                <h2 id="traffic">Traffic through the front door</h2>
                <span className="aside">synthetic shoppers · requests per second</span>
              </header>
              <TrafficChart seconds={seconds} />
            </section>
          </div>
          <div className="side-col">
            <section className="panel" aria-labelledby="schedule">
              <header>
                <h2 id="schedule">Phase schedule</h2>
              </header>
              <Schedule state={state} />
              <Controls state={state} />
            </section>
            <section className="panel" aria-labelledby="revisions">
              <header>
                <h2 id="revisions">Revision block</h2>
                <span className="aside">migration log</span>
              </header>
              <Revisions log={state.log} />
            </section>
          </div>
        </div>
      ) : (
        <p className="empty">Connecting to the control plane…</p>
      )}
    </div>
  );
}
