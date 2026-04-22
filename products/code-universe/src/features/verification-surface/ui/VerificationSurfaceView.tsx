// VerificationSurfaceView — how well can an agent self-check this file?
// --------------------------------------------------------------------
// Hero: big verifiabilityScore (0..100) + A-E tier badge. Middle: two
// gauge circles — assertions / symbol (sweet spot 2-4) and covered-
// symbols % (target ≥ 80). Bottom: per-symbol table with name, kind
// pill, LoC, tests badge, verifiable? checkmark — 0-test rows tinted
// warn. Right rail: agent self-check strategy picked by score tier.
//
// Reference: Yang et al. "SWE-agent: Agent-Computer Interfaces Enable
// Automated Software Engineering" 2024; Chen et al. "AgentVerify:
// Verification Strategies for LLM Agents" 2024.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  symbolsInFile,
  verificationSurface,
  type SymbolKind,
  type SynthSymbol,
  type VerifSurface,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

type Tier = "A" | "B" | "C" | "D" | "E";

interface TierDef {
  key: Tier;
  min: number;
  tint: string;
  label: string;
}

const TIERS: readonly TierDef[] = [
  { key: "A", min: 80, tint: color.success, label: "Agent-safe" },
  { key: "B", min: 60, tint: "#7db843",     label: "Mostly self-checkable" },
  { key: "C", min: 40, tint: color.warn,    label: "Needs oversight" },
  { key: "D", min: 20, tint: "#e06a21",     label: "Human-driven" },
  { key: "E", min: 0,  tint: color.danger,  label: "AI unsafe" },
];

