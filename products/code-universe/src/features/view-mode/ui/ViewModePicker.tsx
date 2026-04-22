// ViewModePicker — registry-backed mode selector.
// --------------------------------------------------------------------
// Layout: vertical scrollable panel
//   header  — current context (레포/폴더/파일)
//   groups  — 탐색 / 의존성 / 이력 / 계획 / 아키텍처 (always expanded)
//   leaf    — label + hint + tech + usecase
//
// Every row — label, glyph, category, eligibility, tooltip, disabled
// state — comes from the view descriptor registry. This file owns only
// the visual styling and the "what context am I in right now" logic.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useViewMode, type ViewMode } from "../model/store";
import {
  listViewDescriptors,
  switchMode,
  useViewContext,
} from "../model/view-registry";
import { useRecentModes } from "../model/recent-modes";
import type { ViewCategory, ViewCtx, ViewDescriptor } from "../model/view-descriptor";
import { useEntityState } from "../../../entities/entity";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";

// ── Category palette — keyed by descriptor.category ───────────────────
// The picker groups by category. Display order + labels + glyphs live
// here (visual chrome); membership is inferred from each descriptor.

interface CatMeta {
  id: ViewCategory;
  label: string;
  glyph: string;
  accent: string;
}

const CATEGORY_ORDER: readonly CatMeta[] = [
  { id: "explore",  label: "탐색",       glyph: "◎", accent: "#0d99ff" },
  { id: "deps",     label: "의존성",     glyph: "⬡", accent: "#e09321" },
  { id: "metrics",  label: "지표",       glyph: "◐", accent: "#2563eb" },
  { id: "quality",  label: "품질게이트", glyph: "✓", accent: "#22a06b" },
  { id: "refactor", label: "리팩터",     glyph: "✂", accent: "#f76b15" },
  { id: "arch",     label: "아키텍처",   glyph: "⊟", accent: "#e5484d" },
  { id: "security", label: "보안",       glyph: "⚠", accent: "#d97706" },
  { id: "team",     label: "팀·오너십",   glyph: "⚐", accent: "#9e77ff" },
  { id: "ai",       label: "AI 효율",     glyph: "✦", accent: "#7e4ed6" },
  { id: "history",  label: "이력",       glyph: "◈", accent: "#7e4ed6" },
  { id: "plan",     label: "계획",       glyph: "◆", accent: "#22a06b" },
];

// ── Context palette — keyed by the current selection's entity kind ────

interface CtxPalette { glyph: string; ko: string; en: string }

const CTX_PALETTE: Readonly<Record<ViewCtx, CtxPalette>> = {
  repo:   { glyph: "◎", ko: "레포",  en: "WORKSPACE" },
  folder: { glyph: "⊞", ko: "폴더",  en: "FOLDER"    },
  file:   { glyph: "⊟", ko: "파일",  en: "FILE"      },
};

// ── Styles ────────────────────────────────────────────────────────────

const OUTER: CSSProperties = {
  width: 420,
  maxHeight: 680,
  display: "flex",
  flexDirection: "column",
  fontFamily: font.sans,
  fontSize: font.size.sm,
  color: color.text0,
  background: color.bg1,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.md,
  boxShadow: shadow.md,
  overflow: "hidden",
};

const SEARCH_WRAP: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  flexShrink: 0,
  background: color.bg1,
};

const SEARCH_GLYPH: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text3,
  flexShrink: 0,
  width: 16,
  textAlign: "center",
};

const SEARCH_INPUT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: font.sans,
  fontSize: font.size.sm,
  color: color.text0,
  padding: 0,
};

const SEARCH_CLEAR: CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: color.bg3,
  color: color.text2,
  borderRadius: "50%",
  cursor: "pointer",
  fontSize: 10,
  fontFamily: font.mono,
  flexShrink: 0,
  padding: 0,
  transition: `background ${transition.fast}`,
};

const EMPTY_STATE: CSSProperties = {
  padding: `${space[5]}px ${space[4]}px`,
  textAlign: "center",
  color: color.text3,
  fontSize: font.size.xs,
  fontStyle: "italic",
};

