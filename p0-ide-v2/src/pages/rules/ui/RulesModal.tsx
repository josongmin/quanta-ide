import { useEffect } from "react";
import { createPortal } from "react-dom";
import { uiBus, useUiBus } from "@/shared/model/ui-bus";
import { RulesPage } from "./RulesPage";
import "./rules-modal.css";

export function RulesModal() {
  const open = useUiBus((s) => s.rulesOpen);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        uiBus.toggleRules(false);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="rules-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Agent Rules"
      onMouseDown={() => uiBus.toggleRules(false)}
    >
      <div className="rules-modal" onMouseDown={(e) => e.stopPropagation()}>
        <RulesPage />
      </div>
    </div>,
    document.body,
  );
}
