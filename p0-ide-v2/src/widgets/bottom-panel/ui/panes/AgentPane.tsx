import { useEffect, useState, type ReactNode } from "react";
import { toast } from "@/shared/model/toast-store";
import { focusStore } from "@/shared/model/focus-store";

type CtxKind = "file" | "symbol" | "doc" | "tool";
type MemType = "user" | "feedback" | "project" | "reference";
type TodoState = "pending" | "doing" | "done";
type DetailKind = "meter" | "ctx" | "mem" | "todo";

const session = {
  model: "opus-4-6 · 1M ctx",
  runtime: "46m 53s",
  cache: "warm",
};

const tokens = {
  inputUsed: 184_220,
  inputCached: 142_100,
  inputCap: 1_000_000,
  outputUsed: 12_480,
  outputCap: 64_000,
  cost: 2.47,
  budget: 20.0,
  cacheHit: 0.77,
};

const contextItems: {
  kind: CtxKind;
  name: string;
  tokens: number;
  pinned?: boolean;
  idleTurns?: number;
}[] = [
  { kind: "file",   name: "orchestrator.py",              tokens: 8420, pinned: true, idleTurns: 0 },
  { kind: "file",   name: "experience_store.py",          tokens: 3110, idleTurns: 6 },
  { kind: "symbol", name: "ExperienceStore.save",         tokens:  620, pinned: true, idleTurns: 0 },
  { kind: "doc",    name: "ADR-14 · persistent reasoning", tokens: 1840, idleTurns: 7 },
  { kind: "tool",   name: "taint-analyzer v2 schema",      tokens:  240, idleTurns: 4 },
  { kind: "file",   name: "strategy.py",                   tokens: 1920, idleTurns: 5 },
];
const IDLE_THRESHOLD = 4;

// ── Economy: what the engine is actually paying back ─────────────────
// Each entry describes a class of engine query that substituted for a raw
// file read or an agent guess, along with the counterfactual token cost.
const paybackQueries: { kind: string; count: number; saved: number }[] = [
  { kind: "file-read replaced",  count: 47, saved: 188_400 },
  { kind: "call-graph query",    count: 18, saved:  76_200 },
  { kind: "incident DNA match",  count:  3, saved:  28_900 },
  { kind: "typestate lookup",    count:  2, saved:  18_500 },
];
const savedTokens = paybackQueries.reduce((a, p) => a + p.saved, 0);
const savedUsd = (savedTokens / 1_000_000) * 15; // opus input est. $15/1M
const paybackFactor = (savedTokens + tokens.inputUsed) / tokens.inputUsed;

// ── Cost attribution: what signals drove the last input window ───────
const costAttribution: { signal: string; pct: number; tok: number; color: string }[] = [
  { signal: "taint",     pct: 42, tok:  77_300, color: "var(--danger)" },
  { signal: "blast",     pct: 23, tok:  42_400, color: "var(--accent)" },
  { signal: "behavior",  pct: 14, tok:  25_800, color: "var(--success)" },
  { signal: "ownership", pct:  9, tok:  16_600, color: "var(--accent-purple)" },
  { signal: "typestate", pct:  7, tok:  12_900, color: "var(--warn)" },
  { signal: "other",     pct:  5, tok:   9_220, color: "var(--fg-subtle)" },
];

// ── Topic ⑤-c · Session timescrubber: turn-by-turn state snapshots ────
interface TurnSnapshot {
  turn: number;
  t: string;
  label: string;
  inputTok: number;
  outputTok: number;
  contextTok: number;
  events: string[];
  cost: number;
}

const turnSnapshots: TurnSnapshot[] = [
  { turn: 1, t: "00:00", label: "initial prompt",     inputTok:    380, outputTok:    920, contextTok:    380, cost: 0.015, events: ["session start"] },
  { turn: 2, t: "01:28", label: "read orchestrator",  inputTok: 12_040, outputTok:  5_130, contextTok: 12_420, cost: 0.214, events: ["read orchestrator.py", "taint v2 fired"] },
  { turn: 3, t: "03:02", label: "inspect taint path", inputTok: 82_700, outputTok:  7_770, contextTok: 22_280, cost: 0.637, events: ["fetch ADR-14", "incident DNA match 91%"] },
  { turn: 4, t: "04:05", label: "propose patch",      inputTok: 94_200, outputTok:  9_680, contextTok: 23_340, cost: 1.022, events: ["simulate change", "verification checklist"] },
  { turn: 5, t: "05:22", label: "generate tests",     inputTok: 96_920, outputTok: 11_770, contextTok: 25_420, cost: 1.467, events: ["read strategy.py", "pin ExperienceStore.save"] },
  { turn: 6, t: "06:40", label: "current",            inputTok:184_220, outputTok: 12_480, contextTok: 16_150, cost: 2.470, events: ["streaming"] },
];

