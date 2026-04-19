import { useFeature } from "../../store/feature-flags-store";
import {
  actionTerrainStore,
  useActionTerrainStore,
  ACTION_TERRAIN_HEIGHT_RANGE,
} from "../../store/action-terrain-store";

// Floating "Enter / Exit Action Terrain" button. When the mode is on, a
// compact height slider appears next to the button so the user can adjust
// bar Z-extrusion without opening the HUD.

export function ActionTerrainToggle() {
  const gate = useFeature("action-terrain.mode");
  const mode = useActionTerrainStore(s => s.mode);
  const heightScale = useActionTerrainStore(s => s.heightScale);

  if (!gate) return null;

  return (
    <div
      className="ws-action-terrain-toggle-wrap"
      onMouseDownCapture={e => e.stopPropagation()}
      onPointerDownCapture={e => e.stopPropagation()}
    >
      {/* Polite announcement for screen readers — fires on mode change so
          blind users get the same "the layout just changed drastically"
          cue sighted users get visually. */}
      <div className="sr-only" aria-live="polite" role="status">
        {mode ? "Action Terrain mode entered — refactor ROI topography visible." : ""}
      </div>
      <button
        type="button"
        className="ws-action-terrain-toggle"
        aria-pressed={mode}
        onClick={() => actionTerrainStore.toggleMode()}
        title={mode ? "Exit Action Terrain (⌘⇧A)" : "Enter Action Terrain (⌘⇧A)"}
      >
        <span className="ws-action-terrain-toggle__icon" aria-hidden>
          ▲
        </span>
        <span className="ws-action-terrain-toggle__label">
          {mode ? "Exit Action Terrain" : "Enter Action Terrain"}
        </span>
      </button>
      {mode && (
        <label className="ws-action-terrain-toggle__slider" title="Bar height scale">
          <span>height</span>
          <input
            type="range"
            min={ACTION_TERRAIN_HEIGHT_RANGE.min}
            max={ACTION_TERRAIN_HEIGHT_RANGE.max}
            step={0.05}
            value={heightScale}
            onChange={e => actionTerrainStore.setHeightScale(parseFloat(e.target.value))}
          />
          <span className="ws-action-terrain-toggle__value">{heightScale.toFixed(2)}×</span>
        </label>
      )}
    </div>
  );
}
