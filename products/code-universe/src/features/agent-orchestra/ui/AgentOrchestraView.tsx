// AgentOrchestraView — multi-agent pipeline configurator.
// --------------------------------------------------------------------
// Top: 3 hero stats (total avg duration · total avg cost · end-to-end
// success rate). Mid: 5-step pipeline row with arrows, each step
// clickable to expand detail. Bottom: recent-runs mock list.
//
// Reference:
//   - Anthropic "Building effective agents" (2024).
//   - LangGraph multi-agent (2024) — graph-based agent orchestration.
//   - CrewAI — role-based agent crews.
//   - AutoGen (Microsoft 2023) — conversational multi-agent framework.

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
  hashId,
  mulberry32,
  synthAgentPipeline,
  type AgentRole,
  type PipelineStep,
} from "../../../shared/analytics/synth-metrics";

const KEYFRAMES = `
@keyframes aoEnter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes aoStep  { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes aoBar   { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
`;

const ROLE_ICON: Record<AgentRole, string> = {
  planner: "◇",
  coder: "ƒ",
  reviewer: "◉",
  tester: "✓",
  documenter: "¶",
};

const ROLE_COLOR: Record<AgentRole, string> = {
  planner: "#7e4ed6",
  coder: color.accent,
  reviewer: color.warn,
  tester: color.success,
  documenter: color.text1,
};

const ROLE_LABEL: Record<AgentRole, string> = {
  planner: "Planner",
  coder: "Coder",
  reviewer: "Reviewer",
  tester: "Tester",
  documenter: "Documenter",
};

interface Props {
  ctx: ViewContextValue;
}

