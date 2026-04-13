import { useState } from "react";
import { severityVariant } from "@/shared/model/severityMap";

type PolicyTab = "overview" | "architecture" | "lint" | "deps" | "ownership";

const POLICY_STATS = { totalRules: 24, violations: 7, compliance: 71 };

const ARCH_VIOLATIONS = [
  { id: 1, rule: "no-cross-layer-import", from: "infrastructure/webhook.py", to: "orchestrator/orchestrator.py", coupling: 0.92, severity: "error" as const },
  { id: 2, rule: "no-circular-dep", from: "orchestrator/orchestrator.py", to: "infrastructure/fee.py", coupling: 0.71, severity: "error" as const },
  { id: 3, rule: "max-coupling-0.8", from: "shared/reasoning.py", to: "orchestrator/orchestrator.py", coupling: 0.85, severity: "warn" as const },
];

const LINT_RULES = [
  { id: "TAINT-001", category: "taint", status: "active" as const, violations: 2, desc: "Unsanitized user input reaching sensitive sinks" },
  { id: "AUTH-003", category: "auth", status: "active" as const, violations: 1, desc: "Missing authentication check on API endpoint" },
  { id: "DATA-007", category: "data", status: "active" as const, violations: 0, desc: "PII stored without encryption" },
  { id: "CRYPTO-002", category: "crypto", status: "active" as const, violations: 1, desc: "Weak hash algorithm in password handling" },
  { id: "LOG-001", category: "logging", status: "active" as const, violations: 0, desc: "Sensitive data in log output" },
  { id: "COMPLEX-010", category: "quality", status: "active" as const, violations: 3, desc: "Cyclomatic complexity exceeds threshold (15)" },
  { id: "DEAD-005", category: "quality", status: "active" as const, violations: 0, desc: "Unused exported symbol detected" },
  { id: "IMPORT-002", category: "architecture", status: "active" as const, violations: 0, desc: "Circular import detected" },
];

const DEP_ISSUES = [
  { name: "pyjwt", current: "1.7.1", latest: "2.9.0", severity: "critical" as const, reason: "Known CVE-2024-33663" },
  { name: "requests", current: "2.25.1", latest: "2.32.3", severity: "high" as const, reason: "3 security patches missed" },
  { name: "flask", current: "2.0.1", latest: "3.1.0", severity: "medium" as const, reason: "Major version behind, EOL approaching" },
  { name: "sqlalchemy", current: "1.4.49", latest: "2.0.35", severity: "low" as const, reason: "Major upgrade available" },
];

const OWNERSHIP_ISSUES = [
  { file: "infrastructure/webhook.py", busFactor: 1, lastReviewedPr: "PR-298", daysSinceReview: 45, owner: "bob" },
  { file: "shared/reasoning.py", busFactor: 1, lastReviewedPr: "PR-215", daysSinceReview: 90, owner: "alice" },
  { file: "codegraph_agent/orchestrator/orchestrator.py", busFactor: 2, lastReviewedPr: "PR-342", daysSinceReview: 5, owner: "alice, bob" },
];

