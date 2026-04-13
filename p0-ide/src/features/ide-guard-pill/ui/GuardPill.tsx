import { useEffect, useRef } from "react";
import { useGuardPill, GUARD_ENTRIES, summarize, type GuardState } from "../model/useGuardPill";

const STATE_RANK: Record<GuardState, number> = { blocked: 3, warn: 2, safe: 1 };
const GLYPH: Record<GuardState, string> = { blocked: "⛔", warn: "⚠", safe: "✓" };

export function GuardPill() {
  const { isVisible, isExpanded, toggle, collapse } = useGuardPill();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded || !isVisible) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        collapse();
      }
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { collapse(); } };
    window.addEventListener("mousedown", handler);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", key);
    };
  }, [isExpanded, isVisible, collapse]);

  if (!isVisible) return null;

  const summary = summarize(GUARD_ENTRIES);
  const top = [...GUARD_ENTRIES].sort((a, b) => STATE_RANK[b.state] - STATE_RANK[a.state])[0];
  if (!top) return null;
  const topState: GuardState = summary.blocked > 0 ? "blocked" : summary.warn > 0 ? "warn" : "safe";


  return (
    <div className={`gpill-root gpill-${topState}${isExpanded ? " is-expanded" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="gpill-chip"
        onClick={toggle}
        aria-expanded={isExpanded}
        aria-label="Merge guardrails"
      >
        <span className="gpill-chip-glyph">{GLYPH[topState]}</span>
        <span className="gpill-chip-rule">{top.rule}</span>
        <span className="gpill-chip-sep" />
        <span className="gpill-chip-counts">
          {summary.blocked > 0 && <span className="gpill-dot gpill-dot-blocked">{summary.blocked}</span>}
          {summary.warn > 0 && <span className="gpill-dot gpill-dot-warn">{summary.warn}</span>}
          <span className="gpill-dot gpill-dot-safe">{summary.safe}</span>
        </span>
        <span className="gpill-chip-chev">{isExpanded ? "▾" : "▴"}</span>
      </button>

      {isExpanded && (
        <div className="gpill-body" role="dialog" aria-label="Merge guardrails">
          <div className="gpill-body-head">
            <span className="gpill-body-label">{"// MERGE GUARDRAILS"}</span>
            <span className="gpill-body-sum">
              <span className="gpill-count gpill-count-blocked">{summary.blocked}</span>
              <span className="gpill-count gpill-count-warn">{summary.warn}</span>
              <span className="gpill-count gpill-count-safe">{summary.safe}</span>
            </span>
          </div>
          <div className="gpill-list">
            {GUARD_ENTRIES.map((g) => (
              <div key={g.id} className={`gpill-row gpill-row-${g.state}`}>
                <span className="gpill-row-glyph">{GLYPH[g.state]}</span>
                <div className="gpill-row-body">
                  <div className="gpill-row-rule">{g.rule}</div>
                  <div className="gpill-row-detail">{g.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
