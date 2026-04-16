import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell, appRegistry } from "@quanta/shell";
import { ideAppDescriptor } from "@quanta/app-ide";
import "@quanta/ui-kit/styles/tokens.css";
import "@quanta/ui-kit/styles/reset.css";
import "@quanta/shell/styles/app.css";

// Register tab apps before Shell renders.
appRegistry.register(ideAppDescriptor);

if ("__TAURI_INTERNALS__" in window) {
  document.documentElement.classList.add("is-tauri");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
