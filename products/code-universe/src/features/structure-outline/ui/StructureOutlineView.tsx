// StructureOutlineView — nested in-file symbol tree.
// --------------------------------------------------------------------
// References:
//   - JetBrains IntelliJ IDEA "Structure" tool window — hierarchical
//     per-file symbol browser with class → method nesting.
//   - Visual Studio Code "Outline" view — DocumentSymbol tree from LSP.
//   - LSP DocumentSymbol spec — textDocument/documentSymbol hierarchical
//     symbol response.
// Applied here: click a class/interface row to expand (chevron rotates
// 0→90°) and reveal its methods / fields. Leaf rows carry visibility
// pills and a mini-LoC tag so you can spot the fat methods at a glance.

import { memo, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  structureOutline,
  type StructureNode,
  type SymbolKind,
  type SymbolVisibility,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";

const KEYFRAMES = `
@keyframes so-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes so-row   { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
`;

const KIND_GLYPH: Record<SymbolKind, string> = {
  class:     "◼",
  interface: "◇",
  function:  "ƒ",
  method:    "⋄",
  variable:  "x",
};

const KIND_HUE: Record<SymbolKind, string> = {
  class:     "#3d3d3d",
  interface: "#7e4ed6",
  function:  "#0d99ff",
  method:    "#22a06b",
  variable:  "#e09321",
};

const VIS_STYLE: Record<SymbolVisibility, { bg: string; fg: string; label: string }> = {
  public:   { bg: "#d1fae5", fg: "#065f46", label: "public"   },
  internal: { bg: "#e0e7ff", fg: "#3730a3", label: "internal" },
  private:  { bg: "#fee2e2", fg: "#991b1b", label: "private"  },
};

function isExpandable(node: StructureNode): boolean {
  return (node.kind === "class" || node.kind === "interface") && node.children.length > 0;
}

function StructureOutlineViewImpl({ ctx, entity, empty }: Props): ReactElement {
  const rows: StructureNode[] = useMemo(
    () => (entity ? structureOutline(entity) : []),
    [entity],
  );

  // All expandable roots default open — aligns with IntelliJ defaults.
  const defaultOpen = useMemo(() => {
    const s = new Set<string>();
    for (const n of rows) if (isExpandable(n)) s.add(n.id);
    return s;
  }, [rows]);

  const [openIds, setOpenIds] = useState<Set<string>>(defaultOpen);

  // Re-sync on file change — otherwise stale ids stick around.
  const [syncKey, setSyncKey] = useState<string | undefined>(entity?.id);
  if (syncKey !== entity?.id) {
    setSyncKey(entity?.id);
    setOpenIds(defaultOpen);
  }

  const toggle = (id: string): void => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      n += 1 + r.children.length;
    }
    return n;
  }, [rows]);

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Outline · <span style={fileNameStyle}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            {total} symbols · {rows.length} roots
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          IntelliJ Structure · VS Code Outline · LSP DocumentSymbol
        </div>
      </header>

      <div style={listStyle}>
        {rows.length === 0 ? (
          <div style={{ padding: space[5], color: color.text3, fontSize: font.size.sm, textAlign: "center" }}>
            이 파일에 검출된 심볼이 없습니다.
          </div>
        ) : (
          (() => {
            const result: ReactElement[] = [];
            let flatIdx = 0;
            for (const root of rows) {
              const expandable = isExpandable(root);
              const open = expandable && openIds.has(root.id);
              result.push(
                <OutlineRow
                  key={root.id}
                  node={root}
                  depth={0}
                  expandable={expandable}
                  open={open}
                  onToggle={() => toggle(root.id)}
                  onFocus={() => ctx.dispatch.selectEntity(entity.id)}
                  index={flatIdx++}
                />,
              );
              if (open) {
                for (const child of root.children) {
                  result.push(
                    <OutlineRow
                      key={child.id}
                      node={child}
                      depth={1}
                      expandable={false}
                      open={false}
                      onFocus={() => ctx.dispatch.selectEntity(entity.id)}
                      index={flatIdx++}
                    />,
                  );
                }
              }
            }
            return result;
          })()
        )}
      </div>
    </div>
  );
}

function OutlineRow({
  node,
  depth,
  expandable,
  open,
  onToggle,
  onFocus,
  index,
}: {
  node: StructureNode;
  depth: number;
  expandable: boolean;
  open: boolean;
  onToggle?: () => void;
  onFocus: () => void;
  index: number;
}): ReactElement {
  const vis = VIS_STYLE[node.visibility];
  return (
    <div
      style={{
        ...rowStyle,
        paddingLeft: space[4] + depth * space[5],
        animationDelay: `${Math.min(index, 40) * 18}ms`,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = color.hover)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        style={{
          ...chevronBtnStyle,
          visibility: expandable ? "visible" : "hidden",
          cursor: expandable ? "pointer" : "default",
        }}
      >
        <span style={{
          display: "inline-block",
          transform: `rotate(${open ? 90 : 0}deg)`,
          transition: `transform ${transition.base}`,
          fontSize: 10,
          color: color.text2,
          lineHeight: 1,
        }}>
          ▶
        </span>
      </button>

      <button
        type="button"
        onClick={onFocus}
        style={rowBodyBtnStyle}
      >
        <span style={{
          fontFamily: font.mono,
          fontSize: font.size.lg,
          color: KIND_HUE[node.kind],
          lineHeight: 1,
          width: 18,
          textAlign: "center",
          flexShrink: 0,
        }}>
          {KIND_GLYPH[node.kind]}
        </span>
        <span style={nameStyle}>{node.name}</span>
        <span style={kindMetaStyle}>{node.kind}</span>
        <span style={{ flex: 1 }} />
        <span style={{
          display: "inline-block",
          padding: "1px 6px",
          fontSize: font.size.xxs,
          fontFamily: font.mono,
          fontWeight: font.weight.semibold,
          letterSpacing: 0.2,
          background: vis.bg,
          color: vis.fg,
          borderRadius: radius.pill,
          flexShrink: 0,
        }}>
          {vis.label}
        </span>
        <span style={locTagStyle}>{node.loc} LoC</span>
        <span style={lineTagStyle}>L{node.line}</span>
      </button>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: color.bg0,
  color: color.text0,
  fontFamily: font.sans,
  animation: `so-enter 520ms ${ENTRY_EASE} both`,
  overflow: "hidden",
};

const emptyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontSize: font.size.md,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[4]}px ${space[5]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const fileNameStyle: CSSProperties = {
  color: color.text1,
  fontWeight: font.weight.medium,
  fontFamily: font.mono,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const listStyle: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: `${space[2]}px 0 ${space[4]}px`,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[1],
  padding: `${space[1]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  transition: `background ${transition.base}`,
  animation: `so-row 380ms ${ENTRY_EASE} both`,
};

const chevronBtnStyle: CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: 0,
  padding: 0,
  flexShrink: 0,
};

const rowBodyBtnStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: "transparent",
  border: 0,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flexShrink: 1,
  minWidth: 0,
};

const kindMetaStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  flexShrink: 0,
};

const locTagStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text2,
  background: color.bg3,
  padding: "1px 6px",
  borderRadius: radius.sm,
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const lineTagStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  flexShrink: 0,
  minWidth: 36,
  textAlign: "right",
};

export const StructureOutlineView = memo(StructureOutlineViewImpl);
