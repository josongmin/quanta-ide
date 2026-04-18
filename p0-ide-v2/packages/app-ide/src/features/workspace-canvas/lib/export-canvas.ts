import type {
  ArchLayer,
  EdgeLayer,
  FileEdge,
  FileNode,
  WorkspaceFileView,
  WorkspaceLayout,
} from "@quanta/canvas-engine";

// Canvas exporters — emit a PNG or SVG snapshot of the current scene.
//
// PNG is captured from the live WebGL canvas that PixiStage renders into:
// the `.workspace-canvas canvas` element is the whole world-space framebuffer.
// We don't reach into PixiStage internals (which would require exposing the
// renderer), we just ask the DOM for its backing canvas. For SVG we walk the
// visible scene + layout and emit a stylised vector diagram — not pixel-perfect
// vs the Pixi scene, but legible for docs and pull requests.

export interface CanvasExportScene {
  layout: WorkspaceLayout;
  visible: WorkspaceFileView;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL on the next tick so the click handler has finished.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function isoStamp(): string {
  // yyyyMMddHHmmss — filesystem-safe, sortable.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * Export the current WebGL canvas to PNG and trigger a browser download.
 * Resolves once the download has been dispatched. Rejects when no workspace
 * canvas is mounted or the canvas' toBlob returns null.
 */
export async function exportAsPNG(container: HTMLElement | null): Promise<void> {
  const root = container ?? document.querySelector(".workspace-canvas");
  const canvas = root?.querySelector("canvas");
  if (!canvas) throw new Error("No canvas element available to export");
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Canvas toBlob returned null");
  triggerDownload(blob, `workspace-${isoStamp()}.png`);
}

const LAYER_FILL: Record<ArchLayer, string> = {
  domain: "#fce7f3",
  adapter: "#e0e7ff",
  infra: "#dcfce7",
  ui: "#fef3c7",
  util: "#e5e7eb",
  unknown: "#f3f4f6",
};
const LAYER_STROKE: Record<ArchLayer, string> = {
  domain: "#db2777",
  adapter: "#4f46e5",
  infra: "#16a34a",
  ui: "#d97706",
  util: "#6b7280",
  unknown: "#9ca3af",
};
const EDGE_STROKE: Record<EdgeLayer, string> = {
  structural: "#4b5563",
  flow: "#2563eb",
  safety: "#dc2626",
  impact: "#7c3aed",
};
const EDGE_DASH: Record<EdgeLayer, string> = {
  structural: "",
  flow: "",
  safety: "6 3",
  impact: "",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function fileFragment(file: FileNode, rect: { x: number; y: number; w: number; h: number }): string {
  const fill = LAYER_FILL[file.layer];
  const stroke = LAYER_STROKE[file.layer];
  const label = escapeXml(basename(file.id));
  return [
    `<g>`,
    `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"`,
    ` fill="${fill}" stroke="${stroke}" stroke-width="2" rx="8" ry="8"/>`,
    `<text x="${rect.x + 12}" y="${rect.y + 28}"`,
    ` font-family="system-ui, sans-serif" font-size="20" fill="#111">${label}</text>`,
    `</g>`,
  ].join("");
}

function edgeFragment(
  edge: FileEdge,
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number },
): string {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2;
  const y2 = to.y + to.h / 2;
  // Quadratic bezier with control point offset perpendicular to the midpoint
  // so multi-edges between the same pair don't overlap.
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * 40;
  const cy = my + ny * 40;
  const stroke = EDGE_STROKE[edge.layer];
  const dash = EDGE_DASH[edge.layer];
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="1.5"${dashAttr}/>`;
}

/**
 * Emit a stylised SVG for the visible scene. Not pixel-perfect vs the WebGL
 * render but readable as a diagram.
 */
export function buildSceneSvg(scene: CanvasExportScene): string {
  const { layout, visible } = scene;
  const b = layout.totalBounds;
  const padding = 40;
  const width = Math.max(1, Math.round(b.w + padding * 2));
  const height = Math.max(1, Math.round(b.h + padding * 2));
  const viewBox = `${b.x - padding} ${b.y - padding} ${width} ${height}`;

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect x="${b.x - padding}" y="${b.y - padding}" width="${width}" height="${height}" fill="#ffffff"/>`);

  // Edges first, then files, so file rectangles stack on top.
  const rects = layout.fileRects;
  for (const e of visible.edges) {
    const from = rects.get(e.from);
    const to = rects.get(e.to);
    if (!from || !to) continue;
    parts.push(edgeFragment(e, from, to));
  }
  for (const f of visible.files) {
    const rect = rects.get(f.id);
    if (!rect) continue;
    parts.push(fileFragment(f, rect));
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

/**
 * Export the current visible scene as an SVG and trigger a download.
 */
export function exportAsSVG(scene: CanvasExportScene): void {
  const svg = buildSceneSvg(scene);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  triggerDownload(blob, `workspace-${isoStamp()}.svg`);
}
