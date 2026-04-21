// AuthorTerritoryView — SVG renderer for the Author Territory map.
// --------------------------------------------------------------------
// Renders each author as a large colored territory containing per-file
// nested rectangles. Color encodes authorship; darkness encodes age.
//
// Z-order (bottom to top):
//   1. Backdrop (click → onDismiss)
//   2. Territory fills (author hue, low opacity background)
//   3. Territory borders
//   4. File rectangles (darker blend of author color + age tint)
//   5. File labels (short name if rect big enough: loc > 100)
//   6. Age pulse rings (recent edits < 1 week)
//   7. Author territory labels (name + stats, centered)
//   8. Tooltip (SVG-inline, clamped)
//   9. Title + subtitle (top-left, static)
//  10. Legend (bottom — author color chips)
//  11. Empty state

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { color as tokenColor, font, radius as tokenRadius, space } from "../../../shared/ui/tokens";
import { buildAuthorTerritoryLayout } from "../model/build-author-territory-layout";
import type { AuthorFile, AuthorGroup } from "../model/types";

export interface AuthorTerritoryViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────
const ENTRY_MS = 280;
const TOOLTIP_W = 180;
const TOOLTIP_H = 72;
const TOOLTIP_PAD = 7;
const TOOLTIP_R = 4;
const ONE_WEEK_MS = 7 * 24 * 3600 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatAge(ageMs: number): string {
  const days = Math.floor(ageMs / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

function kLoc(loc: number): string {
  if (loc < 1000) return `${loc} LoC`;
  return `${(loc / 1000).toFixed(1)}k LoC`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// ── Legend chip ───────────────────────────────────────────────────────

interface LegendChipProps {
  group: AuthorGroup;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
}

function LegendChip({ group, hovered, onEnter, onLeave }: LegendChipProps) {
  const chipStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
    padding: `${space[0]}px ${space[2]}px`,
    borderRadius: tokenRadius.sm,
    background: hovered ? hexWithAlpha(group.color, 0.12) : "transparent",
    cursor: "default",
    transition: `background ${ENTRY_MS}ms`,
  };
  const dotStyle: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: group.color,
    flexShrink: 0,
  };
  const textStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: tokenColor.text1,
    whiteSpace: "nowrap",
  };
  return (
    <div style={chipStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div style={dotStyle} />
      <span style={textStyle}>{truncate(group.author, 12)}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function AuthorTerritoryViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: AuthorTerritoryViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [hoveredAuthor, setHoveredAuthor] = useState<string | null>(null);

  // Viewport dimensions: fill parent — we use a responsive container trick
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    // Two-rAF fade-in
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  // Pulse animation: keyframes injected once via a style element
  useEffect(() => {
    const id = "author-territory-pulse";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes at-pulse {
        0%   { opacity: 0.85; r: 0; }
        50%  { opacity: 0.4; }
        100% { opacity: 0; r: 10px; }
      }
      .at-pulse-ring { animation: at-pulse 1.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
    `;
    document.head.appendChild(style);
  }, []);

  const layout = useMemo(
    () =>
      buildAuthorTerritoryLayout({
        graph,
        width: dims.w,
        height: dims.h,
      }),
    [graph, dims.w, dims.h],
  );

  const fileById = useMemo(() => {
    if (!layout.hasBlame) return new Map<string, AuthorFile>();
    const m = new Map<string, AuthorFile>();
    for (const f of layout.allFiles) m.set(f.fileId, f);
    return m;
  }, [layout]);

  const handleBackdrop = useCallback(() => onDismiss?.(), [onDismiss]);
  const handleFileEnter = useCallback((id: string) => setHoveredFileId(id), []);
  const handleFileLeave = useCallback(() => setHoveredFileId(null), []);
  const handleFileClick = useCallback((id: string) => onFocusEntity?.(id), [onFocusEntity]);

  // Tooltip position — clamped inside SVG
  function tooltipPos(f: AuthorFile): { tx: number; ty: number } {
    const margin = 8;
    let tx = f.x + f.w / 2 - TOOLTIP_W / 2;
    let ty = f.y - TOOLTIP_H - 8;
    if (tx < margin) tx = margin;
    if (tx + TOOLTIP_W > dims.w - margin) tx = dims.w - margin - TOOLTIP_W;
    if (ty < margin) ty = f.y + f.h + 8;
    return { tx, ty };
  }

  const rootStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  const svgStyle: CSSProperties = {
    display: "block",
    userSelect: "none",
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // --- Empty state ---
  if (!layout.hasBlame) {
    return (
      <div style={rootStyle}>
        <svg width="100%" height="100%" viewBox="0 0 800 600" style={{ display: "block" }}>
          <text
            x={400}
            y={300}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={font.sans}
            fontSize={font.size.xl}
            fill={tokenColor.text3}
          >
            Blame data not available
          </text>
          {/* Title */}
          <g style={{ pointerEvents: "none" }}>
            <text x={16} y={18} dominantBaseline="hanging"
              fontFamily={font.sans} fontSize={font.size.md}
              fontWeight={font.weight.semibold} fill={tokenColor.text0}>
              Author Territory
            </text>
            <text x={16} y={36} dominantBaseline="hanging"
              fontFamily={font.sans} fontSize={font.size.xs} fill={tokenColor.text2}>
              ownership map by last edit
            </text>
          </g>
        </svg>
      </div>
    );
  }

  const { groups } = layout;
  const hoveredFile = hoveredFileId ? fileById.get(hoveredFileId) : null;

  // Determine which authors are highlighted
  const activeAuthor = hoveredAuthor ?? (hoveredFile?.author ?? null);

  return (
    <div
      style={rootStyle}
      ref={(el) => {
        if (el) {
          const { width, height } = el.getBoundingClientRect();
          if (width > 0 && height > 0 && (width !== dims.w || height !== dims.h)) {
            setDims({ w: Math.floor(width), h: Math.floor(height) });
          }
        }
      }}
    >
      <svg
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        style={svgStyle}
        role="img"
        aria-label="Author Territory — ownership map by last edit"
      >
        {/* 1. Backdrop */}
        <rect
          x={0} y={0} width={dims.w} height={dims.h}
          fill="transparent"
          onClick={handleBackdrop}
          style={{ cursor: onDismiss ? "default" : "inherit" }}
        />

        {/* 2+3. Territory fills and borders */}
        {groups.map((g) => {
          const dimmed = activeAuthor !== null && activeAuthor !== g.author;
          return (
            <g key={`territory-${g.author}`} style={{ pointerEvents: "none" }}>
              <rect
                x={g.territory.x}
                y={g.territory.y}
                width={g.territory.w}
                height={g.territory.h}
                fill={hexWithAlpha(g.color, dimmed ? 0.03 : 0.08)}
                stroke={hexWithAlpha(g.color, dimmed ? 0.12 : 0.32)}
                strokeWidth={1.5}
                rx={3}
                style={{ transition: "fill 150ms, stroke 150ms" }}
              />
            </g>
          );
        })}

        {/* 4+5+6. File rectangles, labels, pulse rings */}
        {groups.map((g) => {
          const groupDimmed = activeAuthor !== null && activeAuthor !== g.author;
          return (
            <g key={`files-${g.author}`}>
              {g.files.map((f) => {
                const fileDimmed = hoveredFileId !== null && hoveredFileId !== f.fileId;
                const fileHovered = hoveredFileId === f.fileId;
                const opacity = groupDimmed
                  ? 0.15
                  : fileDimmed
                  ? 0.4
                  : 1;
                const isRecent = f.ageMs < ONE_WEEK_MS;
                const showLabel = f.loc > 100 && f.w > 30 && f.h > 14;

                return (
                  <g
                    key={`file-${f.fileId}`}
                    onMouseEnter={() => handleFileEnter(f.fileId)}
                    onMouseLeave={handleFileLeave}
                    onClick={() => handleFileClick(f.fileId)}
                    tabIndex={0}
                    role="button"
                    aria-label={f.fileName}
                    style={{ cursor: "pointer", outline: "none" }}
                  >
                    <rect
                      x={f.x + 1}
                      y={f.y + 1}
                      width={Math.max(2, f.w - 2)}
                      height={Math.max(2, f.h - 2)}
                      fill={f.color}
                      opacity={opacity}
                      stroke={fileHovered ? "#ffffff" : hexWithAlpha(g.color, 0.4)}
                      strokeWidth={fileHovered ? 1.5 : 0.5}
                      rx={2}
                      style={{ transition: "opacity 120ms, stroke 120ms" }}
                    />

                    {/* Age pulse ring for files < 1 week old */}
                    {isRecent && !groupDimmed && (
                      <circle
                        className="at-pulse-ring"
                        cx={f.x + f.w / 2}
                        cy={f.y + f.h / 2}
                        r={Math.min(f.w, f.h) / 2 - 2}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        style={{ pointerEvents: "none" }}
                      />
                    )}

                    {/* File name label */}
                    {showLabel && (
                      <text
                        x={f.x + f.w / 2}
                        y={f.y + f.h / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily={font.sans}
                        fontSize={Math.min(font.size.xs, f.h * 0.35)}
                        fill="#ffffff"
                        opacity={opacity * 0.9}
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {truncate(f.fileName, Math.max(3, Math.floor(f.w / 6)))}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 7. Author territory labels */}
        {groups.map((g) => {
          const dimmed = activeAuthor !== null && activeAuthor !== g.author;
          const cx = g.territory.x + g.territory.w / 2;
          const labelY = g.territory.y + 14;
          const showSub = g.territory.h > 48;

          return (
            <g
              key={`label-${g.author}`}
              onMouseEnter={() => setHoveredAuthor(g.author)}
              onMouseLeave={() => setHoveredAuthor(null)}
              style={{ pointerEvents: "all", cursor: "default" }}
            >
              <text
                x={cx}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontFamily={font.sans}
                fontSize={font.size.sm}
                fontWeight={font.weight.semibold}
                fill={g.color}
                opacity={dimmed ? 0.25 : 1}
                style={{ transition: "opacity 150ms", userSelect: "none" }}
              >
                {truncate(g.author, 18)}
              </text>
              {showSub && (
                <text
                  x={cx}
                  y={labelY + 16}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontFamily={font.sans}
                  fontSize={font.size.xs}
                  fill={tokenColor.text2}
                  opacity={dimmed ? 0.2 : 0.85}
                  style={{ transition: "opacity 150ms", userSelect: "none" }}
                >
                  {g.files.length} files · {kLoc(g.totalLoc)}
                </text>
              )}
            </g>
          );
        })}

        {/* 8. Tooltip */}
        {hoveredFile && (() => {
          const { tx, ty } = tooltipPos(hoveredFile);
          const daysAgo = formatAge(hoveredFile.ageMs);
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={tx} y={ty}
                width={TOOLTIP_W} height={TOOLTIP_H}
                rx={TOOLTIP_R} ry={TOOLTIP_R}
                fill={tokenColor.bg0}
                stroke={tokenColor.border}
                strokeWidth={1}
                filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))"
              />
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 2}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.md}
                fontWeight={font.weight.semibold} fill={tokenColor.text0}>
                {truncate(hoveredFile.fileName, 22)}
              </text>
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 19}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs}
                fill={tokenColor.text2}>
                {hoveredFile.author}
              </text>
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 34}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs}
                fill={tokenColor.text2}>
                last edited {daysAgo}
              </text>
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 49}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs}
                fill={
                  hoveredFile.riskScore >= 70
                    ? tokenColor.danger
                    : hoveredFile.riskScore >= 40
                    ? tokenColor.warn
                    : tokenColor.success
                }>
                risk {hoveredFile.riskScore}
              </text>
            </g>
          );
        })()}

        {/* 9. Title + subtitle */}
        <g style={{ pointerEvents: "none" }}>
          <text x={16} y={18} dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.md}
            fontWeight={font.weight.semibold} fill={tokenColor.text0}>
            Author Territory
          </text>
          <text x={16} y={36} dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.xs}
            fill={tokenColor.text2}>
            ownership map by last edit
          </text>
        </g>
      </svg>

      {/* 10. Legend (HTML overlay at bottom) */}
      <div
        style={{
          position: "absolute",
          bottom: space[3],
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexWrap: "wrap",
          gap: space[1],
          justifyContent: "center",
          maxWidth: "90%",
          pointerEvents: "auto",
          opacity: mounted ? 1 : 0,
          transition: `opacity ${ENTRY_MS}ms ease-out`,
        }}
      >
        {groups.map((g) => (
          <LegendChip
            key={`chip-${g.author}`}
            group={g}
            hovered={hoveredAuthor === g.author}
            onEnter={() => setHoveredAuthor(g.author)}
            onLeave={() => setHoveredAuthor(null)}
          />
        ))}
      </div>
    </div>
  );
}

export const AuthorTerritoryView = memo(AuthorTerritoryViewImpl);
