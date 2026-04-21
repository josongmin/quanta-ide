import type { CSSProperties, ReactElement } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { RepoHealthData } from "../model/types";
import {
  EmptyState,
  MetricCard,
  ScoreRing,
  Section,
  Sparkline,
  StackedBar,
  bucketColor,
} from "./primitives";

export interface RepoHealthTabProps {
  data: RepoHealthData;
  width: number;
  onFocusFile?: (fileId: string) => void;
}

export function RepoHealthTab(props: RepoHealthTabProps): ReactElement {
  const { data, width, onFocusFile } = props;
  const narrow = width < 960;

  return (
    <div style={WRAP}>
      {/* Baseline risk hero */}
      <Section
        title="Baseline Risk"
        caption="L2 · current structural + semantic state of the whole workspace"
      >
        <div style={{ ...HERO, gridTemplateColumns: narrow ? "1fr" : "220px 1fr" }}>
          <div style={HERO_SCORE_BOX}>
            <ScoreRing
              score={data.baselineRisk.score}
              bucket={data.baselineRisk.bucket}
              label={data.baselineRisk.bucket === "low" ? "Safe to ship" : data.baselineRisk.bucket === "medium" ? "Attention advised" : "Intervene now"}
              sub={`confidence · ${data.baselineRisk.confidence}`}
            />
          </div>
          <div style={HERO_CONTRIB}>
            <div style={HERO_CONTRIB_TITLE}>Risk composition</div>
            {data.baselineRisk.topContributors.map(c => (
              <div key={c.label} style={CONTRIB_ROW}>
                <span style={CONTRIB_LABEL}>{c.label}</span>
                <div style={CONTRIB_BAR_TRACK}>
                  <div
                    style={{
                      ...CONTRIB_BAR_FILL,
                      width: `${Math.max(3, Math.min(100, c.weight))}%`,
                      background: bucketColor(
                        c.weight >= 60 ? "high" : c.weight >= 30 ? "medium" : "low",
                      ),
                    }}
                  />
                </div>
                <span style={CONTRIB_VALUE}>{c.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Primary metrics */}
      <Section title="Workspace" caption="size + shape">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.primaryMetrics.map(m => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
      </Section>

      {/* Structural defects */}
      <Section title="Structural Defects" caption="L2-A · cycles, layering, fan-in, dead code">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.structuralMetrics.map(m => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
      </Section>

      {/* Semantic */}
      <Section title="Semantic Risk" caption="L2-C · flow, taint, effects, proof gap">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.semanticMetrics.map(m => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
      </Section>

      {/* Risk distribution + Top files side-by-side */}
      <Section title="Risk Distribution" caption="files grouped by computed risk score">
        <div style={{ ...SPLIT, gridTemplateColumns: narrow ? "1fr" : "320px 1fr" }}>
          <div style={PANEL}>
            <div style={PANEL_TITLE}>By bucket</div>
            <div style={{ display: "flex", flexDirection: "column", gap: space[3], marginTop: space[3] }}>
              {data.riskDistribution.map(b => {
                const total = data.riskDistribution.reduce((a, x) => a + x.count, 0) || 1;
                const pct = (b.count / total) * 100;
                return (
                  <div key={b.bucket}>
                    <div style={DIST_ROW}>
                      <span style={{ ...DIST_DOT, background: bucketColor(b.bucket) }} />
                      <span style={DIST_LABEL}>{labelFor(b.bucket)}</span>
                      <span style={DIST_COUNT}>{b.count}</span>
                      <span style={DIST_PCT}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={DIST_BAR_TRACK}>
                      <div style={{ ...DIST_BAR_FILL, width: `${pct}%`, background: bucketColor(b.bucket) }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: space[5] }}>
              <div style={PANEL_TITLE}>Smell breakdown</div>
              <div style={{ marginTop: space[3] }}>
                <StackedBar segments={data.smellBreakdown.map(s => ({ label: s.label, value: s.count, color: s.color }))} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: `${space[2]}px ${space[3]}px`, marginTop: space[3] }}>
                  {data.smellBreakdown.map(s => (
                    <span key={s.kind} style={SMELL_LEGEND_ITEM}>
                      <span style={{ ...SMELL_DOT, background: s.color }} />
                      <span style={SMELL_LABEL}>{s.label}</span>
                      <span style={SMELL_COUNT}>{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={PANEL}>
            <div style={PANEL_TITLE}>Top risk files</div>
            <div style={TABLE_WRAP}>
              {data.topRiskFiles.length === 0 ? (
                <EmptyState title="No files at risk" body="Risk scores will populate once the analyzer runs." />
              ) : (
                <table style={TABLE}>
                  <thead>
                    <tr>
                      <th style={TH}>File</th>
                      <th style={{ ...TH, width: 80 }}>Layer</th>
                      <th style={{ ...TH, width: 70, textAlign: "right" }}>LoC</th>
                      <th style={{ ...TH, width: 80, textAlign: "right" }}>Risk</th>
                      <th style={TH}>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topRiskFiles.map(f => (
                      <tr
                        key={f.id}
                        onClick={onFocusFile ? () => onFocusFile(f.id) : undefined}
                        style={onFocusFile ? { ...TR, cursor: "pointer" } : TR}
                        onMouseEnter={e => { if (onFocusFile) e.currentTarget.style.background = color.hover; }}
                        onMouseLeave={e => { if (onFocusFile) e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={TD_NAME} title={f.path}>
                          <span style={{ fontWeight: font.weight.medium, color: color.text0 }}>{f.name}</span>
                          <span style={{ fontFamily: font.mono, fontSize: 10, color: color.text3, marginLeft: 6 }}>
                            {f.path.length > 44 ? `…${f.path.slice(-44)}` : f.path}
                          </span>
                        </td>
                        <td style={TD}>
                          <span style={LAYER_PILL}>{f.layer}</span>
                        </td>
                        <td style={{ ...TD, textAlign: "right", fontFamily: font.mono, color: color.text2 }}>
                          {f.loc.toLocaleString()}
                        </td>
                        <td style={{ ...TD, textAlign: "right" }}>
                          <span style={{
                            ...RISK_PILL,
                            color: bucketColor(f.score >= 60 ? "high" : f.score >= 30 ? "medium" : "low"),
                            borderColor: bucketColor(f.score >= 60 ? "high" : f.score >= 30 ? "medium" : "low") + "66",
                            background: bucketColor(f.score >= 60 ? "high" : f.score >= 30 ? "medium" : "low") + "18",
                          }}>
                            {Math.round(f.score)}
                          </span>
                        </td>
                        <td style={{ ...TD, color: color.text2, fontSize: font.size.xs }}>
                          {f.reasons.length > 0 ? f.reasons.join(" · ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Analysis confidence + debt trend */}
      <Section title="Analysis Confidence" caption="L2-D · how much of the graph we actually trust">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.confidenceMetrics.map(m => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
      </Section>

      {data.hasHistory && data.debtSeries.length > 0 ? (
        <Section title="Debt Trajectory" caption="commits ago → now">
          <div style={{ ...SPLIT, gridTemplateColumns: narrow ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
            {data.debtSeries.map(s => (
              <div key={s.label} style={PANEL}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={PANEL_TITLE}>{s.label}</span>
                  <span style={{
                    fontSize: font.size.xs,
                    color: s.delta > 0 ? color.danger : s.delta < 0 ? color.success : color.text2,
                    fontFamily: font.mono,
                    fontWeight: font.weight.semibold,
                  }}>
                    {s.delta > 0 ? "+" : ""}{Number.isInteger(s.delta) ? s.delta : s.delta.toFixed(1)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: space[2], marginTop: space[2] }}>
                  <span style={{
                    fontSize: 22, fontWeight: font.weight.semibold, color: color.text0,
                    letterSpacing: -0.4, fontVariantNumeric: "tabular-nums",
                  }}>
                    {Number.isInteger(s.latest) ? s.latest : s.latest.toFixed(1)}
                  </span>
                </div>
                <div style={{ marginTop: space[2] }}>
                  <Sparkline points={s.points} color={s.color} width={260} height={36} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Debt Trajectory" caption="commits ago → now">
          <EmptyState
            title="No history yet"
            body="Attach a git history source to compute the debt trajectory over commits."
            action="Connect Git history"
          />
        </Section>
      )}
    </div>
  );
}

function labelFor(bucket: "low" | "medium" | "high"): string {
  if (bucket === "low") return "Low risk";
  if (bucket === "medium") return "Medium";
  return "High";
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

const SPLIT: CSSProperties = {
  display: "grid",
  gap: space[3],
};

const HERO: CSSProperties = {
  display: "grid",
  gap: space[5],
  alignItems: "center",
  padding: `${space[5]}px ${space[5]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
};

const HERO_SCORE_BOX: CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const HERO_CONTRIB: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const HERO_CONTRIB_TITLE: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.tight,
};

const CONTRIB_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px 1fr 40px",
  alignItems: "center",
  gap: space[3],
};

const CONTRIB_LABEL: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text1,
  letterSpacing: font.letter.tight,
};

const CONTRIB_BAR_TRACK: CSSProperties = {
  height: 8,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const CONTRIB_BAR_FILL: CSSProperties = {
  height: "100%",
  transition: "width 420ms cubic-bezier(0.2, 0, 0.1, 1)",
};

const CONTRIB_VALUE: CSSProperties = {
  fontSize: 11,
  fontFamily: font.mono,
  color: color.text2,
  fontWeight: font.weight.semibold,
  textAlign: "right",
};

const PANEL: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: `${space[4]}px ${space[4]}px`,
};

const PANEL_TITLE: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.tight,
  textTransform: "uppercase",
};

const DIST_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto auto",
  alignItems: "center",
  gap: space[2],
  marginBottom: 6,
};

const DIST_DOT: CSSProperties = {
  width: 8, height: 8, borderRadius: 999,
};

const DIST_LABEL: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const DIST_COUNT: CSSProperties = {
  fontSize: font.size.md,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
};

const DIST_PCT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  minWidth: 32,
  textAlign: "right",
};

const DIST_BAR_TRACK: CSSProperties = {
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const DIST_BAR_FILL: CSSProperties = {
  height: "100%",
  transition: "width 420ms",
};

const SMELL_LEGEND_ITEM: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: font.size.xs,
  color: color.text1,
};

const SMELL_DOT: CSSProperties = {
  width: 6, height: 6, borderRadius: 999,
};

const SMELL_LABEL: CSSProperties = {
  letterSpacing: font.letter.tight,
};

const SMELL_COUNT: CSSProperties = {
  fontFamily: font.mono,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const TABLE_WRAP: CSSProperties = {
  marginTop: space[3],
  maxHeight: 320,
  overflowY: "auto",
};

const TABLE: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: font.size.sm,
};

const TH: CSSProperties = {
  textAlign: "left",
  padding: `${space[2]}px ${space[2]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text2,
  letterSpacing: font.letter.tight,
  borderBottom: `1px solid ${color.border}`,
  position: "sticky",
  top: 0,
  background: color.bg1,
  textTransform: "uppercase",
};

const TR: CSSProperties = {
  transition: "background 120ms",
};

const TD: CSSProperties = {
  padding: `${space[2]}px ${space[2]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
};

const TD_NAME: CSSProperties = {
  ...TD,
  maxWidth: 280,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const LAYER_PILL: CSSProperties = {
  display: "inline-block",
  padding: "1px 7px",
  borderRadius: radius.pill,
  fontSize: 9.5,
  fontWeight: font.weight.semibold,
  color: color.text2,
  background: color.bg3,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const RISK_PILL: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  border: "1px solid",
  borderRadius: radius.pill,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};
