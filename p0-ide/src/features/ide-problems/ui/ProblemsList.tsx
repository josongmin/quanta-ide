import { useState } from "react";
import type {
  ProblemFileGroup,
  ProblemItem,
  ProblemSeverity,
} from "@/entities/problems";
import { IconChevronDown } from "@/shared/ui";

interface ProblemsListProps {
  groups: readonly ProblemFileGroup[];
  activeSeverities: ReadonlySet<ProblemSeverity>;
  onItemActivate?: (group: ProblemFileGroup, item: ProblemItem) => void;
}

/**
 * Problems 리스트 — 파일별 collapsible 그룹.
 *
 * 각 그룹: 헤더(아이콘/경로/그룹 카운트) + 행(severity glyph / line:col / 메시지 / source).
 * 필터링은 부모에서 오는 activeSeverities로 각 그룹의 items를 즉석 필터링.
 * 필터링 후 items가 비면 그룹 자체를 숨김.
 */
export function ProblemsList({ groups, activeSeverities, onItemActivate }: ProblemsListProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const visibleGroups = groups
    .map((g) => ({
      group: g,
      items: g.items.filter((it) => activeSeverities.has(it.severity)),
    }))
    .filter((g) => g.items.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <div className="pb-empty" aria-live="polite">
        no problems match the current filter
      </div>
    );
  }

  return (
    <ul className="pb-list" aria-label="Problems list">
      {visibleGroups.map(({ group, items }) => {
        const isCollapsed = collapsed.has(group.path);
        return (
          <li key={group.path} className="pb-group">
            <button
              type="button"
              className="pb-group-header"
              onClick={() => { toggleCollapse(group.path); }}
              aria-expanded={!isCollapsed}
              aria-label={`${group.path}, ${items.length} problems`}
            >
              <span className="pb-group-caret" aria-hidden data-open={String(!isCollapsed)}>
                <IconChevronDown size={10} />
              </span>
              <span className="pb-group-path" title={group.path}>
                {group.path}
              </span>
              <span className="pb-group-count">{items.length}</span>
            </button>
            {!isCollapsed ? (
              <ul className="pb-group-items">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className="pb-row"
                      onClick={() => onItemActivate?.(group, it)}
                      title={`${group.path}:${String(it.line)}:${String(it.col)}`}
                    >
                      <span className={`pb-sev pb-sev-${it.severity}`} aria-label={it.severity}>
                        <SeverityGlyph severity={it.severity} />
                      </span>
                      <span className="pb-loc">
                        {it.line}:{it.col}
                      </span>
                      <span className="pb-msg">{it.message}</span>
                      <span className="pb-src">{it.source}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SeverityGlyph({ severity }: { severity: ProblemSeverity }) {
  if (severity === "error") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5.25" fill="currentColor" />
      </svg>
    );
  }
  if (severity === "warn") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M7 1.5 L12.5 12 L1.5 12 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="1.75" y="1.75" width="10.5" height="10.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
