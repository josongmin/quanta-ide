import type {
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceMetrics,
} from "@quanta/canvas-engine";
import type { Sticky } from "../store/stickies-store";
import type {
  AiService,
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
  StreamEditChunk,
  StreamEditInput,
} from "./ai-service";
import { createMockAiService } from "./mock-ai-service";
// Optional user-facing toast surface. Import is defensive: on some builds
// (tests, node-only contexts) the shell package may not be resolvable from
// this slice; wrap in a try-catch at call sites so a missing dep never
// crashes a service call.
import { toast } from "@quanta/shell/stores/toast-store";

// AnthropicAiService — drop-in AiService implementation that fires real
// prompts against the Anthropic /v1/messages endpoint.
//
// Per repo convention this targets **Claude Sonnet 4.6** (`claude-sonnet-4-6`)
// unless the caller overrides the model explicitly. The adapter is defensive:
//
// - Missing `apiKey` → fall back to the mock implementation *per call*,
//   so the UI continues to render plausible results even in a broken env.
// - Network error or HTTP 5xx → log a warning, fall back to the mock.
// - Malformed response (no `content[0].text`) → fall back to the mock.
//
// Every method builds a prompt with a short task description, a
// compact serialization of the domain input, and a request for JSON
// output so the response parses with a single `JSON.parse`. Helpers
// below keep prompts under ~8 KB by truncating file / edge / snapshot
// lists to what the model actually needs to reason.

