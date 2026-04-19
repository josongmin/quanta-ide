import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { GraphSnapshot, WorkspaceGraph } from "@quanta/canvas-engine";
import { extractActiveCanvasThumbnail } from "@quanta/canvas-pixi";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { commitThumbnailsStore, useCommitThumbnail } from "../store/commit-thumbnails-store";
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
//  - Pointer scrub reads pre-computed cell x-ranges via index math rather
//    than iterating the DOM on every pointermove. The x-range layout is
//    memoized on commit count + container width so drag costs are O(1).

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
  // Hash prefers the explicit author name (rich histories + git sources
  // populate this), falling back to sha/label so placeholder snapshots
  // still get a stable but varied hue.
  const src = snapshot.author ?? snapshot.commitSha ?? snapshot.label ?? "";
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

function messageFor(s: GraphSnapshot): string {
  return s.message ?? s.label;
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
      message: messageFor(s),
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
      message: messageFor(s),
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
  const railRef = useRef<HTMLDivElement>(null);

  // Thumbnail capture — after the scrub settles, grab a low-res snapshot
  // of the live Pixi canvas and stash it under the active commit's
  // shortSha so future hovers light up with a real preview. Kept out of
  // the hot scrub path by a 220ms debounce and by skipping captures when
  // a fingerprint-matching thumb already exists.
  useEffect(() => {
    if (!enabled) return;
    const snap = graph.history?.snapshots[snapshotIndex];
    if (!snap) return;
    const shortSha = snap.commitSha?.slice(0, 7)
      ?? `s${snapshotIndex.toString(16).padStart(3, "0")}`;
    const fingerprint = `snap:${snapshotIndex}`;
    const existing = commitThumbnailsStore.getThumbnail(shortSha);
    if (existing?.fingerprint === fingerprint && existing.dataUrl) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const dataUrl = await extractActiveCanvasThumbnail(160);
      if (cancelled || !dataUrl) return;
      commitThumbnailsStore.capture(shortSha, {
        sha: snap.commitSha ?? shortSha,
        dataUrl,
        capturedAt: Date.now(),
        fingerprint,
      });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [enabled, snapshotIndex, graph.history]);

  const cells = useMemo(() => buildCells(graph.history), [graph.history]);

  // Container width is tracked via ResizeObserver so the memoized cell
  // layout stays invariant across pointer events (no getBoundingClientRect
  // inside the hot path). Initial 0 is fine — the layout effect below
  // will set the real width before interactions.
  const [railWidth, setRailWidth] = useState(0);

  useLayoutEffect(() => {
    const el = railRef.current;
    if (!el) return;
    // Seed synchronously so the first pointer event has a valid layout.
    setRailWidth(el.getBoundingClientRect().width);
  }, [cells.length]);

  useEffect(() => {
    const el = railRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setRailWidth(prev => (Math.abs(prev - w) < 0.5 ? prev : w));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pre-compute each cell's horizontal extent once per (count, width)
  // tuple. The pointer handlers then map clientX → cellArrayIndex via a
  // single divide instead of iterating every rect.
  interface CellLayout {
    readonly cellWidth: number;
    readonly commitIndices: readonly number[];
  }
  const layout = useMemo<CellLayout>(() => {
    const count = cells.length;
    if (count === 0 || railWidth <= 0) {
      return { cellWidth: 0, commitIndices: [] };
    }
    return {
      cellWidth: railWidth / count,
      commitIndices: cells.map(c => c.index),
    };
  }, [cells, railWidth]);

  const setIndex = useCallback((index: number): void => {
    const max = (graph.history?.snapshots.length ?? 1) - 1;
    const clamped = Math.max(0, Math.min(max, index));
    // Flip to live so use-scene-derivations actually materialises the
    // snapshot's edge set — scrubbing without this is a silent no-op.
    interactionStore.setTemporalMode("live");
    interactionStore.setSnapshotIndex(clamped);
  }, [graph.history]);

  // Pointer scrub: element captures pointer on down, setting the index for
  // each cell the pointer enters. Release drops capture. Per-move work is
  // a constant-time index math lookup against the memoized layout.
  const dragging = useRef(false);

  const pickCellFromPoint = useCallback((clientX: number): number | null => {
    const rail = railRef.current;
    const { cellWidth, commitIndices } = layout;
    if (!rail || cellWidth <= 0 || commitIndices.length === 0) return null;
    const r = rail.getBoundingClientRect();
    const local = clientX - r.left;
    if (local < 0 || local > r.width) return null;
    const arrayIdx = Math.max(
      0,
      Math.min(commitIndices.length - 1, Math.floor(local / cellWidth)),
    );
    return commitIndices[arrayIdx];
  }, [layout]);

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
      <div ref={railRef} className="ws-filmstrip__rail">
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
  // Subscribe so the tile re-renders when a capture lands after the scrub
  // settle debounce. Store writes are bounded (one per settled snapshot)
  // so the extra subscription is cheap.
  const thumb = useCommitThumbnail(cell.shortSha);
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
