// APISurfaceView — sunburst-style public API audit.
// --------------------------------------------------------------------
// Two rings orbit the workspace centre:
//   - Ring 1 (inner): one arc per package, sized by total exported
//     symbol count across its files.
//   - Ring 2 (outer): one arc per file that exports anything, inside
//     its parent package's sector.
//
// Arc colour mixes the package's kindColor with bg0 based on the
// external-use ratio (unused = faded, heavily-used = saturated). Arcs
// under the dead-weight threshold render in a flat pale tint so the
// user's eye goes straight to the candidates for deletion.

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { color as tokenColor, font, kindColor, radius, space } from "../../../shared/ui/tokens";
import { seeded } from "../../../shared/analytics/synth-metrics";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import type { Entity } from "../../../entities/entity";

// ── Synthesised metrics ──────────────────────────────────────────────
// Real static-analysis data isn't wired in yet, so we synthesise a
// stable (export, externalUse) pair per entity from a seeded RNG.
// Same entity id → same numbers across reloads / views.

function packageExportCount(pkg: Entity): number {
  const files = pkg.metrics?.fileCount ?? Math.max(1, pkg.childIds.length);
  const rng = seeded(pkg.id, "api-exp");
  // Base proportional to file count with a long-tail factor.
  return Math.max(1, Math.floor(files * (0.6 + rng() * 1.8)));
}

function packageExternalUse(pkg: Entity): number {
  const rng = seeded(pkg.id, "api-ext");
  const base = rng();
  return Math.floor(Math.pow(base, 1.6) * 40);
}

function fileExportCount(file: Entity): number {
  const rng = seeded(file.id, "api-fexp");
  // Most files export a handful; some expose wide surfaces.
  return Math.max(1, Math.floor(1 + Math.pow(rng(), 1.2) * 14));
}

function fileExternalUse(file: Entity): number {
  const rng = seeded(file.id, "api-fext");
  // Dead-weight probability: ~28% of files have zero external users.
  if (rng() < 0.28) return 0;
  return Math.floor(Math.pow(rng(), 1.4) * 24);
}

// ── Geometry ─────────────────────────────────────────────────────────

const PAD = 40;
const RING1_START = 0.20; // fraction of radius
const RING1_END   = 0.55;
const RING2_START = 0.58;
const RING2_END   = 0.90;
const ARC_GAP = 0.006; // radians of gap between adjacent arcs

interface PackageArc {
  pkg: Entity;
  startAngle: number;
  endAngle: number;
  exportCount: number;
  externalUse: number;
  /** Files (building-kind descendants) that export anything. */
  files: FileArc[];
}

interface FileArc {
  file: Entity;
  startAngle: number;
  endAngle: number;
  exportCount: number;
  externalUse: number;
  dead: boolean;
}

interface SurfaceLayout {
  cx: number;
  cy: number;
  r: number;
  packages: PackageArc[];
  totalExports: number;
  totalFiles: number;
  deadFiles: number;
}

function polar(cx: number, cy: number, r: number, theta: number): [number, number] {
  return [cx + r * Math.cos(theta), cy + r * Math.sin(theta)];
}

