import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { useEntityState } from "../../../entities/entity";
import { useTierState } from "../../../entities/tier";
import { color, font, kindColor, kindLabel, radius, shadow, space } from "../../../shared/ui/tokens";

// HoverTooltip
// --------------------------------------------------------------------
// Follows the cursor while hovering an entity and shows kind / path /
// metric summary. Rendered outside the SVG so it can overflow the
// viewport bounds without clipping. Pointer-events none so it never
// interferes with the viewport's drag / click flow.
//
// Subscribes to the module-level entity store (hover id) and a
// window-level mousemove listener — the viewport doesn't have to
// thread any extra props for this to work.

const STYLE_ROOT: CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: 50,
  // Near-black surface with a faint inner highlight — reads as a
  // "polished chip" rather than a gray box. Backdrop-blur softens
  // whatever the canvas is showing underneath.
  background: "rgba(10, 10, 10, 0.94)",
  color: color.bg0,
  padding: `${space[2]}px ${space[3]}px`,
  borderRadius: radius.md,
  fontSize: font.size.sm,
  fontFamily: font.sans,
  lineHeight: 1.35,
  letterSpacing: -0.05,
  boxShadow: `${shadow.lg}, inset 0 1px 0 rgba(255,255,255,0.06)`,
  whiteSpace: "nowrap",
  maxWidth: 360,
  backdropFilter: "blur(8px) saturate(140%)",
  WebkitBackdropFilter: "blur(8px) saturate(140%)",
};

export function HoverTooltip(): ReactElement | null {
  const hoveredId = useEntityState(s => s.interaction.hoveredId);
  const expandedFolderId = useEntityState(s => s.interaction.expandedFolderId);
  const tree = useEntityState(s => s.tree);
  const activeTierKind = useTierState(s => s.activeTier.visibleKind);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Track the cursor as long as something is hovered. Detaching the
  // listener when no hover is active keeps the idle path free.
  useEffect(() => {
    if (!hoveredId) {
      setPos(null);
      return;
    }
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [hoveredId]);

  if (!hoveredId || !pos || !tree) return null;
  const entity = tree.byId.get(hoveredId);
  if (!entity) return null;

  const rows: string[] = [];
  if (entity.metrics?.loc !== undefined) rows.push(`loc ${entity.metrics.loc}`);
  if (entity.metrics?.riskScore !== undefined) rows.push(`risk ${entity.metrics.riskScore}`);
  if (entity.metrics?.fileCount !== undefined && entity.metrics.fileCount > 0) {
    rows.push(`${entity.metrics.fileCount} files`);
  }
  if (entity.metrics?.childCount !== undefined && entity.metrics.childCount > 0) {
    rows.push(`${entity.metrics.childCount} children`);
  }

  // Offset so the tooltip sits below-right of the cursor; flip to
  // above-left if it would leave the viewport. 18px gap avoids the
  // cursor's own glyph.
  const GAP = 18;
  const est_w = 200;
  const est_h = 56;
  const overflowX = pos.x + GAP + est_w > window.innerWidth;
  const overflowY = pos.y + GAP + est_h > window.innerHeight;
  const left = overflowX ? pos.x - GAP - est_w : pos.x + GAP;
  const top = overflowY ? pos.y - GAP - est_h : pos.y + GAP;

  return (
    <div style={{ ...STYLE_ROOT, left, top }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: radius.pill,
            background: kindColor[entity.kind],
            flexShrink: 0,
            boxShadow: `0 0 0 2px rgba(${kindColor[entity.kind].replace("#", "")}, 0.0)`,
          }}
        />
        <span style={{ fontWeight: font.weight.semibold, color: color.bg0 }}>
          {entity.name}
        </span>
        <span
          style={{
            marginLeft: space[1],
            opacity: 0.55,
            fontSize: font.size.xs,
            fontWeight: font.weight.medium,
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
          }}
        >
          {kindLabel[entity.kind]}
        </span>
      </div>
      {entity.path && (
        <div
          style={{
            opacity: 0.58,
            fontSize: font.size.xs,
            fontFamily: font.mono,
            marginTop: space[1],
            letterSpacing: 0,
          }}
        >
          {entity.path}
        </div>
      )}
      {rows.length > 0 && (
        <div
          style={{
            opacity: 0.82,
            fontSize: font.size.xs,
            marginTop: space[2],
            paddingTop: space[1],
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rows.join("   ·   ")}
        </div>
      )}
      {activeTierKind === "street" && entity.kind === "street" && (
        <div
          style={{
            opacity: 0.72,
            fontSize: font.size.xs,
            marginTop: space[2],
            paddingTop: space[1],
            borderTop: "1px solid rgba(255,255,255,0.08)",
            letterSpacing: 0,
            display: "flex",
            gap: space[2],
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: font.mono, opacity: 0.82 }}>
            {expandedFolderId === entity.id ? "Click" : "Click"}
          </span>
          <span>
            {expandedFolderId === entity.id ? "collapse" : "expand inline"}
          </span>
          <span style={{ opacity: 0.32 }}>·</span>
          <span style={{ fontFamily: font.mono, opacity: 0.82 }}>Dblclick</span>
          <span>drill in</span>
        </div>
      )}
    </div>
  );
}
