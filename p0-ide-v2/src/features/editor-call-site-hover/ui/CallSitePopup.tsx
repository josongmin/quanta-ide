import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CallSiteAnchor } from "../model/call-site-hover";

interface Props {
  anchor: CallSiteAnchor;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenFlow?: (pathId: string) => void;
}

const WIDTH = 340;

export function CallSitePopup({ anchor, onMouseEnter, onMouseLeave, onOpenFlow }: Props) {
  const { info, rect } = anchor;
  const [pos, setPos] = useState<CSSProperties>(() => compute(rect));
  useEffect(() => setPos(compute(rect)), [rect]);

  return (
    <div
      className="symtip callsite-tip"
      style={pos}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="symtip__head">
        <span className="symtip__glyph">→</span>
        <span className="symtip__name">{info.callee}</span>
        <span className="symtip__kind">call</span>
      </div>
      <div className="symtip__detail">
        <span className="callsite-tip__file">{info.calleeFile}</span>
      </div>

      {info.effects && info.effects.length > 0 && (
        <div className="callsite-tip__effects">
          {info.effects.map((e) => (
            <span key={e} className={`callsite-tip__fx callsite-tip__fx--${e.split(":")[0]}`}>{e}</span>
          ))}
          {info.async && <span className="callsite-tip__fx callsite-tip__fx--async">async</span>}
        </div>
      )}

      {info.taintPath && (
        <div className="callsite-tip__taint">
          <div className="callsite-tip__taint-head">
            <span className={`callsite-tip__sev callsite-tip__sev--${info.taintPath.severity}`}>
              sev {info.taintPath.severity}
            </span>
            {info.taintPath.owasp && (
              <span className="callsite-tip__owasp">{info.taintPath.owasp}</span>
            )}
          </div>
          <ol className="symtip__flow-steps">
            {info.taintPath.steps.map((s, i) => (
              <li key={i} className={`symtip__flow-step symtip__flow-step--${s.hop}`}>
                <span className="symtip__flow-line">L{s.line}</span>
                <span className="symtip__flow-sym">{s.symbol}</span>
                <span className="symtip__flow-hop">{s.hop}</span>
              </li>
            ))}
          </ol>
          {onOpenFlow && (
            <button
              type="button"
              className="callsite-tip__trace"
              onClick={() => onOpenFlow(info.taintPath!.id)}
            >
              open flow trace →
            </button>
          )}
        </div>
      )}

      <div className="symtip__foot">
        <span><span className="symtip__kbd">⏎</span>jump</span>
        <span><span className="symtip__kbd">⌘⇧S</span>simulate</span>
      </div>
    </div>
  );
}

function compute(rect: CallSiteAnchor["rect"]): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const estH = 280;
  const below = rect.bottom + estH + 8 < vh;
  const top = below ? rect.bottom - 3 : rect.top - estH + 3;
  let left = rect.left;
  if (left + WIDTH + 8 > vw) left = vw - WIDTH - 8;
  if (left < 8) left = 8;
  return { position: "fixed", top: Math.max(8, top), left, width: WIDTH, zIndex: 1000 };
}
