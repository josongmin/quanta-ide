import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compileEdgeFilter, getCompletions, type Completion } from "@quanta/canvas-engine";
import { settingsStore, useSettingsStore } from "../../store/settings-store";

function findPartialTokenStart(src: string, cursor: number): number {
  let i = cursor;
  while (i > 0) {
    const ch = src[i - 1];
    if (/[A-Za-z0-9_\-./]/.test(ch)) i--;
    else break;
  }
  return i;
}

function needsTrailingSpace(c: Completion): boolean {
  if (c.kind === "key") return true;
  if (c.kind === "bool" && c.label === "not") return true;
  return false;
}

export function FilterDslInput() {
  const query = useSettingsStore(s => s.edgeFilterQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const completions = useMemo(() => {
    if (!open) return [];
    return getCompletions(query, cursor);
  }, [open, query, cursor]);

  useEffect(() => {
    if (active >= completions.length) setActive(0);
  }, [completions.length, active]);

  const filterError = useMemo(() => {
    const r = compileEdgeFilter(query);
    return r.predicate ? null : r.error;
  }, [query]);

  const accept = useCallback((c: Completion) => {
    const input = inputRef.current;
    if (!input) return;
    const cur = input.selectionStart ?? cursor;
    const partialStart = findPartialTokenStart(query, cur);
    const before = query.slice(0, partialStart);
    const after = query.slice(cur);
    const insert = c.insertText + (needsTrailingSpace(c) ? " " : "");
    const next = before + insert + after;
    const nextCursor = (before + insert).length;
    settingsStore.setEdgeFilterQuery(next);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
      setOpen(true);
    });
  }, [query, cursor]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || completions.length === 0) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setActive(a => (a + 1) % completions.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive(a => (a - 1 + completions.length) % completions.length);
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === "Tab") {
      const c = completions[active];
      if (c) {
        e.preventDefault();
        accept(c);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    settingsStore.setEdgeFilterQuery(e.target.value);
    setCursor(e.target.selectionStart ?? e.target.value.length);
    setOpen(true);
    setActive(0);
  };

  const syncCursor = () => {
    const el = inputRef.current;
    if (!el) return;
    setCursor(el.selectionStart ?? 0);
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    setOpen(false);
  };

  const showDropdown = open && completions.length > 0;

  return (
    <div className="ws-debug__filter-wrap" ref={rootRef}>
      <input
        ref={inputRef}
        type="text"
        className="ws-debug__input"
        value={query}
        placeholder='e.g. layer=safety and severity>=high'
        onChange={onChange}
        onKeyDown={onKeyDown}
        onKeyUp={syncCursor}
        onClick={syncCursor}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        spellCheck={false}
        autoComplete="off"
        style={{ width: "100%" }}
      />
      {showDropdown && (
        <div className="ws-debug__completion" role="listbox">
          {completions.map((c, i) => (
            <div
              key={`${c.kind}:${c.label}:${i}`}
              role="option"
              aria-selected={i === active}
              className={`ws-debug__completion-item${i === active ? " is-active" : ""}`}
              onMouseDown={e => {
                e.preventDefault();
                setActive(i);
                accept(c);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{c.label}</span>
              <span className="ws-debug__completion-kind">{c.kind}</span>
              {c.description && (
                <span className="ws-debug__completion-desc">{c.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {filterError && (
        <div className="ws-debug__err" style={{ color: "#f87171", fontSize: 10, marginTop: 2 }}>
          {filterError}
        </div>
      )}
      <div className="ws-debug__hint" style={{ fontSize: 10, opacity: 0.6 }}>
        keys: layer, kind, severity, animated, evidence · ops: = != &gt;= &lt;= &gt; &lt; · bool: and or not
      </div>
    </div>
  );
}
