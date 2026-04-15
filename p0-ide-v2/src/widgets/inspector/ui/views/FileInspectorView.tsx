import { useEffect, useState } from "react";
import {
  IconClass,
  IconComplexity,
  IconDead,
  IconFunction,
  IconNoTests,
  IconTaint,
  IconTrendDown,
  IconTrendFlat,
  IconTrendUp,
  Sparkline,
} from "@/shared/ui/icons";
import { Section, Sub } from "@/shared/ui/section";
import { riskColor } from "@/shared/lib/risk";
import { FILES } from "@/entities/file";
import { focusStore, useFocusStore } from "@/shared/model/focus-store";
import { INSPECTOR_MODES } from "@/entities/inspector";
import { FlowPane } from "@/features/inspector-flow";
import { BlastPane } from "@/features/inspector-blast";
import { IncidentsPane } from "@/features/inspector-incidents";
import { BehaviorPane } from "@/features/inspector-behavior";
import { OwnershipPane } from "@/features/inspector-ownership";
import { SuggestionOverlay, type SuggestionData } from "./SuggestionOverlay";
import { toast } from "@/shared/model/toast-store";

const signals = [
  { kind: "danger", Icon: IconTaint, label: "Taint sink", detail: "experience_store.save — unguarded" },
  { kind: "warn", Icon: IconNoTests, label: "No tests", detail: "execute() has 0/12 tests" },
  { kind: "warn", Icon: IconComplexity, label: "High complexity", detail: "CPX 9 (threshold 8)" },
  { kind: "muted", Icon: IconDead, label: "Dead code", detail: "_select_strategy — unreferenced" },
];

// ── Topic ⑤-a · Spec mining: implicit rules discovered across codebase ─
const specRules: {
  id: string;
  rule: string;
  confidence: number;
  instances: number;
  violation?: { symbol: string; loc: string; reason: string };
}[] = [
  {
    id: "sr-01",
    rule: "*Orchestrator.execute() must call validate_trace() before _store.save()",
    confidence: 0.94,
    instances: 12,
    violation: { symbol: "DeepReasoningOrchestrator.execute", loc: "orchestrator.py:16", reason: "save reached without validator on path" },
  },
  {
    id: "sr-02",
    rule: "Taint-source parameters carry Tainted[T] annotation",
    confidence: 0.88,
    instances: 18,
  },
  {
    id: "sr-03",
    rule: "ExperienceStore writes emit audit.emit() within same frame",
    confidence: 0.82,
    instances: 7,
  },
];

// ── Topic ⑤-b · AI contribution heatmap ────────────────────────────────
const aiContribution = {
  aiRatio: 0.73,
  reviewedRatio: 0.12,
  aiLines: 147,
  reviewedLines: 18,
  humanLines: 54,
  authors: [
    { name: "quanta-agent", lines: 98, ratio: 0.49, kind: "ai"    as const },
    { name: "copilot",      lines: 49, ratio: 0.24, kind: "ai"    as const },
    { name: "@songmin",     lines: 54, ratio: 0.27, kind: "human" as const },
  ],
  bands: [
    { start: 1,   end: 47,  aiRatio: 0.92, reviewed: 0.05 },
    { start: 48,  end: 102, aiRatio: 0.58, reviewed: 0.30 },
    { start: 103, end: 148, aiRatio: 0.71, reviewed: 0.08 },
    { start: 149, end: 200, aiRatio: 0.41, reviewed: 0.55 },
  ],
};

const coverage = { pct: 0, uncovered: 8, files: 1 };
const coverageRows: { file: string; covered: number; total: number; delta: number }[] = [
  { file: "orchestrator.py", covered: 0, total: 8, delta: -8 },
];

type DeadConf = "high" | "med";
const deadCode: { kind: "fn" | "class" | "const"; name: string; loc: string; conf: DeadConf; strike?: boolean }[] = [
  { kind: "fn", name: "_legacy_inference_bridge", loc: "orchestrator.py:147", conf: "high", strike: true },
  { kind: "class", name: "OldRetryPolicy", loc: "orchestrator.py:153", conf: "high" },
  { kind: "const", name: "TEMP_FEATURE_FLAG", loc: "orchestrator.py:159", conf: "high", strike: true },
];

