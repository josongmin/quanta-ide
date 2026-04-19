import { useEffect, useRef } from "react";

export interface ModifierState {
  /** Mutable ref tracking whether shift is currently held. */
  shiftHeldRef: React.MutableRefObject<boolean>;
  /** Mutable ref tracking whether meta (cmd on mac) or ctrl is currently held. */
  metaHeldRef: React.MutableRefObject<boolean>;
  /** Mutable ref tracking whether the zoom-lens key (Z) is currently held. */
  zoomLensHeldRef: React.MutableRefObject<boolean>;
}

// Global modifier tracking.
// -----------------------------------------------------------------
// The click delivery paths (PixiStage.onFileClick, StreetCard.onSelect)
// only carry an id, not the originating MouseEvent. To implement
// shift+click → path-query and cmd+click → evidence inspector we need
// modifier state at click time — refs populated from window-level
// keydown/keyup fill that role without a re-render on every key event.
export function useModifierKeyTracking(): ModifierState {
  const shiftHeldRef = useRef(false);
  const metaHeldRef = useRef(false);
  const zoomLensHeldRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      shiftHeldRef.current = e.shiftKey;
      metaHeldRef.current = e.metaKey || e.ctrlKey;
      // Track Z separately — cheap to reconcile either on keydown or keyup.
      // Avoid firing when typing into an input/textarea so the hold-to-magnify
      // gesture doesn't steal the letter from a palette search.
      if (e.type === "keydown" && e.key && e.key.toLowerCase() === "z" && !isEditableTarget(e.target)) {
        zoomLensHeldRef.current = true;
      } else if (e.type === "keyup" && e.key && e.key.toLowerCase() === "z") {
        zoomLensHeldRef.current = false;
      }
    };
    const onBlur = () => { zoomLensHeldRef.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  return { shiftHeldRef, metaHeldRef, zoomLensHeldRef };
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

// -----------------------------------------------------------------
// Global keybind registration. A single listener handles every chord so
// new features (palette, theme cycle, etc.) extend this switch instead
// of scattering fresh window.addEventListener("keydown", …) calls.
//
// Each binding is (keys | predicate) → handler. `preventDefault: true`
// stops the browser default when we own the chord. The HUD's ⌘⇧D
// listener is intentionally left in place on DebugHud — it's lifecycle-
// scoped to that component and this hook runs only when the canvas is
// mounted, so both happily co-exist.

export interface GlobalKeybind {
  /** Human-readable label for tooltips. */
  label: string;
  /** Called with the KeyboardEvent when the predicate matches. */
  handler: (e: KeyboardEvent) => void;
  /** Matcher — return true to run the handler. */
  match: (e: KeyboardEvent) => boolean;
  /** Whether to preventDefault on match. Defaults to true. */
  preventDefault?: boolean;
  /** Whether to fire when focus is in an input/textarea. Defaults to false. */
  fireInEditable?: boolean;
}

export function useGlobalKeybinds(bindings: readonly GlobalKeybind[]): void {
  // Latest bindings held in a ref so a re-render doesn't re-subscribe.
  const ref = useRef(bindings);
  ref.current = bindings;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const b of ref.current) {
        if (!b.fireInEditable && isEditableTarget(e.target)) continue;
        if (!b.match(e)) continue;
        if (b.preventDefault !== false) e.preventDefault();
        b.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Pre-made predicate for Cmd+K / Ctrl+K (palette open). */
export function isCmdK(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false;
  if (e.shiftKey || e.altKey) return false;
  return e.key === "k" || e.key === "K";
}

/** Pre-made predicate for Cmd+Shift+T (cycle theme). */
export function isCmdShiftT(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false;
  if (!e.shiftKey) return false;
  return e.key === "t" || e.key === "T";
}

/** Pre-made predicate for Cmd+Shift+A (toggle Action Terrain iso mode). */
export function isCmdShiftA(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false;
  if (!e.shiftKey) return false;
  return e.key === "a" || e.key === "A";
}

/** Pre-made predicate for Cmd+E (enter inline edit on selected card). */
export function isCmdE(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false;
  if (e.shiftKey || e.altKey) return false;
  return e.key === "e" || e.key === "E";
}
