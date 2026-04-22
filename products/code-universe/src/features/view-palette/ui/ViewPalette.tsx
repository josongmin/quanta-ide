// ViewPalette — global ⌘⇧P modal for jumping between view modes.
// --------------------------------------------------------------------
// Sibling to `features/view-mode/ui/ViewModePicker` (sidebar picker).
// The picker is optimised for discovery (expanded groups, hover detail,
// context card). This palette is optimised for keyboard-first power
// users — one input, one flat result list, Enter to jump.
//
// Scope: VIEW MODES ONLY. Entity / file search lives in the separate
// `features/command-palette` feature (⌘K). We deliberately do NOT
// import from that feature — the two palettes are sibling slices.
// Shortcut split follows VS Code: ⌘K goto / ⌘⇧P commands.
//
// Wiring:
//   - Opens via `useViewPaletteShortcut()` (⌘⇧P / Ctrl+⇧P).
//   - Reads all 74 descriptors from the view-mode registry and filters
//     by context eligibility (repo / folder / file) + fuzzy token-AND
//     search over id / label / hint / tech / usecase.
//   - Commits via `switchMode(id, viewCtx)` from the registry — the
//     same path the sidebar picker uses, so activate/deactivate hooks
//     fire identically.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";
import {
  listViewDescriptors,
  switchMode,
  useViewContext,
} from "../../view-mode/model/view-registry";
import { useViewMode, type ViewMode } from "../../view-mode/model/store";
import { useRecentModes } from "../../view-mode/model/recent-modes";
import type {
  ViewCategory,
  ViewCtx,
  ViewDescriptor,
} from "../../view-mode/model/view-descriptor";
import { useEntityState } from "../../../entities/entity";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import { useViewPalette, viewPaletteStore } from "../model/store";

// ── Category palette — copied inline from ViewModePicker ──────────────
// Sibling feature, so we inline the 9-entry meta table rather than
// importing from the picker file. The user spec explicitly prefers
// inline copy for this (lives in sibling feature, keeps slice boundary
// clean, trivial upkeep cost).

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
  { id: "history",  label: "이력",       glyph: "◈", accent: "#7e4ed6" },
  { id: "plan",     label: "계획",       glyph: "◆", accent: "#22a06b" },
];

const CAT_BY_ID: Readonly<Record<ViewCategory, CatMeta>> =
  CATEGORY_ORDER.reduce(
    (acc, m) => { acc[m.id] = m; return acc; },
    {} as Record<ViewCategory, CatMeta>,
  );

// ── Eligibility helpers — mirror ViewModePicker ──────────────────────

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

// ── Inline keyframes — entrance + backdrop fade ───────────────────────
// Register once at module load. Using a style tag avoids touching the
// global a11y stylesheet and keeps the palette self-contained.

const STYLE_TAG_ID = "cu-view-palette-keyframes";
function ensureKeyframes(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_TAG_ID;
  el.textContent = `
@keyframes cu-vp-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes cu-vp-card-in {
  from { opacity: 0; transform: translate(-50%, calc(-50% + 2px)) scale(0.98); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .cu-vp-backdrop, .cu-vp-card { animation: none !important; }
}
`;
  document.head.appendChild(el);
}

// ── Component ─────────────────────────────────────────────────────────

