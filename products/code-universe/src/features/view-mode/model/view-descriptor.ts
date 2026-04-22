// View descriptor contract.
// --------------------------------------------------------------------
// One descriptor = one view mode's complete public surface: metadata
// (label/glyph/hint/category), eligibility (contexts/needs), cycle
// order, activation side-effects, and the React component that renders
// it into the canvas area.
//
// The shell reads descriptors from the registry; it does not know
// about individual view modes. Adding a new mode = add one descriptor
// + register it. Removing a mode = remove its file + registry entry.
// No other touch points.

import type { ReactElement } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import type { ViewMode } from "./store";

// ── Categorisation + eligibility ──────────────────────────────────────

export type ViewCtx = "repo" | "folder" | "file";

export type ViewCategory = "explore" | "deps" | "history" | "plan" | "arch" | "metrics" | "refactor" | "quality" | "security" | "team" | "ai";

// ── Dispatch — the uniform side-effects any view may trigger ──────────

export interface ViewDispatch {
  /** Primary entity selection. Used for clicks on files/nodes. */
  selectEntity: (id: string | null) => void;
  /** Open the mind-map overlay on an entity — used by cross-view pivots
   *  ("jump from chord arc into mindmap of that file"). */
  openMindMapOn: (id: string) => void;
  /** Close the mind-map overlay (no-op if not open). */
  closeMindMap: () => void;
  /** Switch the active view mode. Fires onDeactivate + onActivate. */
  setMode: (m: ViewMode) => void;
}

// ── Context — the single prop bag every descriptor receives ───────────

export interface ViewContextValue {
  /** Workspace dependency graph — null while loading. */
  graph: WorkspaceGraph | null;
  /** Entity tree (folders/files/symbols) — null while loading. */
  tree: EntityTree | null;
  /** Primary selection id (entity / file). */
  selectedId: string | null;
  /** Focus anchor id — sticky scope set by Explorer / drill-in. */
  anchorId: string | null;
  /** Current viewport pixel size. */
  viewportSize: { w: number; h: number };
  /** Host-supplied tab id for per-tab persistence (camera pose). */
  tabId: string | undefined;
  /** Side-effect dispatchers — stable identity within a session. */
  dispatch: ViewDispatch;
}

// ── Descriptor shape ──────────────────────────────────────────────────

export interface ViewDescriptorNeeds {
  /** View cannot render without an entity tree. Picker marks it pending. */
  tree?: boolean;
  /** View cannot render without a workspace graph. */
  graph?: boolean;
  /** View is egocentric — requires a primary selection. Picker disables
   *  the option if no selection is active (outside of its valid contexts). */
  selection?: boolean;
}

export interface ViewDescriptor {
  /** Stable machine id. Matches the `ViewMode` union entry. */
  id: ViewMode;
  /** Short UI label (mono-rendered in the picker). */
  label: string;
  /** Unicode glyph used in the dropdown trigger + picker rows. */
  glyph: string;
  /** One-line "what is this view" description. */
  hint: string;
  /** One-line "how it's computed" subtitle (tooltip on the picker row). */
  tech: string;
  /** Longer "when to reach for this" copy shown in the picker detail. */
  usecase: string;
  /** Picker grouping. */
  category: ViewCategory;
  /** Contexts where this mode is useful. Picker filters by current ctx. */
  contexts: readonly ViewCtx[];
  /** Data dependencies. */
  needs?: ViewDescriptorNeeds;
  /** Cycle + picker display order (lower = earlier). Does not have to
   *  be dense; gaps are fine. Uniqueness is not enforced — ties resolve
   *  by registration order. */
  order: number;
  /** How the shell should frame this view.
   *  - "base": mount directly into the viewport (treemap = Pixi canvas).
   *  - "overlay": wrap in a translucent full-bleed overlay above the base.
   *  Default: "overlay". */
  overlay?: "base" | "overlay";
  /** Fired when this mode becomes active. Use for opening stores the
   *  view relies on (e.g. mindmap opens its store on the current selection). */
  onActivate?: (ctx: ViewContextValue) => void;
  /** Fired when the user is leaving this mode. Symmetric to onActivate —
   *  use to tear down stores opened on entry. */
  onDeactivate?: (ctx: ViewContextValue) => void;
  /** React component that renders the view. Gets the full context as
   *  a single prop. Returns `null` while its requirements are loading
   *  — the shell will show a generic "waiting for workspace graph"
   *  placeholder only for the base view; overlays stay blank until ready. */
  Component: (props: { ctx: ViewContextValue }) => ReactElement | null;
}
