import { memo, type ReactNode } from "react";
import type { ExternalNode } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  node: ExternalNode;
  active?: boolean;
  expandable?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onExpand?: (nodeId: string) => void;
}

const S = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function DbIcon() {
  return (<svg {...S}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>);
}
function CacheIcon() {
  return (<svg {...S}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>);
}
function QueueIcon() {
  return (<svg {...S}><rect x="2" y="4" width="20" height="5" rx="1" /><rect x="2" y="15" width="20" height="5" rx="1" /><path d="M12 9v6M9 12l3 3 3-3" /></svg>);
}
function ApiIcon() {
  return (<svg {...S}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>);
}
function StorageIcon() {
  return (<svg {...S}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" /></svg>);
}

const TERMINAL_ICONS: Record<string, () => ReactNode> = {
  db: DbIcon,
  cache: CacheIcon,
  queue: QueueIcon,
  api: ApiIcon,
  storage: StorageIcon,
};

const TERMINAL_LABELS: Record<string, string> = {
  db: "Database",
  cache: "Cache",
  queue: "Queue",
  api: "External API",
  storage: "Storage",
};

export const ExtNode = memo(function ExtNode({ node, active, expandable, onNodeClick, onExpand }: Props) {
  const hasFileGroup = !!node.file;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick?.(node.id);
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand?.(node.id);
  };

  // Terminal endpoint — special card with icon
  if (node.isTerminal && node.terminalKind) {
    const Icon = TERMINAL_ICONS[node.terminalKind];
    return (
      <div
        className={cn("terminal-node", `terminal-node--${node.terminalKind}`, active && "terminal-node--active")}
        style={{ left: node.x, top: node.y, width: node.w }}
        onClick={handleClick}
      >
        <div className="terminal-node__icon">
          {Icon && <Icon />}
        </div>
        <div className="terminal-node__info">
          <div className="terminal-node__kind">{TERMINAL_LABELS[node.terminalKind] ?? node.terminalKind}</div>
          <div className="terminal-node__name" title={node.name}>{node.name}</div>
        </div>
      </div>
    );
  }

  // Regular external node
  return (
    <div
      className={cn("ext-node", hasFileGroup && "ext-node--in-group", active && "ext-node--active")}
      style={{ left: node.x, top: node.y, width: node.w }}
      onClick={handleClick}
    >
      {node.layer && (
        <span className={cn("ext-node__layer", `ext-node__layer--${node.layer}`)}>
          {node.layer}
        </span>
      )}
      <div className="ext-node__name" title={node.name}>{node.name}</div>
      {!hasFileGroup && node.file && (
        <div className="ext-node__file" title={node.file}>{node.file}</div>
      )}
      {expandable && (
        <button
          type="button"
          className="ext-node__expand"
          onClick={handleExpand}
          title="Expand flow — trace next hop"
        >
          →
        </button>
      )}
    </div>
  );
});
