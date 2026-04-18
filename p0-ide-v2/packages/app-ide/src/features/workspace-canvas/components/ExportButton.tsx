import { useCallback, useEffect, useRef, useState } from "react";
import { useSceneStore } from "../store/scene-store";
import { useFeature } from "../store/feature-flags-store";
import { exportAsPNG, exportAsSVG } from "../lib/export-canvas";
import { showSuccessToast, showErrorToast, showToast } from "../lib/toast";

// Floating "Export" button pinned to the canvas. Clicking toggles a tiny
// dropdown with PNG / SVG actions. The feature flag controls visibility;
// when disabled, the DOM node is omitted entirely so there's no toggling
// spurious focus outlines on feature rollout.
//
// Toast feedback routes through the shared shell toast store via
// `lib/toast.ts` so exported-file notifications stack cleanly with
// engine/agent toasts instead of rendering a local sibling pill.

export function ExportButton() {
  const enabled = useFeature("devmode.export");
  const layout = useSceneStore(s => s.layout);
  const visible = useSceneStore(s => s.visibleScene);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const doPng = useCallback(async () => {
    setOpen(false);
    try {
      await exportAsPNG(wrapperRef.current?.closest(".workspace-canvas") as HTMLElement | null);
      showSuccessToast("PNG saved");
    } catch (err) {
      showErrorToast(`PNG failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const doSvg = useCallback(() => {
    setOpen(false);
    if (!layout || !visible) { showToast("No scene"); return; }
    try {
      exportAsSVG({ layout, visible });
      showSuccessToast("SVG saved");
    } catch (err) {
      showErrorToast(`SVG failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [layout, visible]);

  // Close the dropdown on outside click so it doesn't linger after the user
  // moves back into the canvas.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!enabled) return null;

  return (
    <div className="ws-export" ref={wrapperRef}>
      <button
        type="button"
        className="ws-export__btn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        title="Export current view"
      >
        export
      </button>
      {open && (
        <div className="ws-export__menu" role="menu">
          <button
            type="button"
            className="ws-export__item"
            onClick={() => { void doPng(); }}
            role="menuitem"
          >
            PNG
          </button>
          <button
            type="button"
            className="ws-export__item"
            onClick={doSvg}
            role="menuitem"
          >
            SVG
          </button>
        </div>
      )}
    </div>
  );
}
