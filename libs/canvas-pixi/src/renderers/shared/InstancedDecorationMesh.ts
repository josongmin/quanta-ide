// SOTA GPU-instanced edge-decoration mesh for Pixi v8 (WebGL path).
//
// Why: after P3 moved bezier bodies onto InstancedLineMesh, the remaining
// CPU hot path inside EdgeStaticRenderer is Graphics-based decoration
// rendering — per-edge arrowhead fills, sanitizer X-caps, and anchor glow
// dots. Each of those issues its own moveTo/lineTo/closePath/fill chain
// plus Pixi's batch-renderer reallocates triangles whenever the primitive
// count changes. For 2500 edges that's ~5000–7500 primitive draws per
// frame just for caps & dots, even after the body strokes collapse to one
// instanced draw call.
//
// This mesh draws every decoration kind (arrowhead / X-cap / glow-dot) in
// a single instanced draw call. Per-instance attributes carry position,
// direction (for arrow rotation), size, color, and a `kind` tag. The
// fragment shader switches on the tag and evaluates the appropriate SDF.
// AA via fwidth-based smoothstep — the same pattern InstancedRectMesh uses.
//
// WebGL-only. Matches the pipeline choice of the other two instanced meshes.

import { Buffer, BufferUsage, Geometry, GlProgram, Mesh, Shader } from "pixi.js";

// 12 floats per instance:
//   [0..1]   pos.xy         (world px)
//   [2..3]   dir.xy         (unit vector; rotation for arrow / x-cap. Dots ignore.)
//   [4]      size           (world px, pre-multiplied by invScale * widthMul)
//   [5..8]   color RGBA (0..1)
//   [9]      kind           (0 = arrow, 1 = x-cap, 2 = glow-dot)
//   [10]     strokeWidth    (world px; used by x-cap only, ignored by others)
//   [11]     reserved       (padding; keeps stride aligned for future glow params)
// 48 bytes/instance. 10 000 decorations = 480 KB — trivial upload.
export const FLOATS_PER_DECORATION_INSTANCE = 12;

export const DECORATION_KIND_ARROW = 0;
export const DECORATION_KIND_XCAP = 1;
export const DECORATION_KIND_GLOW_DOT = 2;

