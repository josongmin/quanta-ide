// SOTA GPU-instanced rounded-rectangle mesh for Pixi v8 (WebGL path).
//
// Why: Pixi's Graphics API allocates a new FillGeometry per roundRect() call
// and churns vertex buffers on every redraw. For 5000+ file cards that's the
// dominant CPU cost. Instanced rendering draws N rectangles with a single
// draw call by reusing one unit quad + per-instance attributes.
//
// Design:
// - Shared unit-quad Geometry (4 verts, 2 triangles). Attribute `a_uv` ∈ [0,1]².
// - Per-instance attributes (divisor=1): position, size, fillColor, borderColor,
//   borderWidth, cornerRadius. All packed into a single interleaved Float32
//   buffer for cache friendliness and a single buffer upload per frame.
// - Fragment shader computes SDF to the rounded-rect edge in fragment space
//   (using a_uv and the per-instance size) and outputs either fill or border
//   with one AA pixel of smoothstep — crisper than Graphics' tessellated corners.
//
// WebGL-only: we ship a `GlProgram`. If the app ever switches to WebGPU we'd
// need to add a matching WGSL `GpuProgram` — see the Shader.from docs.

import { Buffer, BufferUsage, Geometry, GlProgram, Mesh, Shader } from "pixi.js";

// 14 floats per instance:
//   [0..1]  position.xy
//   [2..3]  size.xy
//   [4..7]  fill RGBA (0..1)
//   [8..11] border RGBA (0..1)
//   [12]    border width (world px)
//   [13]    corner radius (world px)
// 56 bytes/instance. 5000 instances = 280KB — trivial for a VBO upload.
export const FLOATS_PER_INSTANCE = 14;

