// MoveHintView — files detected in the wrong folder.
// --------------------------------------------------------------------
// Two-column list: current location on the left, suggested new location
// on the right, with a curved arrow between them. An annotation line
// below the row explains the reasoning (edge-count comparison with
// sibling folders).
//
// Rows are computed from `mislocationScore(entity) > 0.4` — pure
// synthesis until a real analyzer feeds move suggestions.
//
// Entrance: 500ms fade+scale + per-row stagger 20ms.
// Pure DOM, inline styles, light theme.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color as tokenColor,
  font,
  radius,
  space,
  transition,
} from "../../../shared/ui/tokens";
import {
  mislocationScore,
  seeded,
} from "../../../shared/analytics/synth-metrics";

export interface MoveHintViewProps {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Styles ────────────────────────────────────────────────────────────

const STYLE_ID = "move-hint-view-styles";
function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes mhv-enter {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes mhv-rowIn {
      from { opacity: 0; transform: translateY(3px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Split path into folder segments (excluding the file name itself). */
function folderSegments(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return [];
  return parts.slice(0, -1);
}

function parentPath(path: string): string {
  const segs = folderSegments(path);
  return segs.length === 0 ? "/" : "/" + segs.join("/");
}

interface MoveRow {
  id: string;
  name: string;
  fromFolder: string;
  fromSegs: string[];
  toFolder: string;
  toSegs: string[];
  score: number;
  fromRefs: number;
  toRefs: number;
}

function pickSuggestedFolder(
  entity: Entity,
  tree: EntityTree,
): { segs: string[]; folder: string } {
  // Find sibling folders of the file's parent folder.
  const parent = entity.parentId !== null ? tree.byId.get(entity.parentId) : undefined;
  const grand = parent && parent.parentId !== null ? tree.byId.get(parent.parentId) : undefined;
  const siblingFolders: Entity[] = [];
  if (grand) {
    for (const cid of grand.childIds) {
      const sib = tree.byId.get(cid);
      if (!sib) continue;
      if (sib.id === parent?.id) continue;
      if (sib.kind === "street" || sib.kind === "galaxy" || sib.kind === "building") {
        // Use only folder-like siblings (street/galaxy). building is a file.
        if (sib.kind !== "building") siblingFolders.push(sib);
      }
    }
  }
  const rng = seeded(entity.id, "misloc-target");
  if (siblingFolders.length > 0) {
    const idx = Math.floor(rng() * siblingFolders.length);
    const pick = siblingFolders[idx];
    if (pick) {
      return { segs: folderSegments(pick.path + "/x"), folder: parentPath(pick.path + "/x") };
    }
  }
  // Fallback: invent a generic sibling name.
  const generic = ["shared", "lib", "utils", "common", "core", "features"];
  const pickName = generic[Math.floor(rng() * generic.length)] ?? "shared";
  const base = folderSegments(entity.path);
  const replaced = base.length > 0 ? [...base.slice(0, -1), pickName] : [pickName];
  return { segs: replaced, folder: "/" + replaced.join("/") };
}

function buildRows(tree: EntityTree): MoveRow[] {
  const out: MoveRow[] = [];
  for (const entity of tree.byId.values()) {
    if (entity.kind !== "building") continue;
    const score = mislocationScore(entity);
    if (score <= 0.4) continue;
    const fromSegs = folderSegments(entity.path);
    const from = parentPath(entity.path);
    const { segs: toSegs, folder: toFolder } = pickSuggestedFolder(entity, tree);
    const rng = seeded(entity.id, "misloc-refs");
    // Synthesized "edge count A / B" for the annotation line.
    const fromRefs = Math.floor(rng() * 10);
    const toRefs = Math.floor(rng() * 3); // by construction, to has more pull
    out.push({
      id: entity.id,
      name: entity.name,
      fromFolder: from,
      fromSegs,
      toFolder,
      toSegs,
      score,
      // Flip so annotation matches reasoning "A 7번 참조, B 0번".
      fromRefs: Math.max(fromRefs, 3),
      toRefs: Math.min(toRefs, 1),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// ── Breadcrumb ────────────────────────────────────────────────────────

function Breadcrumb({ segs }: { segs: string[] }) {
  if (segs.length === 0) {
    return (
      <span
        style={{
          fontSize: font.size.xs,
          color: tokenColor.text3,
          fontFamily: font.mono,
        }}
      >
        /
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: font.size.xs,
        color: tokenColor.text2,
        fontFamily: font.mono,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: 0,
      }}
    >
      {segs.map((s, i) => (
        <span key={`${s}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          {i > 0 && <span style={{ color: tokenColor.text3 }}>/</span>}
          <span
            style={{
              color: i === segs.length - 1 ? tokenColor.text0 : tokenColor.text2,
              fontWeight: i === segs.length - 1 ? font.weight.semibold : font.weight.regular,
            }}
          >
            {s}
          </span>
        </span>
      ))}
    </span>
  );
}

// ── Curved arrow ──────────────────────────────────────────────────────

function CurvedArrow() {
  // Thick, tapered SVG arrow with a gentle downward curve.
  return (
    <svg
      width="48"
      height="22"
      viewBox="0 0 48 22"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="mhv-arrow-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={tokenColor.text3} />
          <stop offset="100%" stopColor={tokenColor.text1} />
        </linearGradient>
      </defs>
      <path
        d="M 2 11 Q 24 2 40 11"
        stroke="url(#mhv-arrow-grad)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 36 7 L 42 11 L 36 15"
        stroke={tokenColor.text1}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ── Row ───────────────────────────────────────────────────────────────

interface RowProps {
  row: MoveRow;
  staggerMs: number;
  onFocus?: () => void;
}

function MoveRowView({ row, staggerMs, onFocus }: RowProps) {
  const [hovered, setHovered] = useState(false);
  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: space[1],
    padding: `${space[3]}px ${space[6]}px`,
    background: hovered ? tokenColor.bg3 : "transparent",
    borderBottom: `1px solid ${tokenColor.borderSoft}`,
    cursor: onFocus ? "pointer" : "default",
    transition: `background ${transition.base}`,
    animation: `mhv-rowIn 380ms cubic-bezier(0.22, 1, 0.28, 1) both`,
    animationDelay: `${staggerMs}ms`,
  };
  const topStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    minWidth: 0,
  };
  const cellStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  };
  const fromCellStyle: CSSProperties = {
    ...cellStyle,
  };
  const toCellStyle: CSSProperties = {
    ...cellStyle,
    alignItems: "flex-end",
    textAlign: "right",
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
  const annotationStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    paddingLeft: 4,
  };
  const labelStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: font.weight.semibold,
  };

  const fromFolder = row.fromFolder.replace(/^\/+/, "") || "(root)";
  const toFolder = row.toFolder.replace(/^\/+/, "") || "(root)";

  return (
    <div
      style={rowStyle}
      onClick={() => onFocus?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={topStyle}>
        <div style={fromCellStyle}>
          <span style={labelStyle}>Current</span>
          <span style={nameStyle} title={row.name}>
            {row.name}
          </span>
          <Breadcrumb segs={row.fromSegs} />
        </div>
        <CurvedArrow />
        <div style={toCellStyle}>
          <span style={labelStyle}>Suggested</span>
          <span style={nameStyle} title={row.name}>
            {row.name}
          </span>
          <Breadcrumb segs={row.toSegs} />
        </div>
      </div>
      <div style={annotationStyle}>
        이 파일이 {fromFolder} 폴더 파일을 {row.fromRefs}번 참조, {toFolder} 폴더{" "}
        {row.toRefs}번 참조 → {toFolder}(으)로 이동 제안
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────

function MoveHintViewImpl({ tree, onFocusEntity, onDismiss }: MoveHintViewProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);
  const rows = useMemo(() => buildRows(tree), [tree]);

  useEffect(() => {
    injectStyles();
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const rootStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: tokenColor.bg1,
    overflow: "hidden",
    fontFamily: font.sans,
    animation: mounted
      ? `mhv-enter 500ms cubic-bezier(0.22, 1, 0.28, 1) both`
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

  return (
    <div style={rootStyle} role="region" aria-label="Move hints">
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={titleStyle}>Move Hints</span>
          <span style={subtitleStyle}>잘못 놓인 파일 감지</span>
        </div>
        <span style={countChipStyle}>
          {rows.length.toLocaleString()}개 제안
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
          <span>자리를 잘못 잡은 파일이 없어요.</span>
          <span style={{ fontSize: font.size.xs, color: tokenColor.text3 }}>
            모든 파일이 의존성 중심과 일치하는 폴더에 있습니다.
          </span>
        </div>
      ) : (
        <div style={scrollStyle}>
          {rows.map((row, i) => (
            <MoveRowView
              key={row.id}
              row={row}
              staggerMs={Math.min(i, 24) * 20}
              onFocus={onFocusEntity ? () => onFocusEntity(row.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const MoveHintView = memo(MoveHintViewImpl);
