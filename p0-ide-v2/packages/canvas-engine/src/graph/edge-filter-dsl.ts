import type { FileEdge, EdgeKind, EdgeLayer, EdgeSeverity } from "./types";
import type { GraphHistory, GraphSnapshot } from "./history";

// Minimal boolean DSL for ad-hoc edge filtering from the HUD. Gephi +
// Neo4j Bloom ship with query boxes; this is the compile-time-safe subset
// that covers "show me X and not Y" without dragging in a full expression
// evaluator. Out of scope for now: regex across filenames, arithmetic on
// weight / confidence (add only when a real user ask appears).
//
// Grammar (operator precedence high → low):
//   term       = "(" expr ")" | atom
//   atom       = KEY OP VALUE
//   KEY        = "layer" | "kind" | "severity" | "animated" | "evidence"
//              | "added_since" | "stable_since" | "touched_by" | "churn"
//              | "introduced_between"
//   OP         = "=" | "!=" | ">=" | "<=" | ">" | "<"
//   VALUE      = identifier (unquoted) — lowercase, no whitespace
//              | time-expression ("2w" | "30d" | "3m" | "1y")
//              | pair ("v1.0..v1.2") for introduced_between
//   expr       = term (BOOL term)*
//   BOOL       = "and" | "or" | "&&" | "||"
//   Prefix "!" or "not " negates a term.
//
// Examples:
//   layer=safety
//   severity>=high and not kind=finding
//   (layer=impact or layer=safety) and animated=true
//   added_since=2w and touched_by=alice
//   churn>5 or introduced_between=v1.0..v1.2

const SEV_RANK: Record<EdgeSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

// ── Filter context ─────────────────────────────────────────────────
// Temporal operators need history access. The compiler returns a plain
// predicate for back-compat; callers that want temporal semantics wrap
// the predicate with `applyFilterContext` or inject the context up-front
// via `compileEdgeFilterWithContext`.

export interface FilterContext {
  /** Graph history — required for added_since / stable_since / churn / introduced_between. */
  history?: GraphHistory;
  /** Active commit timestamp used as "now" for relative time expressions.
   *  Defaults to the newest snapshot's timestamp. */
  commitTimestamp?: number;
}

export type FilterPredicate = (edge: FileEdge) => boolean;

export interface FilterCompileResult {
  predicate: FilterPredicate;
  error?: undefined;
}

export interface FilterCompileError {
  predicate?: undefined;
  error: string;
  at?: number;
}

export type FilterCompileOutput = FilterCompileResult | FilterCompileError;

// ── LRU cache ───────────────────────────────────────────────────────
//
// `useEdgeFocusLogic` re-runs `compileEdgeFilter` on every keystroke while
// the user types in the HUD. A 32-entry LRU covers the typical session
// (a handful of live queries + a few commonly-pasted snippets) without
// leaking memory on the edge case of someone spamming unique queries.
// Re-insertion via `Map` delete+set implements recency ordering cheaply
// because JS `Map` iteration order is insertion order.

const COMPILE_CACHE_CAP = 32;
const compileCache = new Map<string, FilterCompileOutput>();

/** Test / benchmarking hook. Clears the memoized compilation results. */
export function resetCompileCache(): void {
  compileCache.clear();
}

/**
 * Compile a DSL string to a predicate. On error returns an object with an
 * `error` string — the HUD surfaces it inline without throwing. Empty /
 * whitespace input compiles to "always true" so clearing the box restores
 * the previous render.
 *
 * Results are LRU-cached by raw source string (pre-trim). Cache hits skip
 * the tokenizer / parser entirely — the common path while the user edits
 * a query.
 */
export function compileEdgeFilter(src: string): FilterCompileOutput {
  const cached = compileCache.get(src);
  if (cached !== undefined) {
    // Touch: move to most-recent by re-inserting.
    compileCache.delete(src);
    compileCache.set(src, cached);
    return cached;
  }
  const result = doCompile(src, undefined);
  if (compileCache.size >= COMPILE_CACHE_CAP) {
    // Evict the oldest entry (first insertion-order key).
    const oldest = compileCache.keys().next().value;
    if (oldest !== undefined) compileCache.delete(oldest);
  }
  compileCache.set(src, result);
  return result;
}

