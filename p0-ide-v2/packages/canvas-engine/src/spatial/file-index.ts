import RBush from "rbush";
import type { Rect } from "../graph/types";

interface FileBBoxItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  fileId: string;
}

export class FileIndex {
  private tree = new RBush<FileBBoxItem>();

  load(fileRects: Map<string, Rect>): void {
    this.tree.clear();
    const items: FileBBoxItem[] = [];
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
  queryItems(viewport: { x: number; y: number; w: number; h: number }): ReadonlyArray<FileBBoxItem> {
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
