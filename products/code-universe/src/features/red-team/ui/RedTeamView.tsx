// RedTeamView — adversarial prompt test suite (safety board).
// --------------------------------------------------------------------
// Top:   4 summary tiles (total / passed / failed / last-run relative).
// Mid:   filter chips — category (prompt-injection / jailbreak /
//        data-exfil / unsafe-tool / sycophancy / pii-leak) + status
//        (passed / failed / all).
// Main:  test list — category badge + name + severity pill + expected
//        vs actual + pass/fail chip + last-run timestamp. Click row →
//        expanded mono prompt + remediation suggestion.
// Bottom: category health heatmap — 6 tiles coloured by pass rate.
// Right: "run suite" button stub + OWASP coverage insight.
//
// Reference:
//   - Perez et al. "Red Teaming LMs with LMs" (2022)
//   - OWASP LLM Top 10 (2025)
//   - Anthropic "Constitutional AI" (2022)
//   - DEF CON AI Red Team (2023)

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  redTeamSuite,
  type RedTeamCategory,
  type RedTeamTest,
  type VulnSeverity,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes rt-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes rt-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rt-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
`;

const CATEGORY_ORDER: readonly RedTeamCategory[] = [
  "prompt-injection", "jailbreak", "data-exfil", "unsafe-tool", "sycophancy", "pii-leak",
];

const CATEGORY_LABEL: Record<RedTeamCategory, string> = {
  "prompt-injection": "Prompt Injection",
  "jailbreak":        "Jailbreak",
  "data-exfil":       "Data Exfil",
  "unsafe-tool":      "Unsafe Tool",
  "sycophancy":       "Sycophancy",
  "pii-leak":         "PII Leak",
};

const CATEGORY_TINT: Record<RedTeamCategory, string> = {
  "prompt-injection": color.danger,
  "jailbreak":        "#d97706",
  "data-exfil":       color.warn,
  "unsafe-tool":      "#7e4ed6",
  "sycophancy":       color.accent,
  "pii-leak":         "#0a7acc",
};

const SEVERITY_TINT: Record<VulnSeverity, string> = {
  critical: color.danger,
  high:     color.warn,
  medium:   "#d97706",
  low:      color.text2,
};

const SEVERITY_LABEL: Record<VulnSeverity, string> = {
  critical: "Critical", high: "High", medium: "Medium", low: "Low",
};

const ACTUAL_KOREAN: Record<RedTeamTest["actual"], string> = {
  refused: "거부",
  sanitized: "소독",
  flagged: "플래그",
  "passed-through": "통과됨",
  executed: "실행됨",
};

const REMEDIATION: Record<RedTeamCategory, string> = {
  "prompt-injection": "system prompt 강화 · delimiter filter · input sanitizer. instruction hierarchy를 모델에 명시적으로 전달.",
  "jailbreak":        "constitutional AI 룰 추가 · persona switching 탐지 · refusal 템플릿 강화.",
  "data-exfil":       "tool allowlist + output filter · env / secret 패턴 정규식 redaction · outbound URL gate.",
  "unsafe-tool":      "destructive tool 앞에 human-in-loop approval · dry-run preview · filesystem scope 제한.",
  "sycophancy":       "evidence-first 프롬프트 · 사실 확인 체인 · 반대 증거 탐색 단계 삽입.",
  "pii-leak":         "PII detector (이메일, 전화, 주민번호) + masking · 출력 후처리 필터.",
};

type StatusFilter = "all" | "passed" | "failed";

function fmtRelTime(ms: number): string {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
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

function RedTeamViewImpl(_props: Props): ReactElement {
  const tests = useMemo(() => redTeamSuite(), []);
  const [catFilter, setCatFilter] = useState<RedTeamCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const passed = useMemo(() => tests.filter(t => t.passed).length, [tests]);
  const failed = tests.length - passed;
  const lastRun = useMemo(() => Math.max(0, ...tests.map(t => t.lastRun)), [tests]);

  const catCounts = useMemo(() => {
    const c: Record<RedTeamCategory, { total: number; passed: number }> = {
      "prompt-injection": { total: 0, passed: 0 },
      "jailbreak":        { total: 0, passed: 0 },
      "data-exfil":       { total: 0, passed: 0 },
      "unsafe-tool":      { total: 0, passed: 0 },
      "sycophancy":       { total: 0, passed: 0 },
      "pii-leak":         { total: 0, passed: 0 },
    };
    for (const t of tests) {
      c[t.category].total++;
      if (t.passed) c[t.category].passed++;
    }
    return c;
  }, [tests]);

  const filtered = useMemo(() => {
    return tests.filter(t => {
      if (catFilter !== "all" && t.category !== catFilter) return false;
      if (statusFilter === "passed" && !t.passed) return false;
      if (statusFilter === "failed" && t.passed) return false;
      return true;
    });
  }, [tests, catFilter, statusFilter]);

  const totalAnim = useCounter(tests.length, COUNTER_MS);
  const passedAnim = useCounter(passed, COUNTER_MS);
  const failedAnim = useCounter(failed, COUNTER_MS);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Red Team Suite</div>
          <div style={subtitleStyle}>
            적대적 프롬프트 안전성 테스트 · Perez 2022 · OWASP LLM Top 10 2025 · Constitutional AI 2022 · DEF CON 2023
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          {tests.length} tests · 6 categories
        </div>
      </header>

      <section style={summaryRowStyle}>
        <SummaryTile label="Total tests" value={Math.round(totalAnim)} tint={color.text0} />
        <SummaryTile label="Passed"       value={Math.round(passedAnim)} tint={color.success} />
        <SummaryTile label="Failed"       value={Math.round(failedAnim)} tint={color.danger} />
        <SummaryTile label="Last run"     valueText={fmtRelTime(lastRun)} tint={color.text1} />
      </section>

      <section style={bodyGridStyle}>
        <div style={listColumnStyle}>
          <div style={filterRowStyle}>
            <span style={filterGroupLabelStyle}>카테고리</span>
            <Chip label={`전체 · ${tests.length}`} active={catFilter === "all"} tint={color.accent} onClick={() => setCatFilter("all")} />
            {CATEGORY_ORDER.map(c => (
              <Chip
                key={c}
                label={`${CATEGORY_LABEL[c]} · ${catCounts[c].total}`}
                active={catFilter === c}
                tint={CATEGORY_TINT[c]}
                onClick={() => setCatFilter(c)}
              />
            ))}
          </div>

          <div style={filterRowStyle}>
            <span style={filterGroupLabelStyle}>상태</span>
            <Chip label="전체" active={statusFilter === "all"} tint={color.accent} onClick={() => setStatusFilter("all")} />
            <Chip label={`통과 · ${passed}`} active={statusFilter === "passed"} tint={color.success} onClick={() => setStatusFilter("passed")} />
            <Chip label={`실패 · ${failed}`} active={statusFilter === "failed"} tint={color.danger} onClick={() => setStatusFilter("failed")} />
          </div>

          <div style={listStyle}>
            {filtered.length === 0 ? (
              <div style={{ padding: space[5], textAlign: "center", color: color.text3, fontSize: font.size.sm }}>
                조건에 맞는 테스트가 없습니다.
              </div>
            ) : filtered.map((test, i) => (
              <TestRow
                key={test.id}
                test={test}
                index={i}
                expanded={expanded === test.id}
                onToggle={() => setExpanded(expanded === test.id ? null : test.id)}
              />
            ))}
          </div>

          <div style={heatmapSectionStyle}>
            <div style={sectionHeadStyle}>Category health</div>
            <div style={heatmapGridStyle}>
              {CATEGORY_ORDER.map((c, i) => {
                const entry = catCounts[c];
                const rate = entry.total > 0 ? entry.passed / entry.total : 0;
                const tileTint =
                  rate >= 0.9 ? color.success :
                  rate >= 0.7 ? "#7db843" :
                  rate >= 0.5 ? color.warn :
                  color.danger;
                return (
                  <div
                    key={c}
                    style={{
                      ...heatmapTileStyle,
                      background: `${tileTint}18`,
                      border: `1px solid ${tileTint}55`,
                      animationDelay: `${i * STAGGER_MS + 240}ms`,
                    }}
                  >
                    <span style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.wide, textTransform: "uppercase", fontWeight: font.weight.semibold }}>
                      {CATEGORY_LABEL[c]}
                    </span>
                    <span style={{ fontSize: 22, fontFamily: font.mono, fontWeight: font.weight.bold, color: tileTint, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                      {Math.round(rate * 100)}%
                    </span>
                    <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, marginTop: 2 }}>
                      {entry.passed}/{entry.total} pass
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside style={sideColumnStyle}>
          <div style={sectionHeadStyle}>Run suite</div>
          <button type="button" style={runBtnStyle}>
            <span style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.text0 }}>
              ▶ Run full suite
            </span>
            <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono, marginTop: 2 }}>
              {tests.length} tests · ≈ 30s
            </span>
          </button>

          <div style={sectionHeadStyle}>OWASP LLM coverage</div>
          <div style={insightCardStyle}>
            <div style={{ fontSize: font.size.xs, color: color.text1, lineHeight: 1.55 }}>
              현재 {tests.length}개 테스트가 <strong>OWASP LLM01 (prompt injection)</strong> + <strong>LLM02 (data exfiltration)</strong>
              + <strong>LLM06 (sensitive info disclosure)</strong> 커버.
              <br /><br />
              <span style={{ color: color.warn }}>⚠ 누락:</span> <strong>LLM08 (excessive agency / vector-embedding)</strong>, <strong>LLM09 (overreliance)</strong> 체크가 없습니다. deploy 전에 추가 권장.
            </div>
          </div>

          <div style={insightCardStyle}>
            <div style={{ fontSize: font.size.xxs, color: color.text2, lineHeight: 1.55 }}>
              <strong style={{ color: color.text0 }}>Constitutional AI (Anthropic 2022):</strong> 모델에 명시적 윤리 원칙 세트를 주면 refuse 실패율이 급감합니다. 반복 실패 테스트는 그 카테고리에 해당하는 원칙을 system prompt에 추가하는 것이 첫 수.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function SummaryTile({
  label, value, valueText, tint,
}: { label: string; value?: number; valueText?: string; tint: string }): ReactElement {
  return (
    <div style={summaryTileStyle}>
      <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>
        {label}
      </div>
      <div style={{
        fontSize: 32,
        fontFamily: font.mono,
        fontWeight: font.weight.bold,
        color: tint,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        marginTop: 4,
      }}>
        {valueText ?? (value ?? 0)}
      </div>
    </div>
  );
}

function Chip({
  label, active, tint, onClick,
}: { label: string; active: boolean; tint: string; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: `${space[1]}px ${space[3]}px`,
        border: `1px solid ${active ? tint : color.border}`,
        background: active ? `${tint}18` : color.bg1,
        color: active ? tint : color.text1,
        fontFamily: font.sans,
        fontSize: font.size.xs,
        fontWeight: font.weight.medium,
        borderRadius: radius.pill,
        cursor: "pointer",
        transition: `all ${transition.base}`,
      }}
    >
      {label}
    </button>
  );
}

function TestRow({
  test, index, expanded, onToggle,
}: { test: RedTeamTest; index: number; expanded: boolean; onToggle: () => void }): ReactElement {
  const catTint = CATEGORY_TINT[test.category];
  const sevTint = SEVERITY_TINT[test.severity];
  const statusTint = test.passed ? color.success : color.danger;

  return (
    <div style={{ ...rowWrapStyle, animationDelay: `${Math.min(index, 20) * STAGGER_MS}ms` }}>
      <button type="button" onClick={onToggle} style={rowBtnStyle}>
        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.sm,
          background: `${catTint}18`,
          color: catTint,
          fontSize: 10,
          fontWeight: font.weight.semibold,
          fontFamily: font.mono,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          minWidth: 128,
          textAlign: "center",
          flexShrink: 0,
        }}>
          {CATEGORY_LABEL[test.category]}
        </span>

        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: font.size.sm, color: color.text0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {test.name}
          </span>
          <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>
            expected: <strong style={{ color: color.text1 }}>{ACTUAL_KOREAN[test.expected]}</strong>
            {" · "}actual: <strong style={{ color: statusTint }}>{ACTUAL_KOREAN[test.actual]}</strong>
            {" · "}{fmtRelTime(test.lastRun)}
          </span>
        </span>

        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          background: `${sevTint}18`,
          color: sevTint,
          fontSize: font.size.xxs,
          fontFamily: font.mono,
          fontWeight: font.weight.semibold,
          flexShrink: 0,
        }}>
          {SEVERITY_LABEL[test.severity]}
        </span>

        <span style={{
          padding: `${space[0]}px ${space[3]}px`,
          borderRadius: radius.pill,
          background: `${statusTint}18`,
          color: statusTint,
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          fontFamily: font.mono,
          minWidth: 56,
          textAlign: "center",
          flexShrink: 0,
        }}>
          {test.passed ? "PASS" : "FAIL"}
        </span>
      </button>

      {expanded && (
        <div style={rowDetailStyle}>
          <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold, marginBottom: space[1] }}>
            Prompt
          </div>
          <pre style={promptBlockStyle}>{test.prompt}</pre>
          <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold, marginTop: space[3], marginBottom: space[1] }}>
            Remediation
          </div>
          <div style={{ fontSize: font.size.xs, color: color.text1, lineHeight: 1.6 }}>
            {REMEDIATION[test.category]}
          </div>
        </div>
      )}
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
  animation: `rt-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
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

const summaryRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  marginBottom: space[4],
};

const summaryTileStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `rt-tile 460ms ${ENTRY_EASE} both`,
};

const bodyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 3fr) minmax(260px, 1fr)",
  gap: space[4],
  alignItems: "start",
};

const listColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  flexWrap: "wrap",
};

const filterGroupLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  minWidth: 60,
};

const sectionHeadStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  marginBottom: space[2],
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const rowWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `rt-row 440ms ${ENTRY_EASE} both`,
};

const rowBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[3]}px`,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
  width: "100%",
  transition: `background ${transition.base}`,
};

const rowDetailStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]} ${space[4]}px ${space[4]}px`,
  background: color.bg2,
  borderTop: `1px solid ${color.borderSoft}`,
};

const promptBlockStyle: CSSProperties = {
  margin: 0,
  padding: space[3],
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  lineHeight: 1.5,
};

const heatmapSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  marginTop: space[2],
};

const heatmapGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: space[2],
};

const heatmapTileStyle: CSSProperties = {
  padding: space[3],
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  animation: `rt-tile 460ms ${ENTRY_EASE} both`,
  minHeight: 86,
};

const sideColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const runBtnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  padding: `${space[4]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.md,
  cursor: "pointer",
  fontFamily: font.sans,
  transition: `all ${transition.base}`,
  animation: `rt-tile 460ms ${ENTRY_EASE} both`,
};

const insightCardStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `rt-tile 460ms ${ENTRY_EASE} both`,
};

export const RedTeamView = memo(RedTeamViewImpl);
