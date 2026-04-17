import { useRef, useEffect } from "react";
import { policyStore, usePolicyStore } from "@quanta/app-policy/entities/policy";
import { parseQuery } from "../lib/policy-page.utils";

const PRESETS = [
  { label: "critical & active",    query: "severity:critical status:active" },
  { label: "has violations",       query: "has:violations" },
  { label: "codeql rules",         query: "engine:codeql" },
  { label: "security high+",       query: "category:security severity:high" },
  { label: "with PR matches",      query: "has:pr" },
];

export function QueryBar({ resultCount }: { resultCount: number }) {
  const searchQuery = usePolicyStore((s) => s.filters.searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = parseQuery(searchQuery);
  const hasQuery = searchQuery.trim().length > 0;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function removeFilter(raw: string) {
    const next = searchQuery.replace(raw, "").replace(/\s+/g, " ").trim();
    policyStore.setSearchQuery(next);
  }

  function applyPreset(query: string) {
    policyStore.setSearchQuery(query);
    inputRef.current?.focus();
  }

  return (
    <div className="pol-query">
      <div className="pol-query__bar">
        <span className="pol-query__prompt" aria-hidden>&rsaquo;</span>
        <input
          ref={inputRef}
          className="pol-query__input"
          placeholder="engine:codeql severity:high tag:SQL &mdash; or free text"
          value={searchQuery}
          onChange={(e) => policyStore.setSearchQuery(e.target.value)}
          spellCheck={false}
        />
        <kbd className="pol-query__kbd">&#8984;K</kbd>
      </div>

      {hasQuery && (
        <div className="pol-query__meta">
          <span className="pol-query__count">
            {resultCount} rule{resultCount !== 1 ? "s" : ""} matched
          </span>
          {parsed.filters.length > 0 && (
            <div className="pol-query__chips">
              {parsed.filters.map((f) => (
                <span key={f.raw} className="pol-query__chip">
                  <span className="pol-query__chip-field">{f.field}</span>
                  <span className="pol-query__chip-sep">:</span>
                  <span className="pol-query__chip-value">{f.value}</span>
                  <button
                    type="button"
                    className="pol-query__chip-x"
                    onClick={() => removeFilter(f.raw)}
                    aria-label={`Remove ${f.field} filter`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasQuery && (
        <div className="pol-query__presets">
          {PRESETS.map((p) => (
            <button
              key={p.query}
              type="button"
              className="pol-query__preset"
              onClick={() => applyPreset(p.query)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
