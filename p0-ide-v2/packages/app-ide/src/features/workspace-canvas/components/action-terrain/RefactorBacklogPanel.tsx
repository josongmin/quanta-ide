import { useMemo, useState } from "react";
import { useFeature } from "../../store/feature-flags-store";
import { useActionTerrain } from "../../hooks/use-action-terrain";
import {
  actionTerrainStore,
  useActionTerrainStore,
} from "../../store/action-terrain-store";
import type {
  RefactorPlan,
  RefactorRoiScore,
} from "@quanta/canvas-engine";

// Right-side panel that lists the top-N refactor-ROI files with expandable
// AI-suggested plans underneath. Clicking a file row selects it (drives the
// blast/fix cone); clicking "Simulate" activates the before/after terrain
// overlay. The panel itself is gated on action-terrain.mode; the simulate
// buttons are gated on action-terrain.before-after-sim.

const TOP_N = 10;

const COMPONENT_LABELS: Record<keyof RefactorRoiScore["components"], string> = {
  churn: "Churn",
  complexity: "Complexity",
  fanIn: "Fan-in",
  testDebt: "Test debt",
  cycleMembership: "Cycle",
};

const PLAN_KIND_LABEL: Record<RefactorPlan["kind"], string> = {
  "extract-interface": "extract interface",
  "split-file": "split file",
  "break-cycle": "break cycle",
  "invert-dependency": "invert dep",
  "add-tests": "add tests",
  "reduce-fan-in": "reduce fan-in",
};

