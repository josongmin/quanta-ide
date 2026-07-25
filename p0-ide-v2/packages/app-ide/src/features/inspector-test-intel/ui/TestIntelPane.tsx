import "./test-intel-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getTestIntel,
  type Scenario,
  type TestCase,
  type TestIntel,
} from "@quanta/app-ide/entities/test-intel";

const SCENARIO_LIST: ReadonlyArray<{ id: Scenario; label: string; short: string }> = [
  { id: "ci-all",   label: "CI (all)",         short: "ci" },
  { id: "pr-gate",  label: "PR gate (smart)",  short: "pr" },
  { id: "pre-push", label: "Pre-push (fastest)", short: "push" },
];

const OUTCOME_LABEL: Record<TestCase["lastOutcome"], string> = {
  pass: "pass",
  fail: "fail",
  flaky: "flaky",
};

const CRIT_RISK_THRESHOLD = 5;

/**
 * Sum of risk covered by a single test against the full changed-line set.
 * Used for the scatter y-axis (risk units) and the per-row "risk covered".
 */
function testRiskCovered(test: TestCase, intel: TestIntel): number {
  const weightMap = new Map<number, number>();
  for (const l of intel.changedLines) weightMap.set(l.line, l.riskWeight);
  return test.covers.reduce((acc, ln) => acc + (weightMap.get(ln) ?? 0), 0);
}

/**
 * Pareto frontier on (cost ↓, riskCovered ↑). Returns points sorted by cost.
 */
function paretoFrontier(
  points: ReadonlyArray<{ cost: number; risk: number }>,
): Array<{ cost: number; risk: number }> {
  const sorted = [...points].sort((a, b) =>
    a.cost === b.cost ? b.risk - a.risk : a.cost - b.cost,
  );
  const out: Array<{ cost: number; risk: number }> = [];
  let bestRisk = -1;
  for (const p of sorted) {
    if (p.risk > bestRisk) {
      out.push(p);
      bestRisk = p.risk;
    }
  }
  return out;
}

