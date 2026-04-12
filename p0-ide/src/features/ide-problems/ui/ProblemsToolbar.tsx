import type { ProblemSeverity, ProblemCounts } from "@/entities/problems";

interface ProblemsToolbarProps {
  counts: ProblemCounts;
  active: ReadonlySet<ProblemSeverity>;
  onToggle: (sev: ProblemSeverity) => void;
  onClear: () => void;
}

/**
 * Problems 탭 상단 툴바 — severity 토글 + clear.
 *
 * SRP: UI 프레젠테이션만. 카운트 계산/필터링 로직 없음.
 * 부모가 active set을 제어 — 필터 상태가 탭 전환 사이 유지되도록.
 */
export function ProblemsToolbar({ counts, active, onToggle, onClear }: ProblemsToolbarProps) {
  return (
    <div className="pb-toolbar">
      <span className="bp-panel-title">Problems</span>
      <span className="bp-toolbar-sep" aria-hidden />
      <div className="pb-toolbar-filters" role="group" aria-label="Severity filters">
        <FilterChip
          sev="error"
          label="errors"
          count={counts.error}
          active={active.has("error")}
          onClick={() => { onToggle("error"); }}
        />
        <FilterChip
          sev="warn"
          label="warnings"
          count={counts.warn}
          active={active.has("warn")}
          onClick={() => { onToggle("warn"); }}
        />
        <FilterChip
          sev="info"
          label="info"
          count={counts.info}
          active={active.has("info")}
          onClick={() => { onToggle("info"); }}
        />
      </div>
      <div className="pb-toolbar-spacer" />
      <button
        type="button"
        className="pb-toolbar-action"
        onClick={onClear}
        aria-label="Clear problems"
        title="Clear"
      >
        clear
      </button>
    </div>
  );
}

interface FilterChipProps {
  sev: ProblemSeverity;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ sev, label, count, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      className={`pb-chip pb-chip-${sev}${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      title={`${label}: ${count}`}
    >
      <span className={`pb-chip-dot pb-chip-dot-${sev}`} aria-hidden />
      <span className="pb-chip-count">{count}</span>
      <span className="pb-chip-label">{label}</span>
    </button>
  );
}
