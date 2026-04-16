import type { RefObject } from "react";
import { cn } from "@quanta/ui-kit/lib";
import { PROJECTS, type ChatMessage, type ChatSession } from "@quanta/app-agent/entities/agent";
import { renderMessageBody } from "../lib/markdown";

export function AgentChatArea({
  activeSession,
  messages,
  input,
  streaming,
  rightOpen,
  messagesEndRef,
  onInputChange,
  onSend,
  onToggleRight,
}: {
  activeSession: ChatSession | undefined;
  messages: ChatMessage[];
  input: string;
  streaming: boolean;
  rightOpen: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onToggleRight: () => void;
}) {
  return (
    <main className="agent-page__main">
      <header className="agent-page__header">
        <div className="agent-page__header-title">
          <span className="agent-page__header-crumb">{activeSession ? PROJECTS.find((p) => p.id === activeSession.projectId)?.label : ""}</span>
          <span className="agent-page__header-sep">/</span>
          <span className="agent-page__header-name">{activeSession?.title ?? "New Agent"}</span>
        </div>
        <div className="agent-page__header-actions">
          <button
            type="button"
            className={cn("agent-page__panel-toggle", rightOpen && "is-active")}
            onClick={onToggleRight}
            aria-label="Toggle right panel"
            aria-pressed={rightOpen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          </button>
        </div>
      </header>

      <div className="agent-page__messages">
        {messages.length === 0 ? (
          <div className="agent-page__empty">
            <div className="agent-page__empty-icon">p0</div>
            <p>Ask anything about your codebase.</p>
          </div>
        ) : (
          <div className="agent-page__thread">
            {messages.map((msg) => (
              <div key={msg.id} className={`agent-page__msg agent-page__msg--${msg.role}`}>
                {msg.role === "user" ? (
                  <div className="agent-page__user-msg">{msg.text}</div>
                ) : (
                  <>
                    <div className="agent-page__msg-meta">
                      <span className="agent-page__msg-meta-row">Worked for 35s</span>
                      <span className="agent-page__msg-meta-row is-muted">Thought briefly</span>
                    </div>
                    <div className="agent-page__msg-body">
                      {renderMessageBody(msg.text)}
                      {msg.streaming && <span className="agent-page__cursor">&#x2588;</span>}
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="agent-page__composer">
        <div className="agent-page__input-bar">
          <button type="button" className="agent-page__input-add" aria-label="Attach">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <input
            className="agent-page__input"
            type="text"
            placeholder="Send follow-up"
            aria-label="Agent message"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={streaming}
          />
          <div className="agent-page__composer-tag">
            <span>Composer 2</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <button type="button" className="agent-page__send" onClick={onSend} disabled={streaming || !input.trim()} aria-label="Send">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
