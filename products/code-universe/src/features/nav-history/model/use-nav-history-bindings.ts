import { useEffect } from "react";
import { entityStore } from "../../../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { navHistoryStore } from "./store";

// Wire the navigation-history store to the live state:
//   - Record every (tier, selectedId) change as a history push.
//   - Bind Alt+← / Alt+→ / ⌘+Alt+← / ⌘+Alt+→ to back/forward.
//   - Restoration path uses `suppressNextPush` inside the store so
//     re-dispatching through tierStore/entityStore doesn't re-push.
//
// Call once at orchestrator level (CodeUniverse). Returns void; all
// effects clean themselves up on unmount.

export function useNavHistoryBindings(enabled = true): void {
  // Seed the initial entry so `back()` has something to return to
  // before the user has navigated even once.
  useEffect(() => {
    if (!enabled) return;
    navHistoryStore.push({
      tier: tierStore.getState().activeTier.name,
      selectedId: entityStore.getState().interaction.selectedId,
    });
  }, [enabled]);

  // Record tier changes.
  useEffect(() => {
    if (!enabled) return;
    return tierStore.subscribe(() => {
      navHistoryStore.push({
        tier: tierStore.getState().activeTier.name,
        selectedId: entityStore.getState().interaction.selectedId,
      });
    });
  }, [enabled]);

  // Record selection changes (but not hover — too noisy).
  useEffect(() => {
    if (!enabled) return;
    let lastSelectedId = entityStore.getState().interaction.selectedId;
    return entityStore.subscribe(() => {
      const nextId = entityStore.getState().interaction.selectedId;
      if (nextId === lastSelectedId) return;
      lastSelectedId = nextId;
      navHistoryStore.push({
        tier: tierStore.getState().activeTier.name,
        selectedId: nextId,
      });
    });
  }, [enabled]);

  // Keyboard: Alt+← / Alt+→ for back / forward. We deliberately skip
  // the binding when focus is inside an <input> / <textarea> so the
  // OS default (caret moves word-by-word under Alt+arrow) is never
  // stolen. The shortcut bar in the footer shows users the mapping.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!e.altKey) return;
      const target = e.target as Element | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        restore(navHistoryStore.back());
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        restore(navHistoryStore.forward());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

function restore(entry: ReturnType<typeof navHistoryStore.back>): void {
  if (!entry) return;
  const spec = DEFAULT_TIER_LADDER.find(t => t.name === entry.tier);
  // Restore selection first so the tier change effect lands on a
  // tree with the intended anchor already set.
  entityStore.selectEntity(entry.selectedId);
  if (spec) tierStore.jumpToTier(spec.name);
}
