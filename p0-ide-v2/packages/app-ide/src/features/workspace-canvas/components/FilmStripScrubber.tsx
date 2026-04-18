import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { GraphSnapshot, WorkspaceGraph } from "@quanta/canvas-engine";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { commitThumbnailsStore } from "../store/commit-thumbnails-store";
import { useFeature } from "../store/feature-flags-store";

interface Props {
  graph: WorkspaceGraph;
}

// Film strip scrubber (temporal.filmStrip)
// ─────────────────────────────────────────────────────────────────────
// Horizontal strip pinned at the bottom of the canvas. Each cell = one
// commit snapshot; clicking or dragging over a cell sets the snapshot
// index on the interaction store. Left/right arrows step; Home/End jump.
// Thumbnails come from commitThumbnailsStore (owned by T1) — we render a
// grey placeholder tile when the thumbnail isn't captured yet.
//
// Design notes:
//  - Rendered unconditionally when gated; the wrapper in MultiFileCanvas
//    is responsible for the feature gate so a disabled feature costs zero
//    React work per viewport tick.
//  - The cell count is capped at MAX_CELLS to keep the strip readable at
//    monitor widths; overflow is shown via horizontal scroll.
//  - Keyboard events are captured at the strip root so the user can
//    focus the strip (tabindex) and scrub without touching the mouse.

const MAX_CELLS = 30;

interface CellDatum {
  snapshot: GraphSnapshot;
  index: number;
  shortSha: string;
  message: string;
  authorColor: string;
  timestamp: number;
}

function authorColorFor(snapshot: GraphSnapshot): string {
  // Snapshots carry a label + optional sha but no dedicated author field;
  // hash the label so the dot color is stable but visually varied.
  const src = snapshot.commitSha ?? snapshot.label ?? "";
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = h % 360;
  return `hsl(${hue.toFixed(0)}, 65%, 55%)`;
}

function shortShaFor(s: GraphSnapshot, index: number): string {
  if (s.commitSha) return s.commitSha.slice(0, 7);
  return `s${index.toString(16).padStart(3, "0")}`;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toISOString().replace("T", " ").slice(0, 16);
  } catch {
    return String(ts);
  }
}

function buildCells(history: WorkspaceGraph["history"]): CellDatum[] {
  if (!history || history.snapshots.length === 0) return [];
  // Evenly sample up to MAX_CELLS, but always keep the first and last.
  const snaps = history.snapshots;
  const N = snaps.length;
  if (N <= MAX_CELLS) {
    return snaps.map((s, i) => ({
      snapshot: s,
      index: i,
      shortSha: shortShaFor(s, i),
      message: s.label,
      authorColor: authorColorFor(s),
      timestamp: s.timestamp,
    }));
  }
  const out: CellDatum[] = [];
  for (let k = 0; k < MAX_CELLS; k++) {
    const idx = Math.round((k / (MAX_CELLS - 1)) * (N - 1));
    const s = snaps[idx];
    out.push({
      snapshot: s,
      index: idx,
      shortSha: shortShaFor(s, idx),
      message: s.label,
      authorColor: authorColorFor(s),
      timestamp: s.timestamp,
    });
  }
  return out;
}

