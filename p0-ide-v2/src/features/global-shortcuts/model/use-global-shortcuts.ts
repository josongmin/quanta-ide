import { useEffect } from "react";
import { focusStore, type InspectorMode } from "@/shared/model/focus-store";

const MODE_KEYS: readonly InspectorMode[] = [
  "overview",
  "flow",
  "blast",
  "incidents",
  "behavior",
  "ownership",
];

export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // ⌘⇧S — Simulate change
      if (e.shiftKey && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        focusStore.toggleSimulate(true);
        return;
      }
      // ⌘E — Ask agent / context inject
      if (!e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        focusStore.toggleContextInject(true);
        return;
      }
      // ⌘1..6 — inspector modes
      if (!e.shiftKey && e.key >= "1" && e.key <= "6") {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < MODE_KEYS.length) {
          e.preventDefault();
          focusStore.setMode(MODE_KEYS[idx]);
        }
      }
    };

    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const s = focusStore.get();
        if (s.simulateOpen) focusStore.toggleSimulate(false);
        if (s.contextInjectOpen) focusStore.toggleContextInject(false);
      }
    };

    window.addEventListener("keydown", handler);
    window.addEventListener("keydown", escapeHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keydown", escapeHandler);
    };
  }, []);
}
