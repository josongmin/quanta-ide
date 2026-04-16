import { activeWorkItems, type ActiveWorkItem, type WorkStatus } from "../../lib/home-picker.mock";

const STATUS_LABEL: Record<WorkStatus, string> = {
  draft: "Draft",
  open: "Open",
  reviewing: "In review",
  approved: "Approved",
  "changes-requested": "Changes",
};

export function ActiveWork() {
  return (
    <section className="hp__panel">
      <div className="hp__panel-head">
        <span className="hp__panel-label">Active work</span>
        <span className="hp__panel-count">{activeWorkItems.length}</span>
      </div>
      <ul className="hp__work-list">
        {activeWorkItems.map((item) => (
          <WorkRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function WorkRow({ item }: { item: ActiveWorkItem }) {
  const total = item.checks.pass + item.checks.fail + item.checks.pending;
  const allPass = total > 0 && item.checks.fail === 0 && item.checks.pending === 0;
  const hasFail = item.checks.fail > 0;

  return (
    <li className="hp__work-item" tabIndex={0}>
      <span className="hp__work-top">
        <span className={`hp__work-status hp__work-status--${item.status}`}>
          {STATUS_LABEL[item.status]}
        </span>
        <span className="hp__work-title">
          <span className="hp__work-number">#{item.number}</span> {item.title}
        </span>
      </span>
      <span className="hp__work-bottom">
        <span className="hp__work-repo">{item.repo}</span>
        <span className="hp__work-branch">
          <BranchIcon />
          {item.branch}
        </span>
        {total > 0 && (
          <span className={`hp__work-checks ${allPass ? "hp__work-checks--pass" : ""} ${hasFail ? "hp__work-checks--fail" : ""}`}>
            <CheckIcon pass={allPass} fail={hasFail} />
            {item.checks.pass}/{total}
          </span>
        )}
        {item.violations > 0 && (
          <span className="hp__work-violations">
            <ViolationIcon />
            {item.violations}
          </span>
        )}
        <span className="hp__work-time">{item.updatedAt}</span>
      </span>
    </li>
  );
}

function BranchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function CheckIcon({ pass, fail }: { pass: boolean; fail: boolean }) {
  if (fail) {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pass ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ViolationIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
