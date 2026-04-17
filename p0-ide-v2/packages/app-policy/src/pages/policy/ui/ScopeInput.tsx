import { useState } from "react";
import type { PolicyScope } from "@quanta/domain-types/policies";

interface ScopeInputProps {
  label: string;
  scope: PolicyScope;
  onChange: (scope: PolicyScope) => void;
}

type ScopeKey = "repos" | "services" | "paths" | "teams";

const SCOPE_KEYS: { key: ScopeKey; placeholder: string }[] = [
  { key: "repos", placeholder: "repo name" },
  { key: "paths", placeholder: "glob pattern" },
  { key: "services", placeholder: "service name" },
  { key: "teams", placeholder: "team name" },
];

export function ScopeInput({ label, scope, onChange }: ScopeInputProps) {
  const [addingKey, setAddingKey] = useState<ScopeKey | null>(null);
  const [inputValue, setInputValue] = useState("");

  function addEntry(key: ScopeKey) {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const existing = scope[key] ?? [];
    if (existing.includes(trimmed)) return;
    onChange({ ...scope, [key]: [...existing, trimmed] });
    setInputValue("");
    setAddingKey(null);
  }

  function removeEntry(key: ScopeKey, value: string) {
    const updated = (scope[key] ?? []).filter((v) => v !== value);
    onChange({ ...scope, [key]: updated.length > 0 ? updated : undefined });
  }

  return (
    <div className="pol-scope-input">
      <span className="pol-builder__field-label">{label}</span>
      {SCOPE_KEYS.map(({ key, placeholder }) => {
        const entries = scope[key] ?? [];
        return (
          <div key={key} className="pol-scope-input__row">
            <span className="pol-cat" style={{ minWidth: 56 }}>{key}</span>
            {entries.map((e) => (
              <span key={e} className="pol-scope-pill">
                {e}
                <button
                  type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "0 0 0 4px" }}
                  onClick={() => removeEntry(key, e)}
                  aria-label={`Remove ${e}`}
                >
                  x
                </button>
              </span>
            ))}
            {addingKey === key ? (
              <input
                className="pol-builder__input"
                style={{ width: 140, padding: "2px 6px", fontSize: "var(--fs-xs)" }}
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addEntry(key);
                  if (e.key === "Escape") { setAddingKey(null); setInputValue(""); }
                }}
                onBlur={() => { if (inputValue.trim()) addEntry(key); else { setAddingKey(null); setInputValue(""); } }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="pol-scope-input__add"
                onClick={() => { setAddingKey(key); setInputValue(""); }}
              >
                + add
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
