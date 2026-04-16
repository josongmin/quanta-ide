import { useState } from "react";
import { MOCK_PROBLEMS, type Severity } from "@/entities/problem";
import { ChevronDownTiny, SeverityGlyph } from "../../lib/icons";
import "./problems-pane.css";

export function ProblemsPane() {
  const [activeSev, setActiveSev] = useState<ReadonlySet<Severity>>(
    () => new Set<Severity>(["error", "warn", "info"]),
  );
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const counts = MOCK_PROBLEMS.reduce(
    (acc, g) => {
      for (const it of g.items) acc[it.severity] += 1;
      return acc;
    },
    { error: 0, warn: 0, info: 0 } as Record<Severity, number>,
  );

  const toggleSev = (sev: Severity) => {
    setActiveSev((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  const toggleGroup = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const visibleGroups = MOCK_PROBLEMS
    .map((g) => ({ group: g, items: g.items.filter((it) => activeSev.has(it.severity)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="pb-root">
      <div className="pb-toolbar">
        <span className="pb-panel-title">Problems</span>
        <span className="pb-toolbar-sep" aria-hidden />
        <div className="pb-toolbar-filters" role="group" aria-label="Severity filters">
          <FilterChip sev="error" label="errors" count={counts.error} active={activeSev.has("error")} onClick={() => toggleSev("error")} />
          <FilterChip sev="warn" label="warnings" count={counts.warn} active={activeSev.has("warn")} onClick={() => toggleSev("warn")} />
          <FilterChip sev="info" label="info" count={counts.info} active={activeSev.has("info")} onClick={() => toggleSev("info")} />
        </div>
        <div className="pb-toolbar-spacer" />
        <button type="button" className="pb-toolbar-action" title="Clear">clear</button>
      </div>

      <div className="pb-body">
        {visibleGroups.length === 0 ? (
          <div className="pb-empty">no problems match the current filter</div>
        ) : (
          <ul className="pb-list" aria-label="Problems list">
            {visibleGroups.map(({ group, items }) => {
              const isCollapsed = collapsed.has(group.path);
              return (
                <li key={group.path} className="pb-group">
                  <button
                    type="button"
                    className="pb-group-header"
                    onClick={() => toggleGroup(group.path)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="pb-group-caret" data-open={String(!isCollapsed)} aria-hidden>
                      <ChevronDownTiny />
                    </span>
                    <span className="pb-group-path" title={group.path}>{group.path}</span>
                    <span className="pb-group-count">{items.length}</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="pb-group-items">
                      {items.map((it) => (
                        <li key={it.id}>
                          <button type="button" className="pb-row" title={`${group.path}:${it.line}:${it.col}`}>
                            <span className={`pb-sev pb-sev-${it.severity}`} aria-label={it.severity}>
                              <SeverityGlyph severity={it.severity} />
                            </span>
                            <span className="pb-loc">{it.line}:{it.col}</span>
                            <span className="pb-msg">{it.message}</span>
                            <span className="pb-src">{it.source}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({ sev, label, count, active, onClick }: { sev: Severity; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      className={`pb-chip pb-chip-${sev}${active ? " is-active" : ""}`}
      onClick={onClick}
      title={`${label}: ${count}`}
    >
      <span className="pb-chip-dot" aria-hidden />
      <span className="pb-chip-count">{count}</span>
      <span className="pb-chip-label">{label}</span>
    </button>
  );
}
