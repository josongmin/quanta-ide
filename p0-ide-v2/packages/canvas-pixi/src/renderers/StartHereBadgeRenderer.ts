import { Graphics, Container, Text } from "pixi.js";
import type { StartHereEntry, LodLevel, Rect, Viewport } from "@quanta/canvas-engine";

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
    this.gfx.clear();
    this.resetTexts();
    if (!entries || entries.length === 0) return;
    if (!tierAllows(lod)) return;

    const scale = viewport?.scale ?? 1;
    const invScale = Math.min(32, Math.max(1, 1 / scale));
    // Galaxy at low zoom: show only top-3 no matter what topN says (keeps
    // the dot map readable). Higher tiers respect topN.
    const effectiveN = lod === "galaxy" ? Math.min(3, topN) : topN;
    const size = badgeSize(lod) * invScale;
    const radius = size * 0.3;

    for (let i = 0; i < Math.min(effectiveN, entries.length); i++) {
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
      label.text = String(entry.rank);
      label.style.fontSize = size * 0.65;
      label.position.set(x + size / 2 - label.width / 2, y + size / 2 - label.height / 2);
      label.visible = true;
    }
  }

  clear(): void {
    this.gfx.clear();
    this.resetTexts();
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
