// ReplayTheaterView — scrubbable playback of past agent sessions.
// --------------------------------------------------------------------
// Top: horizontal session picker — 6 chips with task + relative time +
// outcome badge. Clicking a chip swaps the active session.
// Middle: scrubber. A native range input covering 0 → totalDurationMs.
// Play / Pause / 1x / 2x / 4x control the rAF-driven auto-advance.
// Layout beneath:
//   - Left column = vertical step list (kind glyph + label + duration);
//     the current step is highlighted as the scrubber moves.
//   - Right column = details of the active step (tokens in/out, tool
//     name, thought snippet, success flag).
// Top-right corner: overall outcome badge (merged / in-review /
// abandoned) with accent tint.
//
// Reference: session-replay pattern (LogRocket, FullStory) adapted for
// AI agents; time-travel debugging literature.

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  synthReplaySessions,
  type AgentStep,
  type AgentStepKind,
  type ReplaySession,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

type Speed = 1 | 2 | 4;

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes rep-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes rep-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rep-row   { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
`;

const STEP_GLYPH: Record<AgentStepKind, string> = {
  read: "◐",
  think: "◇",
  tool: "⚙",
  edit: "✎",
  test: "✓",
  retry: "↺",
  done: "◉",
};

const STEP_TINT: Record<AgentStepKind, string> = {
  read: color.accent,
  think: "#7e4ed6",
  tool: color.warn,
  edit: color.text0,
  test: color.success,
  retry: color.danger,
  done: color.success,
};

const OUTCOME_TINT: Record<ReplaySession["outcome"], string> = {
  merged: color.success,
  "in-review": color.warn,
  abandoned: color.danger,
};

const OUTCOME_LABEL: Record<ReplaySession["outcome"], string> = {
  merged: "merged",
  "in-review": "in-review",
  abandoned: "abandoned",
};

function fmtMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function relTime(startedAt: number): string {
  const diff = Date.now() - startedAt;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

/** Given the current cursor ms, find the step index the cursor is within. */
function stepIdxAt(steps: readonly AgentStep[], cursorMs: number): number {
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    acc += steps[i]!.durationMs;
    if (cursorMs < acc) return i;
  }
  return steps.length - 1;
}

function ReplayTheaterViewImpl({ ctx }: Props): ReactElement | null {
  const sessions = useMemo(() => synthReplaySessions(ctx.tree, 6), [ctx.tree]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cursorMs, setCursorMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  // Reset cursor when switching sessions.
  useEffect(() => {
    setCursorMs(0);
    setPlaying(false);
  }, [selectedIdx]);

  const session = sessions[selectedIdx];
  const total = session?.totalDurationMs ?? 0;

  // rAF playback loop.
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || total <= 0) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    const step = (ts: number): void => {
      const prev = lastTsRef.current;
      lastTsRef.current = ts;
      const dt = prev === null ? 16 : ts - prev;
      setCursorMs(c => {
        const next = c + dt * speed;
        if (next >= total) {
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [playing, speed, total]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCursorMs(Number(e.target.value));
  }, []);

  if (!session) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>재생할 세션이 없습니다.</div>
      </div>
    );
  }

  const activeIdx = stepIdxAt(session.steps, cursorMs);
  const activeStep = session.steps[activeIdx]!;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Replay Theater · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>session playback</span>
          </div>
          <div style={subtitleStyle}>
            에이전트 세션 시간여행 · rAF scrubber × play controls
          </div>
        </div>
        <div style={{
          ...outcomeBadgeStyle(OUTCOME_TINT[session.outcome]),
          animation: `rep-tile 460ms ${ENTRY_EASE} both`,
        }}>
          <span style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra }}>OUTCOME</span>
          <span style={{
            fontSize: font.size.md,
            fontFamily: font.mono,
            fontWeight: font.weight.bold,
            color: OUTCOME_TINT[session.outcome],
            textTransform: "uppercase",
            letterSpacing: font.letter.wide,
          }}>
            {OUTCOME_LABEL[session.outcome]}
          </span>
        </div>
      </header>

      {/* Session picker */}
      <section style={{ ...sectionStyle, marginBottom: space[4] }}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Sessions · {sessions.length}</h3>
        </div>
        <div style={chipRowStyle}>
          {sessions.map((s, i) => {
            const active = i === selectedIdx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedIdx(i)}
                style={{
                  ...sessionChipStyle,
                  background: active ? color.accentSoft : color.bg1,
                  borderColor: active ? color.accentBorder : color.border,
                  color: active ? color.accent : color.text1,
                  fontWeight: active ? font.weight.semibold : font.weight.medium,
                  animationDelay: `${i * STAGGER_MS}ms`,
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: OUTCOME_TINT[s.outcome],
                  flex: "0 0 auto",
                }} />
                <span style={{
                  fontSize: font.size.xs,
                  fontFamily: font.mono,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 170,
                }}>
                  {s.taskLabel}
                </span>
                <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
                  {relTime(s.startedAt)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Scrubber */}
      <section style={scrubberWrapStyle}>
        <div style={scrubberRowStyle}>
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            style={playBtnStyle}
            aria-pressed={playing}
          >
            <span>{playing ? "⏸" : "▶"}</span>
            <span>{playing ? "Pause" : "Play"}</span>
          </button>
          <span style={timeLabelStyle}>{fmtMs(cursorMs)}</span>
          <input
            type="range"
            min={0}
            max={total}
            step={Math.max(1, Math.floor(total / 500))}
            value={cursorMs}
            onChange={handleScrub}
            style={rangeStyle}
            aria-label="Session scrubber"
          />
          <span style={timeLabelStyle}>{fmtMs(total)}</span>
          <div style={speedStripStyle}>
            {([1, 2, 4] as const).map(s => {
              const active = speed === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  style={{
                    ...speedChipStyle,
                    background: active ? color.accentSoft : color.bg1,
                    borderColor: active ? color.accentBorder : color.border,
                    color: active ? color.accent : color.text1,
                  }}
                  aria-pressed={active}
                >
                  {s}x
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Split: step list + active step details */}
      <section style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)", gap: space[3] }}>
        <div style={stepListStyle}>
          {session.steps.map((s, i) => {
            const tint = STEP_TINT[s.kind];
            const active = i === activeIdx;
            return (
              <div
                key={s.id}
                style={{
                  ...stepRowStyle,
                  background: active ? `${color.accent}12` : "transparent",
                  borderLeft: active ? `2px solid ${color.accent}` : `2px solid transparent`,
                  animationDelay: `${Math.min(i * 10, 240)}ms`,
                }}
              >
                <span style={{
                  fontFamily: font.mono, fontSize: font.size.md,
                  color: tint, width: 22, textAlign: "center", flexShrink: 0,
                }}>
                  {STEP_GLYPH[s.kind]}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: font.size.sm, color: color.text0, fontWeight: active ? font.weight.semibold : font.weight.regular, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
                    {s.kind} · {fmtMs(s.durationMs)}
                  </span>
                </span>
                {!s.success && (
                  <span style={{
                    padding: `1px ${space[1]}px`, borderRadius: radius.sm,
                    background: `${color.danger}18`, color: color.danger,
                    fontSize: 9, fontFamily: font.mono, fontWeight: font.weight.semibold,
                  }}>
                    retry
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div style={detailStyle}>
          <div style={detailLabelStyle}>active step · {activeIdx + 1}/{session.steps.length}</div>
          <div style={{
            display: "flex", alignItems: "center", gap: space[2], marginTop: 4,
          }}>
            <span style={{
              fontFamily: font.mono, fontSize: 22,
              color: STEP_TINT[activeStep.kind],
            }}>
              {STEP_GLYPH[activeStep.kind]}
            </span>
            <span style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
              {activeStep.label}
            </span>
            <span style={{
              padding: `2px ${space[2]}px`,
              borderRadius: radius.pill,
              background: `${STEP_TINT[activeStep.kind]}18`,
              color: STEP_TINT[activeStep.kind],
              fontSize: font.size.xxs,
              fontFamily: font.mono,
              fontWeight: font.weight.semibold,
              textTransform: "uppercase",
            }}>
              {activeStep.kind}
            </span>
          </div>

          <div style={detailGrid}>
            <DetailCell label="duration" value={fmtMs(activeStep.durationMs)} />
            <DetailCell label="tokens in" value={fmtTokens(activeStep.tokensIn)} />
            <DetailCell label="tokens out" value={fmtTokens(activeStep.tokensOut)} />
            <DetailCell label="tool" value={activeStep.toolName ?? "—"} mono />
            <DetailCell label="target" value={activeStep.targetFileId ?? "—"} mono />
            <DetailCell label="success" value={activeStep.success ? "yes" : "retry"}
              tint={activeStep.success ? color.success : color.danger} />
          </div>

          {activeStep.thoughtSnippet && (
            <div style={thoughtStyle}>
              <div style={thoughtLabelStyle}>thought</div>
              <div style={{ fontSize: font.size.sm, color: color.text1, lineHeight: 1.55, marginTop: 4, fontFamily: font.mono }}>
                {activeStep.thoughtSnippet}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DetailCell({
  label, value, tint, mono,
}: { label: string; value: string; tint?: string; mono?: boolean }): ReactElement {
  return (
    <div>
      <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, textTransform: "uppercase", letterSpacing: font.letter.wide }}>
        {label}
      </div>
      <div style={{
        fontSize: font.size.sm, color: tint ?? color.text0,
        marginTop: 2,
        fontFamily: mono ? font.mono : font.sans,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontWeight: font.weight.medium,
      }}>
        {value}
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
  animation: `rep-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

function outcomeBadgeStyle(tint: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    padding: `${space[2]}px ${space[4]}px`,
    background: `${tint}14`,
    border: `1px solid ${tint}40`,
    borderRadius: radius.md,
  };
}

