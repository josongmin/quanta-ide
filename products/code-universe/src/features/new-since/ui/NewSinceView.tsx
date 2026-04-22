// NewSinceView — files touched since a given timestamp.
// --------------------------------------------------------------------
// Header has a date picker + four preset chips ("지난 7일/30일/90일/1년").
// Body lists file cards for every `building` entity whose `commitHistory`
// has at least one commit within the selected window. Each card shows
// the filename, path, and a "+X commits" pill. Files without commits in
// the window are rendered as a very faint background grid — legible
// shape without competing with the highlighted list.
//
// Highlighted files stagger-animate in from below on mount / window change.

import { memo, useCallback, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius,
  space,
  transition,
} from "../../../shared/ui/tokens";
import { commitHistory } from "../../../shared/analytics/synth-metrics";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";

// ── Constants ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 500;

export interface NewSinceViewProps {
  ctx: ViewContextValue;
}

type Preset = 7 | 30 | 90 | 365;

interface ScoredFile {
  id: string;
  name: string;
  path: string;
  recent: number;
  hasCommits: boolean;
}

// ── Keyframes once ────────────────────────────────────────────────────

const KF_NAME  = "nsv-rise";
const KF_NAME2 = "nsv-fadeIn";
const KF_CSS = `
@keyframes ${KF_NAME} {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes ${KF_NAME2} {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1);    }
}
`;

let _kfInjected = false;
function ensureKeyframes(): void {
  if (_kfInjected || typeof document === "undefined") return;
  _kfInjected = true;
  const el = document.createElement("style");
  el.textContent = KF_CSS;
  document.head.appendChild(el);
}

// ── Helpers ───────────────────────────────────────────────────────────

function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromDateInputValue(s: string): number {
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : Date.now() - 30 * DAY_MS;
}

// ── Main ──────────────────────────────────────────────────────────────

