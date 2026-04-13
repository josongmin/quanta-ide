import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconBolt, IconGlobe, IconGrid2x2, IconSettings, Textarea } from "@/shared/ui";
import { useAgentWindow } from "../model/useAgentWindow";
import { IconChevron, IconPlus, IconSend } from "./icons";

/* augment window for pending query handoff */
declare global {
  interface Window { __agentPendingQuery?: string; }
}

export function CenterPromptBar() {
  const { t } = useTranslation();
  const { setInteracted } = useAgentWindow();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => { clearTimeout(t); };
  }, []);

  const handleSubmit = () => {
    if (!input.trim()) return;
    setInteracted();
    window.__agentPendingQuery = input.trim();
  };

  return (
    <div className="agw-center-overlay">
      <div className="agw-center-bar">
        <Textarea
          ref={inputRef}
          variant="minimal"
          resize="none"
          className="agw-center-input"
          placeholder="Ask p0 about your codebase…"
          value={input}
          rows={2}
          onChange={(e) => { setInput(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
        />
        <div className="agw-center-toolbar">
          <div className="agw-center-toolbar-left">
            <button type="button" className="agw-toolbar-btn" aria-label={t("ide.agent.add")}><IconPlus /></button>
            <button type="button" className="agw-toolbar-model" aria-label={t("ide.agent.app")}>
              <IconGrid2x2 size={11} strokeWidth={1.8} />
              App
            </button>
            <button type="button" className="agw-toolbar-model" aria-label={t("ide.agent.web")}>
              <IconGlobe size={11} strokeWidth={1.8} />
              Web
            </button>
          </div>
          <div className="agw-center-toolbar-right">
            <button type="button" className="agw-toolbar-model" aria-label={t("ide.agent.model")}>
              <IconBolt size={10} strokeWidth={2.2} />
              3.0 Flash
              <IconChevron />
            </button>
            <button type="button" className="agw-toolbar-settings" aria-label={t("ide.agent.settings")}>
              <IconSettings size={12} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="agw-send-btn"
              onClick={handleSubmit}
              disabled={!input.trim()}
              aria-label={t("ide.agent.send")}
            >
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
