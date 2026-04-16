import { gitWorkspaceStore } from "@quanta/app-ide/stores/git-workspace";

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function GitFileBlock({
  title,
  count,
  emptyHint,
  files,
  busy,
  onOpen,
  mode,
}: {
  title: string;
  count: number;
  emptyHint: string;
  files: { id: string; path: string; letter: string; staged: boolean }[];
  busy: boolean;
  onOpen: (path: string) => void;
  mode: "staged" | "unstaged";
}) {
  return (
    <section className="git-panel__section" aria-label={title}>
      <header className="git-panel__section-head">
        <span className="git-panel__section-title">{title}</span>
        {count > 0 && <span className="git-panel__section-count">{count}</span>}
      </header>
      {files.length === 0 ? (
        <p className="git-panel__section-empty">{emptyHint}</p>
      ) : (
        <ul className="git-panel__file-list">
          {files.map((f) => (
            <li key={f.id} className="git-panel__file-li">
              <button type="button" className="git-panel__file-main" onClick={() => onOpen(f.path)} title={f.path}>
                <span
                  className={`git-panel__letter git-panel__letter--${f.letter === "?" ? "unknown" : f.letter.toLowerCase()}`}
                >
                  {f.letter}
                </span>
                <span className="git-panel__file-path">{f.path}</span>
              </button>
              <span className="git-panel__file-actions">
                {mode === "unstaged" && (
                  <button type="button" className="git-panel__mini" disabled={busy} title="Stage" aria-label={`Stage ${basename(f.path)}`} onClick={() => gitWorkspaceStore.staging.stageFile(f.id)}>
                    +
                  </button>
                )}
                {mode === "staged" && (
                  <button type="button" className="git-panel__mini" disabled={busy} title="Unstage" aria-label={`Unstage ${basename(f.path)}`} onClick={() => gitWorkspaceStore.staging.unstageFile(f.id)}>
                    −
                  </button>
                )}
                {mode === "unstaged" && (
                  <button type="button" className="git-panel__mini git-panel__mini--danger" disabled={busy} title="Discard" aria-label={`Discard ${basename(f.path)}`} onClick={() => gitWorkspaceStore.staging.discardFile(f.id)}>
                    ×
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