function NewSinceViewImpl({ ctx }: NewSinceViewProps): ReactElement | null {
  ensureKeyframes();

  const now = useMemo(() => Date.now(), []);
  const [sincePreset, setSincePreset] = useState<Preset | null>(30);
  const [sinceDate, setSinceDate] = useState<number>(now - 30 * DAY_MS);

  const since = sincePreset !== null ? now - sincePreset * DAY_MS : sinceDate;

  const handlePreset = useCallback((p: Preset) => {
    setSincePreset(p);
    setSinceDate(now - p * DAY_MS);
  }, [now]);

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = fromDateInputValue(e.target.value);
    setSincePreset(null);
    setSinceDate(ms);
  }, []);

  const { highlighted, faint } = useMemo<{ highlighted: ScoredFile[]; faint: ScoredFile[] }>(() => {
    const hl: ScoredFile[] = [];
    const fa: ScoredFile[] = [];
    if (!ctx.tree) return { highlighted: hl, faint: fa };
    for (const e of ctx.tree.byId.values() as Iterable<Entity>) {
      if (e.kind !== "building") continue;
      const commits = commitHistory(e, 400);
      let count = 0;
      for (const c of commits) if (c >= since) count++;
      const item: ScoredFile = {
        id: e.id,
        name: e.name,
        path: e.path,
        recent: count,
        hasCommits: count > 0,
      };
      if (count > 0) hl.push(item);
      else fa.push(item);
    }
    hl.sort((a, b) => b.recent - a.recent || a.name.localeCompare(b.name));
    fa.sort((a, b) => a.name.localeCompare(b.name));
    return { highlighted: hl, faint: fa };
  }, [ctx.tree, since]);

  // ── Styles ──────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: tokenColor.bg1,
    fontFamily: font.sans,
    animation: `${KF_NAME2} ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: space[2],
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
  };

  const titleRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space[3],
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    lineHeight: 1.2,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
  };

  const controlsRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    flexWrap: "wrap",
  };

  const chipStyle = (active: boolean): CSSProperties => ({
    height: 24,
    padding: `0 ${space[2]}px`,
    borderRadius: radius.pill,
    border: `1px solid ${active ? tokenColor.accentBorder : tokenColor.border}`,
    backgroundColor: active ? tokenColor.accentSoft : tokenColor.bg1,
    color: active ? tokenColor.accent : tokenColor.text1,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    fontFamily: font.sans,
    cursor: "pointer",
    userSelect: "none",
    transition: `background-color ${transition.fast}, color ${transition.fast}, border-color ${transition.fast}`,
  });

  const dateInputStyle: CSSProperties = {
    height: 24,
    padding: `0 ${space[2]}px`,
    borderRadius: radius.sm,
    border: `1px solid ${tokenColor.border}`,
    backgroundColor: tokenColor.bg1,
    color: tokenColor.text0,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    outline: "none",
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: space[4],
    position: "relative",
  };

  const summaryStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    marginBottom: space[3],
    fontFamily: font.sans,
  };

  const highlightGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: space[2],
    position: "relative",
    zIndex: 1,
  };

  const faintGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 2,
    marginTop: space[6],
    opacity: 0.35,
    position: "relative",
    zIndex: 0,
  };

  const faintLabelStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: space[5],
    marginBottom: space[2],
    fontWeight: font.weight.semibold,
  };

  if (!ctx.tree) return null;

  return (
    <div style={rootStyle} role="region" aria-label="New since">
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={titleStyle}>Since</span>
            <span style={subtitleStyle}>이 시점 이후 바뀐 파일 · git log 필터 × 파일 트리</span>
          </div>
          <span style={{ ...subtitleStyle, fontFamily: font.mono }}>
            {toDateInputValue(since)}
          </span>
        </div>

        <div style={controlsRowStyle}>
          {([7, 30, 90, 365] as Preset[]).map(p => (
            <button
              key={p}
              type="button"
              style={chipStyle(sincePreset === p)}
              onClick={() => handlePreset(p)}
              aria-pressed={sincePreset === p}
            >
              {p === 365 ? "지난 1년" : `지난 ${p}일`}
            </button>
          ))}
          <input
            type="date"
            value={toDateInputValue(since)}
            onChange={handleDateChange}
            style={dateInputStyle}
            aria-label="Since date"
          />
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        <div style={summaryStyle}>
          <strong style={{ color: tokenColor.text0, fontWeight: font.weight.semibold }}>
            {highlighted.length}
          </strong>{" "}
          / {highlighted.length + faint.length} files touched since{" "}
          <span style={{ fontFamily: font.mono, color: tokenColor.text1 }}>
            {toDateInputValue(since)}
          </span>
        </div>

        {/* Highlighted cards */}
        <div style={highlightGridStyle}>
          {highlighted.map((f, i) => {
            const cardStyle: CSSProperties = {
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: `${space[2]}px ${space[3]}px`,
              borderRadius: radius.md,
              border: `1px solid ${tokenColor.border}`,
              backgroundColor: tokenColor.bg1,
              animation: `${KF_NAME} 360ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(i, 40) * 18}ms`,
            };
            const nameStyle: CSSProperties = {
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              color: tokenColor.text0,
              fontFamily: font.mono,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            };
            const pathStyle: CSSProperties = {
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            };
            const pillStyle: CSSProperties = {
              marginTop: 4,
              alignSelf: "flex-start",
              display: "inline-flex",
              padding: `2px ${space[2]}px`,
              borderRadius: radius.pill,
              backgroundColor: tokenColor.accentSoft,
              color: tokenColor.accent,
              fontSize: font.size.xxs,
              fontWeight: font.weight.semibold,
              fontFamily: font.sans,
            };
            return (
              <div key={f.id} style={cardStyle} title={f.path}>
                <span style={nameStyle}>{f.name}</span>
                <span style={pathStyle}>{f.path}</span>
                <span style={pillStyle}>+{f.recent} commits</span>
              </div>
            );
          })}
          {highlighted.length === 0 && (
            <div style={{ color: tokenColor.text2, fontSize: font.size.sm, gridColumn: "1 / -1" }}>
              이 기간에 바뀐 파일이 없습니다.
            </div>
          )}
        </div>

        {/* Faint background pattern */}
        {faint.length > 0 && (
          <>
            <div style={faintLabelStyle}>Older (background)</div>
            <div style={faintGridStyle}>
              {faint.map(f => {
                const faintCardStyle: CSSProperties = {
                  height: 20,
                  padding: "2px 6px",
                  borderRadius: radius.xs,
                  border: `1px dashed ${tokenColor.borderSoft}`,
                  backgroundColor: tokenColor.bg2,
                  color: tokenColor.text3,
                  fontFamily: font.mono,
                  fontSize: font.size.xxs,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                };
                return (
                  <div key={f.id} style={faintCardStyle} title={f.path}>
                    {f.name}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const NewSinceView = memo(NewSinceViewImpl);
