import { Graphics, Container, Text, Ticker } from "pixi.js";
import type { Rect, Viewport, LodLevel } from "@quanta/canvas-engine";
import { setFontSize, setFill, setText, hashStep, hashStringStep } from "./shared/pixi-guards";

export type AgentActivity = "reading" | "editing" | "analyzing" | "idle";

export interface AgentPresenceInput {
  agentId: string;
  label: string;
  color: number;
  focusFileId: string | null;
  activity: AgentActivity;
  updatedAt: number;
}

const BASE_PADDING = 4;
const PER_AGENT_RADIUS = 4;
const STROKE_WIDTH = 3;
const RING_ALPHA = 0.85;
const PULSE_HZ = 1;
const STALE_MS = 30_000;
const LABEL_MIN_SCALE = 0.4;

const ACTIVITY_SHORT: Record<AgentActivity, string> = {
  reading: "read",
  editing: "edit",
  analyzing: "scan",
  idle: "idle",
};

// Pulse alpha is resolved against a coarse bucket (30 steps per cycle).
// Within a bucket the stroke alpha difference is < 0.007 — imperceptible,
// but it lets us short-circuit identical redraws when neither the membership
// nor the pulse bucket changed. This keeps the ring renderer from redrawing
// the Graphics 60 fps even while everything else is idle.
const PULSE_BUCKETS = 30;

function isCoarseLod(lod: LodLevel): boolean {
  return lod === "universe" || lod === "supergalaxy" || lod === "galaxy";
}

export class PresenceRingRenderer {
  private container: Container;
  private gfx: Graphics;
  private labelPool: Text[] = [];
  private labelPoolIdx = 0;
  private ticker: Ticker;
  private pulsePhase = 0;
  private lastPresence: readonly AgentPresenceInput[] = [];
  private lastRectById: Map<string, Rect> | null = null;
  private lastViewport: Viewport | null = null;
  private lastLod: LodLevel = "galaxy";

