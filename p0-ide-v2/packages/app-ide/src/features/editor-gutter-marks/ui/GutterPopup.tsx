import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { GutterHoverAnchor } from "../model/gutter-marks";
import { GLYPH_META } from "../model/glyph-meta";

interface Props {
  anchor: GutterHoverAnchor;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onActivate: () => void;
}

const WIDTH = 280;

export function GutterPopup({ anchor, onMouseEnter, onMouseLeave, onActivate }: Props) {
  const meta = GLYPH_META[anchor.glyph];
  const pos: CSSProperties = useMemo(() => compute(anchor.rect), [anchor.rect]);

  return (
    <div
      className={`symtip gmtip gmtip--${meta.severity}`}
      style={pos}
      role="dialog"
      aria-label={`${meta.label}: ${anchor.title}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="symtip__head gmtip__head">
        <span className="gmtip__glyph" aria-hidden="true" />
        <span className="symtip__name">{meta.label}</span>
        <span className="symtip__kind">L{anchor.line}</span>
      </div>

      <div className="symtip__detail gmtip__detail">{anchor.title}</div>

      <div className="gmtip__why">
        <span className="symtip__why-mark">↳ why</span>
        <span className="symtip__why-label">{meta.why}</span>
      </div>

      <button type="button" className="gmtip__action" onClick={onActivate}>
        {meta.actionLabel} →
      </button>

      <div className="symtip__foot">
        <span><span className="symtip__kbd">⏎</span>{meta.actionLabel.toLowerCase()}</span>
        <span><span className="symtip__kbd">⌘E</span>ask agent</span>
      </div>
    </div>
  );
}

function compute(rect: GutterHoverAnchor["rect"]): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const estH = 180;
  const below = rect.bottom + estH + 8 < vh;
  const top = below ? rect.bottom + 6 : rect.top - estH - 6;
  // Anchor to the right edge of the icon, offset slightly.
  let left = rect.right + 8;
  if (left + WIDTH + 8 > vw) left = vw - WIDTH - 8;
  if (left < 8) left = 8;
  return { position: "fixed", top: Math.max(8, top), left, width: WIDTH, zIndex: 1000 };
}
