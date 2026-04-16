import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "@quanta/shell";
import "@quanta/ui-kit/styles/tokens.css";
import "@quanta/ui-kit/styles/reset.css";
import "@quanta/shell/styles/app.css";

if ("__TAURI_INTERNALS__" in window) {
  document.documentElement.classList.add("is-tauri");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
