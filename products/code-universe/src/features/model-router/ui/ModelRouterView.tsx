// ModelRouterView — per-task × per-model routing recommendations.
// --------------------------------------------------------------------
// Hero: selected file + estimated monthly savings from optimal routing
// (500 tasks/mo × per-task delta summed across 6 tasks). Middle: 6-row
// table, one per task, with recommended model pill + cost, alternative
// (tier up) + cost, savings %. Bottom: accuracy × cost scatter for the
// 5 models on the currently focused task — recommended model carries
// a ring indicator.
//
// Reference: Chen et al. "RouteLLM: Learning to Route LLMs with
// Preference Data" 2024; Ding et al. "FrugalGPT" 2023.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  estimateTaskCost,
  modelRouteRecs,
  type AIModel,
  type AITaskKind,
  type ModelRouteRec,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const MONTHLY_TASKS = 500;

const KEYFRAMES = `
@keyframes mr-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes mr-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes mr-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes mr-dot   { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

const MODEL_LABEL: Record<AIModel, string> = {
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "gpt-5": "GPT-5",
  "gemini-2.5-pro": "Gemini 2.5",
  "gpt-5-mini": "GPT-5 mini",
};

const MODEL_TIER_LABEL: Record<AIModel, string> = {
  "claude-opus-4-7": "flagship",
  "claude-sonnet-4-6": "mid",
  "gpt-5": "mid",
  "gemini-2.5-pro": "mid",
  "gpt-5-mini": "lite",
};

const MODEL_TIER_COLOR: Record<AIModel, string> = {
  "claude-opus-4-7": color.danger,
  "claude-sonnet-4-6": color.warn,
  "gpt-5": color.warn,
  "gemini-2.5-pro": color.accent,
  "gpt-5-mini": color.success,
};

const ALL_MODELS: AIModel[] = [
  "gpt-5-mini",
  "gemini-2.5-pro",
  "gpt-5",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
];

// Tier heuristic accuracy (matches synth-metrics.modelRouteRecs).
const MODEL_TIER_ACC: Record<AIModel, number> = {
  "claude-opus-4-7": 1.0,
  "claude-sonnet-4-6": 0.88,
  "gpt-5": 0.86,
  "gemini-2.5-pro": 0.84,
  "gpt-5-mini": 0.65,
};

function fmtCost(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtMoney(usd: number): string {
  if (usd < 1) return `$${usd.toFixed(2)}`;
  if (usd < 1000) return `$${usd.toFixed(1)}`;
  return `$${usd.toFixed(0)}`;
}

function ModelRouterViewImpl({ ctx, entity, empty }: Props): ReactElement {
  const [focusTask, setFocusTask] = useState<AITaskKind>("explain");

  const recs = useMemo<ModelRouteRec[]>(() => {
    if (!entity || !ctx.tree) return [];
    return modelRouteRecs(entity, ctx.tree, ctx.graph?.fileEdges);
  }, [entity, ctx.tree, ctx.graph?.fileEdges]);

  const scatterData = useMemo(() => {
    if (!entity || !ctx.tree) return null;
    const est = estimateTaskCost(entity, ctx.tree, ctx.graph?.fileEdges, focusTask);
    return ALL_MODELS.map(m => ({
      model: m,
      cost: est.costUsd[m],
      accuracy: MODEL_TIER_ACC[m],
    }));
  }, [entity, ctx.tree, ctx.graph?.fileEdges, focusTask]);

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const totalSavings = recs.reduce((acc, r) => {
    const delta = Math.max(0, r.alternativeCostPerTask - r.recommendedCostPerTask);
    return acc + delta * MONTHLY_TASKS;
  }, 0);

  const recByTask = new Map(recs.map(r => [r.task, r]));
  const focusRec = recByTask.get(focusTask);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Model Router · <span style={fileNameStyle}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            per-task × 5 model 라우팅 · 500 tasks/month 가정
          </div>
        </div>
        <div style={refStyle}>
          RouteLLM (2024) · FrugalGPT (Ding 2023)
        </div>
      </header>

      <section style={heroRow}>
        <div style={{ ...heroCard, flex: 2 }}>
          <div style={heroLabel}>선택 파일</div>
          <div style={heroName}>{entity.name}</div>
          <div style={heroPath} title={entity.path}>{entity.path}</div>
        </div>
        <div style={{ ...heroCard, minWidth: 240 }}>
          <div style={heroLabel}>Est. monthly savings</div>
          <div style={{ ...heroNum, color: color.success }}>
            {fmtMoney(totalSavings)}
          </div>
          <div style={heroSub}>
            optimal routing · {MONTHLY_TASKS} tasks/month
          </div>
        </div>
      </section>

      <section style={sectionWrap}>
        <div style={sectionHead}>
          <span style={sectionLabel}>Per-task routing</span>
          <span style={mutedMono}>tap a row to see scatter · recommended in blue</span>
        </div>
        <div style={tableWrap}>
          <div style={tableHeader}>
            <span style={{ ...th, flex: 1 }}>task</span>
            <span style={{ ...th, flex: 1.4 }}>recommended</span>
            <span style={{ ...th, width: 92, textAlign: "right" }}>cost / task</span>
            <span style={{ ...th, flex: 1.4 }}>alternative</span>
            <span style={{ ...th, width: 92, textAlign: "right" }}>cost / task</span>
            <span style={{ ...th, width: 84, textAlign: "right" }}>savings</span>
          </div>
          {recs.map((r, i) => {
            const active = focusTask === r.task;
            return (
              <button
                key={r.task}
                type="button"
                onClick={() => setFocusTask(r.task)}
                style={{
                  ...taskRow,
                  background: active ? color.accentSofter : "transparent",
                  animationDelay: `${160 + i * STAGGER_MS}ms`,
                }}
              >
                <span style={{ flex: 1 }}>
                  <span style={taskName}>{TASK_KOREAN[r.task]}</span>
                  <span style={taskEng}>{r.task}</span>
                </span>
                <span style={{ flex: 1.4 }}>
                  <ModelPill model={r.recommended} accent />
                </span>
                <span style={{ ...costCell, width: 92 }}>
                  {fmtCost(r.recommendedCostPerTask)}
                </span>
                <span style={{ flex: 1.4 }}>
                  <ModelPill model={r.alternative} />
                </span>
                <span style={{ ...costCell, width: 92, color: color.text2 }}>
                  {fmtCost(r.alternativeCostPerTask)}
                </span>
                <span style={{ width: 84, textAlign: "right" }}>
                  <SavingsPill pct={r.savingsPct} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section style={sectionWrap}>
        <div style={sectionHead}>
          <span style={sectionLabel}>
            accuracy × cost · {TASK_KOREAN[focusTask]}
          </span>
          <span style={mutedMono}>ring = recommended</span>
        </div>
        <div style={scatterWrap}>
          {scatterData ? (
            <ModelScatter
              data={scatterData}
              recommended={focusRec?.recommended ?? null}
              onPick={(m) => {
                // Change focus to whichever task recommended this model
                // (else leave alone).
                const hit = recs.find(r => r.recommended === m);
                if (hit) setFocusTask(hit.task);
              }}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ModelPill({ model, accent }: { model: AIModel; accent?: boolean }): ReactElement {
  const tier = MODEL_TIER_LABEL[model];
  const tierTint = MODEL_TIER_COLOR[model];
  return (
    <span style={modelPillWrap}>
      <span
        style={{
          ...modelPill,
          background: accent ? color.accentSofter : color.bg3,
          borderColor: accent ? color.accentBorder : color.border,
          color: accent ? color.accent : color.text1,
        }}
      >
        {MODEL_LABEL[model]}
      </span>
      <span
        style={{
          ...tierBadge,
          color: tierTint,
          background: `color-mix(in srgb, ${tierTint} 14%, white)`,
        }}
      >
        {tier}
      </span>
    </span>
  );
}

function SavingsPill({ pct }: { pct: number }): ReactElement {
  const positive = pct > 0.01;
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: font.mono,
        fontSize: font.size.xs,
        fontWeight: font.weight.semibold,
        color: positive ? color.success : color.text3,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {positive ? `${(pct * 100).toFixed(1)}%` : "—"}
    </span>
  );
}

function ModelScatter({
  data, recommended, onPick,
}: {
  data: Array<{ model: AIModel; cost: number; accuracy: number }>;
  recommended: AIModel | null;
  onPick: (m: AIModel) => void;
}): ReactElement {
  const W = 720;
  const H = 240;
  const padL = 64, padR = 24, padT = 18, padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const costs = data.map(d => d.cost);
  const costMin = Math.min(...costs);
  const costMax = Math.max(...costs, costMin + 1e-6);
  const logMin = Math.log10(Math.max(1e-5, costMin));
  const logMax = Math.log10(Math.max(1e-4, costMax));
  const logRange = Math.max(0.01, logMax - logMin);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Model accuracy vs cost scatter"
      style={{ display: "block" }}
    >
      {/* Axes grid. */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <g key={`grid-${t}`}>
          <line
            x1={padL} y1={padT + (1 - t) * plotH}
            x2={padL + plotW} y2={padT + (1 - t) * plotH}
            stroke={color.border}
            strokeDasharray="3 4"
            strokeOpacity={0.55}
          />
          <text
            x={padL - 8}
            y={padT + (1 - t) * plotH + 3}
            textAnchor="end"
            fontSize={font.size.xxs}
            fontFamily={font.mono}
            fill={color.text2}
          >
            {(t * 100).toFixed(0)}
          </text>
        </g>
      ))}

      {/* Frame. */}
      <rect
        x={padL} y={padT}
        width={plotW} height={plotH}
        fill="none"
        stroke={color.border}
      />

      {/* Axis labels. */}
      <text
        x={padL + plotW / 2}
        y={H - 8}
        textAnchor="middle"
        fontSize={font.size.xs}
        fontFamily={font.sans}
        fill={color.text1}
        fontWeight={font.weight.medium}
      >
        log₁₀(cost / task USD) → 값싼 쪽
      </text>
      <text
        x={0} y={0}
        textAnchor="middle"
        fontSize={font.size.xs}
        fontFamily={font.sans}
        fill={color.text1}
        fontWeight={font.weight.medium}
        transform={`translate(14, ${padT + plotH / 2}) rotate(-90)`}
      >
        expected accuracy %
      </text>

      {/* Dots. */}
      {data.map((d, i) => {
        const logged = Math.log10(Math.max(1e-5, d.cost));
        const x = padL + ((logged - logMin) / logRange) * plotW;
        const y = padT + (1 - d.accuracy) * plotH;
        const isRec = d.model === recommended;
        const tint = MODEL_TIER_COLOR[d.model];
        return (
          <g
            key={d.model}
            style={{
              cursor: "pointer",
              animation: `mr-dot 520ms ${ENTRY_EASE} both`,
              animationDelay: `${160 + i * 50}ms`,
            }}
            onClick={() => onPick(d.model)}
          >
            {isRec && (
              <circle
                cx={x} cy={y} r={16}
                fill="none"
                stroke={color.accent}
                strokeWidth={1.6}
                opacity={0.9}
              />
            )}
            <circle
              cx={x} cy={y} r={9}
              fill={tint}
              opacity={0.92}
              stroke={color.text0}
              strokeOpacity={0.18}
              strokeWidth={1}
            />
            <text
              x={x} y={y - 16}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fontWeight={font.weight.semibold}
              fill={color.text0}
            >
              {MODEL_LABEL[d.model]}
            </text>
            <text
              x={x} y={y + 22}
              textAnchor="middle"
              fontSize={font.size.xxs}
              fontFamily={font.mono}
              fill={color.text2}
            >
              {fmtCost(d.cost)}
            </text>
          </g>
        );
      })}

      {/* Frontier hint — connecting ascending accuracy in cost order. */}
      {(() => {
        const byCost = [...data].sort((a, b) => a.cost - b.cost);
        const pts = byCost.map(d => {
          const logged = Math.log10(Math.max(1e-5, d.cost));
          const x = padL + ((logged - logMin) / logRange) * plotW;
          const y = padT + (1 - d.accuracy) * plotH;
          return `${x},${y}`;
        });
        return (
          <polyline
            points={pts.join(" ")}
            fill="none"
            stroke={color.accent}
            strokeOpacity={0.25}
            strokeDasharray="4 6"
            strokeWidth={1.2}
          />
        );
      })()}
    </svg>
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
  animation: `mr-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const heroRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: space[3],
  marginBottom: space[5],
};

const heroCard: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  animation: `mr-tile 460ms ${ENTRY_EASE} both`,
};

const heroLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroName: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.lg,
  color: color.text0,
  fontWeight: font.weight.semibold,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const heroPath: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const heroNum: CSSProperties = {
  fontSize: 34,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.6,
};

const heroSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
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
  gap: space[3],
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

const taskRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[3]}px ${space[4]}px`,
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `mr-row 440ms ${ENTRY_EASE} both`,
};

const taskName: CSSProperties = {
  display: "block",
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const taskEng: CSSProperties = {
  display: "block",
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const modelPillWrap: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
};

const modelPill: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  border: "1px solid",
  borderRadius: radius.pill,
};

const tierBadge: CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  fontSize: 8,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  borderRadius: radius.sm,
};

const costCell: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const scatterWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
};

export const ModelRouterView = memo(ModelRouterViewImpl);
