// SOTA GPU-instanced circle / ring mesh for Pixi v8 (WebGL path).
//
// Why: EffectBadgeRenderer / StartHereBadgeRenderer / PresenceRingRenderer
// all draw per-file primitives (chip backgrounds, numbered badges, pulsing
// rings) via Pixi's Graphics API. Each `roundRect().fill()` or
// `circle().stroke()` allocates a fresh FillGeometry / StrokeGeometry and
// tessellates on the CPU. With 1000+ files and a pulsing ring ticker at
// 60 fps that's the dominant CPU cost on the badge/ring streams.
//
// Instanced rendering draws N circles/rings with a single draw call by
// reusing one unit quad + per-instance attributes. Pulse animation runs
// entirely on the GPU — the renderer only needs to update the `aPulse`
// attribute per frame, not clear+rebuild Graphics display lists.
//
// Design:
// - Shared unit-quad Geometry (4 verts, 2 triangles). Attribute `a_uv` ∈
//   [-1, 1]² so the fragment SDF math is centred naturally.
// - Per-instance attributes (divisor=1):
//     aCenter         vec2    world position of the circle centre
//     aRadius         float   outer radius in world px (pre-inflated for
//                             AA/pulse scale so the quad always covers
//                             the painted pixels)
//     aInnerRadius    float   inner radius in world px (0 = filled disc)
//     aColor          vec4    fill / ring body colour (pre-multiplied RGBA)
//     aBorderColor    vec4    border overlay colour (optional stroke)
//     aBorderWidth    float   border width in world px (0 = no border)
//     aPulse          float   0..1 pulse phase. Shader maps to alpha +
//                             radius modulation so animation is GPU-side.
// - Fragment shader: SDF distance from the centre. Two smoothstep edges
//   produce anti-aliased ring bands or filled discs; the uniform pulse
//   attribute modulates alpha and a tiny scale factor so rings breathe
//   without CPU touch.
//
// WebGL-only: we ship a `GlProgram`. If the app ever switches to WebGPU
// we'd need a matching WGSL `GpuProgram` — out of scope for this pass.

import { Buffer, BufferUsage, Geometry, GlProgram, Mesh, Shader } from "pixi.js";

// 14 floats per instance:
//   [0..1]   centre.xy
//   [2]      outer radius (world px)
//   [3]      inner radius (world px, 0 = filled disc)
//   [4..7]   fill / body RGBA (0..1)
//   [8..11]  border RGBA (0..1)
//   [12]     border width (world px)
//   [13]     pulse phase (0..1)
// 56 bytes/instance. 2000 instances = 112 KB — trivial for a VBO upload.
export const FLOATS_PER_CIRCLE_INSTANCE = 14;

