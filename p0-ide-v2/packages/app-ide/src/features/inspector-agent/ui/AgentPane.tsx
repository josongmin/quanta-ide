import { renderMessageBody } from "@quanta/app-ide/entities/agent-chat";
import { useAgentChat } from "../model/use-agent-chat";
import "./agent-pane.css";

const QUICK_PROMPTS = [
  "Why is this file high risk?",
  "Explain the taint flow",
  "Find dead code",
];

interface AgentPaneProps {
  fileName: string;
  onPopout?: () => void;
  poppedOut?: boolean;
}

export function AgentPane({ fileName, onPopout, poppedOut }: AgentPaneProps) {
  const chat = useAgentChat();

  return (
    <div className="agent-pane">
      {/* Tab bar */}
      <div className="agent-pane__tabbar">
        <div className="agent-pane__tabs">
          {chat.sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`agent-pane__tab${s.id === chat.activeId ? " is-active" : ""}`}
              onClick={() => chat.selectSession(s.id)}
            >
              {/* chat icon */}
              <svg className="agent-pane__tab-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="agent-pane__tab-title">{s.title}</span>
              <span
                className="agent-pane__tab-close"
                role="button"
                tabIndex={0}
                aria-label="Close session"
                onClick={(e) => {
                  e.stopPropagation();
                  chat.closeSession(s.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.stopPropagation(); chat.closeSession(s.id); }
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        <div className="agent-pane__tabbar-actions">
          {/* New session */}
          <button type="button" className="agent-pane__tabbar-btn" aria-label="New session" onClick={chat.newSession}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {/* History */}
          <button type="button" className="agent-pane__tabbar-btn" aria-label="History">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          {/* More */}
          <button type="button" className="agent-pane__tabbar-btn" aria-label="More options">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {/* Popout / dock */}
          {!poppedOut && onPopout && (
            <button type="button" className="agent-pane__tabbar-btn" aria-label="Open in window" onClick={onPopout}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="agent-pane__messages">
        {chat.messages.length === 0 ? (
          <div className="agent-pane__empty">
            <div className="agent-pane__empty-glyph">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="9" y1="21" x2="15" y2="21" />
                <line x1="10" y1="17" x2="10" y2="21" />
                <line x1="14" y1="17" x2="14" y2="21" />
              </svg>
            </div>
            <span className="agent-pane__empty-text">Ask about {fileName}</span>
            <div className="agent-pane__prompts">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="agent-pane__prompt-chip"
                  onClick={() => chat.fillInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="agent-pane__thread">
            {chat.messages.map((msg) => (
              <div key={msg.id} className={`agent-pane__msg agent-pane__msg--${msg.role}`}>
                {msg.role === "user" ? (
                  <div className="agent-pane__user-bubble">{msg.text}</div>
                ) : (
                  <>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="agent-pane__tools">
                        {msg.toolCalls.map((tc, i) => (
                          <div key={i} className="agent-pane__tool">
                            <span className="agent-pane__tool-icon">
                              {tc.status === "done" ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <span className="agent-pane__tool-spin" />
                              )}
                            </span>
                            <span className="agent-pane__tool-name">{tc.name}</span>
                            {tc.file && <span className="agent-pane__tool-file">{tc.file}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.elapsed !== undefined && (
                      <div className="agent-pane__meta">
                        <span>Worked for {msg.elapsed}s</span>
                      </div>
                    )}
                    <div className="agent-pane__body">
                      {renderMessageBody(msg.text)}
                      {msg.streaming && <span className="agent-pane__cursor">&#x2588;</span>}
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={chat.endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="agent-pane__composer">
        <div className="agent-pane__input-wrap">
          <textarea
            ref={chat.inputRef}
            className="agent-pane__input"
            placeholder="Ask agent..."
            aria-label="Agent message"
            rows={1}
            value={chat.input}
            onChange={(e) => chat.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chat.handleSend();
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
            }}
            disabled={chat.streaming}
          />
          <button
            type="button"
            className="agent-pane__send"
            onClick={chat.handleSend}
            disabled={chat.streaming || !chat.input.trim()}
            aria-label="Send"
          >
            {chat.streaming ? (
              <span className="agent-pane__send-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
