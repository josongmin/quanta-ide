// Tapered bezier as a filled SVG path
// --------------------------------------------------------------------
// The mind-map renders edges as variable-width ribbons — thick near the
// centre, thinning out at the leaf — so the eye reads the direction of
// relationship without needing arrowheads. A plain SVG `<path>` with
// `stroke-width` is a constant, so we emit the ribbon as a CLOSED FILLED
// polygon that brackets a cubic bezier with two offset curves.
//
// Why cubic bezier + straight-line offsets:
//   - Cubic gives us enough curvature control (one parameter `curvature`)
//     to make edges billow consistently away from siblings without a
//     full layout solver.
//   - Two control points on the same side of the P0→P1 line push the
//     curve in a predictable arc.
//   - Sampling the bezier at N steps and connecting offset points with
//     straight `L` segments is smooth enough at N=32 that the visual
//     difference from a true parallel-curve is sub-pixel. Avoiding
//     analytic offset-curves (which don't have a clean bezier form)
//     keeps this a 30-line utility instead of a 300-line geometry lib.

export interface TaperedPathOpts {
  /** Source point. */
  x0: number;
  y0: number;
  /** Target point. */
  x1: number;
  y1: number;
  /** Half-width at source / target (stroke will be 2x this visually). */
  w0: number;
  w1: number;
  /** Bezier curvature — how far the control points sit off the straight
   *  line joining P0→P1. Range ~0.1 (near-straight) → 0.5 (billowy).
   *  Default 0.25. */
  curvature?: number;
  /** Number of sample points along the curve. More = smoother, slower.
   *  Default 32. */
  steps?: number;
}

// Cubic bezier position at parameter t.
function cubic(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// Cubic bezier derivative at parameter t (unnormalised tangent).
function cubicDeriv(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const u = 1 - t;
  return (
    3 * u * u * (p1 - p0) +
    6 * u * t * (p2 - p1) +
    3 * t * t * (p3 - p2)
  );
}

/** Smoothstep easing — makes the taper look organic instead of linear. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Format a number with limited precision so the path string stays small
 *  and cache-friendly without visible sub-pixel jitter. */
function f(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * Returns the cubic bezier spine path (same control points as taperedPathD)
 * as an SVG path string. Use to draw a centerline highlight or gradient
 * reference line over the ribbon.
 */
export function taperedSpineD(opts: Pick<TaperedPathOpts, "x0" | "y0" | "x1" | "y1" | "curvature">): string {
  const { x0, y0, x1, y1 } = opts;
  const curvature = opts.curvature ?? 0.25;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return "";

  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;
  const off = curvature * dist;

  const cx0 = x0 + ux * (dist / 3) + nx * off;
  const cy0 = y0 + uy * (dist / 3) + ny * off;
  const cx1 = x0 + ux * (2 * dist / 3) + nx * off;
  const cy1 = y0 + uy * (2 * dist / 3) + ny * off;

  return `M${f(x0)},${f(y0)} C${f(cx0)},${f(cy0)} ${f(cx1)},${f(cy1)} ${f(x1)},${f(y1)}`;
}

export function taperedPathD(opts: TaperedPathOpts): string {
  const { x0, y0, x1, y1, w0, w1 } = opts;
  const curvature = opts.curvature ?? 0.25;
  const steps = opts.steps ?? 32;

  // Degenerate: both ends below visible-width threshold.
  if (w0 < 0.5 && w1 < 0.5) {
    return "";
  }

  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);

  // Degenerate: endpoints coincident.
  if (dist < 0.001) {
    return "";
  }

  // Unit direction along P0→P1.
  const ux = dx / dist;
  const uy = dy / dist;
  // Unit normal (rotate +90° in screen coords: x'=-y, y'=x).
  const nx = -uy;
  const ny = ux;

  // Control points offset perpendicular to the straight line, BOTH on
  // the same side so the curve billows consistently.
  const off = curvature * dist;
  const cx0 = x0 + ux * (dist / 3) + nx * off;
  const cy0 = y0 + uy * (dist / 3) + ny * off;
  const cx1 = x0 + ux * (2 * dist / 3) + nx * off;
  const cy1 = y0 + uy * (2 * dist / 3) + ny * off;

  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = cubic(x0, cx0, cx1, x1, t);
    const py = cubic(y0, cy0, cy1, y1, t);

    // Tangent → normal (rotate +90°).
    const tx = cubicDeriv(x0, cx0, cx1, x1, t);
    const ty = cubicDeriv(y0, cy0, cy1, y1, t);
    const tlen = Math.hypot(tx, ty) || 1;
    const nxT = -ty / tlen;
    const nyT = tx / tlen;

    // Smoothstep-eased half-width interpolation.
    const e = smoothstep(t);
    const w = w0 * (1 - e) + w1 * e;

    top.push([px + nxT * w, py + nyT * w]);
    bottom.push([px - nxT * w, py - nyT * w]);
  }

  // Build closed path: M top[0] L top[1..N] L bottom[N..0] Z.
  let d = `M${f(top[0][0])},${f(top[0][1])}`;
  for (let i = 1; i <= steps; i++) {
    d += `L${f(top[i][0])},${f(top[i][1])}`;
  }
  for (let i = steps; i >= 0; i--) {
    d += `L${f(bottom[i][0])},${f(bottom[i][1])}`;
  }
  d += "Z";
  return d;
}