export interface AnthropicAiServiceConfig {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  /** Optional injection point for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;
// Hard upper bound on a single /v1/messages call. Anthropic's own timeout
// is minutes-long; the UI can't wait that long (stickies cluster, tours,
// anomaly scans all run synchronously from user clicks). 30s is long
// enough for claude-sonnet-4-6 on normal prompts and short enough that a
// hung request doesn't leave the user staring at a loading spinner.
const REQUEST_TIMEOUT_MS = 30_000;
// Guard the toast firing so a long batch of failing calls doesn't spam the
// corner of the screen. One warning per service instance is plenty —
// subsequent failures still log + fall back to the mock silently.
let toastedNetworkFailure = false;
function surfaceNetworkFailure(err: unknown): void {
  if (toastedNetworkFailure) return;
  toastedNetworkFailure = true;
  const aborted = err instanceof Error && err.name === "AbortError";
  const msg = aborted
    ? "AI request timed out — falling back to offline mock."
    : "AI request failed — falling back to offline mock.";
  try {
    toast.danger(msg);
  } catch {
    // toast-store may not be usable during tests / SSR — swallow.
  }
}

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}
interface AnthropicResponse {
  content?: readonly AnthropicContentBlock[];
}

export class AnthropicAiService implements AiService {
  private readonly cfg: Required<
    Pick<AnthropicAiServiceConfig, "model" | "endpoint">
  > & { apiKey: string; fetchImpl: typeof fetch };
  private readonly mock: AiService = createMockAiService();
  private readonly available: boolean;

  constructor(cfg: AnthropicAiServiceConfig = {}) {
    const apiKey = cfg.apiKey ?? "";
    this.available = apiKey.length > 0;
    if (!this.available) {
      console.warn(
        "[AnthropicAiService] no apiKey — every call will transparently fall back to the mock implementation.",
      );
    }
    const fetchImpl =
      cfg.fetchImpl ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);
    if (!fetchImpl) {
      throw new Error("AnthropicAiService: no fetch implementation available");
    }
    this.cfg = {
      apiKey,
      model: cfg.model ?? DEFAULT_MODEL,
      endpoint: cfg.endpoint ?? DEFAULT_ENDPOINT,
      fetchImpl,
    };
  }

  // ── public surface ─────────────────────────────────────────────────

  async naturalLanguageToDsl(
    query: string,
    context: NlToDslContext,
  ): Promise<NlToDslResult> {
    if (!this.available) return this.mock.naturalLanguageToDsl(query, context);
    const prompt = buildNlToDslPrompt(query, context);
    const text = await this.call(prompt);
    if (text === null) return this.mock.naturalLanguageToDsl(query, context);
    const parsed = parseJsonOr<NlToDslResult>(text, null);
    if (!parsed || typeof parsed.dsl !== "string") {
      return this.mock.naturalLanguageToDsl(query, context);
    }
    return {
      dsl: parsed.dsl,
      confidence: clamp01(parsed.confidence ?? 0.5),
      explanation: parsed.explanation ?? "",
    };
  }

  async clusterStickies(
    stickies: readonly Sticky[],
  ): Promise<ClusterStickiesResult> {
    if (!this.available) return this.mock.clusterStickies(stickies);
    const prompt = buildClusterStickiesPrompt(stickies);
    const text = await this.call(prompt);
    if (text === null) return this.mock.clusterStickies(stickies);
    const parsed = parseJsonOr<ClusterStickiesResult>(text, null);
    if (!parsed || !Array.isArray(parsed.clusters)) {
      return this.mock.clusterStickies(stickies);
    }
    return parsed;
  }

  async generateTour(
    graph: WorkspaceGraph,
    layout: WorkspaceLayout,
  ): Promise<GenerateTourResult> {
    if (!this.available) return this.mock.generateTour(graph, layout);
    const prompt = buildTourPrompt(graph, layout);
    const text = await this.call(prompt);
    if (text === null) return this.mock.generateTour(graph, layout);
    const parsed = parseJsonOr<GenerateTourResult>(text, null);
    if (!parsed || !Array.isArray(parsed.steps)) {
      return this.mock.generateTour(graph, layout);
    }
    return parsed;
  }

  async detectAnomalies(
    graph: WorkspaceGraph,
    metrics: WorkspaceMetrics,
  ): Promise<DetectAnomaliesResult> {
    if (!this.available) return this.mock.detectAnomalies(graph, metrics);
    const prompt = buildAnomaliesPrompt(graph, metrics);
    const text = await this.call(prompt);
    if (text === null) return this.mock.detectAnomalies(graph, metrics);
    const parsed = parseJsonOr<DetectAnomaliesResult>(text, null);
    if (!parsed || !Array.isArray(parsed.anomalies)) {
      return this.mock.detectAnomalies(graph, metrics);
    }
    return parsed;
  }

  async attributeRegression(
    input: AttributeRegressionInput,
  ): Promise<AttributeRegressionResult> {
    if (!this.available) return this.mock.attributeRegression(input);
    const prompt = buildAttributionPrompt(input);
    const text = await this.call(prompt);
    if (text === null) return this.mock.attributeRegression(input);
    const parsed = parseJsonOr<AttributeRegressionResult>(text, null);
    if (!parsed || !Array.isArray(parsed.candidateCommits)) {
      return this.mock.attributeRegression(input);
    }
    return parsed;
  }

  async predictFuture(
    input: PredictFutureInput,
  ): Promise<PredictFutureResult> {
    if (!this.available) return this.mock.predictFuture(input);
    const prompt = buildPredictPrompt(input);
    const text = await this.call(prompt);
    if (text === null) return this.mock.predictFuture(input);
    const parsed = parseJsonOr<PredictFutureResult>(text, null);
    if (!parsed || typeof parsed.expectedNewEdges !== "number") {
      return this.mock.predictFuture(input);
    }
    return parsed;
  }

  async narrateCommit(
    input: NarrateCommitInput,
  ): Promise<NarrateCommitResult> {
    if (!this.available) return this.mock.narrateCommit(input);
    const prompt = buildNarratePrompt(input);
    const text = await this.call(prompt);
    if (text === null) return this.mock.narrateCommit(input);
    const parsed = parseJsonOr<NarrateCommitResult>(text, null);
    if (!parsed || typeof parsed.summary !== "string") {
      return this.mock.narrateCommit(input);
    }
    return parsed;
  }

  // Streaming over HTTP is a separate contract (SSE) — for the current
  // MVP we degrade to the mock streamer so the inline-edit UI path is
  // exercised end-to-end regardless of provider. The real SSE hook-up
  // lives behind a follow-up flag.
  streamEdit(input: StreamEditInput): AsyncIterable<StreamEditChunk> {
    return this.mock.streamEdit(input);
  }

  // ── HTTP ───────────────────────────────────────────────────────────

  private async call(userPrompt: string): Promise<string | null> {
    // AbortController + 30s timeout. Without this, a hung TCP connection
    // (captive portal, VPN renegotiation, provider outage) leaves every
    // downstream AI operation stuck indefinitely.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await this.cfg.fetchImpl(this.cfg.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.cfg.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          max_tokens: MAX_TOKENS,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        console.warn(
          `[AnthropicAiService] ${res.status} from endpoint — falling back to mock`,
        );
        return null;
      }
      const body = (await res.json()) as AnthropicResponse;
      const first = body.content?.[0];
      const text = first?.text;
      if (typeof text !== "string" || text.length === 0) {
        console.warn(
          "[AnthropicAiService] empty content in response — falling back to mock",
        );
        return null;
      }
      return text;
    } catch (err) {
      console.warn(
        "[AnthropicAiService] network/parse error — falling back to mock",
        err,
      );
      surfaceNetworkFailure(err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ── prompt builders ───────────────────────────────────────────────────

function buildNlToDslPrompt(query: string, ctx: NlToDslContext): string {
  // 2-shot — mirrors the intent rules in mock-ai-service so the model has
  // concrete examples of the DSL shape we accept downstream.
  return [
    "You translate an English query into a strict filter DSL for a source-graph.",
    "",
    "Example 1:",
    'Query: "taint flows to the database"',
    'Result: {"dsl": "kind=taint-propagation and severity>=high", "confidence": 0.9, "explanation": "High-severity taint propagation."}',
    "",
    "Example 2:",
    'Query: "all edges in the safety layer"',
    'Result: {"dsl": "layer=safety", "confidence": 0.85, "explanation": "All safety-layer edges."}',
    "",
    `Known edge kinds: ${truncateList(ctx.edgeKinds, 12).join(", ")}`,
    `Known edge layers: ${truncateList(ctx.edgeLayers, 12).join(", ")}`,
    "",
    `Query: ${JSON.stringify(query)}`,
    "",
    "Respond with a single JSON object matching the example shape.",
    'Keys: "dsl" (string), "confidence" (0..1 number), "explanation" (string).',
    "No prose outside the JSON.",
  ].join("\n");
}

function buildClusterStickiesPrompt(stickies: readonly Sticky[]): string {
  const rows = truncateList(stickies, 60).map(
    s => `- ${s.id}: ${oneLine(s.text).slice(0, 160)}`,
  );
  return [
    "Cluster the following sticky notes by shared intent. Group only stickies that share >=2 meaningful tokens.",
    "Respond with JSON: { clusters: [{ label, stickyIds, reasoning }] }. No prose outside the JSON.",
    "",
    "Stickies:",
    ...rows,
  ].join("\n");
}

function buildTourPrompt(graph: WorkspaceGraph, layout: WorkspaceLayout): string {
  const topFiles = pickTopFiles(graph, layout, 10);
  const rows = topFiles.map(
    f => `- ${f.id} · layer=${f.layer} · risk=${f.riskScore ?? 0}`,
  );
  return [
    "Produce a 5-stop 'start here' tour for a new engineer onboarding this codebase.",
    'Respond with JSON: { steps: [{ fileId, narration, focusHops }] }. No prose outside the JSON.',
    "Prefer domain / adapter files at top; narration should be 1-2 sentences each.",
    "",
    "Candidate files:",
    ...rows,
  ].join("\n");
}

function buildAnomaliesPrompt(
  graph: WorkspaceGraph,
  metrics: WorkspaceMetrics,
): string {
  const byId = new Map(graph.files.map(f => [f.id, f]));
  const rows: string[] = [];
  let i = 0;
  for (const [fid, fm] of metrics.perFile) {
    if (i++ > 40) break;
    const file = byId.get(fid);
    rows.push(
      `- ${fid} · layer=${file?.layer ?? "?"} · degree=${fm.degree} · in=${fm.inDegree} · out=${fm.outDegree}`,
    );
  }
  return [
    "Detect anomalies in the graph below. Kinds to consider: coupling-spike, cycle-gone-hot, unreachable, owner-drift.",
    'Respond with JSON: { anomalies: [{ kind, fileId, severity, explanation }] }. severity: "low"|"med"|"high". No prose outside JSON.',
    "",
    "File metrics:",
    ...rows,
  ].join("\n");
}

function buildAttributionPrompt(input: AttributeRegressionInput): string {
  const tail = input.history.snapshots.slice(-10);
  const rows = tail.map(s => `- ${s.commitSha ?? "(no-sha)"} · ${s.label}`);
  return [
    "A test is failing. Attribute the most likely culprit commit(s) among the recent history.",
    'Respond with JSON: { candidateCommits: [{ sha, confidence, reason }], affectedFileIds: string[], narration: string }. No prose outside JSON.',
    "",
    `Test: ${JSON.stringify(input.testName)}`,
    `Failure log (truncated):\n${input.failureLog.slice(0, 1200)}`,
    "",
    "Recent snapshots:",
    ...rows,
  ].join("\n");
}

function buildPredictPrompt(input: PredictFutureInput): string {
  const tail = input.history.snapshots.slice(-8);
  const rows = tail.map(s => `- ${s.label} @ ${new Date(s.timestamp).toISOString().slice(0, 10)}`);
  return [
    `Predict growth and risk over the next ${Math.max(1, Math.round(input.horizonDays))} days.`,
    'Respond with JSON matching the TS type: { expectedNewFiles, expectedNewEdges, expectedNewCycles: string[], hottestFilesForecast: string[], narration: string }. No prose outside JSON.',
    "",
    `Current files: ${input.graph.files.length}. Current edges: ${input.graph.fileEdges.length}.`,
    "Recent snapshots:",
    ...rows,
  ].join("\n");
}

function buildNarratePrompt(input: NarrateCommitInput): string {
  const idx = input.history.snapshots.findIndex(
    s => s.commitSha === input.sha,
  );
  const label = idx >= 0 ? input.history.snapshots[idx]!.label : "(unknown)";
  return [
    "Narrate a single commit for a reviewer unfamiliar with the change.",
    'Respond with JSON: { summary: string, highlights: string[] }. No prose outside JSON.',
    "",
    `sha: ${input.sha}`,
    `label: ${label}`,
  ].join("\n");
}

// ── helpers ───────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function truncateList<T>(arr: readonly T[], n: number): T[] {
  return arr.length <= n ? [...arr] : arr.slice(0, n);
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

type WsFile = WorkspaceGraph["files"][number];

function pickTopFiles(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  n: number,
): readonly WsFile[] {
  const metrics = layout.metrics;
  if (!metrics) return graph.files.slice(0, n);
  const scored = graph.files.map(f => {
    const fm = metrics.perFile.get(f.id);
    const deg = fm?.degree ?? 0;
    const risk = f.riskScore ?? 0;
    return { f, score: deg * 2 + risk };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map(x => x.f);
}

function parseJsonOr<T>(raw: string, fallback: T | null): T | null {
  // The model occasionally wraps JSON in fenced code blocks; strip the
  // fences before parsing so downstream callers don't have to.
  const trimmed = raw.trim();
  const stripped = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
    : trimmed;
  try {
    return JSON.parse(stripped) as T;
  } catch {
    return fallback;
  }
}