/**
 * Compile with a temporal context. Temporal keys (added_since / churn /
 * touched_by / stable_since / introduced_between) use the context; the
 * base keys (layer / kind / severity / animated / evidence) ignore it.
 *
 * Not cached — context is caller-scoped and keying it would explode the
 * cache on rapid re-materializations.
 */
export function compileEdgeFilterWithContext(src: string, ctx: FilterContext): FilterCompileOutput {
  return doCompile(src, ctx);
}

function doCompile(src: string, ctx: FilterContext | undefined): FilterCompileOutput {
  const trimmed = src.trim();
  if (trimmed.length === 0) return { predicate: () => true };
  try {
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens);
    const ast = parser.parseExpr();
    if (!parser.atEnd()) {
      return { error: `unexpected token at ${parser.peek().start}`, at: parser.peek().start };
    }
    return { predicate: makePredicate(ast, ctx) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Tokenizer ──────────────────────────────────────────────────────

type TokKind = "ident" | "op" | "bool" | "not" | "lparen" | "rparen";
interface Token { kind: TokKind; value: string; start: number; }

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (ch === "(") { out.push({ kind: "lparen", value: "(", start: i }); i++; continue; }
    if (ch === ")") { out.push({ kind: "rparen", value: ")", start: i }); i++; continue; }
    if (ch === "!" && src[i + 1] !== "=") {
      out.push({ kind: "not", value: "!", start: i }); i++; continue;
    }
    // Two-char operators
    if (src.startsWith("!=", i) || src.startsWith(">=", i) || src.startsWith("<=", i) || src.startsWith("&&", i) || src.startsWith("||", i)) {
      const op = src.substr(i, 2);
      if (op === "&&") out.push({ kind: "bool", value: "and", start: i });
      else if (op === "||") out.push({ kind: "bool", value: "or", start: i });
      else out.push({ kind: "op", value: op, start: i });
      i += 2;
      continue;
    }
    if (ch === "=" || ch === ">" || ch === "<") {
      out.push({ kind: "op", value: ch, start: i }); i++; continue;
    }
    // Identifier — letters, digits, _, -, . (for taint-propagation, file paths)
    // Extended with `..` for introduced_between (v1.0..v1.2).
    if (/[A-Za-z0-9_\-./]/.test(ch)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_\-./]/.test(src[i])) i++;
      const word = src.slice(start, i).toLowerCase();
      if (word === "and" || word === "or") out.push({ kind: "bool", value: word, start });
      else if (word === "not") out.push({ kind: "not", value: word, start });
      else out.push({ kind: "ident", value: word, start });
      continue;
    }
    throw new Error(`unexpected character '${ch}' at ${i}`);
  }
  return out;
}

// ── Parser (recursive descent) ────────────────────────────────────

type AST =
  | { type: "atom"; key: string; op: string; value: string }
  | { type: "not"; inner: AST }
  | { type: "and"; left: AST; right: AST }
  | { type: "or"; left: AST; right: AST };

class Parser {
  private i = 0;
  constructor(private toks: Token[]) {}
  atEnd(): boolean { return this.i >= this.toks.length; }
  peek(): Token { return this.toks[this.i] ?? { kind: "ident", value: "<eof>", start: -1 }; }
  advance(): Token { return this.toks[this.i++]; }
  expect(kind: TokKind): Token {
    const t = this.peek();
    if (t.kind !== kind) throw new Error(`expected ${kind}, got ${t.value}`);
    return this.advance();
  }

