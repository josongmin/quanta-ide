import { useMemo, useState } from "react";
import { useFeature } from "../../store/feature-flags-store";
import {
  actionTerrainStore,
  useActionTerrainStore,
  useActionTerrainRender,
} from "../../store/action-terrain-store";
import { hexToCss, type RefactorPlan, type RefactorRoiScore } from "@quanta/canvas-engine";
import { ROI_COLD, ROI_WARM, ROI_HOT } from "@quanta/canvas-pixi";
import { mixHex } from "@quanta/canvas-engine";

const TOP_N = 10;

const COMPONENT_LABELS: Record<keyof RefactorRoiScore["components"], string> = {
  churn: "Churn",
  complexity: "Complexity",
  fanIn: "Fan-in",
  testDebt: "Test debt",
  cycleMembership: "Cycle",
};

const COMPONENT_GLYPH: Record<keyof RefactorRoiScore["components"], string> = {
  churn: "C",
  complexity: "X",
  fanIn: "F",
  testDebt: "T",
  cycleMembership: "Y",
};

const PLAN_KIND_LABEL: Record<RefactorPlan["kind"], string> = {
  "extract-interface": "extract interface",
  "split-file": "split file",
  "break-cycle": "break cycle",
  "invert-dependency": "invert dep",
  "add-tests": "add tests",
  "reduce-fan-in": "reduce fan-in",
};

const CONE_DIRECTION_LABEL = {
  blast: "영향 (downstream)",
  fix: "수정 (upstream)",
} as const;

function basename(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

function deriveRoiColorCss(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const hex = t <= 0.5
    ? mixHex(ROI_COLD, ROI_WARM, t * 2)
    : mixHex(ROI_WARM, ROI_HOT, (t - 0.5) * 2);
  return hexToCss(hex);
}

function computeTotalScore(ordered: readonly RefactorRoiScore[]): number {
  let total = 0;
  for (const s of ordered) total += s.score;
  return total;
}

export function RefactorBacklogPanel() {
  const on = useFeature("action-terrain.mode");
  const simOn = useFeature("action-terrain.before-after-sim");
  const coneOn = useFeature("action-terrain.blast-fix-cone");
  const enabled = useActionTerrainRender(s => s.enabled);
  const roi = useActionTerrainRender(s => s.roi);
  const suggestions = useActionTerrainRender(s => s.suggestions);
  const simulation = useActionTerrainRender(s => s.simulation);
  const selectedFileId = useActionTerrainStore(s => s.selectedFileId);
  const activePlanId = useActionTerrainStore(s => s.activePlanId);
  const coneDirection = useActionTerrainStore(s => s.coneDirection);
  const [expandedFileIds, setExpandedFileIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const topFiles: readonly RefactorRoiScore[] = useMemo(() => {
    if (!roi) return [];
    return roi.ordered.slice(0, TOP_N);
  }, [roi]);

  const totals = useMemo(() => {
    if (!simulation) return null;
    return {
      before: simulation.before.total,
      after: simulation.after.total,
      delta: simulation.after.total - simulation.before.total,
    };
  }, [simulation]);

  if (!on || !enabled) return null;

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
          top {topFiles.length} · total {roi ? Math.round(computeTotalScore(roi.ordered)) : 0}
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

      {coneOn && (
        <div className="ws-roi-panel__cone-dir" role="group" aria-label="Cone direction">
          {(["blast", "fix"] as const).map(d => (
            <button
              key={d}
              type="button"
              className={`ws-roi-panel__chip${coneDirection === d ? " is-on" : ""}`}
              onClick={() => actionTerrainStore.setConeDirection(d)}
              title={d === "blast" ? "what a change to the root breaks" : "what a change to the root stabilizes"}
            >
              {CONE_DIRECTION_LABEL[d]}
            </button>
          ))}
        </div>
      )}

      {topFiles.length === 0 ? (
        <div className="ws-roi-panel__empty">
          {roi
            ? "핫스팟 없음 — 그래프에 churn / complexity 신호가 아직 부족합니다."
            : "ROI 계산 중…"}
        </div>
      ) : (
        <ol className="ws-roi-panel__list">
          {topFiles.map(score => {
            const isSelected = score.fileId === selectedFileId;
            const expanded = expandedFileIds.has(score.fileId);
            const plans = suggestions.get(score.fileId) ?? [];
            const scoreColor = deriveRoiColorCss(score.score);
            return (
              <li
                key={score.fileId}
                className={`ws-roi-row${isSelected ? " ws-roi-row--selected" : ""}`}
              >
                <button
                  type="button"
                  className="ws-roi-row__main"
                  onClick={() => onRowClick(score.fileId)}
                  title={isSelected ? `${score.fileId} — click to clear` : score.fileId}
                >
                  <span className="ws-roi-row__rank">#{score.rank}</span>
                  <span className="ws-roi-row__name">{basename(score.fileId)}</span>
                  <span className="ws-roi-row__score" style={{ color: scoreColor }}>
                    {Math.round(score.score)}
                  </span>
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
                      <span className="ws-roi-component-mini__track">
                        <span
                          className="ws-roi-component-mini__fill"
                          style={{ height: `${Math.max(6, v)}%` }}
                        />
                      </span>
                      <span className="ws-roi-component-mini__glyph" aria-hidden>
                        {COMPONENT_GLYPH[k]}
                      </span>
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
                                {planActive ? "stop sim" : "simulate"}
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
      )}
    </aside>
  );
}