function basename(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

export function RefactorBacklogPanel() {
  const on = useFeature("action-terrain.mode");
  const simOn = useFeature("action-terrain.before-after-sim");
  const result = useActionTerrain();
  const selectedFileId = useActionTerrainStore(s => s.selectedFileId);
  const activePlanId = useActionTerrainStore(s => s.activePlanId);
  const coneDirection = useActionTerrainStore(s => s.coneDirection);
  const [expandedFileIds, setExpandedFileIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const topFiles: readonly RefactorRoiScore[] = useMemo(() => {
    if (!result.enabled) return [];
    return result.roi.ordered.slice(0, TOP_N);
  }, [result]);

  const totals = useMemo(() => {
    if (!result.enabled) return null;
    if (!result.simulation) return null;
    return {
      before: result.simulation.before.total,
      after: result.simulation.after.total,
      delta: result.simulation.after.total - result.simulation.before.total,
    };
  }, [result]);

  if (!on) return null;
  if (!result.enabled) return null;
  if (topFiles.length === 0) return null;

  const toggleExpanded = (id: string) => {
    setExpandedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onRowClick = (id: string) => {
    actionTerrainStore.selectFile(id === selectedFileId ? null : id);
  };

  const onSimulate = (planId: string) => {
    actionTerrainStore.selectPlan(planId === activePlanId ? null : planId);
  };

  return (
    <aside
      className="ws-roi-panel"
      aria-label="Refactor backlog"
      onMouseDownCapture={e => e.stopPropagation()}
      onWheelCapture={e => e.stopPropagation()}
    >
      <header className="ws-roi-panel__header">
        <span className="ws-roi-panel__title">Refactor backlog</span>
        <span className="ws-roi-panel__count">
          top {topFiles.length} · total {Math.round(sumTotal(result.roi.ordered))}
        </span>
      </header>

      {totals && (
        <div className="ws-roi-panel__sim-header">
          <span>Total ROI</span>
          <span className="ws-roi-panel__sim-nums">
            {Math.round(totals.before)}
            <span aria-hidden> → </span>
            {Math.round(totals.after)}
            <span
              className={
                totals.delta < 0
                  ? "ws-roi-sim-delta--improved"
                  : totals.delta > 0
                    ? "ws-roi-sim-delta--worse"
                    : ""
              }
            >
              {totals.delta === 0 ? "" : ` (${totals.delta > 0 ? "+" : ""}${Math.round(totals.delta)})`}
            </span>
          </span>
        </div>
      )}

      <div className="ws-roi-panel__cone-dir" role="group" aria-label="Cone direction">
        {(["blast", "fix"] as const).map(d => (
          <button
            key={d}
            type="button"
            className={`ws-roi-panel__chip${coneDirection === d ? " is-on" : ""}`}
            onClick={() => actionTerrainStore.setConeDirection(d)}
            title={d === "blast" ? "what a change to the root breaks" : "what a change to the root stabilizes"}
          >
            {d}
          </button>
        ))}
      </div>

      <ol className="ws-roi-panel__list">
        {topFiles.map(score => {
          const isSelected = score.fileId === selectedFileId;
          const expanded = expandedFileIds.has(score.fileId);
          const plans = result.suggestions.get(score.fileId) ?? [];
          return (
            <li
              key={score.fileId}
              className={`ws-roi-row${isSelected ? " ws-roi-row--selected" : ""}`}
            >
              <button
                type="button"
                className="ws-roi-row__main"
                onClick={() => onRowClick(score.fileId)}
                title={score.fileId}
              >
                <span className="ws-roi-row__rank">#{score.rank}</span>
                <span className="ws-roi-row__name">{basename(score.fileId)}</span>
                <span className="ws-roi-row__score">{Math.round(score.score)}</span>
                <span className="ws-roi-bar" aria-hidden>
                  <span
                    className="ws-roi-bar__fill"
                    style={{ width: `${Math.max(2, score.score)}%` }}
                  />
                </span>
              </button>
              <div className="ws-roi-component-mini" aria-label="ROI components">
                {(Object.entries(score.components) as Array<
                  [keyof RefactorRoiScore["components"], number]
                >).map(([k, v]) => (
                  <span
                    key={k}
                    className="ws-roi-component-mini__bar"
                    title={`${COMPONENT_LABELS[k]}: ${Math.round(v)}`}
                  >
                    <span
                      className="ws-roi-component-mini__fill"
                      style={{ height: `${Math.max(6, v)}%` }}
                    />
                  </span>
                ))}
              </div>
              {plans.length > 0 && (
                <button
                  type="button"
                  className="ws-roi-row__expand"
                  onClick={() => toggleExpanded(score.fileId)}
                  aria-expanded={expanded}
                >
                  {expanded ? "hide" : `${plans.length} plan${plans.length > 1 ? "s" : ""}`}
                </button>
              )}
              {expanded && plans.length > 0 && (
                <ul className="ws-roi-row__plans">
                  {plans.map(plan => {
                    const planActive = plan.id === activePlanId;
                    return (
                      <li
                        key={plan.id}
                        className={`ws-roi-plan-card${planActive ? " ws-roi-plan-card--active" : ""}`}
                      >
                        <div className="ws-roi-plan-card__head">
                          <span className="ws-roi-plan-kind-badge">
                            {PLAN_KIND_LABEL[plan.kind]}
                          </span>
                          <span className="ws-roi-plan-card__title">{plan.title}</span>
                        </div>
                        <p className="ws-roi-plan-card__rationale">{plan.rationale}</p>
                        <div className="ws-roi-plan-card__foot">
                          <span>
                            ΔROI{" "}
                            <span
                              className={
                                plan.projectedRoiDelta < 0
                                  ? "ws-roi-sim-delta--improved"
                                  : "ws-roi-sim-delta--worse"
                              }
                            >
                              {plan.projectedRoiDelta > 0 ? "+" : ""}
                              {Math.round(plan.projectedRoiDelta)}
                            </span>
                          </span>
                          <span>conf {Math.round(plan.confidence * 100)}%</span>
                          {simOn && (
                            <button
                              type="button"
                              className={`ws-roi-plan-card__sim${planActive ? " is-on" : ""}`}
                              onClick={() => onSimulate(plan.id)}
                            >
                              {planActive ? "clear" : "simulate"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function sumTotal(ordered: readonly RefactorRoiScore[]): number {
  let total = 0;
  for (const s of ordered) total += s.score;
  return total;
}
