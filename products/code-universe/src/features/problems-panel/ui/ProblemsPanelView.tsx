// ProblemsPanelView — unified compiler/linter problems list.
// --------------------------------------------------------------------
// References:
//   - Visual Studio Code "Problems" panel — severity-bucketed diagnostic
//     table across tsc / eslint / biome / vitest / semgrep.
//   - JetBrains IntelliJ IDEA "Problems tool window" — repo-wide
//     diagnostic inbox with source + file:line hyperlink + rule id.
// Applied here: the Code Universe's repo-level "single pane of glass"
// for every static-analysis and build-time warning, filterable by
// severity AND source (AND-combined chip filters).

import { memo, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  synthProblems,
  type ProblemSeverity,
  type ProblemSource,
  type SynthProblem,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";

const KEYFRAMES = `
@keyframes pp-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes pp-row   { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
`;

const SEVERITY_ORDER: ProblemSeverity[] = ["error", "warning", "info", "hint"];
const SOURCE_ORDER: ProblemSource[] = ["tsc", "eslint", "biome", "vitest", "semgrep"];

const SEVERITY_TINT: Record<ProblemSeverity, string> = {
  error:   color.danger,
  warning: color.warn,
  info:    color.accent,
  hint:    color.text2,
};

const SEVERITY_LABEL: Record<ProblemSeverity, string> = {
  error:   "Errors",
  warning: "Warnings",
  info:    "Info",
  hint:    "Hints",
};

const SOURCE_LABEL: Record<ProblemSource, string> = {
  tsc:     "tsc",
  eslint:  "eslint",
  biome:   "biome",
  vitest:  "vitest",
  semgrep: "semgrep",
};

type SeverityFilter = "all" | ProblemSeverity;
type SourceFilter = "all" | ProblemSource;

interface FlatProblem extends SynthProblem {
  fileName: string;
}

function collect(ctx: ViewContextValue): FlatProblem[] {
  if (!ctx.tree) return [];
  const out: FlatProblem[] = [];
  for (const entity of ctx.tree.byId.values()) {
    if (entity.kind !== "building") continue;
    const fileName = entity.name;
    for (const p of synthProblems(entity)) {
      out.push({ ...p, fileName });
    }
  }
  // Sort: errors first, then warnings, info, hints. Stable across views.
  out.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  return out;
}

function ProblemsPanelViewImpl({ ctx }: Props): ReactElement | null {
  const all = useMemo(() => collect(ctx), [ctx]);
  const [sevFilter, setSevFilter] = useState<SeverityFilter>("all");
  const [srcFilter, setSrcFilter] = useState<SourceFilter>("all");

  const sevCounts = useMemo(() => {
    const c: Record<ProblemSeverity, number> = { error: 0, warning: 0, info: 0, hint: 0 };
    for (const p of all) c[p.severity]++;
    return c;
  }, [all]);

  const srcCounts = useMemo(() => {
    const c: Record<ProblemSource, number> = { tsc: 0, eslint: 0, biome: 0, vitest: 0, semgrep: 0 };
    for (const p of all) c[p.source]++;
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter(p => {
      if (sevFilter !== "all" && p.severity !== sevFilter) return false;
      if (srcFilter !== "all" && p.source !== srcFilter) return false;
      return true;
    });
  }, [all, sevFilter, srcFilter]);

  if (all.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: font.size.xxl, color: color.success, fontWeight: font.weight.semibold }}>
            ✓ 문제 없음
          </div>
          <div style={{ marginTop: space[2], fontSize: font.size.sm, color: color.text2 }}>
            모든 컴파일러 / 린터 통과 — clean build
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Problems</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            총 {all.length}건 · 필터링 {filtered.length}건 · tsc / eslint / biome / vitest / semgrep 통합
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          VS Code · IntelliJ Problems tool window
        </div>
      </header>

      <div style={countersGrid}>
        {SEVERITY_ORDER.map((s, i) => (
          <SevCounter key={s} sev={s} count={sevCounts[s]} index={i} />
        ))}
      </div>

      <div style={mainStyle}>
        <div style={listPanelStyle}>
          <div style={filterRow}>
            <FilterChip label="전체" active={sevFilter === "all"} onClick={() => setSevFilter("all")} />
            {SEVERITY_ORDER.map(s => (
              <FilterChip
                key={s}
                label={`${SEVERITY_LABEL[s]} · ${sevCounts[s]}`}
                active={sevFilter === s}
                tint={SEVERITY_TINT[s]}
                onClick={() => setSevFilter(s)}
              />
            ))}
            <span style={{ width: 1, height: 16, background: color.border, margin: `0 ${space[1]}px` }} />
            <FilterChip label="all sources" active={srcFilter === "all"} onClick={() => setSrcFilter("all")} />
            {SOURCE_ORDER.map(s => (
              <FilterChip
                key={s}
                label={`${SOURCE_LABEL[s]} · ${srcCounts[s]}`}
                active={srcFilter === s}
                onClick={() => setSrcFilter(s)}
              />
            ))}
          </div>

          <div style={listStyle}>
            {filtered.length === 0 ? (
              <div style={{ padding: space[5], color: color.text3, fontSize: font.size.sm, textAlign: "center" }}>
                조건에 맞는 문제가 없습니다.
              </div>
            ) : filtered.slice(0, 120).map((p, i) => (
              <ProblemRow
                key={p.id}
                p={p}
                index={i}
                onFocus={() => ctx.dispatch.selectEntity(p.fileId)}
              />
            ))}
            {filtered.length > 120 && (
              <div style={{ padding: space[3], textAlign: "center", fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
                상위 120건 표시 · 필터를 좁혀 나머지 {filtered.length - 120}건 확인
              </div>
            )}
          </div>
        </div>

        <aside style={aggStyle}>
          <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold, marginBottom: space[2] }}>
            By source
          </div>
          <SourceBarChart srcCounts={srcCounts} total={all.length} />
        </aside>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SevCounter({ sev, count, index }: { sev: ProblemSeverity; count: number; index: number }): ReactElement {
  const tint = SEVERITY_TINT[sev];
  return (
    <div style={{ ...counterTileStyle, animationDelay: `${index * 40}ms` }}>
      <span style={{
        fontSize: font.size.xxs,
        color: color.text2,
        letterSpacing: font.letter.ultra,
        textTransform: "uppercase",
        fontWeight: font.weight.semibold,
      }}>
        {SEVERITY_LABEL[sev]}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: space[1], marginTop: 2 }}>
        <span style={{
          fontSize: 30,
          fontFamily: font.mono,
          fontWeight: font.weight.bold,
          color: count > 0 ? tint : color.text3,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}>
          {count}
        </span>
        {count > 0 && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: tint, marginLeft: 2 }} />
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick, tint }: { label: string; active: boolean; onClick: () => void; tint?: string }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: `${space[1]}px ${space[3]}px`,
        border: `1px solid ${active ? (tint ?? color.accent) : color.border}`,
        background: active ? (tint ? `${tint}18` : color.accentSofter) : color.bg1,
        color: active ? (tint ?? color.accent) : color.text1,
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