export function ViewPalette(): ReactElement | null {
  const open    = useViewPalette(s => s.open);
  const query   = useViewPalette(s => s.query);
  const cursor  = useViewPalette(s => s.cursor);
  const mode    = useViewMode(s => s.mode);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId   = useEntityState(s => s.interaction.anchorId);
  const tree       = useEntityState(s => s.tree);
  const recentIds  = useRecentModes(s => s.ids);
  const viewCtx = useViewContext();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef(new Map<ViewMode, HTMLButtonElement>());

  useEffect(() => { ensureKeyframes(); }, []);

  // Focus the input on every open so the user can type immediately.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // ── Derivation: ctx + filter + flat ordered list ───────────────────
  // Same eligibility + fuzzy rules as ViewModePicker so both surfaces
  // agree on which modes are available at a given context.

  const contextId = anchorId ?? selectedId;
  const contextEntity = contextId ? tree?.byId.get(contextId) : undefined;
  const ctx: ViewCtx = inferCtx(contextEntity?.kind);

  const hasTree = tree !== null;
  const hasGraph = viewCtx.graph !== null;
  const hasSelection = selectedId !== null;

  // All descriptors — category-grouped, context-filtered, fuzzy-matched.
  const grouped = useMemo(() => {
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
      return [{ meta: cat, items }];
    });
  }, [ctx, query]);

  // Recents — shown only when query is empty. Mirrors picker MRU rules.
  const recents = useMemo(() => {
    if (query.trim()) return [] as Array<{ d: ViewDescriptor; meta: CatMeta }>;
    const out: Array<{ d: ViewDescriptor; meta: CatMeta }> = [];
    for (const id of recentIds) {
      const d = listViewDescriptors().find(x => x.id === id);
      if (!d) continue;
      if (!d.contexts.includes(ctx)) continue;
      const meta = CAT_BY_ID[d.category];
      if (!meta) continue;
      out.push({ d, meta });
      if (out.length >= 5) break;
    }
    return out;
  }, [query, recentIds, ctx]);

  // Flat list (recents then grouped) used by keyboard nav. Disabled
  // rows are included so the cursor stays visually aligned with the
  // rendered list — Enter on a disabled row becomes a no-op.
  interface FlatEntry { d: ViewDescriptor; meta: CatMeta; kind: "recent" | "group" }
  const flat = useMemo<FlatEntry[]>(() => {
    const out: FlatEntry[] = [];
    for (const r of recents) out.push({ d: r.d, meta: r.meta, kind: "recent" });
    for (const g of grouped) {
      for (const d of g.items) out.push({ d, meta: g.meta, kind: "group" });
    }
    return out;
  }, [recents, grouped]);

  // Clamp cursor when the list shrinks (e.g. user adds a token).
  useEffect(() => {
    if (!open) return;
    const s = viewPaletteStore.getState();
    if (s.cursor < 0) return;
    if (flat.length === 0) {
      if (s.cursor !== -1) viewPaletteStore.setCursor(-1);
      return;
    }
    if (s.cursor >= flat.length) viewPaletteStore.setCursor(flat.length - 1);
  }, [flat.length, open]);

  // Scroll focused row into view.
  useEffect(() => {
    if (!open) return;
    if (cursor < 0) return;
    const entry = flat[cursor];
    if (!entry) return;
    const el = rowRefs.current.get(entry.d.id);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cursor, flat, open]);

  // ── Commit path — mirror picker's `pick` helper ────────────────────
  const commit = useCallback((d: ViewDescriptor): void => {
    const { disabled } = isDisabled(d, hasTree, hasGraph, hasSelection);
    if (disabled) return;
    switchMode(d.id, viewCtx);
    viewPaletteStore.close();
  }, [hasTree, hasGraph, hasSelection, viewCtx]);

  const onInputKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min((cursor < 0 ? -1 : cursor) + 1, flat.length - 1);
        if (next >= 0) viewPaletteStore.setCursor(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max((cursor < 0 ? 0 : cursor) - 1, 0);
        viewPaletteStore.setCursor(next);
      } else if (e.key === "Home") {
        if (flat.length === 0) return;
        e.preventDefault();
        viewPaletteStore.setCursor(0);
      } else if (e.key === "End") {
        if (flat.length === 0) return;
        e.preventDefault();
        viewPaletteStore.setCursor(flat.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = cursor >= 0 ? flat[cursor] : flat[0];
        if (target) commit(target.d);
      }
      // Esc and ⌘⇧P are handled globally by useViewPaletteShortcut —
      // we don't re-handle them here so close/toggle semantics stay
      // in a single place.
    },
    [cursor, flat, commit],
  );

  if (!open) return null;

  // ── Counts + highlight tokens ───────────────────────────────────────

  const totalMatched = grouped.reduce((acc, g) => acc + g.items.length, 0);
  const highlightTokens = query.trim()
    ? query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    : [];

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="cu-vp-backdrop"
        style={BACKDROP}
        onMouseDown={() => viewPaletteStore.close()}
        aria-hidden
      />
      <div
        className="cu-vp-card"
        role="dialog"
        aria-modal="true"
        aria-label="시각화 모드 빠른 전환"
        style={CARD}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={HEADER}>
          <span style={HEADER_GLYPH} aria-hidden>⌕</span>
          <input
            ref={inputRef}
            data-view-palette-search=""
            type="text"
            placeholder="모드 검색 — 이름 · 힌트 · 기법"
            value={query}
            onChange={e => viewPaletteStore.setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            aria-label="시각화 모드 검색"
            style={INPUT}
          />
          <span style={COUNT} aria-live="polite">
            {query.trim()
              ? `${totalMatched}건`
              : `${listViewDescriptors().length}개 모드`}
          </span>
          <kbd style={KBD}>⌘⇧P</kbd>
        </div>

        <div style={SCROLL}>
          {flat.length === 0 && (
            <div style={EMPTY}>"{query}"에 해당하는 모드가 없습니다.</div>
          )}

          {recents.length > 0 && (
            <Section
              label="최근"
              glyph="↺"
              accent={color.text2}
              count={recents.length}
              first
            >
              {recents.map((r, idx) => {
                const globalIdx = idx;
                return (
                  <Row
                    key={`recent:${r.d.id}`}
                    d={r.d}
                    meta={r.meta}
                    active={mode === r.d.id}
                    focused={cursor === globalIdx}
                    disabled={isDisabled(r.d, hasTree, hasGraph, hasSelection)}
                    highlightTokens={highlightTokens}
                    onPick={commit}
                    registerRef={el => {
                      if (el) rowRefs.current.set(r.d.id, el);
                      else rowRefs.current.delete(r.d.id);
                    }}
                    onHoverIndex={() => viewPaletteStore.setCursor(globalIdx)}
                  />
                );
              })}
            </Section>
          )}

          {grouped.map((g, gi) => {
            // Offset into `flat` for this group's first item — lets
            // each row know its global cursor index without another
            // map.
            const before =
              recents.length +
              grouped.slice(0, gi).reduce((acc, x) => acc + x.items.length, 0);
            return (
              <Section
                key={g.meta.id}
                label={g.meta.label}
                glyph={g.meta.glyph}
                accent={g.meta.accent}
                count={g.items.length}
                first={gi === 0 && recents.length === 0}
              >
                {g.items.map((d, idx) => {
                  const globalIdx = before + idx;
                  return (
                    <Row
                      key={d.id}
                      d={d}
                      meta={g.meta}
                      active={mode === d.id}
                      focused={cursor === globalIdx}
                      disabled={isDisabled(d, hasTree, hasGraph, hasSelection)}
                      highlightTokens={highlightTokens}
                      onPick={commit}
                      registerRef={el => {
                        if (el) rowRefs.current.set(d.id, el);
                        else rowRefs.current.delete(d.id);
                      }}
                      onHoverIndex={() => viewPaletteStore.setCursor(globalIdx)}
                    />
                  );
                })}
              </Section>
            );
          })}
        </div>

        <div style={FOOTER} aria-hidden>
          <span style={FOOTER_GROUP}>
            <kbd style={KBD_SM}>↑↓</kbd>
            <span style={FOOTER_LABEL}>이동</span>
          </span>
          <span style={FOOTER_GROUP}>
            <kbd style={KBD_SM}>↵</kbd>
            <span style={FOOTER_LABEL}>선택</span>
          </span>
          <span style={FOOTER_GROUP}>
            <kbd style={KBD_SM}>/</kbd>
            <span style={FOOTER_LABEL}>검색 포커스</span>
          </span>
          <span style={FOOTER_GROUP}>
            <kbd style={KBD_SM}>Esc</kbd>
            <span style={FOOTER_LABEL}>닫기</span>
          </span>
        </div>
      </div>
    </>
  );
}