  parseExpr(): AST {
    // or has lowest precedence
    let left = this.parseAnd();
    while (!this.atEnd() && this.peek().kind === "bool" && this.peek().value === "or") {
      this.advance();
      const right = this.parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  parseAnd(): AST {
    let left = this.parseUnary();
    while (!this.atEnd() && this.peek().kind === "bool" && this.peek().value === "and") {
      this.advance();
      const right = this.parseUnary();
      left = { type: "and", left, right };
    }
    return left;
  }

  parseUnary(): AST {
    if (!this.atEnd() && this.peek().kind === "not") {
      this.advance();
      const inner = this.parseUnary();
      return { type: "not", inner };
    }
    return this.parseTerm();
  }

  parseTerm(): AST {
    const tok = this.peek();
    if (tok.kind === "lparen") {
      this.advance();
      const inner = this.parseExpr();
      this.expect("rparen");
      return inner;
    }
    // atom: KEY OP VALUE
    const keyTok = this.expect("ident");
    const opTok = this.expect("op");
    const valTok = this.expect("ident");
    return { type: "atom", key: keyTok.value, op: opTok.value, value: valTok.value };
  }
}

// ── Predicate builder ─────────────────────────────────────────────

function makePredicate(ast: AST, ctx: FilterContext | undefined): FilterPredicate {
  if (ast.type === "and") {
    const a = makePredicate(ast.left, ctx);
    const b = makePredicate(ast.right, ctx);
    return edge => a(edge) && b(edge);
  }
  if (ast.type === "or") {
    const a = makePredicate(ast.left, ctx);
    const b = makePredicate(ast.right, ctx);
    return edge => a(edge) || b(edge);
  }
  if (ast.type === "not") {
    const inner = makePredicate(ast.inner, ctx);
    return edge => !inner(edge);
  }
  return atomPredicate(ast.key, ast.op, ast.value, ctx);
}

const TEMPORAL_KEYS = new Set([
  "added_since",
  "stable_since",
  "touched_by",
  "churn",
  "introduced_between",
]);

function atomPredicate(key: string, op: string, value: string, ctx: FilterContext | undefined): FilterPredicate {
  switch (key) {
    case "layer":
      return edge => compareStr(edge.layer, op, value as EdgeLayer);
    case "kind":
      return edge => compareStr(edge.kind as string, op, value);
    case "severity":
      return edge => compareSeverity(edge.severity, op, value);
    case "animated":
      return edge => compareBool(edge.animated === true, op, value);
    case "evidence":
      return edge => compareBool(edge.evidenceId !== undefined, op, value);

    // ── Temporal keys ──────────────────────────────────────────────
    case "added_since":
      return temporalAddedSince(op, value, ctx);
    case "stable_since":
      return temporalStableSince(op, value, ctx);
    case "touched_by":
      return temporalTouchedBy(op, value, ctx);
    case "churn":
      return temporalChurn(op, value, ctx);
    case "introduced_between":
      return temporalIntroducedBetween(op, value, ctx);

    default:
      throw new Error(`unknown key '${key}' (expected: layer, kind, severity, animated, evidence, added_since, stable_since, touched_by, churn, introduced_between)`);
  }
}

// ── Temporal helpers ──────────────────────────────────────────────

const TIME_UNITS_MS: Record<string, number> = {
  d: 86_400_000,
  w: 86_400_000 * 7,
  m: 86_400_000 * 30,    // approximate — month = 30 days
  y: 86_400_000 * 365,
};

/** Parse "2w" / "30d" / "3m" / "1y" into milliseconds. Throws on bad input. */
export function parseTimeExpression(expr: string): number {
  const m = /^(\d+)([dwmy])$/i.exec(expr);
  if (!m) throw new Error(`invalid time expression '${expr}' (expected e.g. 2w, 30d, 3m, 1y)`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mul = TIME_UNITS_MS[unit];
  if (!Number.isFinite(n) || !mul) throw new Error(`invalid time expression '${expr}'`);
  return n * mul;
}

function currentCommitTimestamp(ctx: FilterContext | undefined): number {
  if (ctx?.commitTimestamp !== undefined) return ctx.commitTimestamp;
  const snaps = ctx?.history?.snapshots;
  if (snaps && snaps.length > 0) return snaps[snaps.length - 1].timestamp;
  return Date.now();
}

/** Index: edgeId → index of the first snapshot where it appears. */
function buildFirstAppearanceMap(history: GraphHistory): Map<string, number> {
  const out = new Map<string, number>();
  const snaps = history.snapshots;
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.edgeIds) {
      for (const id of s.edgeIds) if (!out.has(id)) out.set(id, i);
    }
    if (s.added) {
      for (const id of s.added) if (!out.has(id)) out.set(id, i);
    }
  }
  return out;
}

/** Index: edgeId → index of the last snapshot where the edge was added or removed. */
function buildLastChangeMap(history: GraphHistory): Map<string, number> {
  const out = new Map<string, number>();
  const snaps = history.snapshots;
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.added) for (const id of s.added) out.set(id, i);
    if (s.removed) for (const id of s.removed) out.set(id, i);
  }
  return out;
}

