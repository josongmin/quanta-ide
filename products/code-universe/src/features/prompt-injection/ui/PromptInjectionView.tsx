// PromptInjectionView — OWASP LLM01 surface scan dashboard.
// --------------------------------------------------------------------
// Top: 4 severity tiles (critical / high / medium / low) with counts
// and tinted totals.
// Middle: Sankey-ish flow with two columns — source kinds (user_input,
// http_request, file_content, db_row, env_var) on the left and sink
// kinds (llm_prompt, llm_tool_call, llm_system_msg) on the right.
// Bezier curves connect every observed source→sink pair; thickness is
// proportional to the path count; critical paths render in red.
// Bottom: findings list. Each row has severity pill, source badge,
// arrow, sink badge, file:line, and an inline fix suggestion. Clicking
// a row dispatches selectEntity to the source file.
//
// Reference: OWASP LLM01:2025 Prompt Injection; Simon Willison 2023+;
// Greshake et al. "Not what you've signed up for" 2023.

import { memo, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  promptInjectionPaths,
  type PromptInjectionPath,
  type VulnSeverity,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes pinj-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes pinj-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pinj-row   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pinj-draw  { from { stroke-dashoffset: var(--dash); } to { stroke-dashoffset: 0; } }
`;

type SourceKind = PromptInjectionPath["sourceKind"];
type SinkKind = PromptInjectionPath["sinkKind"];

const SOURCES: readonly SourceKind[] = [
  "user_input", "http_request", "file_content", "db_row", "env_var",
];
const SINKS: readonly SinkKind[] = [
  "llm_prompt", "llm_tool_call", "llm_system_msg",
];

const SOURCE_LABEL: Record<SourceKind, string> = {
  user_input: "user_input",
  http_request: "http_request",
  file_content: "file_content",
  db_row: "db_row",
  env_var: "env_var",
};
const SINK_LABEL: Record<SinkKind, string> = {
  llm_prompt: "llm_prompt",
  llm_tool_call: "llm_tool_call",
  llm_system_msg: "llm_system_msg",
};

const SEVERITY_ORDER: readonly VulnSeverity[] = ["critical", "high", "medium", "low"];
const SEVERITY_TINT: Record<VulnSeverity, string> = {
  critical: color.danger,
  high: color.warn,
  medium: "#d97706",
  low: color.text2,
};
const SEVERITY_LABEL: Record<VulnSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const FIX_SUGGESTION: Record<SinkKind, string> = {
  llm_prompt: "sanitize + delimiter-wrap before building prompt",
  llm_tool_call: "validate tool arg against schema; deny-list",
  llm_system_msg: "never inject untrusted data into system msg",
};

type FilterSev = "all" | VulnSeverity;

function PromptInjectionViewImpl({ ctx }: Props): ReactElement | null {
  const all = useMemo(() => promptInjectionPaths(ctx.tree), [ctx.tree]);
  const [sevFilter, setSevFilter] = useState<FilterSev>("all");

  const counts = useMemo(() => {
    const c: Record<VulnSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const p of all) c[p.severity]++;
    return c;
  }, [all]);

  const flowKey = (s: SourceKind, k: SinkKind): string => `${s}→${k}`;

  const flows = useMemo(() => {
    const m = new Map<string, { source: SourceKind; sink: SinkKind; total: number; critical: number }>();
    for (const p of all) {
      const key = flowKey(p.sourceKind, p.sinkKind);
      const existing = m.get(key);
      if (existing) {
        existing.total += 1;
        if (p.severity === "critical") existing.critical += 1;
      } else {
        m.set(key, {
          source: p.sourceKind, sink: p.sinkKind,
          total: 1, critical: p.severity === "critical" ? 1 : 0,
        });
      }
    }
    return [...m.values()];
  }, [all]);

  const filtered = useMemo(() => {
    return sevFilter === "all" ? all : all.filter(p => p.severity === sevFilter);
  }, [all, sevFilter]);

  const fileNameById = useMemo(() => {
    const m = new Map<string, string>();
    if (!ctx.tree) return m;
    for (const e of ctx.tree.byId.values()) {
      if (e.kind === "building") m.set(e.id, e.name);
    }
    return m;
  }, [ctx.tree]);

  if (all.length === 0) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: font.size.xxl, color: color.success, fontWeight: font.weight.semibold }}>
              주입 surface 없음
            </div>
            <div style={{ marginTop: space[2], fontSize: font.size.sm, color: color.text2 }}>
              untrusted source → LLM sink 경로가 탐지되지 않았습니다.
            </div>
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
          <div style={titleStyle}>
            Prompt Injection · <span style={{ color: color.danger, fontWeight: font.weight.semibold }}>OWASP LLM01:2025</span>
          </div>
          <div style={subtitleStyle}>
            untrusted source → LLM sink · {all.length.toLocaleString()}건 탐지
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          OWASP LLM01:2025<br />
          Greshake et al. 2023 · Willison 2023+
        </div>
      </header>

      {/* Severity tiles */}
      <section style={sevGridStyle}>
        {SEVERITY_ORDER.map((sev, i) => (
          <SevTile key={sev} sev={sev} count={counts[sev]} index={i} />
        ))}
      </section>

      {/* Flow diagram */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Source → Sink flow</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            thickness ∝ path count · red = critical
          </div>
        </div>
        <FlowDiagram flows={flows} />
      </section>

      {/* Filters */}
      <section style={filterRowStyle}>
        <FilterChip label="전체" active={sevFilter === "all"} onClick={() => setSevFilter("all")} />
        {SEVERITY_ORDER.map(s => (
          <FilterChip
            key={s}
            label={`${SEVERITY_LABEL[s]} · ${counts[s]}`}
            active={sevFilter === s}
            tint={SEVERITY_TINT[s]}
            onClick={() => setSevFilter(s)}
          />
        ))}
      </section>

      {/* Findings list */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Findings · {filtered.length}건</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            click to focus file
          </div>
        </div>
        <div style={listStyle}>
          {filtered.length === 0 ? (
            <div style={{ padding: space[4], color: color.text3, fontSize: font.size.sm, textAlign: "center" }}>
              조건에 맞는 경로가 없습니다.
            </div>
          ) : filtered.map((p, i) => (
            <FindingRow
              key={`${p.fileId}:${i}`}
              path={p}
              index={i}
              fileName={fileNameById.get(p.fileId) ?? p.fileName}
              onFocus={() => ctx.dispatch.selectEntity(p.fileId)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Severity tile ──────────────────────────────────────────────────────

function SevTile({ sev, count, index }: { sev: VulnSeverity; count: number; index: number }): ReactElement {
  const tint = SEVERITY_TINT[sev];
  return (
    <div style={{
      ...tileStyle,
      animationDelay: `${index * STAGGER_MS}ms`,
    }}>
      <span style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold, fontFamily: font.mono }}>
        {SEVERITY_LABEL[sev]}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: space[1], marginTop: 2 }}>
        <span style={{
          fontSize: 30, fontFamily: font.mono, fontWeight: font.weight.bold,
          color: count > 0 ? tint : color.text3,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}>
          {count}
        </span>
        {count > 0 && <span style={{ width: 8, height: 8, borderRadius: "50%", background: tint, marginLeft: 2 }} />}
      </div>
    </div>
  );
}

// ── Flow diagram ───────────────────────────────────────────────────────

interface FlowEntry {
  source: SourceKind;
  sink: SinkKind;
  total: number;
  critical: number;
}

function FlowDiagram({ flows }: { flows: FlowEntry[] }): ReactElement {
  const W = 720;
  const H = 300;
  const LEFT_X = 200;
  const RIGHT_X = 520;
  const LABEL_GAP = 12;
  const TOP = 30;
  const BOTTOM = H - 30;

  const sourceY = new Map<SourceKind, number>();
  SOURCES.forEach((s, i) => {
    const t = SOURCES.length === 1 ? 0.5 : i / (SOURCES.length - 1);
    sourceY.set(s, TOP + t * (BOTTOM - TOP));
  });
  const sinkY = new Map<SinkKind, number>();
  SINKS.forEach((k, i) => {
    const t = SINKS.length === 1 ? 0.5 : i / (SINKS.length - 1);
    sinkY.set(k, TOP + t * (BOTTOM - TOP));
  });

  const maxTotal = Math.max(1, ...flows.map(f => f.total));

  return (
    <div style={chartWrap}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="source to sink flow">
        {/* Column titles */}
        <text x={LEFT_X - 110} y={18} fontSize={11} fill={color.text2} fontFamily={font.sans} letterSpacing="0.06em">UNTRUSTED SOURCE</text>
        <text x={RIGHT_X + 10} y={18} fontSize={11} fill={color.text2} fontFamily={font.sans} letterSpacing="0.06em">LLM SINK</text>

        {/* Flow curves */}
        {flows.map((f, i) => {
          const y1 = sourceY.get(f.source) ?? TOP;
          const y2 = sinkY.get(f.sink) ?? TOP;
          const strokeW = 1 + (f.total / maxTotal) * 6;
          const isCrit = f.critical > 0;
          return (
            <path
              key={`${f.source}-${f.sink}`}
              d={`M ${LEFT_X} ${y1} C ${LEFT_X + 120} ${y1}, ${RIGHT_X - 120} ${y2}, ${RIGHT_X} ${y2}`}
              fill="none"
              stroke={isCrit ? color.danger : color.accent}
              strokeOpacity={isCrit ? 0.55 : 0.4}
              strokeWidth={strokeW}
              strokeDasharray={360}
              style={{
                ["--dash" as string]: "360",
                animation: `pinj-draw 720ms ${ENTRY_EASE} both`,
                animationDelay: `${140 + i * 22}ms`,
              } as CSSProperties}
            />
          );
        })}

        {/* Source pills */}
        {SOURCES.map(s => {
          const y = sourceY.get(s)!;
          return (
            <g key={s} style={{ animation: `pinj-tile 520ms ${ENTRY_EASE} both` }}>
              <rect x={LEFT_X - 140} y={y - 12} width={140} height={24} rx={radius.sm} ry={radius.sm}
                fill={color.bg2} stroke={color.border} strokeWidth={0.8} />
              <text x={LEFT_X - 70} y={y + 4} textAnchor="middle"
                fontSize={11} fontFamily={font.mono} fill={color.text0}>
                {SOURCE_LABEL[s]}
              </text>
              <circle cx={LEFT_X - LABEL_GAP} cy={y} r={3} fill={color.danger} opacity={0.7} />
            </g>
          );
        })}

        {/* Sink pills */}
        {SINKS.map(k => {
          const y = sinkY.get(k)!;
          return (
            <g key={k} style={{ animation: `pinj-tile 520ms ${ENTRY_EASE} both` }}>
              <rect x={RIGHT_X} y={y - 12} width={160} height={24} rx={radius.sm} ry={radius.sm}
                fill={color.bg2} stroke={color.border} strokeWidth={0.8} />
              <text x={RIGHT_X + 80} y={y + 4} textAnchor="middle"
                fontSize={11} fontFamily={font.mono} fill={color.text0}>
                {SINK_LABEL[k]}
              </text>
              <circle cx={RIGHT_X + LABEL_GAP} cy={y} r={3} fill={color.accent} opacity={0.7} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Finding row ────────────────────────────────────────────────────────

function FindingRow({
  path, index, fileName, onFocus,
}: {
  path: PromptInjectionPath; index: number; fileName: string; onFocus: () => void;
}): ReactElement {
  const tint = SEVERITY_TINT[path.severity];
  const fix = FIX_SUGGESTION[path.sinkKind];
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{
        ...rowStyle,
        animationDelay: `${Math.min(index * STAGGER_MS, 260)}ms`,
      }}
    >
      <span style={{
        padding: `${space[1]}px ${space[2]}px`,
        borderRadius: radius.sm,
        background: `${tint}18`,
        color: tint,
        fontFamily: font.mono,
        fontSize: 10,
        fontWeight: font.weight.semibold,
        flex: "0 0 64px",
        textAlign: "center",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        {SEVERITY_LABEL[path.severity]}
      </span>
      <span style={kindBadgeStyle(color.danger)}>{SOURCE_LABEL[path.sourceKind]}</span>
      <span style={{ fontFamily: font.mono, fontSize: font.size.sm, color: color.text3 }}>→</span>
      <span style={kindBadgeStyle(color.accent)}>{SINK_LABEL[path.sinkKind]}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: font.size.xs, fontFamily: font.mono, color: color.text1,
          display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          <strong style={{ color: color.text0 }}>{fileName}</strong>:{path.line}
        </span>
        <span style={{
          fontSize: font.size.xxs, color: color.text2,
          display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          fix · <span style={{ color: color.text1 }}>{fix}</span>
        </span>
      </span>
    </button>
  );
}

function kindBadgeStyle(tint: string): CSSProperties {
  return {
    padding: `${space[1]}px ${space[2]}px`,
    background: `${tint}14`,
    color: tint,
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: font.weight.medium,
    borderRadius: radius.sm,
    border: `1px solid ${tint}33`,
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  };
}

// ── Filter chip ────────────────────────────────────────────────────────

function FilterChip({
  label, active, onClick, tint,
}: { label: string; active: boolean; onClick: () => void; tint?: string }): ReactElement {
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

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `pinj-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  minHeight: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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

const sevGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  marginBottom: space[5],
};

const tileStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `pinj-tile 440ms ${ENTRY_EASE} both`,
};

const sectionStyle: CSSProperties = {
  marginTop: space[5],
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

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  marginTop: space[5],
  marginBottom: space[3],
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
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `pinj-row 440ms ${ENTRY_EASE} both`,
  background: "transparent",
};

export const PromptInjectionView = memo(PromptInjectionViewImpl);
