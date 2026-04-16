import { GitBranchIcon } from "../../lib/icons";

interface FileTreeHeaderProps {
  projectName: string;
  gitChangeCount: number;
  gitOpen: boolean;
  onOpenGit: () => void;
}

export function FileTreeHeader({ projectName, gitChangeCount, gitOpen, onOpenGit }: FileTreeHeaderProps) {
  return (
    <div className="ide-files-header">
      <div className="ide-files-project" title={projectName}>
        <span className="ide-files-project-emoji" aria-hidden="true">📦</span>
        <span className="ide-files-project-name">{projectName}</span>
      </div>
      <div className="ide-files-header-sep" />
      <button
        type="button"
        className="ide-files-git-btn"
        onClick={onOpenGit}
        aria-haspopup="dialog"
        aria-expanded={gitOpen}
        aria-label="Git changes"
        title="Git changes"
      >
        <GitBranchIcon />
        {gitChangeCount > 0 ? <span className="ide-files-git-btn-count">{gitChangeCount}</span> : null}
      </button>
    </div>
  );
}
