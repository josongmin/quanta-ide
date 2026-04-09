import { create } from "zustand";
import { FILE_META, type FileMeta } from "./file-meta";

interface FileTooltipState {
  meta: FileMeta | null;
  x: number;
  y: number;
  show: (name: string, x: number, y: number) => void;
  hide: () => void;
}

export const useFileTooltip = create<FileTooltipState>()((set) => ({
  meta: null,
  x: 0,
  y: 0,
  show: (name, x, y) => {
    const key = name.replace(/\/$/, "");
    const meta = FILE_META[key] ?? null;
    set({ meta, x, y });
  },
  hide: () => { set({ meta: null }); },
}));
