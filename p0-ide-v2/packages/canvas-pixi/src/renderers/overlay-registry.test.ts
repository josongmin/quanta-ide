import { describe, it, expect, vi, beforeEach } from "vitest";
import { Container } from "pixi.js";
import {
  OVERLAY_REGISTRY,
  RendererStack,
  type OverlayId,
  type OverlayFactory,
  type OverlayHandle,
  type OverlayRenderCtx,
} from "./overlay-registry";

// Coverage notes
// ---------------
// The registry is a module-level singleton populated by `register(...)` side
// effects when the module first loads. We exercise three logical contracts:
//
//   1. All 10 overlay ids register during module load (implicit guarantee
//      of the barrel; `register()` throws on duplicates, so module load
//      doubling as a negative test is already baked in).
//   2. RendererStack.update(ctx) dispatches to every registered handle.
//   3. RendererStack.destroy() destroys every registered handle — and
//      swallows any handle-level throw so a partial cleanup still wipes
//      the remaining entries.
//
// For 2/3 we swap the module-level OVERLAY_REGISTRY entries with stub
// factories (recorded via vi.fn) so we can count dispatch without running
// the real pixi-backed overlays. We restore the original factories after
// each test so later files in the same vitest worker observe an untouched
// registry.
//
// Un-testable from here:
//   - The per-overlay gate logic inside each concrete factory (covered in
//     the renderer-specific tests: `EdgeOverlayRenderer.test.ts` etc.).
//   - The "duplicate registration throws" guard. `register()` is not
//     exported, and the registry is already fully populated at module
//     load time; re-invoking the barrel would either no-op (module cache)
//     or require `vi.resetModules`, which then re-imports every renderer
//     and risks side-effects on sibling suites. We instead rely on the
//     fact that if the guard silently regressed, module load would yield
//     fewer than 10 ids (a condition we DO assert directly below).

const EXPECTED_OVERLAY_IDS: readonly OverlayId[] = [
  "edgeStatic",
  "edgeOverlay",
  "clusterEdge",
  "sccBubble",
  "startHereBadge",
  "presenceRing",
  "traceEdge",
  "effectBadge",
  "isoTerrain",
  "isoCone",
];

function makeStubCtx(): OverlayRenderCtx {
  return {
    visible: { kind: "files", files: [], edges: [], comments: [] },
    layout: {
      fileRects: new Map(),
      edgeRoutes: new Map(),
      aggregates: {
        commentsByFunction: new Map(),
        commentsByFile: new Map(),
        commentedLines: new Map(),
      },
      totalBounds: { x: 0, y: 0, w: 0, h: 0 },
    },
    viewport: { x: 0, y: 0, scale: 1, width: 100, height: 100 },
    viewState: {
      lod: "city",
      selectedFileId: null,
      hoveredFileId: null,
      selectedEdgeId: null,
      hoveredEdgeId: null,
      focusedNodeId: null,
    },
    lod: "city",
    fileLookup: new Map(),
    showEdges: false,
    clusterEdgesToRender: null,
    sccBubblesAllowed: false,
    startHereAllowed: false,
    startHereTopN: 0,
    activeTrace: null,
    showAgentPresence: false,
    showEffectBadges: false,
  };
}

describe("overlay-registry — registration invariants", () => {
  it("exposes exactly the 10 documented overlay ids", () => {
    expect(OVERLAY_REGISTRY.size).toBe(EXPECTED_OVERLAY_IDS.length);
    for (const id of EXPECTED_OVERLAY_IDS) {
      expect(OVERLAY_REGISTRY.has(id)).toBe(true);
    }
  });

  it("each registered factory is a callable that returns a handle shape", () => {
    // Smoke-construct each real factory. All 10 concrete renderers are
    // jsdom-safe to *construct* (Graphics / Container / Text do not need
    // GL until an actual draw is triggered). We immediately destroy to
    // keep the test leak-free.
    for (const id of EXPECTED_OVERLAY_IDS) {
      const factory = OVERLAY_REGISTRY.get(id);
      expect(factory, `factory for ${id}`).toBeDefined();
      const parent = new Container();
      const handle = factory!(parent);
      expect(typeof handle.update).toBe("function");
      expect(typeof handle.clear).toBe("function");
      expect(typeof handle.destroy).toBe("function");
      handle.destroy();
      parent.destroy({ children: true });
    }
  });
});

