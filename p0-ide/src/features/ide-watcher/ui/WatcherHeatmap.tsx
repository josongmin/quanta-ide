import { useState } from "react";
import type { HeatmapCell } from "@/entities/watcher";

interface Props {
  cells: readonly HeatmapCell[];
}

function ago(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m`;
}

const TEST_LABEL: Record<string, string> = {
  pass: "PASS", fail: "FAIL", running: "RUN", none: "—",
};

export function WatcherHeatmap({ cells }: Props) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const active = cells.filter(c => c.heat !== "idle");

  // Stats
  const editing = active.filter(c => c.editing).length;
  const clean = active.filter(c => c.heat === "clean").length;
  const warn = active.filter(c => c.heat === "warn").length;
  const block = active.filter(c => c.heat === "block").length;

  return (
    <div className="wt-hm">
      {/* Left: summary stats */}
      <div className="wt-hm-sidebar">
        <div className="wt-hm-stat">
          <span className="wt-hm-stat-num wt-hm-stat-active">{editing}</span>
          <span className="wt-hm-stat-label">editing</span>
        </div>
        <div className="wt-hm-stat">
          <span className="wt-hm-stat-num wt-hm-stat-clean">{clean}</span>
          <span className="wt-hm-stat-label">clean</span>
        </div>
        <div className="wt-hm-stat">
          <span className="wt-hm-stat-num wt-hm-stat-warn">{warn}</span>
          <span className="wt-hm-stat-label">warn</span>
        </div>
        <div className="wt-hm-stat">
          <span className="wt-hm-stat-num wt-hm-stat-block">{block}</span>
          <span className="wt-hm-stat-label">block</span>
        </div>
        <div className="wt-hm-divider" />
        <div className="wt-hm-stat">
          <span className="wt-hm-stat-num">{active.length}</span>
          <span className="wt-hm-stat-label">total</span>
        </div>
      </div>

      {/* Center: heatmap grid */}
      <div className="wt-hm-grid-wrap">
        <div className="wt-hm-grid">
          {/* Active files first, sorted by churn desc */}
          {[...active].sort((a, b) => b.churn - a.churn).map(cell => (
            <div
              key={cell.id}
              className={`wt-hm-cell wt-hm-heat-${cell.heat}${cell.editing ? " is-editing" : ""}`}
              onMouseEnter={() => setHovered(cell)}
              onMouseLeave={() => setHovered(null)}
              title={cell.file}
            >
              <span className="wt-hm-cell-name">{cell.shortName}</span>
              {cell.churn > 0 && (
                <span className="wt-hm-cell-churn">
                  {cell.linesAdded !== undefined && <span className="wt-hm-cell-add">+{cell.linesAdded}</span>}
                  {cell.linesRemoved !== undefined && <span className="wt-hm-cell-del">-{cell.linesRemoved}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: hover detail panel */}
      <div className={`wt-hm-detail${hovered ? " is-visible" : ""}`}>
        {hovered ? (
          <>
            <div className="wt-hm-detail-file">{hovered.file}</div>
            {hovered.heat !== "idle" && (
              <>
                {hovered.summary && (
                  <div className="wt-hm-detail-summary">{hovered.summary}</div>
                )}
                <div className="wt-hm-detail-row">
                  {hovered.linesAdded !== undefined && (
                    <span className="wt-hm-detail-diff">
                      <span className="wt-hm-cell-add">+{hovered.linesAdded}</span>
                      <span className="wt-hm-cell-del">-{hovered.linesRemoved}</span>
                    </span>
                  )}
                  {hovered.agoSec !== undefined && (
                    <span className="wt-hm-detail-ago">{ago(hovered.agoSec)} ago</span>
                  )}
                </div>
                <div className="wt-hm-detail-signals">
                  {hovered.guardHit && (
                    <span className={`wt-hm-detail-guard wt-hm-detail-guard-${hovered.heat}`}>
                      {hovered.heat === "block" ? "✕" : "!"} {hovered.guardHit}
                    </span>
                  )}
                  {hovered.testStatus && hovered.testStatus !== "none" && (
                    <span className={`wt-hm-detail-test wt-hm-detail-test-${hovered.testStatus}`}>
                      {TEST_LABEL[hovered.testStatus]}
                    </span>
                  )}
                </div>
                {hovered.editing && (
                  <div className="wt-hm-detail-editing">AI editing now</div>
                )}
              </>
            )}
            {hovered.heat === "idle" && (
              <div className="wt-hm-detail-idle">untouched</div>
            )}
          </>
        ) : (
          <div className="wt-hm-detail-hint">hover a file</div>
        )}
      </div>
    </div>
  );
}
