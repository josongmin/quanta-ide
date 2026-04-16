import type { SecurityFlowFinding, SecurityFlowPath } from "@quanta/app-ide/entities/security-flow";
import { OWASP_TITLES } from "@quanta/app-ide/entities/security-flow";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  finding: SecurityFlowFinding;
  selectedPathId: string | null;
  onSelectPath: (pathId: string) => void;
}

const SEV_LABEL: Record<number, string> = { 3: "HIGH", 2: "MED", 1: "LOW" };

function SeverityBars({ severity }: { severity: 1 | 2 | 3 }) {
  return (
    <span className={cn("sf-sev-bars", `sf-sev-bars--${severity}`)}>
      <span className="sf-sev-bars__bar sf-sev-bars__bar--filled" />
      <span className={cn("sf-sev-bars__bar", severity >= 2 && "sf-sev-bars__bar--filled")} />
      <span className={cn("sf-sev-bars__bar", severity >= 3 && "sf-sev-bars__bar--filled")} />
    </span>
  );
}

function ConfidenceDots({ confidence }: { confidence: string }) {
  const level = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
  return (
    <span className="sf-conf-dots">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("sf-conf-dots__dot", i <= level && "sf-conf-dots__dot--filled")} />
      ))}
    </span>
  );
}

function PathCard({
  path,
  selected,
  onSelect,
}: {
  path: SecurityFlowPath;
  selected: boolean;
  onSelect: () => void;
}) {
  const gapCount = path.sanitizerGaps.length;
  const nodeCount = path.nodes.length;

  return (
    <button
      className={cn("sf-path-card", selected && "sf-path-card--selected")}
      onClick={onSelect}
      type="button"
    >
      <div className="sf-path-card__head">
        <SeverityBars severity={path.severity} />
        <span className={cn("sf-path-card__sev", `sf-path-card__sev--${path.severity}`)}>
          {SEV_LABEL[path.severity]}
        </span>
        {path.isNew && <span className="sf-path-card__badge sf-path-card__badge--new">NEW</span>}
        {!path.reachable && <span className="sf-path-card__badge sf-path-card__badge--unreach">UNREACH</span>}
      </div>

      <div className="sf-path-card__title">{path.title}</div>

      <div className="sf-path-card__meta">
        <span>{nodeCount} hops</span>
        {gapCount > 0 && (
          <span className="sf-path-card__gaps">
            {gapCount} gap{gapCount > 1 ? "s" : ""}
          </span>
        )}
        <ConfidenceDots confidence={path.confidence} />
      </div>
    </button>
  );
}

export function SecurityPathList({ finding, selectedPathId, onSelectPath }: Props) {
  const newCount = finding.paths.filter((p) => p.isNew).length;

  return (
    <aside className="sf-path-list">
      {/* Finding header */}
      <div className="sf-path-list__header">
        <div className="sf-path-list__owasp">
          <span className={cn("sf-owasp-badge", `sf-owasp-badge--${finding.severity}`)}>
            {finding.owaspCode}
          </span>
          <span className="sf-path-list__owasp-title">
            {OWASP_TITLES[finding.owaspCode]}
          </span>
        </div>
        <h2 className="sf-path-list__finding-title">{finding.title}</h2>
        <div className="sf-path-list__stats">
          <span>{finding.paths.length} path{finding.paths.length > 1 ? "s" : ""}</span>
          {newCount > 0 && <span className="sf-path-list__new-count">{newCount} new in PR</span>}
        </div>
      </div>

      {/* Path cards */}
      <div className="sf-path-list__cards">
        {finding.paths.map((path) => (
          <PathCard
            key={path.id}
            path={path}
            selected={path.id === selectedPathId}
            onSelect={() => onSelectPath(path.id)}
          />
        ))}
      </div>
    </aside>
  );
}