export function PolicyPage() {
  const [tab, setTab] = useState<PolicyTab>("overview");

  return (
    <div className="gnb-page gnb-policy">
      <div className="gnb-page-header">
        <h2 className="gnb-page-title">Policy</h2>
        <p className="gnb-page-subtitle">Architecture guardrails, lint rules, dependency policies &amp; ownership</p>
      </div>

      <div className="gnb-metric-cards">
        <div className="gnb-metric-card gnb-metric-card--accent">
          <span className="gnb-metric-card-value">{POLICY_STATS.compliance}%</span>
          <span className="gnb-metric-card-label">Compliance</span>
        </div>
        <div className="gnb-metric-card">
          <span className="gnb-metric-card-value">{POLICY_STATS.totalRules}</span>
          <span className="gnb-metric-card-label">Active Rules</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--danger">
          <span className="gnb-metric-card-value">{POLICY_STATS.violations}</span>
          <span className="gnb-metric-card-label">Violations</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--danger">
          <span className="gnb-metric-card-value">{ARCH_VIOLATIONS.length}</span>
          <span className="gnb-metric-card-label">Arch Violations</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--warn">
          <span className="gnb-metric-card-value">{DEP_ISSUES.filter((d) => d.severity === "critical").length}</span>
          <span className="gnb-metric-card-label">Critical Deps</span>
        </div>
      </div>

      <nav className="gnb-subtabs">
        {(["overview", "architecture", "lint", "deps", "ownership"] as const).map((t) => (
          <button key={t} type="button" className={`gnb-subtab${tab === t ? " is-active" : ""}`} onClick={() => { setTab(t); }}>
            {t === "overview" ? "Overview" : t === "architecture" ? "Architecture" : t === "lint" ? "Rules" : t === "deps" ? "Dependencies" : "Ownership"}
          </button>
        ))}
      </nav>

      <div className="gnb-page-body">
        {tab === "overview" && (
          <div className="gnb-overview-grid">
            <section className="gnb-section">
              <h3 className="gnb-section-title">Architecture Violations</h3>
              {ARCH_VIOLATIONS.map((v) => (
                <div key={v.id} className="gnb-list-row">
                  <span className={`gnb-badge gnb-badge--${v.severity}`}>{v.rule}</span>
                  <span className="gnb-list-row-name">{v.from} → {v.to}</span>
                  <span className="gnb-list-row-meta">coupling: {v.coupling}</span>
                </div>
              ))}
            </section>
            <section className="gnb-section">
              <h3 className="gnb-section-title">Critical Dependencies</h3>
              {DEP_ISSUES.filter((d) => d.severity === "critical" || d.severity === "high").map((d) => (
                <div key={d.name} className="gnb-list-row">
                  <span className="gnb-list-row-name">{d.name}</span>
                  <span className="gnb-list-row-meta">{d.current} → {d.latest}</span>
                  <span className={`gnb-badge gnb-badge--${severityVariant(d.severity)}`}>{d.reason}</span>
                </div>
              ))}
            </section>
            <section className="gnb-section">
              <h3 className="gnb-section-title">Bus Factor Risks</h3>
              {OWNERSHIP_ISSUES.filter((o) => o.busFactor <= 1).map((o) => (
                <div key={o.file} className="gnb-list-row">
                  <span className="gnb-list-row-name">{o.file}</span>
                  <span className="gnb-list-row-meta">Owner: {o.owner} · Last review: {o.daysSinceReview}d ago</span>
                  <span className="gnb-badge gnb-badge--danger">bus factor 1</span>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === "architecture" && (
          <div className="gnb-table">
            <div className="gnb-table-head"><span>Rule</span><span>From</span><span>To</span><span>Coupling</span><span>Severity</span></div>
            {ARCH_VIOLATIONS.map((v) => (
              <div key={v.id} className="gnb-table-row">
                <span className="gnb-table-cell gnb-table-cell--mono">{v.rule}</span>
                <span className="gnb-table-cell gnb-table-cell--muted">{v.from}</span>
                <span className="gnb-table-cell gnb-table-cell--muted">{v.to}</span>
                <span className="gnb-table-cell">{v.coupling}</span>
                <span className="gnb-table-cell"><span className={`gnb-badge gnb-badge--${severityVariant(v.severity)}`}>{v.severity}</span></span>
              </div>
            ))}
          </div>
        )}

        {tab === "lint" && (
          <div className="gnb-table">
            <div className="gnb-table-head"><span>Rule</span><span>Category</span><span>Violations</span><span>Status</span><span>Description</span></div>
            {LINT_RULES.map((r) => (
              <div key={r.id} className="gnb-table-row">
                <span className="gnb-table-cell gnb-table-cell--mono">{r.id}</span>
                <span className="gnb-table-cell"><span className="gnb-badge gnb-badge--info">{r.category}</span></span>
                <span className="gnb-table-cell"><span className={`gnb-badge gnb-badge--${r.violations > 0 ? "danger" : "success"}`}>{r.violations}</span></span>
                <span className="gnb-table-cell"><span className="gnb-badge gnb-badge--success">{r.status}</span></span>
                <span className="gnb-table-cell">{r.desc}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "deps" && (
          <div className="gnb-table">
            <div className="gnb-table-head"><span>Package</span><span>Current</span><span>Latest</span><span>Severity</span><span>Reason</span></div>
            {DEP_ISSUES.map((d) => (
              <div key={d.name} className="gnb-table-row">
                <span className="gnb-table-cell gnb-table-cell--mono">{d.name}</span>
                <span className="gnb-table-cell">{d.current}</span>
                <span className="gnb-table-cell">{d.latest}</span>
                <span className="gnb-table-cell"><span className={`gnb-badge gnb-badge--${severityVariant(d.severity)}`}>{d.severity}</span></span>
                <span className="gnb-table-cell">{d.reason}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "ownership" && (
          <div className="gnb-table">
            <div className="gnb-table-head"><span>File</span><span>Owner</span><span>Bus Factor</span><span>Last Reviewed</span><span>Days Ago</span></div>
            {OWNERSHIP_ISSUES.map((o) => (
              <div key={o.file} className="gnb-table-row">
                <span className="gnb-table-cell gnb-table-cell--mono">{o.file}</span>
                <span className="gnb-table-cell">{o.owner}</span>
                <span className="gnb-table-cell"><span className={`gnb-badge gnb-badge--${o.busFactor <= 1 ? "danger" : "success"}`}>{o.busFactor}</span></span>
                <span className="gnb-table-cell gnb-table-cell--mono">{o.lastReviewedPr}</span>
                <span className="gnb-table-cell">{o.daysSinceReview}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
