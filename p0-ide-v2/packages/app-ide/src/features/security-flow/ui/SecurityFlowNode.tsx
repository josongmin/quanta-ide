import type { SecurityHopKind } from "@quanta/app-ide/entities/security-flow";
import type { LayoutNode } from "../model/layout";
import { cn } from "@quanta/ui-kit/lib";

// ── Icons per node kind ─────────────────────────────────────────────

const S = {
  width: 14, height: 14, viewBox: "0 0 24 24",
  fill: "none" as const, stroke: "currentColor" as const,
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

function SourceIcon() {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12l4-4 4 4" />
    </svg>
  );
}

function PropagateIcon() {
  return (
    <svg {...S}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function SanitizeIcon() {
  return (
    <svg {...S}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function GuardIcon() {
  return (
    <svg {...S}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SinkIcon() {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function GapIcon() {
  return (
    <svg {...S}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg {...S}>
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}

const KIND_ICONS: Record<SecurityHopKind, () => JSX.Element> = {
  source: SourceIcon,
  propagate: PropagateIcon,
  sanitize: SanitizeIcon,
  guard: GuardIcon,
  sink: SinkIcon,
  gap: GapIcon,
  branch: BranchIcon,
};

const KIND_LABELS: Record<SecurityHopKind, string> = {
  source: "SOURCE",
  propagate: "PROPAGATE",
  sanitize: "SANITISED",
  guard: "GUARD",
  sink: "SINK",
  gap: "GAP",
  branch: "BRANCH",
};

// ── Component ───────────────────────────────────────────────────────

interface Props {
  ln: LayoutNode;
  active: boolean;
  dimmed: boolean;
  onClick: (nodeId: string) => void;
}

export function SecurityFlowNode({ ln, active, dimmed, onClick }: Props) {
  const { node } = ln;
  const Icon = KIND_ICONS[node.kind];

  return (
    <div
      className={cn(
        "sf-node",
        `sf-node--${node.kind}`,
        active && "sf-node--active",
        dimmed && "sf-node--dimmed",
      )}
      style={{ left: ln.x, top: ln.y, width: ln.w, height: ln.h }}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
    >
      <div className="sf-node__head">
        <span className={cn("sf-node__icon", `sf-node__icon--${node.kind}`)}>
          <Icon />
        </span>
        <span className="sf-node__kind">{KIND_LABELS[node.kind]}</span>
        {node.confidence !== "high" && (
          <span className={cn("sf-node__conf", `sf-node__conf--${node.confidence}`)}>
            {node.confidence}
          </span>
        )}
      </div>
      <div className="sf-node__label" title={node.label}>{node.label}</div>
      {node.kind === "gap" && node.expectedSanitizer && (
        <div className="sf-node__expected" title={node.expectedSanitizer}>
          needs: {node.expectedSanitizer}
        </div>
      )}
    </div>
  );
}
