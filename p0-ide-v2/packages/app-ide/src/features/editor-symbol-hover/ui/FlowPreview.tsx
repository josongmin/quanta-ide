import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";

export function FlowPreview({
  flowsTo,
  onOpenFlow,
  onJumpLine,
}: {
  flowsTo: NonNullable<SymbolFacts["flowsTo"]>;
  onOpenFlow?: () => void;
  onJumpLine?: (line: number) => void;
}) {
  return (
    <div className="symtip__flow">
      <div className="symtip__flow-head">
        <span>flow</span>
        {onOpenFlow && (
          <button type="button" className="symtip__flow-more" onClick={onOpenFlow}>
            trace →
          </button>
        )}
      </div>
      <ol className="symtip__flow-steps">
        {flowsTo.slice(0, 4).map((s, i) => (
          <li key={i} className="symtip__flow-step">
            <button
              type="button"
              className="symtip__flow-line"
              onClick={() => onJumpLine?.(s.line)}
              title={`Jump to line ${s.line}`}
            >
              L{s.line}
            </button>
            <span className="symtip__flow-hop">{s.hop}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
