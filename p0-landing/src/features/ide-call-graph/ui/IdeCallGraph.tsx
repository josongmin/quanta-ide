export interface CallNode {
  name: string;
  depth: 0 | 1 | 2;
  tag?: string;
  isLast?: boolean;
}

interface IdeCallGraphProps {
  nodes: CallNode[];
  onNodeClick?: (name: string) => void;
}

function treeChars(depth: number, isLast: boolean): string {
  if (depth === 0) return "";
  if (depth === 1) return isLast ? "└─ " : "├─ ";
  return isLast ? "   └─ " : "   ├─ ";
}

import { useTranslation } from "react-i18next";

export function IdeCallGraph({ nodes, onNodeClick }: IdeCallGraphProps) {
  const { t } = useTranslation();
  return (
    <div className="ide-callgraph" role="tree" aria-label={t("ide.callGraph.aria")}>
      {nodes.map((n, i) => (
        <div
          key={`${n.name}-${i.toString()}`}
          role="treeitem"
          aria-level={n.depth + 1}
          aria-selected={false}
          aria-label={
            n.tag !== undefined
              ? `${n.name}, ${t(`ide.callGraph.tags.${n.tag}`)}`
              : n.name
          }
          tabIndex={onNodeClick ? 0 : -1}
          className="ide-callgraph-row"
          data-depth={n.depth}
          onClick={onNodeClick ? () => { onNodeClick(n.name); } : undefined}
          onKeyDown={
            onNodeClick
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onNodeClick(n.name);
                  }
                }
              : undefined
          }
          style={onNodeClick ? { cursor: "pointer" } : undefined}
        >
          <span className="ide-callgraph-tree">{treeChars(n.depth, n.isLast ?? false)}</span>
          <span className="ide-callgraph-name">{n.name}</span>
          {n.tag !== undefined && (
            <span className="ide-callgraph-tag" data-tag={n.tag}>{t(`ide.callGraph.tags.${n.tag}`)}</span>
          )}
        </div>
      ))}
    </div>
  );
}
