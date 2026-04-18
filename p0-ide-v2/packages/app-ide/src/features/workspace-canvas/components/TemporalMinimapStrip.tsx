import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { GraphHistory, GraphSnapshot } from "@quanta/canvas-engine";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { featureFlagsStore } from "../store/feature-flags-store";
import { useFeature } from "../store/feature-flags-store";

interface Props {
  history: GraphHistory | undefined;
  /** Must match the Minimap box width so the strip visually anchors to it. */
  width: number;
}

// TemporalMinimapStrip (temporal.minimapStrip)
// ─────────────────────────────────────────────────────────────────────
// A 1px-tall pixel strip rendered underneath the minimap. Each column is
// one commit; the column's color encodes churn intensity (additions +
// removals per snapshot). Clicking a column jumps the snapshot index;
// hovering shows a tiny tooltip with the commit's label.
//
// The strip handles all commits, not just the ~30 rendered by the film
// strip, so long histories are visible at-a-glance as a density band.
// When power.smoothCamera is on, the interaction store update is the
// signal — the actual camera easing is handled elsewhere by the scene
// reacting to the new snapshot index.

const STRIP_HEIGHT = 8; // a hair taller than 1px so clicks actually hit

function churnFor(s: GraphSnapshot): number {
  const a = s.added?.length ?? 0;
  const r = s.removed?.length ?? 0;
  if (a + r > 0) return a + r;
  // If the snapshot is an absolute-set replacement, approximate by length.
  return s.edgeIds ? Math.min(50, s.edgeIds.length) : 0;
}

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

  const maxChurn = useMemo(() => {
    if (!history) return 1;
    let m = 0;
    for (const s of history.snapshots) m = Math.max(m, churnFor(s));
    return Math.max(1, m);
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

    const N = history.snapshots.length;
    if (N === 0) return;
    const colW = cssW / N;
    for (let i = 0; i < N; i++) {
      const heat = Math.min(1, churnFor(history.snapshots[i]) / maxChurn);
      ctx.fillStyle = churnColor(heat);
      ctx.fillRect(i * colW, 0, Math.max(1, colW + 0.5), cssH);
    }

    // Highlight the active column — thin white outline at the top/bottom.
    if (snapshotIndex >= 0 && snapshotIndex < N) {
      const x = snapshotIndex * colW;
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(x, 0, Math.max(1, colW), 1);
      ctx.fillRect(x, cssH - 1, Math.max(1, colW), 1);
    }
  }, [history, maxChurn, snapshotIndex, width]);

  const indexForX = useCallback((clientX: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || !history) return null;
    const r = canvas.getBoundingClientRect();
    const frac = (clientX - r.left) / Math.max(1, r.width);
    const N = history.snapshots.length;
    if (N === 0) return null;
    return Math.max(0, Math.min(N - 1, Math.floor(frac * N)));
  }, [history]);

  const onClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const idx = indexForX(e.clientX);
    if (idx === null) return;
    interactionStore.setSnapshotIndex(idx);
    // If the smooth-camera power feature is on, we leave the actual
    // camera animation to the scene-level code that reacts to the new
    // snapshot (which also applies on arrow-key scrubs, etc.). The
    // lookup here just documents the dependency for future readers.
    void featureFlagsStore.isEnabled("power.smoothCamera");
  }, [indexForX]);

  const onMouseMove = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const idx = indexForX(e.clientX);
    if (idx === null || !history) { setTooltip(null); return; }
    const s = history.snapshots[idx];
    const sha = s.commitSha ? s.commitSha.slice(0, 7) : `s${idx.toString(16).padStart(3, "0")}`;
    setTooltip({ x: e.nativeEvent.offsetX, text: `${sha} · ${s.label}` });
  }, [history, indexForX]);

  const onMouseLeave = useCallback(() => setTooltip(null), []);

  if (!enabled) return null;
  if (!history || history.snapshots.length === 0) return null;

  return (
    <div className="ws-tminimap" style={{ width }}>
      <canvas
        ref={canvasRef}
        className="ws-tminimap__canvas"
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
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
