export function QuickActions() {
  return (
    <div className="hp__quick">
      <div className="hp__quick-bar">
        <svg className="hp__quick-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="hp__quick-input"
          placeholder="Search repos, run commands, ask engine..."
          aria-label="Quick actions"
        />
        <kbd className="hp__quick-kbd">⌘ K</kbd>
      </div>
    </div>
  );
}
