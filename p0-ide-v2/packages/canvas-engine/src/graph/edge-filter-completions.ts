import type { EdgeKind, EdgeLayer, EdgeSeverity } from "./types";

export type CompletionKind = "key" | "op" | "value" | "bool" | "punct";

export interface Completion {
  label: string;
  kind: CompletionKind;
  insertText: string;
  score?: number;
  description?: string;
}

const KEYS = ["layer", "kind", "severity", "animated", "evidence"] as const;
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

function valuesForKey(key: string): readonly string[] {
  switch (key) {
    case "layer": return LAYER_VALUES;
    case "kind": return KIND_VALUES;
    case "severity": return SEVERITY_VALUES;
    case "animated":
    case "evidence":
      return BOOL_VALUES;
    default: return [];
  }
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
  }
}

function opCompletions(key: string): Completion[] {
  const out: Completion[] = [];
  for (const op of EQUALITY_OPS) out.push({ label: op, kind: "op", insertText: op });
  if (key === "severity") {
    for (const op of ORDER_OPS) out.push({ label: op, kind: "op", insertText: op });
  }
  return out;
}

function valueCompletions(key: string): Completion[] {
  const values = valuesForKey(key);
  return values.map(v => ({ label: v, kind: "value" as const, insertText: v }));
}

function boolOrCloseCompletions(): Completion[] {
  const out: Completion[] = [];
  for (const b of BOOLS) out.push({ label: b, kind: "bool", insertText: b });
  out.push({ label: ")", kind: "punct", insertText: ")" });
  return out;
}

export function getCompletions(src: string, cursor: number): Completion[] {
  const clamped = Math.max(0, Math.min(cursor, src.length));
  const { context, partial } = analyze(src, clamped);
  const partialText = partial?.text ?? "";

  let pool: Completion[];
  switch (context.expect) {
    case "key-or-open":
      pool = keyCompletions();
      break;
    case "op":
      pool = opCompletions(context.key);
      break;
    case "value":
      pool = valueCompletions(context.key);
      break;
    case "bool-or-close":
      pool = boolOrCloseCompletions();
      break;
  }

  const ranked = rank(pool, partialText);
  return ranked.slice(0, 10);
}
