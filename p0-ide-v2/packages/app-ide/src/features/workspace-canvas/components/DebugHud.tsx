import { useEffect, useRef, useState } from "react";
import { useSettingsStore, settingsStore } from "../store/settings-store";
import { FpsSection } from "./debug-hud/FpsSection";
import { LodSection } from "./debug-hud/LodSection";
import { SceneSection } from "./debug-hud/SceneSection";
import { RecorderControls } from "./debug-hud/RecorderControls";
import { SimulatorSection } from "./debug-hud/SimulatorSection";
import { GraphSection } from "./debug-hud/GraphSection";

type Tab = "fps" | "lod" | "scene" | "perf" | "graph";
const TABS: readonly { id: Tab; label: string }[] = [
  { id: "fps", label: "fps" },
  { id: "lod", label: "lod" },
  { id: "scene", label: "scene" },
  { id: "perf", label: "perf" },
  { id: "graph", label: "graph" },
] as const;

// Floating corner overlay for development/debugging. Surfaces the LOD, scale,
// viewport, scene counts, and a few render toggles. Not meant to ship to end
// users — gate via `debugHudOpen` flag; hidden state is still reachable via
// the store toggle action (wire Cmd+Shift+D from a global shortcut).

export function DebugHud() {
  const open = useSettingsStore(s => s.debugHudOpen);
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("scene");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        settingsStore.toggleDebugHud();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The canvas pan/zoom handler is registered as a *native* `addEventListener`
  // on the containing canvas element (not via React), so React's
  // `onWheelCapture` synthetic-event `stopPropagation` does NOT prevent it
  // from firing. We attach native capture-phase listeners on the HUD element
  // directly and call `stopPropagation` there — that terminates the DOM
  // capture/bubble walk before the canvas handler sees the event.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: Event) => { e.stopPropagation(); };
    el.addEventListener("wheel", stop, { passive: false, capture: true });
    el.addEventListener("pointerdown", stop, { capture: true });
    el.addEventListener("mousedown", stop, { capture: true });
    el.addEventListener("touchstart", stop, { capture: true, passive: false });
    return () => {
      el.removeEventListener("wheel", stop, { capture: true });
      el.removeEventListener("pointerdown", stop, { capture: true });
      el.removeEventListener("mousedown", stop, { capture: true });
      el.removeEventListener("touchstart", stop, { capture: true });
    };
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        className="ws-debug__toggle"
        onClick={() => settingsStore.toggleDebugHud()}
        title="Show debug HUD (⌘⇧D)"
      >
        debug
      </button>
    );
  }

  return (
    <div ref={panelRef} className="ws-debug">
      <div className="ws-debug__header">
        <span>debug</span>
        <button
          type="button"
          className="ws-debug__close"
          title="Hide (⌘⇧D)"
          onClick={() => settingsStore.toggleDebugHud()}
        >×</button>
      </div>
      <div className="ws-debug__tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`ws-debug__tab${tab === t.id ? " is-on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="ws-debug__body">
        {tab === "fps" && (
          <div className="ws-debug__grid">
            <FpsSection />
          </div>
        )}
        {tab === "lod" && <LodSection />}
        {tab === "scene" && <SceneSection />}
        {tab === "perf" && (
          <>
            <RecorderControls />
            <SimulatorSection />
          </>
        )}
        {tab === "graph" && <GraphSection />}
      </div>
    </div>
  );
}
