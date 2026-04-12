import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n/i18n";
import { App } from "./app/App";
import "./index.css";
import "@/shared/styles/base.css";
import "@/shared/styles/aurora.css";
import "@/shared/styles/ide.css";

/* Tauri 네이티브 환경 감지 → html에 클래스 부착.
   여러 시그널 체크: __TAURI_INTERNALS__ (v2), ipc:// 프로토콜, UA.
   defer도 걸어서 IPC 주입 후 재체크. */
function detectTauri() {
  return "__TAURI_INTERNALS__" in window
    || "__TAURI_IPC__" in window
    || "ipc" in window
    || navigator.userAgent.includes("Tauri");
}
function applyTauriClass() {
  if (detectTauri()) {
    document.documentElement.classList.add("is-tauri");
  }
}
applyTauriClass();
// IPC가 비동기 주입될 수 있으므로 한 번 더 체크
setTimeout(applyTauriClass, 0);

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
