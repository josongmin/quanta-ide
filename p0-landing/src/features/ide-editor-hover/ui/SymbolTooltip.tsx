import { useEditorHover } from "../model/useEditorHover";

export function SymbolTooltip() {
  const hovered = useEditorHover((s) => s.hoveredSymbol);
  if (!hovered) return null;

  const { info, x, y } = hovered;
  const TT_WIDTH = 280;
  const TT_GAP = 12;
  const left = Math.min(window.innerWidth - TT_WIDTH - 16, x + TT_GAP);
  const top = y + TT_GAP;

  return (
    <div className="symtip" style={{ left, top, width: TT_WIDTH }}>
      <div className="symtip-head">
        <span className="symtip-kind">{info.kind}</span>
        <span className="symtip-name">{info.name}</span>
      </div>
      <div className="symtip-body">
        {info.taint && (
          <div className="symtip-row">
            <span className="symtip-k">Taint</span>
            <span className="symtip-v" data-tone={info.taint === "source" || info.taint === "sink" ? "warn" : "ink"}>
              {info.taint}
            </span>
          </div>
        )}
        {info.origin && (
          <div className="symtip-row">
            <span className="symtip-k">Origin</span>
            <span className="symtip-v symtip-mono">{info.origin}</span>
          </div>
        )}
        {info.flowsTo && (
          <div className="symtip-row">
            <span className="symtip-k">Flows to</span>
            <span className="symtip-v symtip-mono">{info.flowsTo}</span>
          </div>
        )}
        {info.callers !== undefined && (
          <div className="symtip-row">
            <span className="symtip-k">Callers</span>
            <span className="symtip-v">{info.callers}</span>
          </div>
        )}
        {info.complexity !== undefined && (
          <div className="symtip-row">
            <span className="symtip-k">Complexity</span>
            <span className="symtip-v">{info.complexity.toFixed(1)}</span>
          </div>
        )}
        {info.blame && (
          <div className="symtip-row">
            <span className="symtip-k">Blame</span>
            <span className="symtip-v">
              {info.blame.author} <span className="symtip-dim">· {info.blame.when}</span>
            </span>
          </div>
        )}
      </div>
      <div className="symtip-foot">
        <span className="symtip-kbd">⌘.</span> show flow
        <span className="symtip-kbd">⌘F</span> fix
      </div>
    </div>
  );
}