function tierOf(score: number): TierDef {
  for (const t of TIERS) if (score >= t.min) return t;
  return TIERS[TIERS.length - 1]!;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes vs-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes vs-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vs-row   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vs-ring  { from { stroke-dashoffset: var(--circ); } to { stroke-dashoffset: var(--offset); } }
`;

const KIND_GLYPH: Record<SymbolKind, string> = {
  class: "◼",
  interface: "◇",
  function: "ƒ",
  method: "⋄",
  variable: "x",
};

const KIND_HUE: Record<SymbolKind, string> = {
  class: "#3d3d3d",
  interface: "#7e4ed6",
  function: "#0d99ff",
  method: "#22a06b",
  variable: "#e09321",
};

function strategyOf(score: number): { title: string; body: string; tint: string } {
  if (score >= 70) {
    return {
      title: "agent can run tests + verify changes",
      body: "Fully self-checkable. Agent executes test suite after each patch and rolls back on failure. Minimal human review.",
      tint: color.success,
    };
  }
  if (score >= 30) {
    return {
      title: "agent needs human oversight",
      body: "Partial test coverage. Agent should gate commits behind reviewer approval; prefer small diffs per turn.",
      tint: color.warn,
    };
  }
  return {
    title: "human-driven; AI unsafe",
    body: "Insufficient assertions to catch regressions. Do NOT let an agent modify autonomously — use as read-only context only.",
    tint: color.danger,
  };
}

function VerificationSurfaceViewImpl({ entity, empty }: Props): ReactElement {
  const data: VerifSurface | null = useMemo(() => {
    if (!entity) return null;
    return verificationSurface(entity);
  }, [entity]);

  const symbols: SynthSymbol[] = useMemo(() => {
    if (!entity) return [];
    return symbolsInFile(entity);
  }, [entity]);

  if (empty || !entity || !data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const tier = tierOf(data.verifiabilityScore);
  const strategy = strategyOf(data.verifiabilityScore);

  const coveredCount = symbols.filter(s => s.tests > 0).length;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Verification Surface · <span style={fileNameStyle}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            agent self-check capacity · assertion/symbol × covered %
          </div>
        </div>
        <div style={refStyle}>
          SWE-agent (2024) · AgentVerify (Chen 2024)
        </div>
      </header>

      <section style={topGrid}>
        {/* Hero ring + tier. */}
        <div style={heroCard}>
          <HeroRing score={data.verifiabilityScore} tint={tier.tint} />
          <div style={{ display: "flex", flexDirection: "column", gap: space[2], alignItems: "flex-start" }}>
            <div style={heroLabel}>verifiability</div>
            <div
              style={{
                width: 60, height: 60, borderRadius: "50%",
                background: tier.tint, color: "#ffffff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: font.mono, fontSize: 28, fontWeight: font.weight.bold,
                boxShadow: `0 6px 14px ${tier.tint}33`,
              }}
            >
              {tier.key}
            </div>
            <div style={{ fontSize: font.size.xs, color: color.text2 }}>
              {tier.label}
            </div>
          </div>
        </div>

        {/* Two gauges. */}
        <div style={gaugeWrap}>
          <Gauge
            label="assertions / symbol"
            value={data.assertionsPerSymbol}
            sweetMin={2}
            sweetMax={4}
            max={6}
            format={(v) => v.toFixed(2)}
            index={1}
          />
          <Gauge
            label="covered symbols"
            value={data.coveredSymbolsPct * 100}
            sweetMin={80}
            sweetMax={100}
            max={100}
            format={(v) => `${v.toFixed(1)}%`}
            index={2}
            unit="%"
          />
        </div>

        {/* Strategy panel. */}
        <aside style={strategyCard}>
          <div style={heroLabel}>agent self-check strategy</div>
          <div style={{ ...strategyTitle, color: strategy.tint }}>
            {strategy.title}
          </div>
          <div style={strategyBody}>
            {strategy.body}
          </div>
          <div style={strategyFooter}>
            <span style={mutedMono}>
              {data.assertionTotal} assertions · {data.symbolTotal} symbols · {coveredCount} covered
            </span>
          </div>
        </aside>
      </section>

      <section style={sectionWrap}>
        <div style={sectionHead}>
          <span style={sectionLabel}>per-symbol verifiability</span>
          <span style={mutedMono}>0-test rows tinted warn · verifiable? needs tests ≥ 1</span>
        </div>
        <div style={tableWrap}>
          <div style={tableHeader}>
            <span style={{ ...th, width: 40, textAlign: "center" }}>kind</span>
            <span style={{ ...th, flex: 2 }}>name</span>
            <span style={{ ...th, width: 72, textAlign: "right" }}>LoC</span>
            <span style={{ ...th, width: 72, textAlign: "right" }}>asserts</span>
            <span style={{ ...th, width: 90 }}>tests</span>
            <span style={{ ...th, width: 100 }}>verifiable?</span>
          </div>
          {symbols.length === 0 ? (
            <div style={emptyRow}>심볼이 없습니다.</div>
          ) : (
            symbols.map((s, i) => {
              const assertions = s.tests * 2;
              const covered = s.tests > 0;
              return (
                <div
                  key={s.id}
                  style={{
                    ...symRow,
                    background: covered ? "transparent" : `color-mix(in srgb, ${color.warn} 7%, white)`,
                    animationDelay: `${120 + Math.min(i, 40) * STAGGER_MS}ms`,
                  }}
                >
                  <span style={{ width: 40, display: "flex", justifyContent: "center" }}>
                    <span
                      title={s.kind}
                      style={{
                        fontFamily: font.mono,
                        fontSize: font.size.lg,
                        color: KIND_HUE[s.kind],
                        lineHeight: 1,
                      }}
                    >
                      {KIND_GLYPH[s.kind]}
                    </span>
                  </span>
                  <span style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span style={symName}>{s.name}</span>
                    <span style={symKind}>{s.kind} · line {s.line}</span>
                  </span>
                  <span style={{ ...numCell, width: 72 }}>{s.loc}</span>
                  <span style={{ ...numCell, width: 72 }}>{assertions}</span>
                  <span style={{ width: 90 }}>
                    <TestsBadge tests={s.tests} />
                  </span>
                  <span style={{ width: 100 }}>
                    <VerifiableMark covered={covered} />
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function HeroRing({ score, tint }: { score: number; tint: string }): ReactElement {
  const R = 66;
  const circ = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, score / 100));
  const offset = circ * (1 - pct);
  return (
    <div style={ringWrap}>
      <svg width={170} height={170} viewBox="-85 -85 170 170">
        <circle cx={0} cy={0} r={R} fill="none" stroke={color.bg3} strokeWidth={10} />
        <circle
          cx={0} cy={0} r={R} fill="none"
          stroke={tint} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          style={{
            ["--circ" as string]: circ.toString(),
            ["--offset" as string]: offset.toString(),
            animation: `vs-ring 900ms cubic-bezier(0.22, 1, 0.28, 1) both`,
          }}
          transform="rotate(-90)"
        />
        <text
          x={0} y={-2}
          textAnchor="middle"
          fontFamily={font.mono}
          fontSize={32}
          fontWeight={font.weight.bold}
          fill={color.text0}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {score}
        </text>
        <text
          x={0} y={18}
          textAnchor="middle"
          fontFamily={font.sans}
          fontSize={11}
          fill={color.text2}
        >
          / 100
        </text>
      </svg>
    </div>
  );
}

function Gauge({
  label, value, sweetMin, sweetMax, max, format, index, unit,
}: {
  label: string;
  value: number;
  sweetMin: number;
  sweetMax: number;
  max: number;
  format: (v: number) => string;
  index: number;
  unit?: string;
}): ReactElement {
  const R = 48;
  const circ = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circ * (1 - pct);
  const inSweet = value >= sweetMin && value <= sweetMax;
  const tint = inSweet ? color.success : value < sweetMin ? color.warn : color.accent;

  return (
    <div
      style={{
        ...gaugeCard,
        animationDelay: `${index * STAGGER_MS}ms`,
      }}
    >
      <svg width={130} height={130} viewBox="-65 -65 130 130">
        <circle cx={0} cy={0} r={R} fill="none" stroke={color.bg3} strokeWidth={8} />
        <circle
          cx={0} cy={0} r={R} fill="none"
          stroke={tint} strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          style={{
            ["--circ" as string]: circ.toString(),
            ["--offset" as string]: offset.toString(),
            animation: `vs-ring 900ms cubic-bezier(0.22, 1, 0.28, 1) both`,
          }}
          transform="rotate(-90)"
        />
        <text
          x={0} y={-2}
          textAnchor="middle"
          fontFamily={font.mono}
          fontSize={22}
          fontWeight={font.weight.bold}
          fill={tint}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {format(value)}
        </text>
        {!unit && (
          <text
            x={0} y={16}
            textAnchor="middle"
            fontFamily={font.sans}
            fontSize={9}
            fill={color.text2}
          >
            sweet {sweetMin}–{sweetMax}
          </text>
        )}
        {unit && (
          <text
            x={0} y={16}
            textAnchor="middle"
            fontFamily={font.sans}
            fontSize={9}
            fill={color.text2}
          >
            target ≥ {sweetMin}%
          </text>
        )}
      </svg>
      <div style={gaugeLabel}>{label}</div>
      <div style={gaugeHint}>
        {inSweet ? "in sweet spot" : value < sweetMin ? "below target" : "above sweet spot"}
      </div>
    </div>
  );
}

function TestsBadge({ tests }: { tests: number }): ReactElement {
  const zero = tests === 0;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 8px",
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        fontWeight: font.weight.semibold,
        background: zero ? "#fef3c7" : "#d1fae5",
        color: zero ? "#92400e" : "#065f46",
        borderRadius: radius.sm,
      }}
    >
      {tests} tests
    </span>
  );
}

function VerifiableMark({ covered }: { covered: boolean }): ReactElement {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        fontWeight: font.weight.semibold,
        color: covered ? color.success : color.text3,
      }}
    >
      <span
        style={{
          width: 16, height: 16,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: covered ? color.success : color.bg3,
          color: covered ? "#ffffff" : color.text3,
          fontSize: 10,
          fontWeight: font.weight.bold,
        }}
      >
        {covered ? "✓" : "—"}
      </span>
      <span>{covered ? "yes" : "no"}</span>
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `vs-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  minHeight: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontSize: font.size.md,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  marginBottom: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const fileNameStyle: CSSProperties = {
  color: color.text1,
  fontWeight: font.weight.medium,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const refStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const topGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(300px, 1fr) minmax(280px, 1fr) minmax(260px, 1fr)",
  gap: space[3],
  marginBottom: space[5],
};

const heroCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[4],
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `vs-tile 460ms ${ENTRY_EASE} both`,
};

