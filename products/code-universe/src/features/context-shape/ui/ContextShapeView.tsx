// ContextShapeView — optimal prompt structure per file.
// --------------------------------------------------------------------
// Top:   hero counter (total recommended context tokens across 6 sections).
// Mid:   vertical stacked bar — each section as a block, labeled with
//        name + budget + position-bias chip (front / middle / end),
//        rendered in prompt order (system → memory → query →
//        code-primary → tests → code-neighbor).
// Bottom: per-section detail cards with justification copy.
// Right:  "cache strategy" insight — stable sections (system, memory)
//        marked cache-friendly; volatile sections (query, code-primary)
//        called out.
//
// Reference:
//   - Anthropic "Effective Context Engineering" (2025)
//   - Liu et al. "Lost in the Middle" (ACL 2023)
//   - Anthropic Prompt Caching (2024)
//   - System-prompt design patterns (2024-2025)

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  contextShapeRecommendations,
  type ContextShapeRec,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;
const BAR_MS = 540;

const KEYFRAMES = `
@keyframes cs-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes cs-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cs-bar   { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes cs-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
`;

type SectionId = ContextShapeRec["section"];

const SECTION_LABEL: Record<SectionId, string> = {
  system: "System prompt",
  memory: "Memory / repo facts",
  query: "User query",
  "code-primary": "Primary code",
  tests: "Tests",
  "code-neighbor": "Neighbor code",
};

const SECTION_TINT: Record<SectionId, string> = {
  system: "#7e4ed6",
  memory: color.accent,
  query: color.warn,
  "code-primary": color.success,
  tests: "#0a7acc",
  "code-neighbor": color.text2,
};

const BIAS_LABEL: Record<ContextShapeRec["positionBias"], string> = {
  front: "앞",
  middle: "중간",
  end: "끝",
};

const BIAS_TINT: Record<ContextShapeRec["positionBias"], string> = {
  front: color.success,
  middle: color.warn,
  end: color.accent,
};

