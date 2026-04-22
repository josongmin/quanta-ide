// LayerAuditView — horizontal FSD layer bands + violation-aware edges.
// --------------------------------------------------------------------
// Renders each FSD layer as a horizontal band. Packages (galaxy-kind
// entities) render as chips inside their inferred band; layer is
// inferred from path segments ("shell", "products", "widgets",
// "features", "entities", "shared"), with a deterministic PRNG
// fallback for unmapped packages so the view stays stable across
// reloads.
//
// Edges are drawn as cubic beziers between package chips:
//   - Clean edge (upper-layer → lower-layer OR same layer): thin gray
//   - Violation edge (lower-layer → upper-layer): vivid red with a
//     small "!" marker at the midpoint. "Lower" here means closer to
//     Entity/Shared in the FSD stack — i.e. reverse dependencies.
//
// This component intentionally does its own layout in useMemo rather
// than delegating to a model/ file so the feature stays within the
// 3-file budget.

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { color as tokenColor, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { seeded } from "../../../shared/analytics/synth-metrics";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import type { Entity } from "../../../entities/entity";

// ── Layer model ──────────────────────────────────────────────────────

type LayerId = "shell" | "product" | "widget" | "feature" | "entity" | "shared";

interface LayerDef {
  id: LayerId;
  label: string;
  /** Accent hue for chips in this band. */
  color: string;
  /** Terse caption under the label. */
  caption: string;
}

// Order: top (0) → bottom (5). Top is the most "outer" layer; bottom
// is the most "inner" (closer to pure code). Dependencies legally
// flow top-down (higher → lower). A bottom-up edge = violation.
const LAYERS: readonly LayerDef[] = [
  { id: "shell",   label: "Shell",   color: "#7e4ed6", caption: "Host / app entry" },
  { id: "product", label: "Product", color: "#0d99ff", caption: "Business product slice" },
  { id: "widget",  label: "Widget",  color: "#22a06b", caption: "Composite UI blocks" },
  { id: "feature", label: "Feature", color: "#e09321", caption: "Feature-level logic" },
  { id: "entity",  label: "Entity",  color: "#e5484d", caption: "Domain models" },
  { id: "shared",  label: "Shared",  color: "#3d3d3d", caption: "Reusable primitives" },
];

const LAYER_INDEX: Readonly<Record<LayerId, number>> = {
  shell: 0, product: 1, widget: 2, feature: 3, entity: 4, shared: 5,
};

const LAYER_SEGMENT_MAP: ReadonlyArray<[RegExp, LayerId]> = [
  [/(^|\/)shell(\/|$)/i,      "shell"],
  [/(^|\/)app(\/|$)/i,        "shell"],
  [/(^|\/)host(\/|$)/i,       "shell"],
  [/(^|\/)products?(\/|$)/i,  "product"],
  [/(^|\/)widgets?(\/|$)/i,   "widget"],
  [/(^|\/)features?(\/|$)/i,  "feature"],
  [/(^|\/)entit(y|ies)(\/|$)/i, "entity"],
  [/(^|\/)shared(\/|$)/i,     "shared"],
  [/(^|\/)libs?(\/|$)/i,      "shared"],
  [/(^|\/)packages?(\/|$)/i,  "product"],
];

function inferLayer(pkg: Entity): LayerId {
  const hay = `${pkg.path}/${pkg.name}`;
  for (const [re, id] of LAYER_SEGMENT_MAP) {
    if (re.test(hay)) return id;
  }
  // Deterministic fallback so unknown packages land in a stable spot.
  const rng = seeded(pkg.id, "layer");
  const pick = Math.floor(rng() * LAYERS.length);
  return LAYERS[Math.min(LAYERS.length - 1, Math.max(0, pick))]!.id;
}

// ── Layout ───────────────────────────────────────────────────────────

interface ChipPos {
  pkg: Entity;
  layer: LayerId;
  /** Chip centre (px). */
  cx: number;
  cy: number;
  w: number;
  h: number;
  fileCount: number;
}

interface EdgeSpec {
  id: string;
  from: ChipPos;
  to: ChipPos;
  violation: boolean;
}

interface AuditLayout {
  bands: Array<{ def: LayerDef; y: number; h: number; count: number }>;
  chips: ChipPos[];
  edges: EdgeSpec[];
  violationCount: number;
  cleanCount: number;
}

const PAD = 40;
const BAND_LABEL_W = 96;
const CHIP_H = 28;
const CHIP_MIN_W = 96;
const CHIP_MAX_W = 180;
const CHIP_GAP_X = 10;
const CHIP_GAP_Y = 10;
const BAND_HEADER = 26; // space at band top for the chip rows

function buildLayout(
  ctx: ViewContextValue,
  width: number,
  height: number,
): AuditLayout | null {
  if (!ctx.tree || !ctx.graph) return null;
  if (width <= 0 || height <= 0) return null;

  const packages = ctx.tree.byKind("galaxy");
  if (packages.length === 0) return null;

  const plotW = Math.max(200, width - PAD * 2);
  const plotH = Math.max(200, height - PAD * 2);
  const bandH = Math.floor(plotH / LAYERS.length);
  const chipAreaX = PAD + BAND_LABEL_W;
  const chipAreaW = Math.max(200, plotW - BAND_LABEL_W);

  // Group packages by layer.
  const byLayer = new Map<LayerId, Entity[]>();
  for (const l of LAYERS) byLayer.set(l.id, []);
  for (const pkg of packages) {
    const id = inferLayer(pkg);
    byLayer.get(id)!.push(pkg);
  }

  // Emit band records + chip positions (masonry rows inside each band).
  const bands: AuditLayout["bands"] = [];
  const chips: ChipPos[] = [];
  const chipById = new Map<string, ChipPos>();

  for (let i = 0; i < LAYERS.length; i++) {
    const def = LAYERS[i]!;
    const bandY = PAD + i * bandH;
    const list = byLayer.get(def.id) ?? [];
    bands.push({ def, y: bandY, h: bandH, count: list.length });

    if (list.length === 0) continue;

    // Lay chips out in rows starting just below the band header. Each
    // chip's width is LoC-ish (file count scaled) so bigger packages
    // read visibly larger.
    let rowX = chipAreaX + CHIP_GAP_X;
    let rowY = bandY + BAND_HEADER + CHIP_GAP_Y;
    for (const pkg of list) {
      const fileCount = pkg.metrics?.fileCount ?? Math.max(1, pkg.childIds.length);
      const w = Math.min(
        CHIP_MAX_W,
        Math.max(CHIP_MIN_W, CHIP_MIN_W + Math.log2(fileCount + 1) * 18),
      );
      if (rowX + w > chipAreaX + chipAreaW) {
        rowX = chipAreaX + CHIP_GAP_X;
        rowY += CHIP_H + CHIP_GAP_Y;
      }
      // If chip would overflow band vertically, keep it anyway at the
      // bottom edge — clipping reads as "too many, scroll / zoom".
      const maxRowY = bandY + bandH - CHIP_H - 4;
      const cy = Math.min(rowY, maxRowY) + CHIP_H / 2;
      const cx = rowX + w / 2;
      const chip: ChipPos = {
        pkg, layer: def.id, cx, cy, w, h: CHIP_H, fileCount,
      };
      chips.push(chip);
      chipById.set(pkg.id, chip);
      rowX += w + CHIP_GAP_X;
    }
  }

  // Derive package-level edges by rolling up file edges through
  // ancestors. A file edge contributes to a package→package edge when
  // both endpoints map to a galaxy ancestor.
  const fileToPkg = new Map<string, string>();
  for (const building of ctx.tree.byKind("building")) {
    // Walk ancestors to find a galaxy; default to null.
    const chain = ctx.tree.ancestorsOf(building.id);
    for (const a of chain) {
      if (a.kind === "galaxy") {
        fileToPkg.set(building.id, a.id);
        break;
      }
    }
  }

  const edgePairs = new Map<string, { from: ChipPos; to: ChipPos; count: number }>();
  for (const e of ctx.graph.fileEdges) {
    const fromPkgId = fileToPkg.get(e.from);
    const toPkgId = fileToPkg.get(e.to);
    if (!fromPkgId || !toPkgId || fromPkgId === toPkgId) continue;
    const fromChip = chipById.get(fromPkgId);
    const toChip = chipById.get(toPkgId);
    if (!fromChip || !toChip) continue;
    const key = `${fromPkgId}->${toPkgId}`;
    const existing = edgePairs.get(key);
    if (existing) existing.count++;
    else edgePairs.set(key, { from: fromChip, to: toChip, count: 1 });
  }

  const edges: EdgeSpec[] = [];
  let violationCount = 0;
  let cleanCount = 0;
  for (const [key, rec] of edgePairs) {
    // Violation: source (from) is in a lower layer (higher index) than
    // target (to). Lower-layer means closer to shared/entity; such an
    // edge would mean shared → product, which is illegal.
    const fromIdx = LAYER_INDEX[rec.from.layer];
    const toIdx = LAYER_INDEX[rec.to.layer];
    const violation = fromIdx > toIdx;
    edges.push({ id: key, from: rec.from, to: rec.to, violation });
    if (violation) violationCount++;
    else cleanCount++;
  }

  return { bands, chips, edges, violationCount, cleanCount };
}

// ── Bezier path helpers ──────────────────────────────────────────────

function bezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const dx = x2 - x1;
  const mx1 = x1 + dx * 0.35;
  const mx2 = x1 + dx * 0.65;
  // Bend outward: use Y spread so edges curve through the band gaps.
  const my1 = y1;
  const my2 = y2;
  return `M ${x1},${y1} C ${mx1},${my1} ${mx2},${my2} ${x2},${y2}`;
}

