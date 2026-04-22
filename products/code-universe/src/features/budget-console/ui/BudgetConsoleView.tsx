// BudgetConsoleView — monthly AI spend governance.
// --------------------------------------------------------------------
// Top:    hero current-month with cap + alert banner + days-left chip.
// Middle: 12-month bar-chart history with cap line; over-cap bars red.
// Bottom: current-month stacked category bar (5 buckets) + legend.
// Right:  top-5 spenders + projected end-of-month spend.
//
// Reference:
//   - FinOps Foundation — framework for managing cloud / AI spend.
//   - AWS / GCP billing dashboards — monthly run-rate + category
//     breakdown pattern.
//   - Anthropic Admin API — organization-level cost tracking.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  authorHue,
  hashId,
  mulberry32,
  synthBudget,
  type BudgetMonth,
} from "../../../shared/analytics/synth-metrics";

const KEYFRAMES = `
@keyframes bcEnter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes bcBar   { 0% { transform: scaleY(0); } 100% { transform: scaleY(1); } }
@keyframes bcStack { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
@keyframes bcRow   { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
`;

const CATEGORY_ORDER: Array<keyof BudgetMonth["breakdown"]> = [
  "taskManagement",
  "codeReview",
  "testGeneration",
  "refactoring",
  "explanation",
];

const CATEGORY_LABEL: Record<keyof BudgetMonth["breakdown"], string> = {
  taskManagement: "task mgmt",
  codeReview: "code review",
  testGeneration: "test gen",
  refactoring: "refactor",
  explanation: "explain",
};

const CATEGORY_COLOR: Record<keyof BudgetMonth["breakdown"], string> = {
  taskManagement: color.accent,
  codeReview: "#7e4ed6",
  testGeneration: color.success,
  refactoring: color.warn,
  explanation: "#f59e0b",
};

const TOP_SPENDERS = [
  { name: "Platform team", amount: 0 },
  { name: "Growth team",   amount: 0 },
  { name: "Infra team",    amount: 0 },
  { name: "Jo (founder)",  amount: 0 },
  { name: "Kim (staff)",   amount: 0 },
];

interface Props {
  ctx: ViewContextValue;
}

