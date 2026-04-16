import type { ExternalNode } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  node: ExternalNode;
}

export function ExtNode({ node }: Props) {
  const hasFileGroup = !!node.file;

  return (
    <div
      className={cn("ext-node", hasFileGroup && "ext-node--in-group")}
      style={{ left: node.x, top: node.y, width: node.w }}
    >
      {node.layer && (
        <span className={cn("ext-node__layer", `ext-node__layer--${node.layer}`)}>
          {node.layer}
        </span>
      )}
      <div className="ext-node__name" title={node.name}>{node.name}</div>
      {/* Show file only for standalone nodes (no group) */}
      {!hasFileGroup && node.file && (
        <div className="ext-node__file" title={node.file}>{node.file}</div>
      )}
    </div>
  );
}
