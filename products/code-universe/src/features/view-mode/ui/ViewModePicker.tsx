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
  useMemo,
  type CSSProperties,
  type ReactElement,
} from "react";
import { useViewMode, type ViewMode } from "../model/store";
import {
  listViewDescriptors,
  switchMode,
  useViewContext,
} from "../model/view-registry";
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
  { id: "explore", label: "탐색",     glyph: "◎", accent: "#0d99ff" },
  { id: "deps",    label: "의존성",   glyph: "⬡", accent: "#e09321" },
  { id: "history", label: "이력",     glyph: "◈", accent: "#9e77ff" },
  { id: "plan",    label: "계획",     glyph: "◆", accent: "#22a06b" },
  { id: "arch",    label: "아키텍처", glyph: "⊟", accent: "#e5484d" },
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
  width: 380,
  maxHeight: 560,
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
  padding: `${space[2]}px ${space[3]}px 4px`,
};

const CAT_LABEL: CSSProperties = {
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
};

const CAT_LINE: CSSProperties = {
  flex: 1,
  height: 1,
  background: color.border,
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

  // Partition descriptors by category, filtered by context eligibility.
  const visCats = useMemo(() => {
    const byCat = new Map<ViewCategory, ViewDescriptor[]>();
    for (const d of listViewDescriptors()) {
      if (!d.contexts.includes(ctx)) continue;
      const bucket = byCat.get(d.category) ?? [];
      bucket.push(d);
      byCat.set(d.category, bucket);
    }
    // Return in canonical category order, skipping empty buckets. Within
    // a category the descriptors are already sorted by `order` because
    // listViewDescriptors() returns the canonical sorted list.
    return CATEGORY_ORDER.flatMap(cat => {
      const items = byCat.get(cat.id);
      if (!items || items.length === 0) return [];
      return [{ ...cat, items }];
    });
  }, [ctx]);

  const pick = (next: ViewMode): void => {
    // Delegate to the registry so activate/deactivate hooks fire. The
    // picker itself has no cross-view knowledge any more.
    switchMode(next, viewCtx);
  };

  const ctxPal = CTX_PALETTE[ctx];
  const totalModes = visCats.reduce((acc, c) => acc + c.items.length, 0);

  const ctxName = contextEntity?.name ?? "Workspace";
  const ctxPath = contextEntity?.path || "";

  return (
    <div style={OUTER} role="radiogroup" aria-label="시각화 모드 선택">
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

      <div style={SCROLL}>
        {visCats.map(cat => (
          <div key={cat.id}>
            <div style={CAT_HEADER}>
              <span style={CAT_LABEL}>{cat.id}</span>
              <span style={CAT_LINE} />
              <span style={CAT_COUNT}>{cat.items.length}</span>
            </div>

            {cat.items.map(d => {
              const active = mode === d.id;
              const { disabled, reason } = isDisabled(
                d, hasTree, hasGraph, hasSelection,
              );

              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${d.label} — ${d.hint}`}
                  title={d.tech}
                  disabled={disabled}
                  onClick={() => !disabled && pick(d.id)}
                  onMouseEnter={e => {
                    if (!active && !disabled) {
                      e.currentTarget.style.background = color.hover;
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = active ? color.selected : "transparent";
                  }}
                  style={{
                    ...ROW_BASE,
                    background: active ? color.selected : "transparent",
                    opacity: disabled ? 0.45 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
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
                        {d.label}
                      </span>
                      {disabled && reason ? (
                        <span style={ROW_DISABLED_TAG}>{reason}</span>
                      ) : null}
                    </div>
                    <div style={ROW_HINT} title={d.hint}>{d.hint}</div>
                  </div>

                  {active ? <span style={ACTIVE_DOT} aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
