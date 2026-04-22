// DecisionLogView — Architectural Decision Records (ADR) viewer.
// --------------------------------------------------------------------
// Top: 4 status counters (accepted / proposed / superseded / deprecated).
// Below: filter chips for status + tag (all AND).
// Main: vertical timeline list. Each card shows number, title, status
// pill, date, and a collapsible body (Context / Decision / Consequences).
// Superseded ADRs show a "superseded by #N" banner at the top of the
// card. Tags are rendered as small pill chips at the bottom.
// Right: "Agent compliance" panel — for each accepted ADR, a checkbox
// marking whether the agent is currently respecting the rule.
//
// Reference: Michael Nygard, "Documenting Architecture Decisions"
// (Relevance, 2011); MADR — Markdown Architecture Decision Records.

import { memo, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { synthADRs, type ADR } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

type ADRStatus = ADR["status"];

const STATUS_ORDER: readonly ADRStatus[] = ["accepted", "proposed", "superseded", "deprecated"];

const STATUS_KOREAN: Record<ADRStatus, string> = {
  accepted: "승인",
  proposed: "제안",
  superseded: "대체됨",
  deprecated: "폐기",
};

const STATUS_TINT: Record<ADRStatus, string> = {
  accepted: color.success,
  proposed: color.accent,
  superseded: color.text2,
  deprecated: color.danger,
};

const KEYFRAMES = `
@keyframes dl-enter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes dl-item { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
`;

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DecisionLogViewImpl({ ctx: _ctx }: Props): ReactElement | null {
  const adrs = useMemo(() => synthADRs(), []);
  const [statusFilter, setStatusFilter] = useState<Set<ADRStatus>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(adrs.filter(a => a.status === "accepted").slice(0, 2).map(a => a.id)));

  const counts = useMemo(() => {
    const c: Record<ADRStatus, number> = { accepted: 0, proposed: 0, superseded: 0, deprecated: 0 };
    for (const a of adrs) c[a.status]++;
    return c;
  }, [adrs]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const a of adrs) for (const t of a.tags) s.add(t);
    return [...s].sort();
  }, [adrs]);

  const filtered = useMemo(() => {
    return adrs
      .filter(a => {
        if (statusFilter.size > 0 && !statusFilter.has(a.status)) return false;
        if (tagFilter.size > 0 && !a.tags.some(t => tagFilter.has(t))) return false;
        return true;
      })
      .sort((a, b) => b.decidedAt - a.decidedAt);
  }, [adrs, statusFilter, tagFilter]);

  const accepted = useMemo(() => adrs.filter(a => a.status === "accepted"), [adrs]);

  if (adrs.length === 0) {
    return (
      <div style={emptyStyle}>
        <style>{KEYFRAMES}</style>
        <div style={{ color: color.text3, fontSize: font.size.md, fontFamily: font.sans }}>
          기록된 ADR이 없습니다.
        </div>
      </div>
    );
  }

  const toggleExpanded = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExpanded(n);
  };

  const toggleStatus = (s: ADRStatus) => {
    const n = new Set(statusFilter);
    if (n.has(s)) n.delete(s);
    else n.add(s);
    setStatusFilter(n);
  };

  const toggleTag = (t: string) => {
    const n = new Set(tagFilter);
    if (n.has(t)) n.delete(t);
    else n.add(t);
    setTagFilter(n);
  };

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Decision Log</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            ADR · Nygard 2011 / MADR 포맷 · 총 {adrs.length}건
          </div>
        </div>
      </header>

      <div style={countsGrid}>
        {STATUS_ORDER.map((s, i) => (
          <CountTile key={s} status={s} count={counts[s]} index={i} />
        ))}
      </div>

      <div style={filtersBlock}>
        <div style={filterRow}>
          <span style={filterTitle}>Status</span>
          {STATUS_ORDER.map(s => {
            const on = statusFilter.has(s);
            const tint = STATUS_TINT[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                style={chipStyle(on, tint)}
              >
                {STATUS_KOREAN[s]} · {counts[s]}
              </button>
            );
          })}
        </div>
        <div style={filterRow}>
          <span style={filterTitle}>Tags</span>
          {allTags.map(t => {
            const on = tagFilter.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                style={chipStyle(on, color.accent)}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div style={bodyStyle}>
        <div style={timelineWrap}>
          {filtered.length === 0 ? (
            <div style={{ padding: space[5], color: color.text3, fontSize: font.size.sm, textAlign: "center" }}>
              조건에 맞는 ADR이 없습니다.
            </div>
          ) : filtered.map((a, i) => (
            <ADRCard
              key={a.id}
              adr={a}
              index={i}
              expanded={expanded.has(a.id)}
              onToggle={() => toggleExpanded(a.id)}
            />
          ))}
        </div>

        <div style={rightPanel}>
          <div style={panelStyle}>
            <div style={labelStyle}>Agent compliance</div>
            <div style={{ marginTop: space[1], fontSize: font.size.xxs, color: color.text3 }}>
              현재 에이전트가 이 ADR들을 respect 중
            </div>
            <div style={{ marginTop: space[3], display: "flex", flexDirection: "column", gap: space[2] }}>
              {accepted.map((a, i) => {
                // Synthesize compliance based on ADR number parity + tags.
                const ok = (a.number * 7 + a.tags.length) % 5 !== 0;
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: space[2], animationDelay: `${i * 20}ms`, animation: "dl-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both" }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: ok ? color.success : color.bg3,
                      border: `1px solid ${ok ? color.success : color.border}`,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: 10,
                      fontWeight: font.weight.bold,
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {ok ? "✓" : ""}
                    </span>
                    <span style={{
                      fontSize: font.size.xs,
                      color: ok ? color.text0 : color.text2,
                      lineHeight: 1.4,
                      flex: 1,
                      minWidth: 0,
                    }}>
                      <span style={{ fontFamily: font.mono, color: color.text3, marginRight: 4 }}>#{a.number}</span>
                      {a.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CountTile({ status, count, index }: { status: ADRStatus; count: number; index: number }): ReactElement {
  const tint = STATUS_TINT[status];
  return (
    <div style={{
      ...tileStyle,
      animationDelay: `${index * 40}ms`,
    }}>
      <span style={{
        fontSize: font.size.xxs,
        color: color.text2,
        letterSpacing: font.letter.ultra,
        textTransform: "uppercase",
        fontWeight: font.weight.semibold,
      }}>{STATUS_KOREAN[status]}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: space[1], marginTop: 2 }}>
        <span style={{
          fontSize: 28,
          fontFamily: font.mono,
          fontWeight: font.weight.bold,
          color: count > 0 ? tint : color.text3,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}>
          {count}
        </span>
        {count > 0 && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: tint }} />
        )}
      </div>
    </div>
  );
}

function chipStyle(on: boolean, tint: string): CSSProperties {
  return {
    padding: `${space[1]}px ${space[3]}px`,
    border: `1px solid ${on ? tint : color.border}`,
    background: on ? `${tint}18` : color.bg1,
    color: on ? tint : color.text1,
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.medium,
    borderRadius: radius.pill,
    cursor: "pointer",
    transition: `all ${transition.base}`,
  };
}

function ADRCard({
  adr, index, expanded, onToggle,
}: { adr: ADR; index: number; expanded: boolean; onToggle: () => void }): ReactElement {
  const tint = STATUS_TINT[adr.status];
  return (
    <div style={{
      ...cardStyle,
      animationDelay: `${Math.min(index, 30) * 20}ms`,
    }}>
      {adr.supersededBy && (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          padding: `${space[1]}px ${space[2]}px`,
          borderRadius: radius.sm,
          background: `${color.warn}18`,
          color: color.warn,
          fontSize: font.size.xxs,
          fontFamily: font.mono,
          marginBottom: space[2],
        }}>
          superseded by {adr.supersededBy}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        style={cardHeaderBtn}
      >
        <span style={{ fontFamily: font.mono, color: color.text3, fontSize: font.size.xs }}>
          ADR-{String(adr.number).padStart(3, "0")}
        </span>
        <span style={{
          fontSize: font.size.md,
          fontWeight: font.weight.semibold,
          color: color.text0,
          flex: 1,
          textAlign: "left",
        }}>
          {adr.title}
        </span>
        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          background: `${tint}18`,
          color: tint,
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          {STATUS_KOREAN[adr.status]}
        </span>
        <span style={{
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: color.text3,
          marginLeft: space[2],
        }}>
          {fmtDate(adr.decidedAt)}
        </span>
        <span style={{
          fontFamily: font.mono,
          fontSize: font.size.xs,
          color: color.text3,
          marginLeft: space[2],
        }}>
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: space[3], display: "flex", flexDirection: "column", gap: space[3] }}>
          <Section title="Context" body={adr.context} />
          <Section title="Decision" body={adr.decision} />
          <Section title="Consequences" body={adr.consequences} />
        </div>
      )}
      <div style={{ marginTop: space[3], display: "flex", gap: space[2], flexWrap: "wrap" }}>
        {adr.tags.map(t => (
          <span
            key={t}
            style={{
              padding: `${space[0]}px ${space[2]}px`,
              borderRadius: radius.pill,
              background: color.bg3,
              color: color.text2,
              fontSize: font.size.xxs,
              fontFamily: font.mono,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }): ReactElement {
  return (
    <div>
      <div style={{
        fontSize: font.size.xxs,
        color: color.text2,
        letterSpacing: font.letter.ultra,
        textTransform: "uppercase",
        fontWeight: font.weight.semibold,
        marginBottom: space[1],
      }}>
        {title}
      </div>
      <div style={{
        fontSize: font.size.sm,
        color: color.text1,
        lineHeight: 1.55,
      }}>
        {body}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "dl-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  fontFamily: font.sans,
};

const headerStyle: CSSProperties = {
  marginBottom: space[4],
};

const countsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  marginBottom: space[4],
};

const tileStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "dl-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const filtersBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  marginBottom: space[3],
};

const filterRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  flexWrap: "wrap",
};

const filterTitle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  minWidth: 60,
};

const bodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gap: space[3],
  alignItems: "start",
};

const timelineWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const cardStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "dl-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const cardHeaderBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  width: "100%",
  padding: 0,
  background: "transparent",
  border: "none",
  font: "inherit",
  cursor: "pointer",
  textAlign: "left",
};

const rightPanel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  position: "sticky",
  top: 0,
};

const panelStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "dl-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const labelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const DecisionLogView = memo(DecisionLogViewImpl);
