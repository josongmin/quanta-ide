import { Graphics, Container, Text, Ticker } from "pixi.js";
import type { Rect, Viewport, LodLevel } from "@quanta/canvas-engine";

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
    this.redraw();
  }

  clear(): void {
    this.lastPresence = [];
    this.lastRectById = null;
    this.gfx.clear();
    this.resetLabels();
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
    if (this.pulsePhase > Math.PI * 2) this.pulsePhase -= Math.PI * 2;
    this.redraw();
  };

  private redraw(): void {
    this.gfx.clear();
    this.resetLabels();
    const rects = this.lastRectById;
    if (!rects) return;

    const scale = this.lastViewport?.scale ?? 1;
    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const showLabels = scale >= LABEL_MIN_SCALE && !isCoarseLod(this.lastLod);

    const byFile = new Map<string, AgentPresenceInput[]>();
    for (const p of this.lastPresence) {
      if (!p.focusFileId) continue;
      const arr = byFile.get(p.focusFileId);
      if (arr) arr.push(p);
      else byFile.set(p.focusFileId, [p]);
    }

    const now = Date.now();
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
          label.text = ACTIVITY_SHORT[agent.activity];
          label.style.fontSize = 10 * invScale;
          label.style.fill = agent.color;
          label.position.set(x, y - 14 * invScale);
          label.visible = true;
        }
      }
    }
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
