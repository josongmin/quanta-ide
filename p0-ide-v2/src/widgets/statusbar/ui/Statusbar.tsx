import { useGitWorkspaceBranch } from "@/shared/model/git-workspace";
import "./statusbar.css";

function BranchGlyph({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="4" cy="3" r="1.4" />
      <circle cx="4" cy="13" r="1.4" />
      <circle cx="12" cy="6" r="1.4" />
      <path d="M4 4.4v7" />
      <path d="M12 7.4v.5a3 3 0 0 1-3 3H6" />
    </svg>
  );
}

export function Statusbar() {
  const branch = useGitWorkspaceBranch();
  return (
    <footer className="statusbar" role="status">
      <div className="statusbar__left">
        <span className="dot dot--ok" />
        <span className="statusbar__branch" title="Current branch">
          <BranchGlyph />
          <span>{branch}</span>
        </span>
        <span className="sep">·</span>
        <span>Python 3.12</span>
      </div>
      <div className="statusbar__right">
        <span>Ln 12, Col 8</span>
        <span className="sep">·</span>
        <span>UTF-8</span>
        <span className="sep">·</span>
        <span>LF</span>
      </div>
    </footer>
  );
}
