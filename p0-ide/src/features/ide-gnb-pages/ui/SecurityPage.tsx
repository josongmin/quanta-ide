import { getComplianceFromDB } from "@/app/ide/analysis-data";
import { severityVariant, statusVariant } from "@/shared/model/severityMap";

const COMPLIANCE = getComplianceFromDB();
const FAIL_COUNT = COMPLIANCE.filter((c) => c.verdict === "fail").length;
const WARN_COUNT = COMPLIANCE.filter((c) => c.verdict === "warn").length;
const PASS_COUNT = COMPLIANCE.filter((c) => c.verdict === "pass").length;

const TAINT_FLOWS = [
  { id: 1, sourceSymbol: "request.strategy", sinkSymbol: "experience_store.save", sourceFile: "orchestrator.py", sourceLine: 28, sinkFile: "orchestrator.py", sinkLine: 86, severity: "critical" as const, sanitized: false },
  { id: 2, sourceSymbol: "payload.body", sinkSymbol: "db.rawQuery", sourceFile: "webhook.py", sourceLine: 12, sinkFile: "ledger.py", sinkLine: 45, severity: "critical" as const, sanitized: false },
  { id: 3, sourceSymbol: "config.policy_name", sinkSymbol: "strategy_selector", sourceFile: "routing_policy.py", sourceLine: 8, sinkFile: "orchestrator.py", sinkLine: 42, severity: "high" as const, sanitized: false },
  { id: 4, sourceSymbol: "request.amount", sinkSymbol: "ledger.credit", sourceFile: "fee.py", sourceLine: 15, sinkFile: "ledger.py", sinkLine: 78, severity: "high" as const, sanitized: true },
  { id: 5, sourceSymbol: "task.params", sinkSymbol: "execute", sourceFile: "retry_handler.py", sourceLine: 22, sinkFile: "orchestrator.py", sinkLine: 64, severity: "medium" as const, sanitized: false },
];

const INCIDENTS = [
  { id: "INC-2024-0312", title: "Double refund via retry loop", severity: "P0" as const, rootFile: "orchestrator.py", rootLine: 73, status: "open" as const },
  { id: "INC-2024-0298", title: "Unsanitized webhook payload to ledger", severity: "P1" as const, rootFile: "webhook.py", rootLine: 39, status: "investigating" as const },
  { id: "INC-2024-0287", title: "Strategy injection via unvalidated config", severity: "P2" as const, rootFile: "routing_policy.py", rootLine: 8, status: "resolved" as const },
];

export function SecurityPage() {
  return (
    <div className="gnb-page gnb-security">
      <div className="gnb-page-header">
        <h2 className="gnb-page-title">Security</h2>
        <p className="gnb-page-subtitle">Monitor &amp; resolve</p>
      </div>

      {/* ── Monitor ── */}
      <div className="gnb-monitor">
        <div className="gnb-metric-card gnb-metric-card--danger">
          <span className="gnb-metric-card-value">{TAINT_FLOWS.filter((t) => !t.sanitized).length}</span>
          <span className="gnb-metric-card-label">Unsanitized Flows</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--danger">
          <span className="gnb-metric-card-value">{FAIL_COUNT}</span>
          <span className="gnb-metric-card-label">Failed Rules</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--warn">
          <span className="gnb-metric-card-value">{WARN_COUNT}</span>
          <span className="gnb-metric-card-label">Warnings</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--success">
          <span className="gnb-metric-card-value">{PASS_COUNT}</span>
          <span className="gnb-metric-card-label">Passed</span>
        </div>
        <div className="gnb-metric-card">
          <span className="gnb-metric-card-value">{INCIDENTS.filter((i) => i.status !== "resolved").length}</span>
          <span className="gnb-metric-card-label">Open Incidents</span>
        </div>
      </div>

      {/* ── TODO: Taint Flows (unsanitized) ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--color-feedback-danger-fg)" }} />
          <h3 className="gnb-todo-header-title">Taint Flows — Unsanitized</h3>
          <span className="gnb-todo-header-count">{TAINT_FLOWS.filter((t) => !t.sanitized).length} paths</span>
        </div>
        {TAINT_FLOWS.filter((t) => !t.sanitized).map((t) => (
          <div key={t.id} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{t.sourceSymbol} → {t.sinkSymbol}</span>
                <span className={`gnb-badge gnb-badge--${severityVariant(t.severity)}`}>{t.severity}</span>
              </div>
              <div className="gnb-todo-desc">Add sanitization or validation before the sink</div>
            </div>
            <span className="gnb-todo-loc">{t.sourceFile}:{t.sourceLine} → {t.sinkFile}:{t.sinkLine}</span>
          </div>
        ))}
      </div>

      {/* ── TODO: Compliance Failures ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--color-feedback-danger-fg)" }} />
          <h3 className="gnb-todo-header-title">Compliance Failures</h3>
          <span className="gnb-todo-header-count">{FAIL_COUNT} rules</span>
        </div>
        {COMPLIANCE.filter((c) => c.verdict === "fail").map((c) => (
          <div key={c.ruleId} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{c.ruleId}</span>
                <span className="gnb-badge gnb-badge--info">{c.category}</span>
                <span className="gnb-badge gnb-badge--danger">fail</span>
              </div>
              <div className="gnb-todo-desc">{c.detail}</div>
            </div>
            <span className="gnb-todo-loc">{c.file ?? "—"}:{c.lineNo ?? "—"}</span>
          </div>
        ))}
      </div>

      {/* ── TODO: Compliance Warnings ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--color-feedback-warn-fg)" }} />
          <h3 className="gnb-todo-header-title">Compliance Warnings</h3>
          <span className="gnb-todo-header-count">{WARN_COUNT} rules</span>
        </div>
        {COMPLIANCE.filter((c) => c.verdict === "warn").map((c) => (
          <div key={c.ruleId} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{c.ruleId}</span>
                <span className="gnb-badge gnb-badge--info">{c.category}</span>
                <span className="gnb-badge gnb-badge--warn">warn</span>
              </div>
              <div className="gnb-todo-desc">{c.detail}</div>
            </div>
            <span className="gnb-todo-loc">{c.file ?? "—"}:{c.lineNo ?? "—"}</span>
          </div>
        ))}
      </div>

      {/* ── TODO: Incidents ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--accent)" }} />
          <h3 className="gnb-todo-header-title">Incidents</h3>
          <span className="gnb-todo-header-count">{INCIDENTS.length} total</span>
        </div>
        {INCIDENTS.map((i) => (
          <div key={i.id} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" defaultChecked={i.status === "resolved"} />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{i.title}</span>
                <span className={`gnb-badge gnb-badge--${severityVariant(i.severity)}`}>{i.severity}</span>
                <span className={`gnb-badge gnb-badge--${statusVariant(i.status)}`}>{i.status}</span>
              </div>
              <div className="gnb-todo-desc">{i.id} — root cause at {i.rootFile}:{i.rootLine}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
