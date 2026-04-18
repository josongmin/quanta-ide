import { memo } from "react";
import type { FileNode, Rect } from "@quanta/canvas-engine";
import { useGroundData } from "../hooks/use-ground-data";

interface GroundCardProps {
  file: FileNode;
  rect: Rect;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function GroundCardImpl({ file, rect, isSelected, onSelect }: GroundCardProps) {
  const { data, loading } = useGroundData(file.id);

  return (
    <div
      className={`ground-card${isSelected ? " ground-card--selected" : ""}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      onClick={() => { onSelect(file.id); }}
    >
      <div className="ground-card__header">
        <span className="ground-card__filename">{file.name}</span>
        <span className="ground-card__loc">{file.loc} LOC</span>
      </div>

      <div className="ground-card__body">
        {loading && (
          <div className="ground-card__placeholder">Loading…</div>
        )}
        {!loading && !data?.source && (
          <div className="ground-card__placeholder">—</div>
        )}
        {!loading && data?.source && (
          <pre className="ground-card__source">{data.source}</pre>
        )}
      </div>
    </div>
  );
}

// See StreetCard: same strategy. Ground cards are heavier (render source code)
// so blocking irrelevant re-renders is particularly important here.
export const GroundCard = memo(
  GroundCardImpl,
  (prev, next) =>
    prev.file.id === next.file.id &&
    prev.file === next.file &&
    prev.rect === next.rect &&
    prev.isSelected === next.isSelected &&
    prev.onSelect === next.onSelect,
);