const KBD: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: `2px ${space[1] + 2}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.xs,
  fontFamily: font.mono,
  fontSize: 10,
  color: color.text3,
  lineHeight: 1,
  fontWeight: font.weight.medium,
  flexShrink: 0,
  letterSpacing: 0.5,
};

const HIGHLIGHT_MARK: CSSProperties = {
  background: color.accentSoft,
  color: color.accentHover,
  padding: "0 1px",
  borderRadius: 2,
  fontWeight: font.weight.semibold,
};

const CTX_CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: `${space[2]}px ${space[3]}px`,
  flexShrink: 0,
  borderBottom: `1px solid ${color.border}`,
};

const CTX_TOP_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const CTX_GLYPH: CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.sm,
  background: color.bg3,
  color: color.text2,
  fontFamily: font.mono,
  fontSize: font.size.xs,
  flexShrink: 0,
};

const CTX_NAME: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const CTX_KIND: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
  flexShrink: 0,
};

const CTX_META: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  fontSize: font.size.xs,
  color: color.text2,
};

const CTX_PATH: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: -0.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const CTX_COUNT: CSSProperties = {
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
  color: color.text1,
  fontWeight: font.weight.medium,
  flexShrink: 0,
};

const SCROLL: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: `${space[1]}px 0 ${space[2]}px`,
};

const CAT_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[3]}px ${space[3]}px ${space[1]}px`,
};

const CAT_HEADER_FIRST: CSSProperties = {
  // Tighter top padding on the first category — avoids a double gap
  // after the context card above.
  paddingTop: space[2],
};

const CAT_GLYPH: CSSProperties = {
  width: 16,
  height: 16,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: font.mono,
  fontSize: font.size.xs,
  flexShrink: 0,
};

const CAT_LABEL: CSSProperties = {
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  color: color.text1,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
};

const CAT_LINE: CSSProperties = {
  flex: 1,
  height: 1,
};

const CAT_COUNT: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
};

const ROW_BASE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1] + 1}px ${space[3]}px`,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  boxSizing: "border-box",
  transition: `background ${transition.fast}`,
  fontFamily: font.sans,
  color: color.text0,
};

const ROW_GLYPH: CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.sm,
  background: color.bg3,
  color: color.text2,
  fontFamily: font.mono,
  fontSize: font.size.xs,
  flexShrink: 0,
  transition: `background ${transition.fast}, color ${transition.fast}`,
};

const ROW_CONTENT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 1,
};

const ROW_LINE1: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
  minWidth: 0,
};

const ROW_LABEL: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.2,
};

const ROW_HINT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// ── Expandable detail drawer ──────────────────────────────────────────
// Tech + usecase render only on hover or on the active row. We animate
// via grid-template-rows 0fr → 1fr (modern collapse trick that needs no
// measured height) and a 200 ms ease. The inner wrapper handles overflow
// so the drawer stays clipped during the transition.

const ROW_DETAIL_WRAP: CSSProperties = {
  display: "grid",
  gridTemplateRows: "0fr",
  transition: `grid-template-rows 200ms cubic-bezier(0.22, 1, 0.28, 1), opacity 160ms ease-out`,
  opacity: 0,
  marginTop: 0,
};

const ROW_DETAIL_WRAP_OPEN: CSSProperties = {
  gridTemplateRows: "1fr",
  opacity: 1,
  marginTop: 6,
};

const ROW_DETAIL_INNER: CSSProperties = {
  overflow: "hidden",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const ROW_TECH: CSSProperties = {
  display: "inline-flex",
  alignSelf: "flex-start",
  padding: `2px ${space[2]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontFamily: font.mono,
  fontSize: 10,
  color: color.text1,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const ROW_USECASE: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  lineHeight: 1.5,
  whiteSpace: "normal",
};

const ROW_DISABLED_TAG: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontStyle: "italic",
  fontFamily: font.sans,
  fontWeight: font.weight.medium,
  flexShrink: 0,
};

const ACTIVE_DOT: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: color.accent,
  flexShrink: 0,
};

// ── Eligibility helpers ───────────────────────────────────────────────

/** Derive the ctx tier (repo / folder / file) from the anchored entity's
 *  kind. Matches the pre-registry mapping. */
function inferCtx(kind: string | undefined): ViewCtx {
  if (kind === "building" || kind === "floor" || kind === "room") return "file";
  if (kind === "street") return "folder";
  return "repo";
}

