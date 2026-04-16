import { cn } from "@quanta/ui-kit/lib";
import { CHANGED_FILES, type ChatSession } from "@quanta/app-agent/entities/agent";

export function AgentSourcePanel({
  activeSession,
  selectedPath,
  onSelectPath,
}: {
  activeSession: ChatSession | undefined;
  selectedPath: string;
  onSelectPath: (path: string) => void;
}) {
  const selectedFile = CHANGED_FILES.find((f) => f.path === selectedPath) ?? CHANGED_FILES[0];

  return (
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
              onClick={() => onSelectPath(f.path)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectPath(f.path); } }}
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
  );
}
