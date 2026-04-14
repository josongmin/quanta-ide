import { useState, type ReactNode } from "react";
import "./bottom-panel.css";

type TabId = "watcher" | "problems" | "quanta" | "terminal" | "output";

const tabs: { id: TabId; label: string; ariaLabel: string; icon: ReactNode }[] = [
  { id: "watcher", label: "Watcher", ariaLabel: "Watcher — live blast radius", icon: <WatcherIcon /> },
  { id: "problems", label: "Problems", ariaLabel: "Problems — LSP & linter diagnostics", icon: <ProblemsIcon /> },
  { id: "quanta", label: "Quanta", ariaLabel: "Quanta engine log", icon: <QuantaIcon /> },
  { id: "terminal", label: "Terminal", ariaLabel: "Terminal — shell session", icon: <TerminalIcon /> },
  { id: "output", label: "Output", ariaLabel: "Output — external tool logs", icon: <OutputIcon /> },
];

export function BottomPanel() {
  const [active, setActive] = useState<TabId>("problems");

  return (
    <section className="bp" aria-label="Bottom panel">
      <nav className="bp__rail" aria-label="Bottom panel tabs">
        <ul className="bp__rail-list">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <li key={t.id} className="bp__rail-item">
                <button
                  type="button"
                  className={`bp__rail-btn${isActive ? " is-active" : ""}`}
                  aria-label={t.ariaLabel}
                  aria-pressed={isActive}
                  title={t.label}
                  onClick={() => setActive(t.id)}
                >
                  <span className="bp__rail-icon" aria-hidden>{t.icon}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="bp__body">
        {active === "watcher" && <WatcherPane />}
        {active === "problems" && <ProblemsPane />}
        {active === "quanta" && <QuantaPane />}
        {active === "terminal" && <TerminalPane />}
        {active === "output" && <OutputPane />}
      </div>
    </section>
  );
}

/* ── Rail icons (lucide-style, viewBox 24, stroke 2) ──────────────── */
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
function WatcherIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function ProblemsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function QuantaIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <line x1="7" y1="7.5" x2="10.5" y2="16" />
      <line x1="17" y1="7.5" x2="13.5" y2="16" />
      <line x1="7.5" y1="6" x2="16.5" y2="6" />
    </svg>
  );
}
function TerminalIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
function OutputIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function WatcherPane() {
  const chips = [
    { label: "editing", n: 3, kind: "accent" },
    { label: "clean", n: 48, kind: "ok" },
    { label: "warnings", n: 5, kind: "warn" },
    { label: "blocked", n: 2, kind: "danger" },
  ];
  // simple 8×6 heat grid (48 cells) with varied states
  const grid = Array.from({ length: 48 }, (_, i) => {
    const mod = i % 11;
    if (mod === 0) return "editing";
    if (mod === 3) return "warn";
    if (mod === 7) return "block";
    if (mod === 9) return "idle";
    return "clean";
  });
  return (
    <div className="pane pane--watcher">
      <div className="toolbar">
        {chips.map((c) => (
          <span key={c.label} className={`chip chip--${c.kind}`}>
            <span className="chip__n">{c.n}</span>
            <span className="chip__l">{c.label}</span>
          </span>
        ))}
        <div className="toolbar__spacer" />
        <span className="toolbar__muted">2 fail · 1 running · 48 pass</span>
      </div>
      <div className="heatgrid">
        {grid.map((s, i) => <div key={i} className={`cell cell--${s}`} />)}
      </div>
    </div>
  );
}

type Severity = "error" | "warn" | "info";
interface ProblemItem { id: string; severity: Severity; line: number; col: number; message: string; source: string; }
interface ProblemGroup { path: string; items: ProblemItem[]; }

const MOCK_PROBLEMS: ProblemGroup[] = [
  {
    path: "codegraph_agent/orchestrator.py",
    items: [
      { id: "p1", severity: "error", line: 142, col: 9, message: "Argument of type 'StrategyId | None' is not assignable to 'StrategyId'.", source: "pyright(reportArgumentType)" },
      { id: "p2", severity: "warn", line: 88, col: 3, message: "Function 'resolve_policy' has a cyclomatic complexity of 14 (max 10).", source: "ruff(C901)" },
    ],
  },
  {
    path: "codegraph_agent/security.py",
    items: [
      { id: "p3", severity: "error", line: 57, col: 12, message: "Possible SQL injection via string concatenation in query builder.", source: "ruff(S608)" },
    ],
  },
  {
    path: "orchestrator/routing_policy.py",
    items: [
      { id: "p4", severity: "warn", line: 31, col: 1, message: "'_legacy_inference_bridge' imported but unused.", source: "ruff(F401)" },
      { id: "p5", severity: "info", line: 204, col: 5, message: "Consider using 'match' statement instead of nested if/elif chain.", source: "ruff(SIM114)" },
    ],
  },
  {
    path: "shared/audit_store.py",
    items: [
      { id: "p6", severity: "info", line: 12, col: 1, message: "Missing docstring on public module.", source: "ruff(D100)" },
    ],
  },
];

