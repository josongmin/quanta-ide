import { Graphics, Container, Text, Ticker } from "pixi.js";
import type {
  TraceEdge,
  WorkspaceLayout,
  Viewport,
  FileNode,
} from "@quanta/canvas-engine";

// Dynamic trace-edge overlay. Separate from EdgeStaticRenderer because the
// visual vocabulary is categorically different:
//
//   - Static edge = "this *can* happen" (structural / flow / safety / impact)
//     → grey/cyan/red/purple palette, thin strokes, optional dashed animation
//       when the analyzer has flagged dataflow/taint as moving at run-time.
//
//   - Trace edge = "this *did* happen in one concrete captured run"
//     → cyan→magenta gradient (source→sink), thicker stroke scaled by log
//       of total duration, always animated (a trace is literally time-
//       ordered — motion is the defining trait), and stamped with a call-
//       count badge ("×12") near the midpoint.
//
// Pixi v8's Graphics API doesn't have a first-class gradient stroke; we
// approximate the cyan→magenta sweep by drawing the bezier as two halves —
// cyan from (a, midA) and magenta from (midA, b) — joined at the curve
// midpoint. With the bezier's smooth curvature the transition reads as a
// gradient without the cost of per-segment colour blending.

/** Arc-length sampling resolution when emitting the animated dash pattern.
 *  24 mirrors EdgeStaticRenderer's DASH_SAMPLES_PER_CURVE — keeps motion
 *  speeds visually matched if both renderers are on screen. */
const DASH_SAMPLES_PER_CURVE = 24;

/** Dash pattern (on, off) in world-px. A longer "on" than static edges so
 *  the trace reads as a sequence of deliberate pulses rather than a noisy
 *  dashed line. */
const TRACE_DASH: readonly [number, number] = [10, 4];

/** Source-end colour (cyan-400). */
const COLOR_SOURCE = 0x22d3ee;
/** Sink-end colour (magenta-500). */
const COLOR_SINK = 0xec4899;

/** Callout badge fill — dark so the white "×N" reads at any scale. */
const BADGE_FILL = 0x111827; // slate-900
const BADGE_ALPHA = 0.92;
const BADGE_TEXT = 0xffffff;

/** Minimum visible stroke width at low zoom, world-px. Prevents the trace
 *  overlay from vanishing when zoomed out past galaxy tier. */
const MIN_WIDTH = 0.6;

interface TraceEdgeBuildOpts {
  /** Map file id → rect. When a trace edge references a file that isn't in
   *  the current layout, we silently skip it (the user may be at a zoom
   *  tier where the file is aggregated into a cluster; handled by upstream). */
  fileRects?: Map<string, { x: number; y: number; w: number; h: number }>;
  /** File lookup — reserved for future line-anchor support. */
  fileById?: Map<string, Pick<FileNode, "loc">>;
}

export class TraceEdgeRenderer {
  private gfx: Graphics;
  private badgeContainer: Container;
  private badgePool: Text[] = [];
  private badgePoolIdx = 0;
  private ticker: Ticker | null = null;
  private tickerHandle: ((t: Ticker) => void) | null = null;
  private dashOffset = 0;

  // Last-build inputs, cached so the per-frame ticker can redraw without
  // the parent re-submitting the list.
  private lastEdges: readonly TraceEdge[] = [];
  private lastLayout: WorkspaceLayout | null = null;
  private lastViewport: Viewport | undefined;
  private lastOpts: TraceEdgeBuildOpts | undefined;
  private hasContent = false;

  constructor(parent: Container) {
    this.gfx = new Graphics();
    this.badgeContainer = new Container();
    this.badgeContainer.eventMode = "none";
    // Paint above static edges (behind nodes is fine; parent addChild order
    // in PixiStage determines that — caller decides z).
    parent.addChild(this.gfx);
    parent.addChild(this.badgeContainer);
    this.ticker = Ticker.shared;
    this.tickerHandle = (t: Ticker) => {
      if (!this.hasContent) return;
      // Flow speed tuned to read as "purposeful motion" not "busy marquee".
      this.dashOffset = (this.dashOffset + 0.45 * t.deltaTime) % 1000;
      this.redraw();
    };
    this.ticker.add(this.tickerHandle);
  }

