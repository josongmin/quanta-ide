import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/shared/ui";
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
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              App
            </button>
            <button type="button" className="agw-toolbar-model" aria-label="웹">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="9" x2="22" y2="9" />
              </svg>
              Web
            </button>
          </div>
          <div className="agw-center-toolbar-right">
            <button type="button" className="agw-toolbar-model" aria-label="모델">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              3.0 Flash
              <IconChevron />
            </button>
            <button type="button" className="agw-toolbar-settings" aria-label="설정">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                <circle cx="12" cy="12" r="4" />
              </svg>
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
