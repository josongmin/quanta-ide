import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { Entity } from "@quanta/canvas-engine";
import { entityStore, useEntityState } from "../../../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { searchEntities, type EntitySearchResult } from "../lib/entity-search";
import { commandPaletteStore, useCommandPalette } from "../model/store";
import { paletteRecentsStore, usePaletteRecents } from "../model/recents";

// CommandPalette
// --------------------------------------------------------------------
// Modal entity finder. Opens via ⌘K / Ctrl+K (global shortcut
// installed by `useCommandPaletteShortcut`). Type to search the
// entity tree; Enter or click to select + jump.
//
// Selection behaviour: mark the entity as selected in the entity
// store, then jump the tier to its kind's spec. CanvasViewport's
// existing fit-to-content effect animates the camera onto it, so we
// never touch camera state from here — keeping this feature
// slice-local without crossing into the canvas-shell widget.

const OVERLAY_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  display: "grid",
  placeItems: "start center",
  paddingTop: "14vh",
  zIndex: 100,
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};

const PANEL_STYLE: CSSProperties = {
  width: "min(620px, 94vw)",
  background: "white",
  borderRadius: 12,
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
  overflow: "hidden",
  fontFamily: "system-ui, sans-serif",
};

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  border: "none",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  background: "transparent",
  color: "#111827",
};

const ROW_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "9px 16px",
  cursor: "pointer",
  fontSize: 13,
  color: "#1f2937",
};

const ROW_ACTIVE: CSSProperties = {
  ...ROW_STYLE,
  background: "#eef2ff",
};

const KIND_PILL: CSSProperties = {
  padding: "1px 6px",
  borderRadius: 4,
  background: "#f3f4f6",
  color: "#6b7280",
  fontSize: 10,
  fontVariantNumeric: "tabular-nums",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const EMPTY_STATE: CSSProperties = {
  padding: "28px 18px",
  color: "#9ca3af",
  fontSize: 12,
  textAlign: "center",
};

const FOOTER_HINT: CSSProperties = {
  padding: "6px 16px",
  fontSize: 10,
  color: "#9ca3af",
  borderTop: "1px solid #f3f4f6",
  display: "flex",
  gap: 12,
};

export function CommandPalette(): ReactElement | null {
  const open = useCommandPalette(s => s.open);
  const query = useCommandPalette(s => s.query);
  const tree = useEntityState(s => s.tree);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const recentIds = usePaletteRecents(s => s.ids);

  const searchResults = useMemo<EntitySearchResult[]>(
    () => searchEntities(tree, query, 12),
    [tree, query],
  );
  // Empty-query state: show recents. Filtered against the current
  // tree so stale ids from a pruned graph just disappear.
  const recentResults = useMemo<EntitySearchResult[]>(() => {
    if (!tree || query.trim().length > 0) return [];
    const out: EntitySearchResult[] = [];
    for (const id of recentIds) {
      const e = tree.byId.get(id);
      if (e) out.push({ entity: e, score: 0 });
    }
    return out;
  }, [tree, query, recentIds]);
  const results = query.trim().length === 0 ? recentResults : searchResults;
  const inRecentsMode = query.trim().length === 0 && recentResults.length > 0;

  // Keep activeIdx in range as results change; snap to 0 when the
  // result set shrinks past it.
  useEffect(() => {
    if (activeIdx >= results.length) setActiveIdx(0);
  }, [results, activeIdx]);

  // Autofocus + select-all when the modal opens so ⌘K → typing lands
  // in the input without a mouse hop. Returning a cleanup lets the
  // caller close without a stale-focus artifact.
  useEffect(() => {
    if (!open) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [open]);

  if (!open) return null;

  const commit = (entity: Entity): void => {
    entityStore.selectEntity(entity.id);
    const spec = DEFAULT_TIER_LADDER.find(t => t.visibleKind === entity.kind);
    if (spec) tierStore.jumpToTier(spec.name);
    // Log into recents AFTER committing — that way the just-picked
    // entity shows as the first row next time the user opens the
    // palette with an empty query.
    paletteRecentsStore.record(entity.id);
    commandPaletteStore.close();
  };

  return (
    <div
      style={OVERLAY_STYLE}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={e => {
        if (e.target === e.currentTarget) commandPaletteStore.close();
      }}
    >
      <div style={PANEL_STYLE} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={INPUT_STYLE}
          placeholder="Search entities by name or path…"
          value={query}
          onChange={e => commandPaletteStore.setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") {
              e.preventDefault();
              commandPaletteStore.close();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx(i => (results.length === 0 ? 0 : (i + 1) % results.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx(i =>
                results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
              );
            } else if (e.key === "Enter") {
              e.preventDefault();
              const picked = results[activeIdx];
              if (picked) commit(picked.entity);
            }
          }}
        />
        {results.length === 0 ? (
          <div style={EMPTY_STATE}>
            {query.trim().length === 0
              ? "Start typing to search entities"
              : "No matches"}
          </div>
        ) : (
          <ul style={{ margin: 0, padding: "6px 0", listStyle: "none", maxHeight: 360, overflowY: "auto" }}>
            {inRecentsMode && (
              <li
                style={{
                  padding: "6px 16px 2px",
                  fontSize: 10,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "#9ca3af",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                aria-hidden
              >
                <span>Recent</span>
                <button
                  type="button"
                  onClick={() => paletteRecentsStore.clear()}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#6366f1",
                    fontSize: 10,
                    cursor: "pointer",
                    padding: 0,
                    letterSpacing: 0.3,
                  }}
                >
                  clear
                </button>
              </li>
            )}
            {results.map((r, i) => (
              <li
                key={r.entity.id}
                style={i === activeIdx ? ROW_ACTIVE : ROW_STYLE}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(r.entity)}
                role="option"
                aria-selected={i === activeIdx}
              >
                <span style={KIND_PILL}>{r.entity.kind}</span>
                <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.entity.name || "(unnamed)"}
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.entity.path || "/"}
                  </span>
                </span>
                <span style={{ fontSize: 10, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>
                  {r.score}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div style={FOOTER_HINT}>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> jump</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
