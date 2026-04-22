// ViewSkeleton — shared loading placeholder for Code Universe views.
// --------------------------------------------------------------------
// Many of the 74 view-descriptor Components return `null` while their
// data (ctx.tree / ctx.graph / ...) is still resolving. That creates a
// hard flash of empty panel between view switches. This component
// replaces those early `return null` sites with a layout-shaped
// placeholder that fades in softly (260ms) and shimmers to signal work
// in progress. Each `kind` approximates the target view's silhouette
// so the user's eye doesn't jump when the real content paints.
//
// Intended usage inside any ModeView:
//   if (!ctx.tree)  return <ViewSkeleton kind="dashboard" message="워크스페이스 로딩 중..." />;
//   if (!ctx.graph) return <ViewSkeleton kind="graph"     message="그래프 로딩 중..." />;
//
// The caller decides container sizing — this component fills 100% of
// its parent width/height and lets flex/grid decide the rest. Tokens
// only (no external deps, no CSS modules). Light theme only.

import { memo, useMemo, type CSSProperties, type ReactElement } from "react";

import { color, font, radius, space } from "./tokens";

// ── One-time keyframe + base-style injection ─────────────────────────
// Same pattern as ensureA11yStyles / the MindMapView <style> tag, but
// module-level so every instance shares the single rule-set. The
// shimmer animation targets `.cu-skel-shimmer`; the fade-in targets
// `.cu-skel-root`.

const INJECTED = "cu-view-skeleton-styles";

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(INJECTED)) return;
  const el = document.createElement("style");
  el.id = INJECTED;
  el.textContent = `
@keyframes cu-skel-fade-in {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes cu-skel-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%);  }
}
/* Gentle breathing on the base fill so the skeleton reads as "working"
 * even before the shimmer band sweeps past. Very low amplitude (4%)
 * so it layers under the shimmer without competing with it. */
@keyframes cu-skel-pulse {
  0%, 100% { opacity: 1;    }
  50%      { opacity: 0.72; }
}
.cu-skel-root {
  animation: cu-skel-fade-in 260ms ease-out both;
}
.cu-skel-stub {
  position: relative;
  overflow: hidden;
  animation: cu-skel-pulse 1.8s ease-in-out infinite;
}
.cu-skel-shimmer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  animation: cu-skel-shimmer 1.4s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cu-skel-root,
  .cu-skel-stub,
  .cu-skel-shimmer {
    animation: none !important;
  }
}
`;
  document.head.appendChild(el);
}

// ── Public API ───────────────────────────────────────────────────────

export type ViewSkeletonKind =
  | "dashboard"
  | "list"
  | "graph"
  | "chart"
  | "grid";

export interface ViewSkeletonProps {
  /** Layout silhouette to approximate. Default: "dashboard". */
  kind?: ViewSkeletonKind;
  /** Optional caption beneath the skeleton body. */
  message?: string;
  /** Optional hue for the shimmer band. Defaults to neutral (black 4%). */
  accent?: string;
}

// Shimmer colour — defaults to a very faint black so it reads on any
// neutral surface. Caller-provided `accent` is mixed to ~6% so tinted
// views (e.g. per-category) stay subtle and don't fight the real UI
// that will replace them.
function shimmerGradient(accent?: string): string {
  if (!accent) {
    return "linear-gradient(90deg, transparent 0%, rgba(10, 10, 10, 0.045) 50%, transparent 100%)";
  }
  // Assume `accent` is a hex or rgb() string. Layer it at low alpha via
  // a CSS color-mix fallback; if the browser doesn't support color-mix
  // (unlikely in our target matrix), the neutral base below still
  // reads. Keep it simple: just tint the mid-stop with the accent.
  return `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${accent} 10%, transparent) 50%, transparent 100%)`;
}

// Base stub style — a rounded rectangle filled with bg3 that carries
// the shimmer band. Shared so every layout draws the same block.
function stubStyle(height: number | string, width: number | string = "100%", r: number = radius.md): CSSProperties {
  return {
    width,
    height,
    borderRadius: r,
    background: color.bg3,
    border: `1px solid ${color.border}`,
  };
}

