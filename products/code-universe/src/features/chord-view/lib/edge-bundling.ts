// Hierarchical Edge Bundling (Holten 2006)
// --------------------------------------------------------------------
// Routes a curve between two leaves through the shared hierarchy path.
// Given each leaf's `pathFromRoot` (root → leaf control points), we
// construct the full "up-through-LCA and back down" polyline, then
// smooth with a cubic B-spline to produce a bundled curve. `beta` is
// the classic Holten strength — at beta=1 the curve hugs the hierarchy
// path; at beta=0 it snaps to the straight chord. 0.85 is the sweet
// spot.
//
// We use a Catmull-Rom → cubic-Bézier conversion under the hood because
// it's simpler to implement correctly than de Boor and produces the
// same visual family at comparable cost.

export interface BundlePathOpts {
  fromPath: readonly { x: number; y: number }[];  // leaf.pathFromRoot
  toPath:   readonly { x: number; y: number }[];
  /** Bundling strength in [0, 1]. 0 = straight line between endpoints;
   *  1 = curve hugs the hierarchy path exactly. Sweet spot ≈ 0.85 —
   *  edges bundle visibly but still drift toward their real targets
   *  so the eye can trace. */
  beta?: number;
  /** Sample count along the curve. Default 24. */
  steps?: number;
}

interface Pt { x: number; y: number; }

const DEFAULT_BETA = 0.85;
const DEFAULT_STEPS = 24;

export function bundlePathD(opts: BundlePathOpts): string {
  const beta = clamp01(opts.beta ?? DEFAULT_BETA);
  const steps = Math.max(1, opts.steps ?? DEFAULT_STEPS);

  const fromPath = opts.fromPath;
  const toPath = opts.toPath;
  if (fromPath.length === 0 || toPath.length === 0) return "";

  const fromLeaf = fromPath[fromPath.length - 1];
  const toLeaf = toPath[toPath.length - 1];
  if (!fromLeaf || !toLeaf) return "";
  // Degenerate: endpoints effectively coincident.
  if (dist(fromLeaf, toLeaf) < 1) return "";

  // Build the full control polyline: fromPath up to (not including)
  // its root, then toPath in reverse. Both paths share the same root
  // (origin); dropping the duplicate keeps the curve from pausing at
  // the root.
  //
  // Contract from `ChordLeaf.pathFromRoot`: index 0 is the root. Since
  // both leaves share the root we include `fromPath[0]` once, then
  // skip `toPath[last-1 .. 1]`'s root as we reverse.
  const controls: Pt[] = [];
  for (let i = 0; i < fromPath.length; i++) {
    const p = fromPath[i];
    if (p) controls.push({ x: p.x, y: p.y });
  }
  // Skip the first entry of the reversed toPath (= toPath[last]) would
  // double-count the leaf we *want* at the end; skip the *root* of the
  // reversed toPath (= toPath[0]) because we already have the root.
  // So: iterate toPath from length-1 down to 1, skipping index 0.
  for (let i = toPath.length - 1; i >= 1; i--) {
    const p = toPath[i];
    if (p) controls.push({ x: p.x, y: p.y });
  }
  // But we double-added the leaf on the from-side path above; actually
  // no: fromPath ends at fromLeaf, and the reversed toPath (iterating
  // length-1 .. 1) starts at toLeaf and ends at toPath[1]. The root
  // (toPath[0]) is excluded. So the polyline is fromRoot → ... →
  // fromLeaf → (traverse backward through toPath) → toLeaf.
  // This travels down the from-branch then back down the to-branch —
  // which is wrong semantically; we want:
  // fromLeaf → (up) fromParent → ... → root → ... → toParent → toLeaf.
  // So the correct order is REVERSED from what Holten describes when
  // iterating path[0]=root to path[last]=leaf. Rebuild:
  controls.length = 0;
  // From leaf up to (but excluding) root:
  for (let i = fromPath.length - 1; i >= 1; i--) {
    const p = fromPath[i];
    if (p) controls.push({ x: p.x, y: p.y });
  }
  // Root once:
  const root = fromPath[0];
  if (root) controls.push({ x: root.x, y: root.y });
  // Down the to-path from just-after-root to leaf:
  for (let i = 1; i < toPath.length; i++) {
    const p = toPath[i];
    if (p) controls.push({ x: p.x, y: p.y });
  }

  if (controls.length < 2) return "";

  // Straightening: apply beta to every interior control point.
  // interior = anything that isn't the first or last control point.
  // Lerp each toward the straight line from the first to the last by
  // (1 - beta). beta=1 keeps the original hierarchy; beta=0 collapses
  // to the straight chord.
  const start = controls[0];
  const end = controls[controls.length - 1];
  if (!start || !end) return "";
  const straightened: Pt[] = controls.map((p, i) => {
    if (i === 0 || i === controls.length - 1) return p;
    const t = i / (controls.length - 1);
    const lx = start.x + (end.x - start.x) * t;
    const ly = start.y + (end.y - start.y) * t;
    return {
      x: beta * p.x + (1 - beta) * lx,
      y: beta * p.y + (1 - beta) * ly,
    };
  });

  // Sample a Catmull-Rom spline through the straightened control
  // points. Duplicating the endpoints gives the spline the "phantom"
  // tangents it needs at the boundary without exposing us to a choice
  // of tension parameter beyond the classic CR0.5.
  const samples = sampleCatmullRom(straightened, steps);
  if (samples.length === 0) return "";

  // Emit SVG path. Kept as M + L segments — any rasteriser will treat
  // the dense polyline as smooth at typical stroke widths. Avoids the
  // extra complexity of emitting cubic Bezier segments while we're
  // also deciding on beta-animation strategy upstream.
  let d = `M ${fmt(samples[0]!.x)} ${fmt(samples[0]!.y)}`;
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i]!;
    d += ` L ${fmt(p.x)} ${fmt(p.y)}`;
  }
  return d;
}

