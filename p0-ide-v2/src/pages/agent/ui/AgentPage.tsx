import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/shared/lib";
import "./agent-page.css";
import {
  PROJECTS,
  CHANGED_FILES,
  createInitialSessions,
  pickResponse,
  makeId,
  STREAM_SPEED,
  type ChatMessage,
  type ChatSession,
} from "@/entities/agent";
import { renderMessageBody } from "../lib/markdown";

export function AgentPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(createInitialSessions);
  const [activeSessionId, setActiveSessionId] = useState("s8");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string>(CHANGED_FILES[0].path);
  const selectedFile = CHANGED_FILES.find((f) => f.path === selectedPath) ?? CHANGED_FILES[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamAbort = useRef(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, ChatSession[]>();
    for (const p of PROJECTS) map.set(p.id, []);
    for (const s of sessions) {
      if (!map.has(s.projectId)) map.set(s.projectId, []);
      map.get(s.projectId)!.push(s);
    }
    return map;
  }, [sessions]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const streamResponse = useCallback((sessionId: string, fullText: string) => {
    setStreaming(true);
    streamAbort.current = false;
    const agentMsgId = makeId();

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, { id: agentMsgId, role: "agent" as const, text: "", streaming: true }] }
          : s,
      ),
    );

    let charIdx = 0;
    const tick = () => {
      if (streamAbort.current) {
        setStreaming(false);
        return;
      }
      charIdx += 1 + Math.floor(Math.random() * 2);
      if (charIdx >= fullText.length) charIdx = fullText.length;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, text: fullText.slice(0, charIdx), streaming: charIdx < fullText.length }
                    : m,
                ),
              }
            : s,
        ),
      );

      if (charIdx < fullText.length) {
        setTimeout(tick, STREAM_SPEED + Math.random() * 8);
      } else {
        setStreaming(false);
      }
    };
    setTimeout(tick, 300 + Math.random() * 400);
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: ChatMessage = { id: makeId(), role: "user", text };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title: s.messages.length === 0 ? text.slice(0, 50) : s.title,
              time: "just now",
              messages: [...s.messages, userMsg],
            }
          : s,
      ),
    );

    const response = pickResponse(text);
    setTimeout(() => {
      streamResponse(activeSessionId, response);
    }, 100);
  }, [input, streaming, activeSessionId, streamResponse]);

  const handleNewSession = useCallback(() => {
    const id = `s-${makeId()}`;
    const newSession: ChatSession = {
      id,
      projectId: activeSession?.projectId ?? "home",
      title: "New chat",
      time: "now",
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    setInput("");
  }, [activeSession?.projectId]);

  return (
    <div className="agent-page">
      <aside className="agent-page__sidebar">
        <div className="agent-page__sidebar-top">
          <button type="button" className="agent-page__new-btn" onClick={handleNewSession}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Agent</span>
          </button>
          <button type="button" className="agent-page__nav-link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
            </svg>
            Marketplace
          </button>
        </div>

        <nav className="agent-page__sessions">
          {PROJECTS.map((p) => {
            const list = grouped.get(p.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={p.id} className="agent-page__group">
                <header className="agent-page__group-head">
                  {p.kind === "home" ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M3 12 12 3l9 9" />
                      <path d="M5 10v10h14V10" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                  )}
                  <span>{p.label}</span>
                </header>
                {list.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn("agent-page__session", activeSessionId === s.id && "is-active")}
                    onClick={() => setActiveSessionId(s.id)}
                  >
                    <span className="agent-page__session-title">{s.title}</span>
                  </button>
                ))}
              </section>
            );
          })}
        </nav>
      </aside>

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
              onClick={() => setRightOpen((v) => !v)}
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
                        {msg.streaming && <span className="agent-page__cursor">▊</span>}
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
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
            <button type="button" className="agent-page__send" onClick={handleSend} disabled={streaming || !input.trim()} aria-label="Send">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {rightOpen && (
        <aside className="agent-page__right" aria-label="Source control">
          <div className="agent-page__right-toolbar">
            <button type="button" className="agent-page__right-icon" aria-label="Branches">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <path d="M6 9v6a3 3 0 0 0 3 3h6" />
              </svg>
            </button>
            <button type="button" className="agent-page__right-icon" aria-label="Remote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
            </button>
            <button type="button" className="agent-page__right-icon" aria-label="Terminal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m4 7 5 5-5 5" />
                <path d="M12 17h8" />
              </svg>
            </button>
          </div>

          <div className="agent-page__right-branch">
            <span className="agent-page__right-chip">
              <span className="agent-page__chip-dot" />
              Local
            </span>
            <span className="agent-page__right-branch-name">{activeSession?.branch ?? "main"}</span>
            <button type="button" className="agent-page__right-cta">Create Branch &amp; Commit</button>
          </div>

          <div className="agent-page__right-changes">
            <div className="agent-page__right-changes-head">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="1" />
                <circle cx="4" cy="12" r="1" />
                <circle cx="4" cy="18" r="1" />
              </svg>
              <span className="agent-page__right-changes-label">3 Uncommitted Changes</span>
              <span className="agent-page__right-changes-stat">+1725</span>
            </div>

            <ul className="agent-page__right-file-list" role="listbox" aria-label="Changed files">
              {CHANGED_FILES.map((f) => (
                <li
                  key={f.path}
                  role="option"
                  aria-selected={selectedPath === f.path}
                  tabIndex={0}
                  className={cn("agent-page__right-file", selectedPath === f.path && "is-active")}
                  onClick={() => setSelectedPath(f.path)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPath(f.path); } }}
                >
                  <span className="agent-page__right-file-path">{f.path}</span>
                  <span className={cn("agent-page__right-file-badge", f.isNew && "agent-page__right-file-badge--add")}>{f.badge}</span>
                  <span className="agent-page__right-file-tag">{f.tag}</span>
                </li>
              ))}
            </ul>

            <div className="agent-page__right-diff">
              <div className="agent-page__right-diff-head">
                <span className="agent-page__right-diff-path">{selectedFile.path}</span>
                {selectedFile.isNew && <span className="agent-page__right-diff-chip">New</span>}
              </div>
              <pre className="agent-page__right-diff-body">
                {selectedFile.diff.map((line, i) => (
                  <div key={i} className={`diff-line diff-line--${line.kind}`}>
                    <span className="diff-line__num diff-line__num--old">{line.kind === "add" || line.kind === "hunk" ? "" : line.old ?? ""}</span>
                    <span className="diff-line__num diff-line__num--new">{line.kind === "del" || line.kind === "hunk" ? "" : line.new ?? ""}</span>
                    <span className="diff-line__sign">
                      {line.kind === "add" ? "+" : line.kind === "del" ? "-" : line.kind === "hunk" ? "@" : " "}
                    </span>
                    <span className="diff-line__text">{line.text || "\u00A0"}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
