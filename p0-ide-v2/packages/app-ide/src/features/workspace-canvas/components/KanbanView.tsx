import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceGraph, FileNode } from "@quanta/canvas-engine";
import { interactionStore } from "../store/interaction-store";
import {
  reviewStateStore,
  useReviewStateStore,
  REVIEW_LANES,
  REVIEW_LANE_LABEL,
  type ReviewLane,
} from "../store/review-state-store";

interface Props {
  graph: WorkspaceGraph;
}

// Kanban overlay (review.kanban)
// -----------------------------------------------------------------
// When visible, this screen-space overlay covers the canvas with a
// three-column grid of file cards. Files are assigned to lanes via the
// review-state-store; unassigned files default to "todo".
//
// TRADEOFF: rather than re-layout the DOM card layer in world coords
// (which would require virtualization + ELK coordination), we render a
// flat screen-space grid on top. The underlying pan/zoom continues to
// work but is visually hidden behind the kanban overlay. This caps at
// 100 files (per spec) because the overlay does no virtualization.

const MAX_FILES = 100;

const LANE_ACCENT: Record<ReviewLane, string> = {
  todo:     "rgba(148, 163, 184, 0.4)",
  review:   "rgba(59, 130, 246, 0.5)",
  approved: "rgba(34, 197, 94, 0.5)",
};

export function KanbanView({ graph }: Props) {
  const visible = useReviewStateStore(s => s.kanbanVisible);
  const laneMap = useReviewStateStore(s => s.lanes);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ReviewLane | null>(null);

  const files = useMemo(() => {
    // Deterministic ordering: preserve graph order but cap at MAX_FILES.
    return graph.files.slice(0, MAX_FILES);
  }, [graph.files]);

  const overLimit = graph.files.length > MAX_FILES;

  const byLane = useMemo(() => {
    const out: Record<ReviewLane, FileNode[]> = { todo: [], review: [], approved: [] };
    for (const f of files) {
      const lane = laneMap[f.id] ?? "todo";
      out[lane].push(f);
    }
    return out;
  }, [files, laneMap]);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible) return;
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop, { capture: true, passive: false });
    el.addEventListener("pointerdown", stop, { capture: true });
    el.addEventListener("mousedown", stop, { capture: true });
    return () => {
      el.removeEventListener("wheel", stop, { capture: true });
      el.removeEventListener("pointerdown", stop, { capture: true });
      el.removeEventListener("mousedown", stop, { capture: true });
    };
  }, [visible]);

  const onDropLane = useCallback((lane: ReviewLane, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/file-id");
    if (!id) return;
    reviewStateStore.setLane(id, lane);
    setDragId(null);
    setDragOver(null);
  }, []);

  const onDragOver = useCallback((lane: ReviewLane, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== lane) setDragOver(lane);
  }, [dragOver]);

  if (!visible) return null;

  return (
    <div ref={panelRef} className="ws-kanban">
      <div className="ws-kanban__header">
        <span className="ws-kanban__title">Review Kanban</span>
        <span className="ws-kanban__meta">
          {files.length} files
          {overLimit && <span className="ws-kanban__warn"> (capped at {MAX_FILES})</span>}
        </span>
        <button
          type="button"
          className="ws-kanban__close"
          onClick={() => reviewStateStore.setKanbanVisible(false)}
          title="Close"
        >Close</button>
      </div>
      <div className="ws-kanban__columns">
        {REVIEW_LANES.map(lane => (
          <div
            key={lane}
            className={`ws-kanban__col${dragOver === lane ? " is-dragover" : ""}`}
            style={{ borderColor: LANE_ACCENT[lane] }}
            onDragOver={e => onDragOver(lane, e)}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => onDropLane(lane, e)}
          >
            <div className="ws-kanban__col-header" style={{ background: LANE_ACCENT[lane] }}>
              <span>{REVIEW_LANE_LABEL[lane]}</span>
              <span className="ws-kanban__col-count">{byLane[lane].length}</span>
            </div>
            <div className="ws-kanban__col-body">
              {byLane[lane].length === 0 && (
                <div className="ws-kanban__empty">drag file here</div>
              )}
              {byLane[lane].map(f => (
                <KanbanCard
                  key={f.id}
                  file={f}
                  onDragStart={() => setDragId(f.id)}
                  isDragging={dragId === f.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  file: FileNode;
  onDragStart: () => void;
  isDragging: boolean;
}

function KanbanCard({ file, onDragStart, isDragging }: CardProps) {
  const onDragStartInner = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/file-id", file.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStart();
  }, [file.id, onDragStart]);

  const onClick = useCallback(() => {
    interactionStore.selectFile(file.id);
  }, [file.id]);

  return (
    <div
      className={`ws-kanban__card${isDragging ? " is-dragging" : ""}`}
      draggable
      onDragStart={onDragStartInner}
      onClick={onClick}
      title={file.id}
    >
      <div className="ws-kanban__card-name">{file.name}</div>
      <div className="ws-kanban__card-meta">
        <span className="ws-kanban__card-layer">{file.layer}</span>
        <span className="ws-kanban__card-loc">{file.loc} loc</span>
        {file.riskScore >= 0.5 && (
          <span className="ws-kanban__card-risk">risk {(file.riskScore * 100).toFixed(0)}</span>
        )}
      </div>
    </div>
  );
}
