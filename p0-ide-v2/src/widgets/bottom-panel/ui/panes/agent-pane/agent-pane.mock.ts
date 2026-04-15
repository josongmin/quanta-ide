// Mock data for the Agent pane — tokens, session, grounding, memory, todos,
// and the per-turn event logs that back the detail drawer. Kept here so the
// React components stay thin; when the real engine data lands, these exports
// are the only symbols that need to be re-routed.

export type CtxKind = "file" | "symbol" | "doc" | "tool";
export type MemType = "user" | "feedback" | "project" | "reference";
export type TodoState = "pending" | "doing" | "done";
export type DetailKind = "meter" | "ctx" | "mem" | "todo";

export const session = {
  model: "opus-4-6 · 1M ctx",
  runtime: "46m 53s",
  cache: "warm",
};

export const tokens = {
  inputUsed: 184_220,
  inputCached: 142_100,
  inputCap: 1_000_000,
  outputUsed: 12_480,
  outputCap: 64_000,
  cost: 2.47,
  budget: 20.0,
  cacheHit: 0.77,
};

export interface ContextItem {
  kind: CtxKind;
  name: string;
  tokens: number;
  pinned?: boolean;
  idleTurns?: number;
}

export const contextItems: ContextItem[] = [
  { kind: "file",   name: "orchestrator.py",              tokens: 8420, pinned: true, idleTurns: 0 },
  { kind: "file",   name: "experience_store.py",          tokens: 3110, idleTurns: 6 },
  { kind: "symbol", name: "ExperienceStore.save",         tokens:  620, pinned: true, idleTurns: 0 },
  { kind: "doc",    name: "ADR-14 · persistent reasoning", tokens: 1840, idleTurns: 7 },
  { kind: "tool",   name: "taint-analyzer v2 schema",      tokens:  240, idleTurns: 4 },
  { kind: "file",   name: "strategy.py",                   tokens: 1920, idleTurns: 5 },
];

export const IDLE_THRESHOLD = 4;

// ── Economy: what the engine is actually paying back ─────────────────
// Each entry describes a class of engine query that substituted for a raw
// file read or an agent guess, along with the counterfactual token cost.
export const paybackQueries: { kind: string; count: number; saved: number }[] = [
  { kind: "file-read replaced",  count: 47, saved: 188_400 },
  { kind: "call-graph query",    count: 18, saved:  76_200 },
  { kind: "incident DNA match",  count:  3, saved:  28_900 },
  { kind: "typestate lookup",    count:  2, saved:  18_500 },
];

export const savedTokens = paybackQueries.reduce((a, p) => a + p.saved, 0);
export const savedUsd = (savedTokens / 1_000_000) * 15; // opus input est. $15/1M
export const paybackFactor = (savedTokens + tokens.inputUsed) / tokens.inputUsed;

// ── Cost attribution: what signals drove the last input window ───────
export const costAttribution: { signal: string; pct: number; tok: number; color: string }[] = [
  { signal: "taint",     pct: 42, tok:  77_300, color: "var(--danger)" },
  { signal: "blast",     pct: 23, tok:  42_400, color: "var(--accent)" },
  { signal: "behavior",  pct: 14, tok:  25_800, color: "var(--success)" },
  { signal: "ownership", pct:  9, tok:  16_600, color: "var(--accent-purple)" },
  { signal: "typestate", pct:  7, tok:  12_900, color: "var(--warn)" },
  { signal: "other",     pct:  5, tok:   9_220, color: "var(--fg-subtle)" },
];

// ── Topic ⑤-c · Session timescrubber: turn-by-turn state snapshots ────
export interface TurnSnapshot {
  turn: number;
  t: string;
  label: string;
  inputTok: number;
  outputTok: number;
  contextTok: number;
  events: string[];
  cost: number;
}

