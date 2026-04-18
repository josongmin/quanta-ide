import { rankStartHere } from "@quanta/canvas-engine";
import type { WorkspaceGraph, WorkspaceLayout, WorkspaceMetrics } from "@quanta/canvas-engine";
import type { Sticky } from "../store/stickies-store";
import type {
  AiService,
  Anomaly,
  AnomalyKind,
  AnomalySeverity,
  ClusterStickiesResult,
  DetectAnomaliesResult,
  GenerateTourResult,
  NlToDslContext,
  NlToDslResult,
  StickyCluster,
  TourStep,
} from "./ai-service";

// Deterministic mock implementation of AiService. Uses small heuristics
// so the UX matches what a real model would produce (same shape, similar
// latency, vaguely plausible text). Swapping this for a real LLM is a
// drop-in change — every call site reads only from the AiService
// interface, never from this module directly.

const FAKE_LATENCY_MS = 300;

async function wait(ms: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, ms));
}

// ── NL → DSL ─────────────────────────────────────────────────────────
//
// Keyword → DSL translation table. Order matters — the first matching
// rule wins. Each rule's `test` must match the whole normalized query
// (lowercase, collapsed whitespace). The explanation is user-facing and
// the confidence is our deterministic guess at how well the phrase maps
// to the DSL we produced; low-confidence fallbacks pick a broad filter
// rather than something strict that might hide real edges.

interface NlRule {
  test: (q: string) => boolean;
  dsl: string;
  confidence: number;
  explanation: string;
}

const NL_RULES: readonly NlRule[] = [
  {
    test: q => q.includes("taint") && (q.includes("db") || q.includes("database") || q.includes("sink")),
    dsl: "kind=taint-propagation and severity>=high",
    confidence: 0.9,
    explanation: "High-severity taint propagation (typical DB sink path).",
  },
  {
    test: q => q.includes("taint"),
    dsl: "kind=taint-propagation",
    confidence: 0.85,
    explanation: "All taint-propagation edges.",
  },
  {
    test: q => q.includes("safety") && (q.includes("auth") || q.includes("login")),
    dsl: "layer=safety and kind!=reference",
    confidence: 0.8,
    explanation: "Safety-layer edges, excluding plain references.",
  },
  {
    test: q => q.includes("safety") || q.includes("security"),
    dsl: "layer=safety",
    confidence: 0.82,
    explanation: "All safety-layer edges.",
  },
  {
    test: q => q.includes("critical"),
    dsl: "severity>=critical",
    confidence: 0.88,
    explanation: "Only critical-severity edges.",
  },
  {
    test: q => q.includes("high") && q.includes("sever"),
    dsl: "severity>=high",
    confidence: 0.86,
    explanation: "Edges at high severity or above.",
  },
  {
    test: q => q.includes("impact") || q.includes("blast"),
    dsl: "layer=impact",
    confidence: 0.8,
    explanation: "Impact-layer edges (blast / diff / dependency).",
  },
  {
    test: q => q.includes("flow") || q.includes("dataflow"),
    dsl: "layer=flow",
    confidence: 0.8,
    explanation: "Flow-layer edges (dataflow / pdg / alias).",
  },
  {
    test: q => q.includes("import") && q.includes("only"),
    dsl: "kind=import",
    confidence: 0.9,
    explanation: "Import edges only.",
  },
  {
    test: q => q.includes("cycle") || q.includes("circular"),
    dsl: "kind=cycle",
    confidence: 0.85,
    explanation: "Cycle edges (structural circular dependencies).",
  },
  {
    test: q => q.includes("animated") || q.includes("moving"),
    dsl: "animated=true",
    confidence: 0.75,
    explanation: "Edges marked as animated by the renderer.",
  },
  {
    test: q => q.includes("call"),
    dsl: "kind=call",
    confidence: 0.82,
    explanation: "Call edges.",
  },
];

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

