import { useCallback, useMemo, useState } from "react";
import { isVisible, type FileNode } from "../lib/sidebar.utils";

export interface FileTreeState {
  openState: Record<string, boolean>;
  visibleNodes: { node: FileNode; idx: number }[];
  toggleFolder: (name: string, depth: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

export function useFileTreeState(nodes: FileNode[]): FileTreeState {
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  const toggleFolder = useCallback((name: string, depth: number) => {
    const key = `${name}__${depth}`;
    setOpenState((prev) => {
      const current = key in prev
        ? prev[key]
        : ((() => {
            const found = nodes.find((n) => n.name === name && n.depth === depth);
            return found?.type === "folder" ? (found.open ?? false) : false;
          })());
      return { ...prev, [key]: !current };
    });
  }, [nodes]);

  const expandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of nodes) if (n.type === "folder") next[`${n.name}__${n.depth}`] = true;
    setOpenState(next);
  }, [nodes]);

  const collapseAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of nodes) if (n.type === "folder") next[`${n.name}__${n.depth}`] = false;
    setOpenState(next);
  }, [nodes]);

  const visibleNodes = useMemo(
    () => nodes.map((node, i) => ({ node, idx: i })).filter(({ idx }) => isVisible(nodes, idx, openState)),
    [nodes, openState],
  );

  return { openState, visibleNodes, toggleFolder, expandAll, collapseAll };
}
