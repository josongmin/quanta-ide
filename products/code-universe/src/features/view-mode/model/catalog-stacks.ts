import type { AnalysisCatalogRecord } from "./taxonomy";
import type {
  DecisionTarget,
  InsightIntent,
  InsightScope,
  InsightWorkflowStack,
  WorkflowStackId,
} from "./taxonomy";

export type {
  InsightWorkflowStack,
  InsightWorkflowStep,
  WorkflowStackId,
} from "./taxonomy";

export interface WorkflowStackQuery {
  targetDecision?: DecisionTarget;
  scope?: InsightScope | readonly InsightScope[];
  intent?: InsightIntent | readonly InsightIntent[];
  intents?: readonly InsightIntent[];
  text?: string;
}

type WorkflowRecord = Pick<AnalysisCatalogRecord, "id" | "taxonomy" | "decision" | "workflow" | "summary" | "title" | "usecase">;

const WORKFLOW_STACKS: readonly InsightWorkflowStack[] = [
  {
    id: "ai-review-stack",
    title: "AI Review Stack",
    goal: "Determine whether an AI-generated diff is safe to merge",
    targetDecision: "merge",
    primaryScopes: ["diff", "file"],
    steps: [
      { insightId: "diff-evidence", role: "verification", required: true, blockingOnFail: true },
      { insightId: "message-code-mismatch", role: "risk-check", required: true },
      { insightId: "verification-surface", role: "verification", required: true, blockingOnFail: true },
      { insightId: "spec-gaming", role: "risk-check", required: false, blockingOnFail: true },
      { insightId: "prompt-injection", role: "policy-check", required: false, blockingOnFail: true },
    ],
  },
  {
    id: "agent-delegation-stack",
    title: "Agent Delegation Stack",
    goal: "Decide whether a task or file can be safely delegated to an agent",
    targetDecision: "delegate",
    primaryScopes: ["file", "task"],
    steps: [
      { insightId: "agentability", role: "screening", required: true },
      { insightId: "context-waste", role: "risk-check", required: true },
      { insightId: "planning-horizon", role: "risk-check", required: true },
      { insightId: "model-router", role: "decision-support", required: false },
      { insightId: "verification-surface", role: "verification", required: true },
    ],
  },
  {
    id: "context-engineering-stack",
    title: "Context Engineering Stack",
    goal: "Build the smallest reliable context pack before routing model or agent work",
    targetDecision: "route-model",
    primaryScopes: ["file", "task", "model", "budget"],
    steps: [
      { insightId: "token-economy", role: "screening", required: true },
      { insightId: "context-waste", role: "risk-check", required: true },
      { insightId: "context-curator", role: "decision-support", required: true },
      { insightId: "cache-roi", role: "decision-support", required: false },
      { insightId: "model-router", role: "decision-support", required: false },
    ],
  },
  {
    id: "agent-failure-stack",
    title: "Agent Failure Stack",
    goal: "Diagnose where an agent run collapsed and decide whether to retry, chunk, or escalate",
    targetDecision: "escalate-review",
    primaryScopes: ["agent-run", "task", "file"],
    steps: [
      { insightId: "agent-trajectory", role: "screening", required: true },
      { insightId: "trajectory-decompose", role: "risk-check", required: true, blockingOnFail: true },
      { insightId: "replay-theater", role: "verification", required: false },
      { insightId: "stuck-pattern", role: "risk-check", required: true },
      { insightId: "compounding-error", role: "decision-support", required: false },
    ],
  },
] as const;

const STACK_PROFILE: Record<WorkflowStackId, { intents: readonly InsightIntent[]; keywords: readonly string[] }> = {
  "ai-review-stack": {
    intents: ["verify", "decide", "govern"],
    keywords: ["review", "diff", "merge", "pr", "trust", "evidence", "safe"],
  },
  "agent-delegation-stack": {
    intents: ["decide", "diagnose", "optimize"],
    keywords: ["delegate", "agent", "handoff", "task", "planning", "fit"],
  },
  "context-engineering-stack": {
    intents: ["optimize", "decide", "govern"],
    keywords: ["context", "token", "budget", "model", "route", "cache"],
  },
  "agent-failure-stack": {
    intents: ["diagnose", "decide", "verify"],
    keywords: ["failure", "stuck", "replay", "trajectory", "incident", "escalate"],
  },
};

const TARGET_HINTS: Record<string, DecisionTarget> = {
  merge: "merge",
  pr: "merge",
  diff: "merge",
  delegate: "delegate",
  handoff: "delegate",
  model: "route-model",
  route: "route-model",
  cost: "route-model",
  failure: "escalate-review",
  stuck: "escalate-review",
  escalate: "escalate-review",
  audit: "policy-audit",
  policy: "policy-audit",
  refactor: "refactor",
};

const INTENT_HINTS: Record<string, InsightIntent> = {
  explore: "explore",
  explain: "explain",
  diagnose: "diagnose",
  decide: "decide",
  verify: "verify",
  optimize: "optimize",
  govern: "govern",
  trust: "verify",
  evidence: "verify",
  safe: "verify",
  cost: "optimize",
  token: "optimize",
  context: "optimize",
  delegate: "decide",
  merge: "decide",
  failure: "diagnose",
  stuck: "diagnose",
};

function asArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

function tokens(text: string | undefined): readonly string[] {
  if (!text) return [];
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalized ? normalized.split(/\s+/) : [];
}

function normalizeQuery(query: WorkflowStackQuery | string): WorkflowStackQuery {
  return typeof query === "string" ? { text: query } : query;
}

function queryTarget(query: WorkflowStackQuery): DecisionTarget | undefined {
  if (query.targetDecision) return query.targetDecision;
  for (const token of tokens(query.text)) {
    const hinted = TARGET_HINTS[token];
    if (hinted) return hinted;
  }
  return undefined;
}

function queryIntents(query: WorkflowStackQuery): readonly InsightIntent[] {
  const out = new Set<InsightIntent>([...asArray(query.intent), ...asArray(query.intents)]);
  for (const token of tokens(query.text)) {
    const hinted = INTENT_HINTS[token];
    if (hinted) out.add(hinted);
  }
  return [...out];
}

function queryScopes(query: WorkflowStackQuery): readonly InsightScope[] {
  return [...new Set(asArray(query.scope))];
}

function recordMatchesStack(record: WorkflowRecord, stack: InsightWorkflowStack): boolean {
  if (record.workflow.usableInStacks?.includes(stack.id)) return true;
  if (stack.steps.some((step) => step.insightId === record.id)) return true;
  if (stack.targetDecision && record.decision.supports.includes(stack.targetDecision)) return true;
  return stack.primaryScopes.some((scope) => record.taxonomy.scopes.includes(scope));
}

function stackRecordScore(stack: InsightWorkflowStack, records: readonly WorkflowRecord[] | undefined): number {
  if (!records?.length) return 0;
  const required = stack.steps.filter((step) => step.required);
  const matchedRequired = required.filter((step) => records.some((record) => record.id === step.insightId)).length;
  const matchedRecords = records.filter((record) => recordMatchesStack(record, stack)).length;
  if (required.length > matchedRequired) return Number.NEGATIVE_INFINITY;
  return matchedRequired * 25 + matchedRecords * 5;
}

function stackTextScore(stack: InsightWorkflowStack, query: WorkflowStackQuery): number {
  const queryTokens = tokens(query.text);
  if (queryTokens.length === 0) return 0;
  const profile = STACK_PROFILE[stack.id];
  const haystack = new Set([
    ...tokens(stack.title),
    ...tokens(stack.goal),
    ...profile.keywords,
    ...stack.steps.flatMap((step) => tokens(step.insightId)),
  ]);
  return queryTokens.reduce((score, token) => score + (haystack.has(token) ? 12 : 0), 0);
}

function scoreStack(stack: InsightWorkflowStack, rawQuery: WorkflowStackQuery | string, records?: readonly WorkflowRecord[]): number {
  const query = normalizeQuery(rawQuery);
  const target = queryTarget(query);
  const intents = queryIntents(query);
  const scopes = queryScopes(query);
  const profile = STACK_PROFILE[stack.id];
  let score = 1000 - WORKFLOW_STACKS.findIndex((candidate) => candidate.id === stack.id) * 10;

  if (target) score += stack.targetDecision === target ? 260 : -80;
  for (const scope of scopes) if (stack.primaryScopes.includes(scope)) score += 90;
  for (const intent of intents) if (profile.intents.includes(intent)) score += 70;
  score += stackTextScore(stack, query);
  score += stackRecordScore(stack, records);
  return score;
}

export function getWorkflowStacks(): readonly InsightWorkflowStack[] {
  return WORKFLOW_STACKS;
}

export function getWorkflowStack(id: WorkflowStackId): InsightWorkflowStack | undefined {
  return WORKFLOW_STACKS.find((stack) => stack.id === id);
}

export function suggestStacksForIntent(
  query: WorkflowStackQuery | string,
  records?: readonly WorkflowRecord[],
): readonly InsightWorkflowStack[] {
  const normalized = normalizeQuery(query);
  const target = queryTarget(normalized);
  const intents = queryIntents(normalized);
  const scopes = queryScopes(normalized);
  const hasSignal = Boolean(target || intents.length || scopes.length || tokens(normalized.text).length);

  return WORKFLOW_STACKS
    .filter((stack) => {
      if (!hasSignal) return true;
      const profile = STACK_PROFILE[stack.id];
      return (
        (!target || stack.targetDecision === target) &&
        (scopes.length === 0 || scopes.some((scope) => stack.primaryScopes.includes(scope))) &&
        (intents.length === 0 || intents.some((intent) => profile.intents.includes(intent))) &&
        (tokens(normalized.text).length === 0 || stackTextScore(stack, normalized) > 0)
      );
    })
    .map((stack) => ({ stack, score: scoreStack(stack, normalized, records) }))
    .filter(({ score }) => score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score || a.stack.title.localeCompare(b.stack.title))
    .map(({ stack }) => stack);
}
