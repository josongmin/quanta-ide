import { useEffect, useRef } from "react";
import { useTabRoute } from "@quanta/shell-contract";
import { entityStore } from "../entities/entity";
import { tierStore, DEFAULT_TIER_LADDER } from "../entities/tier";
import { isKnownViewMode, viewModeStore, type ViewMode } from "../features/view-mode";

// URL state sync
// --------------------------------------------------------------------
// Two-way bind the Code Universe's "where am I" state to the tab's
// query string. The URL is authoritative across sessions/shares; the
// localStorage viewport-persistence still handles *camera* state
// (translation + scale) which is intentionally NOT in the URL — too
// high-frequency to spam history entries with, and meaningless to
// another user opening a shared link.
//
// Direction 1: URL → stores (on mount, and on external hash changes).
// Direction 2: stores → URL (on every store emit, as replaceState so
//   canvas clicks don't pollute browser history).

const DEFAULT_MODE: ViewMode = "treemap";

/**
 * Bind view-mode, tier, and selection to `?mode=&tier=&sel=` query
 * params on the active tab's hash. Call from the Code Universe product
 * orchestrator *after* the graph-restore effect so URL values override
 * any localStorage-restored defaults.
 */
export function useCodeUniverseUrlSync(): void {
  const { query, patchQuery } = useTabRoute();

  // Keep latest patcher reachable from subscribers without re-subscribing.
  const patchRef = useRef(patchQuery);
  patchRef.current = patchQuery;

  // Track whether our own store→URL writes are in flight so the URL→store
  // effect can suppress redundant re-applies. Cheap guard, not a hard lock.
  const echoRef = useRef({ mode: "", tier: "", sel: "" });

  // Direction 1: URL → stores.
  useEffect(() => {
    const modeQ = query.mode;
    if (modeQ && isKnownViewMode(modeQ)) {
      if (echoRef.current.mode !== modeQ) viewModeStore.setMode(modeQ as ViewMode);
    } else if (!modeQ && viewModeStore.getState().mode !== DEFAULT_MODE) {
      // Mode key removed from URL (e.g. back/forward to a URL without it)
      // → fall back to default so the view doesn't stay stuck on the old
      // mode from before the navigation.
      viewModeStore.setMode(DEFAULT_MODE);
    }

    const tierQ = query.tier;
    if (tierQ && tierQ !== tierStore.getState().activeTier.name) {
      const spec = DEFAULT_TIER_LADDER.find((t) => t.name === tierQ);
      if (spec) tierStore.jumpToTier(spec.name);
    }

    const selQ = query.sel;
    if (selQ) {
      const tree = entityStore.getState().tree;
      if (tree?.byId.has(selQ) && entityStore.getState().interaction.selectedId !== selQ) {
        entityStore.selectEntity(selQ);
      }
    } else if (entityStore.getState().interaction.selectedId !== null) {
      // `sel` removed from URL → clear selection so shared `#/universe`
      // links don't silently inherit the recipient's prior selection.
      entityStore.selectEntity(null);
    }
  }, [query.mode, query.tier, query.sel]);

  // Direction 2: stores → URL. Subscribes once per mount; writes land
  // via patchRef so we never tear down the subscription.
  useEffect(() => {
    const writeMode = () => {
      const mode = viewModeStore.getState().mode;
      echoRef.current.mode = mode;
      patchRef.current({ mode: mode === DEFAULT_MODE ? undefined : mode });
    };
    const writeTier = () => {
      const tier = tierStore.getState().activeTier.name;
      echoRef.current.tier = tier;
      patchRef.current({ tier });
    };
    const writeSel = () => {
      const sel = entityStore.getState().interaction.selectedId;
      echoRef.current.sel = sel ?? "";
      patchRef.current({ sel: sel ?? undefined });
    };

    const u1 = viewModeStore.subscribe(writeMode);
    const u2 = tierStore.subscribe(writeTier);
    const u3 = entityStore.subscribe(writeSel);

    // Flush initial store state to URL so localStorage-restored tier /
    // selection shows up in shareable form. Default mode stays omitted.
    writeTier();
    if (viewModeStore.getState().mode !== DEFAULT_MODE) writeMode();
    if (entityStore.getState().interaction.selectedId) writeSel();

    return () => {
      u1();
      u2();
      u3();
    };
  }, []);
}
