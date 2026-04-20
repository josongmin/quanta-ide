import { useEffect } from "react";
import { entityStore } from "../../../entities/entity";
import { stickyStore } from "./store";

// `N` key → create or edit a sticky on the currently-selected entity.
//
// - No selection → ignore (no "N" does nothing quietly; a toast
//   would be noise for a missed shortcut).
// - Selection has no sticky → create an empty one + enter edit mode.
// - Selection has a sticky → enter edit mode on the existing one.
//
// Input context guard: skip when the user is typing in an <input> /
// <textarea> / contentEditable so letters still reach those fields.

export function useStickyShortcut(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      // Bare `n` / `N` only — modifier-pressed combos belong to
      // other features (⌘N opens new tab in the host shell).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "n" && e.key !== "N") return;
      const target = e.target as Element | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      const selectedId = entityStore.getState().interaction.selectedId;
      if (!selectedId) return;
      e.preventDefault();
      if (!stickyStore.get(selectedId)) {
        stickyStore.set(selectedId, " "); // placeholder non-empty so the sticky renders immediately
      }
      stickyStore.startEditing(selectedId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
