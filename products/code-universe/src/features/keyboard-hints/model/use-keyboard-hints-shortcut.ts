import { useEffect } from "react";
import { keyboardHintsStore } from "./store";

// Global shortcut — `?` toggles the keyboard-hints modal. Closes on
// Esc via the modal's own handler.
//
// Matches the long-standing shell convention used by Gmail / Slack /
// VS Code: a single unmodified `?` opens the "keymap help" sheet. We
// guard against input/textarea focus so typing "?" into the palette
// search never pops the help overlay over the palette.

export function useKeyboardHintsShortcut(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "?") return;
      // Shift+/ on US layout — Shift is down, but we ignore modifier
      // state and key off the final character so non-US layouts (e.g.
      // Korean) that produce `?` from a different physical key still
      // work.
      const target = e.target as Element | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      keyboardHintsStore.toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
