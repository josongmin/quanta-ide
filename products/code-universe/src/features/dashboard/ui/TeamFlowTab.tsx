import type { CSSProperties, ReactElement } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { TeamFlowData } from "../model/types";
import { EmptyState, MetricCard, Section } from "./primitives";

export interface TeamFlowTabProps {
  data: TeamFlowData;
  width: number;
}

export function TeamFlowTab(props: TeamFlowTabProps): ReactElement {
  const { data, width } = props;
  const narrow = width < 960;

  const maxWeekly = Math.max(1, ...data.weeklyActivity.map(w => w.commits));
  const histogram = data.weeklyActivity.map(w => w.commits / maxWeekly);

  return (
    <div style={WRAP}>
      {/* Banner: delivery data not yet connected */}
      <div style={BANNER}>
        <div style={BANNER_ICON}>◌</div>
        <div style={BANNER_TEXT}>
          <div style={BANNER_TITLE}>Delivery feeds not connected</div>
          <div style={BANNER_BODY}>
            DORA and PR flow metrics need a GitHub / GitLab / incident source.
            The cards below are placeholders — blame-derived activity is live.
          </div>
        </div>
        <div style={BANNER_ACTION}>Connect GitHub</div>
      </div>

      <Section title="Flow Health" caption="L1 composite — requires PR + incident feeds">
        <div style={{ ...GRID, gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1fr) minmax(0, 2fr)" }}>
          <MetricCard metric={data.flowScore} tone="accent" />
          <div style={PANEL}>
            <div style={PANEL_TITLE}>Weekly activity (from blame)</div>
            {data.weeklyActivity.length === 0 ? (
              <EmptyState title="No blame data" body="Populate git blame to see commit activity over time." />
            ) : (
              <div style={{ marginTop: space[3] }}>
                <div style={HISTOGRAM_ROW}>
                  {histogram.map((v, i) => (
                    <div key={i} style={{ ...HIST_COL }}>
                      <div style={{
                        width: "100%",
                        height: `${4 + v * 52}px`,
                        background: `linear-gradient(180deg, ${color.accent}cc 0%, ${color.accent}55 100%)`,
                        borderRadius: 3,
                      }} title={`${data.weeklyActivity[i]!.commits} commits · ${data.weeklyActivity[i]!.authors} authors`} />
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: space[2],
                  display: "flex", justifyContent: "space-between",
                  fontSize: 9.5, color: color.text3, fontFamily: font.mono,
                }}>
                  <span>{fmtWeek(data.weeklyActivity[0]?.weekStart)}</span>
                  <span>{fmtWeek(data.weeklyActivity[data.weeklyActivity.length - 1]?.weekStart)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="DORA" caption="four key delivery metrics">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 5}, minmax(0, 1fr))` }}>
          {data.doraMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      <Section title="PR Flow" caption="batch size · latency · rework">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 5}, minmax(0, 1fr))` }}>
          {data.prMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>
      </Section>

      <Section title="People" caption="derived from git blame">
        <div style={{ ...GRID, gridTemplateColumns: `repeat(${narrow ? 2 : 2}, minmax(0, 1fr))` }}>
          <MetricCard metric={data.activeAuthors7d} />
          <MetricCard metric={data.activeAuthors30d} />
        </div>

        <div style={{ ...PANEL, marginTop: space[3] }}>
          <div style={PANEL_TITLE}>Top contributors</div>
          {data.topContributors.length === 0 ? (
            <EmptyState title="No contributors found" body="Blame data may not be loaded." />
          ) : (
            <div style={CONTRIB_LIST}>
              {data.topContributors.map(c => (
                <div key={c.author} style={CONTRIB_ROW}>
                  <div style={CONTRIB_AVATAR}>{initialsOf(c.author)}</div>
                  <div style={CONTRIB_BODY}>
                    <div style={CONTRIB_NAME}>{c.author}</div>
                    <div style={CONTRIB_META}>
                      {c.filesTouched} file{c.filesTouched === 1 ? "" : "s"} · last active {relDays(c.lastActiveAt)}
                    </div>
                  </div>
                  <div style={CONTRIB_PCT_COL}>
                    <div style={CONTRIB_TRACK}>
                      <div style={{ ...CONTRIB_FILL, width: `${Math.min(100, c.percent).toFixed(1)}%` }} />
                    </div>
                    <span style={CONTRIB_PCT_LABEL}>{c.percent.toFixed(0)}%</span>
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

function initialsOf(name: string): string {
  const parts = name.split(/[\s<@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
}

function relDays(at: number | null): string {
  if (!at) return "never";
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function fmtWeek(ts: number | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

const BANNER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[3]}px ${space[4]}px`,
  background: `linear-gradient(135deg, ${color.accent}10 0%, ${color.accent}04 100%)`,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.lg,
  marginBottom: space[5],
};

const BANNER_ICON: CSSProperties = {
  fontSize: 22,
  color: color.accent,
};

const BANNER_TEXT: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const BANNER_TITLE: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const BANNER_BODY: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.tight,
};

const BANNER_ACTION: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: "#ffffff",
  background: color.accent,
  padding: `${space[1]}px ${space[3]}px`,
  borderRadius: radius.pill,
  cursor: "pointer",
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

const HISTOGRAM_ROW: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "1fr",
  gap: 3,
  alignItems: "flex-end",
  height: 60,
};

const HIST_COL: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
};

const CONTRIB_LIST: CSSProperties = {
  marginTop: space[3],
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const CONTRIB_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px 1fr 180px",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px 0`,
  borderBottom: `1px solid ${color.borderSoft}`,
};

const CONTRIB_AVATAR: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10.5,
  fontWeight: font.weight.semibold,
  color: "#ffffff",
  background: color.accent,
  letterSpacing: 0.5,
};

const CONTRIB_BODY: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  minWidth: 0,
};

const CONTRIB_NAME: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.medium,
  color: color.text0,
  letterSpacing: font.letter.tight,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const CONTRIB_META: CSSProperties = {
  fontSize: 10.5,
  color: color.text2,
  letterSpacing: font.letter.tight,
};

const CONTRIB_PCT_COL: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const CONTRIB_TRACK: CSSProperties = {
  flex: 1,
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const CONTRIB_FILL: CSSProperties = {
  height: "100%",
  background: color.accent,
  transition: "width 420ms",
};

const CONTRIB_PCT_LABEL: CSSProperties = {
  fontSize: 11,
  fontFamily: font.mono,
  color: color.text2,
  fontWeight: font.weight.semibold,
  minWidth: 30,
  textAlign: "right",
};