async function naturalLanguageToDsl(query: string, _context: NlToDslContext): Promise<NlToDslResult> {
  await wait(FAKE_LATENCY_MS);
  const q = normalize(query);
  if (q.length === 0) {
    return {
      dsl: "",
      confidence: 1,
      explanation: "Empty query — returning no filter (all edges).",
    };
  }
  for (const rule of NL_RULES) {
    if (rule.test(q)) {
      return { dsl: rule.dsl, confidence: rule.confidence, explanation: rule.explanation };
    }
  }
  return {
    dsl: "layer=safety or layer=impact",
    confidence: 0.4,
    explanation: "No close match — falling back to safety + impact layers.",
  };
}

// ── Cluster stickies ─────────────────────────────────────────────────
//
// Extract token buckets from sticky text. A sticky joins a bucket if it
// shares >=2 tokens with the bucket's canonical set. Greedy, single-pass;
// label is the single most frequent token across the bucket's stickies.
// Not optimal, but deterministic and O(N * K) where K is avg tokens
// per sticky — good enough for the scale of ad-hoc sticky clusters
// (50 stickies max in practice).

const STOPWORDS: ReadonlySet<string> = new Set([
  "the", "a", "an", "and", "or", "but", "not", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "should", "could", "can", "may", "might", "must",
  "to", "of", "in", "on", "at", "for", "with", "by", "from", "up", "about",
  "into", "through", "during", "before", "after", "above", "below", "this",
  "that", "these", "those", "it", "its", "as", "if", "then", "so", "than",
  "too", "very", "you", "your", "we", "our", "i", "my", "me",
]);

