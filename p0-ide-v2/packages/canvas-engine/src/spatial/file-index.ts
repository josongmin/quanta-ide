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

  clear(): void {
    this.tree.clear();
  }
}