// ── Section + Row subcomponents ───────────────────────────────────────

function Section({
  label,
  glyph,
  accent,
  count,
  first,
  children,
}: {
  label: string;
  glyph: string;
  accent: string;
  count: number;
  first: boolean;
  children: ReactElement | readonly ReactElement[];
}): ReactElement {
  return (
    <div>
      <div style={{ ...CAT_HEADER, ...(first ? CAT_HEADER_FIRST : {}) }}>
        <span style={{ ...CAT_GLYPH, color: accent }}>{glyph}</span>
        <span style={{ ...CAT_LABEL, color: accent }}>{label}</span>
        <span style={{ ...CAT_LINE, background: `${accent}33` }} />
        <span style={CAT_COUNT}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function Row({
  d,
  meta,
  active,
  focused,
  disabled,
  highlightTokens,
  onPick,
  registerRef,
  onHoverIndex,
}: {
  d: ViewDescriptor;
  meta: CatMeta;
  active: boolean;
  focused: boolean;
  disabled: { disabled: boolean; reason?: string };
  highlightTokens: readonly string[];
  onPick: (d: ViewDescriptor) => void;
  registerRef: (el: HTMLButtonElement | null) => void;
  onHoverIndex: () => void;
}): ReactElement {
  const { disabled: isDis, reason } = disabled;
  return (
    <button
      ref={registerRef}
      type="button"
      role="option"
      aria-selected={focused}
      aria-label={`${d.label} — ${d.hint}`}
      disabled={isDis}
      onClick={() => onPick(d)}
      onMouseMove={onHoverIndex}
      style={{
        ...ROW_BASE,
        background: active
          ? color.selected
          : focused
            ? color.accentSofter
            : "transparent",
        opacity: isDis ? 0.45 : 1,
        cursor: isDis ? "not-allowed" : "pointer",
        borderLeft: focused && !active
          ? `2px solid ${color.accent}`
          : "2px solid transparent",
        paddingLeft: space[3] - 2,
      }}
    >
      <span
        aria-hidden
        style={{
          ...CAT_DOT,
          background: meta.accent,
          boxShadow: `0 0 0 3px ${meta.accent}22`,
        }}
      />
      <span style={{
        ...ROW_GLYPH,
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
          <span style={ROW_CAT_TAG}>{meta.label}</span>
          {isDis && reason ? <span style={ROW_DISABLED_TAG}>{reason}</span> : null}
        </div>
        <div style={ROW_HINT} title={d.hint}>
          {highlightText(d.hint, highlightTokens)}
        </div>
      </div>
      {active ? <span style={ACTIVE_DOT} aria-hidden /> : null}
    </button>
  );
}

// ── Highlight helper — shared pattern with ViewModePicker ─────────────
// Inlined so this feature slice does not import UI helpers from the
// sibling picker file.

function highlightText(source: string, tokens: readonly string[]): ReactElement | string {
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
  const out: Array<string | ReactElement> = [];
  let prev = 0;
  merged.forEach((s, i) => {
    if (s.start > prev) out.push(source.slice(prev, s.start));
    out.push(
      <mark key={i} style={HIGHLIGHT_MARK}>{source.slice(s.start, s.end)}</mark>,
    );
    prev = s.end;
  });
  if (prev < source.length) out.push(source.slice(prev));
  return <>{out}</>;
}

// ── Styles ────────────────────────────────────────────────────────────

const BACKDROP: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.35)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  zIndex: 1000,
  animation: "cu-vp-backdrop-in 160ms ease-out",
};

const CARD: CSSProperties = {
  position: "fixed",
  top: "38%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(560px, calc(100vw - 48px))",
  maxHeight: "min(520px, calc(100vh - 96px))",
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.lg,
  boxShadow: shadow.lg,
  overflow: "hidden",
  zIndex: 1001,
  fontFamily: font.sans,
  color: color.text0,
  animation: "cu-vp-card-in 200ms cubic-bezier(0.22, 1, 0.28, 1)",
};

const HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[3]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  flexShrink: 0,
  background: color.bg1,
};

const HEADER_GLYPH: CSSProperties = {
  width: 18,
  textAlign: "center",
  color: color.text3,
  fontSize: font.size.lg,
  flexShrink: 0,
};

const INPUT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: font.sans,
  fontSize: font.size.xl,
  color: color.text0,
  padding: 0,
  letterSpacing: font.letter.tight,
};

