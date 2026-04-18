import { useEffect } from "react";
import { useSettingsStore, settingsStore } from "../store/settings-store";
import { FpsSection } from "./debug-hud/FpsSection";
import { LodSection } from "./debug-hud/LodSection";
import { SceneSection } from "./debug-hud/SceneSection";
import { RecorderControls } from "./debug-hud/RecorderControls";

// Floating corner overlay for development/debugging. Surfaces the LOD, scale,
// viewport, scene counts, and a few render toggles. Not meant to ship to end
// users — gate via `debugHudOpen` flag; hidden state is still reachable via
// the store toggle action (wire Cmd+Shift+D from a global shortcut).

export function DebugHud() {
  const open = useSettingsStore(s => s.debugHudOpen);

  // Global keyboard toggle (Cmd/Ctrl+Shift+D).
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
    <div className="ws-debug">
      <div className="ws-debug__header">
        <span>debug</span>
        <button
          type="button"
          className="ws-debug__close"
          title="Hide (⌘⇧D)"
          onClick={() => settingsStore.toggleDebugHud()}
        >×</button>
      </div>
      <div className="ws-debug__grid">
        <FpsSection />
      </div>
      <LodSection />
      <SceneSection />
      <RecorderControls />
    </div>
  );
}
