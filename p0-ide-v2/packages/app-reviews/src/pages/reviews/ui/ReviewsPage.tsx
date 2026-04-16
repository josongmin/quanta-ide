import { cn } from "@quanta/ui-kit/lib";
import {
  prStore,
  usePrStore,
  STATUS_LABEL,
  type PRFilter,
  type PRStatus,
} from "@quanta/app-reviews/entities/proof-pr";
import "./reviews-page.css";
import { PRRow } from "./PRRow";
import { PRDetail } from "./PRDetail";

const FILTER_ORDER: PRFilter[] = ["all", "auto-merge-ready", "focus-risky", "full-review", "needs-proof"];

export function ReviewsPage() {
  const prs = usePrStore((s) => s.prs);
  const selectedId = usePrStore((s) => s.selectedId);
  const filter = usePrStore((s) => s.filter);

  const filtered = filter === "all" ? prs : prs.filter((pr) => pr.status === filter);
  const selected = prs.find((pr) => pr.id === selectedId) ?? filtered[0];

  const totals = {
    total: prs.length,
    autoMerge: prs.filter((p) => p.status === "auto-merge-ready").length,
    focus: prs.filter((p) => p.status === "focus-risky").length,
    full: prs.filter((p) => p.status === "full-review").length,
    needsProof: prs.filter((p) => p.status === "needs-proof").length,
  };

  return (
    <div className="rev-page">
      <header className="rev-header">
        <div className="rev-header__left">
          <span className="rev-header__kicker">Reviews</span>
          <span className="rev-header__title">Proof-carrying PR queue</span>
        </div>
        <div className="rev-header__meta">
          <span className="rev-header__stat">{totals.total} pending</span>
          <span className="rev-header__sep">&middot;</span>
          <span className="rev-header__stat">{totals.autoMerge} auto-merge</span>
          <span className="rev-header__sep">&middot;</span>
          <span className="rev-header__stat rev-header__stat--warn">{totals.focus} focus</span>
          <span className="rev-header__sep">&middot;</span>
          <span className="rev-header__stat rev-header__stat--danger">{totals.needsProof} needs proof</span>
        </div>
      </header>

      <div className="rev-page__pitch">
        <span className="rev-pitch__lead">Proof travels with every PR.</span>
        <span className="rev-pitch__body">
          Verified hunks are auto-approved; risky hunks get focused review. Engine proof attached as
          <code> .quanta-proof.json</code> and commit trailer.
        </span>
      </div>

      <div className="rev-body">
        <aside className="rev-list-col">
          <nav className="rev-filter" role="tablist">
            {FILTER_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={f === filter}
                className={cn("rev-filter__btn", f === filter && "is-active")}
                onClick={() => prStore.setFilter(f)}
              >
                {f === "all" ? "All" : STATUS_LABEL[f as PRStatus]}
              </button>
            ))}
          </nav>
          <ul className="rev-list">
            {filtered.map((pr) => (
              <PRRow
                key={pr.id}
                pr={pr}
                selected={pr.id === selected?.id}
                onSelect={() => prStore.select(pr.id)}
              />
            ))}
          </ul>
        </aside>

        {selected && <PRDetail pr={selected} />}
      </div>
    </div>
  );
}