// ── Budget forecast: at current burn, when we hit the cap ────────────
const forecast = {
  burnPerMin: 3_920,          // input tokens / min (avg over session)
  minutesToCap: Math.round((tokens.inputCap - tokens.inputUsed) / 3_920),
  costBurnPerMin: 0.053,
  minutesToBudget: Math.round((tokens.budget - tokens.cost) / 0.053),
};

// ── Grounding: how the agent's last response is tied to engine facts ─
type CiteState = "ok" | "weak" | "missing";
const grounding = {
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
type BlindRisk = "high" | "med";
type BlindLayer = "domain" | "port" | "adapter" | "infra" | "app";
const blindSpots: { name: string; kind: "method" | "function" | "class"; layer: BlindLayer; why: string; risk: BlindRisk }[] = [
  { name: "Tracer.emit", kind: "method",   layer: "infra",  why: "taint hop 2/4", risk: "high" },
  { name: "step.run",    kind: "method",   layer: "domain", why: "taint hop 1/4", risk: "med" },
];

// ── Signal freshness ─────────────────────────────────────────────────
type FreshState = "fresh" | "aging" | "stale";
const signalFreshness: { signal: string; age: string; ageMin: number; state: FreshState; note?: string }[] = [
  { signal: "taint v2",      age: "2m",  ageMin: 2,  state: "fresh" },
  { signal: "blast",         age: "8m",  ageMin: 8,  state: "aging", note: "recompute recommended" },
  { signal: "behavior diff", age: "1m",  ageMin: 1,  state: "fresh" },
  { signal: "ownership",     age: "4m",  ageMin: 4,  state: "fresh" },
  { signal: "incident DNA",  age: "23m", ageMin: 23, state: "stale", note: "patches may cite outdated INCs" },
];

const memory: { type: MemType; name: string; summary: string; updated: string }[] = [
  { type: "user",      name: "Role & goal",             summary: "Staff eng · Software Intelligence Platform (SE infra)", updated: "session start" },
  { type: "feedback",  name: "No left color stripe",    summary: "Avoid border-left category color on cards/rows",        updated: "2d" },
  { type: "project",   name: "Overlay architecture",    summary: "L1 passive · L2 hover · L3 inspector · L4 shortcuts",    updated: "this session" },
  { type: "feedback",  name: "Evidence-backed patches", summary: "Every suggestion must tag its engine source",           updated: "3m" },
  { type: "reference", name: "Engine signal contracts", summary: "entities/engine/ defines signal shapes",                 updated: "session start" },
];

const todos: { state: TodoState; content: string; source?: string }[] = [
  { state: "doing",   content: "Redesign Agent pane as agent-state surface",      source: "user" },
  { state: "pending", content: "Wire context items to real pin/unpin actions",    source: "impl" },
  { state: "pending", content: "Connect memory list to ~/.claude/.../memory",     source: "impl" },
  { state: "pending", content: "Stream token usage from API response headers",    source: "impl" },
  { state: "done",    content: "L1 hero blocker + taint-chain visualization",     source: "prior" },
  { state: "done",    content: "Risk-delta rings + verification checklist",       source: "prior" },
  { state: "done",    content: "Evidence source tags on L2/L3",                   source: "prior" },
];

const CTX_GLYPH: Record<CtxKind, string> = {
  file:   "F",
  symbol: "ƒ",
  doc:    "§",
  tool:   "⌥",
};

// ── Event logs (mock) ──────────────────────────────────────────────────

interface MeterEvent {
  t: string;        // "t+mm:ss"
  turn: number;
  kind: "user" | "resp" | "tool";
  inDelta: number;  // input tokens added (negative = none)
  cachedDelta: number;
  outDelta: number;
  cost: number;
  note?: string;
}

const meterEvents: MeterEvent[] = [
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

interface CtxEvent {
  t: string;
  turn: number;
  action: "grep" | "read" | "fetch" | "pin" | "tool" | "evict";
  resource: string;
  delta: string;   // "+8.4k", "hit 3", etc.
  note?: string;   // "cache miss", etc.
}

const ctxEvents: CtxEvent[] = [
  { t: "01:30", turn: 2, action: "grep",  resource: '"validate_trace"',        delta: "hit 3 files" },
  { t: "01:34", turn: 2, action: "read",  resource: "orchestrator.py",          delta: "+8.4k", note: "cache miss" },
  { t: "03:08", turn: 3, action: "read",  resource: "experience_store.py",      delta: "+3.1k", note: "cache miss" },
  { t: "03:18", turn: 3, action: "fetch", resource: "ADR-14 · persistent…",     delta: "+1.8k", note: "docs engine" },
  { t: "04:05", turn: 4, action: "tool",  resource: "taint-analyzer v2 schema", delta: "+0.2k" },
  { t: "05:22", turn: 5, action: "read",  resource: "strategy.py",              delta: "+1.9k", note: "cache miss" },
  { t: "05:24", turn: 5, action: "pin",   resource: "ExperienceStore.save",     delta: "+0.6k", note: "manual pin" },
  { t: "05:24", turn: 5, action: "pin",   resource: "orchestrator.py",          delta: "—",     note: "manual pin" },
];

interface MemEvent {
  t: string;
  turn: number;
  action: "inject" | "recall" | "hit" | "miss";
  name: string;
  type: MemType;
  trigger?: string;
}

const memEvents: MemEvent[] = [
  { t: "00:00", turn: 1, action: "inject", name: "Role & goal",             type: "user",      trigger: "session start" },
  { t: "00:00", turn: 1, action: "inject", name: "Engine signal contracts", type: "reference", trigger: "session start" },
  { t: "02:10", turn: 2, action: "recall", name: "Overlay architecture",    type: "project",   trigger: '"L1 hero" mentioned' },
  { t: "02:14", turn: 2, action: "hit",    name: "Overlay architecture",    type: "project",   trigger: "similarity 0.82" },
  { t: "03:15", turn: 3, action: "recall", name: "No left color stripe",    type: "feedback",  trigger: "card design ref" },
  { t: "03:16", turn: 3, action: "inject", name: "Evidence-backed patches", type: "feedback",  trigger: "pre-L3 guard" },
  { t: "04:40", turn: 4, action: "miss",   name: "token-limit policy",      type: "project",   trigger: "not found" },
  { t: "05:20", turn: 5, action: "recall", name: "Engine signal contracts", type: "reference", trigger: "entities/engine/" },
];

interface TodoEvent {
  t: string;
  turn: number;
  action: "create" | "start" | "done" | "cancel";
  content: string;
  source?: string;
}

const todoEvents: TodoEvent[] = [
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

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function AgentPane() {
  const [detail, setDetail] = useState<DetailKind | null>(null);

  return (
    <div className="pane pane--agent">
      <div className="pb-toolbar">
        <span className="pb-panel-title">Agent</span>
        <span className="pb-toolbar-sep" aria-hidden />
        <span className="agst__toolbar-meta">
          <span className="agst__model">{session.model}</span>
          <span className="agst__sep">·</span>
          <span className="agst__runtime">session {session.runtime}</span>
          <span className="agst__sep">·</span>
          <span className="agst__cache">cache {session.cache}</span>
        </span>
        <div className="pb-toolbar-spacer" />
        <span className="ag-engine-state">
          <span className="ag-engine-state__dot" aria-hidden />
          engine ready
        </span>
      </div>

      <div className="agst-pitch">
        <span className="agst-pitch__lead">Agent state.</span>
        <span className="agst-pitch__body">
          What the agent is carrying right now — context window, token budget, persistent memory, and the global todo
          list. Inspect and prune; the analysis lives in the right-side inspector.
        </span>
      </div>

      <Timescrubber />

      <EnginePaybackCard />

      <TokenMeter onOpenLog={() => setDetail("meter")} />

      <GroundingSection />

      <div className="agst-grid">
        <ContextPanel onOpenLog={() => setDetail("ctx")} />
        <MemoryPanel onOpenLog={() => setDetail("mem")} />
        <TodoPanel onOpenLog={() => setDetail("todo")} />
      </div>

      {detail && <DetailDrawer kind={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function LogButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="agst-log-btn"
      onClick={onClick}
      aria-label={`${label} log`}
    >
      <span className="agst-log-btn__icon" aria-hidden>☰</span>
      <span className="agst-log-btn__txt">log</span>
    </button>
  );
}

function TokenMeter({ onOpenLog }: { onOpenLog: () => void }) {
  const inputPct   = (tokens.inputUsed   / tokens.inputCap)  * 100;
  const cachedPct  = (tokens.inputCached / tokens.inputCap)  * 100;
  const livePct    = inputPct - cachedPct;
  const outPct     = (tokens.outputUsed  / tokens.outputCap) * 100;
  const costPct    = (tokens.cost        / tokens.budget)    * 100;

  return (
    <div className="agst-meter" aria-label="Token usage">
      <div className="agst-meter__head">
        <span className="agst-meter__title">Session meter</span>
        <LogButton label="Session meter" onClick={onOpenLog} />
      </div>
      <MeterRow
        label="input"
        segments={[
          { cls: "agst-meter__fill--cached", width: cachedPct },
          { cls: "agst-meter__fill--used",   width: livePct   },
        ]}
        value={`${fmt(tokens.inputUsed)} / ${fmt(tokens.inputCap)}`}
        sub={`cached ${fmt(tokens.inputCached)} · hit ${Math.round(tokens.cacheHit * 100)}%`}
      />
      <MeterRow
        label="output"
        segments={[{ cls: "agst-meter__fill--used", width: outPct }]}
        value={`${fmt(tokens.outputUsed)} / ${fmt(tokens.outputCap)}`}
      />
      <MeterRow
        label="cost"
        segments={[{ cls: "agst-meter__fill--cost", width: costPct }]}
        value={`$${tokens.cost.toFixed(2)} / $${tokens.budget.toFixed(2)}`}
        sub={`${Math.round(costPct)}% of budget`}
      />

      <div className="agst-meter__forecast">
        <span className="agst-meter__forecast-k">at current burn</span>
        <span className="agst-meter__forecast-v">
          {fmt(forecast.burnPerMin)}/min · cap in {forecast.minutesToCap}m · budget in {forecast.minutesToBudget}m
        </span>
      </div>

      <div className="agst-attr">
        <div className="agst-attr__head">
          <span className="agst-attr__k">by signal</span>
          <span className="agst-attr__total">
            input attribution · {fmt(costAttribution.reduce((a, c) => a + c.tok, 0))} tok
          </span>
        </div>
        <div className="agst-attr__bar" aria-hidden>
          {(() => {
            let left = 0;
            return costAttribution.map((c, i) => {
              const l = left;
              left += c.pct;
              return (
                <span
                  key={i}
                  className="agst-attr__seg"
                  style={{ left: `${l}%`, width: `${c.pct}%`, background: c.color }}
                  title={`${c.signal} · ${c.pct}% · ${fmt(c.tok)} tok`}
                />
              );
            });
          })()}
        </div>
        <div className="agst-attr__legend">
          {costAttribution.map((c) => (
            <span key={c.signal} className="agst-attr__chip">
              <span className="agst-attr__dot" style={{ background: c.color }} aria-hidden />
              <span className="agst-attr__sig">{c.signal}</span>
              <span className="agst-attr__pct">{c.pct}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Topic ② · Grounding section ────────────────────────────────────────
function GroundingSection() {
  const fresh = signalFreshness.filter((s) => s.state === "fresh").length;
  const aging = signalFreshness.filter((s) => s.state === "aging").length;
  const stale = signalFreshness.filter((s) => s.state === "stale").length;
  const highRisk = blindSpots.filter((b) => b.risk === "high").length;

  return (
    <div className="agst-ground">
      <div className="agst-ground__head">
        <span className="agst-ground__label">Grounding</span>
        <span className="agst-ground__sub">last response · t{grounding.turn}</span>
        <span className="agst-ground__right">
          {grounding.citedCount} cited · {grounding.unbackedCount} unbacked
        </span>
      </div>
      <div className="agst-ground__grid">
        <GroundingScoreCard />
        <BlindSpotCard highRisk={highRisk} />
        <FreshnessCard fresh={fresh} aging={aging} stale={stale} />
      </div>
    </div>
  );
}

function GroundingScoreCard() {
  const scoreColor =
    grounding.score >= 80 ? "var(--success)" :
    grounding.score >= 60 ? "var(--fg)" :
    "var(--danger)";

  return (
    <section className="agst-gcard agst-gcard--score">
      <header className="agst-gcard__h">
        <span className="agst-gcard__label">Score</span>
        <span className="agst-gcard__count">/100</span>
      </header>

      <div className="agst-gscore">
        <span className="agst-gscore__num" style={{ color: scoreColor }}>{grounding.score}</span>
        <div className="agst-gscore__meta">
          <span className="agst-gscore__pill" style={{ color: scoreColor, background: `color-mix(in srgb, ${scoreColor} 12%, transparent)` }}>
            <span className="agst-gscore__dot" style={{ background: scoreColor }} />
            well grounded
          </span>
          <div className="agst-gscore__track" aria-hidden>
            <span className="agst-gscore__fill" style={{ width: `${grounding.score}%`, background: scoreColor }} />
            <span className="agst-gscore__tick" style={{ left: "60%" }} />
            <span className="agst-gscore__tick" style={{ left: "80%" }} />
          </div>
        </div>
      </div>

      <div className="agst-substats agst-substats--3">
        <StatTrio k="Cited"     v={String(grounding.citedCount)} />
        <StatTrio k="Unbacked"  v={String(grounding.unbackedCount)} tone={grounding.unbackedCount > 0 ? "danger" : "default"} />
        <StatTrio k="Sim avg"   v={grounding.similarityAvg.toFixed(2)} />
      </div>

      <ul className="agst-cite">
        {grounding.citations.map((c, i) => (
          <li key={i} className={`agst-cite__row agst-cite__row--${c.state}`}>
            <span className="agst-cite__glyph" aria-hidden>{c.state === "ok" ? "✓" : c.state === "weak" ? "~" : "!"}</span>
            <span className="agst-cite__claim" title={c.claim}>{c.claim}</span>
            <span className="agst-cite__ref" title={c.ref}>{c.ref}</span>
            <span className="agst-cite__engine">{c.engine}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlindSpotCard({ highRisk }: { highRisk: number }) {
  return (
    <section className="agst-gcard agst-gcard--blind">
      <header className="agst-gcard__h">
        <span className="agst-gcard__label">Blind spots</span>
        <span className="agst-gcard__count">{blindSpots.length}</span>
      </header>

      <div className="agst-substats agst-substats--2">
        <StatTrio k="On path" v={String(blindSpots.length)} />
        <StatTrio k="High risk" v={String(highRisk)} tone={highRisk > 0 ? "warn" : "default"} />
      </div>

      <ul className="agst-blind">
        {blindSpots.map((b) => (
          <li key={b.name} className={`agst-blind__row agst-blind__row--${b.risk}`}>
            <span className="agst-blind__glyph" aria-hidden>ƒ</span>
            <span className="agst-blind__name" title={b.name}>{b.name}</span>
            <span className="agst-blind__layer">{b.layer}</span>
            <span className="agst-blind__why">{b.why}</span>
            <button
              type="button"
              className="agst-blind__inject"
              title="Inject into ⌘E"
              onClick={() => {
                toast.info(
                  `Injected ${b.name} into ⌘E context`,
                  `${b.why} · ${b.layer} layer — agent will have full source on next query`,
                  "context inject",
                );
                focusStore.toggleContextInject(true);
              }}
            >
              inject →
            </button>
          </li>
        ))}
      </ul>

      <p className="agst-gcard__foot">
        patches may not account for behavior in these symbols
      </p>
    </section>
  );
}

function FreshnessCard({ fresh, aging, stale }: { fresh: number; aging: number; stale: number }) {
  const MAX_AGE = 30;
  return (
    <section className="agst-gcard agst-gcard--fresh">
      <header className="agst-gcard__h">
        <span className="agst-gcard__label">Signal freshness</span>
        <span className="agst-gcard__count">{signalFreshness.length}</span>
      </header>

      <div className="agst-substats agst-substats--3">
        <StatTrio k="Fresh"  v={String(fresh)} tone="good" />
        <StatTrio k="Aging"  v={String(aging)} tone="warn" />
        <StatTrio k="Stale"  v={String(stale)} tone={stale > 0 ? "danger" : "default"} />
      </div>

      <ul className="agst-fresh">
        {signalFreshness.map((s) => {
          const pct = Math.min(100, (s.ageMin / MAX_AGE) * 100);
          return (
            <li key={s.signal} className={`agst-fresh__row agst-fresh__row--${s.state}`}>
              <span className="agst-fresh__dot" aria-hidden />
              <span className="agst-fresh__name">{s.signal}</span>
              <div className="agst-fresh__bar" aria-hidden>
                <span className="agst-fresh__fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="agst-fresh__age">{s.age}</span>
              <span className={`agst-fresh__pill agst-fresh__pill--${s.state}`}>{s.state}</span>
            </li>
          );
        })}
      </ul>

      {stale > 0 && (
        <p className="agst-gcard__foot agst-gcard__foot--warn">
          {signalFreshness.find((s) => s.state === "stale")?.note}
        </p>
      )}
    </section>
  );
}

function StatTrio({ k, v, tone = "default" }: { k: string; v: string; tone?: "default" | "good" | "warn" | "danger" }) {
  return (
    <div className={`agst-st agst-st--${tone}`}>
      <span className="agst-st__v">{v}</span>
      <span className="agst-st__k">{k}</span>
    </div>
  );
}

function Timescrubber() {
  const [turnIdx, setTurnIdx] = useState(turnSnapshots.length - 1);
  const turn = turnSnapshots[turnIdx];
  const isCurrent = turnIdx === turnSnapshots.length - 1;

  return (
    <div className="tscrub">
      <div className="tscrub__head">
        <span className="tscrub__label">Session timeline</span>
        <span className="tscrub__sub">
          {isCurrent ? "live" : `viewing snapshot · t${turn.turn}`}
        </span>
        {!isCurrent && (
          <button
            type="button"
            className="tscrub__return"
            onClick={() => setTurnIdx(turnSnapshots.length - 1)}
          >
            return to live →
          </button>
        )}
      </div>

      <div className="tscrub__track" role="group" aria-label="Turn scrubber">
        <div className="tscrub__rail" aria-hidden />
        {turnSnapshots.map((s, i) => {
          const leftPct = (i / (turnSnapshots.length - 1)) * 100;
          const isActive = i === turnIdx;
          return (
            <button
              key={s.turn}
              type="button"
              className={`tscrub__marker${isActive ? " is-active" : ""}${i === turnSnapshots.length - 1 ? " is-live" : ""}`}
              style={{ left: `${leftPct}%` }}
              onClick={() => setTurnIdx(i)}
              title={`t${s.turn} · ${s.t} · ${s.label}`}
              aria-label={`Turn ${s.turn}: ${s.label}`}
            >
              <span className="tscrub__marker-dot" aria-hidden />
              <span className="tscrub__marker-label">t{s.turn}</span>
            </button>
          );
        })}
      </div>

      <div className="tscrub__snap">
        <div className="tscrub__snap-head">
          <span className="tscrub__snap-turn">t{turn.turn}</span>
          <span className="tscrub__snap-t">{turn.t}</span>
          <span className="tscrub__snap-label">{turn.label}</span>
        </div>
        <div className="tscrub__snap-stats">
          <SnapStat k="input"  v={fmt(turn.inputTok)} />
          <SnapStat k="output" v={fmt(turn.outputTok)} />
          <SnapStat k="ctx"    v={fmt(turn.contextTok)} />
          <SnapStat k="cost"   v={`$${turn.cost.toFixed(2)}`} />
        </div>
        {turn.events.length > 0 && (
          <div className="tscrub__snap-events">
            {turn.events.map((e, i) => (
              <span key={i} className="tscrub__snap-event">· {e}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SnapStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="tscrub__stat">
      <span className="tscrub__stat-k">{k}</span>
      <span className="tscrub__stat-v">{v}</span>
    </div>
  );
}

function EnginePaybackCard() {
  return (
    <div className="agst-payback">
      <div className="agst-payback__head">
        <span className="agst-payback__kicker">Engine payback · this session</span>
        <span className="agst-payback__factor">{paybackFactor.toFixed(1)}× vs raw-read</span>
      </div>
      <div className="agst-payback__body">
        <div className="agst-payback__figure">
          <span className="agst-payback__num">{fmt(savedTokens)}</span>
          <span className="agst-payback__unit">tokens saved</span>
          <span className="agst-payback__sep">·</span>
          <span className="agst-payback__cost">${savedUsd.toFixed(2)}</span>
        </div>
        <ul className="agst-payback__list">
          {paybackQueries.map((p) => (
            <li key={p.kind} className="agst-payback__row">
              <span className="agst-payback__row-k">{p.kind}</span>
              <span className="agst-payback__row-n">×{p.count}</span>
              <span className="agst-payback__row-v">{fmt(p.saved)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="agst-payback__foot">
        Engine signals substituted raw file reads and agent guesses — what you would have paid without quanta.
      </div>
    </div>
  );
}

function MeterRow({
  label,
  segments,
  value,
  sub,
}: {
  label: string;
  segments: { cls: string; width: number }[];
  value: string;
  sub?: string;
}) {
  let offset = 0;
  return (
    <div className="agst-meter__row">
      <span className="agst-meter__k">{label}</span>
      <div className="agst-meter__bar" aria-hidden>
        {segments.map((s, i) => {
          const left = offset;
          offset += s.width;
          return (
            <span
              key={i}
              className={`agst-meter__fill ${s.cls}`}
              style={{ left: `${left}%`, width: `${s.width}%` }}
            />
          );
        })}
      </div>
      <span className="agst-meter__v">
        {value}
        {sub && <span className="agst-meter__sub"> · {sub}</span>}
      </span>
    </div>
  );
}

function ContextPanel({ onOpenLog }: { onOpenLog: () => void }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const visible = contextItems.filter((c) => !removed.has(c.name));
  const visibleIdle = visible.filter((c) => !c.pinned && (c.idleTurns ?? 0) >= IDLE_THRESHOLD);
  const visibleIdleTok = visibleIdle.reduce((a, c) => a + c.tokens, 0);
  const visibleUsed = visible.reduce((a, c) => a + c.tokens, 0);

  function reclaim() {
    const reclaimedNames = visibleIdle.map((c) => c.name);
    const totalReclaimed = visibleIdleTok;
    setRemoved((prev) => {
      const next = new Set(prev);
      for (const n of reclaimedNames) next.add(n);
      return next;
    });
    toast.success(
      `Reclaimed ${fmt(totalReclaimed)} tokens`,
      `${reclaimedNames.length} idle items unpinned · context window freed`,
      "context",
    );
  }

  return (
    <section className="agst-col agst-col--ctx">
      <div className="agst-col__h">
        <span className="agst-col__label">Context</span>
        <span className="agst-col__count">{visible.length}</span>
        <span className="agst-col__right">{fmt(visibleUsed)} tok</span>
        <LogButton label="Context" onClick={onOpenLog} />
      </div>
      {visibleIdle.length > 0 && (
        <button
          type="button"
          className="agst-advisor"
          aria-label="Unpin idle items"
          onClick={reclaim}
        >
          <span className="agst-advisor__badge">{visibleIdle.length} idle</span>
          <span className="agst-advisor__text">
            unpin to reclaim
          </span>
          <span className="agst-advisor__val">{fmt(visibleIdleTok)} tok</span>
          <span className="agst-advisor__arrow" aria-hidden>→</span>
        </button>
      )}
      <ul className="agst-ctx">
        {visible.map((c) => {
          const idle = (c.idleTurns ?? 0) >= IDLE_THRESHOLD && !c.pinned;
          return (
            <li key={c.name} className={`agst-ctx__row${idle ? " is-idle" : ""}`}>
              <span className="agst-ctx__pin" aria-hidden>{c.pinned ? "◆" : "·"}</span>
              <span className={`agst-ctx__kind agst-ctx__kind--${c.kind}`} aria-hidden>
                {CTX_GLYPH[c.kind]}
              </span>
              <span className="agst-ctx__name" title={c.name}>{c.name}</span>
              {idle && (
                <span className="agst-ctx__idle" title={`idle ${c.idleTurns} turns`}>
                  idle {c.idleTurns}t
                </span>
              )}
              <span className="agst-ctx__tok">{fmt(c.tokens)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MemoryPanel({ onOpenLog }: { onOpenLog: () => void }) {
  const typeCount = new Set(memory.map((m) => m.type)).size;
  return (
    <section className="agst-col agst-col--mem">
      <div className="agst-col__h">
        <span className="agst-col__label">Memory</span>
        <span className="agst-col__count">{memory.length}</span>
        <span className="agst-col__right">{typeCount} types</span>
        <LogButton label="Memory" onClick={onOpenLog} />
      </div>
      <ul className="agst-mem">
        {memory.map((m) => (
          <li key={m.name} className="agst-mem__row">
            <span className={`agst-mem__type agst-mem__type--${m.type}`}>{m.type}</span>
            <div className="agst-mem__body">
              <span className="agst-mem__name">{m.name}</span>
              <span className="agst-mem__summary">{m.summary}</span>
            </div>
            <span className="agst-mem__when">{m.updated}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodoPanel({ onOpenLog }: { onOpenLog: () => void }) {
  const pending = todos.filter((t) => t.state === "pending").length;
  const doing   = todos.filter((t) => t.state === "doing").length;
  const done    = todos.filter((t) => t.state === "done").length;
  return (
    <section className="agst-col agst-col--todo">
      <div className="agst-col__h">
        <span className="agst-col__label">Todo</span>
        <span className="agst-col__count">{todos.length}</span>
        <span className="agst-col__right">
          {doing} doing · {pending} pending · {done} done
        </span>
        <LogButton label="Todo" onClick={onOpenLog} />
      </div>
      <ul className="agst-todo">
        {todos.map((t, i) => (
          <li key={i} className={`agst-todo__row agst-todo__row--${t.state}`}>
            <span className="agst-todo__glyph" aria-hidden>
              {t.state === "done" ? "✓" : t.state === "doing" ? "●" : "○"}
            </span>
            <span className="agst-todo__content">{t.content}</span>
            {t.source && <span className="agst-todo__src">{t.source}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────

const DETAIL_TITLE: Record<DetailKind, string> = {
  meter: "Session meter",
  ctx:   "Context",
  mem:   "Memory",
  todo:  "Todo",
};

function DetailDrawer({ kind, onClose }: { kind: DetailKind; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="agst-drawer" role="dialog" aria-label={`${DETAIL_TITLE[kind]} log`}>
      <div className="agst-drawer__backdrop" onClick={onClose} aria-hidden />
      <aside className="agst-drawer__panel">
        <header className="agst-drawer__head">
          <span className="agst-drawer__breadcrumb">
            <button type="button" className="agst-drawer__back" onClick={onClose} aria-label="Back">
              ←
            </button>
            <span className="agst-drawer__crumb-from">Agent</span>
            <span className="agst-drawer__crumb-sep">/</span>
            <span className="agst-drawer__crumb-cur">{DETAIL_TITLE[kind]}</span>
          </span>
          <span className="agst-drawer__kicker">compressed log</span>
          <button type="button" className="agst-drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="agst-drawer__body">
          {kind === "meter" && <MeterLog />}
          {kind === "ctx"   && <CtxLog />}
          {kind === "mem"   && <MemLog />}
          {kind === "todo"  && <TodoLog />}
        </div>

        <footer className="agst-drawer__foot">
          <span>Esc to close</span>
        </footer>
      </aside>
    </div>
  );
}

function LogTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="agst-log">
      <div className="agst-log__head">{head}</div>
      <div className="agst-log__rows">{children}</div>
    </div>
  );
}

function MeterLog() {
  const totalIn   = meterEvents.reduce((a, e) => a + e.inDelta,   0);
  const totalCache = meterEvents.reduce((a, e) => a + e.cachedDelta, 0);
  const totalOut  = meterEvents.reduce((a, e) => a + e.outDelta,  0);
  const totalCost = meterEvents.reduce((a, e) => a + e.cost,      0);

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"   v={String(meterEvents.length)} />
        <SummaryStat k="input"    v={fmt(totalIn)} />
        <SummaryStat k="cached"   v={fmt(totalCache)} sub={`${Math.round((totalCache / totalIn) * 100)}%`} />
        <SummaryStat k="output"   v={fmt(totalOut)} />
        <SummaryStat k="cost"     v={`$${totalCost.toFixed(2)}`} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--meter">
            <span>t</span>
            <span>turn</span>
            <span>kind</span>
            <span className="agst-log__num">input</span>
            <span className="agst-log__num">cached</span>
            <span className="agst-log__num">output</span>
            <span className="agst-log__num">cost</span>
            <span>note</span>
          </div>
        }
      >
        {meterEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--meter">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.kind}`}>{e.kind}</span>
            <span className="agst-log__num">{e.inDelta > 0 ? `+${fmt(e.inDelta)}` : "—"}</span>
            <span className="agst-log__num agst-log__num--muted">{e.cachedDelta > 0 ? fmt(e.cachedDelta) : "—"}</span>
            <span className="agst-log__num">{e.outDelta > 0 ? `+${fmt(e.outDelta)}` : "—"}</span>
            <span className="agst-log__num">${e.cost.toFixed(3)}</span>
            <span className="agst-log__note">{e.note ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function CtxLog() {
  const totalDelta = ctxEvents
    .map((e) => parseTokDelta(e.delta))
    .reduce((a, b) => a + b, 0);
  const pinCount = ctxEvents.filter((e) => e.action === "pin").length;

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"  v={String(ctxEvents.length)} />
        <SummaryStat k="tok in"  v={fmt(totalDelta)} />
        <SummaryStat k="files"   v={String(contextItems.filter((c) => c.kind === "file").length)} />
        <SummaryStat k="pins"    v={String(pinCount)} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--ctx">
            <span>t</span>
            <span>turn</span>
            <span>action</span>
            <span>resource</span>
            <span className="agst-log__num">delta</span>
            <span>note</span>
          </div>
        }
      >
        {ctxEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--ctx">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.action}`}>{e.action}</span>
            <span className="agst-log__res" title={e.resource}>{e.resource}</span>
            <span className="agst-log__num">{e.delta}</span>
            <span className="agst-log__note">{e.note ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function MemLog() {
  const hits = memEvents.filter((e) => e.action === "hit" || e.action === "recall").length;
  const misses = memEvents.filter((e) => e.action === "miss").length;
  const injects = memEvents.filter((e) => e.action === "inject").length;

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"   v={String(memEvents.length)} />
        <SummaryStat k="recalls"  v={String(hits)} />
        <SummaryStat k="injects"  v={String(injects)} />
        <SummaryStat k="misses"   v={String(misses)} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--mem">
            <span>t</span>
            <span>turn</span>
            <span>action</span>
            <span>type</span>
            <span>name</span>
            <span>trigger</span>
          </div>
        }
      >
        {memEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--mem">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.action}`}>{e.action}</span>
            <span className={`agst-mem__type agst-mem__type--${e.type}`}>{e.type}</span>
            <span className="agst-log__res" title={e.name}>{e.name}</span>
            <span className="agst-log__note">{e.trigger ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function TodoLog() {
  const created = todoEvents.filter((e) => e.action === "create").length;
  const started = todoEvents.filter((e) => e.action === "start").length;
  const done    = todoEvents.filter((e) => e.action === "done").length;

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"   v={String(todoEvents.length)} />
        <SummaryStat k="created"  v={String(created)} />
        <SummaryStat k="started"  v={String(started)} />
        <SummaryStat k="done"     v={String(done)} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--todo">
            <span>t</span>
            <span>turn</span>
            <span>action</span>
            <span>content</span>
            <span>source</span>
          </div>
        }
      >
        {todoEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--todo">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.action}`}>{e.action}</span>
            <span className="agst-log__res" title={e.content}>{e.content}</span>
            <span className="agst-log__note">{e.source ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function SummaryStat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="agst-log__stat">
      <span className="agst-log__stat-k">{k}</span>
      <span className="agst-log__stat-v">
        {v}
        {sub && <span className="agst-log__stat-sub"> · {sub}</span>}
      </span>
    </div>
  );
}

function parseTokDelta(s: string): number {
  const m = s.match(/\+?([\d.]+)([km])?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = m[2]?.toLowerCase() === "k" ? 1000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
  return n * mult;
}
