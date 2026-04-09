import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./index.css";
import "@/shared/styles/base.css";
import "@/shared/styles/aurora.css";
import "@/shared/styles/components.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
