import { useEffect } from "react";
import { tierStore } from "../../../entities/tier";
import { toast } from "../../toast";
import { exportSnapshot } from "./export-snapshot";

// ⌘/Ctrl + Shift + S → export the current canvas as a PNG.
//
// Shift is the gate — a bare ⌘S would collide with browser/VS Code
// "save" semantics the user's muscle memory holds for text editing.
// Shift-S is a common "save as / export" convention.
//
// The hook accepts a canvasRef so the caller (CanvasViewport) can
// keep ownership of the <canvas>. We don't import the viewport's
// internals here — it just hands us the DOM element.

export function useSnapshotShortcut(
  canvasRef: { current: HTMLCanvasElement | null },
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      const target = e.target as Element | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (target as HTMLElement | null)?.isContentEditable) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key !== "s") return;
      const el = canvasRef.current;
      if (!el) return;
      e.preventDefault();
      const tierName = tierStore.getState().activeTier.name;
      // Fire a toast as passive confirmation (the OS downloads bar
      // shows WHAT was saved, but we want to confirm the shortcut
      // *fired* — otherwise user has to watch for the file popup).
      void exportSnapshot({ canvas: el, tier: tierName })
        .then(() => {
          toast.success(`Snapshot saved · ${tierName}`);
        })
        .catch(err => {
          toast.error(`Snapshot failed — ${err instanceof Error ? err.message : "unknown error"}`);
        });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canvasRef, enabled]);
}