// ── Component ────────────────────────────────────────────────────────

export function LayerAuditView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [hoveredPkgId, setHoveredPkgId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  // Empty states
  if (!ctx.tree || !ctx.graph) {
    return <EmptyState label="데이터 없음" sub="Workspace graph가 필요합니다" />;
  }
  if (!layout) {
    return <EmptyState label="로딩 중" sub="레이어 정렬 계산 중…" />;
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

  return (
    <div ref={rootRef} style={rootStyle} onClick={() => ctx.dispatch.selectEntity(null)}>
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
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold }}>
            Layer Audit
          </div>
          <div style={{ fontSize: font.size.xs, color: tokenColor.text2 }}>
            {layout.chips.length} packages ·{" "}
            <span style={{ color: layout.violationCount > 0 ? tokenColor.danger : tokenColor.text2 }}>
              {layout.violationCount} violations
            </span>
            {" · "}
            <span>{layout.cleanCount} clean edges</span>
          </div>
        </div>

        {/* Bands */}
        {layout.bands.map((b, i) => (
          <div
            key={b.def.id}
            style={{
              position: "absolute",
              left: PAD,
              top: b.y,
              width: `calc(100% - ${PAD * 2}px)`,
              height: b.h,
              borderTop: i === 0 ? "none" : `1px dashed ${tokenColor.border}`,
            }}
          >
            {/* Band label column */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: BAND_LABEL_W,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingLeft: space[2],
                borderRight: `1px solid ${tokenColor.border}`,
                background: tokenColor.bg2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.pill,
                    background: b.def.color,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: font.size.md, fontWeight: font.weight.semibold }}>
                  {b.def.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: font.size.xs,
                  color: tokenColor.text2,
                  marginTop: 2,
                }}
              >
                {b.def.caption}
              </div>
              <div
                style={{
                  fontSize: font.size.xxs,
                  color: tokenColor.text3,
                  marginTop: 1,
                }}
              >
                {b.count} pkg
              </div>
            </div>
          </div>
        ))}

        {/* Edges SVG overlay (below chips) */}
        <svg
          width={w}
          height={h}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <defs>
            <marker
              id="lv-warn"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <circle cx="5" cy="5" r="4.2" fill={tokenColor.danger} />
              <text
                x="5"
                y="7.2"
                textAnchor="middle"
                fontSize="7"
                fill="#fff"
                fontFamily={font.sans}
                fontWeight={700}
              >!</text>
            </marker>
          </defs>
          {layout.edges.map((e, idx) => {
            const x1 = e.from.cx;
            const y1 = e.from.cy;
            const x2 = e.to.cx;
            const y2 = e.to.cy;
            const hovered = hoveredPkgId
              ? (hoveredPkgId === e.from.pkg.id || hoveredPkgId === e.to.pkg.id)
              : false;
            const dimmed = hoveredPkgId && !hovered;
            const stroke = e.violation ? tokenColor.danger : tokenColor.borderStrong;
            const baseOpacity = e.violation ? 0.85 : 0.35;
            const opacity = dimmed ? 0.08 : (hovered ? 1 : baseOpacity);
            return (
              <path
                key={e.id}
                d={bezierPath(x1, y1, x2, y2)}
                fill="none"
                stroke={stroke}
                strokeWidth={e.violation ? 1.2 : 0.8}
                opacity={opacity}
                style={{
                  transition: "opacity 180ms ease-out",
                  animation: mounted
                    ? `lv-edge-in 500ms cubic-bezier(0.22,1,0.28,1) both`
                    : "none",
                  animationDelay: `${Math.min(400, idx * 6)}ms`,
                }}
                markerMid={e.violation ? "url(#lv-warn)" : undefined}
              />
            );
          })}
        </svg>

        {/* Chips (on top of edges) */}
        {layout.chips.map((chip, idx) => {
          const def = LAYERS.find(l => l.id === chip.layer)!;
          const hovered = hoveredPkgId === chip.pkg.id;
          const dimmed = hoveredPkgId !== null && !hovered;
          return (
            <div
              key={chip.pkg.id}
              onMouseEnter={() => setHoveredPkgId(chip.pkg.id)}
              onMouseLeave={() => setHoveredPkgId(null)}
              onClick={(ev) => {
                ev.stopPropagation();
                ctx.dispatch.selectEntity(chip.pkg.id);
              }}
              style={{
                position: "absolute",
                left: chip.cx - chip.w / 2,
                top: chip.cy - chip.h / 2,
                width: chip.w,
                height: chip.h,
                display: "flex",
                alignItems: "center",
                gap: space[2],
                padding: `0 ${space[3]}px`,
                borderRadius: radius.md,
                background: tokenColor.bg1,
                border: `1px solid ${hovered ? def.color : tokenColor.border}`,
                boxShadow: hovered ? shadow.md : shadow.xs,
                cursor: "pointer",
                userSelect: "none",
                fontSize: font.size.sm,
                color: tokenColor.text0,
                opacity: mounted ? (dimmed ? 0.4 : 1) : 0,
                transform: mounted
                  ? hovered
                    ? "scale(1.04)"
                    : "scale(1)"
                  : "scale(0.96)",
                transition:
                  "opacity 180ms ease-out, transform 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out",
                animation: mounted
                  ? `lv-chip-in 500ms cubic-bezier(0.22,1,0.28,1) both`
                  : "none",
                animationDelay: `${Math.min(600, idx * 16)}ms`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={`${chip.pkg.name} · ${chip.fileCount} files · ${def.label}`}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: radius.pill,
                  background: def.color,
                  flex: "0 0 auto",
                }}
              />
              <span
                style={{
                  fontWeight: font.weight.medium,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {chip.pkg.name}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: font.size.xxs,
                  color: tokenColor.text2,
                }}
              >
                {chip.fileCount}
              </span>
            </div>
          );
        })}

        {/* Keyframes */}
        <style>{`
          @keyframes lv-chip-in {
            0%   { opacity: 0; transform: translateY(4px) scale(0.96); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes lv-edge-in {
            0%   { stroke-dashoffset: 280; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

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
