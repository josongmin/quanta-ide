import type { CSSProperties, ReactElement } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { AdmissionDecision, GovernanceData } from "../model/types";
import {
  ConfidenceChip,
  EmptyState,
  MetricCard,
  Section,
} from "./primitives";

export interface GovernanceTabProps {
  data: GovernanceData;
  width: number;
}

const DECISION_COLOR: Readonly<Record<AdmissionDecision, string>> = {
  PASS:   color.success,
  HOLD:   color.warn,
  BLOCK:  color.danger,
  REVIEW: color.accent,
};

const DECISION_HINT: Readonly<Record<AdmissionDecision, string>> = {
  PASS:   "Safe to merge",
  HOLD:   "Needs follow-up before merge",
  BLOCK:  "Merge is not allowed",
  REVIEW: "Human review required",
};

export function GovernanceTab(props: GovernanceTabProps): ReactElement {
  const { data, width } = props;
  const narrow = width < 960;

  const accent = DECISION_COLOR[data.verdict.decision];

  return (
    <div style={WRAP}>
      {/* Verdict hero */}
      <Section
        title="Admission Verdict"
        caption="L5 · final merge decision"
        right={<ConfidenceChip confidence={data.verdict.confidence} reason="Confidence follows evidence coverage." size="md" />}
      >
        <div style={{ ...HERO, borderColor: `${accent}66`, background: `linear-gradient(135deg, ${accent}14 0%, ${accent}03 70%)` }}>
          <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: space[5], alignItems: narrow ? "stretch" : "center" }}>
            <div style={VERDICT_COL}>
              <div style={{ ...VERDICT_BADGE, background: accent, boxShadow: `0 6px 20px ${accent}55` }}>
                {data.verdict.decision}
              </div>
              <div style={VERDICT_HINT}>{DECISION_HINT[data.verdict.decision]}</div>
              <div style={VERDICT_RISK}>
                <span style={VERDICT_RISK_LABEL}>Total risk</span>
                <span style={{ ...VERDICT_RISK_VALUE, color: accent }}>{data.verdict.totalRisk}</span>
              </div>
            </div>

            <div style={{ flex: 1, display: "grid", gap: space[4], gridTemplateColumns: narrow ? "1fr" : "1fr 1fr" }}>
              <div>
                <div style={LIST_TITLE}>Top reasons</div>
                <ul style={LIST}>
                  {data.verdict.topReasons.map((r, i) => (
                    <li key={i} style={LIST_ITEM}>
                      <span style={{ ...LIST_BULLET, background: accent }} />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div style={LIST_TITLE}>Actions to pass</div>
                <ul style={LIST}>
                  {data.verdict.actionsToPass.map((a, i) => (
                    <li key={i} style={LIST_ITEM}>
                      <span style={LIST_CHECK}>✓</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Evidence Coverage" caption="L5-B · how well the verdict is supported">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.coverageMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      <Section title="Policy" caption="rules currently firing on this workspace">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.policyMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>

        <div style={{ ...PANEL, marginTop: space[3] }}>
          <div style={PANEL_TITLE}>Rule hits</div>
          {data.policyHits.length === 0 ? (
            <div style={{ marginTop: space[3] }}>
              <EmptyState title="No policy violations" body="Every declared rule is currently passing." />
            </div>
          ) : (
            <div style={HITS_LIST}>
              {data.policyHits.map(h => (
                <div key={h.ruleId} style={HIT_ROW}>
                  <span style={{ ...HIT_SEV_DOT, background: h.color }} />
                  <div style={HIT_COL}>
                    <span style={HIT_LABEL}>{h.label}</span>
                    <span style={HIT_RULE}>{h.ruleId}</span>
                  </div>
                  <span style={{ ...SEV_PILL, color: severityTextColor(h.severity), borderColor: severityTextColor(h.severity) + "66", background: severityTextColor(h.severity) + "12" }}>
                    {h.severity.toUpperCase()}
                  </span>
                  <span style={HIT_COUNT}>{h.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Trust" caption="L5-C · reproducibility + determinism">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 3}, minmax(0, 1fr))` }}>
          {data.trustMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      <Section title="Recent Events" caption="from proofs + synthesized findings">
        <div style={PANEL}>
          {data.recentEvents.length === 0 ? (
            <EmptyState title="No events yet" body="Events appear here as analyzers emit proofs or findings." />
          ) : (
            <div style={EVENT_FEED}>
              {data.recentEvents.map(ev => (
                <div key={ev.id} style={EVENT_ROW}>
                  <span style={{ ...EVENT_SEV_DOT, background: severityTextColor(ev.severity) }} />
                  <div style={EVENT_BODY}>
                    <div style={EVENT_SUMMARY}>{ev.summary}</div>
                    <div style={EVENT_META}>
                      <span style={EVENT_KIND}>{ev.kind}</span>
                      {ev.file ? <span style={EVENT_FILE}>{shortPath(ev.file)}</span> : null}
                      <span style={EVENT_AT}>{fmtRel(ev.at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function severityTextColor(sev: string): string {
  if (sev === "critical") return color.danger;
  if (sev === "high") return color.danger;
  if (sev === "medium") return color.warn;
  if (sev === "low") return color.text2;
  return color.text2;
}

function shortPath(p: string): string {
  if (p.length <= 40) return p;
  return `…${p.slice(-40)}`;
}

function fmtRel(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(at).toLocaleDateString();
}

// ── Styles ────────────────────────────────────────────────────────────

const WRAP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: `${space[4]}px 0 ${space[5]}px`,
};

const GRID: CSSProperties = {
  display: "grid",
  gap: space[3],
};

const HERO: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[4],
  padding: `${space[5]}px ${space[5]}px`,
  border: `1px solid`,
  borderRadius: radius.lg,
};

const VERDICT_COL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: space[2],
  minWidth: 180,
};

const VERDICT_BADGE: CSSProperties = {
  padding: `${space[3]}px ${space[6]}px`,
  borderRadius: radius.pill,
  color: "#ffffff",
  fontSize: 22,
  fontWeight: font.weight.bold,
  letterSpacing: 1.4,
};

const VERDICT_HINT: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text1,
  letterSpacing: font.letter.tight,
};

const VERDICT_RISK: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: space[2],
};

const VERDICT_RISK_LABEL: CSSProperties = {
  fontSize: 9.5,
  color: color.text2,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const VERDICT_RISK_VALUE: CSSProperties = {
  fontSize: 28,
  fontWeight: font.weight.bold,
  letterSpacing: -0.6,
  fontVariantNumeric: "tabular-nums",
};

const LIST_TITLE: CSSProperties = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text2,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  marginBottom: space[2],
};

const LIST: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const LIST_ITEM: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: space[2],
  fontSize: font.size.sm,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.4,
};

const LIST_BULLET: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  marginTop: 6,
  flexShrink: 0,
};

const LIST_CHECK: CSSProperties = {
  color: color.success,
  fontWeight: font.weight.bold,
  marginTop: 1,
  flexShrink: 0,
};

const PANEL: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: `${space[4]}px ${space[4]}px`,
};

const PANEL_TITLE: CSSProperties = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text2,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const HITS_LIST: CSSProperties = {
  marginTop: space[3],
  display: "flex",
  flexDirection: "column",
};

const HIT_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "10px 1fr auto 40px",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px 0`,
  borderBottom: `1px solid ${color.borderSoft}`,
};

const HIT_SEV_DOT: CSSProperties = {
  width: 8, height: 8, borderRadius: 999,
};

const HIT_COL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const HIT_LABEL: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.medium,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const HIT_RULE: CSSProperties = {
  fontSize: 10,
  fontFamily: font.mono,
  color: color.text3,
};

const SEV_PILL: CSSProperties = {
  display: "inline-block",
  padding: "1px 7px",
  borderRadius: radius.pill,
  fontSize: 9,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.5,
  border: "1px solid",
};

const HIT_COUNT: CSSProperties = {
  fontSize: font.size.md,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  color: color.text0,
  textAlign: "right",
};

const EVENT_FEED: CSSProperties = {
  marginTop: space[3],
  display: "flex",
  flexDirection: "column",
};

const EVENT_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: space[3],
  padding: `${space[2]}px 0`,
  borderBottom: `1px solid ${color.borderSoft}`,
};

const EVENT_SEV_DOT: CSSProperties = {
  width: 8, height: 8, borderRadius: 999,
  marginTop: 6,
};

const EVENT_BODY: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const EVENT_SUMMARY: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  letterSpacing: font.letter.tight,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const EVENT_META: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  fontSize: 10,
  color: color.text3,
  fontFamily: font.mono,
};

const EVENT_KIND: CSSProperties = {
  padding: "0 5px",
  background: color.bg3,
  borderRadius: radius.sm,
  color: color.text2,
  fontSize: 9,
  textTransform: "uppercase",
  fontFamily: font.sans,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.4,
};

const EVENT_FILE: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const EVENT_AT: CSSProperties = {
  marginLeft: "auto",
  flexShrink: 0,
};
