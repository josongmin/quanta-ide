import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import {
  PresenceRingRenderer,
  type AgentPresenceInput,
  type AgentActivity,
} from "./PresenceRingRenderer";
import type { Rect, Viewport, LodLevel } from "@quanta/canvas-engine";

// Coverage notes
// ---------------
// `build()` branches:
//   1. empty presence list → clear path
//   2. agent with focusFileId but unknown rect → skip loop iteration
//   3. multiple agents on same file → stacked padding per index
//   4. coarse LOD (galaxy / supergalaxy / universe) → showLabels false
//   5. fine LOD + scale above LABEL_MIN_SCALE → showLabels true
//   6. staleness factor — updatedAt < now - STALE_MS dims alpha
//
// Labels are canvas-backed Text in fine LOD — jsdom throws on
// CanvasTextMetrics. Our tests use coarse LOD OR set `activity: "idle"` +
// stub the labelPool when necessary to keep the Text.width read path off.

const VP: Viewport = { x: 0, y: 0, scale: 0.2, width: 800, height: 600 };

function makeRects(ids: readonly string[]): Map<string, Rect> {
  return new Map(
    ids.map((id, i) => [id, { x: i * 200, y: 0, w: 100, h: 80 }]),
  );
}

function makePresence(
  agentId: string,
  focusFileId: string | null,
  overrides: Partial<AgentPresenceInput> = {},
): AgentPresenceInput {
  const activity: AgentActivity = overrides.activity ?? "reading";
  return {
    agentId,
    label: agentId,
    color: 0x66aaff,
    focusFileId,
    activity,
    updatedAt: Date.now(),
    ...overrides,
  };
}

function privateGfx(r: PresenceRingRenderer): Graphics {
  return (r as unknown as { gfx: Graphics }).gfx;
}

describe("PresenceRingRenderer", () => {
  let parent: Container;
  let renderer: PresenceRingRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new PresenceRingRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("empty presence list issues no ring strokes", () => {
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const rects = makeRects(["a.ts"]);
    const lod: LodLevel = "galaxy";
    renderer.build([], rects, lod, VP);
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it("draws a ring per valid presence entry at coarse LOD (no labels)", () => {
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const rects = makeRects(["a.ts"]);
    // Coarse LOD → showLabels = false → no Text.width path.
    const lod: LodLevel = "galaxy";
    renderer.build(
      [makePresence("agent-1", "a.ts")],
      rects,
      lod,
      VP,
    );
    expect(roundRectSpy).toHaveBeenCalled();
  });

  it("skips presence entries with null focusFileId", () => {
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const rects = makeRects(["a.ts"]);
    const lod: LodLevel = "galaxy";
    renderer.build(
      [makePresence("agent-1", null)],
      rects,
      lod,
      VP,
    );
    expect(roundRectSpy).not.toHaveBeenCalled();
  });

  it("skips presence entries whose focusFileId has no rect", () => {
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const rects = makeRects(["a.ts"]);
    // `ghost.ts` not in rects — the per-file loop uses `rects.get()` and
    // `continue`s when undefined.
    const lod: LodLevel = "galaxy";
    renderer.build(
      [makePresence("agent-1", "ghost.ts")],
      rects,
      lod,
      VP,
    );
    expect(roundRectSpy).not.toHaveBeenCalled();
  });

  it("issues one ring per agent when multiple agents focus the same file", () => {
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const rects = makeRects(["a.ts"]);
    const lod: LodLevel = "galaxy";
    renderer.build(
      [
        makePresence("agent-1", "a.ts", { color: 0xff0000 }),
        makePresence("agent-2", "a.ts", { color: 0x00ff00 }),
      ],
      rects,
      lod,
      VP,
    );
    // Two rings → two roundRect + two stroke calls.
    expect(roundRectSpy.mock.calls.length).toBe(2);
  });

  it("honours per-agent stroke color (observable via stroke args)", () => {
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const rects = makeRects(["a.ts"]);
    const lod: LodLevel = "galaxy";
    renderer.build(
      [makePresence("agent-1", "a.ts", { color: 0xabcdef })],
      rects,
      lod,
      VP,
    );
    const colors = strokeSpy.mock.calls.map(
      args => (args[0] as { color?: number } | undefined)?.color,
    );
    expect(colors).toContain(0xabcdef);
  });

  it("dims alpha for stale presence entries (updatedAt older than STALE_MS)", () => {
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const rects = makeRects(["a.ts"]);
    const lod: LodLevel = "galaxy";
    // 60s ago > STALE_MS=30s → staleFactor = 0.25 → alpha multiplied down.
    renderer.build(
      [makePresence("agent-1", "a.ts", { updatedAt: Date.now() - 60_000 })],
      rects,
      lod,
      VP,
    );
    // Pull whatever alpha came out and assert it's below the fresh RING_ALPHA*pulse
    // range. Fresh alphas cluster near 0.85*(0.85±0.1) = ~0.64–0.81; stale is ~0.16–0.20.
    const alphas = strokeSpy.mock.calls
      .map(args => (args[0] as { alpha?: number } | undefined)?.alpha)
      .filter((a): a is number => typeof a === "number");
    expect(alphas.length).toBeGreaterThan(0);
    for (const a of alphas) expect(a).toBeLessThan(0.3);
  });

  it("clear() resets membership hash and blanks the Graphics", () => {
    const rects = makeRects(["a.ts"]);
    const lod: LodLevel = "galaxy";
    renderer.build(
      [makePresence("agent-1", "a.ts")],
      rects,
      lod,
      VP,
    );
    renderer.clear();
    const hash = (renderer as unknown as { lastMembershipHash: number })
      .lastMembershipHash;
    expect(hash).toBe(0);
  });
});
