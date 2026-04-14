import { useEffect } from "react";
import { focusStore } from "@/entities/engine";

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
      // ⌘1..5 — inspector modes
      if (!e.shiftKey && e.key >= "1" && e.key <= "6") {
        const idx = Number(e.key) - 1;
        const modes = ["overview", "flow", "blast", "incidents", "behavior", "ownership"] as const;
        if (idx >= 0 && idx < modes.length) {
          e.preventDefault();
          focusStore.setMode(modes[idx]);
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
