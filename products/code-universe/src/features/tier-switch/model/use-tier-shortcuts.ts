import { useEffect } from "react";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { entityStore } from "../../../entities/entity";

// Tier keyboard shortcuts
// --------------------------------------------------------------------
// Power-user navigation without touching the mouse.
//
//   ⌘/Ctrl + ]         drill IN one tier (universe → galaxy → street → building)
//   ⌘/Ctrl + [         drill OUT one tier (building → street → galaxy → universe)
//   ⌘/Ctrl + 1..4      jump to tier N directly (1 = universe, 4 = building)
//
// Installed at orchestrator level so the bindings work regardless of
// which sub-widget has focus. We ignore the keystroke when the focus
// is inside an <input> or <textarea> so the palette's search field
// (and any future rename affordance) keeps its natural editing keys.

export function useTierShortcuts(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as Element | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      const key = e.key;
      if (key === "]") {
        e.preventDefault();
        drillOneStep(+1);
        return;
      }
      if (key === "[") {
        e.preventDefault();
        drillOneStep(-1);
        return;
      }
      // Cmd+1..6 → tier 1-indexed by depth. `e.key === "1"` only fires
      // on the main number row / non-US layouts where digits map
      // straightforwardly; we guard for exact single-digit strings.
      if (key.length === 1 && key >= "1" && key <= "4") {
        const idx = parseInt(key, 10) - 1;
        const spec = DEFAULT_TIER_LADDER[idx];
        if (spec) {
          e.preventDefault();
          tierStore.jumpToTier(spec.name);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

function drillOneStep(direction: 1 | -1): void {
  const curName = tierStore.getState().activeTier.name;
  const curIdx = DEFAULT_TIER_LADDER.findIndex(t => t.name === curName);
  if (curIdx < 0) return;
  const nextIdx = curIdx + direction;
  const next = DEFAULT_TIER_LADDER[nextIdx];
  if (!next) return;
  // Drilling OUT clears a stale selection so the user doesn't land on
  // a now-invisible anchor. Drilling IN preserves selection so the
  // palette-picked entity stays pinned as you zoom further.
  if (direction === -1) entityStore.selectEntity(null);
  tierStore.jumpToTier(next.name);
}