type ChurnTrend = "up" | "flat" | "down";
const churn: { file: string; trend: ChurnTrend; count: number; weight: number; spark: number[] }[] = [
  { file: "orchestrator.py", trend: "up", count: 28, weight: 1.0, spark: [4, 6, 5, 9, 12, 18, 28] },
  { file: "fee.py", trend: "up", count: 22, weight: 0.78, spark: [2, 3, 5, 7, 11, 15, 22] },
  { file: "security.py", trend: "up", count: 19, weight: 0.68, spark: [3, 4, 4, 6, 9, 14, 19] },
  { file: "webhook.py", trend: "flat", count: 18, weight: 0.65, spark: [12, 13, 12, 14, 13, 17, 18] },
  { file: "retry.py", trend: "flat", count: 15, weight: 0.55, spark: [10, 12, 11, 13, 14, 14, 15] },
  { file: "routing_policy.py", trend: "flat", count: 14, weight: 0.5, spark: [9, 11, 12, 11, 13, 13, 14] },
  { file: "ledger.py", trend: "down", count: 12, weight: 0.45, spark: [22, 19, 18, 16, 14, 12, 12] },
  { file: "billing.py", trend: "down", count: 9, weight: 0.32, spark: [18, 15, 13, 12, 11, 10, 9] },
  { file: "audit_store.py", trend: "down", count: 3, weight: 0.12, spark: [14, 11, 9, 7, 5, 4, 3] },
];

const suggestion: SuggestionData = {
  title: "Guard taint sink with trace validator",
  rationale:
    "Insert validate_trace() at the single chokepoint where external traces enter the persistence layer. Closes both open paths with one guard — no public API change, no new dependencies.",
  diff: `+ if not trace.validated():
+     raise UnvalidatedTrace()
  self._store.save(trace)`,
  riskBefore: 78,
  riskAfter: 12,
  verification: [
    { state: "pass", label: "Closes 2 open taint paths",        value: "2 → 0",   engine: "taint v2" },
    { state: "pass", label: "Blast radius shrinks",             value: "17 → 2",  engine: "blast" },
    { state: "pass", label: "No public API break",                                engine: "behavior diff" },
    { state: "pass", label: "No new type errors",               value: "0",       engine: "type check" },
    { state: "pass", label: "Behavior identical on valid input",                  engine: "behavior diff" },
    { state: "warn", label: "3 regression tests recommended",   value: "+3",      engine: "coverage" },
    { state: "info", label: "Affects 5 call sites",             value: "5",       engine: "call graph" },
  ],
  confidence: 0.92,
  counterfactual: {
    riskWithout: 78,
    costDays: 3.5,
    items: [
      { state: "danger", label: "2 taint paths remain open",            engine: "taint v2",     detail: "request.ctx → step.run → trace → save (unvalidated)" },
      { state: "danger", label: "2 external sources stay exposed",      engine: "source-map",   detail: "webhook.receive · http_controller.handle" },
      { state: "warn",   label: "INC-412 likely within ~2 weeks",       engine: "incident DNA", detail: "91% shape match · past median time-to-fire 11d" },
      { state: "warn",   label: "17 downstream symbols inherit risk",   engine: "blast",        detail: "3 on critical reasoning path" },
    ],
  },
  proofReplay: {
    status: "pending",
    checks: [
      { label: "Behavior diff against 12 sampled inputs",        pass: true,  engine: "behavior diff", sample: "12 samples" },
      { label: "Blast radius recompute post-apply",              pass: true,  engine: "blast" },
      { label: "Type-check affected files",                       pass: true,  engine: "type check",     sample: "47 files" },
      { label: "Arch-rule scan on infra → domain boundary",      pass: true,  engine: "arch rules" },
    ],
  },
  patchTrail: [
    { id: "p-14", when: "2h",   action: "applied",   title: "Reduce _select_strategy complexity",       riskBefore: 24, riskAfter: 14, author: "quanta-agent" },
    { id: "p-09", when: "1d",   action: "dismissed", title: "Add retry-on-429 to fetch_trace",          riskBefore: 31, riskAfter: 18, reason: "behavior diff detected subtle timeout drift" },
    { id: "p-03", when: "3d",   action: "applied",   title: "Extract validate_trace helper",            riskBefore: 42, riskAfter: 24, author: "quanta-agent" },
  ],
};

