import { gitWorkspaceStore, type StackedBranch } from "@quanta/app-ide/stores/git-workspace";
import { IconChevDownTiny } from "../../lib/icons";

export function StackPrCheckoutCard({
  sel,
  busy,
  onOpenFile,
}: {
  sel: StackedBranch;
  busy: boolean;
  onOpenFile: (path: string) => void;
}) {
  const prLabel = sel.prNumber != null ? `#${sel.prNumber}` : "\u2014";
  const nFiles = Math.max(1, sel.touchedFiles.length);
  const riskFrom = Math.min(99, 38 + sel.name.length * 2 + sel.depth * 6);
  const riskTo = Math.max(4, 10 - sel.depth * 2);
  const confidence = (0.93 - sel.depth * 0.015).toFixed(2);
  const primaryFile = sel.touchedFiles[0] ?? "workspace";
  const codeSnippet = `+ git fetch origin ${sel.name}\n+ git checkout ${sel.name}\n  # sync ${primaryFile}`;

  return (
    <article
      className="git-checkout-card"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || busy) return;
        if ((e.target as HTMLElement).closest("button")) return;
        e.preventDefault();
        gitWorkspaceStore.checkoutStackBranch(sel.id);
      }}
      aria-label={`Pull request checkout: ${sel.name}`}
    >
      <header className="git-checkout-card__head">
        <span className="git-checkout-card__kicker">PR checkout</span>
        <IconChevDownTiny className="git-checkout-card__head-chev" />
      </header>
      <h3 className="git-checkout-card__title">Switch working tree to branch for review</h3>
      <pre className="git-checkout-card__code">
        <code>{codeSnippet}</code>
      </pre>
      <div className="git-checkout-card__meta">
        <div className="git-checkout-card__meta-cell">
          <span className="git-checkout-card__meta-k">Risk</span>
          <span className="git-checkout-card__meta-v">
            {riskFrom} → {riskTo}
          </span>
        </div>
        <div className="git-checkout-card__meta-cell">
          <span className="git-checkout-card__meta-k">Confidence</span>
          <span className="git-checkout-card__meta-v">{confidence}</span>
        </div>
        <div className="git-checkout-card__meta-cell">
          <span className="git-checkout-card__meta-k">Affects</span>
          <span className="git-checkout-card__meta-v">
            {nFiles} file{nFiles === 1 ? "" : "s"}
            {sel.prNumber != null ? ` \u00B7 ${prLabel}` : ""}
          </span>
        </div>
      </div>
      {sel.touchedFiles.length > 0 && (
        <ul className="git-checkout-card__files">
          {sel.touchedFiles.map((p) => (
            <li key={p}>
              <button type="button" className="git-checkout-card__file-link" onClick={() => onOpenFile(p)}>
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer className="git-checkout-card__actions">
        <button type="button" className="git-checkout-card__dismiss" onClick={() => gitWorkspaceStore.selectStackBranch(null)}>
          Dismiss
          <kbd className="git-checkout-card__kbd git-checkout-card__kbd--muted">Esc</kbd>
        </button>
        <button type="button" className="git-checkout-card__apply" disabled={busy} onClick={() => gitWorkspaceStore.checkoutStackBranch(sel.id)}>
          Check out
          <kbd className="git-checkout-card__kbd git-checkout-card__kbd--on-accent">Enter</kbd>
        </button>
      </footer>
    </article>
  );
}
