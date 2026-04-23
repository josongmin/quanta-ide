// AnticipateView — preemptive / anticipatory agent actions.
// --------------------------------------------------------------------
// Top:   summary — agent prepared N actions in advance, spent X tokens
//        speculatively.
// Main:  action card list — each card carries a trigger chip
//        ("파일 열림"), predicted action label, confidence bar,
//        task-kind pill, estimated cost, and a "prepared Xs ago" chip.
// Bottom: speculative compute savings — sum of prepared seconds, shown
//        as the latency saved if the user accepts the prepared actions.
// Right: insight — anticipatory UI 2025 trend; the agent spends compute
//        on probable next actions in the background so that accepted
//        actions feel instant.
//
// Reference:
//   - Google "Ambient Agents" (2025)
//   - Leviathan et al. "Fast Inference via Speculative Decoding" (ICML 2023)
//   - Anticipatory computing research (2024-2025)

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
  anticipatedActions,
  type AITaskKind,
  type AnticipatedAction,
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
@keyframes an-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes an-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes an-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes an-pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명", "fix-bug": "버그 수정", "add-feature": "기능 추가",
  refactor: "리팩터", test: "테스트 작성", review: "코드 리뷰",
};

const TASK_TINT: Record<AITaskKind, string> = {
  explain: color.accent,
  "fix-bug": color.danger,
  "add-feature": color.success,
  refactor: "#7e4ed6",
  test: "#0a7acc",
  review: color.warn,
};

// Average input + output tokens the agent speculatively burns per prepared action.
const SPEC_TOKENS_PER_SEC = 120;

