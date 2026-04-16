import type { PatchTrailEntry } from "./SuggestionOverlay.types";

// ── Topic ③ · Patch trail (session history for this symbol) ──────────
export function PatchTrail({ entries }: { entries: PatchTrailEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="ptrail">
      <header className="ptrail__h">
        <span className="ptrail__label">Patch trail</span>
        <span className="ptrail__count">{entries.length} previous</span>
      </header>
      <ul className="ptrail__list">
        {entries.map((e) => {
          const delta = e.riskBefore - e.riskAfter;
          return (
            <li key={e.id} className={`ptrail__row ptrail__row--${e.action}`}>
              <span className="ptrail__icon" aria-hidden>
                {e.action === "applied" ? "✓" : e.action === "dismissed" ? "×" : "↺"}
              </span>
              <div className="ptrail__text">
                <span className="ptrail__title" title={e.title}>{e.title}</span>
                {e.reason && <span className="ptrail__reason">{e.reason}</span>}
              </div>
              <span className="ptrail__delta">
                <span className="ptrail__delta-num">{e.riskBefore}</span>
                <span className="ptrail__delta-arrow">→</span>
                <span className="ptrail__delta-num ptrail__delta-num--after">{e.riskAfter}</span>
                {delta > 0 && <span className="ptrail__delta-saved">−{delta}</span>}
              </span>
              <span className="ptrail__meta">
                {e.author && <span className="ptrail__author">{e.author}</span>}
                <span className="ptrail__when">{e.when}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
