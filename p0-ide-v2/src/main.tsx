import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell, appRegistry } from "@quanta/shell";
import { ideAppDescriptor } from "@quanta/app-ide";
import { agentAppDescriptor } from "@quanta/app-agent";
import { prAppDescriptor } from "@quanta/app-pr";
import { reviewsDescriptor } from "@quanta/app-reviews";
import { rulesDescriptor } from "@quanta/app-rules";
import { scenarioDescriptor } from "@quanta/app-scenario";
import { settingsDescriptor } from "@quanta/app-settings";
import { homeDescriptor, newTabDescriptor } from "@quanta/app-home";
import "@quanta/ui-kit/styles/tokens.css";
import "@quanta/ui-kit/styles/reset.css";
import "@quanta/shell/styles/app.css";

// Register ALL tab apps before Shell renders.
appRegistry.register(ideAppDescriptor);
appRegistry.register(agentAppDescriptor);
appRegistry.register(prAppDescriptor);
appRegistry.register(reviewsDescriptor);
appRegistry.register(rulesDescriptor);
appRegistry.register(scenarioDescriptor);
appRegistry.register(settingsDescriptor);
appRegistry.register(homeDescriptor);
appRegistry.register(newTabDescriptor);

if ("__TAURI_INTERNALS__" in window) {
  document.documentElement.classList.add("is-tauri");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