function BudgetConsoleViewImpl(_props: Props): ReactElement {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const months = useMemo(() => synthBudget(12), []);
  const current = months[months.length - 1]!;
  const maxSpent = useMemo(
    () => Math.max(current.capUsd, ...months.map(m => m.spentUsd)),
    [months, current.capUsd],
  );

  // Days left in month + projection.
  const { daysInMonth, daysElapsed, daysLeft, projected } = useMemo(() => {
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const elapsed = now.getDate();
    const left = Math.max(0, dim - elapsed);
    // Linear projection: current spent / elapsed × total days in month.
    const proj = elapsed === 0 ? current.spentUsd : (current.spentUsd / elapsed) * dim;
    return { daysInMonth: dim, daysElapsed: elapsed, daysLeft: left, projected: proj };
  }, [current.spentUsd]);

  // Allocate spenders from current month's spent.
  const spenders = useMemo(() => {
    const rng = mulberry32(hashId("budget-spenders"));
    const weights = TOP_SPENDERS.map(() => 0.5 + rng());
    const wsum = weights.reduce((a, b) => a + b, 0);
    return TOP_SPENDERS.map((s, i) => ({
      ...s,
      amount: current.spentUsd * (weights[i]! / wsum),
    })).sort((a, b) => b.amount - a.amount);
  }, [current.spentUsd]);

  const pct = current.spentUsd / current.capUsd;
  const over = pct > 1;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Budget Console</div>
          <div style={subtitleStyle}>
            월별 AI 지출 거버넌스 — FinOps Framework · AWS / GCP billing · Anthropic Admin API
          </div>
        </div>
        <div style={daysChipStyle}>
          <span style={{ color: color.text2 }}>이번 달</span>
          <span style={{ fontWeight: font.weight.semibold, color: color.text0 }}>
            {daysElapsed} / {daysInMonth}일
          </span>
          <span style={{ color: color.text2 }}>· {daysLeft}일 남음</span>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          ...heroCardStyle,
          borderColor: over ? color.danger : color.border,
          background: over ? `${color.danger}0e` : color.bg2,
        }}
      >
        <div style={heroLeftStyle}>
          <div style={heroLabelStyle}>Current month · spent / cap</div>
          <div style={{ ...heroAmountStyle, color: over ? color.danger : color.text0 }}>
            {formatUsd(current.spentUsd)}
            <span style={{ color: color.text2, fontWeight: font.weight.regular, fontSize: font.size.xl }}>
              {" / "}{formatUsd(current.capUsd)}
            </span>
          </div>
          <div style={heroBarWrapStyle}>
            <div
              style={{
                ...heroBarFillStyle,
                width: `${Math.min(pct, 1.3) * 100}%`,
                background: over ? color.danger : pct > 0.8 ? color.warn : color.accent,
              }}
            />
            <div style={{ ...capLineStyle, left: `${(current.capUsd / Math.max(current.spentUsd, current.capUsd)) * 100}%` }} />
          </div>
        </div>
        {over ? (
          <div style={alertBannerStyle}>
            <div style={alertTitleStyle}>⚠ 예산 초과</div>
            <div style={alertBodyStyle}>
              월 한도 {formatUsd(current.capUsd)} 을 {formatUsd(current.spentUsd - current.capUsd)} 초과했습니다.
            </div>
          </div>
        ) : (
          <div style={projBannerStyle}>
            <div style={projLabelStyle}>월말 예상</div>
            <div style={projAmountStyle}>{formatUsd(projected)}</div>
            <div style={projSubStyle}>
              {projected > current.capUsd
                ? `한도 ${formatUsd(projected - current.capUsd)} 초과 예상`
                : `한도 내 ${formatUsd(current.capUsd - projected)} 여유`}
            </div>
          </div>
        )}
      </section>

      <div style={midGridStyle}>
        {/* 12mo history bar chart */}
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>12-month history</div>
          <div style={historyChartWrapStyle}>
            <HistoryChart months={months} maxSpent={maxSpent} cap={current.capUsd} />
          </div>
        </section>

        {/* Top spenders sidebar */}
        <aside style={panelStyle}>
          <div style={panelHeaderStyle}>Top spenders · this month</div>
          <div style={{ padding: space[3], display: "flex", flexDirection: "column", gap: space[2] }}>
            {spenders.map((s, i) => (
              <div
                key={s.name}
                style={{
                  ...spenderRowStyle,
                  animationDelay: `${Math.min(i * 20, 200)}ms`,
                }}
              >
                <span style={{ ...authorDotStyle, background: `hsl(${authorHue(s.name)} 68% 62%)` }} />
                <span style={spenderNameStyle}>{s.name}</span>
                <span style={spenderAmountStyle}>{formatUsd(s.amount)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Current-month breakdown */}
      <section style={panelStyle}>
        <div style={panelHeaderStyle}>This month · breakdown</div>
        <div style={{ padding: space[3] }}>
          <div style={stackedBarStyle}>
            {CATEGORY_ORDER.map((k, i) => {
              const v = current.breakdown[k];
              const pctOf = current.spentUsd === 0 ? 0 : v / current.spentUsd;
              return (
                <div
                  key={k}
                  title={`${CATEGORY_LABEL[k]} · ${formatUsd(v)} · ${(pctOf * 100).toFixed(1)}%`}
                  style={{
                    flexBasis: `${pctOf * 100}%`,
                    background: CATEGORY_COLOR[k],
                    animation: "bcStack 560ms cubic-bezier(0.22, 1, 0.28, 1) both",
                    animationDelay: `${i * 60}ms`,
                    transformOrigin: "left center",
                  }}
                />
              );
            })}
          </div>
          <div style={stackedLegendStyle}>
            {CATEGORY_ORDER.map(k => {
              const v = current.breakdown[k];
              const pctOf = current.spentUsd === 0 ? 0 : v / current.spentUsd;
              return (
                <div key={k} style={legendItemStyle}>
                  <span style={{ ...legendDotStyle, background: CATEGORY_COLOR[k] }} />
                  <span style={legendLabelStyle}>{CATEGORY_LABEL[k]}</span>
                  <span style={legendValueStyle}>{formatUsd(v)}</span>
                  <span style={legendPctStyle}>{(pctOf * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function HistoryChart({
  months, maxSpent, cap,
}: { months: BudgetMonth[]; maxSpent: number; cap: number }): ReactElement {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const H = 180;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", height: H, gap: space[1], padding: `${space[3]}px 0`, position: "relative" }}>
        {/* Cap line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: H - (cap / maxSpent) * H + 12,
            height: 0,
            borderTop: `1px dashed ${color.borderStrong}`,
            pointerEvents: "none",
          }}
        />
        {months.map((m, i) => {
          const h = (m.spentUsd / maxSpent) * H;
          const over = m.spentUsd > cap;
          const isCurrent = i === months.length - 1;
          const isHover = hoverIdx === i;
          return (
            <div
              key={i}
              style={{ flex: 1, position: "relative", height: "100%", display: "flex", alignItems: "flex-end" }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: `${radius.xs}px ${radius.xs}px 0 0`,
                  background: over ? color.danger : isCurrent ? color.accent : color.text1,
                  opacity: isHover ? 1 : 0.85,
                  transformOrigin: "bottom center",
                  animation: "bcBar 560ms cubic-bezier(0.22, 1, 0.28, 1) both",
                  animationDelay: `${i * 30}ms`,
                  transition: "opacity 120ms ease-out",
                }}
              />
              {isHover && (
                <div style={barTooltipStyle}>
                  {monthLabel(m.monthIdx, months.length)} · {formatUsd(m.spentUsd)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* x-axis */}
      <div style={{ display: "flex", gap: space[1], fontSize: font.size.xxs, color: color.text3, marginTop: 4 }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: font.mono }}>
            {i % 2 === 0 ? shortMonth(m.monthIdx, months.length) : ""}
          </div>
        ))}
      </div>
      <div style={{ marginTop: space[1], fontSize: font.size.xxs, color: color.text3 }}>
        점선 = 월 한도 {formatUsd(cap)} · 빨간 막대 = 초과
      </div>
    </div>
  );
}

function monthLabel(monthIdx: number, total: number): string {
  // monthIdx is 0..total-1, total-1 = current.
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - (total - 1 - monthIdx), 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonth(monthIdx: number, total: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - (total - 1 - monthIdx), 1);
  return String(target.getMonth() + 1);
}

function formatUsd(n: number): string {
  if (n < 0.01) return "<$0.01";
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
}

// ── Styles ────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  background: color.bg0,
  padding: `${space[6]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: space[4],
  fontFamily: font.sans,
  color: color.text0,
  animation: "bcEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  overflow: "auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  marginTop: space[1],
};

const daysChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  fontSize: font.size.xs,
};

const heroCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: space[4],
  padding: space[4],
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  background: color.bg2,
  transition: "background 180ms ease-out, border-color 180ms ease-out",
};

const heroLeftStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const heroAmountStyle: CSSProperties = {
  fontSize: 36,
  fontWeight: font.weight.bold,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
};

const heroBarWrapStyle: CSSProperties = {
  position: "relative",
  height: 10,
  borderRadius: radius.pill,
  background: color.bg3,
  overflow: "hidden",
  marginTop: space[2],
};

const heroBarFillStyle: CSSProperties = {
  height: "100%",
  transition: "width 560ms cubic-bezier(0.22, 1, 0.28, 1)",
};

const capLineStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 2,
  background: color.text0,
};

const alertBannerStyle: CSSProperties = {
  padding: space[3],
  background: color.danger,
  color: color.bg0,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  gap: space[1],
};

const alertTitleStyle: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.bold,
};

const alertBodyStyle: CSSProperties = {
  fontSize: font.size.xs,
  lineHeight: 1.5,
  opacity: 0.92,
};

const projBannerStyle: CSSProperties = {
  padding: space[3],
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const projLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const projAmountStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
};

const projSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
};

const midGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gap: space[4],
};

const panelStyle: CSSProperties = {
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const panelHeaderStyle: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
  background: color.bg0,
  borderBottom: `1px solid ${color.border}`,
};

const historyChartWrapStyle: CSSProperties = {
  padding: space[3],
};

const barTooltipStyle: CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: "50%",
  transform: "translateX(-50%) translateY(-4px)",
  padding: "2px 8px",
  background: color.text0,
  color: color.bg0,
  fontSize: font.size.xxs,
  borderRadius: radius.sm,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

const spenderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontSize: font.size.xs,
  animation: "bcRow 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const authorDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
};

const spenderNameStyle: CSSProperties = {
  flex: 1,
  color: color.text0,
};

const spenderAmountStyle: CSSProperties = {
  color: color.text1,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const stackedBarStyle: CSSProperties = {
  display: "flex",
  height: 22,
  borderRadius: radius.pill,
  overflow: "hidden",
  background: color.bg3,
  border: `1px solid ${color.border}`,
};

const stackedLegendStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[4],
  marginTop: space[3],
};

const legendItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: font.size.xs,
};

const legendDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 2,
};

const legendLabelStyle: CSSProperties = {
  color: color.text1,
};

const legendValueStyle: CSSProperties = {
  color: color.text0,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const legendPctStyle: CSSProperties = {
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

export const BudgetConsoleView = memo(BudgetConsoleViewImpl);