// ── Layout atoms ─────────────────────────────────────────────────────

function Stub({
  height,
  width = "100%",
  r = radius.md,
  accent,
  style,
}: {
  height: number | string;
  width?: number | string;
  r?: number;
  accent?: string;
  style?: CSSProperties;
}) {
  return (
    <div className="cu-skel-stub" style={{ ...stubStyle(height, width, r), ...style }}>
      <div
        className="cu-skel-shimmer"
        style={{ backgroundImage: shimmerGradient(accent) }}
      />
    </div>
  );
}

// ── Kind layouts ─────────────────────────────────────────────────────

function DashboardLayout({ accent }: { accent?: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: space[4],
      width: "100%",
      height: "100%",
      padding: space[5],
      boxSizing: "border-box",
    }}>
      {/* Hero banner */}
      <Stub height={96} r={radius.lg} accent={accent} />
      {/* 4-up tile grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: space[3],
        flex: 1,
        minHeight: 0,
      }}>
        {[0, 1, 2, 3].map((i) => (
          <Stub key={i} height="100%" r={radius.lg} accent={accent} />
        ))}
      </div>
      {/* Secondary 3-up row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: space[3],
      }}>
        {[0, 1, 2].map((i) => (
          <Stub key={i} height={120} r={radius.lg} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function ListLayout({ accent }: { accent?: string }) {
  const rows = 12;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: space[2],
      width: "100%",
      height: "100%",
      padding: space[5],
      boxSizing: "border-box",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", gap: space[3], alignItems: "center", marginBottom: space[2] }}>
        <Stub height={20} width={180} r={radius.sm} accent={accent} />
        <div style={{ flex: 1 }} />
        <Stub height={28} width={120} r={radius.pill} accent={accent} />
      </div>
      {/* Column-header stub */}
      <Stub height={28} r={radius.sm} accent={accent} />
      {/* Row stubs with subtle width jitter so the list doesn't look robotic */}
      {Array.from({ length: rows }, (_, i) => {
        // Deterministic jitter — the same i always produces the same
        // width so hot-reload doesn't re-shuffle the silhouette.
        const jitter = 68 + ((i * 37) % 32); // 68..100%
        return (
          <Stub
            key={i}
            height={36}
            width={`${jitter}%`}
            r={radius.sm}
            accent={accent}
          />
        );
      })}
    </div>
  );
}

