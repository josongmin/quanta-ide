import type { FileNode, WorkspaceGraph } from "@quanta/canvas-engine";

// Domain synthesis (R2)
// -------------------------------------------------------------------
// FileNode doesn't carry a `domain` field today, so the Universe-level
// view needs to project one from what's available. For a TS/JS monorepo
// the top-level path segment is already a reasonable proxy:
//   canvas-engine/graph/history.ts  → "canvas-engine"
//   app-ide/features/workspace/...  → "app-ide"
//   libs/shared/util.ts             → "shared"
//
// This module is the single place that owns the heuristic; callers
// treat the output as opaque identity strings. When a real domain
// manifest lands, this file becomes the adapter that maps path → domain
// from that manifest and the rest of the product keeps working.

export interface DomainSummary {
  id: string;
  label: string;
  fileCount: number;
  totalLoc: number;
  avgRiskScore: number;
  topAuthor: string | null;
  /** Architectural composition within the domain. */
  layerComposition: Record<string, number>;
  /** Inbound edges from other domains — cross-domain coupling. */
  inboundCrossDomain: number;
  /** Outbound to other domains — cross-domain dependency. */
  outboundCrossDomain: number;
  /** Sum of violations whose `from` is in this domain. */
  violationsOutbound: number;
}

// Path-prefix sniffer. We strip a handful of well-known nesting
// prefixes (`packages/`, `libs/`, `src/`) because the top segment after
// them is what users actually recognise as a domain. Fall back to the
// first segment otherwise.
const STRIP_PREFIXES: readonly string[] = [
  "packages/",
  "libs/",
  "p0-ide-v2/packages/",
  "p0-ide-v2/libs/",
  "src/",
];

export function synthesizeDomain(filePath: string): string {
  let rest = filePath;
  for (const p of STRIP_PREFIXES) {
    if (rest.startsWith(p)) {
      rest = rest.slice(p.length);
      break;
    }
  }
  const slash = rest.indexOf("/");
  const head = slash >= 0 ? rest.slice(0, slash) : rest;
  if (!head) return "unknown";
  // Collapse common sub-prefixes so `app-ide` + `app-home` + `app-pr`
  // all stay distinct but `canvas-engine/graph` lumps under
  // "canvas-engine".
  return head;
}

/**
 * Build a Universe-level summary of domains present in the graph.
 * Sorted by fileCount descending so the heaviest domain lands first
 * in the bubble chart / drawer list.
 */
export function summarizeDomains(
  graph: Pick<WorkspaceGraph, "files" | "fileEdges" | "blame">,
  violationsByEdgeId?: ReadonlySet<string>,
): readonly DomainSummary[] {
  const byDomain = new Map<string, {
    files: FileNode[];
    authorLines: Map<string, number>;
  }>();
  const domainOf = new Map<string, string>();

  for (const f of graph.files) {
    const d = synthesizeDomain(f.id);
    domainOf.set(f.id, d);
    let bucket = byDomain.get(d);
    if (!bucket) {
      bucket = { files: [], authorLines: new Map() };
      byDomain.set(d, bucket);
    }
    bucket.files.push(f);
  }

  // Blame: credit dominant author per file to the author-line sum.
  if (graph.blame) {
    for (const [fileId, blame] of Object.entries(graph.blame)) {
      const d = domainOf.get(fileId);
      if (!d) continue;
      const bucket = byDomain.get(d);
      if (!bucket) continue;
      for (const entry of blame.entries) {
        const span = Math.max(1, entry.endLine - entry.startLine + 1);
        bucket.authorLines.set(
          entry.author,
          (bucket.authorLines.get(entry.author) ?? 0) + span,
        );
      }
    }
  }

  // Cross-domain edges.
  const cross = new Map<string, { inbound: number; outbound: number; outboundViolations: number }>();
  for (const d of byDomain.keys()) {
    cross.set(d, { inbound: 0, outbound: 0, outboundViolations: 0 });
  }
  for (const e of graph.fileEdges) {
    const fromD = domainOf.get(e.from);
    const toD = domainOf.get(e.to);
    if (!fromD || !toD || fromD === toD) continue;
    const from = cross.get(fromD);
    const to = cross.get(toD);
    if (from) {
      from.outbound += 1;
      if (violationsByEdgeId?.has(e.id)) from.outboundViolations += 1;
    }
    if (to) to.inbound += 1;
  }

  const out: DomainSummary[] = [];
  for (const [id, bucket] of byDomain) {
    const files = bucket.files;
    const totalLoc = files.reduce((s, f) => s + f.loc, 0);
    const avgRiskScore = files.length > 0
      ? files.reduce((s, f) => s + f.riskScore, 0) / files.length
      : 0;
    let topAuthor: string | null = null;
    let topLines = 0;
    for (const [a, n] of bucket.authorLines) {
      if (n > topLines) { topLines = n; topAuthor = a; }
    }
    const layerComposition: Record<string, number> = {};
    for (const f of files) {
      layerComposition[f.layer] = (layerComposition[f.layer] ?? 0) + 1;
    }
    const x = cross.get(id) ?? { inbound: 0, outbound: 0, outboundViolations: 0 };
    out.push({
      id,
      label: id,
      fileCount: files.length,
      totalLoc,
      avgRiskScore,
      topAuthor,
      layerComposition,
      inboundCrossDomain: x.inbound,
      outboundCrossDomain: x.outbound,
      violationsOutbound: x.outboundViolations,
    });
  }
  out.sort((a, b) => {
    if (b.fileCount !== a.fileCount) return b.fileCount - a.fileCount;
    return a.id < b.id ? -1 : 1;
  });
  return out;
}
