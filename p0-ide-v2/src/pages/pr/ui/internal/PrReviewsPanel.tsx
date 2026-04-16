import { cn } from "@/shared/lib";
import type { ReviewComment } from "@/entities/pr";
import { IconComment, IconCheck, IconMagic } from "../../lib/icons";

export function PrReviewsPanel({
  reviews,
  openReviews,
  applyReview,
  resolveReview,
}: {
  reviews: ReviewComment[];
  openReviews: ReviewComment[];
  applyReview: (id: number) => void;
  resolveReview: (id: number) => void;
}) {
  return (
    <section className="pr-page__panel">
      <header className="pr-page__panel-head">
        <div className="pr-page__panel-title">
          <IconComment />
          Review comments
        </div>
        <span className="pr-page__panel-count">
          {openReviews.length}/{reviews.length}
        </span>
      </header>

      <div className="pr-page__reviews">
        {reviews.map((r) => (
          <article
            key={r.id}
            className={cn("pr-page__review", r.resolved && "is-resolved", r.applied && "is-applied")}
          >
            <header className="pr-page__review-head">
              <span className="pr-page__review-av">{r.avatar}</span>
              <span className="pr-page__review-author">{r.author}</span>
              <span className="pr-page__review-when">{r.when}</span>
            </header>
            <div className="pr-page__review-loc">
              {r.path.split("/").slice(-1)[0]}:{r.line}
            </div>
            <p className="pr-page__review-body">{r.body}</p>
            {r.suggestion && (
              <pre className="pr-page__review-suggest">
                <code>{r.suggestion}</code>
              </pre>
            )}
            <footer className="pr-page__review-foot">
              {r.applied ? (
                <span className="pr-page__review-ok">
                  <IconCheck /> Auto-applied
                </span>
              ) : r.suggestion ? (
                <button type="button" className="pr-page__apply-btn" onClick={() => applyReview(r.id)}>
                  <IconMagic /> Auto-apply patch
                </button>
              ) : (
                <button type="button" className="pr-page__review-resolve" onClick={() => resolveReview(r.id)}>
                  Mark resolved
                </button>
              )}
              <button type="button" className="pr-page__review-reply">Reply</button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
