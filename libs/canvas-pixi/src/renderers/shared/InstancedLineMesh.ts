// SOTA GPU-instanced bezier-line mesh for Pixi v8 (WebGL path).
//
// Why: EdgeStaticRenderer.redraw() used Pixi Graphics' moveTo/bezierCurveTo/
// stroke for every single edge. With 2500 edges × ~16-segment bezier
// tessellation happening on the CPU, the draw-call count explodes and the
// perf recorder logs 15ms dt on edge-heavy frames. Instanced rendering
// draws N bezier ribbons in one GL call by reusing a single ribbon quad
// strip + per-instance attributes. Bezier evaluation happens on the GPU.
//
// Design:
// - Shared ribbon Geometry: 2 * (SAMPLES+1) vertices forming a triangle
//   strip along t ∈ [0, 1]. Each vertex has `a_t` (parameter along curve)
//   and `a_side` (−1 or +1 = which side of the ribbon).
// - Per-instance attributes (divisor=1): from, to, ctrl, color, width,
//   dashSize/gapSize, flags. Packed in one interleaved Float32 buffer.
// - Vertex shader: evaluates the quadratic bezier at t, computes tangent,
//   expands along perpendicular by (width / 2) * a_side in world-px
//   (uInvScale multiplies width so stroke stays pixel-constant under zoom).
// - Fragment shader: SDF-style anti-aliased stroke (1 screen px). Dash
//   pattern evaluated in frag as fract((distance + dashOffset) / period).
//   Flag bits control dashed / arrow / violation-outline behaviour.
//
// WebGL-only (like InstancedRectMesh). WebGPU would need a matching WGSL
// program — out of scope.

import { Buffer, BufferUsage, Geometry, GlProgram, Mesh, Shader } from "pixi.js";

// Tessellation samples along t ∈ [0, 1]. Each sample emits two verts
// (ribbon left + right). 32 is plenty for the curves we draw — the
// fragment shader does the final anti-aliasing, so the ribbon only needs
// enough samples to approximate the curve's tangent.
export const RIBBON_SAMPLES = 32;

// 18 floats per instance:
//   [0..1]   from.xy
//   [2..3]   to.xy
//   [4..5]   ctrl.xy         (quadratic bezier control point; midpoint if straight)
//   [6..9]   color RGBA (0..1)
//   [10]     width (world px, already pre-multiplied by invScale * widthMul)
//   [11]     dashSize (world px) — 0 = solid
//   [12]     gapSize (world px) — 0 = solid
//   [13]     dashPhase (world px, per-instance offset for animated flow)
//   [14]     flags (bit 0: dashed, bit 1: arrow-at-end, bit 2: violation outline,
//                  bit 3: round cap)
//   [15..17] reserved (padding + future: arrowSize, haloAlpha, 1 spare)
// 72 bytes/instance. 2500 instances = 180KB — trivial for a single VBO upload.
export const FLOATS_PER_EDGE_INSTANCE = 18;

// Instance flag bits.
export const EDGE_FLAG_DASHED = 1 << 0;
export const EDGE_FLAG_ARROW = 1 << 1;
export const EDGE_FLAG_VIOLATION = 1 << 2;
export const EDGE_FLAG_ROUND_CAP = 1 << 3;

// Ribbon geometry — generated once per process. (RIBBON_SAMPLES+1) quads,
// each emitted as triangle-strip pairs. We use an indexed triangle list
// because triangle-strip across (samples+1) pairs is the same thing in
// practice but indexed lets us degenerate safely if we ever need to.
function buildRibbonGeometry(): { verts: Float32Array; indices: Uint16Array } {
  const n = RIBBON_SAMPLES;
  const verts = new Float32Array((n + 1) * 2 * 2); // (samples+1) pairs, 2 verts each, 2 floats (t, side)
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = i * 4;
    verts[off + 0] = t;        // left vert: t
    verts[off + 1] = -1;       // left vert: side
    verts[off + 2] = t;        // right vert: t
    verts[off + 3] = 1;        // right vert: side
  }
  // Two triangles per ribbon segment: (L0 R0 L1) (R0 R1 L1).
  const indices = new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) {
    const base = i * 2;
    const o = i * 6;
    indices[o + 0] = base + 0;
    indices[o + 1] = base + 1;
    indices[o + 2] = base + 2;
    indices[o + 3] = base + 1;
    indices[o + 4] = base + 3;
    indices[o + 5] = base + 2;
  }
  return { verts, indices };
}

