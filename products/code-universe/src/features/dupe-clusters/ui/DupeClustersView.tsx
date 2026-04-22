// DupeClustersView — clusters of likely-duplicate files.
// --------------------------------------------------------------------
// Cluster card:
//   • Header: "Cluster #3 · 5 files · ~85% similar"
//   • Body:   list of files with synthesized line-range (e.g. L12–L58)
//   • Expand: pseudo-preview — two file names side-by-side + a synthetic
//             "matches at lines" summary line (no real code preview —
//             rendered as monospaced placeholder with dim glyphs).
//
// Clusters come from `duplicateCluster(entity)` (synth). Cluster 0 is
// skipped (no duplicates). Top clusters by member count are shown.
//
// Entrance: 500ms fade+scale + per-card stagger 22ms.
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
  duplicateCluster,
  seeded,
} from "../../../shared/analytics/synth-metrics";

export interface DupeClustersViewProps {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Styles ────────────────────────────────────────────────────────────

const STYLE_ID = "dupe-clusters-view-styles";
function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes dcluv-enter {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes dcluv-cardIn {
      from { opacity: 0; transform: translateY(3px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ── Cluster model ─────────────────────────────────────────────────────

interface DupeFile {
  id: string;
  name: string;
  path: string;
  startLine: number;
  endLine: number;
}

interface DupeCluster {
  clusterId: number;
  files: DupeFile[];
  similarity: number; // 0..1
}

function synthesizeRange(entity: Entity): { start: number; end: number } {
  const loc = entity.metrics?.loc ?? 0;
  const rng = seeded(entity.id, "dup-range");
  if (loc > 20) {
    const start = Math.max(1, Math.floor(rng() * Math.max(1, loc - 20)));
    const span = 10 + Math.floor(rng() * Math.min(80, Math.max(10, loc - start)));
    return { start, end: Math.min(loc, start + span) };
  }
  const start = 1 + Math.floor(rng() * 40);
  return { start, end: start + 15 + Math.floor(rng() * 40) };
}

function buildClusters(tree: EntityTree): DupeCluster[] {
  const byCluster = new Map<number, DupeFile[]>();
  for (const entity of tree.byId.values()) {
    if (entity.kind !== "building") continue;
    const cid = duplicateCluster(entity);
    if (cid === 0) continue;
    const { start, end } = synthesizeRange(entity);
    const list = byCluster.get(cid);
    const member: DupeFile = {
      id: entity.id,
      name: entity.name,
      path: entity.path,
      startLine: start,
      endLine: end,
    };
    if (list) list.push(member);
    else byCluster.set(cid, [member]);
  }
  const out: DupeCluster[] = [];
  for (const [clusterId, files] of byCluster) {
    if (files.length < 2) continue; // need at least 2 to be a dupe
    // Deterministic similarity from cluster id — bigger cluster slightly lower %.
    const rng = seeded(`cluster:${clusterId}`, "sim");
    const similarity = 0.7 + rng() * 0.28 - Math.min(0.1, files.length / 100);
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    out.push({ clusterId, files, similarity });
  }
  out.sort((a, b) => {
    if (b.files.length !== a.files.length) return b.files.length - a.files.length;
    return b.similarity - a.similarity;
  });
  return out;
}

// ── Pseudo preview ────────────────────────────────────────────────────

function PseudoPreview({ cluster }: { cluster: DupeCluster }) {
  const a = cluster.files[0];
  const b = cluster.files[1];
  if (!a || !b) return null;
  const shared = Math.max(3, Math.floor(Math.min(a.endLine - a.startLine, b.endLine - b.startLine) * cluster.similarity));
  const boxStyle: CSSProperties = {
    flex: 1,
    background: tokenColor.bg2,
    border: `1px solid ${tokenColor.border}`,
    borderRadius: radius.sm,
    padding: space[2],
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: tokenColor.text2,
    overflow: "hidden",
    minWidth: 0,
  };
  const headerStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: font.weight.semibold,
    marginBottom: 4,
  };
  const fakeLineStyle: CSSProperties = {
    display: "block",
    color: tokenColor.text3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const matchLineStyle: CSSProperties = {
    ...fakeLineStyle,
    color: tokenColor.text1,
    background: tokenColor.accentSofter,
    paddingLeft: 2,
  };
  const lines = [
    "  import { x } from './util';",
    "  export function handle(event) {",
    "    const v = normalize(event);",
    "    if (!v) return null;",
    "    return transform(v);",
    "  }",
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: space[2],
        padding: `${space[2]}px ${space[4]}px ${space[3]}px 48px`,
        background: tokenColor.bg2,
      }}
    >
      <div style={boxStyle}>
        <div style={headerStyle}>{a.name}</div>
        {lines.map((l, i) => (
          <span key={`a-${i}`} style={i < shared ? matchLineStyle : fakeLineStyle}>
            {l}
          </span>
        ))}
      </div>
      <div style={boxStyle}>
        <div style={headerStyle}>{b.name}</div>
        {lines.map((l, i) => (
          <span key={`b-${i}`} style={i < shared ? matchLineStyle : fakeLineStyle}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Cluster card ──────────────────────────────────────────────────────

interface CardProps {
  cluster: DupeCluster;
  staggerMs: number;
  onFocus?: (id: string) => void;
}

function ClusterCard({ cluster, staggerMs, onFocus }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoverHeader, setHoverHeader] = useState(false);

  const wrapStyle: CSSProperties = {
    borderBottom: `1px solid ${tokenColor.border}`,
    animation: `dcluv-cardIn 380ms cubic-bezier(0.22, 1, 0.28, 1) both`,
    animationDelay: `${staggerMs}ms`,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[3]}px ${space[6]}px`,
    cursor: "pointer",
    background: hoverHeader ? tokenColor.bg3 : tokenColor.bg1,
    transition: `background ${transition.base}`,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    flex: 1,
    minWidth: 0,
  };

  const simPillStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: radius.pill,
    background: tokenColor.accentSofter,
    border: `1px solid ${tokenColor.accentBorder}`,
    color: tokenColor.accent,
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  };

  const caretStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    transition: `transform ${transition.base}`,
    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
    flexShrink: 0,
    width: 10,
    textAlign: "center",
  };

  const fileRowStyle = (hovered: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: space[2],
    padding: `${space[2]}px ${space[6]}px ${space[2]}px 48px`,
    fontSize: font.size.xs,
    background: hovered ? tokenColor.bg3 : "transparent",
    cursor: onFocus ? "pointer" : "default",
    transition: `background ${transition.base}`,
    borderTop: `1px solid ${tokenColor.borderSoft}`,
  });

  return (
    <div style={wrapStyle}>
      <div
        style={headerStyle}
        onClick={() => setExpanded(v => !v)}
        onMouseEnter={() => setHoverHeader(true)}
        onMouseLeave={() => setHoverHeader(false)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(v => !v);
          }
        }}
      >
        <span style={caretStyle}>▶</span>
        <span style={titleStyle}>
          Cluster #{cluster.clusterId} · {cluster.files.length} files
        </span>
        <span style={simPillStyle}>~{Math.round(cluster.similarity * 100)}% similar</span>
      </div>

      {expanded && (
        <>
          {cluster.files.map(f => (
            <FileLine
              key={f.id}
              file={f}
              rowStyle={fileRowStyle}
              onFocus={onFocus ? () => onFocus(f.id) : undefined}
            />
          ))}
          <PseudoPreview cluster={cluster} />
        </>
      )}
    </div>
  );
}

interface FileLineProps {
  file: DupeFile;
  rowStyle: (hovered: boolean) => CSSProperties;
  onFocus?: () => void;
}

function FileLine({ file, rowStyle, onFocus }: FileLineProps) {
  const [hovered, setHovered] = useState(false);
  const nameStyle: CSSProperties = {
    fontFamily: font.mono,
    color: tokenColor.text0,
    fontWeight: font.weight.medium,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  };
  const rangeStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text2,
    fontFamily: font.mono,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  };
  return (
    <div
      style={rowStyle(hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onFocus?.()}
    >
      <span style={nameStyle} title={file.path}>
        {file.path}
      </span>
      <span style={rangeStyle}>
        L{file.startLine}–L{file.endLine}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────

function DupeClustersViewImpl({ tree, onFocusEntity, onDismiss }: DupeClustersViewProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);
  const clusters = useMemo(() => buildClusters(tree).slice(0, 20), [tree]);

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
      ? `dcluv-enter 500ms cubic-bezier(0.22, 1, 0.28, 1) both`
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
    <div style={rootStyle} role="region" aria-label="Duplicate clusters">
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={titleStyle}>Dupe Clusters</span>
          <span style={subtitleStyle}>중복 코드 클러스터</span>
        </div>
        <span style={countChipStyle}>
          {clusters.length.toLocaleString()}개 클러스터
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

      {clusters.length === 0 ? (
        <div style={emptyStyle}>
          <span>중복된 파일 클러스터가 없어요.</span>
          <span style={{ fontSize: font.size.xs, color: tokenColor.text3 }}>
            AST 지문 기반으로 유사 파일을 찾지 못했습니다.
          </span>
        </div>
      ) : (
        <div style={scrollStyle}>
          {clusters.map((cluster, i) => (
            <ClusterCard
              key={cluster.clusterId}
              cluster={cluster}
              staggerMs={Math.min(i, 24) * 22}
              onFocus={onFocusEntity}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const DupeClustersView = memo(DupeClustersViewImpl);
