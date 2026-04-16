import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "@quanta/shell";
import "./app/styles/tokens.css";
import "./app/styles/reset.css";
import "./app/styles/app.css";

if ("__TAURI_INTERNALS__" in window) {
  document.documentElement.classList.add("is-tauri");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
