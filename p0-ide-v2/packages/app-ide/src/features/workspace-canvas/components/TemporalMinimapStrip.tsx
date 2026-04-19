import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GraphHistory } from "@quanta/canvas-engine";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { featureFlagsStore } from "../store/feature-flags-store";
import { useFeature } from "../store/feature-flags-store";
import { buildBuckets, bucketIndexForCommit } from "../lib/temporal-bucket";

interface Props {
  history: GraphHistory | undefined;
  /** Must match the Minimap box width so the strip visually anchors to it. */
  width: number;
}

// TemporalMinimapStrip (temporal.minimapStrip)
// ─────────────────────────────────────────────────────────────────────
// A short pixel strip rendered underneath the minimap. Each column is one
// *bucket* of commits; the column's color encodes aggregated churn. Clicks
// jump the snapshot index to the representative commit of the bucket.
//
// The strip handles all commits, not just the ~30 rendered by the film
// strip, so long histories are visible at-a-glance as a density band.
// For histories ≤ BUCKET_CAP the bucketing collapses to 1:1, preserving
// behavior; for longer histories columns aggregate so the strip still
// fits in a single minimap-width canvas.
// When power.smoothCamera is on, the interaction store update is the
// signal — the actual camera easing is handled elsewhere by the scene
// reacting to the new snapshot index.

const STRIP_HEIGHT = 8; // a hair taller than 1px so clicks actually hit

function churnColor(heat: number): string {
  // Green (low) → amber → red (high). Piecewise-linear in HSL.
  const h = heat <= 0.5
    ? 120 - (120 - 45) * (heat / 0.5)       // green 120 → amber 45
    : 45  - 45            * ((heat - 0.5) / 0.5); // amber 45 → red 0
  const l = 55 - heat * 10;
  return `hsl(${h.toFixed(0)}, 75%, ${l.toFixed(0)}%)`;
}

function TemporalMinimapStripImpl({ history, width }: Props) {
  const enabled = useFeature("temporal.minimapStrip");
  const snapshotIndex = useInteractionStore(s => s.temporal.snapshotIndex);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; text: string } | null>(null);

  // Bucketing is keyed only on the snapshot list — independent of width
  // and selectedIndex so resizing / scrubbing never rebuilds buckets.
  const layout = useMemo(() => {
    if (!history) return { buckets: [], maxChurn: 1 };
    return buildBuckets(history.snapshots);
  }, [history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cssW = width;
    const cssH = STRIP_HEIGHT;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const buckets = layout.buckets;
    const B = buckets.length;
    if (B === 0) return;
    const colW = cssW / B;
    for (let i = 0; i < B; i++) {
      const heat = Math.min(1, buckets[i].churn / layout.maxChurn);
      ctx.fillStyle = churnColor(heat);
      // +0.5 avoids hairline gaps when colW is fractional.
      ctx.fillRect(i * colW, 0, Math.max(1, colW + 0.5), cssH);
    }

    // Highlight the active bucket (the one containing the selected commit).
    const N = history.snapshots.length;
    if (N > 0 && snapshotIndex >= 0 && snapshotIndex < N) {
      const bIdx = bucketIndexForCommit(snapshotIndex, N, B);
      const x = bIdx * colW;
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(x, 0, Math.max(1, colW), 1);
      ctx.fillRect(x, cssH - 1, Math.max(1, colW), 1);
    }
  }, [history, layout, snapshotIndex, width]);

  /** Map a pointer X to the bucket index beneath it. */
  const bucketForX = useCallback((clientX: number): number | null => {
    const canvas = canvasRef.current;
    const B = layout.buckets.length;
    if (!canvas || B === 0) return null;
    const r = canvas.getBoundingClientRect();
    const frac = (clientX - r.left) / Math.max(1, r.width);
    return Math.max(0, Math.min(B - 1, Math.floor(frac * B)));
  }, [layout]);

  const onClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const bIdx = bucketForX(e.clientX);
    if (bIdx === null) return;
    const bucket = layout.buckets[bIdx];
    if (!bucket) return;
    // Flip to live so scene derivations react; see FilmStripScrubber.
    interactionStore.setTemporalMode("live");
    // Round-trip: click → bucket → representative commit. The
    // representative is the middle commit of the bucket so the scrub lands
    // on the visual center of the column, not an edge.
    interactionStore.setSnapshotIndex(bucket.representativeIndex);
    // If the smooth-camera power feature is on, we leave the actual
    // camera animation to the scene-level code that reacts to the new
    // snapshot (which also applies on arrow-key scrubs, etc.). The
    // lookup here just documents the dependency for future readers.
    void featureFlagsStore.isEnabled("power.smoothCamera");
  }, [bucketForX, layout]);

  const onMouseMove = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const bIdx = bucketForX(e.clientX);
    if (bIdx === null || !history) { setTooltip(null); return; }
    const bucket = layout.buckets[bIdx];
    if (!bucket) { setTooltip(null); return; }
    const s = history.snapshots[bucket.representativeIndex];
    const sha = s.commitSha
      ? s.commitSha.slice(0, 7)
      : `s${bucket.representativeIndex.toString(16).padStart(3, "0")}`;
    // Show a commit-range suffix when the bucket covers multiple commits so
    // the user knows they are scrubbing aggregated history.
    const range = bucket.startIndex === bucket.endIndex
      ? ""
      : ` (+${bucket.endIndex - bucket.startIndex} more)`;
    const summary = s.message ?? s.label;
    setTooltip({ x: e.nativeEvent.offsetX, text: `${sha} · ${summary}${range}` });
  }, [history, bucketForX, layout]);

  const onMouseLeave = useCallback(() => setTooltip(null), []);

  // Keyboard scrub — ←/→ step by one commit, Shift+←/→ jump 10, Home/End
  // go to the ends. Mirrors click semantics so keyboard users can walk
  // the history without a pointing device.
  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (!history || history.snapshots.length === 0) return;
    const N = history.snapshots.length;
    const idx = snapshotIndex < 0 ? 0 : snapshotIndex;
    let next: number;
    switch (e.key) {
      case "ArrowLeft":  next = Math.max(0, idx - (e.shiftKey ? 10 : 1)); break;
      case "ArrowRight": next = Math.min(N - 1, idx + (e.shiftKey ? 10 : 1)); break;
      case "Home":       next = 0; break;
      case "End":        next = N - 1; break;
      default: return;
    }
    e.preventDefault();
    if (next !== idx) {
      interactionStore.setTemporalMode("live");
      interactionStore.setSnapshotIndex(next);
    }
  }, [history, snapshotIndex]);

  if (!enabled) return null;
  if (!history || history.snapshots.length === 0) return null;

  return (
    <div className="ws-tminimap" style={{ width }}>
      <canvas
        ref={canvasRef}
        className="ws-tminimap__canvas"
        role="slider"
        aria-label="Commit history timeline"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, history.snapshots.length - 1)}
        aria-valuenow={Math.max(0, snapshotIndex)}
        tabIndex={0}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onKeyDown={onKeyDown}
      />
      {tooltip && (
        <span className="ws-tminimap__tooltip" style={{ left: tooltip.x }}>
          {tooltip.text}
        </span>
      )}
    </div>
  );
}

export const TemporalMinimapStrip = memo(TemporalMinimapStripImpl);
