// AuthorTerritoryView — SVG renderer for the Author Territory map.
// --------------------------------------------------------------------
// Renders each author as a large colored territory containing per-file
// nested rectangles. Color encodes authorship; darkness encodes age.
//
// Z-order (bottom to top):
//   1. Backdrop (click → onDismiss)
//   2. Territory fills + borders ("grout" style with bg0 baseline)
//   3. File rectangles (min 3×3px, 0.5px inner border)
//   4. Recent-edit pulse rings (< 7 days, amber animated ring)
//   5. File name labels (width > 48px AND height > 20px, max 10 chars)
//   6. Author territory labels (name + subtitle, centered)
//   7. Tooltip (rich: path, author dot, age, risk bar)
//   8. Title + subtitle + ownership concentration chip (top-left)
//   9. Legend chips (bottom — clickable, dims others to 0.3)
//  10. Empty state

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as tokenRadius,
  space,
  transition,
} from "../../../shared/ui/tokens";
import { buildAuthorTerritoryLayout } from "../model/build-author-territory-layout";
import type { AuthorFile, AuthorGroup } from "../model/types";

export interface AuthorTerritoryViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────
const ENTRY_MS = 250;
const STAGGER_MS = 80;
const TOOLTIP_W = 210;
const TOOLTIP_H = 96;
const TOOLTIP_PAD = 8;
const TOOLTIP_R = 6;
const RISK_BAR_W = 80;
const RISK_BAR_H = 5;
const ONE_WEEK_MS = 7 * 24 * 3600 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  // Handles both 3-digit and 6-digit hex
  let clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Relative luminance (0..1) for a hex color. */
