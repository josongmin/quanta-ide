import { cn } from "@quanta/ui-kit/lib";
import { PROJECTS, type ChatSession } from "@quanta/app-agent/entities/agent";

export function AgentSessionSidebar({
  grouped,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: {
  grouped: Map<string, ChatSession[]>;
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}) {
  return (
    <aside className="agent-page__sidebar">
      <div className="agent-page__sidebar-top">
        <button type="button" className="agent-page__new-btn" onClick={onNewSession}>
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
                  onClick={() => onSelectSession(s.id)}
                >
                  <span className="agent-page__session-title">{s.title}</span>
                </button>
              ))}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
