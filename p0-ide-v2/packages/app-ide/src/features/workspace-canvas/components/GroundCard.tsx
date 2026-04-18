import type { FileNode, Rect } from "@quanta/canvas-engine";
import { useGroundData } from "../hooks/use-ground-data";

interface GroundCardProps {
  file: FileNode;
  rect: Rect;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function GroundCard({ file, rect, isSelected, onSelect }: GroundCardProps) {
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
