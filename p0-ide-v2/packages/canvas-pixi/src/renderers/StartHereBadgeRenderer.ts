import { Graphics, Container, Text } from "pixi.js";
import type { StartHereEntry, LodLevel, Rect, Viewport } from "@quanta/canvas-engine";
import { setFontSize, setText, hashStep, hashStringStep } from "./shared/pixi-guards";

// Numbered "start here" badges anchored to the top-right corner of each
// file rect. The rank comes from `rankStartHere` (centrality + entry-point
// heuristic + risk), capped at top-N. Sourcegraph / DeepSource surface this
// as "high-level entry points" — we make it pre-attentive by rendering a
// small indigo chip with the rank number.
//
// Tier gating (galaxy / city / street / ground only): at supergalaxy and
// universe the layout is cluster-level, so per-file ranks don't map. At
// galaxy the badges are tiny, at city they grow, at street+ground they
// become readable corners.
//
// Optimization pass: start-here ranks are stable for the duration of a
// scene (they're derived from graph centrality which only re-runs on
// workspace re-index). The per-frame work is a Graphics.clear + roundRect
// + stroke + Text for each badge; skipping when nothing semantic changed
// takes that to zero on pan/zoom frames.

const BADGE_FILL = 0x6366f1;   // indigo-500
const BADGE_ALPHA = 0.95;
const BADGE_TEXT = 0xffffff;

type TierGate = "galaxy" | "city" | "street" | "ground";

function tierAllows(lod: LodLevel): lod is TierGate {
  return lod === "galaxy" || lod === "city" || lod === "street" || lod === "ground";
}

function badgeSize(lod: TierGate): number {
  if (lod === "galaxy") return 14;
  if (lod === "city") return 20;
  return 22;
}

export class StartHereBadgeRenderer {
  private container: Container;
  private gfx: Graphics;
  private textPool: Text[] = [];
  private textPoolIdx = 0;
  // Dirty-flag. Inputs: the top-N ranked entries, their target rects, the
  // LOD tier (size table), and the invScale bucket (stroke/size scale).
  private lastHash = 0;
  private lastCount = 0;
  private lastLod: LodLevel | null = null;
  private lastInvScaleBucket = -1;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.eventMode = "none";
    // Add on top of nodes but below edges' overlay — z-order matters: badges
    // must read over file cards.
    parent.addChild(this.container);
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  build(
    entries: readonly StartHereEntry[] | undefined,
    fileRectById: Map<string, Rect>,
    lod: LodLevel,
    topN: number,
    viewport?: Viewport,
  ): void {
    if (!entries || entries.length === 0 || !tierAllows(lod)) {
      this.gfx.clear();
      this.resetTexts();
      this.lastHash = 0;
      this.lastCount = 0;
      this.lastLod = lod;
      return;
    }

    const scale = viewport?.scale ?? 1;
    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const invScaleBucket = Math.round(invScale * 2);
    // Galaxy at low zoom: show only top-3 no matter what topN says (keeps
    // the dot map readable). Higher tiers respect topN.
    const effectiveN = lod === "galaxy" ? Math.min(3, topN) : topN;
    const limit = Math.min(effectiveN, entries.length);

    // Pre-pass hash. Covers entry identity, rank (label text), and target
    // rect corner (position on screen) — anything that would change the
    // painted pixels.
    let hash = 0;
    let count = 0;
    for (let i = 0; i < limit; i++) {
      const entry = entries[i];
      const rect = fileRectById.get(entry.fileId);
      if (!rect) continue;
      count++;
      hash = hashStringStep(hash, entry.fileId);
      hash = hashStep(hash, entry.rank);
      hash = hashStep(hash, rect.x | 0);
      hash = hashStep(hash, rect.y | 0);
      hash = hashStep(hash, rect.w | 0);
    }

    if (
      hash === this.lastHash
      && count === this.lastCount
      && lod === this.lastLod
      && invScaleBucket === this.lastInvScaleBucket
    ) {
      return;
    }

    this.gfx.clear();
    this.resetTexts();

    const size = badgeSize(lod) * invScale;
    const radius = size * 0.3;

    for (let i = 0; i < limit; i++) {
      const entry = entries[i];
      const rect = fileRectById.get(entry.fileId);
      if (!rect) continue;

      const x = rect.x + rect.w - size * 0.4;
      const y = rect.y - size * 0.6;

      this.gfx
        .roundRect(x, y, size, size, radius)
        .fill({ color: BADGE_FILL, alpha: BADGE_ALPHA })
        .stroke({ color: 0xffffff, alpha: 0.5, width: invScale * 0.5 });

      const label = this.acquireText();
      setText(label, String(entry.rank));
      setFontSize(label, size * 0.65);
      label.position.set(x + size / 2 - label.width / 2, y + size / 2 - label.height / 2);
      label.visible = true;
    }

    this.lastHash = hash;
    this.lastCount = count;
    this.lastLod = lod;
    this.lastInvScaleBucket = invScaleBucket;
  }

  clear(): void {
    this.gfx.clear();
    this.resetTexts();
    this.lastHash = 0;
    this.lastCount = 0;
    this.lastLod = null;
    this.lastInvScaleBucket = -1;
  }

  destroy(): void {
    for (const t of this.textPool) t.destroy();
    this.textPool.length = 0;
    this.gfx.destroy();
    this.container.destroy();
  }

  private acquireText(): Text {
    let text = this.textPool[this.textPoolIdx];
    if (!text) {
      text = new Text({
        text: "",
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          fontWeight: "700",
          fill: BADGE_TEXT,
        },
      });
      text.eventMode = "none";
      this.container.addChild(text);
      this.textPool[this.textPoolIdx] = text;
    }
    this.textPoolIdx++;
    return text;
  }

  private resetTexts(): void {
    for (let i = 0; i < this.textPoolIdx; i++) this.textPool[i].visible = false;
    this.textPoolIdx = 0;
  }
}