const ringWrap: CSSProperties = {
  flexShrink: 0,
};

const heroLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const gaugeWrap: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: space[3],
};

const gaugeCard: CSSProperties = {
  flex: 1,
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  animation: `vs-tile 460ms ${ENTRY_EASE} both`,
};

const gaugeLabel: CSSProperties = {
  marginTop: 2,
  fontSize: font.size.xs,
  color: color.text0,
  fontWeight: font.weight.semibold,
  textAlign: "center",
};

const gaugeHint: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const strategyCard: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  animation: `vs-tile 460ms ${ENTRY_EASE} both`,
  animationDelay: "120ms",
};

const strategyTitle: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  lineHeight: 1.3,
};

const strategyBody: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  lineHeight: 1.5,
};

const strategyFooter: CSSProperties = {
  marginTop: "auto",
  paddingTop: space[2],
  borderTop: `1px solid ${color.borderSoft}`,
};

const sectionWrap: CSSProperties = {
  marginBottom: space[5],
};

const sectionHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const sectionLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const mutedMono: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const tableWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const tableHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[4]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
};

const th: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const symRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  transition: `background ${transition.base}`,
  animation: `vs-row 380ms ${ENTRY_EASE} both`,
};

const symName: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const symKind: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
};

const numCell: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const emptyRow: CSSProperties = {
  padding: space[5],
  textAlign: "center",
  color: color.text3,
  fontSize: font.size.sm,
};

export const VerificationSurfaceView = memo(VerificationSurfaceViewImpl);
