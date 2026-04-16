import type { FileGroup } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  group: FileGroup;
}

function riskTone(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function budgetTone(pct: number): "high" | "mid" | "low" {
  if (pct >= 80) return "high";
  if (pct >= 50) return "mid";
  return "low";
}

function countTone(n: number): "high" | "mid" | "low" {
  if (n >= 5) return "high";
  if (n >= 1) return "mid";
  return "low";
}

export function FileGroupBg({ group }: Props) {
  const tone = riskTone(group.riskScore);
  const cpxT = budgetTone(group.cpxBudgetPct);

  return (
    <div
      className="file-group"
      style={{ left: group.x, top: group.y, width: group.w, height: group.h }}
    >
      {/* ── Header ── */}
      <div className="file-group__header">
        <svg className="file-group__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M4 1.5h5.586a1 1 0 0 1 .707.293l2.414 2.414a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9.5 1.5V4a.5.5 0 0 0 .5.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="file-group__name">{group.name}</span>
        <span className="file-group__meta">{group.loc} loc</span>
        <span className="file-group__meta">@{group.owner}</span>
        <span className="file-group__spacer" />
        <span
          className={cn("file-group__risk", `file-group__risk--${tone}`)}
          title={`Risk score: ${group.riskScore}`}
        >
          {group.riskScore}
        </span>
      </div>

      {/* ── Metrics strip ── */}
      <div className="file-group__metrics">
        {/* Complexity — always shown */}
        <div
          className={cn("m-chip", `m-chip--${cpxT}`)}
          title={`Cyclomatic complexity — peak ${group.cpxMax}, budget ${group.cpxBudgetPct}%`}
        >
          <span className="m-chip__label">Complexity</span>
          <div className="m-chip__body">
            <span className="m-chip__num">{group.cpxMax}</span>
            <span className="m-chip__pct">{group.cpxBudgetPct}%</span>
          </div>
          <div className="m-chip__bar">
            <div
              className={cn("m-chip__bar-fill", `m-chip__bar-fill--${cpxT}`)}
              style={{ width: `${Math.min(group.cpxBudgetPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Blast radius */}
        {group.blast > 0 && (
          <div
            className={cn("m-chip", `m-chip--${countTone(group.blast)}`)}
            title={`Blast radius — ${group.blast} affected${group.blastCritical > 0 ? `, ${group.blastCritical} critical` : ""}`}
          >
            <span className="m-chip__label">Blast radius</span>
            <div className="m-chip__body">
              <span className="m-chip__num">{group.blast}</span>
              {group.blastCritical > 0 && (
                <span className="m-chip__crit">{group.blastCritical} crit</span>
              )}
            </div>
          </div>
        )}

        {/* Taint flows */}
        {group.taintCount > 0 && (
          <div
            className={cn("m-chip", `m-chip--${countTone(group.taintCount)}`)}
            title={`${group.taintCount} unsafe data paths`}
          >
            <span className="m-chip__label">Taint</span>
            <span className="m-chip__num">{group.taintCount}</span>
          </div>
        )}

        {/* Arch violations */}
        {group.archViolations > 0 && (
          <div
            className={cn("m-chip", `m-chip--${countTone(group.archViolations)}`)}
            title={`${group.archViolations} layer rule breaks`}
          >
            <span className="m-chip__label">Violations</span>
            <span className="m-chip__num">{group.archViolations}</span>
          </div>
        )}

        {/* Dead code */}
        {group.deadCount > 0 && (
          <div
            className={cn("m-chip", `m-chip--${countTone(group.deadCount)}`)}
            title={`${group.deadCount} unreachable symbols`}
          >
            <span className="m-chip__label">Dead code</span>
            <span className="m-chip__num">{group.deadCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}
