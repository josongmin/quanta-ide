import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  retroStore,
  useRetroStore,
  RETRO_COLUMNS,
  RETRO_COLUMN_LABEL,
  type RetroColumn,
} from "../store/retro-store";
import { stickiesStore, useStickiesStore, type Sticky } from "../store/stickies-store";

// Retrospective 3-column overlay (review.retrospective)
// -----------------------------------------------------------------
// Screen-space overlay pinned to the top-right of the canvas. Stickies
// with a `retroColumn` value appear in the matching column. Dropping a
// sticky onto a column (or clicking the column badge on a sticky row)
// sets that field. Closing the overlay does not unassign columns.
//
// Seeding: on first activation, if no stickies have a retroColumn yet
// we insert 3 demo stickies (one per column) so users see the template.
// A `seeded` flag on the retro store ensures this only happens once per
// session; clearing the flag via reset() lets it re-seed.

const PANEL_COLUMN_COLORS: Record<RetroColumn, { bg: string; border: string }> = {
  well:   { bg: "rgba(34, 197, 94, 0.08)", border: "rgba(34, 197, 94, 0.4)" },
  didnt:  { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.4)" },
  action: { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.4)" },
};

export function RetroColumns() {
  const visible = useRetroStore(s => s.visible);
  const seeded = useRetroStore(s => s.seeded);
  const stickies = useStickiesStore(s => s.stickies);

  // Seed demo stickies the first time the overlay is shown, if none
  // have a retroColumn yet.
  useEffect(() => {
    if (!visible || seeded) return;
    const hasAny = stickies.some(s => s.retroColumn);
    if (hasAny) { retroStore.markSeeded(); return; }
    const demos: Array<{ col: RetroColumn; text: string; color: Sticky["color"] }> = [
      { col: "well",   text: "Canvas renders fast even with 5k files.", color: "green" },
      { col: "didnt",  text: "Hard to discover overlay features.",      color: "pink" },
      { col: "action", text: "Write a tooltip for the feature flag HUD.", color: "blue" },
    ];
    for (const d of demos) {
      const id = stickiesStore.create(0, 0, { text: d.text, color: d.color });
      stickiesStore.update(id, { retroColumn: d.col });
    }
    stickiesStore.setActive(null);
    retroStore.markSeeded();
  }, [visible, seeded, stickies]);

  const grouped = useMemo(() => {
    const out: Record<RetroColumn, Sticky[]> = { well: [], didnt: [], action: [] };
    for (const s of stickies) {
      if (s.retroColumn) out[s.retroColumn].push(s);
    }
    return out;
  }, [stickies]);

  // DnD target tracking — lightweight, using data transfer text only.
  const [dragOverCol, setDragOverCol] = useState<RetroColumn | null>(null);

  const onDropIntoColumn = useCallback((col: RetroColumn, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/sticky-id");
    if (!id) return;
    stickiesStore.update(id, { retroColumn: col });
    setDragOverCol(null);
  }, []);

  const onDragOver = useCallback((col: RetroColumn, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== col) setDragOverCol(col);
  }, [dragOverCol]);

  const onDragLeave = useCallback(() => setDragOverCol(null), []);

  const copyMarkdown = useCallback(() => {
    const parts: string[] = ["## Retrospective", ""];
    for (const col of RETRO_COLUMNS) {
      parts.push(`### ${RETRO_COLUMN_LABEL[col]}`);
      const list = grouped[col];
      if (list.length === 0) parts.push("_(none)_");
      else for (const s of list) parts.push(`- ${s.text.replace(/\n/g, " ")}`);
      parts.push("");
    }
    const md = parts.join("\n");
    try {
      navigator.clipboard?.writeText(md);
    } catch {
      // fallback: selection-based copy would need a DOM textarea; skip.
    }
  }, [grouped]);

  // Suppress wheel / pointer on canvas while interacting with the panel.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop, { capture: true, passive: false });
    el.addEventListener("pointerdown", stop, { capture: true });
    el.addEventListener("mousedown", stop, { capture: true });
    return () => {
      el.removeEventListener("wheel", stop, { capture: true });
      el.removeEventListener("pointerdown", stop, { capture: true });
      el.removeEventListener("mousedown", stop, { capture: true });
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div ref={panelRef} className="ws-retro">
      <div className="ws-retro__header">
        <span className="ws-retro__title">Retrospective</span>
        <button
          type="button"
          className="ws-retro__btn"
          onClick={copyMarkdown}
          title="Copy markdown to clipboard"
        >
          Copy markdown
        </button>
        <button
          type="button"
          className="ws-retro__btn ws-retro__btn--close"
          onClick={() => retroStore.setVisible(false)}
          title="Close"
        >×</button>
      </div>
      <div className="ws-retro__columns">
        {RETRO_COLUMNS.map(col => (
          <div
            key={col}
            className={`ws-retro__col${dragOverCol === col ? " is-dragover" : ""}`}
            style={{
              background: PANEL_COLUMN_COLORS[col].bg,
              borderColor: PANEL_COLUMN_COLORS[col].border,
            }}
            onDragOver={e => onDragOver(col, e)}
            onDragLeave={onDragLeave}
            onDrop={e => onDropIntoColumn(col, e)}
          >
            <div className="ws-retro__col-header">
              <span>{RETRO_COLUMN_LABEL[col]}</span>
              <span className="ws-retro__col-count">{grouped[col].length}</span>
            </div>
            <div className="ws-retro__col-body">
              {grouped[col].length === 0 && (
                <div className="ws-retro__empty">Drag a sticky here</div>
              )}
              {grouped[col].map(s => (
                <RetroCard key={s.id} sticky={s} />
              ))}
              <button
                type="button"
                className="ws-retro__add"
                onClick={() => {
                  const id = stickiesStore.create(0, 0, {
                    text: "",
                    color: col === "well" ? "green" : col === "didnt" ? "pink" : "blue",
                  });
                  stickiesStore.update(id, { retroColumn: col });
                  stickiesStore.setActive(id);
                }}
              >+ add</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetroCard({ sticky }: { sticky: Sticky }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sticky.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setText(sticky.text); }, [sticky.text]);
  useEffect(() => {
    if (!editing) return;
    ref.current?.focus();
    ref.current?.setSelectionRange(text.length, text.length);
  }, [editing, text.length]);

  const onDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/sticky-id", sticky.id);
    e.dataTransfer.effectAllowed = "move";
  }, [sticky.id]);

  const commit = useCallback(() => {
    if (text !== sticky.text) stickiesStore.update(sticky.id, { text });
    setEditing(false);
  }, [text, sticky.id, sticky.text]);

  return (
    <div
      className={`ws-retro__card ws-retro__card--${sticky.color}${sticky.resolved ? " is-resolved" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <textarea
          ref={ref}
          className="ws-retro__card-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Escape") { setText(sticky.text); setEditing(false); }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
          }}
        />
      ) : (
        <>
          <div className="ws-retro__card-text">
            {sticky.text || <span className="ws-retro__card-empty">(empty)</span>}
          </div>
          <div className="ws-retro__card-footer">
            <span className="ws-retro__card-author">{sticky.author}</span>
            <div className="ws-retro__card-actions">
              <button
                type="button"
                onClick={() => stickiesStore.toggleResolved(sticky.id)}
                title={sticky.resolved ? "Reopen" : "Resolve"}
              >{sticky.resolved ? "↺" : "✓"}</button>
              <button
                type="button"
                onClick={() => stickiesStore.update(sticky.id, { retroColumn: undefined })}
                title="Remove from column"
              >↩</button>
              <button
                type="button"
                onClick={() => stickiesStore.remove(sticky.id)}
                title="Delete"
              >×</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
