import { useEffect, type ReactElement, type ReactNode } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { parseHash } from "@quanta/shell-contract";
import { buildEntityTree, entityStore } from "../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../entities/tier";
import {
  setWorkspaceGraph,
  useWorkspaceGraph,
} from "../shared/api/graph-source";
import { MOCK_GRAPH } from "../shared/config/mock-graph";
import { CanvasShell } from "../widgets/canvas-shell";
import { viewModeStore } from "../features/view-mode";
import { loadViewport } from "../shared/api/viewport-persistence";
import { useCodeUniverseUrlSync } from "./use-url-state-sync";
import {
  CommandPalette,
  useCommandPaletteShortcut,
} from "../features/command-palette";
import { useTierShortcuts } from "../features/tier-switch";
import { useNavHistoryBindings } from "../features/nav-history";
import {
  KeyboardHints,
  useKeyboardHintsShortcut,
} from "../features/keyboard-hints";
import { ToastHost } from "../features/toast";
import { useStickyShortcut } from "../features/stickies";
import { ensureA11yStyles } from "../shared/ui/a11y-styles";
import { consumeUniverseLaunch } from "./universe-launch";

// CodeUniverse
// --------------------------------------------------------------------
// Product composition root. Three ways the graph can arrive:
//   1. Via the `graph` prop (host passes it directly on mount).
//   2. Via `setWorkspaceGraph(g)` from the host at any time — the
//      orchestrator subscribes to `useWorkspaceGraph` and reacts.
//   3. Neither — we fall back to `MOCK_GRAPH` from shared/config so
//      the product is usable bare (Storybook, bare Vite, demo).
//
// Store lifecycle: entity + tier stores reset on unmount so a later
// re-mount (e.g. re-opening the universe tab) starts clean. Global
// graph source is left intact — the host owns it.

export interface CodeUniverseProps {
  /** Tab-bus wiring from the shell registry. Unused in 3B but part
   *  of the TabAppDescriptor contract. */
  tabId?: string;
  /** When false, the host has switched to another tab. Future Pixi
   *  ticker will pause on this. */
  isActive?: boolean;
  /** Optional direct graph injection (bypasses the module singleton). */
  graph?: WorkspaceGraph;
  /** Slot for host-injected providers. */
  children?: ReactNode;
}

export function CodeUniverse(props: CodeUniverseProps): ReactElement {
  const moduleGraph = useWorkspaceGraph();
  // Prop wins if present, else module singleton, else mock.
  const effective = props.graph ?? moduleGraph ?? MOCK_GRAPH;

  // Publish the resolved graph into the module singleton so every
  // downstream consumer (CanvasShell, inspectors, future pinned panels)
  // sees the same source as the entity-tree builder below. Without
  // this, a MOCK_GRAPH fallback would power the tree but leave
  // `useWorkspaceGraph()` at null, stranding CanvasShell on its
  // "waiting for workspace graph…" gate. `setWorkspaceGraph` is
  // ref-equality guarded, so the feedback loop through our own
  // `moduleGraph` subscription is a no-op after the first publish.
  useEffect(() => {
    setWorkspaceGraph(effective);
  }, [effective]);

  // Rebuild the entity tree whenever the effective graph changes.
  // Restore any previously-persisted selection on first build for
  // this tabId so returning to the tab lands the user on their
  // last pinned entity (if it still exists in the new tree).
  //
  // URL query wins over localStorage when both are present — a shared
  // link must land the recipient on exactly what the sender saw, not
  // on whatever their own localStorage had. `useCodeUniverseUrlSync`
  // below re-applies URL state after this effect runs.
  useEffect(() => {
    const tree = buildEntityTree(effective);
    entityStore.setTree(tree);
    const urlQuery = parseHash().query;
    const urlHasViewState = !!(urlQuery.mode || urlQuery.tier || urlQuery.sel);
    if (urlHasViewState) return;

    const launch = consumeUniverseLaunch();
    if (launch) {
      if (launch.tier) {
        const tierSpec = DEFAULT_TIER_LADDER.find(t => t.name === launch.tier);
        if (tierSpec) tierStore.jumpToTier(tierSpec.name);
      }
      if (launch.selectedId && tree.byId.has(launch.selectedId)) {
        entityStore.selectEntity(launch.selectedId);
      }
      if (launch.mode) viewModeStore.setMode(launch.mode);
      return;
    }

    const saved = loadViewport(props.tabId);
    if (saved) {
      // Tier: restore only if the saved name still maps to a spec.
      const tierSpec = DEFAULT_TIER_LADDER.find(t => t.name === saved.tier);
      if (tierSpec) tierStore.jumpToTier(tierSpec.name);
      // Selection: restore only if the entity is still in the tree
      // (graph swaps may have pruned it).
      if (saved.selectedId && tree.byId.has(saved.selectedId)) {
        entityStore.selectEntity(saved.selectedId);
      }
    }
  }, [effective, props.tabId]);

  // Bind view-mode, tier, and selection to the tab's URL query.
  // Registers after the restore effect above so URL values overwrite
  // any localStorage-restored defaults on mount.
  useCodeUniverseUrlSync();

  useEffect(() => {
    return () => {
      tierStore.reset();
      entityStore.reset();
    };
  }, []);

  // ⌘K / Ctrl+K opens the command palette. Bound at the orchestrator
  // level so the shortcut works regardless of which sub-widget has
  // focus. Disable automatically if the tab is inactive so Cmd+K in
  // another tab doesn't flash our palette behind theirs.
  useCommandPaletteShortcut(props.isActive !== false);
  useTierShortcuts(props.isActive !== false);
  useNavHistoryBindings(props.isActive !== false);
  useKeyboardHintsShortcut(props.isActive !== false);
  useStickyShortcut(props.isActive !== false);

  // Inject the a11y stylesheet once — idempotent, scoped under
  // `[data-product="code-universe"]` so it doesn't leak into the
  // host shell. Adds focus-visible rings on every button/input and
  // respects `prefers-reduced-motion`.
  useEffect(() => {
    ensureA11yStyles();
  }, []);

  return (
    <>
      <CanvasShell tabId={props.tabId} />
      <CommandPalette />
      <KeyboardHints />
      <ToastHost />
    </>
  );
}
