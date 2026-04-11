/* ── devos-server HTTP client ── */

export const DEVOS_BASE_URL = "http://127.0.0.1:8081";
export const DEVOS_API_KEY = "devtest-key";
export const DEVOS_REPO_PATH = "/Users/songmin/Documents/code-new/semantica-codegraph-v2/apps/codegraph-agent";

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DEVOS_API_KEY}`,
  };
}

/* ── Types (mirror of Rust contracts) ── */

export type TaskStatus =
  | { state: "completed" }
  | { state: "in_progress" }
  | { state: "failed"; reason: string }
  | { state: "unavailable"; reason: string };

export interface ExecutionMetadata {
  execution_time_ms: number;
  lanes_executed: number;
  lanes_succeeded: number;
  lanes_failed: number;
  degraded_reason?: string;
  phase6_hardening_trace?: string;
  trace_id?: string;
}

/* ── /v1/agent/turn ── */

export interface AgentTurnRequest {
  session_id: string;
  client_turn_id: string;
  conversation_id?: string | null;
  user_message: string;
  repo_path: string;
  execution_mode?: "quick" | "standard" | "deep";
  resume_policy?: "continue_transcript" | "fresh_turn" | null;
}

export interface AgentTurnResponse {
  request_id: string;
  session_id: string;
  client_turn_id: string;
  status: TaskStatus;
  result: string;
  metadata: ExecutionMetadata;
}

export async function postAgentTurn(req: AgentTurnRequest): Promise<AgentTurnResponse> {
  const res = await fetch(`${DEVOS_BASE_URL}/v1/agent/turn`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new DevosError(res.status, text);
  }
  return res.json() as Promise<AgentTurnResponse>;
}

/* ── /v1/agent (원샷) ── */

export interface AgentOneshotRequest {
  task: string;
  repo_path?: string | null;
  mode?: "fast" | "guarded" | "full" | null;
}

export interface AgentOneshotResponse {
  request_id: string;
  status: TaskStatus;
  result: string;
  metadata: ExecutionMetadata;
}

export async function postAgentOneshot(req: AgentOneshotRequest): Promise<AgentOneshotResponse> {
  const res = await fetch(`${DEVOS_BASE_URL}/v1/agent`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new DevosError(res.status, text);
  }
  return res.json() as Promise<AgentOneshotResponse>;
}

/* ── /v1/query ── */

export type QueryKind =
  | "code_search"
  | "pattern_match"
  | "security_audit"
  | "call_graph"
  | "import_graph"
  | "dead_code";

export interface Finding {
  id: string;
  finding_type: string;
  description: string;
  location?: string;
  evidence?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

export type ServiceStatus =
  | { state: "ok" }
  | { state: "degraded"; reason: string }
  | { state: "unavailable"; reason: string };

export interface QueryRequest {
  query: string;
  kind?: QueryKind | null;
  repo_path?: string | null;
  output_format?: "human" | "json" | null;
  budget?: "quick" | "standard" | "deep" | null;
  confidence_threshold?: number | null;
}

export interface QueryResponse {
  request_id: string;
  findings: Finding[];
  confidence: number;
  pipeline_status: ServiceStatus;
  metadata: ExecutionMetadata;
}

export async function postQuery(req: QueryRequest): Promise<QueryResponse> {
  const res = await fetch(`${DEVOS_BASE_URL}/v1/query`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new DevosError(res.status, text);
  }
  return res.json() as Promise<QueryResponse>;
}

/* ── /v1/retrieval ── */

export interface RetrievalRequest {
  query: string;
  top_k?: number | null;
  repo_path?: string | null;
}

export interface RetrievedEntity {
  id: string;
  kind: string;
  file: string;
  line?: number;
  source?: string;
  relevance_score: number;
}

export interface RetrievalResponse {
  request_id: string;
  entities: RetrievedEntity[];
  count: number;
  metadata: ExecutionMetadata;
}

export async function postRetrieval(req: RetrievalRequest): Promise<RetrievalResponse> {
  const res = await fetch(`${DEVOS_BASE_URL}/v1/retrieval`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new DevosError(res.status, text);
  }
  return res.json() as Promise<RetrievalResponse>;
}

/* ── /health ── */

export async function getHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${DEVOS_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Error ── */

export class DevosError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`devos ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

/* ── idempotency key helper ── */
export function makeTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
