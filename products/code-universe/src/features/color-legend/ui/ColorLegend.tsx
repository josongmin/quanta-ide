import { useMemo, type CSSProperties, type ReactElement } from "react";
import {
  LAYER_COLOR_CSS,
  riskColorCss,
  useColorMode,
  type ColorMode,
} from "../../../features/color-mode";

// ColorLegend
// --------------------------------------------------------------------
// Floating legend for the active colour mode. Without it, the Risk /
// Heat / Layer palettes are perceptually ambiguous — a yellow rect
// could mean "medium-risk", "medium-heat", or "infra layer" depending
// on mode. Making the decoding key a first-class, stationary overlay
// resolves that instantly (Bertin's rule: quantitative colour needs a
// bound scale; categorical colour needs a bound legend).
//
// Palette mode hides the legend — the dot in the kind toggle already
// carries the mapping and a second legend would be redundant chrome.
//
// Placement: bottom-left, opposite the minimap. The two corners form
// a legible peripheral pair — nav context (minimap) on the right, data
// encoding (legend) on the left. Pointer-events off so it never steals
// clicks from the canvas.

const ROOT: CSSProperties = {
  position: "absolute",
  left: 12,
  bottom: 12,
  padding: "8px 12px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.9)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  pointerEvents: "none",
  fontFamily: "system-ui, sans-serif",
  fontSize: 11,
  color: "#374151",
  zIndex: 5,
  maxWidth: 260,
};

const HEAD: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: 6,
};

// Sequential (ordinal) ramp — renders as a single gradient strip with
// numeric min/max anchors. Sequential scales must be monotone in
// lightness; we just hand SVG five colour stops and let the browser
// interpolate in the chosen colour space.
function SequentialRamp({ head, minLabel, maxLabel }: { head: string; minLabel: string; maxLabel: string }): ReactElement {
  const stops = useMemo(() => {
    const points = [0, 25, 50, 75, 100];
    return points.map(p => ({ p, color: riskColorCss(p) }));
  }, []);
  const gradient = stops.map(s => `${s.color} ${s.p}%`).join(", ");
  return (
    <div>
      <div style={HEAD}>{head}</div>
      <div
        style={{
          height: 10,
          width: 220,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${gradient})`,
          border: "1px solid rgba(0,0,0,0.04)",
        }}
        aria-hidden
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 3,
          fontVariantNumeric: "tabular-nums",
          color: "#6b7280",
        }}
      >
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

// Categorical legend — nominal layers / kinds. Each row is swatch +
// label. Max rows = 6 so the legend never becomes a wall of text.
function CategoricalLegend({
  head,
  items,
}: {
  head: string;
  items: readonly { color: string; label: string }[];
}): ReactElement {
  return (
    <div>
      <div style={HEAD}>{head}</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 12, rowGap: 3 }}>
        {items.map(it => (
          <span key={it.label} style={{ display: "contents" }}>
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: it.color,
                border: "1px solid rgba(0,0,0,0.08)",
                alignSelf: "center",
              }}
            />
            <span style={{ alignSelf: "center" }}>{it.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function render(mode: ColorMode): ReactElement | null {
  if (mode === "risk") {
    return <SequentialRamp head="Risk score" minLabel="0 safe" maxLabel="100 critical" />;
  }
  if (mode === "heat") {
    return (
      <SequentialRamp head="Heat · archViolations × 10 + blast × 6 + taint × 2 + dead + cpx × 0.2" minLabel="cold" maxLabel="hottest" />
    );
  }
  if (mode === "layer") {
    const items = [
      { color: LAYER_COLOR_CSS.domain!, label: "domain" },
      { color: LAYER_COLOR_CSS.adapter!, label: "adapter" },
      { color: LAYER_COLOR_CSS.infra!, label: "infra" },
      { color: LAYER_COLOR_CSS.ui!, label: "ui" },
      { color: LAYER_COLOR_CSS.util!, label: "util" },
    ];
    return <CategoricalLegend head="Architectural layer" items={items} />;
  }
  return null;
}

export function ColorLegend(): ReactElement | null {
  const mode = useColorMode(s => s.mode);
  const body = render(mode);
  if (!body) return null;
  return (
    <div style={ROOT} role="note" aria-label={`Colour legend — ${mode} mode`}>
      {body}
    </div>
  );
}
