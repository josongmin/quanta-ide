import { useEffect, useRef, useState } from "react";
import {
  MOCK_WATCHER_SNAPSHOT,
  selectSnapshot,
  useWatcherStore,
  type NowWatchingItem,
  type RollbackCheckpoint,
} from "@/entities/watcher";
import { WatcherHeatmap } from "./WatcherHeatmap";
import { WatcherRollback } from "./WatcherRollback";

interface WatcherTabProps {
  onNavigate?: (item: NowWatchingItem) => void;
  onRollback?: (checkpoint: RollbackCheckpoint) => void;
}

type HeatFilter = "active" | "clean" | "warn" | "block";

export function WatcherTab({ onNavigate: _onNavigate, onRollback }: WatcherTabProps) {
  const snapshot = useWatcherStore(selectSnapshot);
  const setSnapshot = useWatcherStore((s) => s.setSnapshot);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (snapshot.impactedFiles === 0 && snapshot.series.length === 0) {
      setSnapshot(MOCK_WATCHER_SNAPSHOT);
    }
  }, [snapshot, setSnapshot]);

  const [filters, setFilters] = useState<Record<HeatFilter, boolean>>({
    active: true, clean: true, warn: true, block: true,
  });

  const toggle = (key: HeatFilter) =>
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  const { guard, testPulse } = snapshot;
  const activeCount = snapshot.heatmap.filter(c => c.editing).length;
  const cleanCount = snapshot.heatmap.filter(c => c.heat === "clean").length;
  const warnCount = guard.warnings;
  const blockCount = guard.blocked;
  const testPass = testPulse.filter(t => t.status === "pass").length;
  const testFail = testPulse.filter(t => t.status === "fail").length;
  const testRun = testPulse.filter(t => t.status === "running").length;

  // Filter heatmap cells
  const visibleCells = snapshot.heatmap.filter(c => {
    if (c.heat === "idle") return false;
    if (c.editing && !filters.active) return false;
    if (c.heat === "clean" && !filters.clean) return false;
    if (c.heat === "warn" && !filters.warn) return false;
    if (c.heat === "block" && !filters.block) return false;
    return true;
  });

  return (
    <div className="wt-root">
      <div className="wt-header">
        <span className="bp-panel-title">Watcher</span>

        {/* Checkbox filters — same pattern as Problems panel */}
        <div className="wt-header-filters">
          <label className={`wt-filter${filters.active ? " is-active" : ""}`}>
            <input
              type="checkbox"
              className="wt-filter-input"
              checked={filters.active}
              onChange={() => toggle("active")}
            />
            <span>{activeCount} editing</span>
          </label>

          <label className={`wt-filter${filters.clean ? " is-active" : ""}`}>
            <input
              type="checkbox"
              className="wt-filter-input"
              checked={filters.clean}
              onChange={() => toggle("clean")}
            />
            <span>{cleanCount} clean</span>
          </label>

          <label className={`wt-filter${filters.warn ? " is-active" : ""}`}>
            <input
              type="checkbox"
              className="wt-filter-input"
              checked={filters.warn}
              onChange={() => toggle("warn")}
            />
            <span>{warnCount} warnings</span>
          </label>

          <label className={`wt-filter${filters.block ? " is-active" : ""}`}>
            <input
              type="checkbox"
              className="wt-filter-input"
              checked={filters.block}
              onChange={() => toggle("block")}
            />
            <span>{blockCount} blocked</span>
          </label>

          {testFail > 0 && <span className="wt-filter-info">{testFail} fail</span>}
          {testRun > 0 && <span className="wt-filter-info">{testRun} running</span>}
          {testPass > 0 && <span className="wt-filter-info">{testPass} pass</span>}
        </div>

        {/* Rollback shortcuts */}
        {snapshot.rollbackStack.length > 0 && (
          <div className="wt-header-rollback">
            <WatcherRollback stack={snapshot.rollbackStack} onRollback={onRollback} />
          </div>
        )}
      </div>

      <WatcherHeatmap cells={visibleCells} />
    </div>
  );
}
