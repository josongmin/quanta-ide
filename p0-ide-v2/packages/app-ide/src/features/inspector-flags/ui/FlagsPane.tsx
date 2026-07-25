import "./flags-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { getFlagMap } from "@quanta/app-ide/entities/flag";
import type { FeatureFlag, FlagComboCell } from "@quanta/app-ide/entities/flag";

const STAGE_LABEL: Record<FeatureFlag["stage"], string> = {
  dev: "dev",
  canary: "canary",
  prod: "prod",
  deprecated: "deprecated",
};

const COVERED_LABEL: Record<FlagComboCell["covered"], string> = {
  covered: "covered",
  partial: "partial",
  uncovered: "uncovered",
};

/**
 * Convert a linear index into its Karnaugh-grid (row, col) such that
 * flag[0] splits top/bottom halves and the remaining flags fill the
 * columns in standard gray-code order — so neighbours differ by one bit.
 */
function grayCode(n: number): number[] {
  const out: number[] = [];
  const total = 1 << n;
  for (let i = 0; i < total; i++) out.push(i ^ (i >> 1));
  return out;
}

function comboBitstring(flags: FeatureFlag[], combo: Record<string, boolean>): string {
  return flags.map((f) => (combo[f.id] ? "1" : "0")).join("");
}

export function FlagsPane({ file }: { file: FileFacts }) {
  const map = getFlagMap(file.name);

  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (map) for (const f of map.flags) init[f.id] = f.default;
    return init;
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Stable derivations, always called in the same order regardless of `map`.
  const flags = map?.flags ?? [];
  const cells = map?.cells ?? [];

  const reachableCount = useMemo(() => cells.filter((c) => c.reachable).length, [cells]);
  const uncoveredCount = useMemo(
    () => cells.filter((c) => c.reachable && c.covered === "uncovered").length,
    [cells],
  );
  const coveragePct = useMemo(() => {
    const reachable = cells.filter((c) => c.reachable);
    if (reachable.length === 0) return 0;
    const fullyCovered = reachable.filter((c) => c.covered === "covered").length;
    return Math.round((fullyCovered / reachable.length) * 100);
  }, [cells]);

  // K-map grid layout: flag[0] splits top/bottom; remaining flags gray-code columns.
  const layout = useMemo(() => {
    if (flags.length === 0) return { cols: 1, order: [] as FlagComboCell[] };
    const n = flags.length;
    const colBits = n - 1;
    const cols = 1 << colBits;
    const colOrder = grayCode(colBits);
    const order: FlagComboCell[] = [];
    // top row: flag[0] = 0, bottom row: flag[0] = 1
    for (const top of [0, 1]) {
      for (const g of colOrder) {
        // rebuild linear index with flag[0] as MSB
        const linear = (top << colBits) | g;
        const cell = cells.find((c) => {
          for (let b = 0; b < n; b++) {
            const on = ((linear >> (n - 1 - b)) & 1) === 1;
            if (c.combo[flags[b].id] !== on) return false;
          }
          return true;
        });
        if (cell) order.push(cell);
      }
    }
    return { cols: Math.max(cols, 1), order };
  }, [flags, cells]);

  if (!map) {
    return (
      <div className="flags-pane">
        <div className="flags-pane__empty">No feature-flag map for this file.</div>
      </div>
    );
  }

  const toggledKey = comboBitstring(flags, toggles);
  const selected: FlagComboCell | null =
    (selectedKey
      ? cells.find((c) => comboBitstring(flags, c.combo) === selectedKey)
      : null) ?? null;

  const total = cells.length;
  const deadCount = total - reachableCount;

  return (
    <div className="flags-pane">
      <div className="flags-pane__head">
        <div className="flags-pane__stat">
          <div className="flags-pane__stat-v">{flags.length}</div>
          <div className="flags-pane__stat-k">flags</div>
        </div>
        <div className="flags-pane__stat">
          <div className="flags-pane__stat-v">
            {reachableCount}
            <span className="flags-pane__stat-sub">/{total}</span>
          </div>
          <div className="flags-pane__stat-k">reachable combos</div>
        </div>
        <div className="flags-pane__stat">
          <div
            className={
              uncoveredCount > 0
                ? "flags-pane__stat-v flags-pane__stat-v--bad"
                : "flags-pane__stat-v"
            }
          >
            {uncoveredCount}
          </div>
          <div className="flags-pane__stat-k">uncovered</div>
        </div>
      </div>

      <div className="flags-pane__chips">
        {flags.map((flag) => {
          const on = toggles[flag.id];
          return (
            <button
              key={flag.id}
              type="button"
              className={`flags-pane__chip${on ? " is-on" : ""}`}
              onClick={() =>
                setToggles((prev) => ({ ...prev, [flag.id]: !prev[flag.id] }))
              }
            >
              <span className="flags-pane__chip-dot" aria-hidden />
              <span className="flags-pane__chip-label">{flag.label}</span>
              <span className={`flags-pane__chip-stage flags-pane__chip-stage--${flag.stage}`}>
                {STAGE_LABEL[flag.stage]}
              </span>
              <span className="flags-pane__chip-owner">{flag.owner}</span>
            </button>
          );
        })}
      </div>

      <div
        className="flags-pane__grid"
        style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}
      >
        {layout.order.map((cell) => {
          const key = comboBitstring(flags, cell.combo);
          const isActive = key === toggledKey;
          const isSelected = key === selectedKey;
          const risk = Math.max(0, Math.min(100, cell.riskScore));
          // Red overlay alpha — 0 at risk 0, up to ~0.22 at risk 100 so the tint
          // stays under the coverage dot / outline without fighting dark themes.
          const riskAlpha = cell.reachable ? (risk / 100) * 0.22 : 0;
          const classes = [
            "flags-pane__cell",
            cell.reachable ? "" : "flags-pane__cell--dead",
            `flags-pane__cell--${cell.covered}`,
            isActive ? "is-active" : "",
            isSelected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={key}
              type="button"
              className={classes}
              onClick={() => setSelectedKey(key)}
              title={cell.note ?? `combo ${key}`}
            >
              <span
                className="flags-pane__cell-risk"
                style={{ backgroundColor: `rgba(229, 72, 77, ${riskAlpha.toFixed(3)})` }}
                aria-hidden
              />
              <span className="flags-pane__cell-bits">{key}</span>
              <span
                className={`flags-pane__cell-dot flags-pane__cell-dot--${cell.covered}`}
                aria-label={COVERED_LABEL[cell.covered]}
              />
              {cell.reachable && (
                <span className="flags-pane__cell-risk-n">{cell.riskScore}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flags-pane__detail">
        {selected ? (
          <>
            <div className="flags-pane__detail-head">
              <span className="flags-pane__detail-bits">
                {comboBitstring(flags, selected.combo)}
              </span>
              <span
                className={`flags-pane__detail-cov flags-pane__detail-cov--${selected.covered}`}
              >
                {COVERED_LABEL[selected.covered]}
              </span>
              {!selected.reachable && (
                <span className="flags-pane__detail-dead">dead combo</span>
              )}
              <span className="flags-pane__detail-count">
                {selected.activeLines.length} active lines
              </span>
            </div>
            {selected.activeLines.length > 0 && (
              <div className="flags-pane__lines">
                {selected.activeLines.slice(0, 5).map((ln) => (
                  <span key={ln} className="flags-pane__line-chip">
                    L:{ln}
                  </span>
                ))}
                {selected.activeLines.length > 5 && (
                  <span className="flags-pane__line-more">
                    +{selected.activeLines.length - 5}
                  </span>
                )}
              </div>
            )}
            {selected.note && <div className="flags-pane__detail-note">{selected.note}</div>}
          </>
        ) : (
          <div className="flags-pane__detail-empty">
            Click a cell to inspect the combo.
          </div>
        )}
      </div>

      <div className="flags-pane__foot">
        Dead combos: {deadCount} · Total combos: {total} · Coverage: {coveragePct}%
      </div>
    </div>
  );
}
