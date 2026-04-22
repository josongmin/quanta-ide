import { useEffect } from "react";
import { viewPaletteStore } from "./store";

// Global shortcut — ⌘K / Ctrl+K toggles the view palette from anywhere
// in the product. Esc closes. "/" focuses the search input when the
// modal is already open (editor-style quick-focus).
//
// Installed by CanvasShell once on mount, so the shortcut works
// regardless of focus (unlike a keydown bound on the viewport, which
// only fires when the canvas has focus).
//
// Focus handling for "/" uses a data-hook on the input so the hook
// does not need to hold a ref. The ViewPalette component tags its
// search input with `data-view-palette-search`.

export function useViewPaletteShortcut(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      const meta = e.metaKey || e.ctrlKey;

      // ⌘K / Ctrl+K — toggle. Runs regardless of focus so the user
      // can jump here from anywhere (canvas, sidebar, inspector).
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        viewPaletteStore.toggle();
        return;
      }

      // Esc — close. Only fires when the palette is open so we don't
      // swallow the shell's view-mode Escape shortcut.
      if (e.key === "Escape") {
        const s = viewPaletteStore.getState();
        if (!s.open) return;
        e.preventDefault();
        // Stop the event here so the shell's outer Escape handler
        // (which jumps back to treemap) does not also fire.
        e.stopPropagation();
        viewPaletteStore.close();
        return;
      }

      // "/" — focus the search input if the palette is open and the
      // user is not already typing into a field. Mirrors the editor
      // convention "/" = jump to search.
      if (e.key === "/") {
        const s = viewPaletteStore.getState();
        if (!s.open) return;
        const active = document.activeElement as HTMLElement | null;
        const inField =
          !!active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable);
        if (inField) return;
        const input = document.querySelector<HTMLInputElement>(
          "input[data-view-palette-search]",
        );
        if (!input) return;
        e.preventDefault();
        input.focus();
        input.select();
      }
    };
    // Capture phase so Esc closes the palette before the canvas
    // viewport's keydown handler can react.
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [enabled]);
}
