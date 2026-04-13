import { getDeadSymbolsFromDB, getCoverageFromDB, getChurnFromDB } from "@/app/ide/analysis-data";

const METRICS = { score: "B+", deadCount: 8, coveragePct: 42, avgComplexity: 6.3, hotFiles: 4 };
const ALL_DEAD = getDeadSymbolsFromDB("orchestrator.py");
const ALL_COVERAGE = getCoverageFromDB("orchestrator.py");
const ALL_CHURN = getChurnFromDB("orchestrator.py");

const COMPLEXITY_TODOS = [
  { name: "execute", file: "orchestrator.py", line: 64, complexity: 9.1, desc: "Cyclomatic complexity 9.1 — consider splitting into sub-functions" },
  { name: "DeepReasoningOrchestrator.__init__", file: "orchestrator.py", line: 12, complexity: 7.8, desc: "Constructor does too much — move setup logic to factory" },
  { name: "calculateFee", file: "fee.py", line: 8, complexity: 6.4, desc: "Nested conditionals — extract guard clauses" },
];

export function QualityPage() {
  return (
    <div className="gnb-page gnb-quality">
      <div className="gnb-page-header">
        <h2 className="gnb-page-title">Quality</h2>
        <p className="gnb-page-subtitle">Monitor &amp; resolve</p>
      </div>

      {/* ── Monitor: metric cards ── */}
      <div className="gnb-monitor">
        <div className="gnb-metric-card gnb-metric-card--accent">
          <span className="gnb-metric-card-value">{METRICS.score}</span>
          <span className="gnb-metric-card-label">Quality Score</span>
        </div>
        <div className="gnb-metric-card">
          <span className="gnb-metric-card-value">{METRICS.deadCount}</span>
          <span className="gnb-metric-card-label">Dead Symbols</span>
        </div>
        <div className="gnb-metric-card">
          <span className="gnb-metric-card-value">{METRICS.coveragePct}%</span>
          <span className="gnb-metric-card-label">Test Coverage</span>
        </div>
        <div className="gnb-metric-card">
          <span className="gnb-metric-card-value">{METRICS.avgComplexity}</span>
          <span className="gnb-metric-card-label">Avg Complexity</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--warn">
          <span className="gnb-metric-card-value">{METRICS.hotFiles}</span>
          <span className="gnb-metric-card-label">Churn Hotspots</span>
        </div>
      </div>

      {/* ── TODO: Dead Code ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--color-feedback-danger-fg)" }} />
          <h3 className="gnb-todo-header-title">Dead Code</h3>
          <span className="gnb-todo-header-count">{ALL_DEAD.length} items</span>
        </div>
        {ALL_DEAD.map((d) => (
          <div key={d.name} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{d.name}</span>
                <span className={`gnb-badge gnb-badge--${d.confidence > 0.8 ? "danger" : "warn"}`}>{Math.round(d.confidence * 100)}%</span>
              </div>
              <div className="gnb-todo-desc">{d.reason}</div>
            </div>
            <span className="gnb-todo-loc">{d.file}</span>
          </div>
        ))}
      </div>

      {/* ── TODO: Coverage Gaps ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--color-feedback-warn-fg)" }} />
          <h3 className="gnb-todo-header-title">Coverage Gaps</h3>
          <span className="gnb-todo-header-count">{ALL_COVERAGE.filter((c) => !c.covered).length} items</span>
        </div>
        {ALL_COVERAGE.filter((c) => !c.covered).map((c) => (
          <div key={`${c.file}-${c.symbolName}`} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{c.symbolName}</span>
                <span className="gnb-badge gnb-badge--danger">no tests</span>
              </div>
              <div className="gnb-todo-desc">Write tests for this symbol</div>
            </div>
            <span className="gnb-todo-loc">{c.file}:{c.lineStart}</span>
          </div>
        ))}
      </div>

      {/* ── TODO: Churn Hotspots ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--color-feedback-warn-fg)" }} />
          <h3 className="gnb-todo-header-title">Churn Hotspots</h3>
          <span className="gnb-todo-header-count">{ALL_CHURN.filter((c) => c.trend === "rising").length} rising</span>
        </div>
        {ALL_CHURN.filter((c) => c.trend === "rising").map((c) => (
          <div key={c.file} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{c.file}</span>
                <span className="gnb-badge gnb-badge--danger">rising</span>
              </div>
              <div className="gnb-todo-desc">{c.commits30d} commits / {c.authors30d} authors / {c.linesChanged} lines in 30d</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── TODO: Complexity ── */}
      <div className="gnb-todo-section">
        <div className="gnb-todo-header">
          <span className="gnb-todo-header-icon" style={{ background: "var(--accent)" }} />
          <h3 className="gnb-todo-header-title">High Complexity</h3>
          <span className="gnb-todo-header-count">{COMPLEXITY_TODOS.length} items</span>
        </div>
        {COMPLEXITY_TODOS.map((c) => (
          <div key={c.name} className="gnb-todo-item">
            <input type="checkbox" className="gnb-todo-check" />
            <div className="gnb-todo-content">
              <div className="gnb-todo-title">
                <span>{c.name}</span>
                <span className="gnb-badge gnb-badge--warn">{c.complexity}</span>
              </div>
              <div className="gnb-todo-desc">{c.desc}</div>
            </div>
            <span className="gnb-todo-loc">{c.file}:{c.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