function AgentOrchestraViewImpl(_props: Props): ReactElement {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const steps = useMemo(() => synthAgentPipeline(), []);

  const { totalDuration, totalCost, endToEndSuccess } = useMemo(() => {
    const dur = steps.reduce((a, s) => a + s.avgDurationSec, 0);
    const cost = steps.reduce((a, s) => a + s.avgCostUsd, 0);
    const success = steps.reduce((a, s) => a * s.successRate, 1);
    return { totalDuration: dur, totalCost: cost, endToEndSuccess: success };
  }, [steps]);

  const recentRuns = useMemo(() => {
    const rng = mulberry32(hashId("orchestra-runs"));
    const now = Date.now();
    return Array.from({ length: 6 }, (_, i) => {
      const r = rng();
      const outcome: "success" | "failure" | "partial" =
        r < 0.7 ? "success" : r < 0.85 ? "partial" : "failure";
      const durationScale = 0.7 + rng() * 0.9;
      const costScale = 0.6 + rng() * 0.9;
      return {
        id: `run-${i}`,
        startedAt: now - Math.floor(rng() * 3 * 86_400_000),
        outcome,
        duration: totalDuration * durationScale,
        cost: totalCost * costScale,
        task: PIPELINE_TASKS[Math.floor(rng() * PIPELINE_TASKS.length)]!,
      };
    });
  }, [totalDuration, totalCost]);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Agent Orchestra</div>
          <div style={subtitleStyle}>
            다중 에이전트 파이프라인 — LangGraph · CrewAI · Anthropic "Building effective agents" (2024) · AutoGen
          </div>
        </div>
      </header>

      {/* Hero stats */}
      <div style={heroGridStyle}>
        <HeroTile label="Pipeline duration" value={formatDuration(totalDuration)} sub="per run (avg)" tone="neutral" index={0} />
        <HeroTile label="Pipeline cost" value={formatUsd(totalCost)} sub="per run (avg)" tone="accent" index={1} />
        <HeroTile label="End-to-end success" value={`${(endToEndSuccess * 100).toFixed(1)}%`} sub={`= ${steps.map(s => (s.successRate * 100).toFixed(0)).join("·")}%`} tone={endToEndSuccess >= 0.65 ? "success" : "warn"} index={2} />
      </div>

      {/* Pipeline row */}
      <div style={pipelineWrapStyle}>
        <div style={pipelineRowStyle}>
          {steps.map((step, i) => (
            <div key={step.role} style={stepWithArrowStyle}>
              <StepCard
                step={step}
                index={i}
                expanded={expandedIdx === i}
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              />
              {i < steps.length - 1 && <Arrow index={i} />}
            </div>
          ))}
        </div>

        {expandedIdx !== null && steps[expandedIdx] && (
          <StepDetail step={steps[expandedIdx]} />
        )}
      </div>

      {/* Recent runs */}
      <section style={recentSectionStyle}>
        <div style={sectionHeadingStyle}>Recent runs</div>
        <div style={runListStyle}>
          {recentRuns.map((r, i) => (
            <div
              key={r.id}
              style={{
                ...runRowStyle,
                animationDelay: `${Math.min(i * 18, 400)}ms`,
              }}
            >
              <span style={runTimeStyle}>{relTime(r.startedAt)}</span>
              <span style={runTaskStyle}>{r.task}</span>
              <span style={outcomeDotStyle(r.outcome)} />
              <span style={runOutcomeLabel(r.outcome)}>{r.outcome}</span>
              <span style={runStatsStyle}>{formatDuration(r.duration)}</span>
              <span style={runStatsStyle}>{formatUsd(r.cost)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const PIPELINE_TASKS = [
  "Fix hover state in SeesoftView",
  "Refactor canvas-engine packer",
  "Add AI-native task-queue view",
  "Fix CI artifact path regression",
  "Resolve cochange circular dep",
  "Migrate tests to vitest 1.6",
];

function HeroTile({
  label, value, sub, tone, index,
}: { label: string; value: string; sub: string; tone: "neutral" | "accent" | "success" | "warn"; index: number }): ReactElement {
  const toneColor =
    tone === "accent" ? color.accent :
    tone === "success" ? color.success :
    tone === "warn" ? color.warn :
    color.text0;
  return (
    <div
      style={{
        ...heroTileStyle,
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ ...heroValueStyle, color: toneColor }}>{value}</div>
      <div style={heroSubStyle}>{sub}</div>
    </div>
  );
}

function StepCard({
  step, index, expanded, onClick,
}: { step: PipelineStep; index: number; expanded: boolean; onClick: () => void }): ReactElement {
  const c = ROLE_COLOR[step.role];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...stepCardStyle,
        borderColor: expanded ? c : color.border,
        boxShadow: expanded ? `0 0 0 2px ${c}28` : "none",
        animationDelay: `${index * 70}ms`,
      }}
    >
      <div style={{ ...roleIconStyle, color: c, background: `${c}18`, borderColor: `${c}55` }}>
        {ROLE_ICON[step.role]}
      </div>
      <div style={stepRoleLabelStyle}>{ROLE_LABEL[step.role]}</div>
      <div style={modelPillStyle}>{step.model}</div>
      <div style={stepStatsRowStyle}>
        <span style={{ ...stepStatStyle, color: color.text1 }}>{step.avgDurationSec}s</span>
        <span style={{ ...stepStatStyle, color: color.text1 }}>{formatUsd(step.avgCostUsd)}</span>
      </div>
      <div style={successBarWrap}>
        <div
          style={{
            ...successBarFill,
            width: `${step.successRate * 100}%`,
            background: c,
          }}
        />
      </div>
      <div style={successLabelStyle}>
        {Math.round(step.successRate * 100)}% success
      </div>
    </button>
  );
}

function StepDetail({ step }: { step: PipelineStep }): ReactElement {
  const c = ROLE_COLOR[step.role];
  return (
    <div style={{ ...stepDetailStyle, borderColor: c }}>
      <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: c, marginBottom: 4 }}>
        {ROLE_LABEL[step.role]} · {step.model}
      </div>
      <div style={{ fontSize: font.size.sm, color: color.text0, lineHeight: 1.5, marginBottom: space[2] }}>
        {step.description}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: space[3] }}>
        <DetailStat label="avg duration" value={`${step.avgDurationSec}s`} />
        <DetailStat label="avg cost" value={formatUsd(step.avgCostUsd)} />
        <DetailStat label="success rate" value={`${Math.round(step.successRate * 100)}%`} />
      </div>
      <div style={{ marginTop: space[3], fontSize: font.size.xxs, color: color.text3 }}>
        Per-step config: model · max_tokens · temperature · system prompt (stub)
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.wide, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.text0, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function Arrow({ index }: { index: number }): ReactElement {
  return (
    <svg
      width={32}
      height={60}
      viewBox="0 0 32 60"
      style={{
        flex: "0 0 auto",
        animation: "aoStep 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
        animationDelay: `${index * 70 + 35}ms`,
      }}
    >
      <line x1={2} y1={30} x2={24} y2={30} stroke={color.borderStrong} strokeWidth={1.5} />
      <path d="M20 25 L28 30 L20 35 Z" fill={color.borderStrong} />
    </svg>
  );
}

