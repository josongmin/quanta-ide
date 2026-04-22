// RefactoringMinerView — timeline of historical refactorings.
// --------------------------------------------------------------------
// Top:    horizontal bar chart — total events per refactoring kind.
// Middle: timeline (x = last 180 days, one row per refactoring kind,
//         dots sized by symbols affected). Clicking a dot sets a
//         selection filter.
// Right:  event list filtered to the selected dot's files.
//
// Reference: Tsantalis et al. ICSE 2018.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  REFACTORING_KINDS,
  refactoringsApplied,
  seeded,
} from "../../../shared/analytics/synth-metrics";
import type { RefactoringKind } from "../../../shared/analytics/synth-metrics";

export interface RefactoringMinerViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const WINDOW_DAYS = 180;
const DAY_MS = 86_400_000;

const KIND_LABEL: Readonly<Record<RefactoringKind, string>> = {
  "extract-method": "Extract Method",
  "rename": "Rename",
  "move-class": "Move Class",
  "inline": "Inline",
  "pull-up": "Pull Up",
  "extract-class": "Extract Class",
  "push-down": "Push Down",
  "extract-interface": "Extract Interface",
};

const KIND_HUES: Readonly<Record<RefactoringKind, string>> = {
  "extract-method": tokenColor.kindGalaxy,
  "rename": tokenColor.kindFloor,
  "move-class": tokenColor.kindStreet,
  "inline": tokenColor.kindRoom,
  "pull-up": tokenColor.kindUniverse,
  "extract-class": tokenColor.accent,
  "push-down": tokenColor.warn,
  "extract-interface": tokenColor.success,
};

