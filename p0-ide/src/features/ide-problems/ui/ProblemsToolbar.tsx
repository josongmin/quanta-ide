import type {
  ProblemSeverity,
  ProblemCounts,
  ProblemToolCount,
} from "@/entities/problems";

interface ProblemsToolbarProps {
  counts: ProblemCounts;
  active: ReadonlySet<ProblemSeverity>;
  onToggle: (sev: ProblemSeverity) => void;
  tools: readonly ProblemToolCount[];
  excludedTools: ReadonlySet<string>;
  onToggleTool: (name: string) => void;
  onClear: () => void;
}

/**
 * Problems 탭 상단 툴바 — severity 토글 + clear.
 *
 * SRP: UI 프레젠테이션만. 카운트 계산/필터링 로직 없음.
 * 부모가 active set을 제어 — 필터 상태가 탭 전환 사이 유지되도록.
 */
export function ProblemsToolbar({
  counts,
  active,
  onToggle,
  tools,
  excludedTools,
  onToggleTool,
  onClear,
}: ProblemsToolbarProps) {
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
      {tools.length > 0 ? (
        <>
          <span className="bp-toolbar-sep" aria-hidden />
          <div
            className="pb-toolbar-tools"
            role="group"
            aria-label="Lint source filters"
          >
            {tools.map((t) => (
              <ToolChip
                key={t.name}
                name={t.name}
                count={t.count}
                active={!excludedTools.has(t.name)}
                onClick={() => { onToggleTool(t.name); }}
              />
            ))}
          </div>
        </>
      ) : null}
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

const SEV_ICON: Record<ProblemSeverity, React.ReactNode> = {
  error: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6 6l4 4M10 6l-4 4" />
    </svg>
  ),
  warn: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5L1.5 13.5h13L8 2.5z" />
      <path d="M8 7v3M8 11.5v.5" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7v4M8 5v.5" />
    </svg>
  ),
};

function FilterChip({ sev, label, count, active, onClick }: FilterChipProps) {
  return (
    <label
      className={`pb-chip pb-chip-${sev}${active ? " is-active" : ""}`}
      title={`${label}: ${count}`}
    >
      <input
        type="checkbox"
        className="pb-chip-input"
        checked={active}
        onChange={onClick}
      />
      <span className="pb-chip-count">{count}</span>
      <span className="pb-chip-label">{label}</span>
    </label>
  );
}

interface ToolChipProps {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function ToolChip({ name, count, active, onClick }: ToolChipProps) {
  return (
    <button
      type="button"
      className={`pb-tool-chip${active ? " is-active" : ""}`}
      aria-pressed={active}
      title={`${name}: ${count}`}
      onClick={onClick}
    >
      <span className="pb-tool-chip-name">{name}</span>
      <span className="pb-tool-chip-count">{count}</span>
    </button>
  );
}
