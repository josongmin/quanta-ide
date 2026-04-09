import { useEffect, useMemo, useRef, useState } from "react";
import { useCommandPalette } from "../model/useCommandPalette";
import { filterCommands, flattenGroups, type Command } from "../model/commands";
import { dispatchCommand } from "../model/dispatcher";
import { CommandIcon } from "./CommandIcon";

export function CommandPalette() {
  const { isOpen, query, setQuery, close } = useCommandPalette();
  if (!isOpen) return null;
  // re-key by query so activeIdx state resets naturally without effects
  return <CommandPaletteInner key={query} query={query} setQuery={setQuery} close={close} />;
}

interface InnerProps {
  query: string;
  setQuery: (q: string) => void;
  close: () => void;
}

function CommandPaletteInner({ query, setQuery, close }: InnerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const groups = useMemo(() => filterCommands(query), [query]);
  const flat = useMemo(() => flattenGroups(groups), [groups]);

  // focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => { clearTimeout(t); };
  }, []);

  // keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIdx < 0 || activeIdx >= flat.length) return;
        const cmd = flat[activeIdx];
        close();
        dispatchCommand(cmd.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [flat, activeIdx, close]);

  // build map of command id -> flat index
  const indexMap = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((c, i) => { m.set(c.id, i); });
    return m;
  }, [flat]);

  return (
    <div className="cmdk-root" role="dialog" aria-modal="true">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- decorative backdrop */}
      <div className="cmdk-backdrop" onClick={close} />
      <div className="cmdk-shell">
        <div className="cmdk-input-wrap">
          <span className="cmdk-input-icon" aria-hidden="true">
            <CommandIcon kind="search" />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            placeholder="Ask anything…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="cmdk-input-kbd">⎋</span>
        </div>

        <div className="cmdk-list">
          {groups.length === 0 && (
            <div className="cmdk-empty">No matches</div>
          )}
          {groups.map((g) => (
            <div key={g.group} className="cmdk-group">
              <div className="cmdk-group-label">{g.label}</div>
              {g.items.map((cmd) => {
                const isActive = indexMap.get(cmd.id) === activeIdx;
                return <CommandRow key={cmd.id} cmd={cmd} isActive={isActive} onActivate={close} />;
              })}
            </div>
          ))}
        </div>

        <div className="cmdk-foot">
          <div className="cmdk-foot-hint">
            <span className="cmdk-kbd">↑↓</span> navigate
            <span className="cmdk-kbd">⏎</span> select
            <span className="cmdk-kbd">⎋</span> close
          </div>
          <div className="cmdk-foot-brand">p0</div>
        </div>
      </div>
    </div>
  );
}

function CommandRow({ cmd, isActive, onActivate }: { cmd: Command; isActive: boolean; onActivate: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isActive]);

  return (
    <button
      ref={ref}
      type="button"
      className={`cmdk-row${isActive ? " is-active" : ""}`}
      onClick={() => {
        onActivate();
        dispatchCommand(cmd.id);
      }}
    >
      <span className="cmdk-row-icon"><CommandIcon kind={cmd.icon} /></span>
      <span className="cmdk-row-label">{cmd.label}</span>
      {cmd.hint && <span className="cmdk-row-hint">{cmd.hint}</span>}
      {cmd.shortcut && <span className="cmdk-row-kbd">{cmd.shortcut}</span>}
    </button>
  );
}