export const turnSnapshots: TurnSnapshot[] = [
  { turn: 1, t: "00:00", label: "initial prompt",     inputTok:    380, outputTok:    920, contextTok:    380, cost: 0.015, events: ["session start"] },
  { turn: 2, t: "01:28", label: "read orchestrator",  inputTok: 12_040, outputTok:  5_130, contextTok: 12_420, cost: 0.214, events: ["read orchestrator.py", "taint v2 fired"] },
  { turn: 3, t: "03:02", label: "inspect taint path", inputTok: 82_700, outputTok:  7_770, contextTok: 22_280, cost: 0.637, events: ["fetch ADR-14", "incident DNA match 91%"] },
  { turn: 4, t: "04:05", label: "propose patch",      inputTok: 94_200, outputTok:  9_680, contextTok: 23_340, cost: 1.022, events: ["simulate change", "verification checklist"] },
  { turn: 5, t: "05:22", label: "generate tests",     inputTok: 96_920, outputTok: 11_770, contextTok: 25_420, cost: 1.467, events: ["read strategy.py", "pin ExperienceStore.save"] },
  { turn: 6, t: "06:40", label: "current",            inputTok:184_220, outputTok: 12_480, contextTok: 16_150, cost: 2.470, events: ["streaming"] },
];

// ── Budget forecast: at current burn, when we hit the cap ────────────
export const forecast = {
  burnPerMin: 3_920,          // input tokens / min (avg over session)
  minutesToCap: Math.round((tokens.inputCap - tokens.inputUsed) / 3_920),
  costBurnPerMin: 0.053,
  minutesToBudget: Math.round((tokens.budget - tokens.cost) / 0.053),
};

// ── Grounding: how the agent's last response is tied to engine facts ─
export type CiteState = "ok" | "weak" | "missing";
export const grounding = {
  turn: 6,
  score: 87,
  citedCount: 7,
  unbackedCount: 0,
  similarityAvg: 0.93,
  citations: [
    { state: "ok"      as CiteState, claim: "2 open taint paths",        engine: "taint v2",      ref: "execute() L12",        sim: 0.98 },
    { state: "ok"      as CiteState, claim: "blast 17 → 2",               engine: "blast",          ref: "ExperienceStore.save", sim: 0.94 },
    { state: "ok"      as CiteState, claim: "no public API break",        engine: "behavior diff",  ref: "ExperienceStore",      sim: 0.92 },
    { state: "ok"      as CiteState, claim: "+3 regression tests needed", engine: "coverage",       ref: "execute() branches",   sim: 0.88 },
    { state: "ok"      as CiteState, claim: "INC-412 · 91% match",         engine: "incident DNA",   ref: "taint shape",          sim: 0.91 },
    { state: "weak"    as CiteState, claim: "0 new type errors",           engine: "type check",     ref: "validate_trace()",     sim: 0.72 },
    { state: "ok"      as CiteState, claim: "behavior identical on valid", engine: "behavior diff",  ref: "validated path",       sim: 0.95 },
  ],
};

// ── Blind spots: symbols on the taint path the agent hasn't read ─────
export type BlindRisk = "high" | "med";
export type BlindLayer = "domain" | "port" | "adapter" | "infra" | "app";
export const blindSpots: { name: string; kind: "method" | "function" | "class"; layer: BlindLayer; why: string; risk: BlindRisk }[] = [
  { name: "Tracer.emit", kind: "method",   layer: "infra",  why: "taint hop 2/4", risk: "high" },
  { name: "step.run",    kind: "method",   layer: "domain", why: "taint hop 1/4", risk: "med" },
];

// ── Signal freshness ─────────────────────────────────────────────────
export type FreshState = "fresh" | "aging" | "stale";
export const signalFreshness: { signal: string; age: string; ageMin: number; state: FreshState; note?: string }[] = [
  { signal: "taint v2",      age: "2m",  ageMin: 2,  state: "fresh" },
  { signal: "blast",         age: "8m",  ageMin: 8,  state: "aging", note: "recompute recommended" },
  { signal: "behavior diff", age: "1m",  ageMin: 1,  state: "fresh" },
  { signal: "ownership",     age: "4m",  ageMin: 4,  state: "fresh" },
  { signal: "incident DNA",  age: "23m", ageMin: 23, state: "stale", note: "patches may cite outdated INCs" },
];

