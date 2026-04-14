import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { HoverAnchor } from "./symbol-hover";

const KIND_LABEL: Record<string, string> = {
  class: "class",
  function: "function",
  method: "method",
  variable: "var",
  parameter: "param",
  module: "module",
};

const KIND_GLYPH: Record<string, string> = {
  class: "C",
  function: "ƒ",
  method: "m",
  variable: "v",
  parameter: "p",
  module: "M",
};

function riskTone(score: number): string {
  if (score >= 70) return "symtip__risk--high";
  if (score >= 40) return "symtip__risk--mid";
  return "";
}

interface Props {
  anchor: HoverAnchor;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenFlow?: () => void;
  onJumpLine?: (line: number) => void;
}

const WIDTH = 320;
const OVERLAP = 3;

export function SymbolPopup({ anchor, onMouseEnter, onMouseLeave, onOpenFlow, onJumpLine }: Props) {
  const { info, rect } = anchor;
  const [pos, setPos] = useState<CSSProperties>(() => computePos(rect));

  useEffect(() => {
    setPos(computePos(rect));
  }, [rect]);

  return (
    <div
      className="symtip"
      style={pos}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="symtip__head">
        <span className="symtip__glyph">{KIND_GLYPH[info.kind] ?? "?"}</span>
        <span className="symtip__name">{info.name}</span>
        <span className="symtip__kind">{KIND_LABEL[info.kind] ?? info.kind}</span>
        {info.riskScore !== undefined && info.riskScore > 0 && (
          <span className={`symtip__risk ${riskTone(info.riskScore)}`}>
            {info.riskScore}
          </span>
        )}
      </div>

      {info.detail && <div className="symtip__detail">{info.detail}</div>}

      {info.taint && (
        <div className={`symtip__taint symtip__taint--${info.taint}`}>
          taint · {info.taint}
        </div>
      )}

      {info.flowsTo && info.flowsTo.length > 0 && (
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
            {info.flowsTo.slice(0, 4).map((s, i) => (
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
      )}

      <div className="symtip__metrics">
        {info.complexity !== undefined && (
          <span className="symtip__chip">
            cpx {info.complexity.toFixed(1)}
            {info.bigO && <span className="symtip__chip-sub"> · {info.bigO}</span>}
          </span>
        )}
        {info.callers !== undefined && (
          <span className="symtip__chip">callers {info.callers}</span>
        )}
        {info.callees !== undefined && (
          <span className="symtip__chip">callees {info.callees}</span>
        )}
        {info.tests && (
          <span
            className={`symtip__chip${info.tests.startsWith("0/") && info.tests !== "0/0" ? " is-bad" : ""}`}
          >
            tests {info.tests}
          </span>
        )}
        {info.dead && <span className="symtip__chip is-muted">dead</span>}
      </div>

      {info.tags && info.tags.length > 0 && (
        <div className="symtip__tags">
          {info.tags.map((t) => (
            <span key={t} className="symtip__tag">{t}</span>
          ))}
        </div>
      )}

      {info.blame && (
        <div className="symtip__blame">
          <span className="symtip__at">@</span>
          {info.blame.author.replace("@", "")}
          <span className="symtip__sep">·</span>
          {info.blame.when}
        </div>
      )}

      <div className="symtip__foot">
        <span><span className="symtip__kbd">⏎</span>open</span>
        <span><span className="symtip__kbd">⌘F</span>find usages</span>
        <span><span className="symtip__kbd">⌘E</span>ask agent</span>
      </div>
    </div>
  );
}

function computePos(rect: HoverAnchor["rect"]): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const estH = 280;
  const below = rect.bottom + estH + 8 < vh;
  const top = below ? rect.bottom - OVERLAP : rect.top - estH + OVERLAP;
  let left = rect.left;
  if (left + WIDTH + 8 > vw) left = vw - WIDTH - 8;
  if (left < 8) left = 8;
  return {
    position: "fixed",
    top: Math.max(8, top),
    left,
    width: WIDTH,
    zIndex: 1000,
  };
}
