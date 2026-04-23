import { memo, useMemo, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { listAnalysisCatalogRecords } from "../../view-mode/model/analysis-catalog";
import { getWorkflowStacks } from "../../view-mode/model/catalog-stacks";
import type {
  AnalysisCatalogRecord,
  DecisionTarget,
  EvidenceClass,
  InsightDomain,
  InsightScope,
  InsightWorkflowStack,
} from "../../view-mode/model/taxonomy";
import { INSIGHT_DOMAINS, INSIGHT_SCOPES } from "../../view-mode/model/taxonomy";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";

export interface CatalogAdminViewProps {
  ctx: ViewContextValue;
}

type EvidenceScore = 0 | 1 | 2 | 3;

interface MatrixCell {
  count: number;
  decisionCoverage: number;
  evidence: EvidenceClass;
  auditableCount: number;
}

interface MatrixRow {
  domain: InsightDomain;
  label: string;
  total: number;
  decisionCoverage: number;
  evidence: EvidenceClass;
  cells: readonly MatrixCell[];
}

interface GateCoverage {
  target: DecisionTarget;
  label: string;
  total: number;
  failClosed: number;
  humanReview: number;
  auditable: number;
  gating: number;
}

interface StackCoverage {
  stack: InsightWorkflowStack;
  total: number;
  matched: number;
  requiredTotal: number;
  requiredMatched: number;
  attached: number;
  autoSuggested: number;
}

interface CatalogAdminData {
  records: readonly AnalysisCatalogRecord[];
  domains: readonly InsightDomain[];
  scopes: readonly InsightScope[];
  rows: readonly MatrixRow[];
  gates: readonly GateCoverage[];
  stacks: readonly StackCoverage[];
  debt: readonly AnalysisCatalogRecord[];
  summary: {
    total: number;
    decisionCapable: number;
    auditable: number;
    hygieneDebt: number;
    stackComplete: number;
  };
}

const DECISION_TARGETS: readonly DecisionTarget[] = [
  "merge",
  "delegate",
  "refactor",
  "route-model",
  "approve-agent-run",
  "escalate-review",
  "policy-audit",
];

const EVIDENCE_SCORE: Readonly<Record<EvidenceClass, EvidenceScore>> = {
  none: 0,
  weak: 1,
  strong: 2,
  auditable: 3,
};

const EVIDENCE_TINT: Readonly<Record<EvidenceClass, string>> = {
  none: color.text3,
  weak: color.warn,
  strong: color.success,
  auditable: color.accent,
};

const KEYFRAMES = `
@keyframes catalogEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

function toTitle(value: string): string {
  return value
    .replace(/^ai-/, "AI ")
    .replace(/^se-/, "SE ")
    .split("-")
    .map((part) => part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function evidenceScore(value: EvidenceClass): EvidenceScore {
  return EVIDENCE_SCORE[value];
}

function evidenceFromScore(score: number): EvidenceClass {
  if (score < 0.5) return "none";
  if (score < 1.5) return "weak";
  if (score < 2.5) return "strong";
  return "auditable";
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildCatalogAdminData(): CatalogAdminData {
  const records = listAnalysisCatalogRecords();
  const recordById = new Map(records.map((record) => [record.id, record]));
  const domains = INSIGHT_DOMAINS;
  const scopes = INSIGHT_SCOPES.filter((scope) => records.some((record) => record.taxonomy.scopes.includes(scope)));

  const rows = domains.map((domain) => {
    const rowRecords = records.filter((record) => domainMatches(record, domain));
    const cells = scopes.map((scope) => buildCell(rowRecords.filter((record) => record.taxonomy.scopes.includes(scope))));
    return {
      domain,
      label: toTitle(domain),
      total: rowRecords.length,
      decisionCoverage: rowRecords.length === 0 ? 0 : rowRecords.filter((record) => record.decision.supports.length > 0).length / rowRecords.length,
      evidence: summarizeEvidence(rowRecords),
      cells,
    };
  });

  const gates = DECISION_TARGETS.map((target) => {
    const matches = records.filter((record) => record.decision.supports.includes(target));
    return {
      target,
      label: target === "route-model" ? "Route Model" : toTitle(target),
      total: matches.length,
      failClosed: matches.filter((record) => record.decision.failClosedEligible).length,
      humanReview: matches.filter((record) => record.decision.humanReviewRequired).length,
      auditable: matches.filter((record) => (record.decision.evidenceClass ?? record.taxonomy.signal.evidenceLevel) === "auditable").length,
      gating: matches.filter((record) => record.decision.grade === "gating" || record.decision.grade === "blocking").length,
    };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const stacks = getWorkflowStacks().map((stack) => {
    const total = stack.steps.length;
    const requiredTotal = stack.steps.filter((step) => step.required).length;
    const matched = stack.steps.filter((step) => recordById.has(step.insightId)).length;
    const requiredMatched = stack.steps.filter((step) => step.required && recordById.has(step.insightId)).length;
    const attached = records.filter((record) => record.workflow.usableInStacks?.includes(stack.id)).length;
    const autoSuggested = records.filter(
      (record) => record.workflow.canBeAutoSuggested && record.workflow.usableInStacks?.includes(stack.id),
    ).length;
    return { stack, total, matched, requiredTotal, requiredMatched, attached, autoSuggested };
  }).sort((a, b) => b.requiredMatched - a.requiredMatched || b.matched - a.matched || a.stack.title.localeCompare(b.stack.title));

  const debt = records
    .filter((record) => record.hygieneDebt)
    .sort((a, b) => a.title.localeCompare(b.title));

  const decisionCapable = records.filter((record) => record.decision.supports.length > 0).length;
  const auditable = records.filter((record) => (record.decision.evidenceClass ?? record.taxonomy.signal.evidenceLevel) === "auditable").length;
  const hygieneDebt = debt.length;
  const stackComplete = stacks.filter((stack) => stack.requiredTotal > 0 && stack.requiredMatched === stack.requiredTotal).length;

  return {
    records,
    domains,
    scopes,
    rows,
    gates,
    stacks,
    debt,
    summary: {
      total: records.length,
      decisionCapable,
      auditable,
      hygieneDebt,
      stackComplete,
    },
  };
}

function domainMatches(record: AnalysisCatalogRecord, domain: InsightDomain): boolean {
  return (record.taxonomy.domains ?? [record.taxonomy.primary.domain]).includes(domain);
}

function buildCell(records: readonly AnalysisCatalogRecord[]): MatrixCell {
  if (records.length === 0) {
    return { count: 0, decisionCoverage: 0, evidence: "none", auditableCount: 0 };
  }
  const decisionCount = records.filter((record) => record.decision.supports.length > 0).length;
  const auditableCount = records.filter((record) => (record.decision.evidenceClass ?? record.taxonomy.signal.evidenceLevel) === "auditable").length;
  return {
    count: records.length,
    decisionCoverage: decisionCount / records.length,
    evidence: summarizeEvidence(records),
    auditableCount,
  };
}

function summarizeEvidence(records: readonly AnalysisCatalogRecord[]): EvidenceClass {
  if (records.length === 0) return "none";
  const average = records.reduce((sum, record) => {
    const evidence = record.decision.evidenceClass ?? record.taxonomy.signal.evidenceLevel;
    return sum + evidenceScore(evidence);
  }, 0) / records.length;
  return evidenceFromScore(average);
}

function cellTone(cell: MatrixCell): string {
  if (cell.count === 0) return color.bg2;
  if (cell.decisionCoverage >= 0.75) return color.accentSofter;
  if (cell.decisionCoverage >= 0.5) return color.success + "10";
  if (cell.decisionCoverage >= 0.25) return color.warn + "10";
  return color.bg2;
}

function StackBar({ ratio }: { ratio: number }): ReactElement {
  return (
    <div style={STACK_BAR_TRACK}>
      <div style={{ ...STACK_BAR_FILL, width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section style={SECTION}>
      <header style={SECTION_HEADER}>
        <div>
          <div style={SECTION_TITLE}>{title}</div>
          {subtitle ? <div style={SECTION_SUBTITLE}>{subtitle}</div> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}): ReactElement {
  return (
    <div style={STAT_CARD}>
      <div style={STAT_LABEL}>{label}</div>
      <div style={STAT_VALUE}>{value}</div>
      {caption ? <div style={STAT_CAPTION}>{caption}</div> : null}
    </div>
  );
}

function Chip({ label, tone = color.bg3 }: { label: string; tone?: string }): ReactElement {
  return <span style={{ ...CHIP, background: tone }}>{label}</span>;
}

function CatalogAdminViewImpl({ ctx }: CatalogAdminViewProps): ReactElement {
  const data = useMemo(() => buildCatalogAdminData(), []);
  const width = Math.max(1024, ctx.viewportSize.w);
  const height = Math.max(720, ctx.viewportSize.h);
  const matrixTemplate = `260px repeat(${data.scopes.length}, minmax(84px, 1fr))`;

  return (
    <div style={{ ...ROOT, width, height }}>
      <style>{KEYFRAMES}</style>

      <header style={HEADER}>
        <div>
          <div style={TITLE_ROW}>
            <h1 style={TITLE}>Catalog Admin</h1>
            <Chip label={`${data.summary.total} records`} tone={color.accentSofter} />
            <Chip label={`${data.summary.hygieneDebt} hygiene debt`} tone={color.warn + "18"} />
          </div>
          <div style={SUBTITLE}>analysis catalog metadata · domain × scope matrix · workflow coverage</div>
        </div>
        <div style={HEADER_RIGHT}>
          <Chip label={`${data.summary.decisionCapable} decision-capable`} tone={color.success + "14"} />
          <Chip label={`${data.summary.auditable} auditable`} tone={color.accentSofter} />
          <Chip label={`${data.summary.stackComplete}/${data.stacks.length} stacks complete`} tone={color.bg3} />
        </div>
      </header>

      <div style={SUMMARY_GRID}>
        <StatCard label="Records" value={String(data.summary.total)} caption="registered in analysis catalog" />
        <StatCard label="Decision coverage" value={pct(data.summary.total === 0 ? 0 : data.summary.decisionCapable / data.summary.total)} caption="records with explicit decision support" />
        <StatCard label="Evidence quality" value={pct(data.summary.total === 0 ? 0 : data.summary.auditable / data.summary.total)} caption="auditable metadata across catalog" />
        <StatCard label="Hygiene debt" value={String(data.summary.hygieneDebt)} caption="fallback taxonomy / metadata gaps" />
        <StatCard label="Workflow stacks" value={String(data.stacks.length)} caption={`${data.summary.stackComplete} stacks fully covered by required steps`} />
      </div>

      <div style={BODY}>
        <div style={MAIN_COLUMN}>
          <SectionCard
            title="Domain × Scope matrix"
            subtitle="count · decision coverage · evidence quality"
          >
            <div style={MATRIX_WRAP}>
              <div style={{ ...MATRIX_HEADER, gridTemplateColumns: matrixTemplate }}>
                <div style={MATRIX_CORNER}>Domain</div>
                {data.scopes.map((scope) => (
                  <div key={scope} style={MATRIX_SCOPE_HEAD}>{toTitle(scope)}</div>
                ))}
              </div>
              {data.rows.map((row) => (
                <div key={row.domain} style={{ ...MATRIX_ROW, gridTemplateColumns: matrixTemplate }}>
                  <div style={MATRIX_DOMAIN_HEAD}>
                    <div style={MATRIX_DOMAIN_LABEL}>{row.label}</div>
                    <div style={MATRIX_DOMAIN_META}>
                      {row.total} · dec {pct(row.decisionCoverage)} · evi {row.evidence}
                    </div>
                  </div>
                  {row.cells.map((cell, index) => (
                    <div
                      key={`${row.domain}-${data.scopes[index]}`}
                      style={{
                        ...MATRIX_CELL,
                        background: cellTone(cell),
                        borderColor: cell.count > 0 ? color.borderStrong : color.borderSoft,
                      }}
                    >
                      <div style={MATRIX_CELL_COUNT}>{cell.count}</div>
                      <div style={MATRIX_CELL_META}>dec {pct(cell.decisionCoverage)}</div>
                      <div style={MATRIX_CELL_META}>evi {cell.evidence}</div>
                      {cell.auditableCount > 0 ? <div style={MATRIX_CELL_META}>aud {cell.auditableCount}</div> : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Workflow stack coverage"
            subtitle="required step coverage and stack attachment"
          >
            <div style={STACK_GRID}>
              {data.stacks.map((item) => {
                const coverage = item.total === 0 ? 0 : item.matched / item.total;
                const requiredCoverage = item.requiredTotal === 0 ? 0 : item.requiredMatched / item.requiredTotal;
                const fullyCovered = item.requiredTotal > 0 && item.requiredMatched === item.requiredTotal;
                return (
                  <article key={item.stack.id} style={STACK_CARD}>
                    <div style={STACK_CARD_HEADER}>
                      <div>
                        <div style={STACK_TITLE}>{item.stack.title}</div>
                        <div style={STACK_GOAL}>{item.stack.goal}</div>
                      </div>
                      <Chip
                        label={fullyCovered ? "covered" : "partial"}
                        tone={fullyCovered ? color.success + "18" : color.warn + "20"}
                      />
                    </div>
                    <div style={STACK_META}>
                      <span>{item.stack.targetDecision ?? "no target"}</span>
                      <span>{item.matched}/{item.total} steps</span>
                      <span>{item.requiredMatched}/{item.requiredTotal} required</span>
                    </div>
                    <StackBar ratio={coverage} />
                    <div style={STACK_FOOT}>
                      <span>attachment {item.attached}</span>
                      <span>auto-suggest {item.autoSuggested}</span>
                      <span>required coverage {pct(requiredCoverage)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <aside style={SIDE_COLUMN}>
          <SectionCard
            title="Gate eligibility"
            subtitle="decision targets mapped from catalog metadata"
          >
            <div style={LIST_GRID}>
              {data.gates.map((gate) => (
                <article key={gate.target} style={LIST_CARD}>
                  <div style={LIST_CARD_HEADER}>
                    <div style={LIST_TITLE}>{gate.label}</div>
                    <Chip label={`${gate.total}`} tone={color.bg3} />
                  </div>
                  <div style={LIST_META}>
                    <span>fail-closed {gate.failClosed}</span>
                    <span>human review {gate.humanReview}</span>
                  </div>
                  <div style={LIST_META}>
                    <span>auditable {gate.auditable}</span>
                    <span>gating {gate.gating}</span>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Hygiene debt"
            subtitle="records still relying on fallback metadata"
          >
            <div style={DEBT_LIST}>
              {data.debt.length === 0 ? (
                <div style={EMPTY}>No hygiene debt detected.</div>
              ) : (
                data.debt.map((record) => {
                  const evidence = record.decision.evidenceClass ?? record.taxonomy.signal.evidenceLevel;
                  const notes = [
                    record.hygieneDebt ? "fallback taxonomy" : null,
                    record.decision.supports.length === 0 ? "no decision target" : null,
                    record.workflow.canBeAutoSuggested ? null : "manual workflow only",
                    record.quality.maturity === "experimental" ? "experimental maturity" : null,
                  ].filter(Boolean) as string[];
                  return (
                    <article key={record.id} style={DEBT_CARD}>
                      <div style={LIST_CARD_HEADER}>
                        <div style={LIST_TITLE}>{record.title}</div>
                        <Chip label={evidence} tone={EVIDENCE_TINT[evidence]} />
                      </div>
                      <div style={DEBT_SUMMARY}>{record.summary}</div>
                      <div style={DEBT_META}>
                        <span>{record.shortLabel}</span>
                        <span>{record.taxonomy.primary.domain}</span>
                        <span>{record.taxonomy.primary.scope}</span>
                      </div>
                      <div style={DEBT_CHIPS}>
                        {notes.map((note) => <Chip key={note} label={note} tone={color.bg2} />)}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

export const CatalogAdminView = memo(CatalogAdminViewImpl);

const ROOT: CSSProperties = {
  boxSizing: "border-box",
  padding: `${space[6]}px ${space[6]}px ${space[7]}px`,
  overflow: "auto",
  background: color.bg0,
  color: color.text0,
  fontFamily: font.sans,
  animation: "catalogEnter 180ms ease-out both",
};

const HEADER: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: space[5],
  marginBottom: space[5],
};

const HEADER_RIGHT: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: space[2],
};

const TITLE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: space[2],
};

const TITLE: CSSProperties = {
  margin: 0,
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};

const SUBTITLE: CSSProperties = {
  marginTop: space[1],
  color: color.text2,
  fontSize: font.size.xs,
};

const CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: radius.pill,
  padding: `${space[0]}px ${space[2]}px`,
  color: color.text1,
  fontSize: font.size.xxs,
  lineHeight: 1.3,
  border: `1px solid ${color.border}`,
};

const SUMMARY_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: space[3],
  marginBottom: space[5],
};

const STAT_CARD: CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  background: color.bg1,
  padding: `${space[3]}px ${space[4]}px`,
  boxShadow: shadow.xs,
};

const STAT_LABEL: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  marginBottom: space[1],
};

const STAT_VALUE: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};

const STAT_CAPTION: CSSProperties = {
  marginTop: space[1],
  fontSize: font.size.xxs,
  color: color.text2,
};

const BODY: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.9fr) minmax(320px, 1fr)",
  gap: space[5],
};

const MAIN_COLUMN: CSSProperties = {
  display: "grid",
  gap: space[5],
};

const SIDE_COLUMN: CSSProperties = {
  display: "grid",
  gap: space[5],
};

const SECTION: CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  background: color.bg1,
  boxShadow: shadow.xs,
  overflow: "hidden",
};

const SECTION_HEADER: CSSProperties = {
  padding: `${space[4]}px ${space[4]}px ${space[2]}px`,
};

const SECTION_TITLE: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};

const SECTION_SUBTITLE: CSSProperties = {
  marginTop: space[1],
  fontSize: font.size.xxs,
  color: color.text2,
};

const MATRIX_WRAP: CSSProperties = {
  overflowX: "auto",
  padding: `0 ${space[4]}px ${space[4]}px`,
};

const MATRIX_HEADER: CSSProperties = {
  display: "grid",
  gap: space[2],
  marginBottom: space[2],
  minWidth: 1300,
};

const MATRIX_CORNER: CSSProperties = {
  padding: `${space[2]}px 0`,
  fontSize: font.size.xxs,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.wide,
};

const MATRIX_SCOPE_HEAD: CSSProperties = {
  padding: `${space[2]}px ${space[1]}px`,
  fontSize: font.size.xxs,
  color: color.text2,
  textAlign: "center",
  borderRadius: radius.md,
  background: color.bg2,
};

const MATRIX_ROW: CSSProperties = {
  display: "grid",
  gap: space[2],
  marginBottom: space[2],
  minWidth: 1300,
};

const MATRIX_DOMAIN_HEAD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: space[1],
  padding: `${space[2]}px ${space[2]}px`,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  background: color.bg2,
};

const MATRIX_DOMAIN_LABEL: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
};

const MATRIX_DOMAIN_META: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
};

const MATRIX_CELL: CSSProperties = {
  minHeight: 80,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: `${space[2]}px`,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: space[0],
  transition: "transform 120ms ease, border-color 120ms ease",
};

const MATRIX_CELL_COUNT: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  lineHeight: 1,
};

const MATRIX_CELL_META: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  textTransform: "lowercase",
};

const STACK_GRID: CSSProperties = {
  display: "grid",
  gap: space[3],
  padding: `0 ${space[4]}px ${space[4]}px`,
};

const STACK_CARD: CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  background: color.bg2,
  padding: space[3],
};

const STACK_CARD_HEADER: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: space[3],
  marginBottom: space[2],
};

const STACK_TITLE: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
};

const STACK_GOAL: CSSProperties = {
  marginTop: space[1],
  fontSize: font.size.xxs,
  color: color.text2,
};

const STACK_META: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[2],
  fontSize: font.size.xxs,
  color: color.text2,
  marginBottom: space[2],
};

const STACK_BAR_TRACK: CSSProperties = {
  height: 6,
  borderRadius: radius.pill,
  background: color.borderSoft,
  overflow: "hidden",
};

const STACK_BAR_FILL: CSSProperties = {
  height: "100%",
  width: "100%",
  background: `linear-gradient(90deg, ${color.accent} 0%, ${color.success} 100%)`,
};

const STACK_FOOT: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: space[2],
  marginTop: space[2],
  fontSize: font.size.xxs,
  color: color.text2,
};

const LIST_GRID: CSSProperties = {
  display: "grid",
  gap: space[2],
  padding: `0 ${space[4]}px ${space[4]}px`,
};

const LIST_CARD: CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  background: color.bg2,
  padding: space[3],
};

const LIST_CARD_HEADER: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: space[2],
  marginBottom: space[1],
};

const LIST_TITLE: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
};

const LIST_META: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: space[2],
  fontSize: font.size.xxs,
  color: color.text2,
  marginTop: space[1],
};

const DEBT_LIST: CSSProperties = {
  display: "grid",
  gap: space[2],
  padding: `0 ${space[4]}px ${space[4]}px`,
};

const DEBT_CARD: CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  background: color.bg2,
  padding: space[3],
};

const DEBT_SUMMARY: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  lineHeight: 1.45,
};

const DEBT_META: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[2],
  marginTop: space[2],
  fontSize: font.size.xxs,
  color: color.text2,
};

const DEBT_CHIPS: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[1],
  marginTop: space[2],
};

const EMPTY: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px ${space[4]}px`,
  color: color.text2,
  fontSize: font.size.xs,
};
