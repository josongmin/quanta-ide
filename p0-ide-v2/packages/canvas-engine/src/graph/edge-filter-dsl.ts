import type { FileEdge, EdgeKind, EdgeLayer, EdgeSeverity } from "./types";

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
//   OP         = "=" | "!=" | ">=" | "<=" | ">" | "<"
//   VALUE      = identifier (unquoted) — lowercase, no whitespace
//   expr       = term (BOOL term)*
//   BOOL       = "and" | "or" | "&&" | "||"
//   Prefix "!" or "not " negates a term.
//
// Examples:
//   layer=safety
//   severity>=high and not kind=finding
//   (layer=impact or layer=safety) and animated=true

const SEV_RANK: Record<EdgeSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

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

/**
 * Compile a DSL string to a predicate. On error returns an object with an
 * `error` string — the HUD surfaces it inline without throwing. Empty /
 * whitespace input compiles to "always true" so clearing the box restores
 * the previous render.
 */
export function compileEdgeFilter(src: string): FilterCompileOutput {
  const trimmed = src.trim();
  if (trimmed.length === 0) return { predicate: () => true };
  try {
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens);
    const ast = parser.parseExpr();
    if (!parser.atEnd()) {
      return { error: `unexpected token at ${parser.peek().start}`, at: parser.peek().start };
    }
    return { predicate: makePredicate(ast) };
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

function makePredicate(ast: AST): FilterPredicate {
  if (ast.type === "and") {
    const a = makePredicate(ast.left);
    const b = makePredicate(ast.right);
    return edge => a(edge) && b(edge);
  }
  if (ast.type === "or") {
    const a = makePredicate(ast.left);
    const b = makePredicate(ast.right);
    return edge => a(edge) || b(edge);
  }
  if (ast.type === "not") {
    const inner = makePredicate(ast.inner);
    return edge => !inner(edge);
  }
  return atomPredicate(ast.key, ast.op, ast.value);
}

function atomPredicate(key: string, op: string, value: string): FilterPredicate {
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
    default:
      throw new Error(`unknown key '${key}' (expected: layer, kind, severity, animated, evidence)`);
  }
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
