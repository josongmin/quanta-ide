import { useEffect } from "react";
import { commandPaletteStore } from "./store";

// Global shortcut — ⌘K / Ctrl+K toggles the palette from anywhere in
// the product. Installed by the orchestrator once on mount, so the
// shortcut works regardless of focus (unlike a keydown bound on the
// viewport, which only fires when the canvas has focus).
//
// We deliberately DO NOT preventDefault when the palette is already
// open and the user types a real "k" — only the bare modifier combo
// triggers. This lets the search input accept "k" literally while
// the modal is up.

export function useCommandPaletteShortcut(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key !== "k") return;
      e.preventDefault();
      commandPaletteStore.toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
