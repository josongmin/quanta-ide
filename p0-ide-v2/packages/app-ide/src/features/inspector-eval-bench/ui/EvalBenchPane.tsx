import "./eval-bench-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getBenchRun,
  type Capability,
  type CapabilityScore,
  type GoldenTask,
  type TaskOutcome,
  type TaskResult,
} from "@quanta/app-ide/entities/eval-bench";

const CAP_LABEL: Record<Capability, string> = {
  "taint":           "taint",
  "blast":           "blast",
  "behavior":        "behavior",
  "refactor":        "refactor",
  "flow":            "flow",
  "incident-replay": "replay",
  "test-intel":      "tests",
  "race":            "race",
  "intent-gap":      "intent",
};

const OUTCOME_LABEL: Record<TaskOutcome, string> = {
  pass: "pass",
  fail: "fail",
  flaky: "flaky",
  skipped: "skipped",
};

type OutcomeFilter = "all" | "fail" | "flaky" | "skipped";

const OUTCOME_FILTERS: ReadonlyArray<{ id: OutcomeFilter; label: string }> = [
  { id: "all",     label: "All non-pass" },
  { id: "fail",    label: "Fail" },
  { id: "flaky",   label: "Flaky" },
  { id: "skipped", label: "Skipped" },
];

const TREND_W = 60;
const TREND_H = 16;

function humanRelative(iso: string | undefined, nowIso: string): string {
  if (!iso) return "never";
  const then = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return iso;
  const diffMs = Math.max(0, now - then);
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function trendPolylinePoints(trend: number[]): string {
  if (trend.length === 0) return "";
  const stepX = trend.length === 1 ? 0 : (TREND_W - 2) / (trend.length - 1);
  return trend
    .map((v, i) => {
      const x = 1 + i * stepX;
      const y = 1 + (1 - Math.max(0, Math.min(100, v)) / 100) * (TREND_H - 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

interface MiniGaugeProps {
  scorePct: number;
  size: number;
  stroke: number;
}

function MiniGauge({ scorePct, size, stroke }: MiniGaugeProps) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, scorePct)) / 100) * circ;
  const toneCls =
    scorePct >= 90 ? "bench-pane__gauge-arc--ok"
    : scorePct >= 70 ? "bench-pane__gauge-arc--warn"
    : "bench-pane__gauge-arc--bad";
  return (
    <svg
      className="bench-pane__gauge"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`score ${scorePct}%`}
    >
      <circle
        className="bench-pane__gauge-track"
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={stroke}
      />
      <circle
        className={`bench-pane__gauge-arc ${toneCls}`}
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        className="bench-pane__gauge-text"
        x={cx}
        y={cy + 4}
        textAnchor="middle"
      >
        {scorePct}
      </text>
    </svg>
  );
}

function SemiGauge({ scorePct }: { scorePct: number }) {
  const W = 132;
  const H = 72;
  const r = 54;
  const cx = W / 2;
  const cy = H - 6;
  const halfCirc = Math.PI * r;
  const pct = Math.max(0, Math.min(100, scorePct));
  const dash = (pct / 100) * halfCirc;
  const toneCls =
    pct >= 90 ? "bench-pane__semi-arc--ok"
    : pct >= 70 ? "bench-pane__semi-arc--warn"
    : "bench-pane__semi-arc--bad";
  return (
    <svg
      className="bench-pane__semi"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`overall score ${pct}%`}
    >
      <path
        className="bench-pane__semi-track"
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
      />
      <path
        className={`bench-pane__semi-arc ${toneCls}`}
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        strokeDasharray={`${dash.toFixed(2)} ${(halfCirc - dash).toFixed(2)}`}
      />
      <text
        className="bench-pane__semi-text"
        x={cx}
        y={cy - 14}
        textAnchor="middle"
      >
        {pct}
      </text>
      <text
        className="bench-pane__semi-sub"
        x={cx}
        y={cy - 2}
        textAnchor="middle"
      >
        / 100
      </text>
    </svg>
  );
}

interface TrendSparkProps {
  trend: number[];
  toneCls: string;
}

function TrendSpark({ trend, toneCls }: TrendSparkProps) {
  if (trend.length === 0) return null;
  return (
    <svg
      className="bench-pane__trend"
      width={TREND_W}
      height={TREND_H}
      viewBox={`0 0 ${TREND_W} ${TREND_H}`}
      role="img"
      aria-label="recent run scores"
    >
      <line
        className="bench-pane__trend-base"
        x1={1}
        x2={TREND_W - 1}
        y1={TREND_H - 1}
        y2={TREND_H - 1}
      />
      <polyline
        className={`bench-pane__trend-line ${toneCls}`}
        points={trendPolylinePoints(trend)}
      />
    </svg>
  );
}

function trendToneClass(scorePct: number): string {
  if (scorePct >= 90) return "bench-pane__trend-line--ok";
  if (scorePct >= 70) return "bench-pane__trend-line--warn";
  return "bench-pane__trend-line--bad";
}

function describeDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "±0";
}

