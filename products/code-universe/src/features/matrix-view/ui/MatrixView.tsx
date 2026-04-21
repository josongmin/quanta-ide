// MatrixView — top-level SVG renderer for the DSM (matrix) mode.
// --------------------------------------------------------------------
// Consumes a `MatrixLayout` (origin at 0,0 with `labelGutter` of blank
// space top + left) and paints a full-viewport SVG. z-order, bottom to
// top:
//   1. Full-size transparent backdrop (click-outside → dismiss)
//   2. Group-background stripes (faint alternating panels — makes the
//      block structure readable even on sparse workspaces)
//   3. Filled cells
//   4. Group divider hairlines
//   5. Crosshair highlight (row-band + col-band for the hovered row)
//   6. Row labels (left) + col labels (top, rotated -90°)
//   7. Overflow caption at the bottom if layout.overflow > 0
//
// Interactions:
//   - Hover cell: fires `onHover`, which is used internally to tint
//     the row + col labels and track the native tooltip target.
//   - Hover row label OR col label: same crosshair highlight as
//     hovering a cell on that axis.
//   - Click cell: `onFocusEdge({ fromId, toId })` — parent flips to
//     mind-map mode with that edge highlighted.
//   - Click row label: `onFocusEntity(id)` — jumps to entity detail.
//   - Click backdrop: `onDismiss()`.
//
// Empty state:
//   - layout.rows.length === 0 → centred "No entities to matrix"
//     message. No grid is drawn.
//   - layout.overflow > 0 → bottom caption below the grid.

