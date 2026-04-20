import type { CSSProperties, ReactElement } from "react";
import { colorModeStore, useColorMode, type ColorMode } from "../model/store";

// ColorModePicker
// --------------------------------------------------------------------
// Four-option segmented control. Sits in the shell header next to the
// LayoutWeight picker. Each option carries a tiny "legend dot" hinting
// at what the mode paints — `risk` shows the red end of the ramp,
// `heat` the amber middle, `layer` a purple sample, `palette` the
// default grey so users can tell at a glance what "palette" even
// means before they try it.

const MODES: readonly { id: ColorMode; label: string; dot: string; title: string }[] = [
  { id: "palette", label: "Kind",  dot: "#94a3b8", title: "Flat colour per entity kind (default)" },
  { id: "risk",    label: "Risk",  dot: "#ef4444", title: "riskScore gradient — emerald → red" },
  { id: "heat",    label: "Heat",  dot: "#fb923c", title: "Combined taint/dead/archViolation/complexity heatmap" },
  { id: "layer",   label: "Layer", dot: "#a78bfa", title: "Architectural layer palette (domain/adapter/infra/ui/util)" },
];

const ROOT_STYLE: CSSProperties = {
  display: "inline-flex",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  padding: 2,
  gap: 2,
};

const SEG_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "system-ui, sans-serif",
  cursor: "pointer",
  border: "none",
  background: "transparent",
  color: "#6b7280",
  lineHeight: 1.25,
};

const SEG_ACTIVE: CSSProperties = {
  ...SEG_BASE,
  background: "white",
  color: "#111827",
  fontWeight: 500,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

const DOT: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 2,
  flexShrink: 0,
};

export function ColorModePicker(): ReactElement {
  const active = useColorMode(s => s.mode);
  return (
    <div style={ROOT_STYLE} role="radiogroup" aria-label="Colour mode">
      {MODES.map(m => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={active === m.id}
          style={active === m.id ? SEG_ACTIVE : SEG_BASE}
          onClick={() => colorModeStore.setMode(m.id)}
          title={m.title}
        >
          <span style={{ ...DOT, background: m.dot }} />
          {m.label}
        </button>
      ))}
    </div>
  );
}
