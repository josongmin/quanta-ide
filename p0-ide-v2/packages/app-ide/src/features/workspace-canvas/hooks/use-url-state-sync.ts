import { useEffect, useRef } from "react";
import { sceneStore } from "../store/scene-store";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import { renderSettingsStore } from "../store/render-settings-store";
import { uxSettingsStore, useUxSettings } from "../store/ux-settings-store";
import { debugSettingsStore } from "../store/debug-settings-store";
import {
  applyWorkspaceUrlState,
  captureWorkspaceUrlState,
} from "../lib/apply-workspace-url";
import {
  buildShareUrl,
  readShareUrlFromLocation,
} from "../lib/workspace-url";

// Reads an incoming share URL on mount, then (when `autoSyncUrl` is on)
// writes a debounced mirror of workspace state back into
// `window.history.replaceState`. Pulled out of MultiFileCanvas so the
// canvas body doesn't own three useEffects + a timer ref for a
// cross-cutting concern.
export function useUrlStateSync(): void {
  const sharedStateAppliedRef = useRef(false);
  useEffect(() => {
    if (sharedStateAppliedRef.current) return;
    const incoming = readShareUrlFromLocation();
    if (!incoming) {
      sharedStateAppliedRef.current = true;
      return;
    }
    if (sceneStore.getState().graph) {
      applyWorkspaceUrlState(incoming);
      sharedStateAppliedRef.current = true;
      return;
    }
    // Graph isn't ready yet — wait for the first emit that ships a graph,
    // then apply and detach. Cleaning up on unmount handles a rare remount
    // before the graph lands.
    const unsub = sceneStore.subscribe(() => {
      if (sharedStateAppliedRef.current) return;
      if (sceneStore.getState().graph) {
        applyWorkspaceUrlState(incoming);
        sharedStateAppliedRef.current = true;
        unsub();
      }
    });
    return () => unsub();
  }, []);

  const autoSyncUrl = useUxSettings(s => s.autoSyncUrl);
  useEffect(() => {
    if (!autoSyncUrl) return;
    if (typeof window === "undefined") return;
    let timer: number | null = null;
    // Debounce — pan/zoom events fire at 100Hz; we coalesce to once per
    // 500ms so the URL bar doesn't thrash and history.replaceState doesn't
    // land in the middle of a drag gesture.
    const scheduleWrite = () => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        try {
          const state = captureWorkspaceUrlState();
          const base = window.location.origin + window.location.pathname;
          const url = buildShareUrl(base, state);
          window.history.replaceState(null, "", url);
        } catch {
          // ignore — share URL write is best-effort
        }
      }, 500);
    };
    const unsubs = [
      viewportStore.subscribe(scheduleWrite),
      interactionStore.subscribe(scheduleWrite),
      renderSettingsStore.subscribe(scheduleWrite),
      uxSettingsStore.subscribe(scheduleWrite),
      debugSettingsStore.subscribe(scheduleWrite),
    ];
    scheduleWrite();
    return () => {
      for (const u of unsubs) u();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [autoSyncUrl]);
}
