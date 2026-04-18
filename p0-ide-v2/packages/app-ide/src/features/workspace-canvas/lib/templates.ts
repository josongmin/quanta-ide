import type { WorkspaceGraph, WorkspaceLayout, Rect } from "@quanta/canvas-engine";
import { pagesStore } from "../store/pages-store";
import { bookmarksStore, type BookmarkFilterState } from "../store/bookmarks-store";
import { viewportStore } from "../store/viewport-store";

// Templates (Batch 5 — Navigation)
// -------------------------------------------------------------------
// A template is a pre-baked "scenario page": creates a new page and
// seeds it with bookmarks computed from the current graph + layout.
//
// Bookmarks are materialized at apply-time from the live data —
// that way templates stay useful across graph swaps without needing
// hard-coded file ids.

export interface TemplateDescriptor {
  id: string;
  label: string;
  description: string;
  /** A hint about what the first few bookmarks will highlight. */
  steps: string;
  edgeFilterLayer?: "structural" | "flow" | "safety" | "impact";
}

export const TEMPLATES: readonly TemplateDescriptor[] = [
  {
    id: "template.security",
    label: "Security review",
    description:
      "Walks taint sources, sanitizers, and sinks. Filters edges to the safety layer so the tour stays focused.",
    steps: "entry → source → sanitizer → sink",
    edgeFilterLayer: "safety",
  },
  {
    id: "template.onboarding",
    label: "Onboarding tour",
    description:
      "Starts with the top-5 'start-here' files so a new engineer can orient quickly.",
    steps: "start-here #1 … #5",
  },
  {
    id: "template.postmortem",
    label: "Post-mortem",
    description:
      "Blast-radius origin followed by the affected files — use when diagnosing an incident.",
    steps: "origin → affected (high severity)",
    edgeFilterLayer: "impact",
  },
  {
    id: "template.architecture",
    label: "Architecture overview",
    description:
      "One bookmark per supercluster so a reader sees the macro shape of the repo.",
    steps: "one view per supercluster",
  },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────

function rectCenterCamera(
  rect: Rect,
  viewport: { width: number; height: number },
  scale = 0.5,
): { x: number; y: number; scale: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const vw = viewport.width > 0 ? viewport.width : 1280;
  const vh = viewport.height > 0 ? viewport.height : 720;
  return {
    x: vw / 2 - cx * scale,
    y: vh / 2 - cy * scale,
    scale,
  };
}

function boundsCamera(
  rect: Rect,
  viewport: { width: number; height: number },
): { x: number; y: number; scale: number } {
  const vw = viewport.width > 0 ? viewport.width : 1280;
  const vh = viewport.height > 0 ? viewport.height : 720;
  const pad = 0.85;
  const sx = (vw * pad) / Math.max(rect.w, 1);
  const sy = (vh * pad) / Math.max(rect.h, 1);
  const scale = Math.max(0.02, Math.min(sx, sy, 1.5));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return { x: vw / 2 - cx * scale, y: vh / 2 - cy * scale, scale };
}

interface BookmarkSeed {
  label: string;
  cameraState: { x: number; y: number; scale: number };
  filterState?: BookmarkFilterState;
}

function securityBookmarks(graph: WorkspaceGraph, layout: WorkspaceLayout, viewport: { width: number; height: number }): BookmarkSeed[] {
  // Seed a 4-step taint tour from the safety-layer edge graph.
  // Each step picks a distinct file so the storyboard doesn't
  // linger on the same card four times in a row.
  const safetyEdges = graph.fileEdges.filter(
    e => e.layer === "safety" || e.kind === "taint-propagation" || e.kind === "sanitizer",
  );
  const taintEdge = safetyEdges.find(e => e.kind === "taint-propagation");
  const sanitizerEdge = safetyEdges.find(e => e.kind === "sanitizer");

  const uiFile = graph.files.find(f => f.layer === "ui" || f.layer === "adapter");
  const domainFile = graph.files.find(f => f.layer === "domain");

  const sourceId = taintEdge?.from ?? uiFile?.id ?? graph.files[0]?.id;
  const sanitizerId = sanitizerEdge?.from ?? sanitizerEdge?.to
    ?? graph.files.find(f => f.layer === "adapter")?.id
    ?? sourceId;
  const sinkId = taintEdge?.to ?? domainFile?.id ?? graph.files.at(-1)?.id;

  const seen = new Set<string>();
  const uniq = (id?: string) => (id && !seen.has(id) ? (seen.add(id), id) : undefined);

  const filter: BookmarkFilterState = { edgeFilterQuery: "layer=safety" };
  const out: BookmarkSeed[] = [];
  const push = (label: string, fileId: string | undefined) => {
    if (!fileId) return;
    const rect = layout.fileRects.get(fileId);
    if (!rect) return;
    out.push({
      label,
      cameraState: rectCenterCamera(rect, viewport, 0.7),
      filterState: { ...filter, focusFileId: fileId },
    });
  };
  push("Entry (UI)", uniq(uiFile?.id ?? sourceId));
  push("Taint source", uniq(sourceId));
  push("Sanitizer", uniq(sanitizerId));
  push("Sink", uniq(sinkId));
  return out;
}

function onboardingBookmarks(layout: WorkspaceLayout, viewport: { width: number; height: number }): BookmarkSeed[] {
  const top = (layout.startHere ?? []).slice(0, 5);
  const out: BookmarkSeed[] = [];
  top.forEach((entry, i) => {
    const rect = layout.fileRects.get(entry.fileId);
    if (!rect) return;
    out.push({
      label: `Start #${i + 1}`,
      cameraState: rectCenterCamera(rect, viewport, 0.7),
      filterState: { focusFileId: entry.fileId },
    });
  });
  return out;
}

function postmortemBookmarks(graph: WorkspaceGraph, layout: WorkspaceLayout, viewport: { width: number; height: number }): BookmarkSeed[] {
  const scored = graph.files
    .map(f => ({ id: f.id, risk: typeof f.riskScore === "number" ? f.riskScore : 0 }))
    .sort((a, b) => b.risk - a.risk);
  const origin = scored[0]?.id;
  const affected = scored.slice(1, 4).map(s => s.id);
  const filter: BookmarkFilterState = { edgeFilterQuery: "severity>=high" };
  const out: BookmarkSeed[] = [];
  if (origin) {
    const rect = layout.fileRects.get(origin);
    if (rect) {
      out.push({
        label: "Origin",
        cameraState: rectCenterCamera(rect, viewport, 0.8),
        filterState: { ...filter, focusFileId: origin },
      });
    }
  }
  affected.forEach((fileId, i) => {
    const rect = layout.fileRects.get(fileId);
    if (!rect) return;
    out.push({
      label: `Affected ${i + 1}`,
      cameraState: rectCenterCamera(rect, viewport, 0.7),
      filterState: { ...filter, focusFileId: fileId },
    });
  });
  return out;
}

function architectureBookmarks(layout: WorkspaceLayout, viewport: { width: number; height: number }): BookmarkSeed[] {
  const supers = layout.superclusters ?? [];
  const out: BookmarkSeed[] = [];
  for (const sc of supers) {
    out.push({
      label: sc.id,
      cameraState: boundsCamera(sc.rect, viewport),
    });
  }
  // Fallback: no superclusters (e.g. grid layout) → one per cluster.
  if (out.length === 0) {
    const clusters = layout.clusters ?? [];
    for (const c of clusters.slice(0, 8)) {
      out.push({ label: c.id, cameraState: boundsCamera(c.rect, viewport) });
    }
  }
  return out;
}

function buildSeeds(
  template: TemplateDescriptor,
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  viewport: { width: number; height: number },
): BookmarkSeed[] {
  switch (template.id) {
    case "template.security": return securityBookmarks(graph, layout, viewport);
    case "template.onboarding": return onboardingBookmarks(layout, viewport);
    case "template.postmortem": return postmortemBookmarks(graph, layout, viewport);
    case "template.architecture": return architectureBookmarks(layout, viewport);
    default: return [];
  }
}

export interface ApplyTemplateResult {
  pageId: string;
  bookmarkIds: readonly string[];
  seeded: number;
}

/**
 * Apply a template: create a new page, seed bookmarks from current
 * graph + layout. If the graph isn't ready yet (no layout / empty),
 * the page is still created but no bookmarks are seeded — a toast
 * should inform the user.
 */
export function applyTemplate(
  templateId: string,
  graph: WorkspaceGraph | null,
  layout: WorkspaceLayout | null,
): ApplyTemplateResult {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  const pageId = pagesStore.create(template.label, {
    description: template.description,
  });

  const bookmarkIds: string[] = [];
  if (graph && layout) {
    const vp = viewportStore.getState().viewport;
    const seeds = buildSeeds(template, graph, layout, { width: vp.width, height: vp.height });
    seeds.forEach((seed, i) => {
      const id = bookmarksStore.create({
        pageId,
        label: seed.label,
        cameraState: seed.cameraState,
        filterState: seed.filterState,
        order: i,
      });
      bookmarkIds.push(id);
    });
  }

  return { pageId, bookmarkIds, seeded: bookmarkIds.length };
}
