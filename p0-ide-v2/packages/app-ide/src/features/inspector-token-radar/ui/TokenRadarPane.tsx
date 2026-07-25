import "./token-radar-pane.css";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { getTokenRadarReport } from "@quanta/app-ide/entities/token-radar";
import { HeroSection } from "./sections/HeroSection";
import { AlertsSection } from "./sections/AlertsSection";
import { CostRoiSection } from "./sections/CostRoiSection";
import { ForecastSection } from "./sections/ForecastSection";
import { AgentTreeSection } from "./sections/AgentTreeSection";
import { TasksSection } from "./sections/TasksSection";
import { LoopsSection } from "./sections/LoopsSection";
import { WasteSection } from "./sections/WasteSection";
import { DiffSection } from "./sections/DiffSection";
import { HotspotsSection } from "./sections/HotspotsSection";
import { DriftSection } from "./sections/DriftSection";
import { ReplaySection } from "./sections/ReplaySection";
import { PolicySection } from "./sections/PolicySection";

/**
 * TokenRadar — agent runtime observability + control inspector.
 *
 * Visual hierarchy (top → bottom, by tier):
 *   1. HERO — total cost / tokens / status / forecast spark           (T1)
 *   2. ALERTS — secret egress, budget breach, stuck, pingpong         (critical)
 *   3. COST ROI — cache breakpoints + model right-sizing audit        (T1, biggest $)
 *   4. FORECAST — burn vs comparable distribution                     (T1)
 *   5. AGENT TREE / FLAMEGRAPH — where cost concentrates              (T1)
 *   6. TASKS — table, focused-file pinned                             (T2)
 *   7. LOOPS — retry / stuckness / pingpong / convergence             (T2)
 *   8. WASTE — donut + context leaks                                  (T2)
 *   9. DIFF — efficiency grade + churn                                (T2)
 *  10. HOTSPOTS — file map + tool ROI + test log bloat                (T2)
 *  11. DRIFT — plan / scope / compaction / streaming / repro          (T3, advanced)
 *  12. REPLAY — timeline                                              (chronicle)
 *  13. POLICY — budget guard + prioritized recommendations            (control)
 */
export function TokenRadarPane({ file }: { file: FileFacts }) {
  const report = getTokenRadarReport(file.name);

  if (!report) {
    return (
      <div className="tr-pane">
        <div className="tr-pane__empty">
          No agent run on record for <strong>{file.name}</strong>.
          <div className="tr-pane__empty-sub">
            TokenRadar mounts the most recent run that touched the focused file.
            Try <code>orchestrator.py</code>, <code>routing_policy.py</code>, or <code>security.py</code>.
          </div>
        </div>
      </div>
    );
  }

  const { run, fileTouchingTaskIds } = report;

  return (
    <div className="tr-pane">
      <HeroSection run={run} fileName={report.fileName} />
      <AlertsSection run={run} />
      <CostRoiSection run={run} />
      <ForecastSection run={run} />
      <AgentTreeSection run={run} />
      <TasksSection run={run} fileTouchingIds={fileTouchingTaskIds} />
      <LoopsSection run={run} />
      <WasteSection run={run} />
      <DiffSection run={run} />
      <HotspotsSection run={run} />
      <DriftSection run={run} />
      <ReplaySection run={run} />
      <PolicySection run={run} />
    </div>
  );
}