export function EvalBenchPane({ file }: { file: FileFacts }) {
  const run = getBenchRun(file.name);
  const [capFilter, setCapFilter] = useState<Capability | "all">("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  const taskMap = useMemo(() => {
    if (!run) return new Map<string, GoldenTask>();
    const m = new Map<string, GoldenTask>();
    for (const t of run.tasks) m.set(t.id, t);
    return m;
  }, [run]);

  const nonPassResults = useMemo(() => {
    if (!run) return [] as TaskResult[];
    return run.results.filter((r) => r.outcome !== "pass");
  }, [run]);

  const visibleResults = useMemo(() => {
    return nonPassResults.filter((r) => {
      if (outcomeFilter !== "all" && r.outcome !== outcomeFilter) return false;
      if (capFilter !== "all") {
        const t = taskMap.get(r.taskId);
        if (!t || t.capability !== capFilter) return false;
      }
      return true;
    });
  }, [nonPassResults, outcomeFilter, capFilter, taskMap]);

  const flakyResults = useMemo(() => {
    if (!run) return [] as TaskResult[];
    const flakySet = new Set(run.flakyTaskIds);
    return run.results.filter((r) => flakySet.has(r.taskId));
  }, [run]);

  const regressedRows = useMemo(() => {
    if (!run) return [] as Array<{ task: GoldenTask; result: TaskResult }>;
    const out: Array<{ task: GoldenTask; result: TaskResult }> = [];
    for (const id of run.regressedTaskIds) {
      const task = taskMap.get(id);
      const result = run.results.find((r) => r.taskId === id);
      if (task && result) out.push({ task, result });
    }
    return out;
  }, [run, taskMap]);

  if (!run) {
    return (
      <div className="bench-pane">
        <div className="bench-pane__empty">
          No bench run available for <strong>{file.name}</strong>.
        </div>
      </div>
    );
  }

  const totalTasks = run.tasks.length;
  const regCount = run.regressedTaskIds.length;
  const flakyCount = run.flakyTaskIds.length;
  const lastGreen = humanRelative(run.lastGreenAt, run.startedAt);

  const presentCaps: Capability[] = run.capabilityScores.map((c) => c.capability);

  return (
    <div className="bench-pane">
      {/* ── Header: 4 stat tiles ── */}
      <div className="bench-pane__head">
        <div className="bench-pane__stat bench-pane__stat--gauge">
          <SemiGauge scorePct={run.overallScorePct} />
          <div className="bench-pane__stat-k">overall score</div>
        </div>
        <div className="bench-pane__stat">
          <div
            className={`bench-pane__stat-v${regCount > 0 ? " bench-pane__stat-v--bad" : ""}`}
          >
            {regCount}
          </div>
          <div className="bench-pane__stat-k">regressions</div>
        </div>
        <div className="bench-pane__stat">
          <div
            className={`bench-pane__stat-v${flakyCount > 0 ? " bench-pane__stat-v--warn" : ""}`}
          >
            {flakyCount}
          </div>
          <div className="bench-pane__stat-k">flaky</div>
        </div>
        <div className="bench-pane__stat">
          <div className="bench-pane__stat-v bench-pane__stat-v--small">
            {lastGreen}
          </div>
          <div className="bench-pane__stat-k">last green</div>
        </div>
      </div>

      {/* ── Capability scoreboard ── */}
      <div className="bench-pane__section">
        <div className="bench-pane__section-title">Capability scoreboard</div>
        <div className="bench-pane__scoreboard">
          {run.capabilityScores.map((c: CapabilityScore) => {
            const toneCls = trendToneClass(c.scorePct);
            const deltaCls =
              c.deltaFromLastGreen > 0 ? "bench-pane__delta--up"
              : c.deltaFromLastGreen < 0 ? "bench-pane__delta--down"
              : "bench-pane__delta--flat";
            const isFiltered = capFilter === c.capability;
            return (
              <button
                key={c.capability}
                type="button"
                className={`bench-pane__cap${isFiltered ? " is-active" : ""}`}
                aria-pressed={isFiltered}
                onClick={() =>
                  setCapFilter((prev) =>
                    prev === c.capability ? "all" : c.capability,
                  )
                }
              >
                <MiniGauge scorePct={c.scorePct} size={60} stroke={6} />
                <div className="bench-pane__cap-label">{CAP_LABEL[c.capability]}</div>
                <div className="bench-pane__cap-meta">
                  <span className="bench-pane__cap-frac">
                    {c.passCount}/{c.total}
                  </span>
                  <span className="bench-pane__cap-sep">·</span>
                  <span className="bench-pane__cap-p95">p95 {c.p95Ms}ms</span>
                  <span className="bench-pane__cap-sep">·</span>
                  <span className={`bench-pane__delta ${deltaCls}`}>
                    ∆{describeDelta(c.deltaFromLastGreen)}
                  </span>
                </div>
                <TrendSpark trend={c.trend} toneCls={toneCls} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Regressed tasks (red banner) ── */}
      {regressedRows.length > 0 && (
        <div className="bench-pane__regressions" role="alert">
          <div className="bench-pane__regressions-title">
            {regressedRows.length} regression{regressedRows.length === 1 ? "" : "s"} vs last green
          </div>
          <ul className="bench-pane__reg-list">
            {regressedRows.map(({ task, result }) => (
              <li key={task.id} className="bench-pane__reg-row">
                <span className="bench-pane__chip bench-pane__chip--cap">
                  {CAP_LABEL[task.capability]}
                </span>
                <div className="bench-pane__reg-body">
                  <div className="bench-pane__reg-desc">{task.description}</div>
                  <pre className="bench-pane__diff">{result.detail}</pre>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Filters + main task list (left) and flaky watch (right) ── */}
      <div className="bench-pane__grid">
        <div className="bench-pane__main">
          <div className="bench-pane__filters" role="toolbar" aria-label="Task filters">
            <div className="bench-pane__filter-group">
              {OUTCOME_FILTERS.map((f) => {
                const active = outcomeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`bench-pane__filter${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setOutcomeFilter(f.id)}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            {capFilter !== "all" && (
              <button
                type="button"
                className="bench-pane__filter bench-pane__filter--clear"
                onClick={() => setCapFilter("all")}
              >
                clear: {CAP_LABEL[capFilter]} ✕
              </button>
            )}
          </div>

          <div className="bench-pane__section-title">
            Failing / flaky tasks
            <span className="bench-pane__section-count">
              {visibleResults.length} of {nonPassResults.length}
            </span>
          </div>

          {visibleResults.length === 0 ? (
            <div className="bench-pane__empty-row">
              {nonPassResults.length === 0
                ? "All tasks pass — nothing to triage."
                : "No tasks match the active filters."}
            </div>
          ) : (
            <ul className="bench-pane__tasks">
              {visibleResults.map((r) => {
                const task = taskMap.get(r.taskId);
                if (!task) return null;
                const isReg = run.regressedTaskIds.includes(r.taskId);
                return (
                  <li
                    key={r.taskId}
                    className={`bench-pane__task bench-pane__task--${r.outcome}${isReg ? " is-regression" : ""}`}
                  >
                    <span
                      className={`bench-pane__chip bench-pane__chip--outcome bench-pane__chip--${r.outcome}`}
                    >
                      {OUTCOME_LABEL[r.outcome]}
                    </span>
                    <span className="bench-pane__chip bench-pane__chip--cap">
                      {CAP_LABEL[task.capability]}
                    </span>
                    <div className="bench-pane__task-body">
                      <div className="bench-pane__task-desc">{task.description}</div>
                      <div className="bench-pane__task-expected">
                        expected: {task.expectedSummary}
                      </div>
                      {r.outcome === "fail" ? (
                        <pre className="bench-pane__diff">{r.detail}</pre>
                      ) : r.outcome === "flaky" ? (
                        <div className="bench-pane__task-flaky">
                          {r.detail} · stability {Math.round(r.stability30d * 100)}%
                        </div>
                      ) : (
                        <div className="bench-pane__task-flaky">{r.detail}</div>
                      )}
                    </div>
                    <span className="bench-pane__task-lat">
                      {r.outcome === "skipped" ? "—" : `${r.latencyMs}ms`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Flaky watch list (right column) ── */}
        <aside className="bench-pane__flaky-watch" aria-label="Flaky watch">
          <div className="bench-pane__section-title">Flaky watch</div>
          {flakyResults.length === 0 ? (
            <div className="bench-pane__empty-row">No flaky tasks.</div>
          ) : (
            <ul className="bench-pane__flaky-list">
              {flakyResults.map((r) => {
                const task = taskMap.get(r.taskId);
                if (!task) return null;
                const stabPct = Math.round(r.stability30d * 100);
                return (
                  <li key={r.taskId} className="bench-pane__flaky-row">
                    <div className="bench-pane__flaky-name">
                      <span className="bench-pane__chip bench-pane__chip--cap">
                        {CAP_LABEL[task.capability]}
                      </span>
                      <span className="bench-pane__flaky-desc">{task.description}</span>
                    </div>
                    <div
                      className="bench-pane__flaky-bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={stabPct}
                    >
                      <span
                        className="bench-pane__flaky-bar-fill"
                        style={{ width: `${stabPct}%` }}
                      />
                    </div>
                    <div className="bench-pane__flaky-pct">{stabPct}%</div>
                  </li>
                );
              })}
            </ul>
          )}

          {presentCaps.length > 1 && (
            <div className="bench-pane__cap-jump">
              <div className="bench-pane__section-subtitle">Filter by capability</div>
              <div className="bench-pane__cap-jump-list">
                <button
                  type="button"
                  className={`bench-pane__cap-pill${capFilter === "all" ? " is-active" : ""}`}
                  onClick={() => setCapFilter("all")}
                >
                  all
                </button>
                {presentCaps.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`bench-pane__cap-pill${capFilter === c ? " is-active" : ""}`}
                    onClick={() =>
                      setCapFilter((prev) => (prev === c ? "all" : c))
                    }
                  >
                    {CAP_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Footer ── */}
      <div className="bench-pane__foot">
        Run {run.runId} · {run.durationMs}ms · {totalTasks} task
        {totalTasks === 1 ? "" : "s"} · file context: {file.name}
      </div>
    </div>
  );
}
