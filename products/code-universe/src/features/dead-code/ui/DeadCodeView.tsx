// DeadCodeView — list of unreferenced files/symbols (fanIn === 0).
// --------------------------------------------------------------------
// Each row = one candidate for deletion. Checkbox selects it; footer
// button shows the running count. Pure UI — no deletion ever happens.
//
// Layout:
//   • Header: title, subtitle ("참조 없는 죽은 코드"), dismiss ×
//   • Scroll area of rows: checkbox · name · kind pill · "파일 X줄" ·
//     "최근 커밋 N일 전"
//   • Footer: sticky primary button "골라낸 코드 지우기 (N개)"
//
// Entrance: 500ms fade+scale root + per-row stagger 18ms.
// Pure DOM, inline styles only, light theme.

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { Entity, WorkspaceGraph } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color as tokenColor,
  font,
  radius,
  space,
  transition,
} from "../../../shared/ui/tokens";
import {
  daysSinceModified,
  fanIn as fanInMetric,
} from "../../../shared/analytics/synth-metrics";

export interface DeadCodeViewProps {
  tree: EntityTree;
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── One-time keyframe injection ───────────────────────────────────────

const STYLE_ID = "dead-code-view-styles";
function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes dcv-enter {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes dcv-rowIn {
      from { opacity: 0; transform: translateY(3px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ── Kind labels for the kind pill ─────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  universe: "Workspace",
  galaxy: "Package",
  street: "Folder",
  building: "File",
  floor: "Module",
  room: "Function",
};

// Root-ish leaf names we never treat as dead (they are entry points).
const ROOT_FILE_NAMES = new Set([
  "index",
  "main",
  "app",
  "entry",
  "root",
  "bootstrap",
  "server",
]);

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function isRootish(entity: Entity): boolean {
  if (entity.kind !== "building") return false;
  const base = stripExt(entity.name).toLowerCase();
  return ROOT_FILE_NAMES.has(base);
}

function fileLoc(entity: Entity): number {
  const loc = entity.metrics?.loc;
  if (typeof loc === "number" && Number.isFinite(loc)) return Math.max(0, loc);
  return 0;
}

// ── Candidate row model ───────────────────────────────────────────────

interface DeadRow {
  id: string;
  name: string;
  path: string;
  kind: Entity["kind"];
  loc: number;
  days: number;
}

function buildRows(tree: EntityTree, graph: WorkspaceGraph): DeadRow[] {
  const edges = graph.fileEdges;
  const out: DeadRow[] = [];
  for (const entity of tree.byId.values()) {
    // Only files and function-level leaves are meaningful "dead" candidates.
    if (entity.kind !== "building" && entity.kind !== "room" && entity.kind !== "floor") {
      continue;
    }
    if (isRootish(entity)) continue;
    const fin = fanInMetric(entity, edges);
    if (fin !== 0) continue;
    out.push({
      id: entity.id,
      name: entity.name,
      path: entity.path,
      kind: entity.kind,
      loc: fileLoc(entity),
      days: daysSinceModified(entity),
    });
  }
  // Stable sort: biggest (likely most impactful to delete) first, then name.
  out.sort((a, b) => {
    if (b.loc !== a.loc) return b.loc - a.loc;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  return out;
}

// ── Kind pill ─────────────────────────────────────────────────────────

function KindPill({ kind }: { kind: Entity["kind"] }) {
  const label = KIND_LABEL[kind] ?? kind;
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    color: tokenColor.text1,
    fontSize: font.size.xxs,
    fontWeight: font.weight.medium,
    border: `1px solid ${tokenColor.border}`,
    lineHeight: "16px",
    flexShrink: 0,
    letterSpacing: 0.2,
  };
  return <span style={style}>{label}</span>;
}

// ── Checkbox ──────────────────────────────────────────────────────────

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

function Checkbox({ checked, onChange, label }: CheckboxProps) {
  const [hovered, setHovered] = useState(false);
  const style: CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    border: `1px solid ${checked ? tokenColor.accent : hovered ? tokenColor.borderStrong : tokenColor.border}`,
    background: checked ? tokenColor.accent : tokenColor.bg1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    transition: `background ${transition.fast}, border-color ${transition.fast}`,
  };
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={e => {
        e.stopPropagation();
        onChange();
      }}
      onKeyDown={e => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange();
        }
      }}
      style={style}
    >
      {checked ? (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path
            d="M2 5.2L4.2 7.4L8 3"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

// ── Row ───────────────────────────────────────────────────────────────

interface RowProps {
  row: DeadRow;
  checked: boolean;
  staggerMs: number;
  onToggle: () => void;
  onFocus?: () => void;
}

function DeadRowView({ row, checked, staggerMs, onToggle, onFocus }: RowProps) {
  const [hovered, setHovered] = useState(false);
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[3]}px ${space[6]}px`,
    background: hovered ? tokenColor.bg3 : "transparent",
    borderBottom: `1px solid ${tokenColor.borderSoft}`,
    cursor: onFocus ? "pointer" : "default",
    transition: `background ${transition.base}`,
    animation: `dcv-rowIn 380ms cubic-bezier(0.22, 1, 0.28, 1) both`,
    animationDelay: `${staggerMs}ms`,
  };
  const nameStyle: CSSProperties = {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
  };
  const pathStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    fontFamily: font.mono,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
  };
  const metaStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onFocus?.()}
    >
      <Checkbox checked={checked} onChange={onToggle} label={`Select ${row.name}`} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0 }}>
          <span style={nameStyle} title={row.path}>
            {row.name}
          </span>
          <KindPill kind={row.kind} />
        </div>
        <span style={pathStyle} title={row.path}>
          {row.path}
        </span>
      </div>
      <span style={metaStyle}>파일 {row.loc.toLocaleString()}줄</span>
      <span style={metaStyle}>최근 커밋 {row.days}일 전</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function DeadCodeViewImpl({ tree, graph, onFocusEntity, onDismiss }: DeadCodeViewProps) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [buttonHovered, setButtonHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);

  const rows = useMemo(() => buildRows(tree, graph), [tree, graph]);

  useEffect(() => {
    injectStyles();
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedCount = selected.size;

  const rootStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: tokenColor.bg1,
    overflow: "hidden",
    fontFamily: font.sans,
    animation: mounted
      ? `dcv-enter 500ms cubic-bezier(0.22, 1, 0.28, 1) both`
      : undefined,
    opacity: mounted ? 1 : 0,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[3]}px ${space[6]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    background: tokenColor.bg1,
    flexShrink: 0,
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
    lineHeight: 1,
  };

  const dismissStyle: CSSProperties = {
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: dismissHovered ? tokenColor.text0 : tokenColor.text2,
    background: dismissHovered ? tokenColor.hover : "transparent",
    fontSize: font.size.md,
    borderRadius: radius.sm,
    border: `1px solid ${dismissHovered ? tokenColor.borderStrong : "transparent"}`,
    padding: 0,
    lineHeight: 1,
    transition: `background ${transition.base}, color ${transition.base}, border-color ${transition.base}`,
  };

  const countChipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    border: `1px solid ${tokenColor.border}`,
    fontSize: font.size.xxs,
    color: tokenColor.text1,
    fontWeight: font.weight.medium,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  };

  const scrollStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    background: tokenColor.bg1,
  };

  const emptyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    color: tokenColor.text2,
    padding: space[4],
    textAlign: "center",
    fontSize: font.size.sm,
  };

  const footerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space[3],
    padding: `${space[3]}px ${space[6]}px`,
    borderTop: `1px solid ${tokenColor.border}`,
    background: tokenColor.bg1,
    flexShrink: 0,
  };

  const disabled = selectedCount === 0;
  const buttonStyle: CSSProperties = {
    padding: `${space[2]}px ${space[4]}px`,
    borderRadius: radius.md,
    border: `1px solid ${
      disabled ? tokenColor.border : buttonHovered ? tokenColor.accentHover : tokenColor.accent
    }`,
    background: disabled
      ? tokenColor.bg3
      : buttonHovered
        ? tokenColor.accentHover
        : tokenColor.accent,
    color: disabled ? tokenColor.text3 : "#ffffff",
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: font.sans,
    transition: `background ${transition.base}, border-color ${transition.base}`,
  };

  return (
    <div style={rootStyle} role="region" aria-label="Dead code candidates">
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={titleStyle}>Dead Code</span>
          <span style={subtitleStyle}>참조 없는 죽은 코드</span>
        </div>
        <span style={countChipStyle}>
          {rows.length.toLocaleString()}개 후보
        </span>
        {onDismiss !== undefined && (
          <button
            style={dismissStyle}
            aria-label="Dismiss"
            title="Dismiss"
            onClick={onDismiss}
            onMouseEnter={() => setDismissHovered(true)}
            onMouseLeave={() => setDismissHovered(false)}
          >
            ×
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={emptyStyle}>
          <span>참조 없는 코드가 없어요.</span>
          <span style={{ fontSize: font.size.xs, color: tokenColor.text3 }}>
            모든 심볼이 최소 1개 이상의 참조를 가지고 있습니다.
          </span>
        </div>
      ) : (
        <div style={scrollStyle}>
          {rows.map((row, i) => (
            <DeadRowView
              key={row.id}
              row={row}
              checked={selected.has(row.id)}
              staggerMs={Math.min(i, 24) * 18}
              onToggle={() => toggle(row.id)}
              onFocus={onFocusEntity ? () => onFocusEntity(row.id) : undefined}
            />
          ))}
        </div>
      )}

      <div style={footerStyle}>
        <button
          style={buttonStyle}
          disabled={disabled}
          onMouseEnter={() => setButtonHovered(true)}
          onMouseLeave={() => setButtonHovered(false)}
        >
          골라낸 코드 지우기 ({selectedCount.toLocaleString()}개)
        </button>
      </div>
    </div>
  );
}

export const DeadCodeView = memo(DeadCodeViewImpl);