// Unit quad centred on origin in [-1, +1]² so the vertex shader can rotate
// around the instance position by scaling + rotating the uv directly.
// Shared across every decoration instance.
const QUAD_VERTS = new Float32Array([
  -1, -1,
   1, -1,
   1,  1,
  -1,  1,
]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

const VERTEX_SRC = /* glsl */ `#version 300 es
in vec2 a_uv;                 // in [-1, +1]^2

in vec2 a_instPos;
in vec2 a_instDir;            // unit vector (arrow tangent direction)
in float a_instSize;
in vec4 a_instColor;
in float a_instKind;
in float a_instStrokeWidth;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

out vec2 v_uv;                // local coord in [-1..+1]^2 (rotated into shape space)
out float v_size;
out vec4 v_color;
out float v_kind;
out float v_strokeWidth;

void main() {
    // Rotate the unit quad so +X points along a_instDir. For glow dots
    // rotation is irrelevant (SDF is radially symmetric) so we still rotate
    // but it's a no-op visually.
    float cs = length(a_instDir) > 1e-5 ? a_instDir.x / length(a_instDir) : 1.0;
    float sn = length(a_instDir) > 1e-5 ? a_instDir.y / length(a_instDir) : 0.0;
    mat2 rot = mat2(cs, sn, -sn, cs);

    // Scale by size. The shape SDFs below operate in the [-1..+1] uv box,
    // so 'size' is the world-px extent of that box (half-extent, effectively).
    vec2 rotated = rot * a_uv;
    vec2 worldPos = a_instPos + rotated * a_instSize;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(worldPos, 1.0)).xy, 0.0, 1.0);

    v_uv = a_uv;
    v_size = a_instSize;
    v_color = a_instColor;
    v_kind = a_instKind;
    v_strokeWidth = a_instStrokeWidth;
}
`;

const FRAGMENT_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
in float v_size;
in vec4 v_color;
in float v_kind;
in float v_strokeWidth;

out vec4 fragColor;

// SDF: isosceles triangle pointing along +X with tip at (1, 0), base at
// x = -0.2 spanning ±0.6 in y (inside unit-quad uv space). The 1.2× size
// extension in the build loop (see EdgeStaticRenderer) keeps the tip
// roughly at the b anchor while the base recedes.
float sdArrowTriangle(vec2 p) {
    // Two inside-half-plane tests against the triangle's legs:
    //   left  leg: normal (sin(a), -cos(a))  where a = angle at tip
    //   right leg: normal (sin(a), +cos(a))
    //   base:       normal (-1, 0), offset  0.2
    // Half-angle at the tip ~ atan(0.6 / 1.2) ≈ 0.4636 rad.
    const float ax = 1.2;       // tip-to-base x span in uv
    const float ay = 0.6;       // half base height
    // Normal of the right leg: from tip(1,0) to (1-ax, +ay), normalised, rotated -90°.
    // Compute analytically: leg vector = (-ax, +ay); perpendicular (inward) = (+ay, +ax) normalised.
    float nlen = sqrt(ax*ax + ay*ay);
    vec2 nR = vec2( ay, -ax) / nlen;   // right leg: inward normal points up-left
    vec2 nL = vec2( ay,  ax) / nlen;   // left leg
    float dR = dot(p - vec2(1.0, 0.0), nR);
    float dL = dot(p - vec2(1.0, 0.0), nL);
    float dBase = -(p.x - (1.0 - ax));  // inside when p.x > 1 - ax
    // SDF (positive outside) = max over half-space distances.
    return max(max(dR, dL), dBase);
}

// SDF: axis-aligned box with half-extents b.
float sdBox(vec2 p, vec2 b) {
    vec2 q = abs(p) - b;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
}

// X-cap: two thin rotated boxes crossed at 45°. Each box is a short fat
// dash. In uv space we draw two boxes of half-extent (1, strokeHalf), one
// rotated by +45° and one by -45°.
float sdXCap(vec2 p, float strokeHalf) {
    // Rotate p by -45° → evaluate box, then rotate by +45° → evaluate box.
    // We build both rotations inline rather than calling a helper.
    float c = 0.70710678;   // cos 45
    float s = 0.70710678;   // sin 45
    vec2 p1 = vec2( c*p.x + s*p.y, -s*p.x + c*p.y);
    vec2 p2 = vec2( c*p.x - s*p.y,  s*p.x + c*p.y);
    float d1 = sdBox(p1, vec2(0.9, strokeHalf));
    float d2 = sdBox(p2, vec2(0.9, strokeHalf));
    return min(d1, d2);
}

// Circle SDF (unit radius at origin).
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

void main() {
    int kind = int(v_kind + 0.5);
    float d = 1.0;              // outside by default — defensive
    float innerR = 0.55;        // glow inner radius in uv units
    float outerR = 1.0;         // glow outer falloff radius

    if (kind == 0) {
        // Arrowhead: solid fill inside the triangle SDF, 1 screen-px AA
        // around the perimeter.
        d = sdArrowTriangle(v_uv);
        float aa = fwidth(d) + 1e-4;
        float fill = 1.0 - smoothstep(-aa, 0.0, d);
        fragColor = vec4(v_color.rgb * (v_color.a * fill), v_color.a * fill);
    } else if (kind == 1) {
        // X-cap: stroke width lives in world px; convert to uv half-extent
        // by dividing by the box half-size (v_size). Clamp to prevent the
        // cross from ballooning when invScale is extreme.
        float strokeHalf = clamp(v_strokeWidth * 0.5 / max(v_size, 0.001), 0.05, 0.4);
        d = sdXCap(v_uv, strokeHalf);
        float aa = fwidth(d) + 1e-4;
        float fill = 1.0 - smoothstep(-aa, 0.0, d);
        fragColor = vec4(v_color.rgb * (v_color.a * fill), v_color.a * fill);
    } else {
        // Glow dot: two radial falloffs. Inner solid circle (innerR) at
        // full alpha, plus an outer halo up to outerR at 25% alpha, same
        // silhouette as the old Graphics path in drawGlowDot().
        float d1 = sdCircle(v_uv, innerR);
        float d2 = sdCircle(v_uv, outerR);
        float aa1 = fwidth(d1) + 1e-4;
        float aa2 = fwidth(d2) + 1e-4;
        float core = 1.0 - smoothstep(-aa1, 0.0, d1);
        float halo = (1.0 - smoothstep(-aa2, 0.0, d2)) * 0.25;
        float a = max(core, halo) * v_color.a;
        fragColor = vec4(v_color.rgb * a, a);
    }

    if (fragColor.a <= 0.001) discard;
}
`;

let sharedShader: Shader | null = null;
function getSharedShader(): Shader {
  if (sharedShader) return sharedShader;
  const glProgram = GlProgram.from({
    vertex: VERTEX_SRC,
    fragment: FRAGMENT_SRC,
    name: "instanced-decoration",
  });
  sharedShader = new Shader({ glProgram, resources: {} });
  return sharedShader;
}

// Unpack a 0xRRGGBB int into [r, g, b, a] at `out[offset]`. Same layout
// convention as InstancedLineMesh.unpackHexInto / InstancedRectMesh.
export function unpackHexInto(color: number, out: Float32Array, offset: number, alpha: number): void {
  out[offset] = ((color >> 16) & 0xff) / 255;
  out[offset + 1] = ((color >> 8) & 0xff) / 255;
  out[offset + 2] = (color & 0xff) / 255;
  out[offset + 3] = alpha;
}

/**
 * Batched instanced decoration mesh. One per renderer.
 *
 * Layout mirrors the FLOATS_PER_DECORATION_INSTANCE constant — callers
 * fill `view()` row-by-row and then call `setInstanceCount(n)` to commit
 * the bytes and issue the instanced draw.
 *
 * Capacity grows in power-of-two steps. Same semantics as the sibling
 * instanced meshes so the Pixi v8 buffer-reallocation contract (zero
 * instanceCount before swap, then repopulate) is preserved.
 */
export class InstancedDecorationMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  private geometry: Geometry;
  private instanceBuffer: Buffer;
  private capacity: number;
  private data: Float32Array | null;

  constructor(initialCapacity = 1024) {
    this.capacity = Math.max(16, initialCapacity);
    this.data = new Float32Array(this.capacity * FLOATS_PER_DECORATION_INSTANCE);

    this.instanceBuffer = new Buffer({
      data: this.data,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      shrinkToFit: false,
    });

    const quadBuffer = new Buffer({
      data: QUAD_VERTS,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST | BufferUsage.STATIC,
    });

    const stride = FLOATS_PER_DECORATION_INSTANCE * 4;
    this.geometry = new Geometry({
      attributes: {
        a_uv: { buffer: quadBuffer, format: "float32x2" },
        a_instPos: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 0, instance: true, divisor: 1 },
        a_instDir: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 8, instance: true, divisor: 1 },
        a_instSize: { buffer: this.instanceBuffer, format: "float32", stride, offset: 16, instance: true, divisor: 1 },
        a_instColor: { buffer: this.instanceBuffer, format: "float32x4", stride, offset: 20, instance: true, divisor: 1 },
        a_instKind: { buffer: this.instanceBuffer, format: "float32", stride, offset: 36, instance: true, divisor: 1 },
        a_instStrokeWidth: { buffer: this.instanceBuffer, format: "float32", stride, offset: 40, instance: true, divisor: 1 },
      },
      indexBuffer: QUAD_INDICES,
      instanceCount: 0,
    });

    this.mesh = new Mesh<Geometry, Shader>({ geometry: this.geometry, shader: getSharedShader() });
  }

  ensureCapacity(n: number): void {
    if (n <= this.capacity) return;
    let next = this.capacity;
    while (next < n) next *= 2;
    this.capacity = next;
    // Zero instanceCount before swapping: the same rationale documented
    // in InstancedRectMesh — prevents a garbage draw in the window between
    // setDataWithSize() dropping the old GlBuffer and the next
    // setInstanceCount() repopulating the new one.
    this.geometry.instanceCount = 0;
    this.data = null;
    const fresh = new Float32Array(next * FLOATS_PER_DECORATION_INSTANCE);
    this.data = fresh;
    this.instanceBuffer.setDataWithSize(fresh, fresh.length, false);
  }

  view(): Float32Array {
    if (!this.data) throw new Error("InstancedDecorationMesh.view() called after destroy");
    return this.data;
  }

  setInstanceCount(n: number): void {
    this.geometry.instanceCount = n;
    this.instanceBuffer.update(n * FLOATS_PER_DECORATION_INSTANCE * 4);
  }

  destroy(): void {
    this.mesh.destroy();
    this.geometry.destroy(true);
    this.data = null;
  }
}