/** Index: edgeId → number of times it toggled (added + removed events). */
function buildChurnMap(history: GraphHistory): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of history.snapshots) {
    if (s.added) for (const id of s.added) out.set(id, (out.get(id) ?? 0) + 1);
    if (s.removed) for (const id of s.removed) out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

/** Resolve a ref (label, short sha, or numeric index) to a snapshot index. */
function resolveRef(history: GraphHistory, ref: string): number | null {
  const snaps = history.snapshots;
  // Numeric
  if (/^\d+$/.test(ref)) {
    const n = Number(ref);
    if (n >= 0 && n < snaps.length) return n;
  }
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.label.toLowerCase() === ref) return i;
    if (s.commitSha && s.commitSha.toLowerCase().startsWith(ref)) return i;
  }
  return null;
}

function temporalAddedSince(op: string, value: string, ctx: FilterContext | undefined): FilterPredicate {
  if (op !== "=" && op !== ">=" && op !== ">" && op !== "<" && op !== "<=") {
    throw new Error(`operator '${op}' not valid for added_since (use =, <=, >=, <, >)`);
  }
  const h = ctx?.history;
  if (!h) return () => false;
  const windowMs = parseTimeExpression(value);
  const now = currentCommitTimestamp(ctx);
  const threshold = now - windowMs;
  const firstAppearance = buildFirstAppearanceMap(h);
  return edge => {
    const idx = firstAppearance.get(edge.id);
    if (idx === undefined) return false;
    const ts = h.snapshots[idx]?.timestamp;
    if (ts === undefined) return false;
    // "added_since(2w)" means "first appearance within the last 2 weeks".
    // For equality (=) and >= we use the lower-bound semantic; <=/</> invert.
    if (op === "=" || op === ">=") return ts >= threshold;
    if (op === ">") return ts > threshold;
    if (op === "<") return ts < threshold;
    return ts <= threshold;
  };
}

function temporalStableSince(op: string, value: string, ctx: FilterContext | undefined): FilterPredicate {
  if (op !== "=" && op !== ">=" && op !== ">" && op !== "<" && op !== "<=") {
    throw new Error(`operator '${op}' not valid for stable_since (use =, <=, >=, <, >)`);
  }
  const h = ctx?.history;
  if (!h) return () => false;
  const windowMs = parseTimeExpression(value);
  const now = currentCommitTimestamp(ctx);
  const threshold = now - windowMs;
  const lastChange = buildLastChangeMap(h);
  const snaps = h.snapshots;
  // An edge is "stable_since(1m)" when (a) it currently exists and
  // (b) its last change is at or before the threshold.
  // We approximate presence via the newest snapshot via edgeIds/deltas.
  return edge => {
    const idx = lastChange.get(edge.id);
    if (idx === undefined) {
      // Never changed — treat it as "not present".
      return false;
    }
    const lastSnap = snaps[idx];
    if (lastSnap.removed && lastSnap.removed.includes(edge.id)) return false;
    const ts = lastSnap.timestamp;
    if (op === "=" || op === ">=") return ts <= threshold;
    if (op === ">") return ts < threshold;
    if (op === "<") return ts > threshold;
    return ts >= threshold;
  };
}

