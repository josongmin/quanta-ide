import type { EdgeKind, EdgeLayer, EdgeSeverity } from "./types";
import type { GraphHistory } from "./history";

export type CompletionKind = "key" | "op" | "value" | "bool" | "punct";

export interface Completion {
  label: string;
  kind: CompletionKind;
  insertText: string;
  score?: number;
  description?: string;
}

const KEYS = [
  "layer",
  "kind",
  "severity",
  "animated",
  "evidence",
  // Temporal (T2)
  "added_since",
  "stable_since",
  "touched_by",
  "churn",
  "introduced_between",
] as const;
type FilterKey = (typeof KEYS)[number];

const EQUALITY_OPS = ["=", "!="] as const;
const ORDER_OPS = [">=", "<=", ">", "<"] as const;
const BOOLS = ["and", "or"] as const;

const LAYER_VALUES: readonly EdgeLayer[] = ["structural", "flow", "safety", "impact"];
const KIND_VALUES: readonly EdgeKind[] = [
  "import",
  "call",
  "reference",
  "cfg",
  "inheritance",
  "dataflow",
  "effect",
  "pdg",
  "alias",
  "taint-propagation",
  "sanitizer",
  "race",
  "cycle",
  "finding",
  "blast",
  "impact",
  "diff",
  "dependency",
  "witness",
];
const SEVERITY_VALUES: readonly EdgeSeverity[] = ["low", "medium", "high", "critical"];
const BOOL_VALUES = ["true", "false"] as const;
const TIME_VALUES = ["1d", "7d", "2w", "30d", "1m", "3m", "6m", "1y"] as const;

interface ScanToken {
  kind: "ident" | "op" | "bool" | "not" | "lparen" | "rparen";
  value: string;
  start: number;
  end: number;
}

function scanTokens(src: string): ScanToken[] {
  const out: ScanToken[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (ch === "(") { out.push({ kind: "lparen", value: "(", start: i, end: i + 1 }); i++; continue; }
    if (ch === ")") { out.push({ kind: "rparen", value: ")", start: i, end: i + 1 }); i++; continue; }
    if (ch === "!" && src[i + 1] !== "=") {
      out.push({ kind: "not", value: "!", start: i, end: i + 1 }); i++; continue;
    }
    if (src.startsWith("!=", i) || src.startsWith(">=", i) || src.startsWith("<=", i)) {
      out.push({ kind: "op", value: src.substr(i, 2), start: i, end: i + 2 });
      i += 2; continue;
    }
    if (src.startsWith("&&", i)) {
      out.push({ kind: "bool", value: "and", start: i, end: i + 2 }); i += 2; continue;
    }
    if (src.startsWith("||", i)) {
      out.push({ kind: "bool", value: "or", start: i, end: i + 2 }); i += 2; continue;
    }
    if (ch === "=" || ch === ">" || ch === "<") {
      out.push({ kind: "op", value: ch, start: i, end: i + 1 }); i++; continue;
    }
    if (/[A-Za-z0-9_\-./]/.test(ch)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_\-./]/.test(src[i])) i++;
      const word = src.slice(start, i).toLowerCase();
      if (word === "and" || word === "or") out.push({ kind: "bool", value: word, start, end: i });
      else if (word === "not") out.push({ kind: "not", value: word, start, end: i });
      else out.push({ kind: "ident", value: word, start, end: i });
      continue;
    }
    i++;
  }
  return out;
}

type Context =
  | { expect: "key-or-open" }
  | { expect: "op"; key: string }
  | { expect: "value"; key: string }
  | { expect: "bool-or-close" };

interface Partial {
  text: string;
  start: number;
  end: number;
}

interface ScanResult {
  context: Context;
  partial: Partial | null;
}

function analyze(src: string, cursor: number): ScanResult {
  const upto = src.slice(0, cursor);
  const tokens = scanTokens(upto);

  let partial: Partial | null = null;
  const last = tokens[tokens.length - 1];
  const trailingWhitespace = cursor > 0 && /\s/.test(src[cursor - 1]);
  if (last && last.end === cursor && last.kind === "ident" && !trailingWhitespace) {
    partial = { text: last.value, start: last.start, end: last.end };
    tokens.pop();
  } else if (last && last.end === cursor && last.kind === "bool" && !trailingWhitespace) {
    partial = { text: last.value, start: last.start, end: last.end };
    tokens.pop();
  } else if (last && last.end === cursor && last.kind === "not" && last.value === "not" && !trailingWhitespace) {
    partial = { text: last.value, start: last.start, end: last.end };
    tokens.pop();
  }

  const context = detectContext(tokens);
  return { context, partial };
}

function detectContext(tokens: ScanToken[]): Context {
  if (tokens.length === 0) return { expect: "key-or-open" };
  const last = tokens[tokens.length - 1];
  if (last.kind === "lparen") return { expect: "key-or-open" };
  if (last.kind === "bool") return { expect: "key-or-open" };
  if (last.kind === "not") return { expect: "key-or-open" };
  if (last.kind === "op") {
    const prev = tokens[tokens.length - 2];
    const key = prev && prev.kind === "ident" ? prev.value : "";
    return { expect: "value", key };
  }
  if (last.kind === "rparen") return { expect: "bool-or-close" };
  if (last.kind === "ident") {
    const prev = tokens[tokens.length - 2];
    if (!prev) return { expect: "op", key: last.value };
    if (prev.kind === "op") return { expect: "bool-or-close" };
    if (prev.kind === "bool" || prev.kind === "lparen" || prev.kind === "not") {
      return { expect: "op", key: last.value };
    }
    return { expect: "op", key: last.value };
  }
  return { expect: "key-or-open" };
}

