import type { CSSProperties, ReactElement } from "react";
import { color, font, radius, shadow, transition } from "../../../shared/ui/tokens";
import {
  layoutWeightStore,
  useLayoutWeight,
  type LayoutWeightMode,
} from "../model/store";

// LayoutWeightPicker — segmented control picking the metric that
// drives both layout sizing and canvas heat color. Visual is kept
// pixel-identical to `TierBreadcrumb`: same track, same chip,
// different contents. That one-segmented-control-style rule keeps
// the header from reading like four unrelated toolbars.

const MODES: readonly { id: LayoutWeightMode; label: string; title: string }[] = [
  { id: "loc", label: "LoC", title: "Size + heat by lines of code" },
  { id: "risk", label: "Risk", title: "Size + heat by riskScore — hotspots first" },
  { id: "fileCount", label: "Files", title: "Size + heat by file count — package view" },
  { id: "equal", label: "Equal", title: "Ignore metrics — pure topology" },
];

const TRACK: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: 2,
  gap: 1,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  lineHeight: 1,
};

const SEG: CSSProperties = {
  padding: "4px 9px",
  borderRadius: radius.sm,
  fontSize: font.size.sm,
  fontFamily: font.family,
  fontWeight: font.weight.medium,
  letterSpacing: font.letter.tight,
  color: color.text2,
  background: "transparent",
  border: "1px solid transparent",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: `background ${transition.fast}, color ${transition.fast}`,
};

const SEG_ACTIVE: CSSProperties = {
  ...SEG,
  background: color.bg1,
  color: color.text0,
  border: `1px solid ${color.border}`,
  boxShadow: shadow.xs,
  fontWeight: font.weight.semibold,
};

export function LayoutWeightPicker(): ReactElement {
  const active = useLayoutWeight(s => s.mode);
  return (
    <div style={TRACK} role="radiogroup" aria-label="Layout weight">
      {MODES.map(m => {
        const isActive = active === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            style={isActive ? SEG_ACTIVE : SEG}
            onClick={() => layoutWeightStore.setMode(m.id)}
            title={m.title}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = color.hover;
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
