import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { Entity, HierarchicalLayout } from "@quanta/canvas-engine";
import { stickyStore, useStickies, type Sticky } from "../model/store";

// StickiesLayer
// --------------------------------------------------------------------
// DOM overlay that renders one positioned note per entity that has a
// sticky. Lives in world space — as the user pans / zooms, each note
// translates with the camera via a single CSS transform, so the
// overlay stays bolted to its entity rect without re-running
// React per pan frame.
//
// Why DOM over canvas text: stickies are editable. An editable
// textarea inside a Pixi scene would mean reimplementing caret /
// selection / IME, which Chrome already does for us for free if we
// just keep the note as a real `<textarea>`. The tradeoff is one
// extra layer to paint on pan — affordable at the typical "a few
// dozen stickies per workspace" scale.
//
// Pointer-events are tuned carefully: the overlay container is
// `none` so pans through empty space hit the Pixi canvas underneath,
// but each note is `auto` so it receives clicks for edit / delete.

const NOTE_WIDTH = 180;
const NOTE_MAX_HEIGHT = 140;

const LAYER: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
  zIndex: 6,
};

const NOTE_BASE: CSSProperties = {
  position: "absolute",
  pointerEvents: "auto",
  width: NOTE_WIDTH,
  padding: "10px 12px 8px",
  borderRadius: 6,
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  lineHeight: 1.4,
  color: "#1f2937",
  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.15), 0 1px 2px rgba(0,0,0,0.06)",
  border: "1px solid rgba(0,0,0,0.08)",
  // A slight rotation reads as a hand-placed note rather than a UI
  // tooltip — cheap way to signal "user artefact, not system chrome".
  transform: "rotate(-0.4deg)",
  transformOrigin: "top left",
};

const HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
  fontSize: 9,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  fontWeight: 700,
  color: "rgba(15,23,42,0.45)",
};

const ACTION_BUTTON: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "0 4px",
  cursor: "pointer",
  fontSize: 11,
  color: "rgba(15,23,42,0.55)",
  lineHeight: 1,
};

const TEXT: CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: NOTE_MAX_HEIGHT,
  overflow: "auto",
  cursor: "text",
};

const TEXTAREA: CSSProperties = {
  width: "100%",
  minHeight: 64,
  maxHeight: NOTE_MAX_HEIGHT,
  border: "none",
  background: "rgba(255,255,255,0.5)",
  borderRadius: 4,
  padding: 6,
  font: "inherit",
  resize: "vertical",
  outline: "none",
  color: "inherit",
};

interface Props {
  layout: HierarchicalLayout;
  visibleEntities: readonly Entity[];
  camera: { tx: number; ty: number; scale: number };
}

export function StickiesLayer({ layout, visibleEntities, camera }: Props): ReactElement | null {
  const byEntityId = useStickies(s => s.byEntityId);
  const editingId = useStickies(s => s.editingId);

  // Index visible entity ids so we can cull stickies for entities
  // that aren't in the current tier. Keeps the DOM small — if 50
  // stickies cover a workspace but only 8 are in the active tier,
  // only 8 nodes render.
  const visibleIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of visibleEntities) s.add(e.id);
    return s;
  }, [visibleEntities]);

  const pairs = useMemo(() => {
    const out: { id: string; rect: { x: number; y: number; w: number; h: number }; sticky: Sticky }[] = [];
    for (const [id, sticky] of byEntityId) {
      if (!visibleIds.has(id)) continue;
      const r = layout.rects.get(id);
      if (!r) continue;
      out.push({ id, rect: r, sticky });
    }
    return out;
  }, [byEntityId, visibleIds, layout]);

  if (pairs.length === 0) return null;

  return (
    <div style={LAYER} aria-label="Sticky notes">
      {pairs.map(({ id, rect, sticky }) => {
        // Anchor the note at the rect's TOP-RIGHT corner + a small
        // offset so the note visually hangs off the card like a
        // Post-it — close enough that "note belongs to this entity"
        // reads at a glance, far enough that the note doesn't hide
        // the entity label.
        const screenX = (rect.x + rect.w) * camera.scale + camera.tx - NOTE_WIDTH + 12;
        const screenY = rect.y * camera.scale + camera.ty - 8;
        return (
          <StickyNote
            key={id}
            entityId={id}
            sticky={sticky}
            editing={editingId === id}
            x={screenX}
            y={screenY}
          />
        );
      })}
    </div>
  );
}

function StickyNote({
  entityId,
  sticky,
  editing,
  x,
  y,
}: {
  entityId: string;
  sticky: Sticky;
  editing: boolean;
  x: number;
  y: number;
}): ReactElement {
  const [draft, setDraft] = useState(sticky.text);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset draft whenever the stored text changes (e.g. another tab
  // committed an edit) unless we're the one editing right now.
  useEffect(() => {
    if (!editing) setDraft(sticky.text);
  }, [sticky.text, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = taRef.current;
    if (!el) return;
    el.focus();
    // Place the caret at the end — for a newly-created empty note
    // this is start/end/=0 which is fine.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const commit = (): void => {
    stickyStore.set(entityId, draft);
    stickyStore.stopEditing();
  };
  const cancel = (): void => {
    setDraft(sticky.text);
    stickyStore.stopEditing();
    if (sticky.text.trim() === "") stickyStore.remove(entityId);
  };

  return (
    <div
      style={{
        ...NOTE_BASE,
        left: x,
        top: y,
        background: sticky.color,
      }}
      role="note"
      aria-label={`Sticky note on ${entityId}`}
    >
      <div style={HEADER}>
        <span>Note</span>
        <span style={{ display: "inline-flex", gap: 2 }}>
          {editing ? null : (
            <button
              type="button"
              style={ACTION_BUTTON}
              onClick={() => stickyStore.startEditing(entityId)}
              aria-label="Edit sticky"
              title="Edit"
            >
              ✎
            </button>
          )}
          <button
            type="button"
            style={ACTION_BUTTON}
            onClick={() => stickyStore.remove(entityId)}
            aria-label="Delete sticky"
            title="Delete"
          >
            ✕
          </button>
        </span>
      </div>

      {editing ? (
        <textarea
          ref={taRef}
          style={TEXTAREA}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Note…"
        />
      ) : (
        <div
          style={TEXT}
          onDoubleClick={() => stickyStore.startEditing(entityId)}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              stickyStore.startEditing(entityId);
            }
          }}
        >
          {sticky.text}
        </div>
      )}
    </div>
  );
}
