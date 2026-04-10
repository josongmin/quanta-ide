import { useEditorHover } from "../model/useEditorHover";
import { smartPos } from "../model/useSmartPos";

export function LineTooltip() {
  const hovered = useEditorHover((s) => s.hoveredLine);
  const hoveredSymbol = useEditorHover((s) => s.hoveredSymbol);
  if (!hovered?.summary || hoveredSymbol) return null;
  const x = hovered.x ?? 80;
  const y = hovered.y ?? 80;
  const TT_WIDTH = 380;
  const ESTIMATED_H = 80;
  const { left, top } = smartPos(x, y, TT_WIDTH, ESTIMATED_H);

  return (
    <div className="symtip" style={{ left, top, width: TT_WIDTH }}>
      <div className="symtip-head">
        <span className="symtip-kind-glyph" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--ink-4)" }}>L{hovered.lineNo}</span>
        <span className="symtip-name" style={{ fontSize: "0.75rem" }}>{hovered.summary}</span>
      </div>
      {hovered.detail && (
        <div className="symtip-detail">{hovered.detail}</div>
      )}
    </div>
  );
}
