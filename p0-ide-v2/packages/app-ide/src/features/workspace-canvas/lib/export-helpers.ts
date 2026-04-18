import type {
  FileEdge,
  FileNode,
  WorkspaceFileView,
  WorkspaceLayout,
  ArchLayer,
  EdgeLayer,
} from "@quanta/canvas-engine";
import { captureWorkspaceUrlState } from "./apply-workspace-url";
import { buildShareUrl } from "./workspace-url";

// Diagram exporters — text formats the user can drop into docs. We keep the
// callsites inside the Dev Mode inspector tiny (buttons → `toMermaidDiagram`
// etc.), and the output intentionally text-only so the snapshot tests remain
// stable across Pixi renderer tweaks.

export interface ExportScene {
  layout: WorkspaceLayout;
  visible: WorkspaceFileView;
}

function safeId(id: string): string {
  // Mermaid / DOT identifiers must avoid spaces, slashes, dots, dashes.
  // Prefix with `n` so a purely numeric path also parses.
  return "n" + id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function escapeMermaidLabel(s: string): string {
  return s.replace(/["`]/g, "'");
}

function escapeDotLabel(s: string): string {
  return s.replace(/"/g, '\\"');
}

function filesByLayer(files: readonly FileNode[]): Map<ArchLayer, FileNode[]> {
  const out = new Map<ArchLayer, FileNode[]>();
  for (const f of files) {
    let list = out.get(f.layer);
    if (!list) { list = []; out.set(f.layer, list); }
    list.push(f);
  }
  return out;
}

function edgeLayerArrow(layer: EdgeLayer): string {
  // Mermaid supports `-->` by default; we use dashed for safety/impact so a
  // reader can eyeball which edges are analyzer-inferred vs structural.
  switch (layer) {
    case "structural": return "-->";
    case "flow":       return "==>";
    case "safety":     return "-.->";
    case "impact":     return "==>";
  }
}

/**
 * Emit a Mermaid flowchart (TD) with subgraphs keyed by `ArchLayer`.
 * Grouping echoes the overlay's "layer" axis so the exported diagram matches
 * the HUD mental model.
 */
export function toMermaidDiagram(scene: ExportScene): string {
  const lines: string[] = ["flowchart TD"];
  const byLayer = filesByLayer(scene.visible.files);

  for (const [layer, files] of byLayer) {
    if (files.length === 0) continue;
    lines.push(`  subgraph ${safeId(`layer_${layer}`)}[${layer}]`);
    for (const f of files) {
      const label = escapeMermaidLabel(basename(f.id));
      lines.push(`    ${safeId(f.id)}["${label}"]`);
    }
    lines.push("  end");
  }

  // Edges live outside subgraphs so Mermaid doesn't auto-route them inside
  // the wrong cluster. Only include edges whose endpoints are in the visible
  // view (otherwise the exported graph would reference phantom nodes).
  const visibleIds = new Set<string>(scene.visible.files.map(f => f.id));
  for (const e of scene.visible.edges) {
    if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) continue;
    lines.push(`  ${safeId(e.from)} ${edgeLayerArrow(e.layer)}|${e.kind}| ${safeId(e.to)}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Emit a Graphviz DOT directed graph. One cluster per `ArchLayer`. Edge
 * styling keyed by `EdgeLayer`.
 */
export function toDotGraph(scene: ExportScene): string {
  const lines: string[] = ["digraph workspace {"];
  lines.push("  rankdir=LR;");
  lines.push("  node [shape=box, fontname=\"Helvetica\", fontsize=10];");
  lines.push("  edge [fontname=\"Helvetica\", fontsize=9];");

  const byLayer = filesByLayer(scene.visible.files);
  for (const [layer, files] of byLayer) {
    if (files.length === 0) continue;
    lines.push(`  subgraph cluster_${safeId(layer)} {`);
    lines.push(`    label="${layer}";`);
    lines.push(`    style=dashed; color="#9ca3af";`);
    for (const f of files) {
      const label = escapeDotLabel(basename(f.id));
      lines.push(`    ${safeId(f.id)} [label="${label}"];`);
    }
    lines.push("  }");
  }

  const visibleIds = new Set<string>(scene.visible.files.map(f => f.id));
  for (const e of scene.visible.edges) {
    if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) continue;
    const style = edgeStyle(e);
    lines.push(
      `  ${safeId(e.from)} -> ${safeId(e.to)} [label="${escapeDotLabel(e.kind)}", ${style}];`,
    );
  }

  lines.push("}");
  return lines.join("\n") + "\n";
}

function edgeStyle(e: FileEdge): string {
  switch (e.layer) {
    case "structural": return "color=\"#4b5563\", style=solid";
    case "flow":       return "color=\"#2563eb\", style=solid, penwidth=1.5";
    case "safety":     return "color=\"#dc2626\", style=dashed";
    case "impact":     return "color=\"#7c3aed\", style=bold";
  }
}

/**
 * Capture the current workspace UI state and package it as a shareable URL
 * relative to the current origin + pathname. Safe to call in non-browser
 * contexts; it falls back to a relative `?ws=` when `window` is absent.
 */
export function toShareUrl(): string {
  const state = captureWorkspaceUrlState();
  const base =
    typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "";
  return buildShareUrl(base, state);
}