const KEYFRAMES = `
@keyframes rmFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes rmItemIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

interface RmEvent {
  id: string;           // `${fileId}:${index}`
  fileId: string;
  fileName: string;
  path: string;
  kind: RefactoringKind;
  at: number;           // epoch ms
  symbols: number;      // synthetic count
}

function RefactoringMinerViewImpl({
  ctx,
}: RefactoringMinerViewProps): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);
  const [selected, setSelected] = useState<{ kind: RefactoringKind; at: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const events = useMemo<RmEvent[]>(() => {
    if (!ctx.tree) return [];
    const out: RmEvent[] = [];
    const cutoff = Date.now() - WINDOW_DAYS * DAY_MS;
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const applied = refactoringsApplied(e);
      const symRng = seeded(e.id, "rm-sym");
      applied.forEach((r, idx) => {
        if (r.at < cutoff) return;
        out.push({
          id: `${e.id}:${idx}`,
          fileId: e.id,
          fileName: e.name,
          path: e.path,
          kind: r.kind,
          at: r.at,
          symbols: 1 + Math.floor(symRng() * 12),
        });
      });
    }
    out.sort((a, b) => a.at - b.at);
    return out;
  }, [ctx.tree]);

  const countsByKind = useMemo(() => {
    const m = new Map<RefactoringKind, number>();
    for (const k of REFACTORING_KINDS) m.set(k, 0);
    for (const e of events) m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
    return m;
  }, [events]);

  const maxCount = Math.max(1, ...Array.from(countsByKind.values()));

  // Selected event: prefer exact match on time; otherwise match kind.
  const filteredEvents = useMemo(() => {
    if (!selected) return [];
    return events.filter(
      e => e.kind === selected.kind && Math.abs(e.at - selected.at) < DAY_MS / 2,
    );
  }, [events, selected]);

  if (!ctx.tree || events.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokenColor.text3,
          fontFamily: font.sans,
          fontSize: font.size.md,
          background: tokenColor.bg0,
        }}
      >
        <style>{KEYFRAMES}</style>
        최근 180일 동안 감지된 리팩터링이 없습니다
      </div>
    );
  }

  const rootStyle: CSSProperties = {
    animation: `rmFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: "40px 48px 32px 48px",
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
  };

  // Timeline layout.
  const timelineW = Math.max(360, width - 96 - 320); // leave space for right panel
  const rowH = 30;
  const timelineH = rowH * REFACTORING_KINDS.length + 24;
  const now = Date.now();
  const start = now - WINDOW_DAYS * DAY_MS;

  const xForDate = (ts: number): number => {
    const t = (ts - start) / (now - start);
    return Math.max(0, Math.min(1, t)) * (timelineW - 120) + 110;
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        position: "relative",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header */}
        <div style={{ marginBottom: space[4] }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
            }}
          >
            Refactoring History
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            최근 {WINDOW_DAYS}일 리팩터링 탐지 — Tsantalis ICSE 2018 (RefactoringMiner)
          </div>
        </div>

        {/* Aggregate bar chart */}
        <div style={{ marginBottom: space[4] }}>
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text2,
              textTransform: "uppercase",
              letterSpacing: font.letter.ultra,
              marginBottom: space[2],
            }}
          >
            Totals by kind
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {REFACTORING_KINDS.map((k, i) => {
              const count = countsByKind.get(k) ?? 0;
              const pct = (count / maxCount) * 100;
              const isSelected = selected?.kind === k;
              return (
                <div
                  key={k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr 48px",
                    gap: 12,
                    alignItems: "center",
                    animation: `rmItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${i * STAGGER_MS}ms`,
                  }}
                >
                  <div
                    style={{
                      fontSize: font.size.xs,
                      color: isSelected ? tokenColor.text0 : tokenColor.text1,
                      fontWeight: isSelected
                        ? font.weight.semibold
                        : font.weight.regular,
                    }}
                  >
                    {KIND_LABEL[k]}
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 8,
                      background: tokenColor.bg3,
                      borderRadius: radiusToken.pill,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: KIND_HUES[k],
                        borderRadius: radiusToken.pill,
                        opacity: 0.85,
                        transition: "width 320ms ease-out",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: font.size.xs,
                      color: tokenColor.text1,
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "right",
                      fontWeight: font.weight.semibold,
                    }}
                  >
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline + right panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${timelineW}px 300px`,
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: font.size.xxs,
                color: tokenColor.text2,
                textTransform: "uppercase",
                letterSpacing: font.letter.ultra,
                marginBottom: space[2],
              }}
            >
              Timeline — last {WINDOW_DAYS} days
            </div>
            <svg
              width={timelineW}
              height={timelineH}
              viewBox={`0 0 ${timelineW} ${timelineH}`}
              style={{ display: "block", background: tokenColor.bg2, borderRadius: radiusToken.md, border: `1px solid ${tokenColor.border}` }}
              role="img"
              aria-label="Refactoring timeline"
            >
              {/* Row separators + labels */}
              {REFACTORING_KINDS.map((k, i) => {
                const y = 12 + i * rowH + rowH / 2;
                return (
                  <g key={`row-${k}`}>
                    <line
                      x1={110}
                      x2={timelineW - 10}
                      y1={y}
                      y2={y}
                      stroke={tokenColor.border}
                      strokeDasharray="2 3"
                      strokeWidth={1}
                    />
                    <text
                      x={102}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={font.size.xxs}
                      fill={tokenColor.text2}
                    >
                      {KIND_LABEL[k]}
                    </text>
                  </g>
                );
              })}

              {/* Date axis — today / -90d / -180d ticks */}
              {[0, 0.5, 1].map(t => {
                const ts = start + t * (now - start);
                const x = xForDate(ts);
                const days = Math.round((now - ts) / DAY_MS);
                return (
                  <g key={`tick-${t}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={8}
                      y2={timelineH - 8}
                      stroke={tokenColor.border}
                      strokeWidth={1}
                    />
                    <text
                      x={x}
                      y={timelineH - 2}
                      fontSize={font.size.xxs}
                      fill={tokenColor.text2}
                      textAnchor="middle"
                    >
                      {days === 0 ? "today" : `−${days}d`}
                    </text>
                  </g>
                );
              })}

              {/* Event dots */}
              {events.map((ev, i) => {
                const rowIdx = REFACTORING_KINDS.indexOf(ev.kind);
                const cy = 12 + rowIdx * rowH + rowH / 2;
                const cx = xForDate(ev.at);
                const r = 2.5 + Math.min(6, ev.symbols * 0.45);
                const isSelected =
                  selected !== null &&
                  selected.kind === ev.kind &&
                  Math.abs(selected.at - ev.at) < DAY_MS / 2;
                const isHovered = hovered === ev.id;
                const dimmed = hovered !== null && !isHovered;
                return (
                  <circle
                    key={ev.id}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={KIND_HUES[ev.kind]}
                    opacity={dimmed ? 0.25 : isSelected ? 1 : 0.8}
                    stroke={isSelected ? tokenColor.text0 : "none"}
                    strokeWidth={isSelected ? 1.5 : 0}
                    style={{
                      cursor: "pointer",
                      transition: "opacity 180ms ease-out",
                      animation: `rmItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                      animationDelay: `${Math.min(i * 3, 400)}ms`,
                    }}
                    onMouseEnter={() => setHovered(ev.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected({ kind: ev.kind, at: ev.at })}
                  >
                    <title>
                      {`${KIND_LABEL[ev.kind]} · ${ev.fileName} · ${ev.symbols} symbols`}
                    </title>
                  </circle>
                );
              })}
            </svg>
            <div
              style={{
                marginTop: space[2],
                fontSize: font.size.xxs,
                color: tokenColor.text3,
              }}
            >
              dot size ∝ 영향 심볼 수 · click → 오른쪽 패널 필터
            </div>
          </div>

          {/* Right panel — filtered event file list */}
          <div
            style={{
              background: tokenColor.bg2,
              border: `1px solid ${tokenColor.border}`,
              borderRadius: radiusToken.md,
              padding: space[3],
              minHeight: timelineH,
              maxHeight: timelineH + 40,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: font.size.xxs,
                color: tokenColor.text2,
                textTransform: "uppercase",
                letterSpacing: font.letter.ultra,
                marginBottom: space[2],
              }}
            >
              {selected
                ? `${KIND_LABEL[selected.kind]} · ${filteredEvents.length} files`
                : "Select an event"}
            </div>
            {!selected && (
              <div
                style={{
                  fontSize: font.size.xs,
                  color: tokenColor.text3,
                  lineHeight: 1.5,
                }}
              >
                타임라인 dot을 클릭하면 해당 이벤트가 영향을 준 파일들이 여기에
                펼쳐집니다.
              </div>
            )}
            {selected && filteredEvents.length === 0 && (
              <div style={{ fontSize: font.size.xs, color: tokenColor.text3 }}>
                해당 시점 파일이 없습니다
              </div>
            )}
            {filteredEvents.map((ev, i) => (
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                onClick={() => ctx.dispatch.selectEntity(ev.fileId)}
                style={{
                  padding: `${space[2]}px ${space[2]}px`,
                  borderRadius: radiusToken.sm,
                  cursor: "pointer",
                  marginBottom: 4,
                  animation: `rmItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${i * STAGGER_MS}ms`,
                  background:
                    ctx.selectedId === ev.fileId ? tokenColor.selected : "transparent",
                  transition: "background 180ms ease-out",
                }}
                onMouseEnter={e => {
                  if (ctx.selectedId !== ev.fileId) {
                    e.currentTarget.style.background = tokenColor.hover;
                  }
                }}
                onMouseLeave={e => {
                  if (ctx.selectedId !== ev.fileId) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div
                  style={{
                    fontSize: font.size.sm,
                    fontWeight: font.weight.medium,
                    color: tokenColor.text0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ev.fileName}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: font.size.xxs,
                      color: tokenColor.text2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                    }}
                  >
                    {ev.path}
                  </div>
                  <div
                    style={{
                      fontSize: font.size.xxs,
                      color: tokenColor.text2,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {ev.symbols} sym
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const RefactoringMinerView = memo(RefactoringMinerViewImpl);
