import type { CSSProperties, ReactElement } from "react";
import { DEFAULT_TIER_LADDER, type TierSpec } from "../../../entities/tier";
import { color, font, radius, shadow, transition } from "../../../shared/ui/tokens";
import { useTierSwitch } from "../model/use-tier-switch";

// TierBreadcrumb — the canvas's primary zoom control.
// Segmented-control styling shared with `LayoutWeightPicker` so the
// two feel like one system rather than two unrelated toolbars. No
// `▸` separators between rungs: the pill already communicates
// "discrete step on a ladder", and separators inflate the footprint
// without adding information.

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

export function TierBreadcrumb(): ReactElement {
  const { tier, jumpTo } = useTierSwitch();
  return (
    <nav aria-label="Zoom tier" style={TRACK}>
      {DEFAULT_TIER_LADDER.map(spec => {
        const isActive = spec.name === tier.name;
        return (
          <button
            key={spec.name}
            type="button"
            style={isActive ? SEG_ACTIVE : SEG}
            onClick={() => jumpTo(spec.name)}
            aria-current={isActive ? "true" : undefined}
            title={labelFor(spec)}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = color.hover;
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            {spec.label ?? spec.visibleKind}
          </button>
        );
      })}
    </nav>
  );
}

function labelFor(spec: TierSpec): string {
  return `${spec.label ?? spec.visibleKind} — shows ${spec.visibleKind}s at zoom ${spec.downThreshold.toFixed(
    3,
  )}–${Number.isFinite(spec.upThreshold) ? spec.upThreshold.toFixed(3) : "∞"}`;
}
