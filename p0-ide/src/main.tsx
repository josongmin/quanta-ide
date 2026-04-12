import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n/i18n";
import { App } from "./app/App";
import "./index.css";
import "@/shared/styles/base.css";
import "@/shared/styles/aurora.css";
import "@/shared/styles/ide.css";

/* Tauri 네이티브 환경 감지 → html에 클래스 부착 */
if ("__TAURI_INTERNALS__" in window) {
  document.documentElement.classList.add("is-tauri");
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
