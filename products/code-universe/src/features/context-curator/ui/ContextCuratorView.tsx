// ContextCuratorView — user-controlled context window management.
// --------------------------------------------------------------------
// Three columns:
//   left   — file list with pin / exclude / auto cycle per row
//   middle — live "current context" preview: token meter + included files
//   right  — saved context slices (click to preview / load)
// Top strip hosts the token-budget bar (threshold warning at 80%).
//
// Reference:
//   - Anthropic "Creating effective Claude Projects" (2024) — Projects
//     context curation UI with attached files + instructions.
//   - Cursor Codebase Index & @file mentions — user-scoped inclusion.
//   - Continue.dev context providers — explicit add/remove toolbar.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  fileTokens,
  synthContextSlices,
  type ContextSlice,
} from "../../../shared/analytics/synth-metrics";

type FileStatus = "pin" | "exclude" | "auto";

const TOKEN_BUDGET = 200_000;
const WARN_AT = 0.8;

const KEYFRAMES = `
@keyframes ccEnter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes ccRow   { 0% { opacity: 0; transform: translateX(-4px); } 100% { opacity: 1; transform: translateX(0); } }
@keyframes ccBar   { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
`;

interface Props {
  ctx: ViewContextValue;
}

function ContextCuratorViewImpl({ ctx }: Props): ReactElement | null {
  const [status, setStatus] = useState<Record<string, FileStatus>>({});
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const files = useMemo<Entity[]>(() => {
    if (!ctx.tree) return [];
    return [...ctx.tree.byId.values()]
      .filter(e => e.kind === "building")
      .sort((a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0));
  }, [ctx.tree]);

  const slices = useMemo<ContextSlice[]>(
    () => synthContextSlices(ctx.tree),
    [ctx.tree],
  );

  const pinnedFiles = useMemo(
    () => files.filter(f => status[f.id] === "pin"),
    [files, status],
  );
  const pinnedTokens = useMemo(
    () => pinnedFiles.reduce((sum, f) => sum + fileTokens(f), 0),
    [pinnedFiles],
  );

  const budgetPct = Math.min(1, pinnedTokens / TOKEN_BUDGET);
  const over80 = budgetPct >= WARN_AT;

  const cycleStatus = (id: string) => {
    setStatus(prev => {
      const cur = prev[id] ?? "auto";
      const next: FileStatus =
        cur === "auto" ? "pin" : cur === "pin" ? "exclude" : "auto";
      return { ...prev, [id]: next };
    });
  };

  const loadSlice = (slice: ContextSlice) => {
    setSelectedSliceId(slice.id);
    setStatus(prev => {
      const next: Record<string, FileStatus> = { ...prev };
      // Clear existing pins, apply slice's file ids as pinned.
      for (const k of Object.keys(next)) {
        if (next[k] === "pin") next[k] = "auto";
      }
      for (const id of slice.fileIds) next[id] = "pin";
      return next;
    });
  };

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      {/* Header + budget bar */}
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Context Curator</div>
          <div style={subtitleStyle}>
            수동 pin / exclude — Claude Projects · Cursor Codebase Index · Continue.dev
          </div>
        </div>
        <div style={budgetColumnStyle}>
          <div style={budgetLabelRowStyle}>
            <span style={{ color: color.text2 }}>Token budget</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: color.text0, fontWeight: font.weight.semibold }}>
              {formatTokens(pinnedTokens)} / {formatTokens(TOKEN_BUDGET)}
            </span>
          </div>
          <div style={budgetTrackStyle}>
            <div
              style={{
                ...budgetFillStyle,
                width: `${budgetPct * 100}%`,
                background: over80 ? color.danger : color.accent,
              }}
            />
          </div>
          {over80 && (
            <div style={warnTextStyle}>경고: 예산의 80% 초과</div>
          )}
        </div>
      </header>

      <div style={bodyStyle}>
        {/* Left — file tree */}
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>Files</span>
            <span style={countPillStyle}>{files.length}</span>
          </div>
          <div style={panelBodyStyle}>
            {files.map((f, i) => {
              const st = status[f.id] ?? "auto";
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => cycleStatus(f.id)}
                  title={`${f.path} · ${formatTokens(fileTokens(f))} tok`}
                  style={{
                    ...fileRowStyle,
                    animationDelay: `${Math.min(i * 14, 800)}ms`,
                  }}
                >
                  <span style={badgeForStatus(st)}>{labelForStatus(st)}</span>
                  <span style={fileNameStyle}>{f.name}</span>
                  <span style={fileTokenStyle}>{formatTokens(fileTokens(f))}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Middle — current context preview */}
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>Current context</span>
            <span style={countPillStyle}>{pinnedFiles.length}</span>
          </div>
          <div style={panelBodyStyle}>
            {pinnedFiles.length === 0 ? (
              <div style={emptyInlineStyle}>
                파일을 핀 고정하면 여기에 표시됩니다.
              </div>
            ) : (
              pinnedFiles.map((f, i) => (
                <div
                  key={f.id}
                  style={{
                    ...includedRowStyle,
                    animationDelay: `${Math.min(i * 16, 600)}ms`,
                  }}
                >
                  <span style={pinDotStyle} />
                  <span style={fileNameStyle}>{f.name}</span>
                  <span style={fileTokenStyle}>{formatTokens(fileTokens(f))}</span>
                </div>
              ))
            )}
          </div>
          <div style={footerStatsStyle}>
            <div>
              <div style={footerLabelStyle}>Used</div>
              <div style={footerValueStyle}>{formatTokens(pinnedTokens)}</div>
            </div>
            <div>
              <div style={footerLabelStyle}>Remaining</div>
              <div style={footerValueStyle}>
                {formatTokens(Math.max(0, TOKEN_BUDGET - pinnedTokens))}
              </div>
            </div>
          </div>
        </section>

        {/* Right — saved slices */}
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>Saved slices</span>
            <span style={countPillStyle}>{slices.length}</span>
          </div>
          <div style={panelBodyStyle}>
            {slices.map((s, i) => {
              const active = selectedSliceId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => loadSlice(s)}
                  style={{
                    ...sliceCardStyle,
                    borderColor: active ? color.accent : color.border,
                    animationDelay: `${Math.min(i * 22, 500)}ms`,
                  }}
                >
                  <div style={sliceHeaderStyle}>
                    <span style={sliceNameStyle}>{s.name}</span>
                    <span style={sliceChipStyle}>{relTime(s.lastUsedAt)}</span>
                  </div>
                  <div style={sliceDescStyle}>{s.description}</div>
                  <div style={sliceMetaStyle}>
                    <span>{s.fileIds.length} files</span>
                    <span>·</span>
                    <span>{formatTokens(s.tokens)} tok</span>
                    <span>·</span>
                    <span>{s.usageCount}× used</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function labelForStatus(s: FileStatus): string {
  return s === "pin" ? "PIN" : s === "exclude" ? "EXC" : "AUTO";
}

function badgeForStatus(s: FileStatus): CSSProperties {
  const base: CSSProperties = {
    display: "inline-block",
    width: 34,
    textAlign: "center",
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    padding: `2px 0`,
    borderRadius: radius.sm,
    fontFamily: font.mono,
    letterSpacing: font.letter.wide,
  };
  if (s === "pin")
    return { ...base, background: "rgba(13,153,255,0.12)", color: color.accent, border: `1px solid ${color.accentBorder}` };
  if (s === "exclude")
    return { ...base, background: "rgba(229,72,77,0.12)", color: color.danger, border: `1px solid rgba(229,72,77,0.32)` };
  return { ...base, background: color.bg3, color: color.text2, border: `1px solid ${color.border}` };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
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
  animation: "ccEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: space[6],
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

const budgetColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[1],
  minWidth: 280,
};

const budgetLabelRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: font.size.xs,
};

const budgetTrackStyle: CSSProperties = {
  height: 8,
  borderRadius: radius.pill,
  background: color.bg3,
  overflow: "hidden",
};

const budgetFillStyle: CSSProperties = {
  height: "100%",
  transformOrigin: "left center",
  transition: "width 560ms cubic-bezier(0.22, 1, 0.28, 1), background 180ms ease-out",
  animation: "ccBar 560ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const warnTextStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.danger,
  marginTop: 2,
  fontWeight: font.weight.semibold,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: space[4],
};

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[2]}px ${space[3]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
  background: color.bg0,
  borderBottom: `1px solid ${color.border}`,
};

const countPillStyle: CSSProperties = {
  fontSize: font.size.xxs,
  background: color.bg3,
  color: color.text2,
  padding: "1px 6px",
  borderRadius: radius.pill,
  fontVariantNumeric: "tabular-nums",
};

const panelBodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: space[2],
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const fileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: font.sans,
  animation: "ccRow 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: "background 120ms ease-out",
};

const fileNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: font.size.xs,
  color: color.text0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const fileTokenStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const includedRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: "ccRow 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const pinDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: color.accent,
};

const emptyInlineStyle: CSSProperties = {
  color: color.text3,
  fontSize: font.size.xs,
  textAlign: "center",
  padding: space[6],
};

const footerStatsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: space[3],
  padding: `${space[3]}px`,
  borderTop: `1px solid ${color.border}`,
  background: color.bg0,
};

const footerLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.wide,
};

const footerValueStyle: CSSProperties = {
  fontSize: font.size.lg,
  fontWeight: font.weight.bold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
  marginTop: 2,
};

const sliceCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: space[3],
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: font.sans,
  animation: "ccRow 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: "border-color 180ms ease-out",
};

const sliceHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[2],
};

const sliceNameStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
};

const sliceChipStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  background: color.bg3,
  borderRadius: radius.pill,
  padding: "1px 6px",
};

const sliceDescStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  lineHeight: 1.4,
};

const sliceMetaStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
  marginTop: 2,
};

export const ContextCuratorView = memo(ContextCuratorViewImpl);