function valuesForKey(key: string, history: GraphHistory | undefined): readonly string[] {
  switch (key) {
    case "layer": return LAYER_VALUES;
    case "kind": return KIND_VALUES;
    case "severity": return SEVERITY_VALUES;
    case "animated":
    case "evidence":
      return BOOL_VALUES;
    case "added_since":
    case "stable_since":
      return TIME_VALUES;
    case "touched_by":
      return authorsFromHistory(history);
    case "churn":
      return ["1", "3", "5", "10", "20"];
    case "introduced_between":
      return refPairsFromHistory(history);
    default: return [];
  }
}

function authorsFromHistory(history: GraphHistory | undefined): readonly string[] {
  if (!history) return ["alice", "bob", "charlie", "dana"];
  // GraphSnapshot lacks an author field today (CommitMeta carries it in
  // the live source), but the mock convention stuffs the author into the
  // label. Harvest distinct tokens from labels as a best-effort.
  const seen = new Set<string>();
  for (const s of history.snapshots) {
    const label = (s.label ?? "").toLowerCase();
    for (const tok of label.split(/[^a-z0-9]+/)) {
      if (tok.length >= 3 && tok.length <= 16) seen.add(tok);
    }
  }
  if (seen.size === 0) return ["alice", "bob", "charlie", "dana"];
  return [...seen].slice(0, 10);
}

function refPairsFromHistory(history: GraphHistory | undefined): readonly string[] {
  if (!history || history.snapshots.length < 2) return ["v1.0..v1.2"];
  const n = history.snapshots.length;
  const first = history.snapshots[0];
  const last = history.snapshots[n - 1];
  const a = first.commitSha?.slice(0, 7) ?? first.label ?? "0";
  const b = last.commitSha?.slice(0, 7) ?? last.label ?? String(n - 1);
  return [`${a}..${b}`];
}

function rank(items: Completion[], partialText: string): Completion[] {
  const q = partialText.toLowerCase();
  if (!q) {
    return items.map((it, idx) => ({ ...it, score: 1 - idx / Math.max(items.length, 1) }));
  }
  const scored: Completion[] = [];
  for (const it of items) {
    const label = it.label.toLowerCase();
    if (label === q) scored.push({ ...it, score: 1 });
    else if (label.startsWith(q)) scored.push({ ...it, score: 0.9 - (label.length - q.length) * 0.01 });
    else if (label.includes(q)) scored.push({ ...it, score: 0.5 - (label.length - q.length) * 0.005 });
  }
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return scored;
}

function keyCompletions(): Completion[] {
  const out: Completion[] = [];
  for (const k of KEYS) {
    out.push({ label: k, kind: "key", insertText: k, description: keyDescription(k) });
  }
  out.push({ label: "(", kind: "punct", insertText: "(" });
  out.push({ label: "not", kind: "bool", insertText: "not" });
  return out;
}

function keyDescription(k: FilterKey): string {
  switch (k) {
    case "layer": return "structural | flow | safety | impact";
    case "kind": return "edge kind enum";
    case "severity": return "low | medium | high | critical";
    case "animated": return "true | false";
    case "evidence": return "true | false";
    case "added_since": return "first appearance within 2w | 30d | 3m | 1y";
    case "stable_since": return "unchanged since 1m | 3m | 1y";
    case "touched_by": return "author name of any commit touching this edge";
    case "churn": return "times edge toggled (added + removed) in history";
    case "introduced_between": return "first appearance within a..b range";
  }
}

function opCompletions(key: string): Completion[] {
  const out: Completion[] = [];
  for (const op of EQUALITY_OPS) out.push({ label: op, kind: "op", insertText: op });
  if (key === "severity" || key === "churn" || key === "added_since" || key === "stable_since") {
    for (const op of ORDER_OPS) out.push({ label: op, kind: "op", insertText: op });
  }
  return out;
}

function valueCompletions(key: string, history: GraphHistory | undefined): Completion[] {
  const values = valuesForKey(key, history);
  return values.map(v => ({ label: v, kind: "value" as const, insertText: v }));
}

function boolOrCloseCompletions(): Completion[] {
  const out: Completion[] = [];
  for (const b of BOOLS) out.push({ label: b, kind: "bool", insertText: b });
  out.push({ label: ")", kind: "punct", insertText: ")" });
  return out;
}

export interface CompletionOptions {
  /** Optional history — enables author / ref value completions for temporal keys. */
  history?: GraphHistory;
}

export function getCompletions(src: string, cursor: number, opts?: CompletionOptions): Completion[] {
  const clamped = Math.max(0, Math.min(cursor, src.length));
  const { context, partial } = analyze(src, clamped);
  const partialText = partial?.text ?? "";
  const history = opts?.history;

  let pool: Completion[];
  switch (context.expect) {
    case "key-or-open":
      pool = keyCompletions();
      break;
    case "op":
      pool = opCompletions(context.key);
      break;
    case "value":
      pool = valueCompletions(context.key, history);
      break;
    case "bool-or-close":
      pool = boolOrCloseCompletions();
      break;
  }

  const ranked = rank(pool, partialText);
  // Bump the cap to accommodate the expanded KEY set (5 base + 5 temporal,
  // plus "(" and "not") while still feeling snappy in a popover menu.
  const cap = context.expect === "key-or-open" ? 14 : 10;
  return ranked.slice(0, cap);
}