function isDisabled(
  d: ViewDescriptor,
  hasTree: boolean,
  hasGraph: boolean,
  hasSelection: boolean,
): { disabled: boolean; reason?: string } {
  const need = d.needs ?? {};
  if (need.tree && !hasTree) return { disabled: true, reason: "로딩중" };
  if (need.graph && !hasGraph) return { disabled: true, reason: "로딩중" };
  if (need.selection && !hasSelection) return { disabled: true, reason: "선택 필요" };
  return { disabled: false };
}

// ── Component ─────────────────────────────────────────────────────────

export function ViewModePicker(): ReactElement {
  const mode       = useViewMode(s => s.mode);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId   = useEntityState(s => s.interaction.anchorId);
  const tree       = useEntityState(s => s.tree);
  const recentIds  = useRecentModes(s => s.ids);
  const [hoveredId, setHoveredId] = useState<ViewMode | null>(null);
  const [query, setQuery] = useState("");
  // Keyboard cursor into the flat visible list — drives ↑/↓ navigation
  // and Enter commit. Starts -1 so the first ↓ jumps to index 0.
  const [keyboardIdx, setKeyboardIdx] = useState(-1);
  const rowRefs = useRef(new Map<ViewMode, HTMLButtonElement>());

  // The live ViewContextValue is published by CanvasShell; we use it
  // as the single call surface for `switchMode`. Picker never mutates
  // stores directly any more — side-effects like opening/closing the
  // mind-map overlay flow through each descriptor's activate/deactivate.
  const viewCtx = useViewContext();

  const contextId   = anchorId ?? selectedId;
  const contextEntity = contextId ? tree?.byId.get(contextId) : undefined;
  const ctx: ViewCtx = inferCtx(contextEntity?.kind);

  const hasTree = tree !== null;
  const hasGraph = viewCtx.graph !== null;
  const hasSelection = selectedId !== null;

  // Partition descriptors by category, filtered by context eligibility +
  // optional free-text query (matches against id / label / hint / tech /
  // usecase — case-insensitive, token-AND).
  const visCats = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    const matches = (d: ViewDescriptor): boolean => {
      if (tokens.length === 0) return true;
      const hay = [d.id, d.label, d.hint, d.tech, d.usecase].join(" ").toLowerCase();
      return tokens.every(t => hay.includes(t));
    };

    const byCat = new Map<ViewCategory, ViewDescriptor[]>();
    for (const d of listViewDescriptors()) {
      if (!d.contexts.includes(ctx)) continue;
      if (!matches(d)) continue;
      const bucket = byCat.get(d.category) ?? [];
      bucket.push(d);
      byCat.set(d.category, bucket);
    }
    return CATEGORY_ORDER.flatMap(cat => {
      const items = byCat.get(cat.id);
      if (!items || items.length === 0) return [];
      return [{ ...cat, items }];
    });
  }, [ctx, query]);

  // Recent modes — only shown when no search query. Filtered by context
  // eligibility (a recent mode may not apply to the current ctx, e.g.
  // a file-scoped view after anchoring on a repo) and by availability.
  const recentSection = useMemo(() => {
    if (query.trim()) return null;
    const out: Array<{ d: ViewDescriptor; meta: CatMeta }> = [];
    for (const id of recentIds) {
      const d = listViewDescriptors().find(x => x.id === id);
      if (!d) continue;
      if (!d.contexts.includes(ctx)) continue;
      const meta = CATEGORY_ORDER.find(c => c.id === d.category);
      if (!meta) continue;
      out.push({ d, meta });
      if (out.length >= 5) break;
    }
    return out.length > 0 ? out : null;
  }, [query, recentIds, ctx]);

  // Flat visible list — used by keyboard nav so ↑/↓ span both recent +
  // category sections. Non-disabled rows only.
  const flatItems = useMemo(() => {
    const list: ViewDescriptor[] = [];
    if (recentSection) for (const r of recentSection) list.push(r.d);
    for (const cat of visCats) for (const d of cat.items) list.push(d);
    return list.filter(d => !isDisabled(d, hasTree, hasGraph, hasSelection).disabled);
  }, [recentSection, visCats, hasTree, hasGraph, hasSelection]);

  // Reset / clamp the keyboard cursor whenever the visible set changes.
  useEffect(() => {
    setKeyboardIdx(idx => {
      if (idx < 0) return -1;
      if (idx >= flatItems.length) return flatItems.length - 1;
      return idx;
    });
  }, [flatItems.length]);

  // Scroll the focused keyboard row into view when it changes.
  useEffect(() => {
    if (keyboardIdx < 0) return;
    const d = flatItems[keyboardIdx];
    if (!d) return;
    const el = rowRefs.current.get(d.id);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [keyboardIdx, flatItems]);

  const pick = useCallback((next: ViewMode): void => {
    // Delegate to the registry so activate/deactivate hooks fire. The
    // picker itself has no cross-view knowledge any more.
    switchMode(next, viewCtx);
  }, [viewCtx]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKeyboardIdx(idx => Math.min(idx + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKeyboardIdx(idx => Math.max(idx - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setKeyboardIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setKeyboardIdx(flatItems.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = keyboardIdx >= 0 ? flatItems[keyboardIdx] : flatItems[0];
      if (target) pick(target.id);
    } else if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        setQuery("");
        setKeyboardIdx(-1);
      }
    }
  }, [flatItems, keyboardIdx, pick, query]);

  const ctxPal = CTX_PALETTE[ctx];
  const totalModes = visCats.reduce((acc, c) => acc + c.items.length, 0);

  const ctxName = contextEntity?.name ?? "Workspace";
  const ctxPath = contextEntity?.path || "";

  // Tokens for highlight — computed once per query change.
  const highlightTokens = query.trim()
    ? query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    : [];

  const renderRow = (d: ViewDescriptor, cursor: number): ReactElement => {
    const active = mode === d.id;
    const { disabled, reason } = isDisabled(d, hasTree, hasGraph, hasSelection);
    const hovered = hoveredId === d.id;
    const focused = cursor >= 0 && flatItems[cursor]?.id === d.id;
    const expanded = !disabled && (active || hovered || focused);
    return (
      <button
        key={d.id}
        ref={el => {
          if (el) rowRefs.current.set(d.id, el);
          else rowRefs.current.delete(d.id);
        }}
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={`${d.label} — ${d.hint}`}
        disabled={disabled}
        onClick={() => !disabled && pick(d.id)}
        onMouseEnter={e => {
          setHoveredId(d.id);
          if (!active && !disabled && !focused) {
            e.currentTarget.style.background = color.hover;
          }
        }}
        onMouseLeave={e => {
          setHoveredId(cur => (cur === d.id ? null : cur));
          e.currentTarget.style.background = active
            ? color.selected
            : focused
              ? color.accentSofter
              : "transparent";
        }}
        style={{
          ...ROW_BASE,
          alignItems: "flex-start",
          padding: `${space[2]}px ${space[3]}px`,
          background: active
            ? color.selected
            : focused
              ? color.accentSofter
              : "transparent",
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          borderLeft: focused && !active
            ? `2px solid ${color.accent}`
            : "2px solid transparent",
          paddingLeft: space[3] - 2, // compensate for border so text doesn't jump
        }}
      >
        <span style={{
          ...ROW_GLYPH,
          marginTop: 2,
          background: active ? color.accentSoft : color.bg3,
          color: active ? color.accent : color.text2,
        }}>
          {d.glyph}
        </span>

        <div style={ROW_CONTENT}>
          <div style={ROW_LINE1}>
            <span style={{
              ...ROW_LABEL,
              color: active ? color.accent : color.text0,
            }}>
              {highlightText(d.label, highlightTokens)}
            </span>
            {disabled && reason ? (
              <span style={ROW_DISABLED_TAG}>{reason}</span>
            ) : null}
          </div>
          <div style={ROW_HINT} title={d.hint}>
            {highlightText(d.hint, highlightTokens)}
          </div>
          <div style={{
            ...ROW_DETAIL_WRAP,
            ...(expanded ? ROW_DETAIL_WRAP_OPEN : {}),
          }}>
            <div style={ROW_DETAIL_INNER}>
              <span style={ROW_TECH} title={d.tech}>
                {highlightText(d.tech, highlightTokens)}
              </span>
              <span style={ROW_USECASE}>
                {highlightText(d.usecase, highlightTokens)}
              </span>
            </div>
          </div>
        </div>

        {active ? <span style={{ ...ACTIVE_DOT, marginTop: 8 }} aria-hidden /> : null}
      </button>
    );
  };

  return (
    <div
      style={OUTER}
      role="radiogroup"
      aria-label="시각화 모드 선택"
      onKeyDown={handleKeyDown}
    >
      <div style={CTX_CARD}>
        <div style={CTX_TOP_ROW}>
          <span style={CTX_GLYPH}>{ctxPal.glyph}</span>
          <span style={CTX_NAME} title={ctxName}>{ctxName}</span>
          <span style={CTX_KIND}>{ctxPal.en}</span>
        </div>
        <div style={CTX_META}>
          <span style={CTX_PATH} title={ctxPath || undefined}>
            {ctxPath || "workspace root"}
          </span>
          <span style={CTX_COUNT}>{totalModes}</span>
        </div>
      </div>

      <div style={SEARCH_WRAP}>
        <span style={SEARCH_GLYPH} aria-hidden>⌕</span>
        <input
          style={SEARCH_INPUT}
          type="text"
          placeholder="모드 검색 — ↑↓로 이동 · Enter로 선택"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            // Any typing resets the cursor to the first match.
            setKeyboardIdx(e.target.value ? 0 : -1);
          }}
          aria-label="시각화 모드 검색"
        />
        <kbd style={KBD}>↑↓</kbd>
        {query && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => { setQuery(""); setKeyboardIdx(-1); }}
            style={SEARCH_CLEAR}
            onMouseEnter={e => { e.currentTarget.style.background = color.borderStrong; }}
            onMouseLeave={e => { e.currentTarget.style.background = color.bg3; }}
          >
            ×
          </button>
        )}
      </div>

      <div style={SCROLL}>
        {visCats.length === 0 && !recentSection && (
          <div style={EMPTY_STATE}>
            "{query}"에 해당하는 모드가 없습니다.
          </div>
        )}

        {/* Recent / MRU — query-free only, per-ctx filtered, max 5. */}
        {recentSection && (
          <div>
            <div style={{ ...CAT_HEADER, ...CAT_HEADER_FIRST }}>
              <span style={{ ...CAT_GLYPH, color: color.text2 }}>↺</span>
              <span style={{ ...CAT_LABEL, color: color.text2 }}>최근</span>
              <span style={{ ...CAT_LINE, background: color.border }} />
              <span style={CAT_COUNT}>{recentSection.length}</span>
            </div>
            {recentSection.map(({ d }) => renderRow(d, keyboardIdx))}
          </div>
        )}

        {visCats.map((cat, ci) => (
          <div key={cat.id}>
            <div style={{
              ...CAT_HEADER,
              ...(ci === 0 && !recentSection ? CAT_HEADER_FIRST : {}),
            }}>
              <span style={{ ...CAT_GLYPH, color: cat.accent }}>{cat.glyph}</span>
              <span style={{ ...CAT_LABEL, color: cat.accent }}>{cat.label}</span>
              <span style={{ ...CAT_LINE, background: `${cat.accent}33` }} />
              <span style={CAT_COUNT}>{cat.items.length}</span>
            </div>
            {cat.items.map(d => renderRow(d, keyboardIdx))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Highlight helper — token-aware mark wrap ──────────────────────────
// Splits a string around the given lowercase tokens (in order of first
// occurrence) and wraps every token hit in a <mark> with the accent
// tint. Preserves original casing. Empty-token array returns the raw
// string untouched (React happily renders a plain string).

function highlightText(source: string, tokens: readonly string[]): ReactNode {
  if (tokens.length === 0) return source;
  const lower = source.toLowerCase();
  interface Span { start: number; end: number }
  const spans: Span[] = [];
  for (const tk of tokens) {
    if (tk.length === 0) continue;
    let cursor = 0;
    while (true) {
      const idx = lower.indexOf(tk, cursor);
      if (idx === -1) break;
      spans.push({ start: idx, end: idx + tk.length });
      cursor = idx + tk.length;
    }
  }
  if (spans.length === 0) return source;
  // Merge overlapping spans.
  spans.sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  const out: ReactNode[] = [];
  let prev = 0;
  merged.forEach((s, i) => {
    if (s.start > prev) out.push(source.slice(prev, s.start));
    out.push(
      <mark key={i} style={HIGHLIGHT_MARK}>{source.slice(s.start, s.end)}</mark>,
    );
    prev = s.end;
  });
  if (prev < source.length) out.push(source.slice(prev));
  return out;
}