export const memory: { type: MemType; name: string; summary: string; updated: string }[] = [
  { type: "user",      name: "Role & goal",             summary: "Staff eng · Software Intelligence Platform (SE infra)", updated: "session start" },
  { type: "feedback",  name: "No left color stripe",    summary: "Avoid border-left category color on cards/rows",        updated: "2d" },
  { type: "project",   name: "Overlay architecture",    summary: "L1 passive · L2 hover · L3 inspector · L4 shortcuts",    updated: "this session" },
  { type: "feedback",  name: "Evidence-backed patches", summary: "Every suggestion must tag its engine source",           updated: "3m" },
  { type: "reference", name: "Engine signal contracts", summary: "entities/engine/ defines signal shapes",                 updated: "session start" },
];

export const todos: { state: TodoState; content: string; source?: string }[] = [
  { state: "doing",   content: "Redesign Agent pane as agent-state surface",      source: "user" },
  { state: "pending", content: "Wire context items to real pin/unpin actions",    source: "impl" },
  { state: "pending", content: "Connect memory list to ~/.claude/.../memory",     source: "impl" },
  { state: "pending", content: "Stream token usage from API response headers",    source: "impl" },
  { state: "done",    content: "L1 hero blocker + taint-chain visualization",     source: "prior" },
  { state: "done",    content: "Risk-delta rings + verification checklist",       source: "prior" },
  { state: "done",    content: "Evidence source tags on L2/L3",                   source: "prior" },
];

export const CTX_GLYPH: Record<CtxKind, string> = {
  file:   "F",
  symbol: "ƒ",
  doc:    "§",
  tool:   "⌥",
};

// ── Event logs (mock) ──────────────────────────────────────────────────

export interface MeterEvent {
  t: string;        // "t+mm:ss"
  turn: number;
  kind: "user" | "resp" | "tool";
  inDelta: number;  // input tokens added (negative = none)
  cachedDelta: number;
  outDelta: number;
  cost: number;
  note?: string;
}

export const meterEvents: MeterEvent[] = [
  { t: "00:00", turn: 1, kind: "user", inDelta: 380,    cachedDelta: 0,       outDelta: 0,    cost: 0.001, note: "initial prompt" },
  { t: "00:02", turn: 1, kind: "resp", inDelta: 1_240,  cachedDelta: 0,       outDelta: 920,  cost: 0.014 },
  { t: "01:28", turn: 2, kind: "user", inDelta: 120,    cachedDelta: 0,       outDelta: 0,    cost: 0.000 },
  { t: "01:34", turn: 2, kind: "tool", inDelta: 8_420,  cachedDelta: 0,       outDelta: 0,    cost: 0.025, note: "read orchestrator.py" },
  { t: "02:14", turn: 2, kind: "resp", inDelta: 82_400, cachedDelta: 78_200,  outDelta: 4_210, cost: 0.525 },
  { t: "03:02", turn: 3, kind: "user", inDelta: 90,     cachedDelta: 0,       outDelta: 0,    cost: 0.000 },
  { t: "03:08", turn: 3, kind: "tool", inDelta: 3_110,  cachedDelta: 0,       outDelta: 0,    cost: 0.009, note: "read experience_store.py" },
  { t: "03:18", turn: 3, kind: "tool", inDelta: 1_840,  cachedDelta: 0,       outDelta: 0,    cost: 0.005, note: "fetch ADR-14" },
  { t: "03:44", turn: 3, kind: "resp", inDelta: 96_100, cachedDelta: 91_000,  outDelta: 2_640, cost: 0.418 },
  { t: "04:05", turn: 4, kind: "tool", inDelta: 240,    cachedDelta: 0,       outDelta: 0,    cost: 0.001, note: "taint-analyzer schema" },
  { t: "04:45", turn: 4, kind: "resp", inDelta: 88_300, cachedDelta: 82_100,  outDelta: 1_910, cost: 0.385 },
  { t: "05:22", turn: 5, kind: "tool", inDelta: 1_920,  cachedDelta: 0,       outDelta: 0,    cost: 0.006, note: "read strategy.py" },
  { t: "05:55", turn: 5, kind: "resp", inDelta: 92_400, cachedDelta: 85_600,  outDelta: 2_800, cost: 0.445 },
  { t: "06:40", turn: 6, kind: "resp", inDelta: 94_800, cachedDelta: 88_300,  outDelta: 0,    cost: 0.447, note: "streaming" },
];

