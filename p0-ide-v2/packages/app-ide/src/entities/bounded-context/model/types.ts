export type ContextEdgeKind =
  | "shared-kernel"     // both contexts share types
  | "customer-supplier" // upstream-downstream agreed
  | "conformist"        // downstream takes upstream as-is
  | "anti-corruption"   // downstream wraps with translation layer
  | "open-host"         // upstream exposes published API
  | "violation";        // direct reach across boundary, no contract

export interface BoundedContext {
  id: string;
  name: string;
  /** Glob pattern for files belonging to this context. */
  pattern: string;
  /** Owning team. */
  owner: string;
  /** Total symbols in this context (used for matrix size). */
  symbolCount: number;
}

export interface ContextEdge {
  /** From context id. */
  from: string;
  /** To context id. */
  to: string;
  kind: ContextEdgeKind;
  /** # of code-level edges between the two contexts of this kind. */
  weight: number;
}

export interface ContextViolation {
  id: string;
  fromContext: string;
  toContext: string;
  /** The offending symbol on the fromContext side. */
  symbol: string;
  file: string;
  line: number;
  /** What the violation reaches in the other context. */
  reaches: string;
  /** Why this is a violation (rule). */
  reason: string;
  severity: "warn" | "danger";
}

export interface ContextMap {
  contexts: BoundedContext[];
  edges: ContextEdge[];
  violations: ContextViolation[];
}
