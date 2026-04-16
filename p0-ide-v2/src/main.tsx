import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Shell, appRegistry, registerFeatureManifests } from "@quanta/shell";
import type { AppKind } from "@quanta/shell-contract";
import "@quanta/ui-kit/styles/tokens.css";
import "@quanta/ui-kit/styles/reset.css";
import "@quanta/shell/styles/app.css";

const AgentPopout = lazy(() =>
  import("@quanta/app-ide/features/inspector-agent").then((m) => ({ default: m.AgentPane })),
);

// Feature seeds — eagerly imported so all features appear in Settings/Palette
// immediately, regardless of which tabs have been opened. Seed files are tiny
// (manifest metadata only); they don't pull in app components.
import { IDE_FEATURES } from "@quanta/app-ide/seed";
import { AGENT_FEATURES } from "@quanta/app-agent/seed";
import { REVIEWS_FEATURES } from "@quanta/app-reviews/seed";
import { RULES_FEATURES } from "@quanta/app-rules/seed";
import { SCENARIO_FEATURES } from "@quanta/app-scenario/seed";

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

// Register all app feature manifests eagerly.
registerFeatureManifests(IDE_FEATURES);
registerFeatureManifests(AGENT_FEATURES);
registerFeatureManifests(REVIEWS_FEATURES);
registerFeatureManifests(RULES_FEATURES);
registerFeatureManifests(SCENARIO_FEATURES);

if ("__TAURI_INTERNALS__" in window) {
  document.documentElement.classList.add("is-tauri");
}

const isPopout = new URLSearchParams(window.location.search).get("popout") === "agent";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isPopout ? (
      <Suspense fallback={null}>
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          <AgentPopout fileName="orchestrator.py" />
        </div>
      </Suspense>
    ) : (
      <Shell />
    )}
  </StrictMode>,
);