// ── Spline helpers ───────────────────────────────────────────────────

/** Centripetal Catmull-Rom sampling. `steps` samples PER segment, so
 *  total samples ≈ (controls.length - 1) * steps + 1. We scale `steps`
 *  down inside to meet the user's intent of "about `steps` samples
 *  total" — otherwise even a 3-segment polyline emits 75 points at the
 *  default, which is overkill. */
function sampleCatmullRom(controls: Pt[], totalSteps: number): Pt[] {
  if (controls.length < 2) return controls.slice();
  if (controls.length === 2) {
    // Linear fallback — CR needs 4 points; with 2 we'd have to
    // phantom-extend twice, and the result is visually identical to
    // straight M + L. Short-circuit.
    const a = controls[0]!;
    const b = controls[1]!;
    const out: Pt[] = [];
    for (let i = 0; i <= totalSteps; i++) {
      const t = i / totalSteps;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return out;
  }

  const segments = controls.length - 1;
  const perSeg = Math.max(2, Math.round(totalSteps / segments));
  const out: Pt[] = [];

  for (let i = 0; i < segments; i++) {
    const p0 = controls[i === 0 ? 0 : i - 1]!;
    const p1 = controls[i]!;
    const p2 = controls[i + 1]!;
    const p3 = controls[i + 2 < controls.length ? i + 2 : controls.length - 1]!;

    const stepCount = i === segments - 1 ? perSeg : perSeg - 1; // avoid duplicate join
    const segSamples = i === segments - 1 ? perSeg + 1 : perSeg;
    for (let s = 0; s < segSamples; s++) {
      const t = s / stepCount;
      if (i > 0 && s === 0) continue; // skip first of non-initial seg to avoid dup
      out.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }
  return out;
}

/** Classic Catmull-Rom at parameter t ∈ [0, 1] between p1 and p2. */
function catmullRomPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const x =
    0.5 *
    ((2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const y =
    0.5 *
    ((2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return { x, y };
}

function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Trim path-coord float precision so tiny FP noise doesn't perturb
 *  snapshot-style diffs of the output string. */
function fmt(n: number): string {
  // 2 decimals is plenty for ~CSS-px-scale coordinates.
  return (Math.round(n * 100) / 100).toString();
}
