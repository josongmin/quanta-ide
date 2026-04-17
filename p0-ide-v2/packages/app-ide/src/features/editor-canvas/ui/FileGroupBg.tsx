import type { FileGroup } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  group: FileGroup;
}

type Tone = "high" | "mid" | "low";

function riskTone(s: number): Tone { return s >= 70 ? "high" : s >= 40 ? "mid" : "low"; }
function countTone(n: number): Tone { return n >= 5 ? "high" : n >= 1 ? "mid" : "low"; }

function cellTone(n: number): string {
  if (n === 0) return "stat-cell--zero";
  const t = countTone(n);
  return t === "low" ? "" : `stat-cell--${t}`;
}

const RISK_LABEL: Record<Tone, string> = { high: "High risk", mid: "Medium risk", low: "Low risk" };

export function FileGroupBg({ group }: Props) {
  const tone = riskTone(group.riskScore);

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
        <span className="file-group__spacer" />
        <span className="file-group__meta">@{group.owner}</span>
      </div>

      {/* ── Risk score hero ── */}
      <div className={cn("file-score", `file-score--${tone}`)}>
        <div className="file-score__head">
          <span className="file-score__val">{group.riskScore}</span>
          <span className="file-score__denom">/100</span>
          <span className="file-score__spacer" />
          <span className={cn("file-score__badge", `file-score__badge--${tone}`)}>
            <span className="file-score__dot" />
            {RISK_LABEL[tone]}
          </span>
        </div>
        <div className="file-score__bar">
          <div
            className="file-score__bar-fill"
            style={{ width: `${group.riskScore}%` }}
          />
        </div>
      </div>

      {/* ── Stat grid ── */}
      <div className="file-stats">
        {/* Row 1: structure metrics — solid separators */}
        <div className="file-stats__row file-stats__row--solid">
          <div className="stat-cell">
            <div className="stat-cell__head">
              <span className="stat-cell__icon">≡</span>
              <span className="stat-cell__num">{group.loc.toLocaleString()}</span>
            </div>
            <span className="stat-cell__label">Lines</span>
          </div>
          <div className="stat-cell">
            <div className="stat-cell__head">
              <span className="stat-cell__icon">λ</span>
              <span className="stat-cell__num">{group.cpxMax}</span>
            </div>
            <span className="stat-cell__label">Cpx peak</span>
          </div>
          <div className={cn("stat-cell", cellTone(group.blast))}>
            <div className="stat-cell__head">
              <span className="stat-cell__icon">→</span>
              <span className="stat-cell__num">{group.blast}</span>
              {group.blastCritical > 0 && (
                <span className="stat-cell__crit">{group.blastCritical} crit</span>
              )}
            </div>
            <span className="stat-cell__label">Blast</span>
          </div>
        </div>

        {/* Row 2: quality metrics — dashed separators */}
        <div className="file-stats__row file-stats__row--dashed">
          <div className={cn("stat-cell", cellTone(group.taintCount))}>
            <div className="stat-cell__head">
              <span className="stat-cell__icon">⚡</span>
              <span className="stat-cell__num">{group.taintCount}</span>
            </div>
            <span className="stat-cell__label">Taint</span>
          </div>
          <div className={cn("stat-cell", cellTone(group.archViolations))}>
            <div className="stat-cell__head">
              <span className="stat-cell__icon">⊘</span>
              <span className="stat-cell__num">{group.archViolations}</span>
            </div>
            <span className="stat-cell__label">Violations</span>
          </div>
          <div className={cn("stat-cell", cellTone(group.deadCount))}>
            <div className="stat-cell__head">
              <span className="stat-cell__icon">∅</span>
              <span className="stat-cell__num">{group.deadCount}</span>
            </div>
            <span className="stat-cell__label">Dead code</span>
          </div>
        </div>
      </div>
    </div>
  );
}
