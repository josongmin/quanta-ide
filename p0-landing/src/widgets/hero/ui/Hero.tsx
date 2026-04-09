import { useRepoSelection } from "@/features/repo-modal/model/useRepoSelection";

export function Hero() {
  const { current, open, repo } = useRepoSelection();

  return (
    <main className="hero" id="hero">
      <div className="hero-copy">
        <h1>
          Stop explaining your codebase.
          <br />
          <span className="hero-line2">Let <em>p0</em> read it.</span>
        </h1>
        <p className="sub">
          Every other agent starts from a blank slate. p0 starts from your system.
          <br />
          No ticket-writing. No context dumps. Just results that hold together.
        </p>
        <div className="repo-select">
          <span className="repo-select-label">Stress test p0 on</span>
          <button type="button" className="repo-select-trigger" onClick={open} aria-haspopup="dialog">
            <span className="repo-select-dot" style={{ "--dot": repo.color } as React.CSSProperties} />
            <span className="repo-select-name">{current}</span>
            <svg className="repo-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      </div>
    </main>
  );
}