function GraphLayout({ accent }: { accent?: string }) {
  // Orbit dot positions (percent) — 8 dots circling a center blob,
  // plus a few inner-orbit satellites for depth.
  const orbitOuter = Array.from({ length: 8 }, (_, i) => {
    const theta = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return {
      left: `${50 + Math.cos(theta) * 34}%`,
      top: `${50 + Math.sin(theta) * 34}%`,
      size: 36,
    };
  });
  const orbitInner = Array.from({ length: 5 }, (_, i) => {
    const theta = (i / 5) * Math.PI * 2 + Math.PI / 6;
    return {
      left: `${50 + Math.cos(theta) * 18}%`,
      top: `${50 + Math.sin(theta) * 18}%`,
      size: 20,
    };
  });
  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100%",
      padding: space[5],
      boxSizing: "border-box",
    }}>
      {/* Faint orbit guide rings — static, just SVG circles so no
       *  additional animation budget. Keeps the mind-map grammar. */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <circle cx="50%" cy="50%" r="18%" fill="none" stroke={color.border} strokeWidth={1} strokeDasharray="2 6" />
        <circle cx="50%" cy="50%" r="34%" fill="none" stroke={color.border} strokeWidth={1} strokeDasharray="2 6" />
      </svg>
      {/* Center blob */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}>
        <Stub height={72} width={72} r={radius.pill} accent={accent} />
      </div>
      {/* Inner orbit satellites */}
      {orbitInner.map((p, i) => (
        <div
          key={`in-${i}`}
          style={{
            position: "absolute",
            left: p.left,
            top: p.top,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Stub height={p.size} width={p.size} r={radius.pill} accent={accent} />
        </div>
      ))}
      {/* Outer orbit nodes */}
      {orbitOuter.map((p, i) => (
        <div
          key={`out-${i}`}
          style={{
            position: "absolute",
            left: p.left,
            top: p.top,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Stub height={p.size} width={p.size} r={radius.pill} accent={accent} />
        </div>
      ))}
    </div>
  );
}

function ChartLayout({ accent }: { accent?: string }) {
  // 10 bars with deterministic heights — left-to-right feels like an
  // incoming time series rather than random noise.
  const bars = Array.from({ length: 10 }, (_, i) => {
    const h = 28 + ((i * 53) % 62); // 28..90% of track
    return h;
  });
  // 12 scatter dots in the lower half
  const dots = Array.from({ length: 14 }, (_, i) => ({
    left: `${6 + ((i * 71) % 88)}%`,
    top: `${55 + ((i * 29) % 35)}%`,
  }));
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: space[4],
      width: "100%",
      height: "100%",
      padding: space[5],
      boxSizing: "border-box",
    }}>
      {/* Chart header */}
      <div style={{ display: "flex", gap: space[3], alignItems: "center" }}>
        <Stub height={20} width={200} r={radius.sm} accent={accent} />
        <div style={{ flex: 1 }} />
        <Stub height={24} width={80} r={radius.pill} accent={accent} />
        <Stub height={24} width={80} r={radius.pill} accent={accent} />
      </div>
      {/* Bars track */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: space[2],
        flex: 1,
        minHeight: 0,
        borderBottom: `1px solid ${color.border}`,
        paddingBottom: space[2],
      }}>
        {bars.map((h, i) => (
          <Stub key={i} height={`${h}%`} r={radius.sm} accent={accent} />
        ))}
      </div>
      {/* Scatter dots area */}
      <div style={{ position: "relative", height: 88 }}>
        {dots.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.left,
              top: p.top,
              transform: "translate(-50%, -50%)",
            }}
          >
            <Stub height={10} width={10} r={radius.pill} accent={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function GridLayout({ accent }: { accent?: string }) {
  const cells = 5 * 5;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gridTemplateRows: "repeat(5, 1fr)",
      gap: space[3],
      width: "100%",
      height: "100%",
      padding: space[5],
      boxSizing: "border-box",
    }}>
      {Array.from({ length: cells }, (_, i) => (
        <Stub key={i} height="100%" r={radius.md} accent={accent} />
      ))}
    </div>
  );
}

// ── Root component ───────────────────────────────────────────────────

function ViewSkeletonImpl({ kind = "dashboard", message, accent }: ViewSkeletonProps) {
  // Ensure the keyframe + shimmer CSS is present in <head> exactly once.
  // Called in render rather than useEffect so the first paint already
  // has the animation wired up (no 1-frame flash without transition).
  useMemo(() => ensureStyles(), []);

  let body: ReactElement;
  switch (kind) {
    case "list":      body = <ListLayout      accent={accent} />; break;
    case "graph":     body = <GraphLayout     accent={accent} />; break;
    case "chart":     body = <ChartLayout     accent={accent} />; break;
    case "grid":      body = <GridLayout      accent={accent} />; break;
    case "dashboard":
    default:          body = <DashboardLayout accent={accent} />; break;
  }

  return (
    <div
      className="cu-skel-root"
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: color.bg1,
        color: color.text2,
        fontFamily: font.sans,
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {body}
      </div>
      {message && (
        <div
          style={{
            flexShrink: 0,
            padding: `${space[3]}px ${space[5]}px`,
            borderTop: `1px solid ${color.border}`,
            background: color.bg2,
            color: color.text2,
            fontSize: font.size.sm,
            fontWeight: font.weight.medium,
            letterSpacing: font.letter.wide,
            textAlign: "center",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export const ViewSkeleton = memo(ViewSkeletonImpl);
