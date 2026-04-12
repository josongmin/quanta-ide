import { useEffect, useRef, useState } from "react";
import { IconBolt, IconGlobe, IconGrid2x2, IconSettings, Textarea } from "@/shared/ui";
import { useAgentWindow } from "../model/useAgentWindow";
import { IconChevron, IconPlus, IconSend } from "./icons";

/* augment window for pending query handoff */
declare global {
  interface Window { __agentPendingQuery?: string; }
}

export function CenterPromptBar() {
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
            <button type="button" className="agw-toolbar-btn" aria-label="추가"><IconPlus /></button>
            <button type="button" className="agw-toolbar-model" aria-label="앱">
              <IconGrid2x2 size={11} strokeWidth={1.8} />
              App
            </button>
            <button type="button" className="agw-toolbar-model" aria-label="웹">
              <IconGlobe size={11} strokeWidth={1.8} />
              Web
            </button>
          </div>
          <div className="agw-center-toolbar-right">
            <button type="button" className="agw-toolbar-model" aria-label="모델">
              <IconBolt size={10} strokeWidth={2.2} />
              3.0 Flash
              <IconChevron />
            </button>
            <button type="button" className="agw-toolbar-settings" aria-label="설정">
              <IconSettings size={12} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="agw-send-btn"
              onClick={handleSubmit}
              disabled={!input.trim()}
              aria-label="전송"
            >
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
