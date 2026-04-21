import type { CSSProperties, ReactElement } from "react";
import { useViewMode, viewModeStore, type ViewMode } from "../model/store";
import { entityStore, useEntityState } from "../../../entities/entity";
import { mindMapStore } from "../../mind-map";
import { color, font, radius, space } from "../../../shared/ui/tokens";

// ViewModePicker — segmented control that flips the canvas between
// treemap (spatial containment), mind-map (radial egocentric), and
// chord (hierarchical edge bundling). Lives inside CanvasToolbar so
// the toggle sits with the other workspace-scope controls.
//
// Mind-map is a special case: it's actually an overlay driven by its
// own enable + centre flags. Picking "mindmap" here opens the overlay
// on the current selection; deselecting falls through. The store
// keeps the last-picked mode so a round-trip doesn't forget the user
// was in chord view before they briefly bounced to treemap.

const OPTIONS: readonly { value: ViewMode; label: string; hint: string }[] = [
  { value: "treemap",          label: "Tree",      hint: "Spatial containment (tier-based)" },
  { value: "mindmap",          label: "Mind",      hint: "Egocentric relationships (M)" },
  { value: "chord",            label: "Chord",     hint: "Package-to-package coupling" },
  { value: "matrix",           label: "Matrix",    hint: "DSM — dependency grid" },
  { value: "quadrant",         label: "Quad",      hint: "Churn × Risk 2×2 scatter" },
  { value: "arc-cycles",       label: "Cycles",    hint: "Arc diagram — backward edges = cycles" },
  { value: "embedding",        label: "Embed",     hint: "Structural similarity 2D map" },
  { value: "blast",            label: "Blast",     hint: "Impact blast radius from selection" },
  { value: "arch-layers",      label: "Layers",    hint: "Architecture layer dependency flow" },
  { value: "debt-history",     label: "Debt",      hint: "Technical debt trajectory over time" },
  { value: "refactor-terrain", label: "Refactor",  hint: "ROI-ranked refactor action list" },
  { value: "cycle-genesis",    label: "Cycles↗",   hint: "Cycle birth timeline — when each cycle was introduced" },
  { value: "smell-history",    label: "Smells",    hint: "Code smell genesis — when smells first appeared" },
  { value: "arch-drift",       label: "Drift",     hint: "Architecture drift — baseline vs HEAD comparison" },
  { value: "cochange",         label: "CoChange",  hint: "Co-change heatmap — files that evolve together" },
  { value: "refactor-sim",     label: "Simulate",  hint: "Refactor simulator — projected impact of each plan" },
  { value: "start-here",       label: "StartHere", hint: "Journey map — where to begin your codebase tour" },
  { value: "pathfinder",       label: "Path",      hint: "Pathfinding — dependency routes between two files" },
  { value: "neighborhood",     label: "Halo",      hint: "Neighborhood halo — N-hop relationship ring" },
  { value: "author-territory", label: "Authors",   hint: "Author territory — ownership map by blame" },
  { value: "service-topo",     label: "Services",  hint: "Service topology — inter-package dependency map" },
];

const WRAP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  padding: 2,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  gap: 2,
  maxWidth: 900,
};

const CHIP_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `${space[1]}px ${space[3]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  fontFamily: font.sans,
  letterSpacing: -0.05,
  borderRadius: radius.pill,
  border: "1px solid transparent",
  background: "transparent",
  color: color.text2,
  cursor: "pointer",
  transition: "background 120ms, color 120ms, border-color 120ms",
  whiteSpace: "nowrap",
};

const CHIP_ACTIVE: CSSProperties = {
  ...CHIP_BASE,
  background: color.bg0,
  color: color.text0,
  borderColor: color.border,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

export function ViewModePicker(): ReactElement {
  const mode = useViewMode(s => s.mode);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const tree = useEntityState(s => s.tree);

  const pick = (next: ViewMode): void => {
    viewModeStore.setMode(next);
    // Mind-map is an overlay — switching to it raises the overlay flag.
    // Prefer the current selection; fall back to the universe root so
    // the picker is never a dead end (a zero-state mindmap reads as
    // broken even when it's "correct").
    if (next === "mindmap") {
      const sel = selectedId ?? entityStore.getState().interaction.selectedId;
      const target = sel ?? tree?.rootId ?? null;
      if (target) mindMapStore.openOn(target);
    } else {
      // Leaving mindmap — close the overlay so the user sees the new
      // mode's canvas uncovered. Keeps the centre id so coming back is
      // a single click.
      mindMapStore.close();
    }
  };

  return (
    <div role="radiogroup" aria-label="View mode" style={WRAP}>
      {OPTIONS.map(opt => {
        const active = mode === opt.value;
        // Mindmap needs *some* entity to centre on; the tree root is
        // always present once the workspace loads, so the only disabled
        // state is "no tree yet" (boot flash).
        const disabled =
          (opt.value === "mindmap" || opt.value === "blast" ||
           opt.value === "neighborhood" || opt.value === "pathfinder") && !tree;
        const style = active ? CHIP_ACTIVE : CHIP_BASE;
        const hint = opt.value === "mindmap" && !selectedId
          ? `${opt.hint} — centers on repo when nothing is selected`
          : opt.hint;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={disabled ? `${opt.hint} — workspace still loading` : hint}
            onClick={() => !disabled && pick(opt.value)}
            style={{
              ...style,
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