// Stable sections benefit from prompt caching; volatile ones don't.
const CACHEABLE: ReadonlySet<SectionId> = new Set(["system", "memory"]);
const VOLATILE: ReadonlySet<SectionId> = new Set(["query", "code-primary"]);

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function ContextShapeViewImpl({ entity, empty }: Props): ReactElement {
  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하면 context shape 권장안이 나타납니다.</div>
      </div>
    );
  }

  const recs = useMemo(() => contextShapeRecommendations(entity), [entity]);
  const totalTokens = useMemo(() => recs.reduce((s, r) => s + r.tokenBudget, 0), [recs]);
  const animated = useCounter(totalTokens, COUNTER_MS);

  const cacheableTokens = useMemo(
    () => recs.filter(r => CACHEABLE.has(r.section)).reduce((s, r) => s + r.tokenBudget, 0),
    [recs],
  );
  const volatileTokens = useMemo(
    () => recs.filter(r => VOLATILE.has(r.section)).reduce((s, r) => s + r.tokenBudget, 0),
    [recs],
  );

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Context Shape · <span style={{ color: color.text1, fontWeight: font.weight.medium }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            6-section 프롬프트 구조 권장안 · position-bias × token budget · Lost-in-Middle 회피
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Anthropic Context Engineering 2025<br />
          Liu Lost-in-Middle 2023 · Anthropic Prompt Caching 2024
        </div>
      </header>

      <section style={heroRowStyle}>
        <div style={heroTileStyle}>
          <div style={heroLabelStyle}>Total recommended context</div>
          <div style={heroNumStyle}>{fmtTokens(animated)}</div>
          <div style={heroSubStyle}>{recs.length}개 섹션 · {fmtTokens(totalTokens)} tokens</div>
        </div>
        <div style={heroTileStyle}>
          <div style={heroLabelStyle}>Cache-friendly prefix</div>
          <div style={{ ...heroNumStyle, color: color.success }}>{fmtTokens(cacheableTokens)}</div>
          <div style={heroSubStyle}>
            {Math.round((cacheableTokens / Math.max(1, totalTokens)) * 100)}% — system + memory
          </div>
        </div>
        <div style={heroTileStyle}>
          <div style={heroLabelStyle}>Volatile suffix</div>
          <div style={{ ...heroNumStyle, color: color.warn }}>{fmtTokens(volatileTokens)}</div>
          <div style={heroSubStyle}>
            {Math.round((volatileTokens / Math.max(1, totalTokens)) * 100)}% — query + primary
          </div>
        </div>
      </section>

      <section style={bodyGridStyle}>
        <div style={stackColumnStyle}>
          <div style={sectionHeadStyle}>Prompt order (top → bottom)</div>
          <StackedColumn recs={recs} total={totalTokens} />
        </div>

        <div style={detailColumnStyle}>
          <div style={sectionHeadStyle}>Per-section detail</div>
          <div style={detailListStyle}>
            {recs.map((r, i) => (
              <SectionDetail key={r.section} rec={r} index={i} total={totalTokens} />
            ))}
          </div>
        </div>

        <aside style={insightColumnStyle}>
          <div style={sectionHeadStyle}>Cache strategy</div>
          <div style={insightCardStyle}>
            <div style={{ fontSize: font.size.sm, color: color.text0, fontWeight: font.weight.semibold, marginBottom: space[2] }}>
              Stable prefix
            </div>
            <div style={{ fontSize: font.size.xxs, color: color.text2, lineHeight: 1.55 }}>
              <strong style={{ color: color.success }}>system</strong> + <strong style={{ color: color.success }}>memory</strong> 는
              여러 턴 동안 바뀌지 않습니다. Anthropic prompt-caching header를 붙이면 {fmtTokens(cacheableTokens)} 토큰만큼 input cost가 90% 절감됩니다.
            </div>
          </div>
          <div style={insightCardStyle}>
            <div style={{ fontSize: font.size.sm, color: color.text0, fontWeight: font.weight.semibold, marginBottom: space[2] }}>
              Volatile suffix
            </div>
            <div style={{ fontSize: font.size.xxs, color: color.text2, lineHeight: 1.55 }}>
              <strong style={{ color: color.warn }}>query</strong> + <strong style={{ color: color.warn }}>code-primary</strong> 는
              턴마다 바뀝니다. 캐시 대상에서 제외하고, <em>front</em> 또는 <em>end</em> 위치에 배치해 attention 집중 구간에 두세요.
            </div>
          </div>
          <div style={insightCardStyle}>
            <div style={{ fontSize: font.size.sm, color: color.text0, fontWeight: font.weight.semibold, marginBottom: space[2] }}>
              Lost-in-Middle
            </div>
            <div style={{ fontSize: font.size.xxs, color: color.text2, lineHeight: 1.55 }}>
              중간 위치 (middle bias) 블록은 긴 컨텍스트에서 attention 손실이 있습니다 (Liu 2023). <strong>tests</strong>,
              <strong> code-neighbor</strong> 같은 보조 자료를 중간에 두어 주 attention 구간을 query와 primary code에 양보합니다.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function StackedColumn({ recs, total }: { recs: ContextShapeRec[]; total: number }): ReactElement {
  const sorted = [...recs].sort((a, b) => a.order - b.order);
  return (
    <div style={stackWrapStyle}>
      {sorted.map((r, i) => {
        const pct = total > 0 ? (r.tokenBudget / total) * 100 : 0;
        const tint = SECTION_TINT[r.section];
        return (
          <div
            key={r.section}
            title={`${SECTION_LABEL[r.section]} · ${fmtTokens(r.tokenBudget)} · ${pct.toFixed(1)}%`}
            style={{
              ...stackSegmentStyle,
              flex: `${Math.max(2, pct)} 1 0`,
              background: tint,
              animation: `cs-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
              animationDelay: `${i * STAGGER_MS + 120}ms`,
              transformOrigin: "top center",
            }}
          >
            <span style={stackLabelStyle}>
              <span style={{ fontWeight: font.weight.semibold, letterSpacing: font.letter.wide }}>
                {SECTION_LABEL[r.section]}
              </span>
              <span style={{ opacity: 0.85, fontFamily: font.mono, fontSize: font.size.xxs }}>
                {fmtTokens(r.tokenBudget)} · {BIAS_LABEL[r.positionBias]}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SectionDetail({ rec, index, total }: { rec: ContextShapeRec; index: number; total: number }): ReactElement {
  const tint = SECTION_TINT[rec.section];
  const pct = total > 0 ? (rec.tokenBudget / total) * 100 : 0;
  return (
    <div
      style={{
        ...detailCardStyle,
        animationDelay: `${index * STAGGER_MS + 220}ms`,
      }}
    >
      <div style={detailHeaderRowStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: space[2] }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: tint }} />
          <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text0 }}>
            {rec.order + 1}. {SECTION_LABEL[rec.section]}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: space[1] }}>
          <span style={biasChipStyle(rec.positionBias)}>{BIAS_LABEL[rec.positionBias]}</span>
          <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text2 }}>
            {fmtTokens(rec.tokenBudget)} · {pct.toFixed(0)}%
          </span>
        </span>
      </div>
      <div style={{ fontSize: font.size.xs, color: color.text1, lineHeight: 1.55, marginTop: space[2] }}>
        {rec.justification}
      </div>
    </div>
  );
}

function biasChipStyle(bias: ContextShapeRec["positionBias"]): CSSProperties {
  const tint = BIAS_TINT[bias];
  return {
    padding: `${space[0]}px ${space[2]}px`,
    borderRadius: radius.pill,
    background: `${tint}18`,
    color: tint,
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    fontFamily: font.mono,
    letterSpacing: font.letter.wide,
  };
}

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `cs-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
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

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const heroRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: space[3],
  marginBottom: space[5],
};

const heroTileStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `cs-tile 460ms ${ENTRY_EASE} both`,
  minHeight: 108,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroNumStyle: CSSProperties = {
  fontSize: 38,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
  marginTop: 4,
  color: color.accent,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  marginTop: 4,
};

const bodyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(320px, 2fr) minmax(260px, 1fr)",
  gap: space[4],
  alignItems: "start",
};

const sectionHeadStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  marginBottom: space[2],
};

const stackColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const stackWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  minHeight: 520,
  overflow: "hidden",
};

const stackSegmentStyle: CSSProperties = {
  position: "relative",
  borderRadius: radius.sm,
  minHeight: 32,
  display: "flex",
  alignItems: "center",
  padding: `${space[2]}px ${space[3]}px`,
  color: "#ffffff",
};

const stackLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  fontSize: font.size.xxs,
  textShadow: "0 1px 2px rgba(0,0,0,0.18)",
};

const detailColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const detailListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const detailCardStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `cs-row ${BAR_MS}ms ${ENTRY_EASE} both`,
};

const detailHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[2],
};

const insightColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const insightCardStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `cs-tile 460ms ${ENTRY_EASE} both`,
};

export const ContextShapeView = memo(ContextShapeViewImpl);