function temporalTouchedBy(op: string, value: string, ctx: FilterContext | undefined): FilterPredicate {
  if (op !== "=" && op !== "!=") {
    throw new Error(`operator '${op}' not valid for touched_by (use =, !=)`);
  }
  const h = ctx?.history;
  if (!h) return () => false;
  const author = value.toLowerCase();
  // GraphSnapshot doesn't carry an author field today (the live CommitMeta
  // does), so we fall back to matching the label, which by convention in
  // the mock includes the author. This is an approximation the task
  // explicitly calls out.
  const touchedIndices = new Map<string, number[]>();
  for (let i = 0; i < h.snapshots.length; i++) {
    const s = h.snapshots[i];
    const ids = [...(s.added ?? []), ...(s.removed ?? [])];
    for (const id of ids) {
      const list = touchedIndices.get(id);
      if (list) list.push(i); else touchedIndices.set(id, [i]);
    }
  }
  const authorMatches = (snap: GraphSnapshot): boolean => {
    const label = (snap.label ?? "").toLowerCase();
    if (label.includes(author)) return true;
    const sha = (snap.commitSha ?? "").toLowerCase();
    return sha.startsWith(author);
  };
  return edge => {
    const indices = touchedIndices.get(edge.id);
    if (!indices || indices.length === 0) return op === "!=";
    const hit = indices.some(i => authorMatches(h.snapshots[i]));
    return op === "=" ? hit : !hit;
  };
}

function temporalChurn(op: string, value: string, ctx: FilterContext | undefined): FilterPredicate {
  if (op !== ">" && op !== "<" && op !== ">=" && op !== "<=" && op !== "=" && op !== "!=") {
    throw new Error(`operator '${op}' not valid for churn`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`churn expects an integer, got '${value}'`);
  const h = ctx?.history;
  if (!h) return () => false;
  const churn = buildChurnMap(h);
  return edge => {
    const c = churn.get(edge.id) ?? 0;
    switch (op) {
      case ">": return c > n;
      case "<": return c < n;
      case ">=": return c >= n;
      case "<=": return c <= n;
      case "=": return c === n;
      case "!=": return c !== n;
    }
    return false;
  };
}

function temporalIntroducedBetween(op: string, value: string, ctx: FilterContext | undefined): FilterPredicate {
  if (op !== "=") {
    throw new Error(`operator '${op}' not valid for introduced_between (use =)`);
  }
  const h = ctx?.history;
  if (!h) return () => false;
  // value format: "a..b" where a/b are labels or short shas.
  const m = /^([^.]+)\.\.([^.]+)$/.exec(value);
  if (!m) throw new Error(`introduced_between expects 'a..b' range, got '${value}'`);
  const aIdx = resolveRef(h, m[1]);
  const bIdx = resolveRef(h, m[2]);
  if (aIdx === null || bIdx === null) return () => false;
  const lo = Math.min(aIdx, bIdx);
  const hi = Math.max(aIdx, bIdx);
  const firstAppearance = buildFirstAppearanceMap(h);
  return edge => {
    const idx = firstAppearance.get(edge.id);
    if (idx === undefined) return false;
    return idx >= lo && idx <= hi;
  };
}

function compareStr(a: string, op: string, b: string): boolean {
  if (op === "=") return a === b;
  if (op === "!=") return a !== b;
  throw new Error(`operator '${op}' not valid for string field (use = or !=)`);
}

function compareBool(a: boolean, op: string, b: string): boolean {
  const rhs = b === "true" ? true : b === "false" ? false : null;
  if (rhs === null) throw new Error(`boolean field expects true/false, got '${b}'`);
  if (op === "=") return a === rhs;
  if (op === "!=") return a !== rhs;
  throw new Error(`operator '${op}' not valid for boolean field`);
}

function compareSeverity(a: EdgeSeverity | undefined, op: string, b: string): boolean {
  const bKey = b as EdgeSeverity;
  if (!(bKey in SEV_RANK)) throw new Error(`severity '${b}' not one of low|medium|high|critical`);
  const aRank = SEV_RANK[a ?? "low"];
  const bRank = SEV_RANK[bKey];
  switch (op) {
    case "=": return (a ?? "low") === bKey;
    case "!=": return (a ?? "low") !== bKey;
    case ">=": return aRank >= bRank;
    case "<=": return aRank <= bRank;
    case ">": return aRank > bRank;
    case "<": return aRank < bRank;
    default: throw new Error(`unknown operator '${op}'`);
  }
}

export type EdgeKindValueHint = EdgeKind;

/** Exported for consumers / tests that want to know whether a given key is
 *  temporal (i.e., requires a context to evaluate correctly). */
export function isTemporalKey(key: string): boolean {
  return TEMPORAL_KEYS.has(key);
}
