import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { CompanyPage } from "./company.tsx";
import { Home } from "./home.tsx";
import { Icon } from "./icons.tsx";
import { countBy, parseRoute, STAGES, stageOf, type Company, type Patch, type RouteFilter, type Stage, type Tracker } from "./model.ts";

type Theme = "light" | "dark";
type Remote = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: Tracker; stale: boolean };

const URL = "/api/tracker";

const subscribe = (target: EventTarget, event: string) => (cb: () => void) => {
  target.addEventListener(event, cb);
  return () => target.removeEventListener(event, cb);
};
const onVisibility = subscribe(document, "visibilitychange");
const isVisible = () => document.visibilityState === "visible";
const onHash = subscribe(window, "hashchange");
const readHash = () => location.hash;
const lightScheme = matchMedia("(prefers-color-scheme: light)");
const onScheme = subscribe(lightScheme, "change");
const osTheme = (): Theme => (lightScheme.matches ? "light" : "dark");
const storedTheme = (): Theme | null => {
  const t = localStorage.getItem("theme");
  return t === "light" || t === "dark" ? t : null;
};
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Refetches whenever the tab becomes visible (so a research merge shows on return) and saves edits
// optimistically; a failed save reloads the stored state and says so. No localStorage copy: one saved under an
// older schema crashed the first render before the refetch could replace it, and the local server answers in ms.
function useTracker(visible: boolean) {
  const [remote, setRemote] = useState<Remote>({ kind: "loading" });
  const [unsaved, setUnsaved] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    fetch(URL)
      .then((res) => (res.ok ? (res.json() as Promise<Tracker>) : Promise.reject(new Error(String(res.status)))))
      .then(
        (data) => {
          if (alive) setRemote({ kind: "ready", data, stale: false });
        },
        () => alive && setRemote((r) => (r.kind === "ready" ? { ...r, stale: true } : { kind: "error" })),
      );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => (visible ? load() : undefined), [visible, load]);

  const save = useCallback(
    (id: string, patch: Patch) => {
      setRemote((r) => {
        if (r.kind !== "ready") return r;
        return { ...r, data: { ...r.data, companies: r.data.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) } };
      });
      fetch(`/api/companies/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) })
        .then((res) => {
          setUnsaved(!res.ok);
          if (!res.ok) load();
        })
        .catch(() => {
          setUnsaved(true);
          load();
        });
    },
    [load],
  );

  return { remote, save, unsaved };
}

function App() {
  const visible = useSyncExternalStore(onVisibility, isVisible);
  const os = useSyncExternalStore(onScheme, osTheme);
  const hash = useSyncExternalStore(onHash, readHash);
  const route = parseRoute(hash);
  const [chosen, setChosen] = useState(storedTheme);
  const theme = chosen ?? os;
  const { remote, save, unsaved } = useTracker(visible);
  const [stage, setStage] = useState<Stage | null>(null);
  const [routeFilter, setRouteFilter] = useState<RouteFilter>("all");

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    setChosen(next);
  };

  // A new route starts at the top with focus on its heading; the first load keeps the browser's focus.
  const routed = useRef(false);
  useLayoutEffect(() => {
    if (!routed.current) {
      routed.current = true;
      return;
    }
    scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>("[data-heading]")?.focus({ preventScroll: true });
  }, [hash]);

  const data = remote.kind === "ready" ? remote.data : null;
  const company = route.view === "company" ? (data?.companies.find((c) => c.id === route.id) ?? null) : null;
  // The legend filters the company list further down, so bring the list into view.
  const chooseStage = (s: Stage) => {
    setStage((cur) => (cur === s ? null : s));
    if (route.view === "company") location.hash = "#/";
    requestAnimationFrame(() =>
      document.getElementById("companies")?.scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" }),
    );
  };

  return (
    <div className="page" data-stale={(remote.kind === "ready" && remote.stale) || undefined}>
      <aside className="rail">
        <Summary data={data} failed={remote.kind === "error"} stale={remote.kind === "ready" && remote.stale} unsaved={unsaved} theme={theme} onTheme={toggleTheme} />
        {data && <Stages companies={data.companies} selected={company ? stageOf(company) : stage} onSelect={chooseStage} />}
      </aside>
      <main className="view" key={route.view === "home" ? "home" : route.id}>
        {route.view === "home" && (
          <Home
            data={data}
            failed={remote.kind === "error"}
            stage={stage}
            onStage={setStage}
            routeFilter={routeFilter}
            onRouteFilter={setRouteFilter}
            save={save}
          />
        )}
        {route.view === "company" && <CompanyPage company={company} data={data} failed={remote.kind === "error"} save={save} />}
      </main>
    </div>
  );
}

function Summary(props: { data: Tracker | null; failed: boolean; stale: boolean; unsaved: boolean; theme: Theme; onTheme: () => void }) {
  const { data, theme } = props;
  return (
    <section className="summary" aria-label="Pipeline">
      <header>
        <a className="label" href="#/">
          {data?.title ?? "apply-jobs"}
        </a>
        <button type="button" className="theme" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={props.onTheme}>
          <span data-on={theme === "light" || undefined}>
            <Icon name="sun" />
          </span>
          <span data-on={theme === "dark" || undefined}>
            <Icon name="moon" />
          </span>
        </button>
      </header>
      <p className={`total${data ? "" : " placeholder"}`}>
        {data ? data.companies.length : "—"} <span className="unit">companies</span>
      </p>
      {(props.stale || props.unsaved) && (
        <p className="stale-note muted" role="status">
          <Icon name="warning-circle" size={14} />
          {props.unsaved ? "Last change was not saved" : "Showing the last copy, the tracker did not answer"}
        </p>
      )}
      {props.failed && <p className="muted">Could not read the tracker.</p>}
    </section>
  );
}

// One hue per stage, so the ring fills with color as companies move from your court to theirs.
function Stages({ companies, selected, onSelect }: { companies: Company[]; selected: Stage | null; onSelect: (s: Stage) => void }) {
  const [lit, setLit] = useState<Stage | null>(null);
  const counts = countBy(companies, stageOf);
  const total = companies.length;
  const present = STAGES.filter(([s]) => counts.has(s));
  const R = 80;
  const C = 2 * Math.PI * R;
  const gap = present.length > 1 ? (C * 2) / 360 : 0;
  let offset = 0;
  const arcs = present.map(([s]) => {
    const len = (C * counts.get(s)!) / total;
    const arc = { s, dash: `${Math.max(len - gap, 0.01)} ${C}`, offset: -offset };
    offset += len;
    return arc;
  });
  const focus = lit ?? selected;
  const hover = (s: Stage) => ({
    onMouseEnter: () => setLit(s),
    onMouseLeave: () => setLit(null),
    onFocus: () => setLit(s),
    onBlur: () => setLit(null),
  });
  return (
    <section className="alloc" aria-label="Companies by stage">
      <div className="donut" role="img" aria-label={present.map(([s, name]) => `${name} ${counts.get(s)}`).join(", ")}>
        <svg className="pie" viewBox="0 0 184 184">
          <g transform="rotate(-90 92 92)">
            {arcs.map((a) => (
              <circle
                key={a.s}
                className="pie-sector"
                data-stage={a.s}
                data-dimmed={(focus !== null && focus !== a.s) || undefined}
                cx="92"
                cy="92"
                r={R}
                fill="none"
                strokeWidth="24"
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
              />
            ))}
          </g>
        </svg>
      </div>
      <ul className="legend">
        {present.map(([s, name]) => (
          <li key={s} data-lit={s === lit || undefined}>
            <button type="button" aria-pressed={s === selected} onClick={() => onSelect(s)} {...hover(s)}>
              <i data-stage={s} />
              <span>{name}</span>
              <span className="r">{counts.get(s)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
