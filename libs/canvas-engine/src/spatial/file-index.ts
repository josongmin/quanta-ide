import RBush from "rbush";
import type { Rect } from "../graph/types";

interface FileBBoxItem {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly fileId: string;
}

// Internal mutable variant used only at insertion time. rbush writes the
// bbox fields once during `load()` and treats them as frozen afterwards;
// we expose `FileBBoxItem` (all-readonly) to consumers via `queryItems()`
// so external code can't accidentally mutate rbush's leaf references.
type MutableFileBBoxItem = { -readonly [K in keyof FileBBoxItem]: FileBBoxItem[K] };

export class FileIndex {
  private tree = new RBush<FileBBoxItem>();

  load(fileRects: Map<string, Rect>, packed?: unknown): void {
    this.tree.clear();
    // Fast path: rehydrate from a pre-packed rbush node tree. The layout
    // worker runs `tree.load(items)` once (O(N log N)) and ships the
    // resulting `tree.toJSON()` blob alongside the layout. rbush's
    // `fromJSON` is `this.data = blob` — O(1). For a 6k-file graph that
    // saves ~5-10 ms of main-thread boot time per layout arrival.
    if (packed !== undefined && packed !== null) {
      // rbush's fromJSON accepts the opaque node structure we got back
      // from toJSON. The cast is pragmatic: we don't introspect the
      // blob, rbush owns the shape.
      (this.tree as unknown as { fromJSON: (d: unknown) => unknown }).fromJSON(packed);
      return;
    }
    const items: MutableFileBBoxItem[] = [];
    for (const [fileId, rect] of fileRects) {
      items.push({
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.w,
        maxY: rect.y + rect.h,
        fileId,
      });
    }
    this.tree.load(items);
  }

  /**
   * Capture the tree's internal node data in a structured-clone-safe
   * form — the worker uses this to pre-build the index during layout
   * compute, then attaches the result to `WorkspaceLayout.packedSpatialIndex`
   * so the main thread's `FileIndex.load(..., packed)` can skip the
   * O(N log N) pack step.
   *
   * Returns `unknown` because the inner shape is rbush-private —
   * consumers hand this straight back to `load` without reading it.
   */
  toPacked(): unknown {
    return (this.tree as unknown as { toJSON: () => unknown }).toJSON();
  }

  query(viewport: { x: number; y: number; w: number; h: number }): string[] {
    const results = this.tree.search({
      minX: viewport.x,
      minY: viewport.y,
      maxX: viewport.x + viewport.w,
      maxY: viewport.y + viewport.h,
    });
    return results.map((item) => item.fileId);
  }

  /**
   * Hot-path variant of `query` that returns the raw bbox items (each
   * carries the `fileId` field) so callers can avoid an extra
   * `.map(item => item.fileId)` allocation. rbush already returns a fresh
   * array, so the only allocation here is rbush's own result buffer.
   *
   * Items returned are **read-only** — do not mutate.
   */
  queryItems(viewport: { x: number; y: number; w: number; h: number }): ReadonlyArray<Readonly<FileBBoxItem>> {
    return this.tree.search({
      minX: viewport.x,
      minY: viewport.y,
      maxX: viewport.x + viewport.w,
      maxY: viewport.y + viewport.h,
    });
  }

  clear(): void {
    this.tree.clear();
  }
}

export type { FileBBoxItem };
