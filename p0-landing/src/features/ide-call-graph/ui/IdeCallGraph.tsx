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

export function IdeCallGraph({ nodes, onNodeClick }: IdeCallGraphProps) {
  return (
    <div className="ide-callgraph">
      {nodes.map((n, i) => (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- tree node
        <div
          key={`${n.name}-${i.toString()}`}
          className="ide-callgraph-row"
          data-depth={n.depth}
          onClick={onNodeClick ? () => { onNodeClick(n.name); } : undefined}
          style={onNodeClick ? { cursor: "pointer" } : undefined}
        >
          <span className="ide-callgraph-tree">{treeChars(n.depth, n.isLast ?? false)}</span>
          <span className="ide-callgraph-name">{n.name}</span>
          {n.tag && <span className="ide-callgraph-tag" data-tag={n.tag}>{n.tag}</span>}
        </div>
      ))}
    </div>
  );
}
