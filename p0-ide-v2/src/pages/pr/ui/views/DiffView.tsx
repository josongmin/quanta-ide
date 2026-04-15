import {
  SEV_META,
  riskBand,
  type FileDiff,
  type Finding,
  type ReviewComment,
} from "@/entities/pr";

export function DiffView({
  file,
  findings,
  reviews,
}: {
  file: FileDiff;
  findings: Finding[];
  reviews: ReviewComment[];
}) {
  if (file.hunks.length === 0) {
    return (
      <div className="pr-page__diff-empty">
        <div className="pr-page__diff-empty-icon">···</div>
        <p>This file isn't loaded in the view yet. Pick another file from the left.</p>
      </div>
    );
  }
  return (
    <div className="pr-page__diff">
      <header className="pr-page__diff-head">
        <span className={`pr-page__file-st pr-page__file-st--${file.status}`}>{file.status}</span>
        <span className="pr-page__diff-path">{file.path}</span>
        <span className="pr-page__diff-nums">
          <span className="pr-page__add">+{file.added}</span>
          <span className="pr-page__rm">−{file.removed}</span>
        </span>
        <span className={`pr-page__diff-risk pr-page__diff-risk--${riskBand(file.risk)}`}>
          Risk {file.risk.toFixed(2)}
        </span>
      </header>
      <div className="pr-page__diff-body">
        {file.hunks.map((hunk, hi) => (
          <div key={hi} className="pr-page__hunk">
            {hunk.map((line, li) => {
              const finding = line.inlineFinding ? findings.find((f) => f.id === line.inlineFinding) : undefined;
              const review = line.inlineReview ? reviews.find((r) => r.id === line.inlineReview) : undefined;
              return (
                <div key={li}>
                  <div className={`pr-page__row pr-page__row--${line.kind}`}>
                    <span className="pr-page__gutter pr-page__gutter--l">{line.ln ?? ""}</span>
                    <span className="pr-page__gutter pr-page__gutter--r">{line.rn ?? ""}</span>
                    <span className="pr-page__mark">
                      {line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}
                    </span>
                    <span className="pr-page__code">{line.text}</span>
                    {finding && (
                      <span className={`pr-page__inline-pip pr-page__inline-pip--${finding.sev}`}>
                        {SEV_META[finding.sev].label}
                      </span>
                    )}
                    {review && <span className="pr-page__inline-pip pr-page__inline-pip--review">Review</span>}
                  </div>
                  {finding && !finding.applied && (
                    <div className={`pr-page__inline-panel pr-page__inline-panel--${finding.sev}`}>
                      <div className="pr-page__inline-panel-head">
                        <span className={`pr-page__finding-sev pr-page__finding-sev--${finding.sev}`}>
                          {SEV_META[finding.sev].label}
                        </span>
                        <span className="pr-page__inline-rule">{finding.rule}</span>
                      </div>
                      <div className="pr-page__inline-panel-title">{finding.title}</div>
                      <p className="pr-page__inline-panel-detail">{finding.detail}</p>
                    </div>
                  )}
                  {review && !review.resolved && (
                    <div className="pr-page__inline-panel pr-page__inline-panel--review">
                      <div className="pr-page__inline-panel-head">
                        <span className="pr-page__review-av">{review.avatar}</span>
                        <span className="pr-page__review-author">{review.author}</span>
                        <span className="pr-page__review-when">{review.when}</span>
                      </div>
                      <p className="pr-page__inline-panel-detail">{review.body}</p>
                      {review.suggestion && (
                        <pre className="pr-page__review-suggest">
                          <code>{review.suggestion}</code>
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
