import { recents } from "../../lib/home-picker.mock";
import { InsightViz } from "./InsightViz";
import { Sparkbar, BranchIcon } from "./Sparkbar";

export function RecentList() {
  return (
    <section className="hp__section">
      <div className="hp__section-head">
        <span className="hp__section-label">Recent</span>
        <div className="hp__search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search repositories" aria-label="Search repositories" />
          <kbd className="hp__search-kbd">⌘ K</kbd>
        </div>
      </div>

      <ul className="hp__list">
        {recents.map((r) => (
          <li key={r.name} className="hp__row" tabIndex={0}>
            <span className="hp__row-thumb" aria-hidden>
              {r.name.charAt(0).toUpperCase()}
            </span>
            <span className="hp__row-name">
              <span className="hp__row-name-text">{r.name}</span>
              <InsightViz insight={r.insight} />
            </span>
            <span className="hp__row-branch">
              <BranchIcon />
              {r.branch}
            </span>
            <Sparkbar values={r.spark} />
            <span className={`hp__row-status hp__row-status--${r.status}`}>
              <span className="hp__row-status-dot" aria-hidden />
              {r.status === "clean"
                ? "clean"
                : r.status === "review"
                  ? `${r.changes} in review`
                  : `${r.changes} ${r.changes === 1 ? "change" : "changes"}`}
            </span>
            <span className="hp__row-time">{r.time}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