// Unit quad in [-1, 1] so the SDF reads centred coords directly.
const QUAD_VERTS = new Float32Array([
  -1, -1,
  1, -1,
  1, 1,
  -1, 1,
]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

const VERTEX_SRC = /* glsl */ `#version 300 es
in vec2 a_uv;                 // [-1, 1] unit quad corner

// Per-instance attributes (divisor=1).
in vec2 a_instCenter;
in float a_instRadius;
in float a_instInnerRadius;
in vec4 a_instColor;
in vec4 a_instBorderColor;
in float a_instBorderWidth;
in float a_instPulse;         // 0..1, shader-driven pulse phase

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

out vec2 v_uv;                // [-1, 1] inside the quad
out float v_outer;            // outer radius in world px
out float v_inner;            // inner radius in world px (0 = filled)
out vec4 v_color;
out vec4 v_borderColor;
out float v_borderWidth;
out float v_pulse;

void main() {
    // Inflate the quad by ~12% so the pulse breathing + AA feather never
    // clips the shape, even when the shader expands radius by up to 10%.
    float quadRadius = a_instRadius * 1.12 + 1.0;
    vec2 worldPos = a_instCenter + a_uv * quadRadius;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(worldPos, 1.0)).xy, 0.0, 1.0);

    // Pass the quad-local uv in world px so the fragment can compute a
    // signed distance. Multiplied by quadRadius to restore world scale.
    v_uv = a_uv * quadRadius;
    v_outer = a_instRadius;
    v_inner = a_instInnerRadius;
    v_color = a_instColor;
    v_borderColor = a_instBorderColor;
    v_borderWidth = a_instBorderWidth;
    v_pulse = a_instPulse;
}
`;

const FRAGMENT_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
in float v_outer;
in float v_inner;
in vec4 v_color;
in vec4 v_borderColor;
in float v_borderWidth;
in float v_pulse;

out vec4 fragColor;

void main() {
    float d = length(v_uv);               // distance from centre (world px)

    // Pulse maps 0..1 → a sine-like curve; shader avoids another uniform.
    // Drives a small radial breathe (±5%) and an alpha modulation (±15%).
    // Phase is passed in [0, 1]; we bring it to [0, 2π] for sin().
    float phase = v_pulse * 6.28318530718;
    float breathe = sin(phase);           // -1..+1
    float radiusScale = 1.0 + breathe * 0.05;
    float alphaMod = 0.85 + breathe * 0.10;

    float outer = v_outer * radiusScale;
    float inner = v_inner * radiusScale;
    float bw = v_borderWidth;

    // Anti-alias width of 1 screen pixel. fwidth(d) gives the pixel
    // derivative of d, so a feather of that width is exactly 1 px wide.
    float aa = fwidth(d) + 1e-4;

    float mask;
    if (inner > 0.0) {
        // Ring: band between inner and outer. Two smoothsteps combine
        // into a symmetric AA'd annulus — identical pixel silhouette
        // to Pixi's Graphics.circle().stroke() at integer widths but
        // crisper because we don't tessellate.
        float outerEdge = 1.0 - smoothstep(outer - aa, outer, d);
        float innerEdge = smoothstep(inner - aa, inner, d);
        mask = outerEdge * innerEdge;
    } else {
        // Filled disc.
        mask = 1.0 - smoothstep(outer - aa, outer, d);
    }

    // Border overlay (optional). Applied as an outer rim just inside the
    // outer edge so a filled chip can still carry a light stroke.
    float borderMask = 0.0;
    if (bw > 0.0) {
        float borderInner = outer - bw;
        borderMask = smoothstep(borderInner - aa, borderInner, d) * (1.0 - smoothstep(outer - aa, outer, d));
    }

    vec4 body = vec4(v_color.rgb, v_color.a * alphaMod);
    vec4 border = vec4(v_borderColor.rgb, v_borderColor.a * alphaMod);

    // Body tinted by SDF mask; border composites over it where its own
    // mask is hot. Border alpha scales with the overlap so a thin 0.5 px
    // border doesn't read as a hard outline at wide zoom.
    vec4 rgba = body * mask;
    rgba = mix(rgba, border, clamp(borderMask, 0.0, 1.0) * border.a);

    // Pre-multiplied alpha — matches Pixi's default pipeline.
    fragColor = vec4(rgba.rgb * rgba.a, rgba.a);
    if (fragColor.a <= 0.001) discard;
}
`;

let sharedShader: Shader | null = null;
function getSharedShader(): Shader {
  if (sharedShader) return sharedShader;
  const glProgram = GlProgram.from({
    vertex: VERTEX_SRC,
    fragment: FRAGMENT_SRC,
    name: "instanced-circle",
  });
  sharedShader = new Shader({ glProgram, resources: {} });
  return sharedShader;
}

/**
 * Unpack a 0xRRGGBB int into [r, g, b, a] at `out[offset]`. Same layout
 * convention as InstancedRectMesh.unpackHexInto.
 */
export function unpackHexInto(color: number, out: Float32Array, offset: number, alpha: number): void {
  out[offset] = ((color >> 16) & 0xff) / 255;
  out[offset + 1] = ((color >> 8) & 0xff) / 255;
  out[offset + 2] = (color & 0xff) / 255;
  out[offset + 3] = alpha;
}

/**
 * Batched instanced circle/ring mesh. One per renderer.
 *
 * Capacity grows in power-of-two steps to minimise GPU buffer recreation.
 * Layout follows the documented FLOATS_PER_CIRCLE_INSTANCE schema — callers
 * fill `view()` row-by-row then call `setInstanceCount(n)` to commit.
 */
export class InstancedCircleMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  private geometry: Geometry;
  private instanceBuffer: Buffer;
  private capacity: number;
  private data: Float32Array | null;

  constructor(initialCapacity = 512) {
    this.capacity = Math.max(16, initialCapacity);
    this.data = new Float32Array(this.capacity * FLOATS_PER_CIRCLE_INSTANCE);

    this.instanceBuffer = new Buffer({
      data: this.data,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      // Instance data changes every frame (pulse phase) — don't let Pixi
      // shrink the GPU buffer or we'll stutter at every membership change.
      shrinkToFit: false,
    });

    const quadBuffer = new Buffer({
      data: QUAD_VERTS,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST | BufferUsage.STATIC,
    });

    const stride = FLOATS_PER_CIRCLE_INSTANCE * 4;
    this.geometry = new Geometry({
      attributes: {
        a_uv: { buffer: quadBuffer, format: "float32x2" },
        a_instCenter: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 0, instance: true, divisor: 1 },
        a_instRadius: { buffer: this.instanceBuffer, format: "float32", stride, offset: 8, instance: true, divisor: 1 },
        a_instInnerRadius: { buffer: this.instanceBuffer, format: "float32", stride, offset: 12, instance: true, divisor: 1 },
        a_instColor: { buffer: this.instanceBuffer, format: "float32x4", stride, offset: 16, instance: true, divisor: 1 },
        a_instBorderColor: { buffer: this.instanceBuffer, format: "float32x4", stride, offset: 32, instance: true, divisor: 1 },
        a_instBorderWidth: { buffer: this.instanceBuffer, format: "float32", stride, offset: 48, instance: true, divisor: 1 },
        a_instPulse: { buffer: this.instanceBuffer, format: "float32", stride, offset: 52, instance: true, divisor: 1 },
      },
      indexBuffer: QUAD_INDICES,
      instanceCount: 0,
    });

    this.mesh = new Mesh<Geometry, Shader>({ geometry: this.geometry, shader: getSharedShader() });
  }

  /** Grow backing buffer in power-of-two steps. See InstancedRectMesh.ensureCapacity for the rationale on the
   *  instanceCount=0 reset — identical race window applies here. */
  ensureCapacity(n: number): void {
    if (n <= this.capacity) return;
    let next = this.capacity;
    while (next < n) next *= 2;
    this.capacity = next;
    this.geometry.instanceCount = 0;
    this.data = null;
    const fresh = new Float32Array(next * FLOATS_PER_CIRCLE_INSTANCE);
    this.data = fresh;
    this.instanceBuffer.setDataWithSize(fresh, fresh.length, false);
  }

  /** Writable view of the backing Float32Array. Caller writes
   *  FLOATS_PER_CIRCLE_INSTANCE floats per instance per the layout documented
   *  at the top of this file, then calls `setInstanceCount(n)` to commit. */
  view(): Float32Array {
    if (!this.data) throw new Error("InstancedCircleMesh.view() called after destroy");
    return this.data;
  }

  setInstanceCount(n: number): void {
    this.geometry.instanceCount = n;
    this.instanceBuffer.update(n * FLOATS_PER_CIRCLE_INSTANCE * 4);
  }

  /**
   * Update just the pulse phase column for live instances without touching
   * the rest of the backing array. Intended for Ticker-driven animation
   * where membership is stable but phase advances each frame. `phase` is
   * the same value for every instance (global pulse clock) — renderers
   * that want per-instance phase offsets should write directly to the view
   * instead and call setInstanceCount.
   *
   * NOTE: this calls `update()` with the full live-bytes span to be safe,
   * which re-uploads the whole prefix. For the small instance counts we
   * see on badges/rings (O(100)) that's still cheaper than rebuilding a
   * Graphics display list.
   */
  updatePulsePhase(count: number, phase: number): void {
    if (!this.data || count === 0) return;
    const data = this.data;
    for (let i = 0; i < count; i++) {
      data[i * FLOATS_PER_CIRCLE_INSTANCE + 13] = phase;
    }
    this.instanceBuffer.update(count * FLOATS_PER_CIRCLE_INSTANCE * 4);
  }

  destroy(): void {
    this.mesh.destroy();
    this.geometry.destroy(true);
    this.data = null;
  }
}
