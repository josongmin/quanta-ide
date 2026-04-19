import type { FileNode, FileEdge, ArchLayer } from "./types";

// Architectural drift detector.
//
// Given two snapshots of the same workspace — A (the "golden" baseline) and
// B (the current state) — produce a ranked list of files whose effective
// responsibility has drifted. Drift is what makes a clean architecture rot:
// a utility module grows infra callers, a small file's fan-out quietly
// explodes, or a file gets pulled into a new cycle. Each of those is a
// different kind of rot; the detector surfaces them as typed findings so
// the HUD can route users to the right remediation.
//
// Four rules (see `DriftFinding["kind"]`):
//   - layer-escalation: file was `util` in A but now has incoming edges
//     from infra/ui layers in B — the utility has leaked upward.
//   - fanout-explosion: (out-)degree grew more than 2× AND by more than 5
//     absolute edges. Coupled files that suddenly sprout dependencies are
//     almost always under-designed.
//   - new-cycle-member: file joined an SCC in B that it wasn't in within
//     A's SCCs — a fresh cycle surfaced or an existing SCC absorbed a
//     new member.
//   - ownership-shift: placeholder until blame integration lands.
//
// The algorithm is intentionally snapshot-only (no history walk): callers
// pick A and B from two points of interest (e.g. release-1 vs. HEAD) and
// the detector compares them deterministically. This keeps the module pure
// and cheap enough to run inside the worker.

export interface DriftFinding {
  fileId: string;
  kind:
    | "layer-escalation"
    | "fanout-explosion"
    | "new-cycle-member"
    | "ownership-shift";
  severity: "low" | "medium" | "high";
  /** Human-readable one-liner for HUD display. */
  detail: string;
  before: { layer: ArchLayer; degree: number };
  after: { layer: ArchLayer; degree: number };
}

export interface DriftSnapshot {
  files: FileNode[];
  fileEdges: FileEdge[];
  /** Optional SCC components (file-id lists). When omitted, the cycle rule is skipped. */
  sccs?: readonly (readonly string[])[];
}

const FANOUT_RATIO = 2;
const FANOUT_DELTA = 5;
const CALLER_LAYERS: ReadonlySet<ArchLayer> = new Set<ArchLayer>(["infra", "ui"]);

const SEVERITY_RANK: Record<DriftFinding["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

interface FileSummary {
  file: FileNode;
  degree: number;
  incomingFromLayer: Set<ArchLayer>;
}

function summarise(snap: DriftSnapshot): Map<string, FileSummary> {
  const layerOf = new Map<string, ArchLayer>();
  for (const f of snap.files) layerOf.set(f.id, f.layer);

  const out = new Map<string, FileSummary>();
  for (const f of snap.files) {
    out.set(f.id, { file: f, degree: 0, incomingFromLayer: new Set() });
  }
  for (const e of snap.fileEdges) {
    const from = out.get(e.from);
    const to = out.get(e.to);
    if (from) from.degree += 1;
    if (to) {
      to.degree += 1;
      const layer = layerOf.get(e.from);
      if (layer) to.incomingFromLayer.add(layer);
    }
  }
  return out;
}

function sccMembership(sccs?: readonly (readonly string[])[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!sccs) return map;
  sccs.forEach((members, idx) => {
    for (const m of members) map.set(m, idx);
  });
  return map;
}

/**
 * Compare two workspace snapshots and emit typed drift findings.
 * Results are sorted by severity descending; stable by fileId for ties so
 * the HUD order is deterministic across runs.
 */
export function detectDrift(
  before: DriftSnapshot,
  after: DriftSnapshot,
): DriftFinding[] {
  const beforeSummary = summarise(before);
  const afterSummary = summarise(after);
  const beforeScc = sccMembership(before.sccs);
  const afterScc = sccMembership(after.sccs);

  const findings: DriftFinding[] = [];

  for (const [id, a] of afterSummary) {
    const b = beforeSummary.get(id);
    const beforeLayer: ArchLayer = b?.file.layer ?? "unknown";
    const afterLayer: ArchLayer = a.file.layer;
    const beforeDegree = b?.degree ?? 0;
    const afterDegree = a.degree;

    // layer-escalation — file was `util` in A but now gets called from
    // infra/ui. Escalation severity scales with how many forbidden layers
    // point at it.
    if (b && beforeLayer === "util" && afterLayer === "util") {
      const callers = [...a.incomingFromLayer].filter(l => CALLER_LAYERS.has(l));
      if (callers.length > 0) {
        findings.push({
          fileId: id,
          kind: "layer-escalation",
          severity: callers.length >= 2 ? "high" : "medium",
          detail: `util now called from ${callers.join(", ")}`,
          before: { layer: beforeLayer, degree: beforeDegree },
          after: { layer: afterLayer, degree: afterDegree },
        });
      }
    }

    // fanout-explosion — degree grew >2× AND by >5 absolute. The ratio
    // catches "3 to 7" (small but still meaningful); the delta filter
    // suppresses noise from tiny files where 2→4 is not interesting.
    if (
      beforeDegree > 0 &&
      afterDegree > beforeDegree * FANOUT_RATIO &&
      afterDegree - beforeDegree > FANOUT_DELTA
    ) {
      const delta = afterDegree - beforeDegree;
      const sev: DriftFinding["severity"] =
        delta >= 20 ? "high" : delta >= 10 ? "medium" : "low";
      findings.push({
        fileId: id,
        kind: "fanout-explosion",
        severity: sev,
        detail: `degree ${beforeDegree} → ${afterDegree} (+${delta})`,
        before: { layer: beforeLayer, degree: beforeDegree },
        after: { layer: afterLayer, degree: afterDegree },
      });
    }

    // new-cycle-member — file joined an SCC in B that it wasn't in within
    // A. Severity scales with the size of the newly-joined cycle.
    const afterIdx = afterScc.get(id);
    if (afterIdx !== undefined) {
      const beforeIdx = beforeScc.get(id);
      if (beforeIdx === undefined) {
        const cycleSize = after.sccs?.[afterIdx]?.length ?? 0;
        const sev: DriftFinding["severity"] =
          cycleSize >= 5 ? "high" : cycleSize >= 3 ? "medium" : "low";
        findings.push({
          fileId: id,
          kind: "new-cycle-member",
          severity: sev,
          detail: `joined cycle of ${cycleSize} files`,
          before: { layer: beforeLayer, degree: beforeDegree },
          after: { layer: afterLayer, degree: afterDegree },
        });
      }
    }

    // ownership-shift — placeholder; surfaced only when blame is threaded
    // through in a future revision. The rule shape stays stable so the
    // HUD can render it once data lands.
  }

  findings.sort((x, y) => {
    const ds = SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity];
    if (ds !== 0) return ds;
    return x.fileId < y.fileId ? -1 : x.fileId > y.fileId ? 1 : 0;
  });

  return findings;
}