function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g);
  if (!raw) return [];
  const out: string[] = [];
  for (const t of raw) {
    if (STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

interface Bucket {
  tokens: Set<string>;
  stickyIds: string[];
  tokenCounts: Map<string, number>;
}

function dominantToken(counts: Map<string, number>): string {
  let bestToken = "";
  let bestCount = 0;
  // Deterministic tie-break: alphabetically-earlier token wins.
  const keys = [...counts.keys()].sort();
  for (const k of keys) {
    const c = counts.get(k) ?? 0;
    if (c > bestCount) {
      bestCount = c;
      bestToken = k;
    }
  }
  return bestToken;
}

async function clusterStickies(stickies: readonly Sticky[]): Promise<ClusterStickiesResult> {
  await wait(FAKE_LATENCY_MS);
  if (stickies.length === 0) return { clusters: [] };

  const buckets: Bucket[] = [];
  const loners: Sticky[] = [];

  for (const s of stickies) {
    const tokens = tokenize(s.text);
    if (tokens.length === 0) {
      loners.push(s);
      continue;
    }
    const tokenSet = new Set(tokens);
    let placed = false;
    for (const b of buckets) {
      let overlap = 0;
      for (const t of tokenSet) {
        if (b.tokens.has(t)) {
          overlap++;
          if (overlap >= 2) break;
        }
      }
      if (overlap >= 2) {
        b.stickyIds.push(s.id);
        for (const t of tokenSet) {
          b.tokens.add(t);
          b.tokenCounts.set(t, (b.tokenCounts.get(t) ?? 0) + 1);
        }
        placed = true;
        break;
      }
    }
    if (!placed) {
      const counts = new Map<string, number>();
      for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
      buckets.push({
        tokens: tokenSet,
        stickyIds: [s.id],
        tokenCounts: counts,
      });
    }
  }

  const clusters: StickyCluster[] = [];
  for (const b of buckets) {
    if (b.stickyIds.length < 2) {
      // Singleton bucket — demote to loner so we don't label one-sticky
      // groups (adds more noise than signal).
      loners.push({ id: b.stickyIds[0] } as Sticky);
      continue;
    }
    const label = dominantToken(b.tokenCounts) || "cluster";
    clusters.push({
      label,
      stickyIds: [...b.stickyIds],
      reasoning: `${b.stickyIds.length} stickies share "${label}" and ${b.tokens.size - 1} related terms.`,
    });
  }

  if (loners.length > 0) {
    clusters.push({
      label: "other",
      stickyIds: loners.map(s => s.id),
      reasoning: `${loners.length} sticker${loners.length === 1 ? "" : "s"} did not share 2+ tokens with any group.`,
    });
  }

  // Deterministic ordering — largest cluster first, then alphabetically.
  clusters.sort((a, b) => {
    const d = b.stickyIds.length - a.stickyIds.length;
    if (d !== 0) return d;
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });

  return { clusters };
}

// ── Generate tour ────────────────────────────────────────────────────
//
// Use `rankStartHere` to pick 5 entry points. Narration template blends
// the file's layer and risk score so each line carries different
// information; focusHops is chosen from the file's degree so highly-
// connected files get a wider neighbourhood focus.

const LAYER_PHRASE: Record<string, string> = {
  domain: "core domain logic",
  adapter: "adapter to the outside world",
  infra: "infrastructure plumbing",
  ui: "UI surface",
  util: "shared utility",
  unknown: "module",
};

function riskPhrase(risk: number): string {
  if (risk >= 75) return "— flagged high-risk by static analysis";
  if (risk >= 50) return "— moderate risk signals";
  if (risk >= 25) return "— some risk indicators";
  return "";
}

async function generateTour(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
): Promise<GenerateTourResult> {
  await wait(FAKE_LATENCY_MS);
  const metrics = layout.metrics;
  if (!metrics || graph.files.length === 0) {
    return { steps: [] };
  }
  const top = rankStartHere(graph, metrics, 5);
  const byId = new Map(graph.files.map(f => [f.id, f]));
  const steps: TourStep[] = [];
  for (const entry of top) {
    const file = byId.get(entry.fileId);
    if (!file) continue;
    const layer = LAYER_PHRASE[file.layer] ?? file.layer;
    const fm = metrics.perFile.get(file.id);
    const degree = fm?.degree ?? 0;
    const focusHops = degree >= 10 ? 2 : 1;
    const parts = [
      `Stop ${entry.rank}: ${file.name}`,
      `— ${layer}`,
      riskPhrase(file.riskScore),
    ].filter(s => s.length > 0);
    const narration = `${parts.join(" ")}. ${degree} direct neighbour${degree === 1 ? "" : "s"}.`;
    steps.push({ fileId: file.id, narration, focusHops });
  }
  return { steps };
}

// ── Detect anomalies ─────────────────────────────────────────────────
//
// Three heuristic rules:
//   1. coupling-spike: degree is above the 95th percentile.
//   2. cycle-gone-hot: file participates in a non-trivial SCC.
//   3. unreachable:    inDegree==0 and layer is not an "entry" layer.

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

const ENTRY_LAYERS: ReadonlySet<string> = new Set(["ui", "adapter"]);

async function detectAnomalies(
  graph: WorkspaceGraph,
  metrics: WorkspaceMetrics,
): Promise<DetectAnomaliesResult> {
  await wait(FAKE_LATENCY_MS);
  if (graph.files.length === 0) return { anomalies: [] };

  const out: Anomaly[] = [];
  const byId = new Map(graph.files.map(f => [f.id, f]));

  // Coupling-spike — any file with degree >= p95. Skip when every file has
  // the same degree (no spike exists).
  const degrees: number[] = [];
  for (const fm of metrics.perFile.values()) degrees.push(fm.degree);
  const p95 = percentile(degrees, 0.95);
  if (p95 > 0) {
    for (const [fileId, fm] of metrics.perFile) {
      if (fm.degree >= p95 && fm.degree > 0) {
        const severity: AnomalySeverity = fm.degree >= p95 * 1.5 ? "high" : "med";
        out.push({
          kind: "coupling-spike",
          fileId,
          severity,
          explanation: `Degree ${fm.degree} sits at or above the 95th-percentile cutoff (${p95}).`,
        });
      }
    }
  }

  // Cycle-gone-hot — any non-trivial SCC (size >= 2) is surfaced. This is
  // intentionally broad for the mock; a real model could narrow based on
  // rate of change in cycle size.
  const seenInCycle = new Set<string>();
  // Build adjacency for a Tarjan walk — but we can reuse the analyzer
  // if the layout carries SCC info. Here we only have `metrics`, so do
  // a light local cycle check via simple back-edge detection on
  // import/call edges.
  const adj = new Map<string, string[]>();
  for (const f of graph.files) adj.set(f.id, []);
  for (const e of graph.fileEdges) {
    if (e.kind !== "import" && e.kind !== "call") continue;
    adj.get(e.from)?.push(e.to);
  }
  // Tarjan iterative — same shape as scc.ts but simplified for a
  // one-shot pass; if any SCC >= 2 nodes we mark each member hot.
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let nextIdx = 0;
  type Frame = { node: string; i: number; succ: string[] };
  for (const root of adj.keys()) {
    if (index.has(root)) continue;
    const work: Frame[] = [{ node: root, i: 0, succ: adj.get(root) ?? [] }];
    index.set(root, nextIdx); lowlink.set(root, nextIdx); nextIdx++;
    stack.push(root); onStack.add(root);
    while (work.length > 0) {
      const top = work[work.length - 1];
      if (top.i < top.succ.length) {
        const w = top.succ[top.i++];
        if (!index.has(w)) {
          index.set(w, nextIdx); lowlink.set(w, nextIdx); nextIdx++;
          stack.push(w); onStack.add(w);
          work.push({ node: w, i: 0, succ: adj.get(w) ?? [] });
        } else if (onStack.has(w)) {
          lowlink.set(top.node, Math.min(lowlink.get(top.node)!, index.get(w)!));
        }
      } else {
        if (lowlink.get(top.node) === index.get(top.node)) {
          const comp: string[] = [];
          // Pop until we see top.node.
          while (true) {
            const n = stack.pop();
            if (n === undefined) break;
            onStack.delete(n);
            comp.push(n);
            if (n === top.node) break;
          }
          if (comp.length >= 2) {
            for (const m of comp) seenInCycle.add(m);
          }
        }
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1];
          lowlink.set(parent.node, Math.min(lowlink.get(parent.node)!, lowlink.get(top.node)!));
        }
      }
    }
  }
  for (const fileId of seenInCycle) {
    out.push({
      kind: "cycle-gone-hot",
      fileId,
      severity: "med",
      explanation: "Participates in an import/call cycle (strongly-connected component).",
    });
  }

  // Unreachable — inDegree==0 AND layer not considered an entry.
  for (const [fileId, fm] of metrics.perFile) {
    if (fm.inDegree !== 0) continue;
    const file = byId.get(fileId);
    if (!file) continue;
    if (ENTRY_LAYERS.has(file.layer)) continue;
    // Skip if the file is completely disconnected (degree==0); that's
    // more likely a parse artifact than an anomaly.
    if (fm.degree === 0) continue;
    out.push({
      kind: "unreachable",
      fileId,
      severity: "low",
      explanation: `No inbound imports/calls but has ${fm.outDegree} outbound edge${fm.outDegree === 1 ? "" : "s"}.`,
    });
  }

  // Deterministic ordering: by severity (high > med > low), then fileId.
  const sevRank: Record<AnomalySeverity, number> = { high: 2, med: 1, low: 0 };
  out.sort((a, b) => {
    const d = sevRank[b.severity] - sevRank[a.severity];
    if (d !== 0) return d;
    return a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0;
  });

  return { anomalies: out };
}

// Explicit export so consumers can reason about the set of kinds.
export const ANOMALY_KINDS: readonly AnomalyKind[] = [
  "coupling-spike",
  "cycle-gone-hot",
  "unreachable",
  "owner-drift",
] as const;

/**
 * Factory — every consumer of AiService should resolve through this (or
 * a sibling real factory) so the contract stays the only coupling point
 * between UI and model.
 */
export function createMockAiService(): AiService {
  return {
    naturalLanguageToDsl,
    clusterStickies,
    generateTour,
    detectAnomalies,
  };
}
