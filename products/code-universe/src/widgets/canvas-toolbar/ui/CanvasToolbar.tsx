import type { CSSProperties, ReactElement } from "react";
import { TierBreadcrumb } from "../../../features/tier-switch";
import { KindFilterPanel } from "../../../features/kind-filter";
import { LayoutWeightPicker } from "../../../features/layout-weight";
import { color, radius, shadow, space } from "../../../shared/ui/tokens";

// CanvasToolbar — floating bottom-center tool cluster, Figma-style.
//
// Why moved out of the top header: the shell header has to share
// space with the product title, drill path, scale readout, and the
// two sidebar toggles; cramming six tier chips + six kind chips +
// four weight chips into the same row forced wrapping and visual
// noise. Pulling these into a floating cluster gives them breathing
// room, groups semantically-related controls with dividers, and
// matches the convention users already know from Figma / Linear /
// Canvas design tools — "workspace tools live at the bottom."
//
// Positioning is `absolute, bottom: 20px, left: 50%` inside the
// viewport region, so it stays centered over the Pixi canvas but
// never clips the Inspector or the Explorer. backdrop-blur lets the
// toolbar float legibly over busy heatmap content underneath.

const ROOT: CSSProperties = {
  position: "absolute",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: "rgba(255, 255, 255, 0.85)",
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  boxShadow: shadow.md,
  backdropFilter: "blur(10px) saturate(160%)",
  WebkitBackdropFilter: "blur(10px) saturate(160%)",
  zIndex: 10,
  // Keep the toolbar above canvas pointer events but not receptive to
  // drags when the cursor doesn't hit a control — the surrounding
  // pointer-events: none + per-control pointer-events: auto lets
  // users drag-pan through the gaps, Figma-style.
  pointerEvents: "none",
};

const DIVIDER: CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  background: color.border,
};

const GROUP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  pointerEvents: "auto",
};

export function CanvasToolbar(): ReactElement {
  return (
    <div style={ROOT} role="toolbar" aria-label="Canvas toolbar">
      <span style={GROUP}>
        <TierBreadcrumb />
      </span>
      <span style={DIVIDER} aria-hidden />
      <span style={GROUP}>
        <KindFilterPanel />
      </span>
      <span style={DIVIDER} aria-hidden />
      <span style={GROUP}>
        <LayoutWeightPicker />
      </span>
    </div>
  );
}
