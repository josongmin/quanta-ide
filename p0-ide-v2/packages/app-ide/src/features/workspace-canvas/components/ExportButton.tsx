import { useCallback, useEffect, useRef, useState } from "react";
import { useSceneStore } from "../store/scene-store";
import { useFeature } from "../store/feature-flags-store";
import { exportAsPNG, exportAsSVG } from "../lib/export-canvas";

// Floating "Export" button pinned to the canvas. Clicking toggles a tiny
// dropdown with PNG / SVG actions. The feature flag controls visibility;
// when disabled, the DOM node is omitted entirely so there's no toggling
// spurious focus outlines on feature rollout.

export function ExportButton() {
  const enabled = useFeature("devmode.export");
  const layout = useSceneStore(s => s.layout);
  const visible = useSceneStore(s => s.visibleScene);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
  }, []);

  const doPng = useCallback(async () => {
    setOpen(false);
    try {
      await exportAsPNG(wrapperRef.current?.closest(".workspace-canvas") as HTMLElement | null);
      flash("PNG saved");
    } catch (err) {
      flash(`PNG failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [flash]);

  const doSvg = useCallback(() => {
    setOpen(false);
    if (!layout || !visible) { flash("No scene"); return; }
    try {
      exportAsSVG({ layout, visible });
      flash("SVG saved");
    } catch (err) {
      flash(`SVG failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [layout, visible, flash]);

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
      {toast && <div className="ws-export__toast">{toast}</div>}
    </div>
  );
}
