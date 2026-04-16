interface FileNodeBase {
  name: string;
  depth: number;
}
export interface FolderNode extends FileNodeBase {
  type: "folder";
  open?: boolean;
}
export interface FileLeaf extends FileNodeBase {
  type: "file";
  active?: boolean;
  issues?: number;
  risk?: 1 | 2 | 3 | 4;
  git?: "M" | "A" | "?" | "D";
  tests?: string;
  stale?: string;
}
export type FileNode = FolderNode | FileLeaf;

export const defaultNodes: FileNode[] = [
  { name: "codegraph_agent", type: "folder", depth: 0, open: true },
  { name: "orchestrator", type: "folder", depth: 1, open: true },
  { name: "orchestrator.py", type: "file", depth: 2, active: true, git: "M", tests: "0/12", issues: 3, risk: 4 },
  { name: "routing_policy.py", type: "file", depth: 2, git: "M" },
  { name: "tools", type: "folder", depth: 1, open: true },
  { name: "plan_orchestration", type: "folder", depth: 2, open: true },
  { name: "security.py", type: "file", depth: 3, git: "A" },
  { name: "base.py", type: "file", depth: 3 },
  { name: "infrastructure", type: "folder", depth: 1 },
  { name: "domain", type: "folder", depth: 1 },
  { name: "shared", type: "folder", depth: 1 },
  { name: "pyproject.toml", type: "file", depth: 0 },
];

export function isVisible(nodes: FileNode[], idx: number, openState: Record<string, boolean>): boolean {
  const node = nodes[idx];
  if (node.depth === 0) return true;

  let remainingDepth = node.depth;
  for (let i = idx - 1; i >= 0; i--) {
    const candidate = nodes[i];
    if (candidate.type === "folder" && candidate.depth === remainingDepth - 1) {
      const key = `${candidate.name}__${candidate.depth}`;
      const isOpen = key in openState ? openState[key] : (candidate.open ?? false);
      if (!isOpen) return false;
      remainingDepth--;
      if (remainingDepth === 0) return true;
    }
  }
  return true;
}