export function TestIntelPane({ file }: { file: FileFacts }) {
  const intel = getTestIntel(file.name);
  const [scenario, setScenario] = useState<Scenario>("pr-gate");
  const [hoverTestId, setHoverTestId] = useState<string | null>(null);
  const [pinnedTestId, setPinnedTestId] = useState<string | null>(null);

  const current = intel?.scenarios[scenario] ?? null;
  const selectedSet = useMemo(() => new Set(current?.selected ?? []), [current]);
  const uncoveredSet = useMemo(
    () => new Set(current?.uncoveredLines ?? []),
    [current],
  );

  const scatterPoints = useMemo(() => {
    if (!intel) return [];
    return intel.tests.map((t) => ({
      id: t.id,
      cost: t.costSec,
      risk: testRiskCovered(t, intel),
    }));
  }, [intel]);

  const pareto = useMemo(
    () => paretoFrontier(scatterPoints.map((p) => ({ cost: p.cost, risk: p.risk }))),
    [scatterPoints],
  );

  if (!intel || !current) {
    return (
      <div className="tintel-pane">
        <div className="tintel-pane__empty">
          No test intelligence available for <strong>{file.name}</strong>.
        </div>
      </div>
    );
  }

  const linesCovered = intel.changedLines.length - current.uncoveredLines.length;
  const totalLines = intel.changedLines.length;
  const totalTests = intel.tests.length;
  const selectedTests = current.selected
    .map((id) => intel.tests.find((t) => t.id === id))
    .filter((t): t is TestCase => Boolean(t));
  const totalCost = selectedTests.reduce((acc, t) => acc + t.costSec, 0);

  /* ── Matrix geometry ── */
  const COL_W = 18;
  const ROW_H = 18;
  const LEFT_PAD = 160;
  const TOP_PAD = 56;
  const BOTTOM_PAD = 28;
  const RIGHT_PAD = 12;
  const sortedLines = [...intel.changedLines].sort((a, b) => a.line - b.line);
  const matrixW = LEFT_PAD + sortedLines.length * COL_W + RIGHT_PAD;
  const matrixH = TOP_PAD + intel.tests.length * ROW_H + BOTTOM_PAD;

  /* ── Scatter geometry ── */
  const SC_W = 220;
  const SC_H = 180;
  const SC_PL = 32;
  const SC_PR = 8;
  const SC_PT = 10;
  const SC_PB = 24;
  const maxCost = Math.max(1, ...scatterPoints.map((p) => p.cost));
  const maxRisk = Math.max(1, intel.totalRiskWeight);
  const xScale = (c: number) =>
    SC_PL + ((c / maxCost) * (SC_W - SC_PL - SC_PR));
  const yScale = (r: number) =>
    SC_H - SC_PB - ((r / maxRisk) * (SC_H - SC_PT - SC_PB));

  const criticalUncovered = current.uncoveredLines
    .map((ln) => intel.changedLines.find((l) => l.line === ln))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .filter((l) => l.riskWeight >= CRIT_RISK_THRESHOLD);

  const activeLabel =
    SCENARIO_LIST.find((s) => s.id === scenario)?.label ?? scenario;

  return (
    <div className="tintel-pane">
      {/* ── Scenario picker ── */}
      <div
        className="tintel-pane__scenarios"
        role="radiogroup"
        aria-label="Test scenario"
      >
        {SCENARIO_LIST.map((s) => {
          const result = intel.scenarios[s.id];
          const active = s.id === scenario;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`tintel-pane__scenario${active ? " is-active" : ""}`}
              onClick={() => setScenario(s.id)}
            >
              <span className="tintel-pane__scenario-label">{s.label}</span>
              <span className="tintel-pane__scenario-meta">
                {result.budgetSec}s budget · {result.selected.length} test
                {result.selected.length === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Head stats ── */}
      <div className="tintel-pane__head">
        <div className="tintel-pane__stat">
          <div className="tintel-pane__stat-v">
            {linesCovered}
            <span className="tintel-pane__stat-sub"> / {totalLines}</span>
          </div>
          <div className="tintel-pane__stat-k">lines covered</div>
        </div>
        <div className="tintel-pane__stat">
          <div className="tintel-pane__stat-v">
            {selectedTests.length}
            <span className="tintel-pane__stat-sub"> / {totalTests}</span>
          </div>
          <div className="tintel-pane__stat-k">tests selected</div>
        </div>
        <div className="tintel-pane__stat">
          <div className="tintel-pane__stat-v">
            {totalCost.toFixed(1)}
            <span className="tintel-pane__stat-sub">s</span>
          </div>
          <div className="tintel-pane__stat-k">estimated runtime</div>
        </div>
      </div>

      {/* ── Viz: matrix + scatter ── */}
      <div className="tintel-pane__viz">
        <div className="tintel-pane__matrix-wrap">
          <div className="tintel-pane__section-title">Coverage matrix</div>
          <svg
            className="tintel-pane__matrix"
            width={matrixW}
            height={matrixH}
            viewBox={`0 0 ${matrixW} ${matrixH}`}
            role="img"
            aria-label="Test coverage matrix"
          >
            {/* column labels (rotated -45°) */}
            {sortedLines.map((l, ci) => {
              const cx = LEFT_PAD + ci * COL_W + COL_W / 2;
              const uncovered = uncoveredSet.has(l.line);
              return (
                <g key={`col-${l.line}`}>
                  <text
                    className={`tintel-pane__mx-col-label${uncovered ? " tintel-pane__mx-col-label--uncovered" : ""}`}
                    x={cx}
                    y={TOP_PAD - 6}
                    transform={`rotate(-45 ${cx} ${TOP_PAD - 6})`}
                    textAnchor="end"
                  >
                    L{l.line}
                  </text>
                  {uncovered && l.riskWeight >= CRIT_RISK_THRESHOLD && (
                    <text
                      className="tintel-pane__mx-bang"
                      x={cx}
                      y={TOP_PAD - 36}
                      textAnchor="middle"
                    >
                      !
                    </text>
                  )}
                </g>
              );
            })}

            {/* row backgrounds + rows */}
            {intel.tests.map((t, ri) => {
              const ry = TOP_PAD + ri * ROW_H;
              const isSelected = selectedSet.has(t.id);
              const isHover = hoverTestId === t.id;
              const bgClass = isSelected
                ? "tintel-pane__mx-row-bg--selected"
                : isHover
                  ? "tintel-pane__mx-row-bg--hovered"
                  : "";
              return (
                <g
                  key={t.id}
                  onMouseEnter={() => setHoverTestId(t.id)}
                  onMouseLeave={() =>
                    setHoverTestId((prev) => (prev === t.id ? null : prev))
                  }
                >
                  <rect
                    className={`tintel-pane__mx-row-bg ${bgClass}`.trim()}
                    x={0}
                    y={ry}
                    width={matrixW}
                    height={ROW_H}
                  />
                  <text
                    className={`tintel-pane__mx-row-label${!isSelected ? " tintel-pane__mx-row-label--dim" : ""}`}
                    x={LEFT_PAD - 6}
                    y={ry + ROW_H / 2 + 3}
                    textAnchor="end"
                  >
                    {t.name.length > 24 ? `${t.name.slice(0, 23)}…` : t.name}
                  </text>
                  {sortedLines.map((l, ci) => {
                    const covers = t.covers.includes(l.line);
                    if (!covers) return null;
                    const cx = LEFT_PAD + ci * COL_W + COL_W / 2;
                    const cy = ry + ROW_H / 2;
                    const cellClass = isHover
                      ? "tintel-pane__mx-cell tintel-pane__mx-cell--highlight"
                      : isSelected
                        ? "tintel-pane__mx-cell tintel-pane__mx-cell--selected"
                        : "tintel-pane__mx-cell tintel-pane__mx-cell--dim";
                    return (
                      <circle
                        key={`${t.id}-${l.line}`}
                        className={cellClass}
                        cx={cx}
                        cy={cy}
                        r={4}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* uncovered underlines */}
            {sortedLines.map((l, ci) => {
              if (!uncoveredSet.has(l.line)) return null;
              const cx = LEFT_PAD + ci * COL_W;
              const y = TOP_PAD + intel.tests.length * ROW_H + 4;
              return (
                <line
                  key={`uc-${l.line}`}
                  className="tintel-pane__mx-underline"
                  x1={cx + 2}
                  x2={cx + COL_W - 2}
                  y1={y}
                  y2={y}
                />
              );
            })}
          </svg>
        </div>

        <div className="tintel-pane__scatter-wrap">
          <div className="tintel-pane__section-title">Cost / coverage</div>
          <svg
            className="tintel-pane__scatter"
            width={SC_W}
            height={SC_H}
            viewBox={`0 0 ${SC_W} ${SC_H}`}
            role="img"
            aria-label="Cost versus risk covered scatter"
          >
            {/* axes */}
            <line
              className="tintel-pane__sc-axis"
              x1={SC_PL}
              x2={SC_PL}
              y1={SC_PT}
              y2={SC_H - SC_PB}
            />
            <line
              className="tintel-pane__sc-axis"
              x1={SC_PL}
              x2={SC_W - SC_PR}
              y1={SC_H - SC_PB}
              y2={SC_H - SC_PB}
            />
            <text
              className="tintel-pane__sc-axis-label"
              x={SC_W / 2}
              y={SC_H - 6}
              textAnchor="middle"
            >
              cost (s)
            </text>
            <text
              className="tintel-pane__sc-axis-label"
              x={8}
              y={SC_H / 2}
              textAnchor="middle"
              transform={`rotate(-90 8 ${SC_H / 2})`}
            >
              risk covered
            </text>

            {/* Pareto frontier line */}
            {pareto.length > 1 && (
              <polyline
                className="tintel-pane__sc-pareto"
                points={pareto
                  .map((p) => `${xScale(p.cost)},${yScale(p.risk)}`)
                  .join(" ")}
              />
            )}

            {/* test dots */}
            {scatterPoints.map((p) => {
              const isSelected = selectedSet.has(p.id);
              return (
                <circle
                  key={p.id}
                  className={`tintel-pane__sc-dot${isSelected ? " tintel-pane__sc-dot--selected" : ""}`}
                  cx={xScale(p.cost)}
                  cy={yScale(p.risk)}
                  r={isSelected ? 3.5 : 3}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Selected test list ── */}
      {selectedTests.length === 0 ? (
        <div className="tintel-pane__tests-empty">
          No tests fit the {activeLabel} budget.
        </div>
      ) : (
        <ul className="tintel-pane__tests">
          {selectedTests.map((t) => {
            const risk = testRiskCovered(t, intel);
            const dotCls = `tintel-pane__test-dot tintel-pane__test-dot--${t.lastOutcome}`;
            const isHighlight = pinnedTestId === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`tintel-pane__test${isHighlight ? " is-highlight" : ""}`}
                  onClick={() =>
                    setPinnedTestId((prev) => (prev === t.id ? null : t.id))
                  }
                  aria-pressed={isHighlight}
                  title={OUTCOME_LABEL[t.lastOutcome]}
                >
                  <span className={dotCls} aria-hidden="true" />
                  <span className="tintel-pane__test-name">{t.name}</span>
                  <span className="tintel-pane__test-cost">{t.costSec.toFixed(1)}s</span>
                  <span className="tintel-pane__test-risk">+{risk} risk</span>
                  <span className="tintel-pane__test-tags">
                    {(t.tags ?? []).map((tag) => (
                      <span key={tag} className="tintel-pane__test-tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Uncovered risk warning ── */}
      {criticalUncovered.length > 0 && (
        <div className="tintel-pane__warn" role="status">
          <span className="tintel-pane__warn-title">Critical risk uncovered</span>
          {criticalUncovered.map((l) => (
            <span key={l.line} className="tintel-pane__warn-item">
              L{l.line} (weight {l.riskWeight}) — consider adding a test or
              promoting to PR gate scenario.
            </span>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="tintel-pane__foot">
        Set-cover greedy · budget {current.budgetSec}s · scenario: {activeLabel}
      </div>
    </div>
  );
}