const COUNT: CSSProperties = {
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
  fontSize: font.size.xs,
  color: color.text2,
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const KBD: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `3px ${space[1] + 2}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.xs,
  fontFamily: font.mono,
  fontSize: 10,
  color: color.text2,
  lineHeight: 1,
  fontWeight: font.weight.semibold,
  flexShrink: 0,
  letterSpacing: 0.5,
};

const KBD_SM: CSSProperties = {
  ...KBD,
  padding: `2px ${space[1] + 1}px`,
  fontSize: 9,
  color: color.text3,
};

const SCROLL: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: `${space[1]}px 0 ${space[2]}px`,
};

const EMPTY: CSSProperties = {
  padding: `${space[5]}px ${space[4]}px`,
  textAlign: "center",
  color: color.text3,
  fontSize: font.size.sm,
  fontStyle: "italic",
};

const CAT_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[3]}px ${space[3]}px ${space[1]}px`,
};

const CAT_HEADER_FIRST: CSSProperties = { paddingTop: space[2] };

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
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
};

const CAT_LINE: CSSProperties = { flex: 1, height: 1 };

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
  padding: `${space[2]}px ${space[3]}px`,
  border: "none",
  textAlign: "left",
  width: "100%",
  boxSizing: "border-box",
  transition: `background ${transition.fast}`,
  fontFamily: font.sans,
  color: color.text0,
};

const CAT_DOT: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
  marginLeft: 2,
};

const ROW_GLYPH: CSSProperties = {
  width: 20,
  height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.sm,
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
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
  lineHeight: 1.2,
};

const ROW_CAT_TAG: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
  flexShrink: 0,
};

const ROW_DISABLED_TAG: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontStyle: "italic",
  fontWeight: font.weight.medium,
  flexShrink: 0,
};

const ROW_HINT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const ACTIVE_DOT: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: color.accent,
  flexShrink: 0,
};

const HIGHLIGHT_MARK: CSSProperties = {
  background: color.accentSoft,
  color: color.accentHover,
  padding: "0 1px",
  borderRadius: 2,
  fontWeight: font.weight.semibold,
};

const FOOTER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[1] + 1}px ${space[3]}px`,
  borderTop: `1px solid ${color.border}`,
  background: color.bg2,
  flexShrink: 0,
};

const FOOTER_GROUP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const FOOTER_LABEL: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  letterSpacing: font.letter.wide,
};