  // Membership hash — fileId + agentId + activity + staleness bucket. When
  // this is stable *and* the pulse bucket is stable, the redraw is a no-op.
  // Position is intentionally excluded: agents don't move between files on
  // the animation tick, so a pure camera pan doesn't touch this hash.
  private lastMembershipHash = 0;
  private lastMembershipCount = 0;
  private lastPulseBucket = -1;
  // Coarse invScale bucket. Stroke width scales with invScale; switching
  // LOD or panning fast enough to change bucket invalidates the redraw.
  private lastInvScaleBucket = -1;
  private lastShowLabels = false;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.eventMode = "none";
    parent.addChild(this.container);
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);

    this.ticker = Ticker.shared;
    this.ticker.add(this.tick, this);
  }

  build(
    presence: readonly AgentPresenceInput[],
    fileRectById: Map<string, Rect>,
    lod: LodLevel,
    viewport?: Viewport,
  ): void {
    this.lastPresence = presence;
    this.lastRectById = fileRectById;
    this.lastViewport = viewport ?? null;
    this.lastLod = lod;
    // External rebuild always forces a redraw; callers of build() have
    // changed something semantically (new presence, new layout, new LOD).
    this.lastMembershipHash = 0;
    this.lastMembershipCount = -1;
    this.lastPulseBucket = -1;
    this.redraw();
  }

  clear(): void {
    this.lastPresence = [];
    this.lastRectById = null;
    this.gfx.clear();
    this.resetLabels();
    this.lastMembershipHash = 0;
    this.lastMembershipCount = 0;
    this.lastPulseBucket = -1;
    this.lastInvScaleBucket = -1;
    // Without resetting the label-visibility flag, a subsequent tier that
    // re-enters with the same membership hash but a toggled showLabels
    // state would short-circuit the redraw branch in the stale direction.
    this.lastShowLabels = false;
  }

  destroy(): void {
    this.ticker.remove(this.tick, this);
    for (const l of this.labelPool) l.destroy();
    this.labelPool.length = 0;
    this.gfx.destroy();
    this.container.destroy();
  }

  private tick = (t: Ticker) => {
    if (this.lastPresence.length === 0 || !this.lastRectById) return;
    this.pulsePhase += (t.deltaMS / 1000) * PULSE_HZ * Math.PI * 2;
    // Modulo (not `if (… > 2π) -= 2π`) handles the edge case where the tab
    // comes back from background with a deltaMS spanning many cycles —
    // a single subtract would leave the phase arbitrarily far past 2π.
    this.pulsePhase = ((this.pulsePhase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    this.redraw();
  };

  private computeMembershipHash(now: number): { hash: number; count: number } {
    let h = 0;
    let count = 0;
    for (const p of this.lastPresence) {
      if (!p.focusFileId) continue;
      count++;
      h = hashStringStep(h, p.agentId);
      h = hashStringStep(h, p.focusFileId);
      // Use the full-string fold — `charCodeAt(0)` collides whenever two
      // activities start with the same letter (e.g. could be extended to
      // include `analyzing` vs `archiving` in future). hashStringStep is
      // the canonical path for every string field in this file.
      h = hashStringStep(h, p.activity);
      // Staleness is binary (age > STALE_MS), so collapse to 0/1. If an
      // agent *crosses* the staleness threshold, the hash flips and we
      // redraw. Within either state the alpha is constant.
      h = hashStep(h, (now - p.updatedAt) > STALE_MS ? 1 : 0);
      h = hashStep(h, p.color | 0);
    }
    return { hash: h, count };
  }

  private redraw(): void {
    const rects = this.lastRectById;
    if (!rects) {
      this.gfx.clear();
      this.resetLabels();
      return;
    }

    const scale = this.lastViewport?.scale ?? 1;
    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const showLabels = scale >= LABEL_MIN_SCALE && !isCoarseLod(this.lastLod);

    // Round invScale to the nearest 0.5 for bucket comparison — small camera
    // jitters at the same LOD stop invalidating the redraw path.
    const invScaleBucket = Math.round(invScale * 2);
    const pulseBucket = Math.floor(((this.pulsePhase / (Math.PI * 2)) % 1 + 1) % 1 * PULSE_BUCKETS);
    const now = Date.now();
    const { hash, count } = this.computeMembershipHash(now);

    if (
      hash === this.lastMembershipHash
      && count === this.lastMembershipCount
      && pulseBucket === this.lastPulseBucket
      && invScaleBucket === this.lastInvScaleBucket
      && showLabels === this.lastShowLabels
    ) {
      return;
    }

    this.gfx.clear();
    this.resetLabels();

    const byFile = new Map<string, AgentPresenceInput[]>();
    for (const p of this.lastPresence) {
      if (!p.focusFileId) continue;
      const arr = byFile.get(p.focusFileId);
      if (arr) arr.push(p);
      else byFile.set(p.focusFileId, [p]);
    }

    const pulse = 0.85 + Math.sin(this.pulsePhase) * 0.1;

    for (const [fileId, agents] of byFile) {
      const rect = rects.get(fileId);
      if (!rect) continue;
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const age = now - agent.updatedAt;
        const staleFactor = age > STALE_MS ? 0.25 : 1;
        const pad = BASE_PADDING + i * PER_AGENT_RADIUS;
        const x = rect.x - pad;
        const y = rect.y - pad;
        const w = rect.w + pad * 2;
        const h = rect.h + pad * 2;

        this.gfx.roundRect(x, y, w, h, 6).stroke({
          color: agent.color,
          alpha: RING_ALPHA * pulse * staleFactor,
          width: STROKE_WIDTH * invScale,
        });

        if (showLabels && i === 0) {
          const label = this.acquireLabel();
          // Guarded setters: activity short-code rarely changes within a
          // session, and fontSize only changes when invScale bucket shifts.
          // Skipping the Text layout invalidation on stable frames matters
          // more here than for a pool of 3 BitmapTexts would suggest —
          // Pixi's Text is canvas-backed and each style change schedules a
          // full canvas redraw.
          setText(label, ACTIVITY_SHORT[agent.activity]);
          setFontSize(label, 10 * invScale);
          setFill(label, agent.color);
          label.position.set(x, y - 14 * invScale);
          label.visible = true;
        }
      }
    }

    this.lastMembershipHash = hash;
    this.lastMembershipCount = count;
    this.lastPulseBucket = pulseBucket;
    this.lastInvScaleBucket = invScaleBucket;
    this.lastShowLabels = showLabels;
  }

  private acquireLabel(): Text {
    let label = this.labelPool[this.labelPoolIdx];
    if (!label) {
      label = new Text({
        text: "",
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize: 10,
          fontWeight: "600",
          fill: 0xffffff,
        },
      });
      label.eventMode = "none";
      this.container.addChild(label);
      this.labelPool[this.labelPoolIdx] = label;
    }
    this.labelPoolIdx++;
    return label;
  }

  private resetLabels(): void {
    for (let i = 0; i < this.labelPoolIdx; i++) this.labelPool[i].visible = false;
    this.labelPoolIdx = 0;
  }
}
