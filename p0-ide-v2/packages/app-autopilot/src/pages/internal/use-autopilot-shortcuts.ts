import { useEffect, useRef } from "react";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";

/**
 * Global keybindings for the autopilot tab.
 *
 * gg / go / gr / gw / gu / gp / gs — jump to nav pages (vim-style)
 * Escape — close detail view (go up one level)
 */
export function useAutopilotShortcuts({
  route,
  navigate,
}: {
  route: AutopilotRoute;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}) {
  const pendingG = useRef(false);
  const gTimer = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (route.page === "goal-detail") navigate({ page: "goals" });
        else if (route.page === "goal-new") navigate({ page: "goals" });
        else if (route.page === "plan-preview") navigate({ page: "goal-detail", id: route.goalId });
        else if (route.page === "run-detail") navigate({ page: "runs" });
        else if (route.page === "proof-detail") navigate({ page: "runs" });
        else if (route.page === "operator-detail") navigate({ page: "operators" });
        else if (route.page === "policy-detail") navigate({ page: "policies" });
        return;
      }

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) window.clearTimeout(gTimer.current);
        gTimer.current = null;
        switch (e.key) {
          case "o":
            navigate({ page: "overview" });
            break;
          case "g":
            navigate({ page: "goals" });
            break;
          case "r":
            navigate({ page: "runs" });
            break;
          case "w":
            navigate({ page: "workitems" });
            break;
          case "u":
            navigate({ page: "opportunities" });
            break;
          case "p":
            navigate({ page: "operators" });
            break;
          case "s":
            navigate({ page: "snapshot" });
            break;
          case "l":
            navigate({ page: "policies" });
            break;
        }
        return;
      }

      if (e.key === "N") {
        navigate({ page: "goal-new" });
        return;
      }

      if (e.key === "g") {
        pendingG.current = true;
        gTimer.current = window.setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, 900);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer.current) window.clearTimeout(gTimer.current);
    };
  }, [route, navigate]);
}
