import { useMemo } from "react";
import {
  actionTerrainStore,
  useActionTerrainStore,
  ACTION_TERRAIN_HEIGHT_RANGE,
} from "../../store/action-terrain-store";
import { useActionTerrain } from "../../hooks/use-action-terrain";
import { useFeature, featureFlagsStore } from "../../store/feature-flags-store";

// Action Terrain HUD panel — mode toggle, height slider, cone direction
// select, and a compact top-5 ROI table. Intended to mirror SceneSection /
// GraphSection styling so the HUD stays visually uniform.

const TOP_N = 5;

function basename(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

export function ActionTerrainSection() {
  const on = useFeature("action-terrain.mode");
  const mode = useActionTerrainStore(s => s.mode);
  const heightScale = useActionTerrainStore(s => s.heightScale);
  const coneDirection = useActionTerrainStore(s => s.coneDirection);
  const result = useActionTerrain();

  const top = useMemo(() => {
    if (!result.enabled) return [];
    return result.roi.ordered.slice(0, TOP_N);
  }, [result]);

  return (
    <>
      <div className="ws-debug__divider">action terrain</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={on}
          onChange={e => featureFlagsStore.setFlag("action-terrain.mode", e.target.checked)}
        />
        <span>feature enabled</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={mode}
          disabled={!on}
          onChange={e => actionTerrainStore.setMode(e.target.checked)}
        />
        <span>iso mode on (⌘⇧A)</span>
      </label>
      <div className="ws-debug__row" style={{ alignItems: "center" }}>
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>height</span>
        <input
          type="range"
          min={ACTION_TERRAIN_HEIGHT_RANGE.min}
          max={ACTION_TERRAIN_HEIGHT_RANGE.max}
          step={0.05}
          value={heightScale}
          onChange={e => actionTerrainStore.setHeightScale(parseFloat(e.target.value))}
          disabled={!mode}
          style={{ flex: 1 }}
        />
        <span style={{ flex: "0 0 42px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {heightScale.toFixed(2)}×
        </span>
      </div>
      <div className="ws-debug__row" style={{ alignItems: "center" }}>
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>cone dir</span>
        <div className="ws-debug__lod" style={{ gap: 2, flex: 1 }}>
          {(["blast", "fix"] as const).map(d => (
            <button
              key={d}
              type="button"
              className={`ws-debug__chip${coneDirection === d ? " is-on" : ""}`}
              onClick={() => actionTerrainStore.setConeDirection(d)}
              disabled={!mode}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {!result.enabled ? (
        <div className="ws-debug__hint">mode is off — toggle ⌘⇧A.</div>
      ) : top.length === 0 ? (
        <div className="ws-debug__hint">no ROI scores yet (graph not loaded).</div>
      ) : (
        <>
          <div className="ws-debug__divider">top-{top.length} ROI</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
            {top.map(s => (
              <div
                key={s.fileId}
                className="ws-debug__sticky-row"
                title={s.fileId}
                onClick={() => actionTerrainStore.selectFile(s.fileId)}
              >
                <span className="ws-debug__sticky-text">
                  #{s.rank} {basename(s.fileId)}
                </span>
                <span
                  style={{
                    flex: "0 0 58px",
                    height: 6,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${Math.max(2, s.score)}%`,
                      height: "100%",
                      background: "var(--ws-roi-hot)",
                    }}
                  />
                </span>
                <span
                  style={{
                    flex: "0 0 30px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(s.score)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