import { memo, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import type {
  MatrixCell as MatrixCellModel,
  MatrixLayout,
} from "../model/types";
import { MatrixCell } from "./MatrixCell";

export interface MatrixViewProps {
  layout: MatrixLayout & { overflow: number };
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onFocusEdge?: (edge: { fromId: string; toId: string }) => void;
  onDismiss?: () => void;
}

const ENTRY_MS = 280;

function MatrixViewImpl({
  layout,
  width,
  height,
  onFocusEntity,
  onFocusEdge,
  onDismiss,
}: MatrixViewProps) {
  const [mounted, setMounted] = useState(false);
  // Separate hover states — a row-label hover doesn't own a cell, and
  // a cell hover should light up BOTH row and col. We track the axis
  // indices rather than the cell itself so the highlight logic
  // doesn't need to look the cell up again.
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [hoverCellId, setHoverCellId] = useState<string | null>(null);

  // Fade-in on mount — same cadence as the chord view so the two
  // swap without a jolt.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const { rows, cells, cellSize, labelGutter, groupBoundaries, overflow } =
    layout;

  const matrixSize = rows.length * cellSize;
  const gridOriginX = labelGutter;
  const gridOriginY = labelGutter;

  const handleBackdropClick = useCallback(() => onDismiss?.(), [onDismiss]);

  const handleCellHover = useCallback((cell: MatrixCellModel | null) => {
    if (cell === null) {
      setHoverRow(null);
      setHoverCol(null);
      setHoverCellId(null);
      return;
    }
    setHoverRow(cell.row);
    setHoverCol(cell.col);
    setHoverCellId(cell.id);
  }, []);

  const handleCellClick = useCallback(
    (edge: { fromId: string; toId: string }) => {
      onFocusEdge?.(edge);
    },
    [onFocusEdge],
  );

  const handleRowLabelHover = useCallback((idx: number | null) => {
    setHoverRow(idx);
    setHoverCol(null);
    setHoverCellId(null);
  }, []);
  const handleColLabelHover = useCallback((idx: number | null) => {
    setHoverCol(idx);
    setHoverRow(null);
    setHoverCellId(null);
  }, []);

  const handleRowLabelClick = useCallback(
    (id: string) => onFocusEntity?.(id),
    [onFocusEntity],
  );

  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // Empty state renders a single centred message and nothing else.
  if (rows.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", userSelect: "none", background: "transparent" }}
        role="img"
        aria-label="Matrix (DSM) view — empty"
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={handleBackdropClick}
        />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={font.sans}
          fontSize={font.size.md}
          fill={tokenColor.text2}
        >
          No entities to matrix
        </text>
      </svg>
    );
  }

  // Group-background stripes: alternating very-light panels behind
  // the cells so long groups are easier to track visually. Each run
  // from `groupBoundaries[i]` to `groupBoundaries[i+1]` (or end) is
  // one panel — alternating every other group.
  const groupStripes = (() => {
    const out: { x: number; y: number; size: number; alt: boolean }[] = [];
    for (let i = 0; i < groupBoundaries.length; i++) {
      const start = groupBoundaries[i]!;
      const end = groupBoundaries[i + 1] ?? rows.length;
      const sizePx = (end - start) * cellSize;
      out.push({
        x: gridOriginX + start * cellSize,
        y: gridOriginY + start * cellSize,
        size: sizePx,
        alt: i % 2 === 1,
      });
    }
    return out;
  })();

  const axisHovered = hoverRow !== null || hoverCol !== null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", userSelect: "none", background: "transparent" }}
      role="img"
      aria-label="Matrix (DSM) view"
    >
      {/* Backdrop — transparent, full-viewport, captures click-outside. */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onClick={handleBackdropClick}
        style={{ cursor: onDismiss ? "default" : "inherit" }}
      />

      <g className="matrix-root" style={rootStyle}>
        {/* 1. Group-background stripes — only on the matrix area. */}
        {groupStripes.map((s, i) => (
          <rect
            key={`stripe-${i}`}
            x={s.x}
            y={s.y}
            width={s.size}
            height={s.size}
            fill={s.alt ? tokenColor.bg3 : tokenColor.bg2}
            pointerEvents="none"
          />
        ))}

        {/* 2. Diagonal backing — a hairline so the eye tracks i==j even
            on sparse diagonals. */}
        <line
          x1={gridOriginX}
          y1={gridOriginY}
          x2={gridOriginX + matrixSize}
          y2={gridOriginY + matrixSize}
          stroke={tokenColor.border}
          strokeWidth={0.5}
          pointerEvents="none"
        />

        {/* 3. Cells. Skip empty — only filled cells allocate DOM nodes. */}
        {cells.map(cell => {
          const fromRow = rows[cell.row];
          const toRow = rows[cell.col];
          if (!fromRow || !toRow) return null;
          const isOnCrosshair =
            (hoverRow !== null && cell.row === hoverRow) ||
            (hoverCol !== null && cell.col === hoverCol);
          return (
            <MatrixCell
              key={cell.id}
              cell={cell}
              x={gridOriginX + cell.col * cellSize}
              y={gridOriginY + cell.row * cellSize}
              cellSize={cellSize}
              color={fromRow.groupColor}
              fromLabel={fromRow.label}
              toLabel={toRow.label}
              highlighted={hoverCellId === cell.id || isOnCrosshair}
              onClick={handleCellClick}
              onHover={handleCellHover}
            />
          );
        })}

        {/* 4. Group divider hairlines — skip 0 (outer edge reads as a
            border, not a divider). Both horizontal + vertical since the
            matrix is square and the dividers apply on both axes. */}
        {groupBoundaries
          .filter(b => b > 0)
          .map(b => (
            <g key={`divider-${b}`} pointerEvents="none">
              <line
                x1={gridOriginX + b * cellSize}
                y1={gridOriginY}
                x2={gridOriginX + b * cellSize}
                y2={gridOriginY + matrixSize}
                stroke={tokenColor.borderStrong}
                strokeWidth={0.75}
              />
              <line
                x1={gridOriginX}
                y1={gridOriginY + b * cellSize}
                x2={gridOriginX + matrixSize}
                y2={gridOriginY + b * cellSize}
                stroke={tokenColor.borderStrong}
                strokeWidth={0.75}
              />
            </g>
          ))}

        {/* 5. Crosshair highlight — a translucent band across the whole
            row + column for the hovered index. Drawn ABOVE cells so
            the band tint layers over them. */}
        {hoverRow !== null && (
          <rect
            x={gridOriginX}
            y={gridOriginY + hoverRow * cellSize}
            width={matrixSize}
            height={cellSize}
            fill={tokenColor.accent}
            fillOpacity={0.08}
            pointerEvents="none"
          />
        )}
        {hoverCol !== null && (
          <rect
            x={gridOriginX + hoverCol * cellSize}
            y={gridOriginY}
            width={cellSize}
            height={matrixSize}
            fill={tokenColor.accent}
            fillOpacity={0.08}
            pointerEvents="none"
          />
        )}

        {/* 6a. Row labels — on the left, text anchored to the right so
            long names truncate toward the grid. */}
        {rows.map(row => {
          const active =
            hoverRow === row.index || hoverCol === row.index;
          const dim = axisHovered && !active;
          return (
            <g
              key={`rlabel-${row.id}`}
              transform={`translate(${gridOriginX - 8}, ${gridOriginY + row.index * cellSize + cellSize / 2})`}
              onMouseEnter={() => handleRowLabelHover(row.index)}
              onMouseLeave={() => handleRowLabelHover(null)}
              onClick={() => handleRowLabelClick(row.id)}
              style={{ cursor: onFocusEntity ? "pointer" : "default" }}
            >
              <title>
                {row.label} — {row.groupLabel || "(ungrouped)"}
              </title>
              {/* Invisible widened hit target. */}
              <rect
                x={-(labelGutter - 4)}
                y={-cellSize / 2}
                width={labelGutter - 4}
                height={cellSize}
                fill="transparent"
              />
              <text
                textAnchor="end"
                dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={font.size.xs}
                fontWeight={active ? font.weight.semibold : font.weight.regular}
                fill={
                  dim
                    ? tokenColor.text3
                    : active
                    ? tokenColor.text0
                    : tokenColor.text1
                }
                pointerEvents="none"
                style={{
                  // CSS truncation — a browser-native fallback when
                  // the name exceeds the gutter width. SVG <text>
                  // doesn't honour text-overflow directly, so we use
                  // a `textLength`-less approach and accept overflow
                  // visually for unusual names; the native <title>
                  // tooltip carries the full label.
                }}
              >
                <tspan>{row.label}</tspan>
              </text>
              {/* Group colour indicator — 3px dot to the left of the
                  label so dense groupings read as banded even before
                  hover. Positioned outside the text's textAnchor=end
                  bounding box. */}
              <circle
                cx={-(labelGutter - 12)}
                cy={0}
                r={2.5}
                fill={row.groupColor}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {/* 6b. Column labels — rotated -90° at the top. Same truncation
            treatment as rows; rotated group-colour dot sits closer to
            the grid. */}
        {rows.map(row => {
          const active =
            hoverCol === row.index || hoverRow === row.index;
          const dim = axisHovered && !active;
          const cx = gridOriginX + row.index * cellSize + cellSize / 2;
          const cy = gridOriginY - 8;
          return (
            <g
              key={`clabel-${row.id}`}
              transform={`translate(${cx}, ${cy}) rotate(-90)`}
              onMouseEnter={() => handleColLabelHover(row.index)}
              onMouseLeave={() => handleColLabelHover(null)}
              onClick={() => handleRowLabelClick(row.id)}
              style={{ cursor: onFocusEntity ? "pointer" : "default" }}
            >
              <title>
                {row.label} — {row.groupLabel || "(ungrouped)"}
              </title>
              <rect
                x={0}
                y={-cellSize / 2}
                width={labelGutter - 4}
                height={cellSize}
                fill="transparent"
              />
              <text
                textAnchor="start"
                dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={font.size.xs}
                fontWeight={active ? font.weight.semibold : font.weight.regular}
                fill={
                  dim
                    ? tokenColor.text3
                    : active
                    ? tokenColor.text0
                    : tokenColor.text1
                }
                pointerEvents="none"
              >
                <tspan>{row.label}</tspan>
              </text>
              <circle
                cx={labelGutter - 12}
                cy={0}
                r={2.5}
                fill={row.groupColor}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {/* 7. Overflow caption. */}
        {overflow > 0 && (
          <text
            x={gridOriginX + matrixSize / 2}
            y={gridOriginY + matrixSize + 24}
            textAnchor="middle"
            dominantBaseline="hanging"
            fontFamily={font.sans}
            fontSize={font.size.xs}
            fill={tokenColor.text2}
          >
            +{overflow} more entities trimmed by connectivity rank
          </text>
        )}
      </g>
    </svg>
  );
}

export const MatrixView = memo(MatrixViewImpl);