function trendIcon(t: ChurnTrend) {
  if (t === "up") return <IconTrendUp size={13} />;
  if (t === "down") return <IconTrendDown size={13} />;
  return <IconTrendFlat size={13} />;
}

function symbolGlyph(kind: "fn" | "class" | "const") {
  if (kind === "class") return <IconClass size={13} />;
  if (kind === "const") return <span className="dead__kchar">k</span>;
  return <IconFunction size={13} />;
}

const MODES = INSPECTOR_MODES;

export function FileInspectorView({ name }: { name: string }) {
  const mode = useFocusStore((s) => s.mode);
  const file = FILES[name];
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  useEffect(() => {
    if (mode !== "overview" && suggestionOpen) setSuggestionOpen(false);
  }, [mode, suggestionOpen]);

  return (
    <>
      <nav className="insp__modes" role="tablist" aria-label="Inspector mode">
        {MODES.map((m) => {
          const active = m.id === mode;
          const count =
            m.id === "flow" ? file?.taintPaths.length :
            m.id === "blast" ? file?.blast :
            m.id === "incidents" ? file?.incidents.length :
            m.id === "behavior" ? file?.behaviorDiff.length : undefined;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`insp__mode${active ? " is-active" : ""}`}
              onClick={() => focusStore.setMode(m.id)}
            >
              <span>{m.label}</span>
              {count !== undefined && count > 0 && (
                <span className="insp__mode-count">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {mode !== "overview" && file && (
        <div className="insp__pane">
          {mode === "flow" && <FlowPane file={file} />}
          {mode === "blast" && <BlastPane file={file} />}
          {mode === "incidents" && <IncidentsPane file={file} />}
          {mode === "behavior" && <BehaviorPane file={file} />}
          {mode === "ownership" && <OwnershipPane file={file} />}
        </div>
      )}

      {mode === "overview" && (
        <div className="insp__overview-wrap">
          <div className="insp__hero">
            <div className="hero__name" title={name}>{name}</div>
            <div className="hero__risk">
              <div className="hero__risk-head">
                <div className="hero__risk-figure">
                  <span className="hero__risk-num" style={{ color: riskColor(78) }}>78</span>
                  <span className="hero__risk-unit">/100</span>
                </div>
                <span
                  className="hero__risk-pill"
                  style={{
                    color: riskColor(78),
                    background: `color-mix(in srgb, ${riskColor(78)} 10%, transparent)`,
                  }}
                >
                  <span className="hero__risk-dot" style={{ background: riskColor(78) }} />
                  High risk
                </span>
              </div>
              <div className="hero__risk-track" aria-hidden>
                <span className="hero__risk-fill" style={{ width: "78%", background: riskColor(78) }} />
                <span className="hero__risk-tick" style={{ left: "40%" }} />
                <span className="hero__risk-tick" style={{ left: "70%" }} />
              </div>
            </div>

            <div className="hero__stats hero__stats--scale">
              <div className="hero__stat">
                <span className="hero__stat-head">
                  <span className="hero__stat-glyph">☰</span>
                  <span className="hero__stat-val">1,974</span>
                </span>
                <span className="hero__stat-key">lines</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-head">
                  <span className="hero__stat-glyph">ƒ</span>
                  <span className="hero__stat-val">11</span>
                </span>
                <span className="hero__stat-key">functions</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-head">
                  <span className="hero__stat-glyph">C</span>
                  <span className="hero__stat-val">3</span>
                </span>
                <span className="hero__stat-key">classes</span>
              </div>
            </div>

            <div className="hero__stats hero__stats--struct">
              <div className="hero__stat">
                <span className="hero__stat-head">
                  <span className="hero__stat-glyph">↓</span>
                  <span className="hero__stat-val">24</span>
                </span>
                <span className="hero__stat-key">imports</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-head">
                  <span className="hero__stat-glyph">→</span>
                  <span className="hero__stat-val">38</span>
                </span>
                <span className="hero__stat-key">callers</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-head">
                  <span className="hero__stat-glyph hero__stat-glyph--warn">λ</span>
                  <span className="hero__stat-val hero__stat-val--warn">9</span>
                </span>
                <span className="hero__stat-key">cpx max</span>
              </div>
            </div>
          </div>

          <Section label="Risk signals" count={signals.length}>
            <div className="rsig">
              {signals.map((s, i) => (
                <div key={i} className="rsig__row">
                  <span className="rsig__icon"><s.Icon size={14} /></span>
                  <div className="rsig__text">
                    <span className="rsig__label">{s.label}</span>
                    <span className="rsig__detail">{s.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section label="Coverage gap">
            <div className="substats substats--3">
              <Sub k="Coverage" v={`${coverage.pct}%`} tone={coverage.pct < 50 ? "danger" : "default"} />
              <Sub k="Uncovered" v={String(coverage.uncovered)} />
              <Sub k="Files" v={String(coverage.files)} />
            </div>
            <ul className="cov">
              {coverageRows.map((r) => (
                <li key={r.file} className="cov__row">
                  <span className="cov__file">{r.file}</span>
                  <span className="cov__frac">{r.covered}/{r.total}</span>
                  <div className="cov__bar">
                    <span className="cov__fill" style={{ width: `${(r.covered / r.total) * 100}%`, background: "var(--success)" }} />
                  </div>
                  <span className="cov__delta">{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Dead code">
            <div className="substats substats--2">
              <Sub k="Total" v={String(deadCode.length)} />
              <Sub k="High conf." v={String(deadCode.filter((d) => d.conf === "high").length)} />
            </div>
            <ul className="dead">
              {deadCode.map((d) => (
                <li key={d.name} className="dead__row">
                  <span className="dead__glyph">{symbolGlyph(d.kind)}</span>
                  <span className={"dead__name" + (d.strike ? " is-strike" : "")}>{d.name}</span>
                  <span className="dead__loc">{d.loc}</span>
                  <span className={`pill pill--conf-${d.conf}`}>{d.conf}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Churn hotspots">
            <div className="substats substats--3">
              <Sub k="Hotspots" v="9" />
              <Sub k="Rising" v="3" tone="warn" />
              <Sub k="Churn Δ" v="4850" />
            </div>
            <ul className="churn">
              {churn.map((c) => (
                <li key={c.file} className="churn__row">
                  <span className="churn__file">{c.file}</span>
                  <span className={`churn__trend churn__trend--${c.trend}`}>{trendIcon(c.trend)}</span>
                  <span className="churn__count">{c.count}</span>
                  <div className="churn__bar">
                    <span className="churn__fill" style={{ width: `${Math.round(c.weight * 100)}%` }} />
                  </div>
                  <Sparkline points={c.spark} className="churn__spark" />
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Suggested fix">
            <div className="fix">
              <div className="fix__title">{suggestion.title}</div>
              <pre className="fix__code">{suggestion.diff}</pre>
              <div className="fix__meta">
                <div><span>Risk</span><b>{suggestion.riskBefore} → {suggestion.riskAfter}</b></div>
                <div><span>Confidence</span><b>{suggestion.confidence.toFixed(2)}</b></div>
                <div><span>Affects</span><b>5 files</b></div>
              </div>
              <div className="fix__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setSuggestionOpen(true)}
                >
                  View details
                </button>
                <button type="button" className="btn btn--ghost">Dismiss <kbd>Esc</kbd></button>
                <button type="button" className="btn btn--primary">Apply <kbd>Enter</kbd></button>
              </div>
            </div>
          </Section>

          <Section label="Discovered rules" count={specRules.length}>
            <div className="substats substats--2">
              <Sub k="Rules mined" v={String(specRules.length)} />
              <Sub
                k="Violations"
                v={String(specRules.filter((r) => r.violation).length)}
                tone={specRules.some((r) => r.violation) ? "danger" : "default"}
              />
            </div>
            <ul className="spec">
              {specRules.map((r) => (
                <li key={r.id} className={`spec__row${r.violation ? " has-violation" : ""}`}>
                  <div className="spec__head">
                    <span className={`spec__glyph${r.violation ? " is-violation" : ""}`} aria-hidden>
                      {r.violation ? "!" : "◆"}
                    </span>
                    <span className="spec__rule">{r.rule}</span>
                    <span className="spec__conf" title="Mining confidence">
                      {r.confidence.toFixed(2)}
                    </span>
                  </div>
                  <div className="spec__meta">
                    <span className="spec__inst">{r.instances} instances</span>
                    {r.violation && (
                      <>
                        <span className="spec__sep">·</span>
                        <span className="spec__vio-label">VIOLATED</span>
                        <span className="spec__vio-sym">{r.violation.symbol}</span>
                        <span className="spec__vio-loc">{r.violation.loc}</span>
                      </>
                    )}
                  </div>
                  {r.violation && (
                    <div className="spec__foot">
                      <span className="spec__reason">{r.violation.reason}</span>
                      <button
                        type="button"
                        className="spec__promote"
                        onClick={() => {
                          toast.success(
                            "Promoted to arch rule",
                            `"${r.rule}" now enforced across codebase (confidence ${r.confidence.toFixed(2)})`,
                            "arch rules",
                          );
                        }}
                      >
                        Promote to arch rule →
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section label="AI contribution">
            <div className="substats substats--3">
              <Sub
                k="AI ratio"
                v={`${Math.round(aiContribution.aiRatio * 100)}%`}
                tone={aiContribution.aiRatio > 0.6 ? "warn" : "default"}
              />
              <Sub
                k="Reviewed"
                v={`${Math.round(aiContribution.reviewedRatio * 100)}%`}
                tone={aiContribution.reviewedRatio < 0.2 ? "danger" : "default"}
              />
              <Sub k="AI lines" v={String(aiContribution.aiLines)} />
            </div>

            <div className="aic-strip" aria-label="AI density by line range">
              <span className="aic-strip__label">lines</span>
              <div className="aic-strip__track">
                {aiContribution.bands.map((b) => {
                  const start = b.start;
                  const span = b.end - b.start;
                  const total = aiContribution.bands[aiContribution.bands.length - 1].end;
                  const leftPct = (start / total) * 100;
                  const widthPct = (span / total) * 100;
                  // Four discrete density tiers for visual coherence w/ cov/churn bars
                  const tier =
                    b.aiRatio >= 0.85 ? "vhi" :
                    b.aiRatio >= 0.65 ? "hi" :
                    b.aiRatio >= 0.45 ? "med" :
                    "lo";
                  return (
                    <div
                      key={b.start}
                      className={`aic-strip__band aic-strip__band--${tier}`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`L${b.start}–${b.end} · AI ${Math.round(b.aiRatio * 100)}% · reviewed ${Math.round(b.reviewed * 100)}%`}
                    >
                      <span className="aic-strip__band-val">{Math.round(b.aiRatio * 100)}%</span>
                    </div>
                  );
                })}
              </div>
              <span className="aic-strip__total">200</span>
            </div>

            <ul className="aic-auth">
              {aiContribution.authors.map((a) => (
                <li key={a.name} className={`aic-auth__row aic-auth__row--${a.kind}`}>
                  <span className={`aic-auth__dot aic-auth__dot--${a.kind}`} aria-hidden />
                  <span className="aic-auth__name">{a.name}</span>
                  <div className="aic-auth__bar">
                    <span className="aic-auth__fill" style={{ width: `${Math.round(a.ratio * 100)}%` }} />
                  </div>
                  <span className="aic-auth__val">{a.lines}</span>
                </li>
              ))}
            </ul>

            {aiContribution.reviewedRatio < 0.2 && (
              <div className="aic-warn">
                Only {Math.round(aiContribution.reviewedRatio * 100)}% of AI-generated lines have human review —
                consider a guarded-review pass before merging.
              </div>
            )}
          </Section>

          {suggestionOpen && (
            <SuggestionOverlay data={suggestion} onClose={() => setSuggestionOpen(false)} />
          )}
        </div>
      )}
    </>
  );
}
