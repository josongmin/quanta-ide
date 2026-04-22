// AuditTrailView — chronological log of every agent action.
// --------------------------------------------------------------------
// Top:    4 tiles (total actions, edits, shell cmds, rejections, 14d).
// Filter: action kind chips + outcome chips + agent selector.
// Main:   virtualized-feel timeline list (top 80 entries).
// Right:  24h × 14d calendar heatmap (8px cells, 1px gap).
//
// Reference:
//   - SOC2 CC7.2 / ISO 27001 A.12.4 — logging & monitoring.
//   - Kubernetes audit log — RequestReceived / ResponseComplete events.
//   - AWS CloudTrail — per-action event with user / resource / outcome.

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
  authorHue,
  synthAuditTrail,
  type AuditActionKind,
  type AuditEntry,
} from "../../../shared/analytics/synth-metrics";

const KEYFRAMES = `
@keyframes atEnter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes atRow   { 0% { opacity: 0; transform: translateX(-4px); } 100% { opacity: 1; transform: translateX(0); } }
@keyframes atCell  { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
`;

type OutcomeFilter = "all" | "success" | "failure" | "reverted";

const ACTION_ORDER: AuditActionKind[] = ["read", "edit", "create", "delete", "shell", "approve", "reject"];

const ACTION_LABEL: Record<AuditActionKind, string> = {
  read: "read",
  edit: "edit",
  create: "create",
  delete: "delete",
  shell: "shell",
  approve: "approve",
  reject: "reject",
};

const ACTION_COLOR: Record<AuditActionKind, string> = {
  read: color.text2,
  edit: color.accent,
  create: color.success,
  delete: color.danger,
  shell: "#7e4ed6",
  approve: color.success,
  reject: color.warn,
};

const OUTCOME_COLOR: Record<AuditEntry["outcome"], string> = {
  success: color.success,
  failure: color.danger,
  reverted: color.warn,
};

const MAX_ROWS = 80;
const HEATMAP_DAYS = 14;
const HEATMAP_HOURS = 24;
const CELL = 8;
const CELL_GAP = 1;

interface Props {
  ctx: ViewContextValue;
}