// One unit quad (two triangles). Reused across every instance.
const QUAD_VERTS = new Float32Array([
  0, 0,
  1, 0,
  1, 1,
  0, 1,
]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

const VERTEX_SRC = /* glsl */ `#version 300 es
in vec2 a_uv;

// Per-instance attributes (divisor=1).
in vec2 a_instPos;
in vec2 a_instSize;
in vec4 a_instFill;
in vec4 a_instBorder;
in vec2 a_instBWAndRadius;    // .x = borderWidth, .y = cornerRadius

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

out vec2 v_localPx;         // fragment position in the rect's local px space (0..size)
out vec2 v_size;
out vec4 v_fill;
out vec4 v_border;
out vec2 v_bwAndRadius;

void main() {
    vec2 worldPos = a_instPos + a_uv * a_instSize;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(worldPos, 1.0)).xy, 0.0, 1.0);

    v_localPx = a_uv * a_instSize;
    v_size = a_instSize;
    v_fill = a_instFill;
    v_border = a_instBorder;
    v_bwAndRadius = a_instBWAndRadius;
}
`;

const FRAGMENT_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_localPx;
in vec2 v_size;
in vec4 v_fill;
in vec4 v_border;
in vec2 v_bwAndRadius;

out vec4 fragColor;

// Signed distance to a rounded rectangle centred at origin with half-size b
// and corner radius r. Returns negative inside, 0 on edge, positive outside.
float sdRoundedRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
    float bw = v_bwAndRadius.x;
    float r = v_bwAndRadius.y;

    // Centre the coordinate space so sd function is symmetric.
    vec2 p = v_localPx - v_size * 0.5;
    vec2 halfSize = v_size * 0.5;

    float d = sdRoundedRect(p, halfSize, r);

    // Anti-alias width of ~1 px in screen space. fwidth gives us the pixel
    // derivative of d, so smoothstep of width fwidth(d) is exactly 1 screen px.
    float aa = fwidth(d);

    // Outer edge: fade out fill past d > 0.
    float outerAlpha = 1.0 - smoothstep(-aa, 0.0, d);

    // Border: "inside the shape but within bw of the outer edge".
    // Border mask = (d > -bw) - (d > 0) smoothed.
    float borderMask = smoothstep(-bw - aa, -bw, d) * (1.0 - smoothstep(-aa, 0.0, d));

    // Mix fill and border. Border takes priority where the mask is hot.
    vec4 fill = vec4(v_fill.rgb, v_fill.a * outerAlpha);
    vec4 border = vec4(v_border.rgb, v_border.a * outerAlpha);
    fragColor = mix(fill, border, borderMask);

    // Pre-multiplied alpha — Pixi's default pipeline expects pre-multiplied.
    fragColor.rgb *= fragColor.a;

    if (fragColor.a <= 0.0) discard;
}
`;

let sharedShader: Shader | null = null;
function getSharedShader(): Shader {
  if (sharedShader) return sharedShader;
  const glProgram = GlProgram.from({
    vertex: VERTEX_SRC,
    fragment: FRAGMENT_SRC,
    name: "instanced-rect",
  });
  sharedShader = new Shader({ glProgram, resources: {} });
  return sharedShader;
}

// Unpack a 0xRRGGBB int into [r, g, b] tuple (0..1).
// Hot path — called per file per frame, so avoid allocating.
export function unpackHexInto(color: number, out: Float32Array, offset: number, alpha: number): void {
  out[offset] = ((color >> 16) & 0xff) / 255;
  out[offset + 1] = ((color >> 8) & 0xff) / 255;
  out[offset + 2] = (color & 0xff) / 255;
  out[offset + 3] = alpha;
}

// The actual batched rect mesh. One per renderer. Grows its backing buffer in
// power-of-two steps to minimize GPU buffer recreation.
export class InstancedRectMesh {
  // Mesh's default generic expects MeshGeometry/TextureShader. We're using
  // a custom Geometry + Shader pair (SDF rounded rect), so parameterize
  // explicitly — otherwise TS infers the defaults and errors on assignment.
  readonly mesh: Mesh<Geometry, Shader>;
  private geometry: Geometry;
  private instanceBuffer: Buffer;
  private capacity: number;
  private data: Float32Array | null;

  constructor(initialCapacity = 1024) {
    this.capacity = Math.max(16, initialCapacity);
    this.data = new Float32Array(this.capacity * FLOATS_PER_INSTANCE);

    this.instanceBuffer = new Buffer({
      data: this.data,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      // Instance data changes every frame — don't let Pixi shrink the GPU
      // buffer or we'll stutter when a selection/hover triggers a repack.
      shrinkToFit: false,
    });

    const quadBuffer = new Buffer({
      data: QUAD_VERTS,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST | BufferUsage.STATIC,
    });

    // Interleaved stride = FLOATS_PER_INSTANCE * 4 bytes = 56. All instance
    // attrs share the same buffer, differentiated only by byte offset +
    // divisor=1 (one advance per instance).
    const stride = FLOATS_PER_INSTANCE * 4;
    this.geometry = new Geometry({
      attributes: {
        a_uv: { buffer: quadBuffer, format: "float32x2" },
        a_instPos: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 0, instance: true, divisor: 1 },
        a_instSize: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 8, instance: true, divisor: 1 },
        a_instFill: { buffer: this.instanceBuffer, format: "float32x4", stride, offset: 16, instance: true, divisor: 1 },
        a_instBorder: { buffer: this.instanceBuffer, format: "float32x4", stride, offset: 32, instance: true, divisor: 1 },
        a_instBWAndRadius: { buffer: this.instanceBuffer, format: "float32x2", stride, offset: 48, instance: true, divisor: 1 },
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
    // Zero instanceCount *before* swapping the buffer. If Pixi were to emit
    // a draw in the window between `setDataWithSize()` (which drops the old
    // GlBuffer) and the renderer's subsequent update-loop + setInstanceCount(),
    // a non-zero instanceCount would cause the shader to read stale attribute
    // offsets from whatever buffer is bound — sometimes garbage, sometimes
    // the previous frame's data rendered at wrong positions. Forcing 0 here
    // gates the drawInstanced call until the caller writes fresh bytes and
    // calls setInstanceCount(n) again with the real count.
    this.geometry.instanceCount = 0;
    // Drop the old Float32Array reference *before* allocating the new one so
    // the JS GC can reclaim it on the next sweep without being pinned by
    // this.data.
    this.data = null;
    const fresh = new Float32Array(next * FLOATS_PER_INSTANCE);
    this.data = fresh;
    // Pixi v8: setDataWithSize(value, size, syncGPU) — when `value.length` ≠
    // old length it emits 'change' which drops the existing GlBuffer (via
    // _gpuData[ctx].destroy() inside unload()) and allocates a fresh one on
    // the next draw. Setting `buffer.data = x` calls this same path with
    // syncGPU=true, but going through the explicit API documents the
    // reallocation intent and saves one redundant 'update' emit (syncGPU=false
    // — the first setInstanceCount() below after ensureCapacity will emit
    // 'update' to upload the bytes we actually wrote).
    this.instanceBuffer.setDataWithSize(fresh, fresh.length, false);
  }

  // Returns a writable view into the backing Float32Array starting at instance i.
  // Caller fills FLOATS_PER_INSTANCE floats in the layout documented at top.
  view(): Float32Array {
    if (!this.data) throw new Error("InstancedRectMesh.view() called after destroy");
    return this.data;
  }

  setInstanceCount(n: number): void {
    this.geometry.instanceCount = n;
    // Upload only the bytes we actually wrote. Pixi's update() takes bytes;
    // when n=0, passing 0 still signals "no pending writes" and prevents a
    // stale draw from previous frames (instanceCount=0 gates drawInstanced,
    // but update(0) also tells the uploader to skip the DMA copy).
    this.instanceBuffer.update(n * FLOATS_PER_INSTANCE * 4);
  }

  destroy(): void {
    this.mesh.destroy();
    this.geometry.destroy(true);
    // Release the CPU-side backing array so a renderer destroy() doesn't
    // keep ~280 KB × N-renderers pinned waiting for the next GC pass.
    this.data = null;
  }
}
