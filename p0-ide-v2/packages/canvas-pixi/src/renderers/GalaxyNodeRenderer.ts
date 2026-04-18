import { Container } from "pixi.js";
import type { FileNode, WorkspaceLayout, ViewState, Viewport } from "@quanta/canvas-engine";
import { FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { type PickRect } from "./shared/SpatialPickIndex";
import { RectNodeRenderer } from "./shared/RectNodeRenderer";
import { riskFill, riskBorder, SELECTION_ACCENT } from "./shared/colors";
import { registerRenderer, type RendererHandle, type RenderContext } from "./shared/renderer-registry";

// Galaxy LOD (scale < 0.15): the whole codebase from far away. Each file card
// is tens of CSS pixels — text would be unreadable. This renderer is stripped
// to rectangles-only and draws them via an instanced Mesh: 5000 files → 1
// draw call, no per-file Graphics allocation, no vertex-buffer churn.
//
// Hit testing: the base class' hitLayer Graphics covers every card's AABB with
// a near-zero-alpha fill so Pixi's event system can detect pointerover the
// whole node region, but the actual per-rect lookup is done via
// SpatialPickIndex (RBush).

export class GalaxyNodeRenderer extends RectNodeRenderer<FileNode> {
  // Scratch — captured from update() so renderInstance() can see the
  // per-frame viewport/viewState without re-wiring every call site.
  private frameViewState: ViewState | null = null;
  private frameLayout: WorkspaceLayout | null = null;
  private frameStrokeW = 1;

  // File id → instance row index. Maintained across full rebuilds so a
  // selection-only change can rewrite just 2 rows (old + new) instead of
  // repacking the whole 5000-instance buffer.
  private fileIdToInstanceIdx: Map<string, number> = new Map();
  private prevSelectedFileId: string | null = null;
  private prevHoveredFileId: string | null = null;
  // Same id-set hash as SpatialPickIndex uses internally — when the visible
  // file set is unchanged we can short-circuit to the partial path.
  private prevFileIdsKey: string | null = null;
  private prevInstanceCount = 0;

  constructor(
    parent: Container,
    opts?: {
      onClick?: (fileId: string) => void;
      onHover?: (fileId: string | null) => void;
    },
  ) {
    super(parent, 1024, { onClick: opts?.onClick, onHover: opts?.onHover }, "galaxy");
  }

  // Fill one instance row for a file. Base class tracks AABB + pickRect.
  protected renderInstance(file: FileNode, i: number, data: Float32Array): PickRect | null {
    const layout = this.frameLayout!;
    const viewState = this.frameViewState!;
    const rect = layout.fileRects.get(file.id);
    if (!rect) return null;

    const isSelected = viewState.selectedFileId === file.id;
    const isHovered = viewState.hoveredFileId === file.id;

    const fillColor = riskFill(file.riskScore);
    const borderColor = isSelected ? SELECTION_ACCENT : riskBorder(file.riskScore);
    const fillAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.88;
    const borderAlpha = isSelected ? 1.0 : 0.7;
    const bw = isSelected ? this.frameStrokeW * 2 : this.frameStrokeW;

    const o = i * FLOATS_PER_INSTANCE;
    data[o] = rect.x;
    data[o + 1] = rect.y;
    data[o + 2] = rect.w;
    data[o + 3] = rect.h;
    unpackHexInto(fillColor, data, o + 4, fillAlpha);
    unpackHexInto(borderColor, data, o + 8, borderAlpha);
    data[o + 12] = bw;
    data[o + 13] = 6; // corner radius

    this.fileIdToInstanceIdx.set(file.id, i);
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h, id: file.id };
  }

  update(files: FileNode[], layout: WorkspaceLayout, viewState: ViewState, viewport: Viewport): void {
    this.frameStrokeW = Math.min(8, Math.max(0.5, 1 / viewport.scale));
    this.frameLayout = layout;
    this.frameViewState = viewState;

    // Build the id-set cache key (same rounding scheme as SpatialPickIndex
    // so the two caches invalidate in lockstep).
    const idsKey = this.buildIdsKey(files, layout);
    const selection = viewState.selectedFileId ?? null;
    const hover = viewState.hoveredFileId ?? null;
    const selectionChanged = selection !== this.prevSelectedFileId || hover !== this.prevHoveredFileId;

    if (idsKey === this.prevFileIdsKey && selectionChanged && this.prevInstanceCount > 0) {
      // Partial path: the visible file set is unchanged; only the selection
      // or hover flipped. Rewrite at most 2 rows (old + new) instead of the
      // whole buffer (for 5000 files, that's ~10 bytes of writes instead of
      // 280 KB). Pixi's `Buffer.update(sizeInBytes)` only supports a prefix
      // upload, so we still re-upload all bytes — but skipping 5000 JS
      // loops around `unpackHexInto` etc. is the win.
      this.partialUpdateSelection(files, layout, viewState);
      this.prevSelectedFileId = selection;
      this.prevHoveredFileId = hover;
      return;
    }

    // Full path.
    this.fileIdToInstanceIdx.clear();
    // updateBase uses rect index → fileId iteration; null returns (missing
    // in layout) mean we write fewer meaningful rows than we advance — skip
    // those by filtering ahead so the row/index stay aligned.
    const valid: FileNode[] = [];
    for (const f of files) {
      if (layout.fileRects.has(f.id)) valid.push(f);
    }
    this.prevInstanceCount = this.updateBase(valid);
    this.prevFileIdsKey = idsKey;
    this.prevSelectedFileId = selection;
    this.prevHoveredFileId = hover;
  }

  // Partial rewrite: only the affected instance rows (old selection, new
  // selection, old hover, new hover — union up to 4 rows). All other rows
  // in the Float32Array are already correct from the last full rebuild.
  private partialUpdateSelection(files: FileNode[], layout: WorkspaceLayout, viewState: ViewState): void {
    const data = this.rectMesh.view();
    const affected = new Set<string>();
    if (this.prevSelectedFileId) affected.add(this.prevSelectedFileId);
    if (this.prevHoveredFileId) affected.add(this.prevHoveredFileId);
    if (viewState.selectedFileId) affected.add(viewState.selectedFileId);
    if (viewState.hoveredFileId) affected.add(viewState.hoveredFileId);

    // Saved per-frame scratch from the full path — still valid for a
    // selection-only tick (viewport.scale may have changed slightly but we
    // gate on scaleBucket up in PixiStage; selection ticks won't change it).
    const prevViewState = this.frameViewState;
    this.frameViewState = viewState;
    this.frameLayout = layout;

    for (const file of files) {
      if (!affected.has(file.id)) continue;
      const idx = this.fileIdToInstanceIdx.get(file.id);
      if (idx === undefined) continue;
      this.renderInstance(file, idx, data);
    }

    // Upload the prefix that contains all our written rows. Pixi doesn't
    // expose byteOffset on update(), so we have to upload from 0 to the
    // last-touched row end. Over 5000 rows this still beats the full
    // repack's allocation+packing cost: the JS work is tiny.
    this.rectMesh.setInstanceCount(this.prevInstanceCount);
    // Restore scratch — avoids leaking state if a downstream renderer
    // shares any of the frameLayout reference semantics.
    void prevViewState;
  }

  private buildIdsKey(files: FileNode[], layout: WorkspaceLayout): string {
    if (files.length === 0) return "";
    let s = String(files.length);
    for (const f of files) {
      const r = layout.fileRects.get(f.id);
      if (!r) continue;
      s += "|" + f.id + "," + (r.x | 0) + "," + (r.y | 0) + "," + (r.w | 0) + "," + (r.h | 0);
    }
    return s;
  }

  override clear(): void {
    super.clear();
    this.fileIdToInstanceIdx.clear();
    this.prevFileIdsKey = null;
    this.prevSelectedFileId = null;
    this.prevHoveredFileId = null;
    this.prevInstanceCount = 0;
  }

  override destroy(): void {
    this.fileIdToInstanceIdx.clear();
    super.destroy();
  }
}

// Self-register with the LOD tier registry. Import side-effect; the renderers
// barrel pulls this module at app init so `PixiStage` finds the factory.
registerRenderer("galaxy", (parent, callbacks): RendererHandle => {
  const inst = new GalaxyNodeRenderer(parent, {
    onClick: callbacks.onFileClick,
    onHover: callbacks.onFileHover,
  });
  return {
    update(ctx: RenderContext): void {
      // Galaxy only activates at `sceneKind === "files"`. Any other ctx here
      // is a PixiStage dispatch bug — ignore rather than throw (a console
      // warn would drown the hot path; silent no-op is safest).
      if (ctx.sceneKind !== "files") return;
      inst.update(ctx.files, ctx.layout, ctx.viewState, ctx.viewport);
    },
    clear(): void { inst.clear(); },
    destroy(): void { inst.destroy(); },
  };
});
