import type {
  SecurityFlowFinding, SecurityFlowNode, SecurityFlowPath,
} from "@quanta/app-ide/entities/security-flow";
import { OWASP_TITLES } from "@quanta/app-ide/entities/security-flow";
import { cn } from "@quanta/ui-kit/lib";

// ── Helpers ─────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  source: "sf-badge--source",
  propagate: "sf-badge--propagate",
  sanitize: "sf-badge--sanitize",
  guard: "sf-badge--guard",
  sink: "sf-badge--sink",
  gap: "sf-badge--gap",
  branch: "sf-badge--branch",
};

const KIND_LABELS: Record<string, string> = {
  source: "SOURCE",
  propagate: "PROPAGATE",
  sanitize: "SANITISED",
  guard: "GUARD",
  sink: "SINK",
  gap: "GAP",
  branch: "BRANCH",
};

function ConfidenceBar({ confidence }: { confidence: string }) {
  const pct = confidence === "high" ? 100 : confidence === "medium" ? 66 : 33;
  return (
    <div className="sf-ev__conf-bar">
      <div className="sf-ev__conf-track">
        <div
          className={cn("sf-ev__conf-fill", `sf-ev__conf-fill--${confidence}`)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="sf-ev__conf-label">{confidence}</span>
    </div>
  );
}

// ── Node evidence view ──────────────────────────────────────────────

function NodeEvidence({ node }: { node: SecurityFlowNode }) {
  return (
    <div className="sf-ev__node">
      {/* Kind badge */}
      <span className={cn("sf-ev__kind-badge", KIND_COLORS[node.kind])}>
        {KIND_LABELS[node.kind]}
      </span>

      {/* Symbol */}
      <h3 className="sf-ev__symbol">{node.label}</h3>

      {/* File ref */}
      <div className="sf-ev__file">
        {node.file}:{node.line}
        {node.col != null && `:${node.col}`}
      </div>

      {/* Detail */}
      <p className="sf-ev__detail">{node.detail}</p>

      {/* Code snippet */}
      {node.snippet && (
        <pre className="sf-ev__snippet"><code>{node.snippet}</code></pre>
      )}

      {/* Data type */}
      {node.dataType && (
        <div className="sf-ev__row">
          <span className="sf-ev__row-label">Data type</span>
          <span className="sf-ev__row-value">{node.dataType}</span>
        </div>
      )}

      {/* Confidence */}
      <div className="sf-ev__row">
        <span className="sf-ev__row-label">Confidence</span>
        <ConfidenceBar confidence={node.confidence} />
      </div>

      {/* Gap-specific: expected sanitiser */}
      {node.kind === "gap" && node.expectedSanitizer && (
        <div className="sf-ev__gap-fix">
          <div className="sf-ev__gap-fix-label">Expected sanitiser</div>
          <code className="sf-ev__gap-fix-value">{node.expectedSanitizer}</code>
        </div>
      )}
    </div>
  );
}

// ── Path summary view (when no node selected) ───────────────────────

function PathSummary({
  path,
  finding,
}: {
  path: SecurityFlowPath;
  finding: SecurityFlowFinding;
}) {
  return (
    <div className="sf-ev__path-summary">
      <h3 className="sf-ev__path-title">{path.title}</h3>

      {path.owaspCode && (
        <div className="sf-ev__row">
          <span className="sf-ev__row-label">OWASP</span>
          <span className="sf-ev__row-value">
            {path.owaspCode} — {OWASP_TITLES[path.owaspCode]}
          </span>
        </div>
      )}

      <div className="sf-ev__row">
        <span className="sf-ev__row-label">Severity</span>
        <span className={cn("sf-ev__sev-pill", `sf-ev__sev-pill--${path.severity}`)}>
          {path.severity === 3 ? "HIGH" : path.severity === 2 ? "MEDIUM" : "LOW"}
        </span>
      </div>

      <div className="sf-ev__row">
        <span className="sf-ev__row-label">Confidence</span>
        <ConfidenceBar confidence={path.confidence} />
      </div>

      <div className="sf-ev__row">
        <span className="sf-ev__row-label">Reachable</span>
        <span className={cn("sf-ev__bool", path.reachable ? "sf-ev__bool--yes" : "sf-ev__bool--no")}>
          {path.reachable ? "Yes" : "No"}
        </span>
      </div>

      {path.sanitizerGaps.length > 0 && (
        <div className="sf-ev__row">
          <span className="sf-ev__row-label">Gaps</span>
          <span className="sf-ev__row-value sf-ev__row-value--danger">
            {path.sanitizerGaps.length} missing sanitiser{path.sanitizerGaps.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {path.isNew && (
        <div className="sf-ev__new-badge">New in this PR</div>
      )}

      {/* Fix guidance */}
      {finding.fixGuidance && (
        <div className="sf-ev__fix">
          <div className="sf-ev__fix-label">Remediation</div>
          <p className="sf-ev__fix-text">{finding.fixGuidance}</p>
        </div>
      )}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────

interface Props {
  finding: SecurityFlowFinding;
  activePath: SecurityFlowPath | null;
  activeNode: SecurityFlowNode | null;
}

export function SecurityEvidencePanel({ finding, activePath, activeNode }: Props) {
  return (
    <aside className="sf-evidence">
      <div className="sf-evidence__header">
        <h4 className="sf-evidence__title">
          {activeNode ? "Node Evidence" : "Path Summary"}
        </h4>
      </div>

      <div className="sf-evidence__body">
        {activeNode ? (
          <NodeEvidence node={activeNode} />
        ) : activePath ? (
          <PathSummary path={activePath} finding={finding} />
        ) : (
          <div className="sf-evidence__empty">Select a path to see details</div>
        )}
      </div>
    </aside>
  );
}
