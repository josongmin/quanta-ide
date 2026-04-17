import type { FileGroup } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  group: FileGroup;
}

function riskColor(score: number): string {
  if (score >= 70) return "var(--danger)";
  if (score >= 40) return "var(--warn)";
  return "var(--success)";
}

function riskLabel(score: number): string {
  if (score >= 70) return "High risk";
  if (score >= 40) return "Medium";
  return "Low";
}

export function FileGroupBg({ group }: Props) {
  const score = group.riskScore;

  return (
    <div
      className="file-group"
      style={{ left: group.x, top: group.y, width: group.w, height: group.h }}
    >
      {/* Row 1: file name + risk score */}
      <div className="file-group__header">
        <svg className="file-group__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M4 1.5h5.586a1 1 0 0 1 .707.293l2.414 2.414a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9.5 1.5V4a.5.5 0 0 0 .5.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="file-group__name">{group.name}</span>
        <span className="file-group__spacer" />
        <span className="file-group__score" style={{ color: riskColor(score) }}>
          {score}
        </span>
        <span className="file-group__score-sub">/100</span>
        <span className={cn("file-group__risk-badge", score >= 70 && "file-group__risk-badge--high")}>
          {riskLabel(score)}
        </span>
      </div>

      {/* Stat grid — 2 rows × 3 cols */}
      <div className="file-group__grid">
        <Stat icon="≡" value={group.loc.toLocaleString()} label="LINES" />
        <Stat icon="ƒ" value={String(group.functions)} label="FUNCTIONS" />
        <Stat icon="C" value={String(group.classes)} label="CLASSES" />
        <Stat icon="↓" value={String(group.imports)} label="IMPORTS" />
        <Stat icon="→" value={String(group.callers)} label="CALLERS" warn={group.callers > 20} />
        <Stat icon="λ" value={String(group.cpxMax)} label="CPX PEAK" warn={group.cpxMax > 10} />
      </div>
    </div>
  );
}

function Stat({ icon, value, label, warn }: { icon: string; value: string; label: string; warn?: boolean }) {
  return (
    <div className={cn("fg-stat", warn && "fg-stat--warn")}>
      <span className="fg-stat__icon">{icon}</span>
      <span className="fg-stat__value">{value}</span>
      <span className="fg-stat__label">{label}</span>
    </div>
  );
}
