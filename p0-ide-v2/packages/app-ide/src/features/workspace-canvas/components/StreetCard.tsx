import { memo } from "react";
import type { FileNode, Rect } from "@quanta/canvas-engine";

interface StreetCardProps {
  file: FileNode;
  rect: Rect;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function riskColor(score: number): string {
  if (score >= 70) return "#fca5a5";
  if (score >= 40) return "#fde68a";
  return "#bbf7d0";
}

function cpxColor(cpx: number): string {
  if (cpx >= 10) return "#fca5a5";
  if (cpx >= 5)  return "#fde68a";
  return "#bbf7d0";
}

function StreetCardImpl({ file, rect, isSelected, onSelect }: StreetCardProps) {
  const HEADER_H = 32;
  const FOOTER_H = 20;
  const ROW_H    = 22;

  const bodyHeight = rect.h - HEADER_H - FOOTER_H;
  const maxRows    = Math.max(0, Math.floor(bodyHeight / ROW_H));
  const visibleFns = file.functions.slice(0, maxRows);

  return (
    <div
      className={`street-card${isSelected ? " street-card--selected" : ""}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      onClick={() => { onSelect(file.id); }}
    >
      <div className="street-card__header">
        <span className="street-card__filename" title={file.name}>
          {file.name}
        </span>
        <span
          className="street-card__risk"
          style={{ background: riskColor(file.riskScore) }}
        >
          {file.riskScore}
        </span>
      </div>

      <div className="street-card__fns">
        {visibleFns.map(fn => (
          <div key={fn.name} className="street-card__fn-row">
            <span className="street-card__fn-name" title={fn.name}>
              {fn.name}
            </span>
            <span
              className="street-card__fn-cpx"
              style={{ background: cpxColor(fn.complexity) }}
            >
              {fn.complexity}
            </span>
          </div>
        ))}
      </div>

      <div className="street-card__footer">
        <span className="street-card__loc">{file.loc} LOC</span>
      </div>
    </div>
  );
}

// Custom comparator: visibleScene rebuilds may yield a fresh FileNode object
// even when the file's identity/content is unchanged. Compare by id + rect
// reference + isSelected + onSelect stability so re-renders are strictly tied
// to visible state. (Rect is reference-stable per layout; see layout/types.)
export const StreetCard = memo(
  StreetCardImpl,
  (prev, next) =>
    prev.file.id === next.file.id &&
    prev.file === next.file &&
    prev.rect === next.rect &&
    prev.isSelected === next.isSelected &&
    prev.onSelect === next.onSelect,
);
