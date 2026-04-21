import type { CSSProperties, ReactElement } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ThisChangeData } from "../model/types";
import { EmptyState, MetricCard, ScoreRing, Section } from "./primitives";

export interface ThisChangeTabProps {
  data: ThisChangeData;
  width: number;
  onFocusFile?: (fileId: string) => void;
}

export function ThisChangeTab(props: ThisChangeTabProps): ReactElement {
  const { data, width } = props;
  const narrow = width < 960;

  if (!data.hasSelection) {
    return (
      <div style={{ padding: `${space[6]}px 0` }}>
        <EmptyState
          title="Select a file or folder"
          body="Pick a scope from the left panel or the canvas to see its blast radius, cross-service impact, and predicted delta risk."
          action="Click any entity to continue"
        />
      </div>
    );
  }

  const maxRing = Math.max(1, ...data.rings.map(r => r.count));

  return (
    <div style={WRAP}>
      {/* Scope + delta risk hero */}
      <Section
        title="Delta Risk"
        caption="L3 · predicted risk introduced by this change"
        right={
          <span style={CATEGORY_PILL}>
            <span style={{ ...CATEGORY_DOT, background: categoryColor(data.deltaRisk.category) }} />
            {data.deltaRisk.category}
          </span>
        }
      >
        <div style={{ ...HERO, gridTemplateColumns: narrow ? "1fr" : "220px 1fr" }}>
          <ScoreRing
            score={data.deltaRisk.score}
            bucket={data.deltaRisk.bucket}
            label={data.deltaRisk.bucket === "low" ? "Safe delta" : data.deltaRisk.bucket === "medium" ? "Review carefully" : "Wide impact"}
            sub={`confidence · ${data.deltaRisk.confidence}`}
          />

          <div style={SCOPE_COL}>
            <div style={SCOPE_TITLE}>Scope</div>
            <div style={SCOPE_NAME_ROW}>
              <span style={SCOPE_KIND}>{labelFor(data.scope.kind)}</span>
              <span style={SCOPE_NAME} title={data.scope.name}>{data.scope.name}</span>
            </div>
            {data.scope.path ? (
              <div style={SCOPE_PATH} title={data.scope.path}>{data.scope.path}</div>
            ) : null}

            <div style={RINGS_BOX}>
              <div style={RINGS_TITLE}>Blast rings</div>
              <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", height: 72 }}>
                {data.rings.length === 0 ? (
                  <span style={{ fontSize: font.size.xs, color: color.text3, fontStyle: "italic" }}>
                    no downstream files
                  </span>
                ) : (
                  data.rings.map(r => (
                    <div key={r.depth} style={RING_BAR_COL}>
                      <span style={{ ...RING_BAR_VALUE }}>{r.count}</span>
                      <div style={{
                        width: 22,
                        height: `${(r.count / maxRing) * 60 + 4}px`,
                        background: `linear-gradient(180deg, ${color.danger} 0%, ${color.warn} 100%)`,
                        borderRadius: 3,
                      }} />
                      <span style={RING_BAR_LABEL}>d{r.depth}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Blast & Impact" caption="how far this change could reach">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.blastMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      <Section title="Call Graph Impact">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.callGraph.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      {data.crossServiceEdges.length > 0 ? (
        <Section title="Cross-Service Reach" caption={`${data.crossServiceEdges.length} edge${data.crossServiceEdges.length === 1 ? "" : "s"} cross a service boundary`}>
          <div style={CROSS_WRAP}>
            {data.crossServiceEdges.map((e, i) => (
              <div key={i} style={CROSS_ROW}>
                <span style={CROSS_KIND_PILL}>{e.kind}</span>
                <span style={CROSS_ENDPOINT} title={e.from}>{shortPath(e.from)}</span>
                <span style={CROSS_ARROW}>→</span>
                <span style={CROSS_ENDPOINT} title={e.to}>{shortPath(e.to)}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Semantic Diff & API" caption="L3-C · behavior / surface / contract changes">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 3}, minmax(0, 1fr))` }}>
          {data.semanticDiff.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      <Section title="Contract & Findings">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.contractBreak.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      <Section title="Agent Process Risk" caption="L4 · how this change was made">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))` }}>
          {data.processRisk.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>
    </div>
  );
}

function labelFor(kind: "repo" | "folder" | "file" | "symbol"): string {
  if (kind === "file") return "FILE";
  if (kind === "folder") return "FOLDER";
  if (kind === "symbol") return "SYMBOL";
  return "WORKSPACE";
}

function categoryColor(cat: "Proven" | "High-confidence" | "Speculative"): string {
  if (cat === "Proven") return color.danger;
  if (cat === "High-confidence") return color.warn;
  return color.text3;
}

function shortPath(p: string): string {
  if (p.length <= 34) return p;
  return `…${p.slice(-34)}`;
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
  display: "grid",
  gap: space[5],
  alignItems: "center",
  padding: `${space[5]}px ${space[5]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
};

const SCOPE_COL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  minWidth: 0,
};

const SCOPE_TITLE: CSSProperties = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text2,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const SCOPE_NAME_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
  minWidth: 0,
};

const SCOPE_KIND: CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  fontSize: 9,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.4,
  color: color.accent,
  background: color.accentSoft,
  borderRadius: radius.pill,
};

const SCOPE_NAME: CSSProperties = {
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const SCOPE_PATH: CSSProperties = {
  fontSize: 11,
  fontFamily: font.mono,
  color: color.text3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const RINGS_BOX: CSSProperties = {
  marginTop: space[3],
  padding: `${space[3]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.borderSoft}`,
  borderRadius: radius.md,
};

const RINGS_TITLE: CSSProperties = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text2,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  marginBottom: space[2],
};

const RING_BAR_COL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
};

const RING_BAR_VALUE: CSSProperties = {
  fontSize: 10,
  fontFamily: font.mono,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const RING_BAR_LABEL: CSSProperties = {
  fontSize: 9,
  color: color.text3,
  fontWeight: font.weight.semibold,
};

const CATEGORY_PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 9px",
  fontSize: 10,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.4,
  background: color.bg3,
  borderRadius: radius.pill,
  color: color.text1,
  textTransform: "uppercase",
};

const CATEGORY_DOT: CSSProperties = {
  width: 6, height: 6, borderRadius: 999,
};

const CROSS_WRAP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: `${space[3]}px ${space[3]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
};

const CROSS_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 1fr auto 1fr",
  alignItems: "center",
  gap: space[2],
  fontSize: font.size.sm,
  paddingTop: 4,
  paddingBottom: 4,
  borderBottom: `1px solid ${color.borderSoft}`,
};

const CROSS_KIND_PILL: CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  fontSize: 9,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.3,
  color: color.warn,
  background: "rgba(224, 147, 33, 0.12)",
  borderRadius: radius.pill,
  textAlign: "center",
};

const CROSS_ENDPOINT: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 11,
  color: color.text1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const CROSS_ARROW: CSSProperties = {
  color: color.text3,
  fontSize: 14,
};
