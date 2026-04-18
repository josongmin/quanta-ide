import { memo, useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type ChangeEvent } from "react";
import { clamp } from "@quanta/canvas-engine";
import { stickiesStore, STICKY_COLORS, type Sticky, type StickyColor } from "../store/stickies-store";
import { WS_CLASSES } from "../lib/css-classes";
import { useFeature } from "../store/feature-flags-store";

interface Props {
  sticky: Sticky;
  isActive: boolean;
  scale: number;
  onDragStart: (id: string, e: ReactPointerEvent<HTMLDivElement>) => void;
}

const MIN_W = 140;
const MIN_H = 100;
const MAX_W = 360;
const MAX_H = 300;

function StickyNoteInner({ sticky, isActive, scale, onDragStart }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lockEnabled = useFeature("collab.lock");

  useLayoutEffect(() => {
    if (!isActive) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      // some browsers reject setSelectionRange on textareas with certain types; ignore.
    }
  }, [isActive]);

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      // Locked stickies cannot be dragged; the header still allows selection.
      if (sticky.locked) {
        e.preventDefault();
        e.stopPropagation();
        if (!isActive) stickiesStore.setActive(sticky.id);
        return;
      }
      onDragStart(sticky.id, e);
    },
    [onDragStart, sticky.id, sticky.locked, isActive],
  );

  const onLockToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    stickiesStore.toggleLocked(sticky.id);
  }, [sticky.id]);

  const onBodyPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!isActive) stickiesStore.setActive(sticky.id);
    },
    [isActive, sticky.id],
  );

  const onTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      stickiesStore.update(sticky.id, { text: e.target.value });
    },
    [sticky.id],
  );

  const onClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    stickiesStore.remove(sticky.id);
  }, [sticky.id]);

  const onResolve = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    stickiesStore.toggleResolved(sticky.id);
  }, [sticky.id]);

  const onColorClick = useCallback((e: React.MouseEvent, color: StickyColor) => {
    e.stopPropagation();
    stickiesStore.update(sticky.id, { color });
  }, [sticky.id]);

  const width = clamp(sticky.width, MIN_W, MAX_W);
  const height = clamp(sticky.height, MIN_H, MAX_H);

  const classNames = [
    WS_CLASSES.sticky,
    `${WS_CLASSES.sticky}--${sticky.color}`,
    sticky.resolved ? `${WS_CLASSES.sticky}--resolved` : "",
    sticky.anchorFileId ? `${WS_CLASSES.sticky}--anchored` : "",
    isActive ? `${WS_CLASSES.sticky}--active` : "",
    sticky.locked ? `${WS_CLASSES.sticky}--locked` : "",
  ].filter(Boolean).join(" ");

  // Counter-scale interactive sub-elements so hit targets/text feel consistent
  // across zoom levels. World-space sticky stays at world scale; the invScale
  // factor is applied to font-size via CSS vars.
  const invScale = scale > 0 ? 1 / scale : 1;

  return (
    <div
      className={classNames}
      style={{
        left: sticky.x,
        top: sticky.y,
        width,
        height,
        // CSS uses these to counter the world transform where needed so tiny
        // UI affordances (dots, buttons) stay legible when zoomed out.
        ["--sticky-inv-scale" as string]: invScale.toFixed(4),
      }}
      data-sticky-id={sticky.id}
    >
      <div className={WS_CLASSES.stickyHeader} onPointerDown={onHeaderPointerDown}>
        <span className={WS_CLASSES.stickyAuthor}>{sticky.author}</span>
        <div className={WS_CLASSES.stickyActions}>
          {lockEnabled && (
            <button
              type="button"
              className={`${WS_CLASSES.stickyResolve} ws-sticky__lock`}
              title={sticky.locked ? "unlock" : "lock"}
              onClick={onLockToggle}
            >
              {sticky.locked ? "🔒" : "🔓"}
            </button>
          )}
          <button
            type="button"
            className={WS_CLASSES.stickyResolve}
            title={sticky.resolved ? "reopen" : "mark done"}
            onClick={onResolve}
          >
            {sticky.resolved ? "↺" : "✓"}
          </button>
          <button
            type="button"
            className={WS_CLASSES.stickyClose}
            title="remove"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <div className={WS_CLASSES.stickyBody} onPointerDown={onBodyPointerDown}>
        {isActive ? (
          <textarea
            ref={textareaRef}
            className={WS_CLASSES.stickyTextarea}
            value={sticky.text}
            placeholder="type a note…"
            onChange={onTextChange}
            onKeyDown={e => {
              if (e.key === "Escape") {
                e.preventDefault();
                stickiesStore.setActive(null);
              }
            }}
          />
        ) : (
          <div className={WS_CLASSES.stickyText}>
            {sticky.text.length > 0 ? sticky.text : <span className={WS_CLASSES.stickyPlaceholder}>click to edit…</span>}
          </div>
        )}
      </div>

      <div className={WS_CLASSES.stickyColorpicker}>
        {STICKY_COLORS.map(c => (
          <button
            key={c}
            type="button"
            className={`${WS_CLASSES.stickyDot} ${WS_CLASSES.stickyDot}--${c}${sticky.color === c ? " is-on" : ""}`}
            onClick={e => onColorClick(e, c)}
            title={c}
            aria-label={`set color ${c}`}
          />
        ))}
      </div>

      {sticky.anchorFileId && (
        <div className={WS_CLASSES.stickyPin} title={`anchored to ${sticky.anchorFileId}`}>
          pin
        </div>
      )}
    </div>
  );
}

export const StickyNote = memo(StickyNoteInner);

// Escape-to-deactivate global hook — attached once at the layer level but exposed
// here so the component can register a no-op outside-click listener. Kept as a
// named export so the layer can share the same unmount path for cleanup.
export function useDeactivateOnOutsideClick(layerEl: HTMLElement | null) {
  useEffect(() => {
    if (!layerEl) return;
    const onDown = (e: MouseEvent) => {
      const active = stickiesStore.getState().activeId;
      if (!active) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(`[data-sticky-id="${active}"]`)) return;
      stickiesStore.setActive(null);
    };
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [layerEl]);
}