function ProblemRow({ p, index, onFocus }: { p: FlatProblem; index: number; onFocus: () => void }): ReactElement {
  const tint = SEVERITY_TINT[p.severity];
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{
        ...rowStyle,
        animationDelay: `${Math.min(index, 40) * 14}ms`,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = color.hover)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{
        ...sevPillStyle,
        background: `${tint}18`,
        color: tint,
      }}>
        {p.severity}
      </span>
      <span style={sourceBadgeStyle}>{SOURCE_LABEL[p.source]}</span>
      <span style={ruleStyle}>{p.rule}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: font.size.sm, color: color.text0, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.message}
        </span>
        <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text2, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.fileName}:{p.line}
        </span>
      </span>
    </button>
  );
}

function SourceBarChart({ srcCounts, total }: { srcCounts: Record<ProblemSource, number>; total: number }): ReactElement {
  const max = Math.max(1, ...SOURCE_ORDER.map(s => srcCounts[s]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
      {SOURCE_ORDER.map((s, i) => {
        const count = srcCounts[s];
        const pct = total === 0 ? 0 : (count / total) * 100;
        const ratio = count / max;
        return (
          <div key={s} style={{ animation: `pp-row 380ms ${ENTRY_EASE} both`, animationDelay: `${i * 22}ms` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
              <span style={{ fontFamily: font.mono, fontSize: font.size.xs, color: color.text1 }}>{SOURCE_LABEL[s]}</span>
              <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text2, fontVariantNumeric: "tabular-nums" }}>
                {count} · {pct.toFixed(0)}%
              </span>
            </div>
            <div style={aggBarBase}>
              <div
                style={{
                  ...aggBarFill,
                  width: `${Math.max(2, ratio * 100)}%`,
                  background: count > 0 ? color.accent : color.text3,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `pp-enter 520ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: space[4],
};

const countersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  marginBottom: space[4],
};

const counterTileStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `pp-row 440ms ${ENTRY_EASE} both`,
};

const mainStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 260px",
  gap: space[4],
  alignItems: "start",
};

const listPanelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  minWidth: 0,
};

const filterRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  flexWrap: "wrap",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.border}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `pp-row 440ms ${ENTRY_EASE} both`,
};

const sevPillStyle: CSSProperties = {
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.sm,
  fontFamily: font.mono,
  fontSize: 10,
  fontWeight: font.weight.semibold,
  flexShrink: 0,
  minWidth: 64,
  textAlign: "center",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const sourceBadgeStyle: CSSProperties = {
  padding: `2px ${space[2]}px`,
  borderRadius: radius.sm,
  background: color.bg3,
  color: color.text1,
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  fontWeight: font.weight.medium,
  flexShrink: 0,
  minWidth: 54,
  textAlign: "center",
};

const ruleStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text2,
  flexShrink: 0,
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const aggStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  minWidth: 0,
};

const aggBarBase: CSSProperties = {
  height: 8,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const aggBarFill: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
  transition: `width ${transition.base}`,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const ProblemsPanelView = memo(ProblemsPanelViewImpl);
