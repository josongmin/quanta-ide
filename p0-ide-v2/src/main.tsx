import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Shell, appRegistry } from "@quanta/shell";
import type { AppKind } from "@quanta/shell-contract";
import "@quanta/ui-kit/styles/tokens.css";
import "@quanta/ui-kit/styles/reset.css";
import "@quanta/shell/styles/app.css";

// ---------------------------------------------------------------------------
// Lazy app registrations — each app's Component is code-split via dynamic
// import(). Vite emits a separate chunk per app; the chunk is fetched only
// when the tab is first rendered (i.e. when React mounts the lazy component).
//
// Descriptor metadata (id, label) is defined inline so no app code is pulled
// into the initial bundle.
// ---------------------------------------------------------------------------

appRegistry.register({
  id: "ide",
  label: "IDE",
  Component: lazy(() =>
    import("@quanta/app-ide").then((m) => ({ default: m.IdeApp })),
  ),
});

appRegistry.register({
  id: "agent",
  label: "Agent",
  Component: lazy(() =>
    import("@quanta/app-agent").then((m) => ({ default: m.AgentApp })),
  ),
});

appRegistry.register({
  id: "pr",
  label: "PR Review",
  Component: lazy(() =>
    import("@quanta/app-pr").then((m) => ({ default: m.PrApp })),
  ),
});

appRegistry.register({
  id: "reviews",
  label: "Reviews",
  Component: lazy(() =>
    import("@quanta/app-reviews").then((m) => ({ default: m.ReviewsApp })),
  ),
});

appRegistry.register({
  id: "rules" as AppKind,
  label: "Rules",
  Component: lazy(() =>
    import("@quanta/app-rules").then((m) => ({ default: m.RulesApp })),
  ),
});

appRegistry.register({
  id: "scenario",
  label: "Scenario",
  Component: lazy(() =>
    import("@quanta/app-scenario").then((m) => ({ default: m.ScenarioApp })),
  ),
});

appRegistry.register({
  id: "settings",
  label: "Settings",
  Component: lazy(() =>
    import("@quanta/app-settings").then((m) => ({ default: m.SettingsApp })),
  ),
});

appRegistry.register({
  id: "home",
  label: "Home",
  Component: lazy(() =>
    import("@quanta/app-home").then((m) => ({ default: m.HomeApp })),
  ),
});

appRegistry.register({
  id: "new-tab",
  label: "New Tab",
  Component: lazy(() =>
    import("@quanta/app-home").then((m) => ({ default: m.NewTabApp })),
  ),
});

if ("__TAURI_INTERNALS__" in window) {
  document.documentElement.classList.add("is-tauri");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