function formatDuration(s: number): string {
  if (s < 60) return `${s.toFixed(0)}s`;
  const m = Math.floor(s / 60);
  const rs = s - m * 60;
  return rs === 0 ? `${m}m` : `${m}m ${Math.round(rs)}s`;
}

function formatUsd(n: number): string {
  if (n < 0.01) return "<$0.01";
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
}

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3_600_000);
  if (h === 0) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function outcomeDotStyle(outcome: "success" | "failure" | "partial"): CSSProperties {
  const c = outcome === "success" ? color.success : outcome === "partial" ? color.warn : color.danger;
  return { width: 8, height: 8, borderRadius: "50%", background: c };
}

function runOutcomeLabel(outcome: "success" | "failure" | "partial"): CSSProperties {
  const c = outcome === "success" ? color.success : outcome === "partial" ? color.warn : color.danger;
  return { fontSize: font.size.xxs, color: c, fontWeight: font.weight.semibold, width: 60 };
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
  animation: "aoEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  overflow: "auto",
};

const headerStyle: CSSProperties = {};

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

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: space[3],
};

const heroTileStyle: CSSProperties = {
  padding: space[4],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "aoStep 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const heroValueStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: font.weight.bold,
  marginTop: space[1],
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  marginTop: 4,
};

const pipelineWrapStyle: CSSProperties = {
  padding: space[4],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const pipelineRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: 0,
};

const stepWithArrowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flex: 1,
};

const stepCardStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: space[1],
  padding: space[3],
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  cursor: "pointer",
  fontFamily: font.sans,
  animation: "aoStep 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: "border-color 180ms ease-out, box-shadow 180ms ease-out",
  minWidth: 0,
};

const roleIconStyle: CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  borderRadius: "50%",
  border: `1px solid`,
  fontWeight: font.weight.bold,
};

const stepRoleLabelStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
};

const modelPillStyle: CSSProperties = {
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  color: color.text1,
  background: color.bg3,
  padding: "1px 6px",
  borderRadius: radius.sm,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const stepStatsRowStyle: CSSProperties = {
  display: "flex",
  gap: space[2],
  marginTop: 2,
};

const stepStatStyle: CSSProperties = {
  fontSize: font.size.xxs,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const successBarWrap: CSSProperties = {
  width: "100%",
  height: 4,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
  marginTop: space[1],
};

const successBarFill: CSSProperties = {
  height: "100%",
  transformOrigin: "left center",
  animation: "aoBar 560ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const successLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
};

const stepDetailStyle: CSSProperties = {
  marginTop: space[3],
  padding: space[3],
  background: color.bg0,
  border: `2px solid`,
  borderRadius: radius.md,
  animation: "aoStep 320ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const recentSectionStyle: CSSProperties = {
  padding: space[4],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
  marginBottom: space[2],
};

const runListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const runRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontSize: font.size.xs,
  animation: "aoStep 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const runTimeStyle: CSSProperties = {
  width: 80,
  color: color.text2,
  fontSize: font.size.xxs,
};

const runTaskStyle: CSSProperties = {
  flex: 1,
  color: color.text0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const runStatsStyle: CSSProperties = {
  width: 60,
  textAlign: "right",
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

export const AgentOrchestraView = memo(AgentOrchestraViewImpl);