function AuditTrailViewImpl({ ctx }: Props): ReactElement | null {
  const [actionFilter, setActionFilter] = useState<"all" | AuditActionKind>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const entries = useMemo(() => synthAuditTrail(ctx.tree, 120), [ctx.tree]);

  const agents = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.agent);
    return [...set];
  }, [entries]);

  // Tiles are always 14d scoped.
  const tiles = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 14 * 86_400_000;
    const recent = entries.filter(e => e.timestamp >= cutoff);
    return {
      total: recent.length,
      edits: recent.filter(e => e.actionKind === "edit").length,
      shell: recent.filter(e => e.actionKind === "shell").length,
      rejects: recent.filter(e => e.actionKind === "reject").length,
    };
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (actionFilter !== "all" && e.actionKind !== actionFilter) return false;
      if (outcomeFilter !== "all" && e.outcome !== outcomeFilter) return false;
      if (agentFilter !== "all" && e.agent !== agentFilter) return false;
      return true;
    }).slice(0, MAX_ROWS);
  }, [entries, actionFilter, outcomeFilter, agentFilter]);

  // 24h × 14d heatmap grid.
  const heatGrid = useMemo(() => {
    const grid: number[][] = Array.from({ length: HEATMAP_DAYS }, () => Array(HEATMAP_HOURS).fill(0));
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    for (const e of entries) {
      const age = todayStart - new Date(e.timestamp).setHours(0, 0, 0, 0);
      const dayAgo = Math.floor(age / 86_400_000);
      if (dayAgo < 0 || dayAgo >= HEATMAP_DAYS) continue;
      const hour = new Date(e.timestamp).getHours();
      // dayAgo 0 = today, we want today on the rightmost column → idx = HEATMAP_DAYS-1-dayAgo
      const dayIdx = HEATMAP_DAYS - 1 - dayAgo;
      grid[dayIdx]![hour]!++;
    }
    let max = 0;
    for (const row of grid) for (const c of row) if (c > max) max = c;
    return { grid, max };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color.text3,
          fontFamily: font.sans,
          background: color.bg0,
        }}
      >
        기록이 없습니다
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Audit Trail</div>
          <div style={subtitleStyle}>
            에이전트 감사 로그 — SOC2 CC7.2 · ISO 27001 A.12.4 · Kubernetes audit log · AWS CloudTrail
          </div>
        </div>
      </header>

      {/* Stats tiles */}
      <div style={tileRowStyle}>
        <StatTile label="총 액션" value={tiles.total} sub="14일" index={0} />
        <StatTile label="편집" value={tiles.edits} sub="edit" index={1} tone={color.accent} />
        <StatTile label="셸 명령" value={tiles.shell} sub="shell" index={2} tone="#7e4ed6" />
        <StatTile label="거부" value={tiles.rejects} sub="reject" index={3} tone={color.warn} />
      </div>

      {/* Filters */}
      <div style={filterBarStyle}>
        <div style={filterGroupStyle} role="tablist" aria-label="action kind">
          <FilterChip label="전체" active={actionFilter === "all"} onClick={() => setActionFilter("all")} />
          {ACTION_ORDER.map(k => (
            <FilterChip
              key={k}
              label={ACTION_LABEL[k]}
              active={actionFilter === k}
              onClick={() => setActionFilter(k)}
              dot={ACTION_COLOR[k]}
            />
          ))}
        </div>
        <div style={filterGroupStyle}>
          <FilterChip label="all outcomes" active={outcomeFilter === "all"} onClick={() => setOutcomeFilter("all")} />
          <FilterChip label="success" active={outcomeFilter === "success"} onClick={() => setOutcomeFilter("success")} dot={OUTCOME_COLOR.success} />
          <FilterChip label="failure" active={outcomeFilter === "failure"} onClick={() => setOutcomeFilter("failure")} dot={OUTCOME_COLOR.failure} />
          <FilterChip label="reverted" active={outcomeFilter === "reverted"} onClick={() => setOutcomeFilter("reverted")} dot={OUTCOME_COLOR.reverted} />
        </div>
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All agents</option>
          {agents.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={bodyStyle}>
        {/* Timeline */}
        <section style={timelineStyle}>
          {filtered.length === 0 ? (
            <div style={emptyStyle}>조건에 해당하는 로그가 없습니다</div>
          ) : (
            filtered.map((e, i) => (
              <button
                key={e.id}
                type="button"
                onClick={() => e.targetFileId && ctx.dispatch.selectEntity(e.targetFileId)}
                style={{
                  ...rowStyle,
                  animationDelay: `${Math.min(i * 14, 800)}ms`,
                  cursor: e.targetFileId ? "pointer" : "default",
                }}
              >
                <span style={timeChipStyle}>{formatTime(e.timestamp)}</span>
                <span style={{ ...agentAvatarStyle, background: `hsl(${authorHue(e.agent)} 68% 62%)` }}>
                  {e.agent.slice(0, 1).toUpperCase()}
                </span>
                <span style={actionBadgeStyle(e.actionKind)}>{ACTION_LABEL[e.actionKind]}</span>

                <span style={targetColStyle}>
                  {e.shellCmd ? (
                    <span style={shellCmdStyle}>$ {e.shellCmd}</span>
                  ) : e.targetFileName ? (
                    <span style={fileNameStyle}>{e.targetFileName}</span>
                  ) : (
                    <span style={{ color: color.text3 }}>—</span>
                  )}
                </span>

                <span style={diffColStyle}>
                  {e.diffLines ? (
                    <>
                      <span style={{ color: color.success }}>+{e.diffLines.added}</span>
                      <span style={{ color: color.text3 }}> / </span>
                      <span style={{ color: color.danger }}>-{e.diffLines.removed}</span>
                    </>
                  ) : null}
                </span>

                <span style={{ ...outcomeDotStyle, background: OUTCOME_COLOR[e.outcome] }} title={e.outcome} />
                <span style={costColStyle}>{formatUsd(e.costUsd)}</span>
              </button>
            ))
          )}
        </section>

        {/* Heatmap sidebar */}
        <aside style={heatPanelStyle}>
          <div style={panelHeaderStyle}>Activity · 24h × 14d</div>
          <div style={{ padding: space[3] }}>
            <Heatmap grid={heatGrid.grid} max={heatGrid.max} />
            <div style={heatLegendStyle}>
              <span style={{ color: color.text2 }}>less</span>
              <div style={{ display: "flex", gap: 2 }}>
                {[0, 0.25, 0.5, 0.75, 1].map(v => (
                  <div
                    key={v}
                    style={{
                      width: CELL,
                      height: CELL,
                      background: heatColor(v),
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>
              <span style={{ color: color.text2 }}>more</span>
            </div>
            <div style={{ marginTop: space[2], fontSize: font.size.xxs, color: color.text3 }}>
              row = day (old→new), col = hour (0→23)
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatTile({
  label, value, sub, index, tone,
}: { label: string; value: number; sub: string; index: number; tone?: string }): ReactElement {
  return (
    <div
      style={{
        ...tileStyle,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <div style={tileLabelStyle}>{label}</div>
      <div style={{ ...tileValueStyle, color: tone ?? color.text0 }}>{value}</div>
      <div style={tileSubStyle}>{sub}</div>
    </div>
  );
}

function FilterChip({
  label, active, onClick, dot,
}: { label: string; active: boolean; onClick: () => void; dot?: string }): ReactElement {
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
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />}
      <span>{label}</span>
    </button>
  );
}

function Heatmap({ grid, max }: { grid: number[][]; max: number }): ReactElement {
  const gridW = HEATMAP_HOURS * (CELL + CELL_GAP) - CELL_GAP;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: CELL_GAP, width: gridW }}>
      {grid.map((row, dayIdx) => (
        <div key={dayIdx} style={{ display: "flex", gap: CELL_GAP }}>
          {row.map((v, hour) => {
            const intensity = max === 0 ? 0 : v / max;
            return (
              <div
                key={hour}
                title={`day -${HEATMAP_DAYS - 1 - dayIdx} · ${String(hour).padStart(2, "0")}:00 · ${v} actions`}
                style={{
                  width: CELL,
                  height: CELL,
                  background: heatColor(intensity),
                  borderRadius: 1,
                  animation: "atCell 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
                  animationDelay: `${Math.min((dayIdx * HEATMAP_HOURS + hour) * 3, 600)}ms`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function heatColor(v: number): string {
  // 0..1 → low bg to accent. Light theme friendly.
  if (v <= 0) return color.bg3;
  if (v < 0.25) return "#c7e3ff";
  if (v < 0.5) return "#8ec6ff";
  if (v < 0.75) return "#4fa9ff";
  return color.accent;
}

function actionBadgeStyle(k: AuditActionKind): CSSProperties {
  const c = ACTION_COLOR[k];
  return {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: radius.sm,
    background: `${c}1f`,
    color: c,
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    fontFamily: font.mono,
    letterSpacing: font.letter.wide,
    width: 60,
    textAlign: "center",
    textTransform: "uppercase",
    border: `1px solid ${c}40`,
  };
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mo}/${dd} ${hh}:${mm}`;
}

function formatUsd(n: number): string {
  if (n <= 0) return "—";
  if (n < 0.01) return "<$0.01";
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
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
  gap: space[3],
  fontFamily: font.sans,
  color: color.text0,
  animation: "atEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  overflow: "hidden",
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

const tileRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
};

const tileStyle: CSSProperties = {
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "atRow 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const tileLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const tileValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: font.weight.bold,
  fontVariantNumeric: "tabular-nums",
  marginTop: space[1],
  lineHeight: 1,
};

const tileSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  marginTop: 4,
};

const filterBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: space[3],
};

const filterGroupStyle: CSSProperties = {
  display: "inline-flex",
  gap: space[1],
  padding: space[1],
  background: color.bg2,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: `${space[1]}px ${space[2]}px`,
  fontSize: font.size.xxs,
  fontWeight: font.weight.medium,
  border: "none",
  borderRadius: radius.pill,
  cursor: "pointer",
  fontFamily: font.sans,
  transition: "background 180ms ease-out, color 180ms ease-out",
};

const selectStyle: CSSProperties = {
  padding: `${space[1]}px ${space[2]}px`,
  fontSize: font.size.xs,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  background: color.bg0,
  fontFamily: font.sans,
  color: color.text0,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gap: space[3],
  overflow: "hidden",
};

const timelineStyle: CSSProperties = {
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: space[2],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const emptyStyle: CSSProperties = {
  color: color.text3,
  fontSize: font.size.sm,
  textAlign: "center",
  padding: space[7],
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontSize: font.size.xs,
  fontFamily: font.sans,
  textAlign: "left",
  animation: "atRow 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: "background 120ms ease-out",
};

const timeChipStyle: CSSProperties = {
  width: 64,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

const agentAvatarStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.bg0,
  fontSize: font.size.xxs,
  fontWeight: font.weight.bold,
  flexShrink: 0,
};

const targetColStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const fileNameStyle: CSSProperties = {
  color: color.text0,
};

const shellCmdStyle: CSSProperties = {
  color: color.text1,
  fontFamily: font.mono,
  fontSize: font.size.xxs,
};

const diffColStyle: CSSProperties = {
  width: 70,
  textAlign: "right",
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  fontVariantNumeric: "tabular-nums",
};

const outcomeDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};

const costColStyle: CSSProperties = {
  width: 52,
  textAlign: "right",
  color: color.text1,
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  fontVariantNumeric: "tabular-nums",
};

const heatPanelStyle: CSSProperties = {
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "auto",
};

const panelHeaderStyle: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
  background: color.bg0,
  borderBottom: `1px solid ${color.border}`,
};

const heatLegendStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  marginTop: space[3],
  fontSize: font.size.xxs,
};

export const AuditTrailView = memo(AuditTrailViewImpl);