const VERTEX_SRC = /* glsl */ `#version 300 es
in vec2 a_tSide;            // .x = t in [0,1], .y = side in {-1, +1}

// Per-instance attributes (divisor=1).
in vec2 a_instFrom;
in vec2 a_instTo;
in vec2 a_instCtrl;
in vec4 a_instColor;
in float a_instWidth;
in float a_instDashSize;
in float a_instGapSize;
in float a_instDashPhase;
in float a_instFlags;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

out vec4 v_color;
out float v_side;           // -1..+1 across ribbon
out float v_t;              // 0..1 along curve
out float v_arcLen;         // approx world-px distance from start
out float v_totalLen;       // total approx arc length (world-px)
out float v_halfWidth;      // ribbon half-width (world-px)
out float v_dashSize;
out float v_gapSize;
out float v_dashPhase;
out float v_flags;

void main() {
    float t = a_tSide.x;
    float side = a_tSide.y;

    // Quadratic bezier: B(t) = (1-t)^2 P0 + 2(1-t)t C + t^2 P1
    float mt = 1.0 - t;
    vec2 pos = mt*mt*a_instFrom + 2.0*mt*t*a_instCtrl + t*t*a_instTo;
    // Derivative: B'(t) = 2(1-t)(C - P0) + 2t(P1 - C)
    vec2 tan = 2.0*mt*(a_instCtrl - a_instFrom) + 2.0*t*(a_instTo - a_instCtrl);
    float tlen = length(tan);
    // Fallback to P1-P0 when curve degenerates (ctrl on the line).
    if (tlen < 1e-4) {
        tan = a_instTo - a_instFrom;
        tlen = length(tan);
        if (tlen < 1e-4) tlen = 1.0;
    }
    vec2 tdir = tan / tlen;
    vec2 ndir = vec2(-tdir.y, tdir.x);

    // Width is already in world-px. Expand perpendicular half-width.
    float halfW = a_instWidth * 0.5;
    vec2 worldPos = pos + ndir * (halfW * side);

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(worldPos, 1.0)).xy, 0.0, 1.0);

    // Approximate arc length using chord P0→P1. For dashed patterns this
    // is close enough — visual period won't be exactly dashSize px on a
    // heavily curved edge, but the eye doesn't notice.
    float chord = length(a_instTo - a_instFrom);
    v_arcLen = t * chord;
    v_totalLen = chord;
    v_color = a_instColor;
    v_side = side;
    v_t = t;
    v_halfWidth = halfW;
    v_dashSize = a_instDashSize;
    v_gapSize = a_instGapSize;
    v_dashPhase = a_instDashPhase;
    v_flags = a_instFlags;
}
`;

const FRAGMENT_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec4 v_color;
in float v_side;
in float v_t;
in float v_arcLen;
in float v_totalLen;
in float v_halfWidth;
in float v_dashSize;
in float v_gapSize;
in float v_dashPhase;
in float v_flags;

out vec4 fragColor;

// Extract bit from packed float flags (reconstructed from integer in [0..31]).
bool flagBit(float flags, int bit) {
    int f = int(flags + 0.5);
    return (f & (1 << bit)) != 0;
}