function fmtUsd(v: number): string {
  if (v < 0.01) return "<$0.01";
  return `$${v.toFixed(2)}`;
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

function AnticipateViewImpl({ entity, empty }: Props): ReactElement {
  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하면 선제 예측 액션이 나타납니다.</div>
      </div>
    );
  }

  const actions = useMemo(() => anticipatedActions(entity), [entity]);

  const totalPrepSec = useMemo(() => actions.reduce((s, a) => s + a.preparedSec, 0), [actions]);
  const totalCost = useMemo(() => actions.reduce((s, a) => s + a.estimatedCostUsd, 0), [actions]);
  const specTokens = Math.round(totalPrepSec * SPEC_TOKENS_PER_SEC);

  const countAnim = useCounter(actions.length, COUNTER_MS);
  const tokenAnim = useCounter(specTokens, COUNTER_MS);
  const latencyAnim = useCounter(totalPrepSec, COUNTER_MS);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Anticipate · <span style={{ color: color.text1, fontWeight: font.weight.medium }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            선제 예측 액션 · trigger × speculative compute × confidence · 체감 latency 감소
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Google Ambient Agents 2025<br />
          Leviathan ICML 2023 (speculative decoding, adapted for UI)
        </div>
      </header>

      <section style={heroRowStyle}>
        <div style={heroTileStyle}>
          <div style={heroLabelStyle}>Actions prepared</div>
          <div style={{ ...heroNumStyle, color: color.accent }}>{Math.round(countAnim)}</div>
          <div style={heroSubStyle}>background speculation</div>
        </div>
        <div style={heroTileStyle}>
          <div style={heroLabelStyle}>Speculative tokens</div>
          <div style={{ ...heroNumStyle, color: color.warn }}>{Math.round(tokenAnim).toLocaleString()}</div>
          <div style={heroSubStyle}>선결제 compute · {fmtUsd(totalCost)}</div>
        </div>
        <div style={heroTileStyle}>
          <div style={heroLabelStyle}>Latency saved</div>
          <div style={{ ...heroNumStyle, color: color.success }}>{latencyAnim.toFixed(1)}s</div>
          <div style={heroSubStyle}>사용자가 수락 시 즉시 반응</div>
        </div>
      </section>

      <section style={bodyGridStyle}>
        <div style={listColumnStyle}>
          <div style={sectionHeadStyle}>Prepared actions (confidence 내림차순)</div>
          <div style={cardListStyle}>
            {actions.length === 0 ? (
              <div style={{ padding: space[5], textAlign: "center", color: color.text3, fontSize: font.size.sm }}>
                현재 준비된 액션이 없습니다.
              </div>
            ) : actions.map((a, i) => (
              <AnticipatedCard key={a.id} action={a} index={i} />
            ))}
          </div>
        </div>

        <aside style={sideColumnStyle}>
          <div style={sectionHeadStyle}>Speculative compute savings</div>
          <div style={savingsCardStyle}>
            <div style={savingsNumStyle}>{latencyAnim.toFixed(1)}s</div>
            <div style={savingsLabelStyle}>사용자가 모든 예측 수락 시 총 절감 latency</div>
            <div style={savingsBarWrapStyle}>
              <div
                style={{
                  ...savingsBarFillStyle,
                  width: `${Math.min(100, totalPrepSec * 6)}%`,
                  background: color.success,
                }}
              />
            </div>
            <div style={savingsFootnoteStyle}>
              speculative decoding 비유: 모델이 미리 계산해둔 결과를 사용자가 수락만 하면 바로 표시.
            </div>
          </div>

          <div style={sectionHeadStyle}>2025 trend: anticipatory UI</div>
          <div style={insightCardStyle}>
            <div style={{ fontSize: font.size.xs, color: color.text1, lineHeight: 1.55 }}>
              ambient agents는 현재 액션이 끝나기 전에 가장 <strong>probable</strong> next action을 background에서 미리 계산합니다.
              사용자가 trigger를 만족시키는 순간 이미 준비된 답을 반환하므로 <strong style={{ color: color.success }}>체감 latency가 거의 0</strong>
              에 가까워집니다. 비용: 수락되지 않은 speculative compute만큼 token이 낭비되므로 confidence threshold로 economic break-even을 조율.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function AnticipatedCard({ action, index }: { action: AnticipatedAction; index: number }): ReactElement {
  const tint = TASK_TINT[action.category];
  return (
    <div
      style={{
        ...cardStyle,
        animationDelay: `${Math.min(index, 20) * STAGGER_MS}ms`,
      }}
    >
      <div style={cardTopRowStyle}>
        <span style={triggerChipStyle}>
          <span style={pulseDotStyle} />
          trigger · {action.trigger}
        </span>
        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          background: `${tint}18`,
          color: tint,
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          fontFamily: font.mono,
        }}>
          {TASK_KOREAN[action.category]}
        </span>
      </div>

      <div style={{
        fontSize: font.size.md,
        color: color.text0,
        fontWeight: font.weight.semibold,
        marginTop: space[1],
      }}>
        {action.label}
      </div>

      <div style={cardStatsRowStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: space[2], flex: 1, minWidth: 0 }}>
          <span style={statLabelStyle}>confidence</span>
          <span style={confBarWrapStyle}>
            <span style={{
              ...confBarFillStyle,
              width: `${action.confidence * 100}%`,
              background: action.confidence >= 0.7 ? color.success : action.confidence >= 0.5 ? color.warn : color.danger,
              animationDelay: `${Math.min(index, 20) * STAGGER_MS + 120}ms`,
            }} />
          </span>
          <span style={{
            fontFamily: font.mono,
            fontSize: font.size.xxs,
            color: color.text0,
            minWidth: 34,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}>
            {Math.round(action.confidence * 100)}%
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: space[2], flexShrink: 0 }}>
          <span style={statLabelStyle}>cost</span>
          <span style={{ fontFamily: font.mono, fontSize: font.size.xs, color: color.text1, fontVariantNumeric: "tabular-nums" }}>
            {fmtUsd(action.estimatedCostUsd)}
          </span>
        </span>
        <span style={preparedChipStyle}>
          prepared {action.preparedSec}s ago
        </span>
      </div>
    </div>
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
  animation: `an-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
  animation: `an-tile 460ms ${ENTRY_EASE} both`,
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
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  marginTop: 4,
};

const bodyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)",
  gap: space[4],
  alignItems: "start",
};

const listColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const sectionHeadStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  marginBottom: space[2],
};

const cardListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const cardStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `an-tile 460ms ${ENTRY_EASE} both`,
};

const cardTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[2],
};

const triggerChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
  padding: `${space[0]}px ${space[2]}px`,
  borderRadius: radius.pill,
  background: color.bg3,
  color: color.text1,
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.medium,
};

const pulseDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: color.accent,
  animation: "an-pulse 1.6s ease-in-out infinite",
};

const cardStatsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  marginTop: space[2],
  paddingTop: space[2],
  borderTop: `1px solid ${color.borderSoft}`,
  flexWrap: "wrap",
};

const statLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const confBarWrapStyle: CSSProperties = {
  flex: 1,
  minWidth: 100,
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const confBarFillStyle: CSSProperties = {
  height: "100%",
  transformOrigin: "left center",
  animation: `an-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
};

const preparedChipStyle: CSSProperties = {
  padding: `${space[0]}px ${space[2]}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.bg2,
  color: color.text2,
  fontSize: font.size.xxs,
  fontFamily: font.mono,
};

const sideColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const savingsCardStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `an-tile 460ms ${ENTRY_EASE} both`,
};

const savingsNumStyle: CSSProperties = {
  fontSize: 30,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  color: color.success,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
};

const savingsLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  marginTop: space[1],
  lineHeight: 1.4,
};

const savingsBarWrapStyle: CSSProperties = {
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
  marginTop: space[2],
};

const savingsBarFillStyle: CSSProperties = {
  height: "100%",
  transformOrigin: "left center",
  animation: `an-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
};

const savingsFootnoteStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  marginTop: space[2],
  lineHeight: 1.5,
};

const insightCardStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `an-tile 460ms ${ENTRY_EASE} both`,
};

export const AnticipateView = memo(AnticipateViewImpl);
