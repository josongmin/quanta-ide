import { rankStartHere, diffSnapshots } from "@quanta/canvas-engine";
import type {
  FileEdge,
  GraphHistory,
  GraphSnapshot,
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceMetrics,
} from "@quanta/canvas-engine";
import type { Sticky } from "../store/stickies-store";
import type {
  AiService,
  Anomaly,
  AnomalyKind,
  AnomalySeverity,
  AttributeRegressionInput,
  AttributeRegressionResult,
  ClusterStickiesResult,
  DetectAnomaliesResult,
  GenerateTourResult,
  NarrateCommitInput,
  NarrateCommitResult,
  NlToDslContext,
  NlToDslResult,
  PredictFutureInput,
  PredictFutureResult,
  RegressionCandidate,
  StickyCluster,
  StreamEditChunk,
  StreamEditInput,
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

// ── Temporal helpers ─────────────────────────────────────────────────
//
// The mock synthesizes commit SHAs from (snapshotIndex × timestamp) so
// its values line up with MockHistorySource. Callers pass SHAs through
// from either source and we look them up either by direct
// `snap.commitSha` (if the snapshot carried one) or by recomputing the
// same deterministic hash.

const MOCK_AI_AUTHORS = ["alice", "bob", "charlie", "dana"] as const;

function mockShortShaFor(index: number, timestamp: number): string {
  const n = (index * 2654435761) ^ (timestamp | 0);
  return (n >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}

function mockLongShaFor(index: number, timestamp: number): string {
  const head = mockShortShaFor(index, timestamp);
  let acc = (index + 1) * 2246822519;
  const parts: string[] = [head];
  for (let i = 0; i < 5; i++) {
    acc = (acc ^ (acc << 13)) >>> 0;
    acc = (acc ^ (acc >>> 17)) >>> 0;
    acc = (acc ^ (acc << 5)) >>> 0;
    parts.push((acc >>> 0).toString(16).padStart(8, "0"));
  }
  return parts.join("").slice(0, 40);
}

function snapshotShas(history: GraphHistory): string[] {
  const out: string[] = [];
  for (let i = 0; i < history.snapshots.length; i++) {
    const snap = history.snapshots[i];
    out.push(snap.commitSha ?? mockLongShaFor(i, snap.timestamp));
  }
  return out;
}

function snapshotIndexForSha(history: GraphHistory, sha: string): number {
  const shas = snapshotShas(history);
  for (let i = 0; i < shas.length; i++) {
    if (shas[i] === sha) return i;
  }
  return -1;
}

function filesTouchedAt(
  history: GraphHistory,
  index: number,
  edgeById: ReadonlyMap<string, FileEdge>,
): string[] {
  const snap = history.snapshots[index];
  if (!snap) return [];
  if (index === 0) {
    // Seed snapshot — collect touched files from its absolute set.
    const edgeIds = snap.edgeIds ?? snap.added ?? [];
    return uniqueFilesForEdges(edgeIds, edgeById);
  }
  if (snap.added || snap.removed) {
    const ids = [...(snap.added ?? []), ...(snap.removed ?? [])];
    return uniqueFilesForEdges(ids, edgeById);
  }
  if (snap.edgeIds) {
    const diff = diffSnapshots(history, index - 1, index);
    return uniqueFilesForEdges([...diff.added, ...diff.removed], edgeById);
  }
  return [];
}

function uniqueFilesForEdges(
  edgeIds: readonly string[],
  edgeById: ReadonlyMap<string, FileEdge>,
): string[] {
  const set = new Set<string>();
  for (const id of edgeIds) {
    const e = edgeById.get(id);
    if (!e) continue;
    set.add(e.from);
    set.add(e.to);
  }
  return [...set].sort();
}

function fuzzyFileMatchScore(fileId: string, testName: string, log: string): number {
  const path = fileId.toLowerCase();
  const name = path.split("/").pop() ?? path;
  const stem = name.replace(/\.[a-z0-9]+$/, "");
  const hay: string[] = [path, name, stem];
  const tokens = tokenizeForMatch(`${testName} ${log}`);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) {
    for (const h of hay) {
      if (h.includes(t)) { hits++; break; }
    }
  }
  return hits;
}

function tokenizeForMatch(s: string): string[] {
  const raw = s.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g);
  if (!raw) return [];
  const out: string[] = [];
  for (const t of raw) {
    if (STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

function basenameFor(fileId: string): string {
  const i = fileId.lastIndexOf("/");
  return i >= 0 ? fileId.slice(i + 1) : fileId;
}

// ── attributeRegression ──────────────────────────────────────────────

async function attributeRegression(input: AttributeRegressionInput): Promise<AttributeRegressionResult> {
  await wait(FAKE_LATENCY_MS);
  const { testName, failureLog, graph, history } = input;
  const snaps = history.snapshots;
  if (snaps.length === 0) {
    return { candidateCommits: [], affectedFileIds: [], narration: "No history — nothing to attribute." };
  }
  const edgeById = new Map<string, FileEdge>();
  for (const e of graph.fileEdges) edgeById.set(e.id, e);
  const shas = snapshotShas(history);

  const fileRelevance = new Map<string, number>();
  for (const f of graph.files) {
    const s = fuzzyFileMatchScore(f.id, testName, failureLog);
    if (s > 0) fileRelevance.set(f.id, s);
  }

  const lookAheadMax = Math.min(snaps.length, 20);
  const scored: {
    index: number;
    score: number;
    matchedFiles: string[];
    touchedCount: number;
  }[] = [];
  for (let k = 0; k < lookAheadMax; k++) {
    const index = snaps.length - 1 - k;
    if (index <= 0) break;
    const touched = filesTouchedAt(history, index, edgeById);
    if (touched.length === 0) continue;
    let matchScore = 0;
    const matched: string[] = [];
    for (const fid of touched) {
      const rel = fileRelevance.get(fid);
      if (!rel) continue;
      matchScore += rel;
      matched.push(fid);
    }
    if (matchScore === 0) continue;
    const recency = Math.pow(0.85, k);
    scored.push({
      index,
      score: matchScore * recency,
      matchedFiles: matched.sort(),
      touchedCount: touched.length,
    });
  }

  if (scored.length === 0) {
    for (let k = 0; k < lookAheadMax && scored.length < 3; k++) {
      const index = snaps.length - 1 - k;
      if (index <= 0) break;
      const touched = filesTouchedAt(history, index, edgeById);
      if (touched.length === 0) continue;
      scored.push({
        index,
        score: Math.pow(0.85, k),
        matchedFiles: [],
        touchedCount: touched.length,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.index - a.index;
  });
  const top = scored.slice(0, 3);
  const totalScore = top.reduce((acc, t) => acc + t.score, 0);

  const candidateCommits: RegressionCandidate[] = top.map(t => {
    const snap = snaps[t.index];
    const confidence = totalScore > 0
      ? Number((t.score / totalScore).toFixed(3))
      : Number((1 / top.length).toFixed(3));
    const matched = t.matchedFiles.slice(0, 2).map(basenameFor).join(", ");
    const reason = t.matchedFiles.length > 0
      ? `Touched ${t.touchedCount} file${t.touchedCount === 1 ? "" : "s"} including ${matched}`
      : `Touched ${t.touchedCount} file${t.touchedCount === 1 ? "" : "s"} at ${snap.label}`;
    return { sha: shas[t.index], confidence, reason };
  });

  const affected = new Set<string>();
  for (const t of top) for (const f of t.matchedFiles) affected.add(f);

  const narration = buildAttributionNarration(testName, top, snaps);

  return {
    candidateCommits,
    affectedFileIds: [...affected].sort(),
    narration,
  };
}

function buildAttributionNarration(
  testName: string,
  top: readonly { index: number; matchedFiles: string[] }[],
  snaps: readonly GraphSnapshot[],
): string {
  if (top.length === 0) {
    return `No commits in the last 20 snapshots touched files relevant to "${testName || "this failure"}".`;
  }
  const first = top[0];
  const head = testName
    ? `For "${testName}", `
    : "For the failure log supplied, ";
  const headSnap = snaps[first.index];
  const lead = first.matchedFiles.length > 0
    ? `the top candidate is ${headSnap.label} — touching ${first.matchedFiles.slice(0, 2).map(basenameFor).join(" and ")}.`
    : `the newest non-empty commit (${headSnap.label}) is flagged as the likely source.`;
  const rest = top.length > 1
    ? ` Back-up candidates: ${top.slice(1).map(t => snaps[t.index].label).join(", ")}.`
    : "";
  return `${head}${lead}${rest} Walk the list from top — the confidence bars reflect how strongly each commit overlaps the failure signal.`;
}

// ── predictFuture ────────────────────────────────────────────────────

async function predictFuture(input: PredictFutureInput): Promise<PredictFutureResult> {
  await wait(FAKE_LATENCY_MS);
  const { graph, history, horizonDays } = input;
  const snaps = history.snapshots;
  const horizon = Math.max(1, Math.round(horizonDays));

  if (snaps.length < 2) {
    return {
      expectedNewFiles: 0,
      expectedNewEdges: 0,
      expectedNewCycles: [],
      hottestFilesForecast: [],
      narration: "Need at least 2 snapshots to project a trend.",
    };
  }

  const days: number[] = [];
  const edgeCounts: number[] = [];
  const firstTs = snaps[0].timestamp;
  const edgeById = new Map<string, FileEdge>();
  for (const e of graph.fileEdges) edgeById.set(e.id, e);
  let acc = 0;
  for (let i = 0; i < snaps.length; i++) {
    if (i === 0) {
      acc = (snaps[0].edgeIds ?? snaps[0].added ?? []).length;
    } else {
      const d = diffSnapshots(history, i - 1, i);
      acc += d.added.size - d.removed.size;
    }
    const dayOffset = Math.round((snaps[i].timestamp - firstTs) / 86_400_000);
    days.push(dayOffset);
    edgeCounts.push(Math.max(0, acc));
  }

  const slope = ols(days, edgeCounts);
  const lastEdges = edgeCounts[edgeCounts.length - 1];
  const projectedEdges = lastEdges + slope * horizon;
  const expectedNewEdges = Math.max(0, Math.round(projectedEdges - lastEdges));

  const density = graph.files.length > 0 ? graph.fileEdges.length / graph.files.length : 1;
  const expectedNewFiles = Math.min(20, Math.max(0, Math.round(expectedNewEdges / Math.max(1, density))));

  const churn = new Map<string, number>();
  const deltaWindowStart = Math.max(1, snaps.length - 3);
  for (let i = deltaWindowStart; i < snaps.length; i++) {
    const d = diffSnapshots(history, i - 1, i);
    for (const eid of [...d.added, ...d.removed]) {
      const edge = edgeById.get(eid);
      if (!edge) continue;
      churn.set(edge.from, (churn.get(edge.from) ?? 0) + 1);
      churn.set(edge.to, (churn.get(edge.to) ?? 0) + 1);
    }
  }
  const ranked = [...churn.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : 1;
  });
  const expectedNewCycles = ranked.slice(0, 5).map(([fid]) => fid);
  const hottestFilesForecast = ranked.slice(0, 8).map(([fid]) => fid);

  const slopePerDay = slope.toFixed(2);
  const narration =
    `In the next ${horizon}d at the current rate (~${slopePerDay} edges/day), ` +
    `expect +${expectedNewEdges} edges and ~+${expectedNewFiles} files. ` +
    (expectedNewCycles.length > 0
      ? `${expectedNewCycles.length} file${expectedNewCycles.length === 1 ? "" : "s"} are gaining edges fast and may form cycles.`
      : `No files stand out as cycle-risk over the last 3 commits.`);

  return {
    expectedNewFiles,
    expectedNewEdges,
    expectedNewCycles,
    hottestFilesForecast,
    narration,
  };
}

function ols(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n;
  const my = sy / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

// ── narrateCommit ────────────────────────────────────────────────────

async function narrateCommit(input: NarrateCommitInput): Promise<NarrateCommitResult> {
  await wait(FAKE_LATENCY_MS);
  const { sha, graph, history } = input;
  const index = snapshotIndexForSha(history, sha);
  if (index < 0) {
    return {
      summary: `No snapshot found for ${sha.slice(0, 7)}.`,
      highlights: [],
    };
  }
  const snap = history.snapshots[index];
  const edgeById = new Map<string, FileEdge>();
  for (const e of graph.fileEdges) edgeById.set(e.id, e);

  const touched = filesTouchedAt(history, index, edgeById);
  const byFileCount = new Map<string, number>();
  let addedCount: number;
  let removedCount = 0;
  const deltaIds: string[] = [];
  if (index === 0) {
    addedCount = (snap.edgeIds ?? snap.added ?? []).length;
    for (const id of snap.edgeIds ?? snap.added ?? []) deltaIds.push(id);
  } else {
    const d = diffSnapshots(history, index - 1, index);
    addedCount = d.added.size;
    removedCount = d.removed.size;
    for (const id of d.added) deltaIds.push(id);
    for (const id of d.removed) deltaIds.push(id);
  }
  for (const id of deltaIds) {
    const edge = edgeById.get(id);
    if (!edge) continue;
    byFileCount.set(edge.from, (byFileCount.get(edge.from) ?? 0) + 1);
    byFileCount.set(edge.to, (byFileCount.get(edge.to) ?? 0) + 1);
  }
  const top3 = [...byFileCount.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : 1;
    })
    .slice(0, 3);

  const author = MOCK_AI_AUTHORS[index % MOCK_AI_AUTHORS.length];
  const dateLabel = new Date(snap.timestamp).toISOString().slice(0, 10);
  const summary =
    `${snap.label} (${sha.slice(0, 7)}) — ${author} on ${dateLabel}: ` +
    `this commit added ${addedCount} edge${addedCount === 1 ? "" : "s"}, ` +
    `removed ${removedCount} edge${removedCount === 1 ? "" : "s"} across ${touched.length} file${touched.length === 1 ? "" : "s"}.`;

  const highlights: string[] = [];
  for (const [fid, n] of top3) {
    highlights.push(`${basenameFor(fid)} · ${n} edge${n === 1 ? "" : "s"}`);
  }
  const extra = touched.length - top3.length;
  if (extra > 0) {
    highlights.push(`+${extra} more file${extra === 1 ? "" : "s"}`);
  }
  if (highlights.length === 0) {
    highlights.push("no detectable edge-level changes");
  }

  return { summary, highlights };
}

// ── streamEdit (inline Cmd+K-style edit) ─────────────────────────────
//
// Deterministic, local mock. Picks a template based on prompt keywords
// and "streams" it token-by-token so the inline-diff UI exercises the
// same async-iterator path a real model would drive. Each chunk is 1-3
// words with a small jitter (16-36 ms) so the typewriter feels organic
// without dragging the UX.

const EDIT_CHUNK_MIN_MS = 16;
const EDIT_CHUNK_MAX_MS = 36;

interface EditTemplate {
  match: (p: string) => boolean;
  /** Given the current selection text, return the whole replacement.
   *  Chunking is handled by the caller. */
  build: (selection: string, prompt: string) => string;
}

const EDIT_TEMPLATES: readonly EditTemplate[] = [
  {
    match: p => /(rename|변경|바꿔)/i.test(p),
    build: (sel, prompt) => {
      const m = /(?:to|→|->|로)\s*['"`]?([A-Za-z_][\w$]*)['"`]?/.exec(prompt);
      const target = m?.[1] ?? "renamed";
      return sel.replace(/\b[a-zA-Z_][\w$]*\b/g, (ident) =>
        ident.length > 2 && /^[a-z]/.test(ident) ? target : ident,
      );
    },
  },
  {
    match: p => /(extract|추출|함수로)/i.test(p),
    build: (sel) => {
      const lines = sel.trimEnd().split("\n");
      const body = lines.map(l => "    " + l).join("\n");
      return `// extracted — ${lines.length} line${lines.length === 1 ? "" : "s"}\nconst result = (() => {\n${body}\n})();`;
    },
  },
  {
    match: p => /(comment|주석|explain|설명)/i.test(p),
    build: (sel) => {
      const lines = sel.split("\n");
      return lines.map(l => (l.trim().length > 0 ? `// ${l}` : l)).join("\n");
    },
  },
  {
    match: p => /(type|typed|typescript|타입)/i.test(p),
    build: (sel) => {
      return sel.replace(/\bfunction\s+([a-zA-Z_][\w$]*)\s*\(([^)]*)\)/g,
        (_m, name: string, args: string) => {
          const typed = args
            .split(",")
            .map(a => a.trim())
            .filter(a => a.length > 0)
            .map(a => (a.includes(":") ? a : `${a}: unknown`))
            .join(", ");
          return `function ${name}(${typed}): unknown`;
        });
    },
  },
  {
    match: () => true,
    build: (sel, prompt) => {
      const label = prompt.trim().length > 0 ? prompt.trim() : "refactor";
      const lines = sel.split("\n");
      return lines
        .map((l, i) => (i === 0 ? `// ${label}\n${l}` : l))
        .join("\n");
    },
  },
];

function tokenizeForStream(text: string): string[] {
  // Preserve whitespace as its own chunks so the rendered output
  // reflects formatting as soon as each word arrives.
  const parts = text.split(/(\s+)/);
  return parts.filter(p => p.length > 0);
}

async function* streamEdit(input: StreamEditInput): AsyncIterable<StreamEditChunk> {
  const { doc, selFrom, selTo, prompt } = input;
  const selection = doc.slice(selFrom, selTo);
  const template = EDIT_TEMPLATES.find(t => t.match(prompt)) ?? EDIT_TEMPLATES[EDIT_TEMPLATES.length - 1];
  const full = template.build(selection, prompt);

  const tokens = tokenizeForStream(full);
  // Small opening latency so the "streaming" indicator flashes — mirrors
  // real model first-token latency within a tolerable range.
  await wait(120);
  for (let i = 0; i < tokens.length; i++) {
    yield { delta: tokens[i] };
    if (i < tokens.length - 1) {
      const jitter = EDIT_CHUNK_MIN_MS + Math.floor(Math.random() * (EDIT_CHUNK_MAX_MS - EDIT_CHUNK_MIN_MS));
      await wait(jitter);
    }
  }
}

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
    attributeRegression,
    predictFuture,
    narrateCommit,
    streamEdit,
  };
}

// Exported helpers — the UI components use these to resolve the sha
// for a given snapshot without re-deriving the algorithm. Keeps the
// mock the sole owner of "which sha maps to which snapshot".
export function mockShaForSnapshot(history: GraphHistory, snapshotIndex: number): string | null {
  const snap = history.snapshots[snapshotIndex];
  if (!snap) return null;
  return snap.commitSha ?? mockLongShaFor(snapshotIndex, snap.timestamp);
}

export function mockSnapshotIndexForSha(history: GraphHistory, sha: string): number {
  return snapshotIndexForSha(history, sha);
}

export function mockAuthorForSnapshot(snapshotIndex: number): string {
  const n = MOCK_AI_AUTHORS.length;
  return MOCK_AI_AUTHORS[((snapshotIndex % n) + n) % n];
}
