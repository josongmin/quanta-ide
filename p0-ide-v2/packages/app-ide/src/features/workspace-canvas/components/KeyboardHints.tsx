import { useEffect, useMemo, useState } from "react";

// Keyboard hints overlay — press "?" anywhere in the canvas to see the
// full set of shortcuts. Closes on Esc or clicking the backdrop.
//
// The list below mirrors the live chord table in
// `hooks/use-keyboard-shortcuts.ts` plus the important per-component
// shortcuts (debug HUD, zoom lens, follow mode, stickies). Treat it as
// documentation: when we wire a new chord, update this list so the
// overlay stays the single source of truth.

interface Shortcut {
  keys: string; // e.g. "⌘K" or "Shift+Double-click"
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: readonly Shortcut[];
}

const GROUPS: readonly ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: "⌘K / Ctrl+K", description: "Open command palette" },
      { keys: "⌘⇧D / Ctrl+Shift+D", description: "Toggle debug HUD" },
      { keys: "⌘⇧T / Ctrl+Shift+T", description: "Cycle theme" },
      { keys: "⌘⇧A / Ctrl+Shift+A", description: "Toggle Action Terrain" },
      { keys: "Esc", description: "Close overlay / dismiss follow-mode" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: "Z (hold)", description: "Zoom lens — magnify under cursor" },
      { keys: "Space + drag", description: "Pan canvas" },
      { keys: "Scroll", description: "Zoom to cursor" },
      { keys: "M + click", description: "Dev Mode measure between files" },
      { keys: "Shift + drag", description: "Lasso-select multiple files" },
    ],
  },
  {
    title: "Collab & Review",
    items: [
      { keys: "Double-click file", description: "Open file detail" },
      { keys: "Shift + double-click", description: "Add sticky note" },
      { keys: "Click pin", description: "Open comment thread" },
      { keys: "?", description: "Show this overlay" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeyboardHints({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ws-keyboard-hints"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="ws-keyboard-hints__card"
        onClick={e => e.stopPropagation()}
      >
        <div className="ws-keyboard-hints__header">
          <span className="ws-keyboard-hints__title">Keyboard shortcuts</span>
          <button
            type="button"
            className="ws-keyboard-hints__close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            ×
          </button>
        </div>
        <div className="ws-keyboard-hints__body">
          {GROUPS.map(group => (
            <section key={group.title} className="ws-keyboard-hints__group">
              <h4 className="ws-keyboard-hints__group-title">{group.title}</h4>
              <ul className="ws-keyboard-hints__list">
                {group.items.map(item => (
                  <li key={item.keys} className="ws-keyboard-hints__row">
                    <kbd className="ws-keyboard-hints__keys">{item.keys}</kbd>
                    <span className="ws-keyboard-hints__desc">
                      {item.description}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="ws-keyboard-hints__footer">
          Press <kbd>?</kbd> any time to show this overlay, Esc to close.
        </div>
      </div>
    </div>
  );
}

// ── hook ──────────────────────────────────────────────────────────────
//
// Wire this once at the canvas root to own the "?" keybind + render the
// modal. Returns a tuple of (open, setOpen) so the host component can
// also open the modal from a menu item.

export function useKeyboardHints(): {
  open: boolean;
  setOpen: (v: boolean) => void;
} {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when focus is inside an editable element — users typing "?"
      // into an input / comment textarea shouldn't accidentally open the
      // modal.
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (t.isContentEditable) return;
      }
      // "?" needs shift+/ on US keyboards but some layouts emit "?" directly.
      // Prefer `e.key` so it's layout-agnostic.
      if (e.key !== "?") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setOpen(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Memoize the return so consumers can destructure stably.
  return useMemo(() => ({ open, setOpen }), [open]);
}