void main() {
    // |v_side| is 1 at the ribbon edges, 0 along the centreline. SDF:
    // distance from centreline in world-px is |v_side| * halfW.
    float distToCentre = abs(v_side) * v_halfWidth;
    float edge = v_halfWidth;
    // fwidth in screen-space for 1-px AA. Approximate by width/edge derivative.
    float aa = fwidth(distToCentre) + 1e-4;

    float alpha = v_color.a * (1.0 - smoothstep(edge - aa, edge, distToCentre));

    // Dashed pattern — compute pen-down / pen-up in fragment. Uses the
    // on-screen distance approximation (v_arcLen) + uniform-like phase.
    bool dashed = flagBit(v_flags, 0);
    if (dashed && v_dashSize > 0.0) {
        float period = v_dashSize + v_gapSize;
        if (period > 0.0) {
            float p = mod(v_arcLen + v_dashPhase, period);
            // Pen is down for the first dashSize units of each period.
            // Soft AA the edge of the dash so it doesn't alias at steep zooms.
            float dashAA = fwidth(p) + 1e-4;
            float inDash = 1.0 - smoothstep(v_dashSize - dashAA, v_dashSize, p);
            alpha *= inDash;
        }
    }

    // Violation outline — when flagged, blend toward red at the ribbon
    // edges. We overdraw the original edge underneath with a wider instance;
    // this flag is carried for future use.
    vec3 rgb = v_color.rgb;
    if (flagBit(v_flags, 2)) {
        float rim = smoothstep(edge * 0.6, edge, distToCentre);
        rgb = mix(rgb, vec3(0.862, 0.149, 0.149), rim * 0.6);
    }

    fragColor = vec4(rgb * alpha, alpha);
    if (fragColor.a <= 0.001) discard;
}
`;

let sharedShader: Shader | null = null;
function getSharedShader(): Shader {
  if (sharedShader) return sharedShader;
  const glProgram = GlProgram.from({
    vertex: VERTEX_SRC,
    fragment: FRAGMENT_SRC,
    name: "instanced-line",
  });
  sharedShader = new Shader({ glProgram, resources: {} });
  return sharedShader;
}

// Unpack a 0xRRGGBB int into [r, g, b, a] at `out[offset]`. Same layout
// convention as InstancedRectMesh.unpackHexInto.
export function unpackHexInto(color: number, out: Float32Array, offset: number, alpha: number): void {
  out[offset] = ((color >> 16) & 0xff) / 255;
  out[offset + 1] = ((color >> 8) & 0xff) / 255;
  out[offset + 2] = (color & 0xff) / 255;
  out[offset + 3] = alpha;
}

/**
 * Batched instanced bezier-line mesh. One per renderer.
 *
 * Capacity grows in power-of-two steps to minimize GPU buffer recreation.
 * Layout follows the documented FLOATS_PER_EDGE_INSTANCE schema — callers
 * fill `view()` row-by-row then call `setInstanceCount(n)` to commit.
 */
export class InstancedLineMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  private geometry: Geometry;
  private instanceBuffer: Buffer;
  private capacity: number;
  private data: Float32Array | null;

  constructor(initialCapacity = 1024) {
    this.capacity = Math.max(16, initialCapacity);
    this.data = new Float32Array(this.capacity * FLOATS_PER_EDGE_INSTANCE);

    this.instanceBuffer = new Buffer({
      data: this.data,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      shrinkToFit: false,
    });

    const { verts, indices } = buildRibbonGeometry();
    const ribbonBuffer = new Buffer({
      data: verts,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST | BufferUsage.STATIC,
    });

    const stride = FLOATS_PER_EDGE_INSTANCE * 4;
    this.geometry = new Geometry({
      attributes: {
        a_tSide: { buffer: ribbonBuffer, format: "float32x2" },
        a_instFrom: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 0, instance: true, divisor: 1 },
        a_instTo: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 8, instance: true, divisor: 1 },
        a_instCtrl: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 16, instance: true, divisor: 1 },
        a_instColor: { buffer: this.instanceBuffer, format: "float32x4", stride, offset: 24, instance: true, divisor: 1 },
        a_instWidth: { buffer: this.instanceBuffer, format: "float32", stride, offset: 40, instance: true, divisor: 1 },
        a_instDashSize: { buffer: this.instanceBuffer, format: "float32", stride, offset: 44, instance: true, divisor: 1 },
        a_instGapSize: { buffer: this.instanceBuffer, format: "float32", stride, offset: 48, instance: true, divisor: 1 },
        a_instDashPhase: { buffer: this.instanceBuffer, format: "float32", stride, offset: 52, instance: true, divisor: 1 },
        a_instFlags: { buffer: this.instanceBuffer, format: "float32", stride, offset: 56, instance: true, divisor: 1 },
      },
      indexBuffer: indices,
      instanceCount: 0,
    });

    this.mesh = new Mesh<Geometry, Shader>({ geometry: this.geometry, shader: getSharedShader() });
  }

  ensureCapacity(n: number): void {
    if (n <= this.capacity) return;
    let next = this.capacity;
    while (next < n) next *= 2;
    this.capacity = next;
    this.geometry.instanceCount = 0;
    this.data = null;
    const fresh = new Float32Array(next * FLOATS_PER_EDGE_INSTANCE);
    this.data = fresh;
    this.instanceBuffer.setDataWithSize(fresh, fresh.length, false);
  }

  /**
   * Writable view of the backing Float32Array. Caller writes
   * FLOATS_PER_EDGE_INSTANCE floats per instance following the layout at
   * the top of this file, then calls `setInstanceCount(n)` to commit.
   */
  view(): Float32Array {
    if (!this.data) throw new Error("InstancedLineMesh.view() called after destroy");
    return this.data;
  }

  setInstanceCount(n: number): void {
    this.geometry.instanceCount = n;
    this.instanceBuffer.update(n * FLOATS_PER_EDGE_INSTANCE * 4);
  }

  destroy(): void {
    this.mesh.destroy();
    this.geometry.destroy(true);
    this.data = null;
  }
}