  build(
    edges: readonly TraceEdge[] | undefined,
    layout: WorkspaceLayout,
    viewport?: Viewport,
    opts?: TraceEdgeBuildOpts,
  ): void {
    this.lastEdges = edges ?? [];
    this.lastLayout = layout;
    this.lastViewport = viewport;
    this.lastOpts = opts;
    this.hasContent = (edges?.length ?? 0) > 0;
    this.redraw();
  }

  clear(): void {
    this.lastEdges = [];
    this.hasContent = false;
    this.gfx.clear();
    this.resetBadges();
  }

  destroy(): void {
    if (this.ticker && this.tickerHandle) this.ticker.remove(this.tickerHandle);
    this.ticker = null;
    this.tickerHandle = null;
    this.gfx.destroy();
    for (const t of this.badgePool) t.destroy();
    this.badgePool = [];
    this.badgeContainer.destroy();
  }

  private resetBadges(): void {
    for (const t of this.badgePool) t.visible = false;
    this.badgePoolIdx = 0;
  }

  private acquireBadge(): Text {
    let t = this.badgePool[this.badgePoolIdx];
    if (!t) {
      t = new Text({
        text: "",
        style: {
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          fontSize: 10,
          fontWeight: "700",
          fill: BADGE_TEXT,
          align: "center",
        },
      });
      t.anchor.set(0.5);
      this.badgeContainer.addChild(t);
      this.badgePool.push(t);
    }
    this.badgePoolIdx += 1;
    t.visible = true;
    return t;
  }

