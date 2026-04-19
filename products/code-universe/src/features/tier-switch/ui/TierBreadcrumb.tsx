import type { CSSProperties, ReactElement } from "react";
import { DEFAULT_TIER_LADDER, type TierSpec } from "../../../entities/tier";
import { useTierSwitch } from "../model/use-tier-switch";

// TierBreadcrumb
// --------------------------------------------------------------------
// HUD breadcrumb that shows the tier ladder and highlights the active
// rung. Clicking a rung jumps the camera there. Minimal styling —
// ui-kit is a lib dependency the orchestrator can wire in later; for
// now inline styles keep the slice zero-css-dep.

const CRUMB_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "white",
  fontSize: 12,
  fontFamily: "system-ui, sans-serif",
  color: "#374151",
  cursor: "pointer",
  lineHeight: 1,
};

const CRUMB_ACTIVE: CSSProperties = {
  ...CRUMB_BASE,
  background: "#4f46e5",
  borderColor: "#4f46e5",
  color: "white",
  fontWeight: 600,
};

const SEP_STYLE: CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
};

export function TierBreadcrumb(): ReactElement {
  const { tier, jumpTo } = useTierSwitch();
  return (
    <nav
      aria-label="Zoom tier"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      {DEFAULT_TIER_LADDER.map((spec, i) => {
        const isActive = spec.name === tier.name;
        return (
          <span key={spec.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              style={isActive ? CRUMB_ACTIVE : CRUMB_BASE}
              onClick={() => jumpTo(spec.name)}
              aria-current={isActive ? "true" : undefined}
              title={labelFor(spec)}
            >
              {spec.label ?? spec.visibleKind}
            </button>
            {i < DEFAULT_TIER_LADDER.length - 1 ? <span style={SEP_STYLE}>▸</span> : null}
          </span>
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
