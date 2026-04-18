import { useEffect, useRef } from "react";

export interface ModifierState {
  /** Mutable ref tracking whether shift is currently held. */
  shiftHeldRef: React.MutableRefObject<boolean>;
  /** Mutable ref tracking whether meta (cmd on mac) or ctrl is currently held. */
  metaHeldRef: React.MutableRefObject<boolean>;
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      shiftHeldRef.current = e.shiftKey;
      metaHeldRef.current = e.metaKey || e.ctrlKey;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);
  return { shiftHeldRef, metaHeldRef };
}