function ringPath(
  cx: number, cy: number,
  rInner: number, rOuter: number,
  aStart: number, aEnd: number,
): string {
  // Guard against zero-width arcs
  const a0 = aStart;
  const a1 = Math.max(aStart + 0.0005, aEnd);
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  const [x0o, y0o] = polar(cx, cy, rOuter, a0);
  const [x1o, y1o] = polar(cx, cy, rOuter, a1);
  const [x1i, y1i] = polar(cx, cy, rInner, a1);
  const [x0i, y0i] = polar(cx, cy, rInner, a0);
  return [
    `M ${x0o.toFixed(2)} ${y0o.toFixed(2)}`,
    `A ${rOuter.toFixed(2)} ${rOuter.toFixed(2)} 0 ${largeArc} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
    `L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
    `A ${rInner.toFixed(2)} ${rInner.toFixed(2)} 0 ${largeArc} 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function buildLayout(
  ctx: ViewContextValue,
  width: number,
  height: number,
): SurfaceLayout | null {
  if (!ctx.tree) return null;
  if (width <= 0 || height <= 0) return null;

  const packages = ctx.tree.byKind("galaxy");
  if (packages.length === 0) return null;

  // Weight each package by its export count → arc length.
  const pkgExports = packages.map(p => ({ pkg: p, exp: packageExportCount(p) }));
  const totalExp = pkgExports.reduce((a, b) => a + b.exp, 0);
  if (totalExp <= 0) return null;

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.max(80, Math.min(width, height) / 2 - PAD);

  // Start at -π/2 so the first arc begins at 12 o'clock.
  let theta = -Math.PI / 2;

  const packageArcs: PackageArc[] = [];
  let totalFiles = 0;
  let deadFiles = 0;

  for (const { pkg, exp } of pkgExports) {
    const sweep = (exp / totalExp) * (Math.PI * 2);
    const aStart = theta + ARC_GAP / 2;
    const aEnd   = theta + sweep - ARC_GAP / 2;

    // Gather file-kind descendants of this package.
    const fileList: Entity[] = [];
    const walk = (id: string): void => {
      const kids = ctx.tree!.childrenOf(id);
      for (const k of kids) {
        if (k.kind === "building") fileList.push(k);
        else walk(k.id);
      }
    };
    walk(pkg.id);

    // Sub-arcs per file, weighted by file export count.
    const fileExps = fileList.map(f => ({ file: f, exp: fileExportCount(f) }));
    const fileExpTotal = fileExps.reduce((a, b) => a + b.exp, 0);
    const files: FileArc[] = [];
    if (fileList.length > 0 && fileExpTotal > 0) {
      const span = aEnd - aStart;
      let sub = aStart;
      for (const { file, exp: fexp } of fileExps) {
        const fSweep = (fexp / fileExpTotal) * span;
        const fStart = sub + ARC_GAP * 0.2;
        const fEnd   = sub + fSweep - ARC_GAP * 0.2;
        const externalUse = fileExternalUse(file);
        const dead = externalUse === 0;
        if (dead) deadFiles++;
        files.push({
          file,
          startAngle: fStart,
          endAngle: Math.max(fStart + 0.0005, fEnd),
          exportCount: fexp,
          externalUse,
          dead,
        });
        sub += fSweep;
        totalFiles++;
      }
    }

    packageArcs.push({
      pkg,
      startAngle: aStart,
      endAngle: aEnd,
      exportCount: exp,
      externalUse: packageExternalUse(pkg),
      files,
    });
    theta += sweep;
  }

  return { cx, cy, r, packages: packageArcs, totalExports: totalExp, totalFiles, deadFiles };
}

// ── Color ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// External-use intensity → 0..1 saturation factor.
function useIntensity(use: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.pow(use / max, 0.7));
}

// ── Component ────────────────────────────────────────────────────────

export function APISurfaceView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [hoveredPkgId, setHoveredPkgId] = useState<string | null>(null);

  useEffect(() => {
    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const { w, h } = ctx.viewportSize;
  const layout = useMemo(() => buildLayout(ctx, w, h), [ctx, w, h]);

  // Derived max external use for color scaling.
  const maxPkgUse = useMemo(() => {
    if (!layout) return 0;
    return layout.packages.reduce((m, p) => Math.max(m, p.externalUse), 0);
  }, [layout]);
  const maxFileUse = useMemo(() => {
    if (!layout) return 0;
    let m = 0;
    for (const p of layout.packages) {
      for (const f of p.files) m = Math.max(m, f.externalUse);
    }
    return m;
  }, [layout]);

  if (!ctx.tree) {
    return <EmptyState label="데이터 없음" sub="Entity tree가 필요합니다" />;
  }
  if (!layout) {
    return <EmptyState label="로딩 중" sub="API 표면 계산 중…" />;
  }

  const rootStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: tokenColor.bg0,
    color: tokenColor.text0,
    fontFamily: font.sans,
    overflow: "hidden",
  };

  const entryStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "scale(1)" : "scale(0.96)",
    transition: "opacity 500ms cubic-bezier(0.22, 1, 0.28, 1), transform 500ms cubic-bezier(0.22, 1, 0.28, 1)",
    willChange: "opacity, transform",
    width: "100%",
    height: "100%",
    position: "relative",
  };

  const ring1Inner = layout.r * RING1_START;
  const ring1Outer = layout.r * RING1_END;
  const ring2Inner = layout.r * RING2_START;
  const ring2Outer = layout.r * RING2_END;

  return (
    <div style={rootStyle} onClick={() => ctx.dispatch.selectEntity(null)}>
      <div style={entryStyle}>
        {/* Title */}
        <div
          style={{
            position: "absolute",
            left: PAD,
            top: space[3],
            display: "flex",
            gap: space[3],
            alignItems: "baseline",
          }}
        >
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold }}>
            API Surface
          </div>
          <div style={{ fontSize: font.size.xs, color: tokenColor.text2 }}>
            {layout.packages.length} packages · {layout.totalFiles} files ·{" "}
            <span style={{ color: layout.deadFiles > 0 ? tokenColor.warn : tokenColor.text2 }}>
              {layout.deadFiles} dead-weight
            </span>
          </div>
        </div>

        <svg
          width={w}
          height={h}
          style={{ position: "absolute", inset: 0 }}
          role="img"
          aria-label="API Surface sunburst"
        >
          {/* Centre workspace disk */}
          <circle
            cx={layout.cx}
            cy={layout.cy}
            r={layout.r * 0.14}
            fill={tokenColor.bg2}
            stroke={tokenColor.border}
            strokeWidth={0.8}
          />
          <text
            x={layout.cx}
            y={layout.cy + 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={tokenColor.text1}
            fontSize={font.size.sm}
            fontWeight={font.weight.semibold}
            fontFamily={font.sans}
          >
            workspace
          </text>

          {/* Ring 1 — packages */}
          {layout.packages.map((p, idx) => {
            const d = ringPath(layout.cx, layout.cy, ring1Inner, ring1Outer, p.startAngle, p.endAngle);
            const base = kindColor.galaxy;
            const t = useIntensity(p.externalUse, maxPkgUse);
            const fill = mix(tokenColor.bg2, base, 0.4 + t * 0.6);
            const hovered = hoveredPkgId === p.pkg.id;
            const dimmed = hoveredPkgId !== null && !hovered;
            return (
              <path
                key={p.pkg.id}
                d={d}
                fill={fill}
                stroke={tokenColor.bg0}
                strokeWidth={0.8}
                opacity={dimmed ? 0.35 : 1}
                style={{
                  cursor: "pointer",
                  transition: "opacity 180ms ease-out, transform 180ms ease-out",
                  animation: mounted
                    ? `as-arc-in 500ms cubic-bezier(0.22,1,0.28,1) both`
                    : "none",
                  animationDelay: `${Math.min(400, idx * 18)}ms`,
                  transformOrigin: `${layout.cx}px ${layout.cy}px`,
                  transform: hovered ? "scale(1.01)" : "scale(1)",
                }}
                onMouseEnter={() => setHoveredPkgId(p.pkg.id)}
                onMouseLeave={() => setHoveredPkgId(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  ctx.dispatch.selectEntity(p.pkg.id);
                }}
              >
                <title>
                  {p.pkg.name} · {p.exportCount} exports · used by {p.externalUse}
                </title>
              </path>
            );
          })}

          {/* Ring 2 — files */}
          {layout.packages.flatMap((p, pIdx) =>
            p.files.map((f, fIdx) => {
              const d = ringPath(layout.cx, layout.cy, ring2Inner, ring2Outer, f.startAngle, f.endAngle);
              const base = kindColor.building;
              const t = useIntensity(f.externalUse, maxFileUse);
              const fill = f.dead
                ? mix(tokenColor.bg2, tokenColor.border, 0.4)
                : mix(tokenColor.bg2, base, 0.25 + t * 0.75);
              const hovered = hoveredFileId === f.file.id;
              const dimmedByPkg = hoveredPkgId !== null && hoveredPkgId !== p.pkg.id;
              const dimmed = (hoveredFileId !== null && !hovered) || dimmedByPkg;
              return (
                <path
                  key={f.file.id}
                  d={d}
                  fill={fill}
                  stroke={tokenColor.bg0}
                  strokeWidth={0.4}
                  opacity={f.dead ? (dimmed ? 0.15 : 0.55) : (dimmed ? 0.3 : 1)}
                  style={{
                    cursor: "pointer",
                    transition: "opacity 180ms ease-out",
                    animation: mounted
                      ? `as-arc-in 500ms cubic-bezier(0.22,1,0.28,1) both`
                      : "none",
                    animationDelay: `${Math.min(700, 120 + (pIdx * 18) + fIdx * 14)}ms`,
                  }}
                  onMouseEnter={() => setHoveredFileId(f.file.id)}
                  onMouseLeave={() => setHoveredFileId(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    ctx.dispatch.selectEntity(f.file.id);
                  }}
                >
                  <title>
                    {f.file.name} · {f.exportCount} exports ·{" "}
                    {f.dead ? "no external users" : `used by ${f.externalUse}`}
                  </title>
                </path>
              );
            }),
          )}

          {/* Package labels (outside ring2) */}
          {layout.packages.map(p => {
            const mid = (p.startAngle + p.endAngle) / 2;
            const rLabel = layout.r * 0.96;
            const [lx, ly] = polar(layout.cx, layout.cy, rLabel, mid);
            const sweep = p.endAngle - p.startAngle;
            if (sweep < 0.08) return null; // too narrow to label
            const degRaw = (mid * 180) / Math.PI;
            const flip = Math.cos(mid) < 0;
            const anchor = flip ? "end" : "start";
            const rot = flip ? degRaw - 180 : degRaw;
            const hovered = hoveredPkgId === p.pkg.id;
            return (
              <text
                key={`lbl-${p.pkg.id}`}
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                transform={`rotate(${rot} ${lx} ${ly})`}
                fill={hovered ? tokenColor.text0 : tokenColor.text2}
                fontSize={font.size.xs}
                fontFamily={font.sans}
                style={{ pointerEvents: "none", transition: "fill 180ms ease-out" }}
              >
                {p.pkg.name}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            right: PAD,
            top: space[3],
            display: "flex",
            gap: space[3],
            alignItems: "center",
            fontSize: font.size.xs,
            color: tokenColor.text2,
          }}
        >
          <LegendSwatch color={mix(tokenColor.bg2, kindColor.building, 0.85)} label="heavily used" />
          <LegendSwatch color={mix(tokenColor.bg2, kindColor.building, 0.35)} label="used" />
          <LegendSwatch color={mix(tokenColor.bg2, tokenColor.border, 0.4)} label="dead-weight" />
        </div>

        <style>{`
          @keyframes as-arc-in {
            0%   { opacity: 0; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }): ReactElement {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: space[2] }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: radius.xs,
          background: color,
          border: `1px solid ${tokenColor.border}`,
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
        color: tokenColor.text2,
        fontFamily: font.sans,
        background: tokenColor.bg0,
      }}
    >
      <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold }}>
        {label}
      </div>
      <div style={{ fontSize: font.size.xs }}>{sub}</div>
    </div>
  );
}