function ProblemsPane() {
  const [activeSev, setActiveSev] = useState<ReadonlySet<Severity>>(
    () => new Set<Severity>(["error", "warn", "info"]),
  );
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const counts = MOCK_PROBLEMS.reduce(
    (acc, g) => {
      for (const it of g.items) acc[it.severity] += 1;
      return acc;
    },
    { error: 0, warn: 0, info: 0 } as Record<Severity, number>,
  );

  const toggleSev = (sev: Severity) => {
    setActiveSev((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  const toggleGroup = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const visibleGroups = MOCK_PROBLEMS
    .map((g) => ({ group: g, items: g.items.filter((it) => activeSev.has(it.severity)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="pb-root">
      <div className="pb-toolbar">
        <span className="pb-panel-title">Problems</span>
        <span className="pb-toolbar-sep" aria-hidden />
        <div className="pb-toolbar-filters" role="group" aria-label="Severity filters">
          <FilterChip sev="error" label="errors" count={counts.error} active={activeSev.has("error")} onClick={() => toggleSev("error")} />
          <FilterChip sev="warn" label="warnings" count={counts.warn} active={activeSev.has("warn")} onClick={() => toggleSev("warn")} />
          <FilterChip sev="info" label="info" count={counts.info} active={activeSev.has("info")} onClick={() => toggleSev("info")} />
        </div>
        <div className="pb-toolbar-spacer" />
        <button type="button" className="pb-toolbar-action" title="Clear">clear</button>
      </div>

      <div className="pb-body">
        {visibleGroups.length === 0 ? (
          <div className="pb-empty">no problems match the current filter</div>
        ) : (
          <ul className="pb-list" aria-label="Problems list">
            {visibleGroups.map(({ group, items }) => {
              const isCollapsed = collapsed.has(group.path);
              return (
                <li key={group.path} className="pb-group">
                  <button
                    type="button"
                    className="pb-group-header"
                    onClick={() => toggleGroup(group.path)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="pb-group-caret" data-open={String(!isCollapsed)} aria-hidden>
                      <ChevronDownTiny />
                    </span>
                    <span className="pb-group-path" title={group.path}>{group.path}</span>
                    <span className="pb-group-count">{items.length}</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="pb-group-items">
                      {items.map((it) => (
                        <li key={it.id}>
                          <button type="button" className="pb-row" title={`${group.path}:${it.line}:${it.col}`}>
                            <span className={`pb-sev pb-sev-${it.severity}`} aria-label={it.severity}>
                              <SeverityGlyph severity={it.severity} />
                            </span>
                            <span className="pb-loc">{it.line}:{it.col}</span>
                            <span className="pb-msg">{it.message}</span>
                            <span className="pb-src">{it.source}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({ sev, label, count, active, onClick }: { sev: Severity; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <label className={`pb-chip pb-chip-${sev}${active ? " is-active" : ""}`} title={`${label}: ${count}`}>
      <input type="checkbox" className="pb-chip-input" checked={active} onChange={onClick} />
      <span className="pb-chip-count">{count}</span>
      <span className="pb-chip-label">{label}</span>
    </label>
  );
}

function SeverityGlyph({ severity }: { severity: Severity }) {
  if (severity === "error") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (severity === "warn") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.5 L14.5 13.5 L1.5 13.5 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M8 6.5 L8 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5 L8 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 7.5 L8 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownTiny() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 8 11 13 6" />
    </svg>
  );
}

const quantaEvents = [
  { kind: "drift", ts: "12:04:22", msg: "Symbol shape changed: execute() signature", sym: "orchestrator.py:12" },
  { kind: "impact", ts: "12:04:22", msg: "Blast radius recomputed — 5 files affected" },
  { kind: "dead", ts: "12:02:10", msg: "Dead symbol detected: _select_strategy", sym: "orchestrator.py:26" },
  { kind: "graph", ts: "12:00:03", msg: "Call graph refreshed (2,317 edges)" },
  { kind: "sync", ts: "11:58:40", msg: "Index resync complete — 47 files" },
];

function QuantaPane() {
  return (
    <div className="pane">
      <div className="toolbar">
        {["drift", "impact", "dead", "graph", "sync"].map((k) => (
          <span key={k} className={`chip chip--tag`}><span className="chip__l">{k}</span></span>
        ))}
        <div className="toolbar__spacer" />
        <button className="tb-btn">Clear</button>
      </div>
      <ul className="q-list">
        {quantaEvents.map((e, i) => (
          <li key={i} className="q-row">
            <span className={`q-kind q-kind--${e.kind}`}>{e.kind}</span>
            <span className="q-ts">{e.ts}</span>
            <span className="q-msg">{e.msg}</span>
            {e.sym && <span className="q-sym">{e.sym}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TerminalPane() {
  return (
    <div className="pane pane--terminal">
      <div className="term-tabs">
        <span className="term-tab term-tab--active">zsh (main) <button className="x">×</button></span>
        <span className="term-tab">payments-api <button className="x">×</button></span>
        <button className="term-tab term-tab--new">+</button>
      </div>
      <pre className="term-body">
{`$ pnpm test
  › payments-api:test
  ✓ refund flow (12ms)
  ✓ routing policy resolves (8ms)
  ✗ orchestrator.execute guards taint sink (43ms)
    Expected: UnvalidatedTrace
    Received: undefined

2 passed, 1 failed
$ `}
        <span className="term-cursor" />
      </pre>
    </div>
  );
}

function OutputPane() {
  return (
    <div className="pane pane--output">
      <div className="toolbar">
        <select className="select">
          <option>Build output</option>
          <option>Tests</option>
          <option>Agent</option>
        </select>
        <label className="toggle"><input type="checkbox" defaultChecked /> Wrap</label>
        <div className="toolbar__spacer" />
        <button className="tb-btn">Clear</button>
      </div>
      <pre className="out-body">
{`[12:00:00] Building payments-api...
[12:00:02] ✓ Parse 47 files
[12:00:03] ✓ Resolve imports
[12:00:04] ✓ Generate call graph (2,317 edges)
[12:00:05] Build complete — 47 files, 6,812 LOC
[12:00:10] Running tests...
[12:00:12] 12 passed, 2 failed`}
      </pre>
    </div>
  );
}
