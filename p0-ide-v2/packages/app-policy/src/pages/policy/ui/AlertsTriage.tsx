import { cn } from "@quanta/ui-kit/lib";
import type { ViolationStatus } from "@quanta/domain-types/policies";
import { VIOLATION_STATUS_LABEL, SEVERITY_LABEL } from "@quanta/domain-types/policies";
import { policyStore, usePolicyStore } from "@quanta/app-policy/entities/policy";
import { severityClass, violationStatusClass, relativeTime } from "../lib/policy-page.utils";

const STATUS_TABS: (ViolationStatus | "all")[] = [
  "all", "open", "accepted-risk", "exception-requested", "fixed", "waived",
];

const TRIAGE_ACTIONS: { status: ViolationStatus; label: string }[] = [
  { status: "accepted-risk", label: "Accept risk" },
  { status: "exception-requested", label: "Request exception" },
  { status: "fixed", label: "Mark fixed" },
  { status: "waived", label: "Waive" },
];

export function AlertsTriage() {
  const filters = usePolicyStore((s) => s.filters);
  const selectedId = usePolicyStore((s) => s.selectedViolationId);
  const allViolations = usePolicyStore((s) => s.violations);
  const violations = policyStore.filteredViolations();
  const selected = violations.find((v) => v.id === selectedId) ?? null;

  function countForStatus(s: ViolationStatus | "all") {
    if (s === "all") return allViolations.length;
    return allViolations.filter((v) => v.status === s).length;
  }

  return (
    <div className="pol-catalog">
      {/* Header */}
      <header className="pol-catalog__header">
        <div className="pol-catalog__header-left">
          <span className="pol-catalog__kicker">Alerts & Triage</span>
          <span className="pol-catalog__title">Violation Findings</span>
        </div>
      </header>

      {/* Status filter tabs */}
      <div className="pol-viol-tabs">
        {STATUS_TABS.map((s) => {
          const count = countForStatus(s);
          return (
            <button
              key={s}
              type="button"
              className={cn("pol-viol-tab", filters.violationStatus === s && "is-active")}
              onClick={() => policyStore.setViolationStatusFilter(s)}
            >
              {s === "all" ? "All" : VIOLATION_STATUS_LABEL[s]}
              <span className="pol-viol-tab__count">({count})</span>
            </button>
          );
        })}
      </div>

      {/* List / Detail split */}
      <div className="pol-split">
        <div className="pol-split__list">
          {violations.length === 0 ? (
            <div className="pol-split__empty">No violations match filter</div>
          ) : (
            violations.map((v) => {
              const loc = v.line ? `${v.file}:${v.line}` : v.file;
              return (
                <div
                  key={v.id}
                  className={cn("pol-viol-row", v.id === selectedId && "is-selected")}
                  onClick={() => policyStore.selectViolation(v.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") policyStore.selectViolation(v.id);
                  }}
                >
                  <span className="pol-viol-row__loc">{loc}</span>
                  <span className="pol-viol-row__rule">{v.ruleName}</span>
                  <span className={cn("pol-sev", severityClass(v.severity))}>{SEVERITY_LABEL[v.severity]}</span>
                  <span className={cn("pol-vs", violationStatusClass(v.status))}>{VIOLATION_STATUS_LABEL[v.status]}</span>
                </div>
              );
            })
          )}
        </div>

        {selected ? (
          <div className="pol-split__detail">
            <h2 className="pol-detail__title">{selected.ruleName}</h2>

            <div className="pol-detail__row">
              <span className="pol-detail__label">File</span>
              <span className="pol-detail__value" style={{ fontFamily: "var(--font-mono)" }}>
                {selected.line ? `${selected.file}:${selected.line}` : selected.file}
              </span>
            </div>
            <div className="pol-detail__row">
              <span className="pol-detail__label">Severity</span>
              <span className={cn("pol-sev", severityClass(selected.severity))}>{SEVERITY_LABEL[selected.severity]}</span>
            </div>
            <div className="pol-detail__row">
              <span className="pol-detail__label">Status</span>
              <span className={cn("pol-vs", violationStatusClass(selected.status))}>{VIOLATION_STATUS_LABEL[selected.status]}</span>
            </div>
            <div className="pol-detail__row">
              <span className="pol-detail__label">Repo</span>
              <span className="pol-detail__value">{selected.repo}</span>
            </div>
            {selected.service && (
              <div className="pol-detail__row">
                <span className="pol-detail__label">Service</span>
                <span className="pol-detail__value">{selected.service}</span>
              </div>
            )}
            <div className="pol-detail__row">
              <span className="pol-detail__label">Detected</span>
              <span className="pol-detail__value">{relativeTime(selected.detectedAt)}</span>
            </div>
            {selected.assignee && (
              <div className="pol-detail__row">
                <span className="pol-detail__label">Assignee</span>
                <span className="pol-detail__value">{selected.assignee}</span>
              </div>
            )}
            {selected.linkedPR && (
              <div className="pol-detail__row">
                <span className="pol-detail__label">Linked PR</span>
                <span className="pol-detail__value" style={{ fontFamily: "var(--font-mono)" }}>{selected.linkedPR}</span>
              </div>
            )}

            <p className="pol-detail__desc">{selected.message}</p>

            {selected.snippet && <pre className="pol-snippet">{selected.snippet}</pre>}

            {selected.suggestedFix && (
              <>
                <span className="pol-detail__section-label">Suggested fix</span>
                <p className="pol-detail__desc">{selected.suggestedFix}</p>
              </>
            )}

            <div className="pol-detail__actions">
              {TRIAGE_ACTIONS.filter((a) => a.status !== selected.status).map((action) => (
                <button
                  key={action.status}
                  type="button"
                  className="pol-btn pol-btn--ghost"
                  onClick={() => policyStore.setViolationStatus(selected.id, action.status)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pol-split__empty">Select a violation to view details</div>
        )}
      </div>
    </div>
  );
}
