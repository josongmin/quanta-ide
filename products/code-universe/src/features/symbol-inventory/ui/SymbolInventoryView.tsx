// SymbolInventoryView — flat sortable symbol list for a file.
// --------------------------------------------------------------------
// Reference: Sourcetrail interactive symbol view + SciTools Understand
// Entity Filter.
// Each row: kind glyph · name · visibility pill · LoC bar · CC bar ·
// "called by N" badge · "tests N" badge. Header click toggles sort
// direction. Numeric columns sort descending first (hot files surface
// the scariest symbol instantly); name sorts ascending first.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  symbolsInFile,
  type SymbolKind,
  type SymbolVisibility,
  type SynthSymbol,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

type SortKey = "name" | "loc" | "cc" | "callers";
type SortDir = "asc" | "desc";

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `
@keyframes si-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes si-row {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const KIND_GLYPH: Record<SymbolKind, string> = {
  class: "◼",
  interface: "◇",
  function: "ƒ",
  method: "⋄",
  variable: "x",
};

const KIND_HUE: Record<SymbolKind, string> = {
  class: "#3d3d3d",
  interface: "#7e4ed6",
  function: "#0d99ff",
  method: "#22a06b",
  variable: "#e09321",
};

const VIS_STYLE: Record<SymbolVisibility, { bg: string; fg: string; label: string }> = {
  public:   { bg: "#d1fae5", fg: "#065f46", label: "public"   },
  internal: { bg: "#e0e7ff", fg: "#3730a3", label: "internal" },
  private:  { bg: "#fee2e2", fg: "#991b1b", label: "private"  },
};

function sortSymbols(rows: readonly SynthSymbol[], key: SortKey, dir: SortDir): SynthSymbol[] {
  const sign = dir === "asc" ? 1 : -1;
  const arr = rows.slice();
  arr.sort((a, b) => {
    switch (key) {
      case "name":    return sign * a.name.localeCompare(b.name);
      case "loc":     return sign * (a.loc - b.loc);
      case "cc":      return sign * (a.cyclomatic - b.cyclomatic);
      case "callers": return sign * (a.callers - b.callers);
    }
  });
  return arr;
}

function SymbolInventoryViewImpl({ entity, empty }: Props): ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("loc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(() => {
    if (!entity) return [];
    return sortSymbols(symbolsInFile(entity), sortKey, sortDir);
  }, [entity, sortKey, sortDir]);

  const maxLoc = useMemo(() => rows.reduce((m, s) => Math.max(m, s.loc), 1), [rows]);
  const maxCc = useMemo(() => rows.reduce((m, s) => Math.max(m, s.cyclomatic), 1), [rows]);

  function onHeader(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      // Numeric columns default desc (big first), name defaults asc.
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

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
          <div style={titleStyle}>Symbols · <span style={fileNameStyle}>{entity.name}</span></div>
          <div style={subtitleStyle}>
            {rows.length} symbols · sort: {sortKey} {sortDir}
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          Sourcetrail · Understand Entity Filter
        </div>
      </header>

      <div style={tableWrapStyle}>
        <div style={tableHeadStyle}>
          <SortHeader label="KIND" active={false} style={{ width: 56 }} />
          <SortHeader label="NAME" active={sortKey === "name"} dir={sortDir} onClick={() => onHeader("name")} style={{ flex: 2, minWidth: 180 }} />
          <SortHeader label="VIS" active={false} style={{ width: 84 }} />
          <SortHeader label="LOC" active={sortKey === "loc"} dir={sortDir} onClick={() => onHeader("loc")} style={{ flex: 1.4, minWidth: 120 }} />
          <SortHeader label="CC" active={sortKey === "cc"} dir={sortDir} onClick={() => onHeader("cc")} style={{ flex: 1.4, minWidth: 120 }} />
          <SortHeader label="CALLERS" active={sortKey === "callers"} dir={sortDir} onClick={() => onHeader("callers")} style={{ width: 100 }} />
          <SortHeader label="TESTS" active={false} style={{ width: 80 }} />
        </div>

        <div style={tableBodyStyle}>
          {rows.map((s, i) => (
            <div
              key={s.id}
              style={{
                ...rowStyle,
                animationDelay: `${40 + i * 14}ms`,
              }}
            >
              <div style={{ width: 56, display: "flex", justifyContent: "center" }}>
                <span
                  title={s.kind}
                  style={{
                    fontFamily: font.mono,
                    fontSize: font.size.lg,
                    color: KIND_HUE[s.kind],
                    lineHeight: 1,
                  }}
                >
                  {KIND_GLYPH[s.kind]}
                </span>
              </div>
              <div style={{ flex: 2, minWidth: 180, display: "flex", flexDirection: "column" }}>
                <span style={nameStyle}>{s.name}</span>
                <span style={kindStyle}>{s.kind} · line {s.line}</span>
              </div>
              <div style={{ width: 84 }}>
                <VisibilityPill v={s.visibility} />
              </div>
              <div style={{ flex: 1.4, minWidth: 120 }}>
                <MiniBar value={s.loc} max={maxLoc} color={color.accent} suffix={` ${s.loc}`} />
              </div>
              <div style={{ flex: 1.4, minWidth: 120 }}>
                <MiniBar
                  value={s.cyclomatic}
                  max={maxCc}
                  color={s.cyclomatic >= 10 ? color.danger : s.cyclomatic >= 6 ? color.warn : color.success}
                  suffix={` ${s.cyclomatic}`}
                />
              </div>
              <div style={{ width: 100 }}>
                <Badge tone="neutral">called by {s.callers}</Badge>
              </div>
              <div style={{ width: 80 }}>
                <Badge tone={s.tests === 0 ? "warn" : "success"}>tests {s.tests}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SortHeader({
  label,
  active,
  dir,
  onClick,
  style,
}: {
  label: string;
  active: boolean;
  dir?: SortDir;
  onClick?: () => void;
  style?: CSSProperties;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        ...sortHeaderStyle,
        ...(active ? { color: color.text0 } : undefined),
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      <span>{label}</span>
      {active && <span style={sortArrowStyle}>{dir === "asc" ? "▲" : "▼"}</span>}
    </button>
  );
}

function VisibilityPill({ v }: { v: SymbolVisibility }): ReactElement {
  const s = VIS_STYLE[v];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        fontSize: font.size.xxs,
        fontFamily: font.mono,
        fontWeight: font.weight.semibold,
        letterSpacing: 0.2,
        background: s.bg,
        color: s.fg,
        borderRadius: radius.pill,
      }}
    >
      {s.label}
    </span>
  );
}

function MiniBar({
  value,
  max,
  color: hue,
  suffix,
}: {
  value: number;
  max: number;
  color: string;
  suffix?: string;
}): ReactElement {
  const ratio = Math.min(1, value / Math.max(1, max));
  return (
    <div style={miniBarWrap}>
      <div style={miniBarBase}>
        <div
          style={{
            ...miniBarFill,
            width: `${Math.max(2, ratio * 100)}%`,
            background: hue,
          }}
        />
      </div>
      {suffix && <span style={miniBarSuffix}>{suffix.trim()}</span>}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "warn" | "success";
}): ReactElement {
  const bg = tone === "warn" ? "#fef3c7" : tone === "success" ? "#d1fae5" : color.bg3;
  const fg = tone === "warn" ? "#92400e" : tone === "success" ? "#065f46" : color.text2;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        background: bg,
        color: fg,
        borderRadius: radius.sm,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
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
  animation: `si-enter 520ms ${ENTRY_EASE} both`,
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
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const tableWrapStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
};

const tableHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[5]}px`,
  borderBottom: `1px solid ${color.border}`,
  background: color.bg2,
  flexShrink: 0,
};

const sortHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  background: "transparent",
  border: 0,
  padding: `2px 4px`,
  textAlign: "left",
  transition: `color ${transition.fast}`,
};

const sortArrowStyle: CSSProperties = {
  fontSize: 8,
  color: color.accent,
};

const tableBodyStyle: CSSProperties = {
  flex: 1,
  overflow: "auto",
  paddingBottom: space[4],
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[5]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `si-row 380ms ${ENTRY_EASE} both`,
};

const nameStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const kindStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
};

const miniBarWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const miniBarBase: CSSProperties = {
  flex: 1,
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const miniBarFill: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
  transition: `width ${transition.base}`,
};

const miniBarSuffix: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
  minWidth: 32,
  textAlign: "right",
};

export const SymbolInventoryView = memo(SymbolInventoryViewImpl);