  private redraw(): void {
    const edges = this.lastEdges;
    const layout = this.lastLayout;
    if (!layout) return;
    this.gfx.clear();
    this.resetBadges();
    if (edges.length === 0) return;

    const viewport = this.lastViewport;
    const scale = viewport?.scale ?? 1;
    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const fileRects = this.lastOpts?.fileRects ?? layout.fileRects;

    for (const edge of edges) {
      const fromRect = fileRects.get(edge.from);
      const toRect = fileRects.get(edge.to);
      if (!fromRect || !toRect) continue;

      // Anchors — rect side-centres facing each other. Keeps the renderer
      // robust at any tier (galaxy rects are tiny, ground cards are huge)
      // and sidesteps the line-anchor lookup, which isn't meaningful for a
      // dynamic trace (we have symbols but no line numbers in the pack).
      const ax = fromRect.x + fromRect.w;
      const ay = fromRect.y + fromRect.h / 2;
      const bx = toRect.x;
      const by = toRect.y + toRect.h / 2;

      // Bezier kink — standard "exit right, enter left" for readability.
      const dx = bx - ax;
      const spread = Math.max(50, Math.abs(dx) * 0.4);
      const cp1x = ax + spread;
      const cp1y = ay;
      const cp2x = bx - spread;
      const cp2y = by;

      // Width scales by log(total duration) so an edge that consumed 500ms
      // reads meaningfully thicker than one that took 5ms, without runaway
      // dominance at pathological durations.
      const rawWidth = Math.log(edge.totalDurationMs + 1) * 0.8;
      const width = Math.max(MIN_WIDTH, rawWidth) * invScale;

      // ── Gradient approximation via two half-edges ──────────────────
      // Compute curve midpoint (t = 0.5) — de Casteljau's 5-multiply form.
      const mt = 0.5;
      const imt = 1 - mt;
      const midX = imt * imt * imt * ax
        + 3 * imt * imt * mt * cp1x
        + 3 * imt * mt * mt * cp2x
        + mt * mt * mt * bx;
      const midY = imt * imt * imt * ay
        + 3 * imt * imt * mt * cp1y
        + 3 * imt * mt * mt * cp2y
        + mt * mt * mt * by;

      // Control points for each half. Clamping to 0..1 on the bezier
      // requires proper subdivision; we approximate by using the original
      // CPs directly on each half — acceptable since the two halves share
      // tangent at the midpoint and the error is sub-pixel at the
      // resolutions the user sees a trace edge.
      const halfCP1A_x = ax + (cp1x - ax) * 0.5;
      const halfCP1A_y = ay + (cp1y - ay) * 0.5;
      const halfCP2A_x = (cp1x + midX) * 0.5;
      const halfCP2A_y = (cp1y + midY) * 0.5;
      const halfCP1B_x = (midX + cp2x) * 0.5;
      const halfCP1B_y = (midY + cp2y) * 0.5;
      const halfCP2B_x = bx + (cp2x - bx) * 0.5;
      const halfCP2B_y = by + (cp2y - by) * 0.5;

      // Base gradient passes (solid) — reads as the "lane" under the
      // animated pulse so the edge stays legible during the dash off-window.
      this.gfx
        .moveTo(ax, ay)
        .bezierCurveTo(halfCP1A_x, halfCP1A_y, halfCP2A_x, halfCP2A_y, midX, midY)
        .stroke({ color: COLOR_SOURCE, alpha: 0.45, width, cap: "round" });
      this.gfx
        .moveTo(midX, midY)
        .bezierCurveTo(halfCP1B_x, halfCP1B_y, halfCP2B_x, halfCP2B_y, bx, by)
        .stroke({ color: COLOR_SINK, alpha: 0.45, width, cap: "round" });

      // Animated pulse — full curve, dashed with the shared dashOffset.
      // We walk the whole bezier so the pulse visually flows across the
      // midpoint (i.e. motion transcends the colour split). Each sample's
      // t-position decides which side's colour it takes (cyan in 0..0.5,
      // magenta in 0.5..1) — the pulse therefore inherits the gradient.
      drawAnimatedTraceBezier(
        this.gfx,
        ax, ay, cp1x, cp1y, cp2x, cp2y, bx, by,
        TRACE_DASH,
        this.dashOffset,
        width * 1.4,
      );

      // Call-count badge at midpoint. Omitted when callCount < 2 — a single
      // call doesn't need a marker. Badge scales with viewport so it stays
      // legible but doesn't swell at high zoom.
      if (edge.callCount >= 2) {
        const badge = this.acquireBadge();
        badge.text = `×${edge.callCount}`;
        const badgeScale = invScale;
        badge.scale.set(badgeScale);
        badge.x = midX;
        badge.y = midY;
        // Small dark pill under the text so the ×N reads on any underlying
        // colour. Pill dimensions derived from text bounds.
        const pad = 3 * invScale;
        const bw = badge.width + pad * 2;
        const bh = badge.height + pad;
        this.gfx
          .roundRect(midX - bw / 2, midY - bh / 2, bw, bh, 3 * invScale)
          .fill({ color: BADGE_FILL, alpha: BADGE_ALPHA });
      }
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function drawAnimatedTraceBezier(
  g: Graphics,
  x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number,
  pattern: readonly [number, number],
  offset: number,
  width: number,
): void {
  const [on, off] = pattern;
  const period = on + off;
  if (period <= 0) return;

  // Sample bezier.
  const pts = new Array<{ x: number; y: number; t: number }>(DASH_SAMPLES_PER_CURVE + 1);
  for (let i = 0; i <= DASH_SAMPLES_PER_CURVE; i++) {
    const t = i / DASH_SAMPLES_PER_CURVE;
    const mt = 1 - t;
    const x = mt * mt * mt * x1 + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * x2;
    const y = mt * mt * mt * y1 + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * y2;
    pts[i] = { x, y, t };
  }

  // Walk segments, emitting "on" runs. Colour per-segment from the midpoint
  // split — cyan before 0.5, magenta after. A segment straddling 0.5 is
  // assigned to whichever side has most of it (tiny visual discontinuity
  // at the midpoint is hidden by the dash gap).
  let cumLen = 0;
  let penDown = false;
  let currentColor = COLOR_SOURCE;
  for (let i = 1; i <= DASH_SAMPLES_PER_CURVE; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const segMidT = (prev.t + cur.t) * 0.5;
    const segColor = segMidT < 0.5 ? COLOR_SOURCE : COLOR_SINK;
    const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const cycle = ((cumLen + offset) % period);
    const isOn = cycle < on;

    // Colour switched inside an "on" run? Flush the current polyline so
    // the new run starts with the correct stroke.
    if (isOn && penDown && segColor !== currentColor) {
      g.stroke({ color: currentColor, alpha: 1, width, cap: "round" });
      penDown = false;
    }
    if (isOn) {
      if (!penDown) {
        g.moveTo(prev.x, prev.y);
        penDown = true;
        currentColor = segColor;
      }
      g.lineTo(cur.x, cur.y);
    } else if (penDown) {
      g.stroke({ color: currentColor, alpha: 1, width, cap: "round" });
      penDown = false;
    }
    cumLen += segLen;
  }
  if (penDown) g.stroke({ color: currentColor, alpha: 1, width, cap: "round" });
}