describe("overlay-registry — RendererStack dispatch", () => {
  // Stash the real factories and replace with spy stubs for deterministic
  // dispatch counts. Restored between tests so the module singleton stays
  // unmodified by the time vitest tears down the worker.
  const originalEntries: Array<[OverlayId, OverlayFactory]> = [];

  beforeEach(() => {
    originalEntries.length = 0;
    for (const [id, factory] of OVERLAY_REGISTRY) {
      originalEntries.push([id, factory]);
    }
  });

  const restoreRegistry = (): void => {
    OVERLAY_REGISTRY.clear();
    for (const [id, factory] of originalEntries) {
      OVERLAY_REGISTRY.set(id, factory);
    }
  };

  it("RendererStack.update(ctx) fans out to every handle", () => {
    const spies: Array<{ id: OverlayId; handle: OverlayHandle }> = [];
    OVERLAY_REGISTRY.clear();
    for (const id of EXPECTED_OVERLAY_IDS) {
      const handle: OverlayHandle = {
        update: vi.fn(),
        clear: vi.fn(),
        destroy: vi.fn(),
      };
      spies.push({ id, handle });
      OVERLAY_REGISTRY.set(id, () => handle);
    }

    try {
      const parent = new Container();
      const stack = new RendererStack(parent);
      const ctx = makeStubCtx();
      stack.update(ctx);
      for (const { id, handle } of spies) {
        expect(handle.update, `update dispatched to ${id}`).toHaveBeenCalledTimes(1);
        expect(handle.update).toHaveBeenCalledWith(ctx);
      }
      stack.destroy();
      parent.destroy();
    } finally {
      restoreRegistry();
    }
  });

  it("RendererStack.destroy() destroys every handle and survives one handle throwing", () => {
    const destroyed: OverlayId[] = [];
    const throwerId: OverlayId = "sccBubble";
    OVERLAY_REGISTRY.clear();
    for (const id of EXPECTED_OVERLAY_IDS) {
      OVERLAY_REGISTRY.set(id, () => ({
        update: vi.fn(),
        clear: vi.fn(),
        destroy: vi.fn(() => {
          if (id === throwerId) throw new Error("boom");
          destroyed.push(id);
        }),
      }));
    }

    try {
      const parent = new Container();
      const stack = new RendererStack(parent);
      // The try/catch inside RendererStack.destroy should absorb the throw,
      // so this call must not bubble. Every non-thrower gets destroyed.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(() => stack.destroy()).not.toThrow();
      expect(destroyed).toEqual(
        EXPECTED_OVERLAY_IDS.filter((id) => id !== throwerId),
      );
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
      parent.destroy();
    } finally {
      restoreRegistry();
    }
  });

  it("RendererStack.clear() fans out clear() to every handle", () => {
    const spies: Array<{ id: OverlayId; handle: OverlayHandle }> = [];
    OVERLAY_REGISTRY.clear();
    for (const id of EXPECTED_OVERLAY_IDS) {
      const handle: OverlayHandle = {
        update: vi.fn(),
        clear: vi.fn(),
        destroy: vi.fn(),
      };
      spies.push({ id, handle });
      OVERLAY_REGISTRY.set(id, () => handle);
    }

    try {
      const parent = new Container();
      const stack = new RendererStack(parent);
      stack.clear();
      for (const { id, handle } of spies) {
        expect(handle.clear, `clear dispatched to ${id}`).toHaveBeenCalledTimes(1);
      }
      stack.destroy();
      parent.destroy();
    } finally {
      restoreRegistry();
    }
  });
});
