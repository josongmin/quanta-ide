// MatrixCell — one filled cell in the DSM grid.
// --------------------------------------------------------------------
// Memoised so hover/selection state changes on a neighbouring cell
// don't force every cell to re-render. The parent `MatrixView` already
// skips empty cells entirely, so a 200×200 matrix with 2 000 filled
// cells boils down to 2 000 memoised <MatrixCell> nodes — comfortable
// for React.
//
// Painting:
//   - Base fill = `color` (the row's group colour) at opacity derived
//     from weight. Solo imports land in the low end (0.32); hot paths
//     with high call count / repeated imports approach full opacity
//     (0.95). The mapping uses a sqrt curve so low weights still read
//     as a presence signal while the high end flattens out.
//   - `crossGroup` adds a thin darker stroke — turns the cell into a
//     slightly sharper square so inter-package coupling pops over
//     intra-package density blocks.
//   - `bidirectional` overlays a tiny diagonal line across the cell:
//     a "╲" mark sitting on top of the fill. Cycles are newsworthy —
//     make sure they never hide in the grid.
//   - `highlighted` bumps the fill to full opacity + gives the stroke
//     a visible weight. Used for crosshair hover in the parent.

import { memo, useCallback, type CSSProperties } from "react";
import type { MatrixCell as MatrixCellModel } from "../model/types";

export interface MatrixCellProps {
  cell: MatrixCellModel;
  /** Origin-relative x/y of the cell's top-left corner, in SVG px. */
  x: number;
  y: number;
  cellSize: number;
  /** Group colour of the ROW this cell sits on. Cells take their
   *  identity from the "from" end — same colour as the row label. */
  color: string;
  /** Label of the source row, shown in native tooltips. */
  fromLabel: string;
  /** Label of the destination row, shown in native tooltips. */
  toLabel: string;
  /** Matches the "on crosshair" / selected state from the parent. */
  highlighted?: boolean;
  onClick?: (edge: { fromId: string; toId: string }) => void;
  onHover?: (cell: MatrixCellModel | null) => void;
}

function MatrixCellImpl({
  cell,
  x,
  y,
  cellSize,
  color,
  fromLabel,
  toLabel,
  highlighted,
  onClick,
  onHover,
}: MatrixCellProps) {
  const onClickHandler = useCallback(() => {
    onClick?.({ fromId: cell.fromId, toId: cell.toId });
  }, [cell.fromId, cell.toId, onClick]);

  const onEnter = useCallback(() => onHover?.(cell), [cell, onHover]);
  const onLeave = useCallback(() => onHover?.(null), [onHover]);

  // Weight → opacity. sqrt keeps mid-weights visually distinct from
  // single-import cells; cap at 0.95 so the grid never looks like a
  // solid block.
  const rawOpacity = 0.32 + 0.63 * Math.min(1, Math.sqrt(cell.weight) / 3);
  const fillOpacity = highlighted ? 1 : rawOpacity;

  // Cross-group cells get a slightly denser look — we simulate
  // "1.15x saturation + darker border" by darkening the stroke slot
  // instead of trying to blend in SVG (SVG has no stroke/fill
  // saturation mode). The darker 1 px stroke on a small cell reads as
  // sharpness, which is the intent.
  const strokeColor = cell.crossGroup ? "#1a1a1a" : "rgba(0,0,0,0.18)";
  const strokeWidth = highlighted ? 1.5 : cell.crossGroup ? 0.75 : 0.4;

  const style: CSSProperties = {
    cursor: onClick ? "pointer" : "default",
    transition: "fill-opacity 120ms ease-out",
  };

  const title = `${fromLabel} → ${toLabel}  weight=${cell.weight}${cell.bidirectional ? "  [cyclic]" : ""}`;

  // Bidirectional glyph — a thin diagonal from (x+1, y+size-1) to
  // (x+size-1, y+1), i.e. a "╱" overlay. Stays visible even on dark
  // fills because the stroke is a semi-transparent white.
  const diagPad = Math.max(1, cellSize * 0.15);

  return (
    <g
      data-cell-id={cell.id}
      onClick={onClickHandler}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={style}
    >
      <title>{title}</title>
      <rect
        x={x}
        y={y}
        width={cellSize}
        height={cellSize}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        shapeRendering="crispEdges"
      />
      {cell.bidirectional && (
        <line
          x1={x + diagPad}
          y1={y + cellSize - diagPad}
          x2={x + cellSize - diagPad}
          y2={y + diagPad}
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth={Math.max(0.75, cellSize * 0.12)}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
    </g>
  );
}

export const MatrixCell = memo(MatrixCellImpl);
