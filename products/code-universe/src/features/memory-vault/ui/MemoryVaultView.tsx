// MemoryVaultView — persistent repo-scoped facts the agent remembers.
// --------------------------------------------------------------------
// Top: 5-kind filter chip row. Main: card list (kind badge · fact text ·
// source chip · confidence bar · verified check · usage badge · last
// used). Bottom: add-new form. Right sidebar: by-source pie + by-kind
// breakdown bars.
//
// Reference:
//   - LangMem / Letta (MemGPT) — persistent memory that survives across
//     sessions; https://research.memgpt.ai.
//   - Anthropic "Creating effective Claude Projects" (2024) — Project
//     knowledge + custom instructions.

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
  synthMemoryVault,
  type MemoryFact,
  type MemoryFactKind,
} from "../../../shared/analytics/synth-metrics";

const KEYFRAMES = `
@keyframes mvEnter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes mvCard  { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes mvBar   { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
`;

const KIND_KOREAN: Record<MemoryFactKind, string> = {
  convention: "규약",
  gotcha: "함정",
  "domain-term": "도메인 용어",
  pitfall: "주의",
  style: "스타일",
};

const KIND_ORDER: MemoryFactKind[] = ["convention", "gotcha", "domain-term", "pitfall", "style"];

const KIND_COLOR: Record<MemoryFactKind, string> = {
  convention: color.accent,
  gotcha: color.warn,
  "domain-term": "#7e4ed6",
  pitfall: color.danger,
  style: color.success,
};

const SOURCE_COLOR: Record<MemoryFact["source"], string> = {
  team: color.accent,
  "agent-inferred": "#7e4ed6",
  "commit-analysis": color.success,
};

const SOURCE_LABEL: Record<MemoryFact["source"], string> = {
  team: "team",
  "agent-inferred": "agent",
  "commit-analysis": "commit",
};

interface Props {
  ctx: ViewContextValue;
}