function FilmStripScrubberImpl({ graph }: Props) {
  const enabled = useFeature("temporal.filmStrip");
  const snapshotIndex = useInteractionStore(s => s.temporal.snapshotIndex);
  const rootRef = useRef<HTMLDivElement>(null);

  const cells = useMemo(() => buildCells(graph.history), [graph.history]);

  const setIndex = useCallback((index: number): void => {
    const max = (graph.history?.snapshots.length ?? 1) - 1;
    const clamped = Math.max(0, Math.min(max, index));
    interactionStore.setSnapshotIndex(clamped);
  }, [graph.history]);

  // Pointer scrub: element captures pointer on down, setting the index for
  // each cell the pointer enters. Release drops capture. This is a lot
  // cheaper than wiring mousemove on each cell because the work per move
  // is just a closest-cell lookup on the pointerId root.
  const dragging = useRef(false);
  const pickCellFromPoint = useCallback((clientX: number): number | null => {
    const root = rootRef.current;
    if (!root) return null;
    const cellEls = root.querySelectorAll<HTMLButtonElement>(".ws-filmstrip__cell");
    for (let i = 0; i < cellEls.length; i++) {
      const r = cellEls[i].getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) {
        const idxAttr = cellEls[i].dataset.index;
        if (idxAttr !== undefined) return Number(idxAttr);
      }
    }
    return null;
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const idx = pickCellFromPoint(e.clientX);
    if (idx === null) return;
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setIndex(idx);
  }, [pickCellFromPoint, setIndex]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const idx = pickCellFromPoint(e.clientX);
    if (idx !== null) setIndex(idx);
  }, [pickCellFromPoint, setIndex]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const n = graph.history?.snapshots.length ?? 0;
    if (n === 0) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setIndex(snapshotIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        setIndex(snapshotIndex + 1);
        break;
      case "Home":
        e.preventDefault();
        setIndex(0);
        break;
      case "End":
        e.preventDefault();
        setIndex(n - 1);
        break;
    }
  }, [graph.history, snapshotIndex, setIndex]);

  if (!enabled) return null;
  if (!graph.history || graph.history.snapshots.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="ws-filmstrip"
      tabIndex={0}
      role="slider"
      aria-label="Commit film strip"
      aria-valuemin={0}
      aria-valuemax={graph.history.snapshots.length - 1}
      aria-valuenow={snapshotIndex}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <div className="ws-filmstrip__rail">
        {cells.map(cell => (
          <FilmStripCell
            key={cell.index}
            cell={cell}
            active={cell.index === snapshotIndex}
          />
        ))}
      </div>
    </div>
  );
}

interface CellProps {
  cell: CellDatum;
  active: boolean;
}

const FilmStripCell = memo(function FilmStripCell({ cell, active }: CellProps) {
  // Peek at the thumbnail store each render — we don't subscribe here
  // because the strip as a whole is cheap to re-render and T1 will bump
  // the store (which re-renders the parent) whenever a tile is captured.
  const thumb = commitThumbnailsStore.getThumbnail(cell.shortSha);
  const [tipOpen, setTipOpen] = useState(false);

  const style: CSSProperties = thumb?.dataUrl
    ? { backgroundImage: `url(${thumb.dataUrl})` }
    : {};

  const cls = `ws-filmstrip__cell${active ? " is-active" : ""}`;
  return (
    <button
      type="button"
      data-index={cell.index}
      className={cls}
      style={style}
      onMouseEnter={() => setTipOpen(true)}
      onMouseLeave={() => setTipOpen(false)}
    >
      {!thumb?.dataUrl && <span className="ws-filmstrip__cell-ph" />}
      <span className="ws-filmstrip__cell-meta">
        <span
          className="ws-filmstrip__dot"
          style={{ background: cell.authorColor }}
          aria-hidden="true"
        />
        <span className="ws-filmstrip__cell-sha">{cell.shortSha}</span>
      </span>
      <span className="ws-filmstrip__cell-msg">{cell.message}</span>
      {tipOpen && (
        <span className="ws-filmstrip__tooltip" role="tooltip">
          <strong>{cell.shortSha}</strong>
          <br />
          {cell.message}
          <br />
          <em>{formatTime(cell.timestamp)}</em>
        </span>
      )}
    </button>
  );
});

export const FilmStripScrubber = memo(FilmStripScrubberImpl);

// Convenient selector: tiny hook that other temporal surfaces can use to
// know whether the film strip is actually mounted (for stacking purposes).
export function useFilmStripEnabled(): boolean {
  return useFeature("temporal.filmStrip");
}
