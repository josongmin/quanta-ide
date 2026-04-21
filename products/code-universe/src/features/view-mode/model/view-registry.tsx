// View registry — one flat list of ViewDescriptors that everything
// else reads.
// --------------------------------------------------------------------
// This is the single hinge of the view-mode architecture. Every place
// that used to hard-code a per-mode branch now asks the registry:
//
//   - CanvasShell   → which Component to mount, and in what wrapper
//   - ViewModePicker → label / glyph / hint / contexts / needs
//   - Cycle / switch → activation + deactivation side-effects
//   - URL sync       → valid view-mode ids
//
// Adding a new view mode = write one `features/<name>/view.tsx`
// descriptor file, re-export it from that feature's `index.ts`, and
// drop its name into the ALL list below. No other touch points.

import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ViewContextValue, ViewDescriptor } from "./view-descriptor";
import type { ViewMode } from "./store";
import { viewModeStore } from "./store";

// Feature-side descriptors — each feature exposes a single exported
// ViewDescriptor from its public barrel. Listed in picker + cycle order
// (numeric `order` on each descriptor still authoritative — the import
// order here is cosmetic).

import { universeViewDescriptor }       from "../../universe-view";
import { mindMapViewDescriptor }        from "../../mind-map";
import { chordViewDescriptor }          from "../../chord-view";
import { matrixViewDescriptor }         from "../../matrix-view";
import { quadrantViewDescriptor }       from "../../quadrant-view";
import { arcViewDescriptor }            from "../../arc-view";
import { embeddingViewDescriptor }      from "../../embedding-map";
import { blastViewDescriptor }          from "../../blast-view";
import { archLayerViewDescriptor }      from "../../arch-layer-view";
import { debtChartViewDescriptor }      from "../../debt-chart";
import { refactorTerrainViewDescriptor } from "../../refactor-terrain";
import { cycleGenesisViewDescriptor }   from "../../cycle-genesis";
import { smellHistoryViewDescriptor }   from "../../smell-history";
import { archDriftViewDescriptor }      from "../../arch-drift";
import { coChangeViewDescriptor }       from "../../cochange";
import { refactorSimViewDescriptor }    from "../../refactor-sim";
import { startHereViewDescriptor }      from "../../start-here";
import { pathfinderViewDescriptor }     from "../../pathfinder";
import { neighborhoodViewDescriptor }   from "../../neighborhood";
import { authorTerritoryViewDescriptor } from "../../author-territory";
import { serviceTopoViewDescriptor }    from "../../service-topo";
import { galaxy3DViewDescriptor }       from "../../galaxy-3d";

// Canonical list — sorted by `order` so picker / cycle / dropdown all
// agree on the sequence. The `order` field on each descriptor is the
// single source of truth; the import order above is irrelevant.
const ALL: readonly ViewDescriptor[] = [
  universeViewDescriptor,
  mindMapViewDescriptor,
  chordViewDescriptor,
  matrixViewDescriptor,
  quadrantViewDescriptor,
  arcViewDescriptor,
  embeddingViewDescriptor,
  blastViewDescriptor,
  archLayerViewDescriptor,
  debtChartViewDescriptor,
  refactorTerrainViewDescriptor,
  cycleGenesisViewDescriptor,
  smellHistoryViewDescriptor,
  archDriftViewDescriptor,
  coChangeViewDescriptor,
  refactorSimViewDescriptor,
  startHereViewDescriptor,
  pathfinderViewDescriptor,
  neighborhoodViewDescriptor,
  authorTerritoryViewDescriptor,
  serviceTopoViewDescriptor,
  galaxy3DViewDescriptor,
];

export const VIEW_DESCRIPTORS: readonly ViewDescriptor[] = [...ALL].sort(
  (a, b) => a.order - b.order,
);

const byId = new Map<ViewMode, ViewDescriptor>(
  VIEW_DESCRIPTORS.map(d => [d.id, d]),
);

// Duplicate-id guard — catches copy-paste mistakes at module load
// instead of silently letting one descriptor shadow another.
if (byId.size !== VIEW_DESCRIPTORS.length) {
  const seen = new Set<ViewMode>();
  const dupes: ViewMode[] = [];
  for (const d of VIEW_DESCRIPTORS) {
    if (seen.has(d.id)) dupes.push(d.id);
    seen.add(d.id);
  }
  throw new Error(`Duplicate view descriptor ids: ${dupes.join(", ")}`);
}

// ── Lookup helpers ────────────────────────────────────────────────────

export function getViewDescriptor(id: ViewMode): ViewDescriptor {
  const d = byId.get(id);
  if (!d) throw new Error(`Unknown view mode: ${id}`);
  return d;
}

export function listViewDescriptors(): readonly ViewDescriptor[] {
  return VIEW_DESCRIPTORS;
}

export function isKnownViewMode(id: string): id is ViewMode {
  return byId.has(id as ViewMode);
}

// ── Transition helpers — symmetric activate / deactivate contract ─────

/** Switch the active view mode and run any side-effects the two
 *  descriptors declare. Caller owns the `ctx` it passes — typically the
 *  one derived by CanvasShell and exposed to the picker / hotkeys via
 *  a context provider. No-op if already on `next`. */
export function switchMode(next: ViewMode, ctx: ViewContextValue): void {
  const current = viewModeStore.getState().mode;
  if (current === next) return;
  // Deactivate first so the outgoing view's teardown runs against the
  // still-authoritative context. Then flip the store. Then activate —
  // so subscribers reading `viewModeStore.getState().mode` during
  // onActivate see the new mode.
  getViewDescriptor(current).onDeactivate?.(ctx);
  viewModeStore.setMode(next);
  getViewDescriptor(next).onActivate?.(ctx);
}

/** Cycle to the next mode in descriptor order. Wraps around. */
export function cycleMode(ctx: ViewContextValue): void {
  const order = VIEW_DESCRIPTORS.map(d => d.id);
  const i = order.indexOf(viewModeStore.getState().mode);
  const next = order[(i + 1) % order.length];
  if (next !== undefined) switchMode(next, ctx);
}

// ── React glue — ctx provider for non-shell consumers (picker, hotkeys) ─
//
// CanvasShell owns the ViewContextValue construction (it has all the
// raw inputs — graph, tree, viewport size, dispatch). It publishes the
// current ctx via this Provider so the picker and any future hotkey
// surfaces can call `switchMode(next, ctx)` without re-threading every
// store dependency.

const ViewCtxReact = createContext<ViewContextValue | null>(null);

export function ViewContextProvider({
  value,
  children,
}: {
  value: ViewContextValue;
  children: ReactNode;
}): ReactElement {
  return <ViewCtxReact.Provider value={value}>{children}</ViewCtxReact.Provider>;
}

/** Read the live ViewContextValue inside any component mounted below
 *  CanvasShell. Throws if called outside the provider — that means the
 *  caller is running before the shell mounted, which is a bug. */
export function useViewContext(): ViewContextValue {
  const v = useContext(ViewCtxReact);
  if (!v) {
    throw new Error(
      "useViewContext() called outside ViewContextProvider. " +
        "Only components mounted under CanvasShell may read the ctx.",
    );
  }
  return v;
}