const sectionStyle: CSSProperties = {
  marginTop: space[4],
};

const sectionHeadRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  gap: space[2],
  overflowX: "auto",
  paddingBottom: space[1],
};

const sessionChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  border: `1px solid ${color.border}`,
  background: color.bg1,
  borderRadius: radius.md,
  cursor: "pointer",
  fontFamily: font.sans,
  transition: `all ${transition.base}`,
  whiteSpace: "nowrap",
  animation: `rep-tile 460ms ${ENTRY_EASE} both`,
  flex: "0 0 auto",
};

const scrubberWrapStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `rep-tile 460ms ${ENTRY_EASE} both`,
};

const scrubberRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
};

const playBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 28,
  padding: `0 ${space[3]}px`,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.sm,
  background: color.accentSoft,
  color: color.accent,
  fontFamily: font.sans,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  cursor: "pointer",
  userSelect: "none",
  transition: `background-color ${transition.fast}`,
};

const rangeStyle: CSSProperties = {
  flex: 1,
  accentColor: color.accent,
  cursor: "pointer",
};

const timeLabelStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
  minWidth: 48,
  textAlign: "center",
  flex: "0 0 auto",
};

const speedStripStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  flex: "0 0 auto",
};

const speedChipStyle: CSSProperties = {
  height: 24,
  padding: `0 ${space[2]}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.bg1,
  color: color.text1,
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  cursor: "pointer",
  transition: `all ${transition.fast}`,
};

const stepListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
  maxHeight: 420,
  overflowY: "auto",
};

const stepRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `rep-row 440ms ${ENTRY_EASE} both`,
  transition: `background ${transition.fast}, border-left-color ${transition.fast}`,
};

const detailStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `rep-tile 460ms ${ENTRY_EASE} both`,
  animationDelay: "120ms",
};

const detailLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const detailGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: space[3],
  marginTop: space[3],
};

const thoughtStyle: CSSProperties = {
  marginTop: space[3],
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
};

const thoughtLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  textTransform: "uppercase",
  letterSpacing: font.letter.wide,
};

export const ReplayTheaterView = memo(ReplayTheaterViewImpl);