function luminance(hex: string): number {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function textColorForBg(hex: string): string {
  return luminance(hex) > 0.35 ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.85)";
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

function riskFill(risk: number): string {
  const hue = Math.round(120 - risk * 1.2);
  return `hsl(${hue}, 65%, 50%)`;
}

// ── Inject once-per-lifetime keyframes ───────────────────────────────

function injectKeyframes(): void {
  const id = "author-territory-kf";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes atFadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes recentPulse {
      0%,100% { opacity: 0.6; }
      50%     { opacity: 0; }
    }
    .at-pulse-ring {
      animation: recentPulse 1.8s ease-out infinite;
    }
  `;
  document.head.appendChild(style);
}

// ── Legend chip ───────────────────────────────────────────────────────

interface LegendChipProps {
  group: AuthorGroup;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
  onEnter: () => void;
  onLeave: () => void;
}

function LegendChip({ group, active, dimmed, onClick, onEnter, onLeave }: LegendChipProps) {
  const chipStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
    padding: `${space[0]}px ${space[2]}px`,
    borderRadius: tokenRadius.pill,
    background: active ? hexWithAlpha(group.color, 0.14) : "transparent",
    border: active
      ? `1px solid ${hexWithAlpha(group.color, 0.55)}`
      : `1px solid transparent`,
    cursor: "pointer",
    transition: `background ${transition.fast}, border-color ${transition.fast}, opacity ${transition.fast}`,
    opacity: dimmed ? 0.4 : 1,
    userSelect: "none",
  };
  const dotStyle: CSSProperties = {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: group.color,
    flexShrink: 0,
  };
  const textStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.medium,
    color: tokenColor.text1,
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={chipStyle}
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    >
      <div style={dotStyle} />
      <span style={textStyle}>{truncate(group.author, 14)}</span>
    </div>
  );
}

// ── Ownership concentration header chip ───────────────────────────────

interface ConcentrationChipProps {
  groups: AuthorGroup[];
  totalLoc: number;
}

function ConcentrationChip({ groups, totalLoc }: ConcentrationChipProps) {
  if (groups.length === 0 || totalLoc === 0) return null;

  const top = groups.reduce((a, b) => (a.totalLoc > b.totalLoc ? a : b));
  const pct = Math.round((top.totalLoc / totalLoc) * 100);

  if (pct < 70) {
    // Multiple authors, just show top two
    const sorted = [...groups].sort((a, b) => b.totalLoc - a.totalLoc).slice(0, 2);
    const chipStyle: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: space[1],
      padding: `1px ${space[2]}px`,
      borderRadius: tokenRadius.pill,
      background: tokenColor.bg3,
      border: `1px solid ${tokenColor.border}`,
    };
    return (
      <g style={{ pointerEvents: "none" }}>
        <foreignObject x={16} y={52} width={240} height={22}>
          <div style={chipStyle}>
            {sorted.map((g) => (
              <span key={g.author} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: g.color,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontFamily: font.sans, fontSize: font.size.xs, color: tokenColor.text1 }}>
                  {truncate(g.author, 10)}
                </span>
              </span>
            ))}
            <span style={{ fontFamily: font.sans, fontSize: font.size.xs, color: tokenColor.text2 }}>
              shared ownership
            </span>
          </div>
        </foreignObject>
      </g>
    );
  }

  const chipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: space[1],
    padding: `1px ${space[2]}px`,
    borderRadius: tokenRadius.pill,
    background: "rgba(251,191,36,0.12)",
    border: "1px solid rgba(251,191,36,0.4)",
  };

  return (
    <g style={{ pointerEvents: "none" }}>
      <foreignObject x={16} y={52} width={260} height={22}>
        <div style={chipStyle}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: top.color,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: font.sans,
              fontSize: font.size.xs,
              color: "#92400e",
              fontWeight: font.weight.semibold,
            }}
          >
            {truncate(top.author, 12)} owns {pct}% of LoC
          </span>
        </div>
      </foreignObject>
    </g>
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
  const [focusedAuthor, setFocusedAuthor] = useState<string | null>(null);
  const [hoverAuthorPreview, setHoverAuthorPreview] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    injectKeyframes();
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  const layout = useMemo(
    () => buildAuthorTerritoryLayout({ graph, width: dims.w, height: dims.h }),
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

  const toggleFocusAuthor = useCallback((author: string) => {
    setFocusedAuthor((prev) => (prev === author ? null : author));
  }, []);

  function tooltipPos(f: AuthorFile): { tx: number; ty: number } {
    const margin = 8;
    let tx = f.x + f.w / 2 - TOOLTIP_W / 2;
    let ty = f.y - TOOLTIP_H - 10;
    if (tx < margin) tx = margin;
    if (tx + TOOLTIP_W > dims.w - margin) tx = dims.w - margin - TOOLTIP_W;
    if (ty < margin) ty = f.y + f.h + 10;
    return { tx, ty };
  }

  const rootStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    animation: mounted ? undefined : "none",
  };

  const svgStyle: CSSProperties = {
    display: "block",
    userSelect: "none",
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(6px)",
    transition: `opacity ${ENTRY_MS}ms ease-out, transform ${ENTRY_MS}ms ease-out`,
  };

  // ── Empty state ─────────────────────────────────────────────────────
  if (!layout.hasBlame) {
    return (
      <div style={rootStyle}>
        <svg width="100%" height="100%" viewBox="0 0 800 600" style={{ display: "block" }}>
          <rect x={0} y={0} width={800} height={600} fill={tokenColor.bg1} />
          <text
            x={400} y={280}
            textAnchor="middle" dominantBaseline="central"
            fontFamily={font.sans} fontSize={font.size.xl}
            fontWeight={font.weight.semibold} fill={tokenColor.text2}
          >
            No blame data
          </text>
          <text
            x={400} y={304}
            textAnchor="middle" dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.sm}
            fill={tokenColor.text3}
          >
            Run `git blame` or connect a git provider to see authorship
          </text>
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

  const totalLoc = groups.reduce((acc, g) => acc + g.totalLoc, 0);

  const hoveredFile = hoveredFileId ? fileById.get(hoveredFileId) ?? null : null;

  // Active author: focused (legend click) > preview (legend hover) > hovered file
  const activeAuthor =
    focusedAuthor ?? hoverAuthorPreview ?? (hoveredFile?.author ?? null);

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
          fill={tokenColor.bg1}
          onClick={handleBackdrop}
          style={{ cursor: onDismiss ? "default" : "inherit" }}
        />

        {/* 2. Territory fills + 2px solid "grout" borders */}
        {groups.map((g, gi) => {
          const dimmed = activeAuthor !== null && activeAuthor !== g.author;
          const staggerDelay = gi * STAGGER_MS;
          return (
            <g
              key={`territory-${g.author}`}
              style={{
                pointerEvents: "none",
                opacity: mounted ? (dimmed ? 0.3 : 1) : 0,
                transition: `opacity 150ms ease-out`,
                animation: mounted
                  ? `atFadeUp ${ENTRY_MS}ms ${staggerDelay}ms ease-out both`
                  : undefined,
              }}
            >
              {/* Territory fill */}
              <rect
                x={g.territory.x}
                y={g.territory.y}
                width={g.territory.w}
                height={g.territory.h}
                fill={hexWithAlpha(g.color, 0.07)}
                rx={2}
              />
              {/* 2px solid border — color.bg0 acts as grout between tiles */}
              <rect
                x={g.territory.x + 1}
                y={g.territory.y + 1}
                width={g.territory.w - 2}
                height={g.territory.h - 2}
                fill="none"
                stroke={hexWithAlpha(g.color, 0.35)}
                strokeWidth={2}
                rx={2}
              />
            </g>
          );
        })}

        {/* 3+4+5. File rects, pulse rings, labels */}
        {groups.map((g, gi) => {
          const groupDimmed = activeAuthor !== null && activeAuthor !== g.author;
          const staggerDelay = gi * STAGGER_MS + 40;
          return (
            <g key={`files-${g.author}`}>
              {g.files.map((f) => {
                const fileHovered = hoveredFileId === f.fileId;
                const fileDimmed = hoveredFileId !== null && !fileHovered;
                const opacity = groupDimmed ? 0.15 : fileDimmed ? 0.4 : 1;
                const isRecent = f.ageMs < ONE_WEEK_MS;

                // Min visible size: 3×3px
                const fw = Math.max(3, f.w - 2);
                const fh = Math.max(3, f.h - 2);
                const fx = f.x + 1;
                const fy = f.y + 1;

                // Label: show only if width > 48 AND height > 20
                const showLabel = f.w > 48 && f.h > 20;
                const labelText = truncate(f.fileName, 10);
                const textFill = textColorForBg(f.color);

                return (
                  <g
                    key={`file-${f.fileId}`}
                    onMouseEnter={() => handleFileEnter(f.fileId)}
                    onMouseLeave={handleFileLeave}
                    onClick={() => handleFileClick(f.fileId)}
                    tabIndex={0}
                    role="button"
                    aria-label={f.fileName}
                    style={{
                      cursor: "pointer",
                      outline: "none",
                      opacity: mounted ? opacity : 0,
                      transition: `opacity ${transition.fast}`,
                      animation: mounted
                        ? `atFadeUp ${ENTRY_MS}ms ${staggerDelay}ms ease-out both`
                        : undefined,
                    }}
                  >
                    {/* File rect with 0.5px inner border */}
                    <rect
                      x={fx}
                      y={fy}
                      width={fw}
                      height={fh}
                      fill={f.color}
                      stroke={
                        fileHovered ? "#ffffff" : "rgba(0,0,0,0.1)"
                      }
                      strokeWidth={fileHovered ? 1.5 : 0.5}
                      rx={1}
                      style={{ transition: `stroke ${transition.fast}` }}
                    />

                    {/* Recent-edit glow ring (< 7 days) */}
                    {isRecent && !groupDimmed && fw > 4 && fh > 4 && (
                      <circle
                        className="at-pulse-ring"
                        cx={fx + fw / 2}
                        cy={fy + fh / 2}
                        r={Math.min(fw, fh) / 2 + 2}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={1.5}
                        style={{ pointerEvents: "none" }}
                      />
                    )}

                    {/* File label — max 10 chars, font.size.xs */}
                    {showLabel && (
                      <text
                        x={fx + fw / 2}
                        y={fy + fh / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily={font.sans}
                        fontSize={Math.min(font.size.xs, fh * 0.38)}
                        fill={textFill}
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {labelText}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 6. Author territory labels */}
        {groups.map((g) => {
          const dimmed = activeAuthor !== null && activeAuthor !== g.author;
          const cx = g.territory.x + g.territory.w / 2;
          const tooNarrow = g.territory.w < 80;
          if (tooNarrow) return null;

          const labelY = g.territory.y + 14;
          const showSub = g.territory.h > 52;

          return (
            <g
              key={`label-${g.author}`}
              onMouseEnter={() => setHoverAuthorPreview(g.author)}
              onMouseLeave={() => setHoverAuthorPreview(null)}
              style={{
                pointerEvents: "all",
                cursor: "default",
                opacity: dimmed ? 0.25 : 1,
                transition: `opacity 150ms`,
              }}
            >
              {/* Author name with text-shadow via filter */}
              <text
                x={cx}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontFamily={font.sans}
                fontSize={font.size.sm}
                fontWeight={font.weight.semibold}
                fill="#ffffff"
                filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
                style={{ userSelect: "none" }}
              >
                {truncate(g.author, 18)}
              </text>

              {/* Subtitle: N files · Xk LoC */}
              {showSub && (
                <text
                  x={cx}
                  y={labelY + 16}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontFamily={font.sans}
                  fontSize={font.size.xs}
                  fill={tokenColor.text2}
                  style={{ userSelect: "none" }}
                >
                  {g.files.length} files · {kLoc(g.totalLoc)}
                </text>
              )}
            </g>
          );
        })}

        {/* 7. Rich tooltip on file hover */}
        {hoveredFile && (() => {
          const { tx, ty } = tooltipPos(hoveredFile);
          const daysAgo = formatAge(hoveredFile.ageMs);
          const risk = hoveredFile.riskScore;
          const riskBarFill = riskFill(risk);
          const riskBarFilled = Math.round((risk / 100) * RISK_BAR_W);

          return (
            <g style={{ pointerEvents: "none" }}>
              {/* Tooltip background */}
              <rect
                x={tx} y={ty}
                width={TOOLTIP_W} height={TOOLTIP_H}
                rx={TOOLTIP_R} ry={TOOLTIP_R}
                fill={tokenColor.bg0}
                stroke={tokenColor.border}
                strokeWidth={1}
                filter="drop-shadow(0 4px 12px rgba(0,0,0,0.10))"
              />

              {/* Full path */}
              <text
                x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 2}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.md}
                fontWeight={font.weight.semibold} fill={tokenColor.text0}
              >
                {truncate(hoveredFile.fileName, 26)}
              </text>

              {/* Author name + colored dot */}
              <circle
                cx={tx + TOOLTIP_PAD + 4}
                cy={ty + TOOLTIP_PAD + 24}
                r={4}
                fill={hexWithAlpha(
                  // find parent group color
                  (() => {
                    const grp = layout.hasBlame
                      ? layout.groups.find((g) => g.author === hoveredFile.author)
                      : undefined;
                    return grp?.color ?? "#888";
                  })(),
                  1,
                )}
              />
              <text
                x={tx + TOOLTIP_PAD + 12} y={ty + TOOLTIP_PAD + 18}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs}
                fill={tokenColor.text1}
              >
                {hoveredFile.author}
              </text>

              {/* Last edited */}
              <text
                x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 36}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs}
                fill={tokenColor.text2}
              >
                Last edited: {daysAgo}
              </text>

              {/* Risk score bar */}
              <text
                x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 52}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs}
                fill={tokenColor.text2}
              >
                Risk
              </text>
              {/* Bar track */}
              <rect
                x={tx + TOOLTIP_PAD + 26}
                y={ty + TOOLTIP_PAD + 54}
                width={RISK_BAR_W}
                height={RISK_BAR_H}
                rx={2}
                fill={tokenColor.bg3}
              />
              {/* Bar fill */}
              <rect
                x={tx + TOOLTIP_PAD + 26}
                y={ty + TOOLTIP_PAD + 54}
                width={riskBarFilled}
                height={RISK_BAR_H}
                rx={2}
                fill={riskBarFill}
              />
              <text
                x={tx + TOOLTIP_PAD + 26 + RISK_BAR_W + 4}
                y={ty + TOOLTIP_PAD + 52}
                dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs}
                fontWeight={font.weight.semibold}
                fill={riskBarFill}
              >
                {risk}
              </text>
            </g>
          );
        })()}

        {/* 8. Title + subtitle + ownership chip */}
        <g style={{ pointerEvents: "none" }}>
          <text x={16} y={18} dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.md}
            fontWeight={font.weight.semibold} fill={tokenColor.text0}>
            Author Territory
          </text>
          <text x={16} y={36} dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.xs} fill={tokenColor.text2}>
            {groups.length} authors · {totalLoc > 0 ? (totalLoc / 1000).toFixed(1) : "0"}k LoC total
          </text>
        </g>
        {layout.hasBlame && (
          <ConcentrationChip groups={layout.groups} totalLoc={totalLoc} />
        )}
      </svg>

      {/* 9. Legend chips (HTML overlay at bottom) */}
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
        {groups.map((g) => {
          const isActive = focusedAuthor === g.author;
          const isDimmed = focusedAuthor !== null && focusedAuthor !== g.author;
          return (
            <LegendChip
              key={`chip-${g.author}`}
              group={g}
              active={isActive}
              dimmed={isDimmed}
              onClick={() => toggleFocusAuthor(g.author)}
              onEnter={() => setHoverAuthorPreview(g.author)}
              onLeave={() => setHoverAuthorPreview(null)}
            />
          );
        })}
      </div>
    </div>
  );
}

export const AuthorTerritoryView = memo(AuthorTerritoryViewImpl);