export interface CtxEvent {
  t: string;
  turn: number;
  action: "grep" | "read" | "fetch" | "pin" | "tool" | "evict";
  resource: string;
  delta: string;   // "+8.4k", "hit 3", etc.
  note?: string;   // "cache miss", etc.
}

export const ctxEvents: CtxEvent[] = [
  { t: "01:30", turn: 2, action: "grep",  resource: '"validate_trace"',        delta: "hit 3 files" },
  { t: "01:34", turn: 2, action: "read",  resource: "orchestrator.py",          delta: "+8.4k", note: "cache miss" },
  { t: "03:08", turn: 3, action: "read",  resource: "experience_store.py",      delta: "+3.1k", note: "cache miss" },
  { t: "03:18", turn: 3, action: "fetch", resource: "ADR-14 · persistent…",     delta: "+1.8k", note: "docs engine" },
  { t: "04:05", turn: 4, action: "tool",  resource: "taint-analyzer v2 schema", delta: "+0.2k" },
  { t: "05:22", turn: 5, action: "read",  resource: "strategy.py",              delta: "+1.9k", note: "cache miss" },
  { t: "05:24", turn: 5, action: "pin",   resource: "ExperienceStore.save",     delta: "+0.6k", note: "manual pin" },
  { t: "05:24", turn: 5, action: "pin",   resource: "orchestrator.py",          delta: "—",     note: "manual pin" },
];

export interface MemEvent {
  t: string;
  turn: number;
  action: "inject" | "recall" | "hit" | "miss";
  name: string;
  type: MemType;
  trigger?: string;
}

export const memEvents: MemEvent[] = [
  { t: "00:00", turn: 1, action: "inject", name: "Role & goal",             type: "user",      trigger: "session start" },
  { t: "00:00", turn: 1, action: "inject", name: "Engine signal contracts", type: "reference", trigger: "session start" },
  { t: "02:10", turn: 2, action: "recall", name: "Overlay architecture",    type: "project",   trigger: '"L1 hero" mentioned' },
  { t: "02:14", turn: 2, action: "hit",    name: "Overlay architecture",    type: "project",   trigger: "similarity 0.82" },
  { t: "03:15", turn: 3, action: "recall", name: "No left color stripe",    type: "feedback",  trigger: "card design ref" },
  { t: "03:16", turn: 3, action: "inject", name: "Evidence-backed patches", type: "feedback",  trigger: "pre-L3 guard" },
  { t: "04:40", turn: 4, action: "miss",   name: "token-limit policy",      type: "project",   trigger: "not found" },
  { t: "05:20", turn: 5, action: "recall", name: "Engine signal contracts", type: "reference", trigger: "entities/engine/" },
];

export interface TodoEvent {
  t: string;
  turn: number;
  action: "create" | "start" | "done" | "cancel";
  content: string;
  source?: string;
}

export const todoEvents: TodoEvent[] = [
  { t: "00:05", turn: 1, action: "create", content: "Redesign Agent pane as agent-state surface", source: "user" },
  { t: "00:06", turn: 1, action: "start",  content: "Redesign Agent pane as agent-state surface" },
  { t: "01:10", turn: 2, action: "create", content: "L1 hero blocker + taint-chain visualization", source: "prior" },
  { t: "02:30", turn: 2, action: "done",   content: "L1 hero blocker + taint-chain visualization" },
  { t: "03:40", turn: 3, action: "create", content: "Risk-delta rings + verification checklist",  source: "prior" },
  { t: "04:15", turn: 4, action: "done",   content: "Risk-delta rings + verification checklist" },
  { t: "04:45", turn: 4, action: "create", content: "Wire context items to real pin/unpin actions", source: "impl" },
  { t: "04:45", turn: 4, action: "create", content: "Connect memory list to ~/.claude/.../memory",  source: "impl" },
  { t: "05:40", turn: 5, action: "create", content: "Stream token usage from API response headers", source: "impl" },
  { t: "05:55", turn: 5, action: "done",   content: "Evidence source tags on L2/L3" },
];

export const DETAIL_TITLE: Record<DetailKind, string> = {
  meter: "Session meter",
  ctx:   "Context",
  mem:   "Memory",
  todo:  "Todo",
};