function MemoryVaultViewImpl(_props: Props): ReactElement {
  const [kindFilter, setKindFilter] = useState<MemoryFactKind | "all">("all");
  const [newKind, setNewKind] = useState<MemoryFactKind>("convention");
  const [newText, setNewText] = useState("");

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const facts = useMemo(() => synthMemoryVault(), []);

  const filtered = useMemo(
    () => (kindFilter === "all" ? facts : facts.filter(f => f.kind === kindFilter)),
    [facts, kindFilter],
  );

  const byKind = useMemo(() => {
    const m = new Map<MemoryFactKind, number>();
    for (const k of KIND_ORDER) m.set(k, 0);
    for (const f of facts) m.set(f.kind, (m.get(f.kind) ?? 0) + 1);
    return m;
  }, [facts]);

  const bySource = useMemo(() => {
    const m = new Map<MemoryFact["source"], number>();
    for (const f of facts) m.set(f.source, (m.get(f.source) ?? 0) + 1);
    return m;
  }, [facts]);

  const total = facts.length;
  const sourceEntries = [...bySource.entries()];

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Memory Vault</div>
          <div style={subtitleStyle}>
            에이전트 메모리 금고 — LangMem · Letta (MemGPT) · Claude Projects
          </div>
        </div>
      </header>

      {/* Kind filter */}
      <div style={filterRowStyle} role="tablist" aria-label="kind filter">
        <FilterChip
          label="전체"
          count={facts.length}
          active={kindFilter === "all"}
          onClick={() => setKindFilter("all")}
        />
        {KIND_ORDER.map(k => (
          <FilterChip
            key={k}
            label={KIND_KOREAN[k]}
            count={byKind.get(k) ?? 0}
            active={kindFilter === k}
            onClick={() => setKindFilter(k)}
            dot={KIND_COLOR[k]}
          />
        ))}
      </div>

      <div style={bodyStyle}>
        {/* Main — card list + add form */}
        <div style={mainColStyle}>
          <div style={cardListStyle}>
            {filtered.map((f, i) => (
              <article
                key={f.id}
                style={{
                  ...cardStyle,
                  animationDelay: `${Math.min(i * 18, 700)}ms`,
                }}
              >
                <div style={cardTopRowStyle}>
                  <span style={kindBadgeStyle(f.kind)}>{KIND_KOREAN[f.kind]}</span>
                  <span style={sourceChipStyle(f.source)}>{SOURCE_LABEL[f.source]}</span>
                  {f.verified && <span style={verifiedStyle}>✓ verified</span>}
                  <span style={usageBadgeStyle}>{f.usageCount}× 사용</span>
                  <span style={{ flex: 1 }} />
                  <span style={timeStyle}>{relTime(f.lastUsedAt)}</span>
                </div>

                <div style={factTextStyle}>{f.text}</div>

                <div style={confidenceRowStyle}>
                  <span style={confLabelStyle}>confidence</span>
                  <div style={confTrackStyle}>
                    <div
                      style={{
                        ...confFillStyle,
                        width: `${f.confidence * 100}%`,
                        background: confColor(f.confidence),
                      }}
                    />
                  </div>
                  <span style={confValueStyle}>
                    {Math.round(f.confidence * 100)}%
                  </span>
                </div>

                <div style={cardActionsStyle}>
                  <button type="button" style={actionBtnStyle}>Verify</button>
                  <button type="button" style={actionBtnStyle}>Edit</button>
                  <button type="button" style={{ ...actionBtnStyle, color: color.danger }}>Remove</button>
                </div>
              </article>
            ))}
          </div>

          {/* Add new fact */}
          <div style={addFormStyle}>
            <div style={formHeadingStyle}>새 사실 추가</div>
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="예: repo 안에서 __ 은 절대 하지 말 것."
              style={textareaStyle}
              rows={3}
            />
            <div style={addControlsStyle}>
              <select
                value={newKind}
                onChange={e => setNewKind(e.target.value as MemoryFactKind)}
                style={selectStyle}
              >
                {KIND_ORDER.map(k => (
                  <option key={k} value={k}>{KIND_KOREAN[k]}</option>
                ))}
              </select>
              <button type="button" style={saveBtnStyle} onClick={() => setNewText("")}>
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar — source pie + kind breakdown */}
        <aside style={sidebarStyle}>
          <section style={sidebarSectionStyle}>
            <div style={sidebarHeadingStyle}>By source</div>
            <SourcePie entries={sourceEntries} total={total} />
            <div style={{ marginTop: space[3], display: "flex", flexDirection: "column", gap: 4 }}>
              {sourceEntries.map(([src, n]) => (
                <div key={src} style={legendRowStyle}>
                  <span style={{ ...legendDotStyle, background: SOURCE_COLOR[src] }} />
                  <span style={legendLabelStyle}>{SOURCE_LABEL[src]}</span>
                  <span style={legendValueStyle}>{n}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={sidebarSectionStyle}>
            <div style={sidebarHeadingStyle}>By kind</div>
            <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
              {KIND_ORDER.map(k => {
                const n = byKind.get(k) ?? 0;
                const pct = total === 0 ? 0 : n / total;
                return (
                  <div key={k}>
                    <div style={breakdownLabelRowStyle}>
                      <span style={{ ...legendDotStyle, background: KIND_COLOR[k] }} />
                      <span style={legendLabelStyle}>{KIND_KOREAN[k]}</span>
                      <span style={legendValueStyle}>{n}</span>
                    </div>
                    <div style={breakdownTrackStyle}>
                      <div
                        style={{
                          ...breakdownFillStyle,
                          width: `${pct * 100}%`,
                          background: KIND_COLOR[k],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function FilterChip({
  label, count, active, onClick, dot,
}: { label: string; count: number; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        ...chipStyle,
        background: active ? color.bg0 : "transparent",
        color: active ? color.text0 : color.text2,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
      }}
    >
      {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />}
      <span>{label}</span>
      <span style={chipCountStyle}>{count}</span>
    </button>
  );
}

function SourcePie({ entries, total }: { entries: [MemoryFact["source"], number][]; total: number }): ReactElement {
  const size = 120;
  const r = 42;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  // Accumulate start offset for each slice. Using stroke-dasharray.
  let acc = 0;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color.bg3} strokeWidth={12} />
        {entries.map(([src, n]) => {
          const frac = total === 0 ? 0 : n / total;
          const len = frac * circ;
          const offset = -acc;
          acc += len;
          return (
            <circle
              key={src}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={SOURCE_COLOR[src]}
              strokeWidth={12}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 560ms ease-out" }}
            />
          );
        })}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontFamily={font.sans}
          fontSize={font.size.lg}
          fontWeight={font.weight.bold}
          fill={color.text0}
        >
          {total}
        </text>
      </svg>
    </div>
  );
}

function kindBadgeStyle(kind: MemoryFactKind): CSSProperties {
  const c = KIND_COLOR[kind];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: radius.pill,
    background: `${c}1f`,
    color: c,
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    letterSpacing: font.letter.wide,
    border: `1px solid ${c}40`,
  };
}

function sourceChipStyle(src: MemoryFact["source"]): CSSProperties {
  const c = SOURCE_COLOR[src];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 6px",
    borderRadius: radius.sm,
    background: color.bg3,
    color: c,
    fontSize: font.size.xxs,
    fontWeight: font.weight.medium,
    fontFamily: font.mono,
  };
}

function confColor(c: number): string {
  if (c >= 0.85) return color.success;
  if (c >= 0.7) return color.accent;
  if (c >= 0.55) return color.warn;
  return color.danger;
}

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
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
  fontFamily: font.sans,
  color: color.text0,
  animation: "mvEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  marginBottom: space[4],
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

const filterRowStyle: CSSProperties = {
  display: "inline-flex",
  gap: space[1],
  padding: space[1],
  background: color.bg2,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  marginBottom: space[4],
  width: "fit-content",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: `${space[1]}px ${space[3]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  border: "none",
  borderRadius: radius.pill,
  cursor: "pointer",
  fontFamily: font.sans,
  transition: "background 180ms ease-out, color 180ms ease-out",
};

const chipCountStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gap: space[4],
  overflow: "hidden",
};

const mainColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  gap: space[3],
};

const cardListStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  paddingRight: space[2],
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: space[3],
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "mvCard 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const cardTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  flexWrap: "wrap",
};

const verifiedStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.success,
  fontWeight: font.weight.semibold,
};

const usageBadgeStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  background: color.bg3,
  padding: "1px 6px",
  borderRadius: radius.sm,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

const timeStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
};

const factTextStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  lineHeight: 1.55,
};

const confidenceRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  fontSize: font.size.xxs,
};

const confLabelStyle: CSSProperties = {
  width: 70,
  color: color.text2,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const confTrackStyle: CSSProperties = {
  flex: 1,
  height: 6,
  borderRadius: radius.pill,
  background: color.bg3,
  overflow: "hidden",
};

const confFillStyle: CSSProperties = {
  height: "100%",
  transformOrigin: "left center",
  animation: "mvBar 560ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: "width 180ms ease-out",
};

const confValueStyle: CSSProperties = {
  width: 36,
  textAlign: "right",
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const cardActionsStyle: CSSProperties = {
  display: "flex",
  gap: space[2],
  marginTop: space[1],
};

const actionBtnStyle: CSSProperties = {
  padding: `${space[1]}px ${space[2]}px`,
  fontSize: font.size.xxs,
  fontWeight: font.weight.medium,
  background: "transparent",
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  cursor: "pointer",
  fontFamily: font.sans,
  color: color.text1,
};

const addFormStyle: CSSProperties = {
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const formHeadingStyle: CSSProperties = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const textareaStyle: CSSProperties = {
  padding: space[2],
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontFamily: font.sans,
  fontSize: font.size.sm,
  color: color.text0,
  background: color.bg0,
  resize: "vertical",
  minHeight: 60,
};

const addControlsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: space[2],
};

const selectStyle: CSSProperties = {
  padding: `${space[1]}px ${space[2]}px`,
  fontSize: font.size.xs,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  background: color.bg0,
  fontFamily: font.sans,
};

const saveBtnStyle: CSSProperties = {
  padding: `${space[1]}px ${space[4]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.bg0,
  background: color.accent,
  border: "none",
  borderRadius: radius.sm,
  cursor: "pointer",
  fontFamily: font.sans,
};

const sidebarStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  overflow: "auto",
};

const sidebarSectionStyle: CSSProperties = {
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const sidebarHeadingStyle: CSSProperties = {
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
  marginBottom: space[2],
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  fontSize: font.size.xs,
};

const legendDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 2,
};

const legendLabelStyle: CSSProperties = {
  flex: 1,
  color: color.text1,
};

const legendValueStyle: CSSProperties = {
  color: color.text0,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const breakdownLabelRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  fontSize: font.size.xs,
  marginBottom: 4,
};

const breakdownTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: radius.pill,
  background: color.bg3,
  overflow: "hidden",
};

const breakdownFillStyle: CSSProperties = {
  height: "100%",
  transformOrigin: "left center",
  animation: "mvBar 560ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

export const MemoryVaultView = memo(MemoryVaultViewImpl);
