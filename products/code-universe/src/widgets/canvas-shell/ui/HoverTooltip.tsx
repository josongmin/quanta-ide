import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { useEntityState } from "../../../entities/entity";

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
  background: "rgba(17, 24, 39, 0.92)",
  color: "white",
  padding: "6px 10px",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.4,
  boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
  whiteSpace: "nowrap",
  maxWidth: 360,
};

export function HoverTooltip(): ReactElement | null {
  const hoveredId = useEntityState(s => s.interaction.hoveredId);
  const tree = useEntityState(s => s.tree);
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
      <div style={{ fontWeight: 600, color: "white" }}>
        {entity.name}
        <span style={{ marginLeft: 6, opacity: 0.65, fontWeight: 400 }}>{entity.kind}</span>
      </div>
      {entity.path && (
        <div style={{ opacity: 0.65, fontSize: 10, marginTop: 2 }}>{entity.path}</div>
      )}
      {rows.length > 0 && (
        <div style={{ opacity: 0.85, fontSize: 10, marginTop: 4 }}>{rows.join(" · ")}</div>
      )}
    </div>
  );
}
