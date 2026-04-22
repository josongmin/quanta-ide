// Deterministic synthesized metrics.
// --------------------------------------------------------------------
// The 2026 analysis views (Hotspot, Hub, BusFactor, Timelapse, DNA,
// …) want a richer per-entity metric vector than `EntityMetrics` today
// exposes (loc, riskScore, fileCount). Until the static-analyzer
// pipeline feeds real churn/coverage/complexity/authorship into the
// graph, every new view synthesizes those facets here — once, from
// the entity id — so all views agree on the same "fake" reality.
//
// Rules of thumb:
//   - Real data wins: if `entity.metrics` carries a field, we use it.
//   - Fallback is deterministic: hash(entity.id) seeds a mulberry32
//     PRNG so a given entity's churn is the same across views AND
//     across sessions.
//   - No global Math.random() calls, ever — breaks determinism.
//
// When the analyzer ships real metrics, replace the `synth*` branches
// with a read from `entity.metrics` and delete the rest. Callers never
// need to change.

import type { Entity } from "@quanta/canvas-engine";

/** Deterministic 32-bit hash from a string (FNV-1a). */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — tiny deterministic PRNG, seed in → 0..1 stream. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a seeded RNG for a specific entity+salt pair. Stable across views. */
export function seeded(id: string, salt: string = ""): () => number {
  return mulberry32(hashId(`${id}::${salt}`));
}

/** 0..1 churn score (commits in last 90d, normalized). */
export function churn(entity: Entity): number {
  const rng = seeded(entity.id, "churn");
  const base = rng();
  // Weight-shape so most files are calm and a few are hot — power law.
  return Math.pow(base, 2.2);
}

/** 0..1 complexity score (cyclomatic aggregated). */
export function complexity(entity: Entity): number {
  const loc = entity.metrics?.loc ?? 0;
  if (loc > 0) {
    // Real LoC signal, but compress with log so a 5k-LoC file isn't
    // 100x a 50-LoC file on the chart.
    const logNorm = Math.log10(loc + 1) / 4;
    return Math.min(1, logNorm * (0.6 + seeded(entity.id, "cx")() * 0.4));
  }
  return seeded(entity.id, "cx")();
}

/** 0..1 test coverage — lower = more "holes". */
export function coverage(entity: Entity): number {
  // Test files get 1.0; source files get seeded fallback.
  if (/\.test\.|\.spec\.|__tests__/.test(entity.path)) return 1.0;
  const r = seeded(entity.id, "cov")();
  // Bias toward "mostly OK" so gaps read as exceptional, not the norm.
  return 0.35 + r * 0.65;
}

/** 1..N author count on this file. */
export function authorCount(entity: Entity): number {
  const r = seeded(entity.id, "auth")();
  // Exponentially biased: most files 1-2 authors, a few have many.
  return 1 + Math.floor(Math.pow(r, 3) * 7);
}

/** 0..1 bus-factor risk — high means one-person-dependency. */
export function busFactor(entity: Entity): number {
  // Inverse of author diversity.
  const n = authorCount(entity);
  return 1 - Math.min(1, (n - 1) / 4);
}

/** Days since last modification (synthesized). */
export function daysSinceModified(entity: Entity): number {
  const r = seeded(entity.id, "age")();
  // Most files recent, a few very old.
  return Math.floor(Math.pow(r, 2.5) * 600);
}

/** File age in days since creation (synthesized). */
export function ageDays(entity: Entity): number {
  const r = seeded(entity.id, "birth")();
  return Math.floor(30 + r * 1200);
}

/** Deterministic author hue [0..360). */
export function authorHue(authorId: string): number {
  return hashId(authorId) % 360;
}

/** Primary author for a file (synthesized id). */
export function primaryAuthor(entity: Entity): string {
  const authors = ["jo", "kim", "park", "lee", "song", "han", "yoon", "choi"];
  const idx = hashId(`${entity.id}:primary`) % authors.length;
  return authors[idx] ?? "unknown";
}

/** Author contribution split — percentages summing to 1. */
export function authorSplit(entity: Entity): Array<{ id: string; share: number }> {
  const n = authorCount(entity);
  const rng = seeded(entity.id, "split");
  const weights = Array.from({ length: n }, () => rng());
  const total = weights.reduce((a, b) => a + b, 0);
  const authors = ["jo", "kim", "park", "lee", "song", "han", "yoon", "choi"];
  // Sort descending so primary is first.
  return weights
    .map((w, i) => ({ id: authors[i % authors.length]!, share: w / total }))
    .sort((a, b) => b.share - a.share);
}

/** Commits in last 90 days (count). */
export function recentCommits(entity: Entity): number {
  const c = churn(entity);
  return Math.floor(c * 60);
}

/** Synthesized commit timestamps for a file (sorted ascending). */
export function commitHistory(entity: Entity, days: number = 365): number[] {
  const n = recentCommits(entity) + Math.floor(seeded(entity.id, "hist-n")() * 20);
  const now = Date.now();
  const rng = seeded(entity.id, "hist");
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // Recency-biased distribution (cube-root → newer denser).
    const r = rng();
    const daysBack = Math.pow(r, 2) * days;
    out.push(now - daysBack * 86400_000);
  }
  out.sort((a, b) => a - b);
  return out;
}

/** Fan-in count — how many files import this entity. Pass `graph.fileEdges`
 *  (real data) or omit for seeded fallback. */
export function fanIn(entity: Entity, edges?: ReadonlyArray<{ from: string; to: string }>): number {
  if (edges) {
    let n = 0;
    for (const e of edges) if (e.to === entity.id) n++;
    return n;
  }
  const r = seeded(entity.id, "fin")();
  return Math.floor(Math.pow(r, 2) * 30);
}

/** Fan-out count — how many files this entity imports. */
export function fanOut(entity: Entity, edges?: ReadonlyArray<{ from: string; to: string }>): number {
  if (edges) {
    let n = 0;
    for (const e of edges) if (e.from === entity.id) n++;
    return n;
  }
  const r = seeded(entity.id, "fout")();
  return Math.floor(Math.pow(r, 1.6) * 15);
}

/** A tag set for code-smell detection. */
export const SMELL_KINDS = [
  "god-class",
  "long-method",
  "deep-nesting",
  "magic-number",
  "dead-code",
  "circular-dep",
] as const;
export type SmellKind = typeof SMELL_KINDS[number];

/** Returns detected smell counts per kind for an entity. */
export function smellProfile(entity: Entity): Record<SmellKind, number> {
  const rng = seeded(entity.id, "smell");
  const out = {} as Record<SmellKind, number>;
  for (const k of SMELL_KINDS) {
    out[k] = Math.floor(Math.pow(rng(), 2.5) * 8);
  }
  return out;
}

/** Deprecated-API usage count for an entity. */
export function fossilCount(entity: Entity): number {
  const r = seeded(entity.id, "fossil")();
  return Math.pow(r, 4) > 0.2 ? Math.floor(r * 6) : 0;
}

/** Probability [0..1] that this entity is misplaced — belongs elsewhere. */
export function mislocationScore(entity: Entity): number {
  const r = seeded(entity.id, "misloc")();
  return Math.pow(r, 3); // most files fine, a few glaring.
}

/** Duplicate-cluster membership — which fake cluster this entity belongs
 *  to. 0 = no duplicates; positive = cluster id. */
export function duplicateCluster(entity: Entity): number {
  const r = seeded(entity.id, "dup")();
  if (r < 0.72) return 0; // majority: no duplicate
  return 1 + Math.floor(r * 12) % 8;
}

// ────────────────────────────────────────────────────────────────────────
//  Industry / academia-validated metric helpers
// ────────────────────────────────────────────────────────────────────────

/** Cognitive Complexity (SonarQube, Campbell 2018) — 0..1 normalized.
 *  Distinct from cyclomatic: more sensitive to nesting + callback depth,
 *  less to switch statements. */
export function cognitiveComplexity(entity: Entity): number {
  const cx = complexity(entity);
  const r = seeded(entity.id, "cogc")();
  return Math.min(1, cx * (0.8 + r * 0.35));
}

/** Maintainability Index (Oman & Hagemeister 1992; MS formula) —
 *  0..100 scale. Higher is better. Reference: MI = 171 - 5.2·ln(V)
 *  - 0.23·CC - 16.2·ln(LoC), clamped. */
export function maintainabilityIndex(entity: Entity): number {
  const loc = Math.max(2, entity.metrics?.loc ?? 150);
  const cx = complexity(entity) * 30;
  const volume = loc * Math.log2(loc);
  const raw = 171 - 5.2 * Math.log(Math.max(2, volume)) - 0.23 * cx - 16.2 * Math.log(loc);
  const mi = Math.max(0, Math.min(100, raw));
  // Blend with seeded jitter so files don't all clump at the same score.
  const jitter = (seeded(entity.id, "mi")() - 0.5) * 12;
  return Math.max(0, Math.min(100, mi + jitter));
}

/** Coupling Between Objects (Chidamber & Kemerer 1994) — 0..1. */
export function cbo(entity: Entity, edges?: ReadonlyArray<{ from: string; to: string }>): number {
  const connections = fanIn(entity, edges) + fanOut(entity, edges);
  return Math.min(1, connections / 25);
}

/** Lack of Cohesion of Methods (Chidamber & Kemerer 1994) — 0..1.
 *  Higher = less cohesive (bad). */
export function lcom(entity: Entity): number {
  const r = seeded(entity.id, "lcom")();
  return Math.pow(r, 1.4);
}

/** Test ratio — tests/source LoC ratio proxy. 0..1. */
export function testRatio(entity: Entity): number {
  if (/\.test\.|\.spec\.|__tests__/.test(entity.path)) return 1.0;
  const r = seeded(entity.id, "testr")();
  return Math.pow(r, 1.6); // biased low — most files under-tested
}

/** Defect-proneness (Zimmermann & Nagappan model) — 0..1.
 *  Weights: 35% complexity, 35% churn, 30% coupling. */
export function bugProbability(entity: Entity, edges?: ReadonlyArray<{ from: string; to: string }>): number {
  const cx = complexity(entity);
  const ch = churn(entity);
  const cp = cbo(entity, edges);
  return Math.min(1, cx * 0.35 + ch * 0.35 + cp * 0.30);
}

/** Comment density — fraction of file lines that are comments. 0..1. */
export function commentDensity(entity: Entity): number {
  const r = seeded(entity.id, "comm")();
  return r * 0.5;
}

/** Comment quality (Steidl et al. ICPC 2013) — 0..1.
 *  Low = TODO / FIXME / stale; High = well-formed docstrings. */
export function commentQuality(entity: Entity): number {
  const r = seeded(entity.id, "cq")();
  return 0.25 + r * 0.75;
}

/** PR review cycle time in hours — time from open → merge. */
export function reviewCycleTime(entity: Entity): number {
  const r = seeded(entity.id, "rct")();
  return Math.floor(Math.pow(r, 2.3) * 480 + 0.5);
}

/** PR comment count per review. */
export function reviewCommentCount(entity: Entity): number {
  const r = seeded(entity.id, "rcc")();
  return Math.floor(Math.pow(r, 2) * 24);
}

/** Feature Envy (Fowler) — 0..1, rare but sharp. */
export function featureEnvyScore(entity: Entity): number {
  const r = seeded(entity.id, "envy")();
  return Math.pow(r, 3);
}

/** Shotgun Surgery (Fowler) — 0..1, how many files one change touches. */
export function shotgunSurgeryScore(entity: Entity): number {
  const r = seeded(entity.id, "shot")();
  return Math.pow(r, 2.4);
}

/** Truck factor for the whole repo — number of devs who must leave before
 *  >50% of files lose their expert. Avelino et al. FSE 2016. */
export function truckFactor(totalFiles: number): number {
  if (totalFiles < 10) return 1;
  return Math.min(8, Math.max(1, Math.floor(Math.log2(totalFiles + 1) - 1)));
}

/** DORA metrics (Forsgren, Humble, Kim 2018) — repo-level. Seeded from
 *  the tree root so the dashboard is stable across renders. */
export interface DoraMetrics {
  deploysPerDay: number;
  leadTimeHours: number;
  mttrHours: number;
  changeFailRate: number;
  tier: "elite" | "high" | "medium" | "low";
}
export function doraMetrics(rootId: string | null): DoraMetrics {
  const seed = hashId(rootId ?? "root");
  const rng = mulberry32(seed);
  const deploy = 0.5 + rng() * 14;
  const lead = 2 + rng() * 60;
  const mttr = 0.5 + rng() * 8;
  const fail = rng() * 0.4;
  // DORA tiering shortcut — elite: deploy > 7/d, lead < 24h, mttr < 1h, fail < 5%.
  let tier: DoraMetrics["tier"] = "low";
  if (deploy > 5 && lead < 24 && mttr < 2 && fail < 0.1) tier = "elite";
  else if (deploy > 1.5 && lead < 72 && mttr < 6 && fail < 0.2) tier = "high";
  else if (deploy > 0.4 && lead < 168 && mttr < 12 && fail < 0.3) tier = "medium";
  return { deploysPerDay: deploy, leadTimeHours: lead, mttrHours: mttr, changeFailRate: fail, tier };
}

/** Test pyramid ratios — unit / integration / e2e. Sums to 1. */
export function testPyramid(rootId: string | null): { unit: number; integration: number; e2e: number } {
  const seed = hashId(`${rootId ?? "root"}:pyramid`);
  const rng = mulberry32(seed);
  const u = 0.4 + rng() * 0.35;
  const i = (1 - u) * (0.55 + rng() * 0.25);
  const e = 1 - u - i;
  return { unit: u, integration: i, e2e: Math.max(0, e) };
}

/** Ownership transition events (Sankey source). */
export function ownershipTransitions(entity: Entity): Array<{ from: string; to: string; at: number }> {
  const n = Math.floor(seeded(entity.id, "own-n")() * 4);
  if (n === 0) return [];
  const authors = ["jo", "kim", "park", "lee", "song", "han", "yoon", "choi"];
  const rng = seeded(entity.id, "own-seq");
  const out: Array<{ from: string; to: string; at: number }> = [];
  let cur = authors[Math.floor(rng() * authors.length)]!;
  for (let i = 0; i < n; i++) {
    let next = authors[Math.floor(rng() * authors.length)]!;
    if (next === cur) next = authors[(authors.indexOf(cur) + 1) % authors.length]!;
    out.push({ from: cur, to: next, at: Date.now() - Math.floor(rng() * 300 * 86400_000) });
    cur = next;
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Historical refactorings (Tsantalis RefactoringMiner-style output). */
export const REFACTORING_KINDS = [
  "extract-method",
  "rename",
  "move-class",
  "inline",
  "pull-up",
  "extract-class",
  "push-down",
  "extract-interface",
] as const;
export type RefactoringKind = typeof REFACTORING_KINDS[number];

export function refactoringsApplied(entity: Entity): Array<{ kind: RefactoringKind; at: number }> {
  const n = Math.floor(Math.pow(seeded(entity.id, "ref-n")(), 2) * 7);
  const rng = seeded(entity.id, "ref-seq");
  const out: Array<{ kind: RefactoringKind; at: number }> = [];
  for (let i = 0; i < n; i++) {
    const kind = REFACTORING_KINDS[Math.floor(rng() * REFACTORING_KINDS.length)]!;
    const at = Date.now() - Math.floor(rng() * 180 * 86400_000);
    out.push({ kind, at });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** CFG node count + branch count for a synthesized per-function CFG. */
export interface SynthCfgNode {
  id: string;
  kind: "entry" | "stmt" | "branch" | "loop" | "exit";
  label: string;
  children: string[];
}

// ── Sonar-style quality dashboard helpers ──────────────────────────────

/** Mutation testing score (PIT / Stryker). 0..1, higher = better tests.
 *  Usually < coverage; a 90% coverage with 30% mutation score is a red flag. */
export function mutationScore(entity: Entity): number {
  const cov = coverage(entity);
  // Mutation score typically lags coverage by 20-50%.
  const r = seeded(entity.id, "mut")();
  const gap = 0.25 + r * 0.35;
  return Math.max(0, Math.min(1, cov - gap));
}

/** Survived mutants per file. */
export function survivedMutants(entity: Entity): number {
  const r = seeded(entity.id, "surv")();
  const loc = entity.metrics?.loc ?? 100;
  return Math.floor(Math.pow(r, 1.5) * Math.min(40, loc / 10));
}

/** Killed mutants per file. */
export function killedMutants(entity: Entity): number {
  const surv = survivedMutants(entity);
  const score = mutationScore(entity);
  return Math.floor(surv * (score / Math.max(0.01, 1 - score)));
}

export type VulnSeverity = "critical" | "high" | "medium" | "low";

export interface Vulnerability {
  id: string;        // e.g. "CVE-2024-1234"
  title: string;
  severity: VulnSeverity;
  fileId: string;
  line: number;
  reviewed: boolean;
  rule: string;      // e.g. "sql-injection"
}

const VULN_RULES: Array<{ rule: string; title: string; severity: VulnSeverity }> = [
  { rule: "sql-injection",       title: "Possible SQL injection sink",              severity: "critical" },
  { rule: "xss-reflected",       title: "Reflected XSS — unescaped DOM sink",       severity: "high"     },
  { rule: "hard-coded-secret",   title: "Hard-coded credential detected",           severity: "high"     },
  { rule: "insecure-random",     title: "Math.random used in crypto context",       severity: "medium"   },
  { rule: "path-traversal",      title: "User input flows into fs.readFile path",   severity: "high"     },
  { rule: "open-redirect",       title: "Unvalidated redirect from query param",    severity: "medium"   },
  { rule: "weak-hash",           title: "MD5 / SHA1 used for integrity",            severity: "medium"   },
  { rule: "missing-csrf",        title: "POST mutation without CSRF guard",         severity: "medium"   },
  { rule: "prototype-pollution", title: "Object merge from untrusted source",       severity: "critical" },
  { rule: "unsafe-deserialize",  title: "JSON.parse on untrusted stream",           severity: "low"      },
  { rule: "unsafe-eval",         title: "eval / new Function on runtime input",     severity: "critical" },
  { rule: "insecure-cookie",     title: "Cookie set without Secure / HttpOnly",     severity: "low"      },
];

/** Repo-wide synthesized vulnerability list. Deterministic; stable order. */
export function synthVulnerabilities(entity: Entity): Vulnerability[] {
  const r = seeded(entity.id, "vuln-n")();
  // Most files have none; a few have 1-3.
  const n = r > 0.78 ? 1 + Math.floor(r * 3) : 0;
  if (n === 0) return [];
  const out: Vulnerability[] = [];
  const rng = seeded(entity.id, "vuln-list");
  for (let i = 0; i < n; i++) {
    const rule = VULN_RULES[Math.floor(rng() * VULN_RULES.length)]!;
    const cveYear = 2022 + Math.floor(rng() * 4);
    const cveNum  = 1000 + Math.floor(rng() * 9000);
    out.push({
      id:       `CVE-${cveYear}-${cveNum}`,
      title:    rule.title,
      severity: rule.severity,
      fileId:   entity.id,
      line:     1 + Math.floor(rng() * Math.max(10, entity.metrics?.loc ?? 200)),
      reviewed: rng() > 0.55,
      rule:     rule.rule,
    });
  }
  return out;
}

/** Technical debt in hours per entity (Sonar SQALE model).
 *  Approximate translation: complexity → remediation effort. */
export function debtHours(entity: Entity): number {
  const loc = entity.metrics?.loc ?? 100;
  const cx = complexity(entity);
  const smells = Math.floor(cx * 12); // # smells proxy
  // Base: 5 min per LoC times cx, cap per file.
  const perFile = Math.min(48, (loc / 120) * cx * 8 + smells * 0.3);
  return Math.round(perFile * 10) / 10;
}

/** Development cost in hours (Sonar: 0.06d per LoC = 0.48h). */
export function devCostHours(entity: Entity): number {
  const loc = entity.metrics?.loc ?? 100;
  return loc * 0.48;
}

/** Technical Debt Ratio (Sonar) — remediation / development. 0..1. */
export function debtRatio(entity: Entity): number {
  const dh = debtHours(entity);
  const dc = devCostHours(entity);
  return dc === 0 ? 0 : Math.min(1, dh / dc);
}

/** Convert debt ratio to Sonar A-E maintainability rating. */
export function maintainabilityRating(ratio: number): "A" | "B" | "C" | "D" | "E" {
  if (ratio <= 0.05) return "A";
  if (ratio <= 0.10) return "B";
  if (ratio <= 0.20) return "C";
  if (ratio <= 0.50) return "D";
  return "E";
}

/** Reliability rating from bug severity distribution.
 *  1+ blocker → E, 1+ critical → D, 1+ major → C, 1+ minor → B, else A. */
export function reliabilityRating(bugs: { blocker: number; critical: number; major: number; minor: number }): "A" | "B" | "C" | "D" | "E" {
  if (bugs.blocker > 0) return "E";
  if (bugs.critical > 0) return "D";
  if (bugs.major > 0) return "C";
  if (bugs.minor > 0) return "B";
  return "A";
}

/** Security rating from vulnerability severity. Same step ladder as reliability. */
export function securityRating(vulns: { critical: number; high: number; medium: number; low: number }): "A" | "B" | "C" | "D" | "E" {
  if (vulns.critical > 0) return "E";
  if (vulns.high > 0) return "D";
  if (vulns.medium > 0) return "C";
  if (vulns.low > 0) return "B";
  return "A";
}

/** Depth of Inheritance (CK metric). 1..N. Files with no inheritance → 1. */
export function depthOfInheritance(entity: Entity): number {
  const r = seeded(entity.id, "dit")();
  // Most files 1-2; few 5+.
  return 1 + Math.floor(Math.pow(r, 2.4) * 7);
}

// ── Entity-scoped helpers (file / folder / symbol) ─────────────────────

/** Per-symbol synthesized record — mirrors what a real analyzer would
 *  emit (name, kind, LoC, CC, visibility, callers/callees). */
export type SymbolKind = "class" | "function" | "method" | "variable" | "interface";
export type SymbolVisibility = "public" | "private" | "internal";

export interface SynthSymbol {
  id: string;          // fileId + "::" + name
  name: string;
  kind: SymbolKind;
  visibility: SymbolVisibility;
  loc: number;
  line: number;        // declaration line
  cyclomatic: number;
  cognitive: number;
  callers: number;
  callees: number;
  tests: number;       // # of tests referencing
}

const SYMBOL_NAME_POOLS: Record<SymbolKind, readonly string[]> = {
  class:     ["Controller", "Service", "Manager", "Factory", "Repository", "Adapter", "Store", "Registry"],
  interface: ["Config", "Options", "Result", "Event", "Payload", "State", "Props", "Handle"],
  function:  ["parse", "render", "normalize", "dispatch", "resolve", "encode", "decode", "format"],
  method:    ["init", "update", "handle", "build", "apply", "reduce", "emit", "reset"],
  variable:  ["CACHE", "DEFAULTS", "LIMITS", "REGISTRY", "PALETTE", "TOKENS", "FLAGS", "VERSION"],
};

/** Synthesize symbols for a file entity. Count ~ log2(LoC) + seeded jitter,
 *  capped at 24 for readability. */
export function symbolsInFile(entity: Entity): SynthSymbol[] {
  if (entity.kind !== "building" && entity.kind !== "floor") return [];
  const loc = entity.metrics?.loc ?? 120;
  const baseCount = Math.max(3, Math.min(24, Math.floor(Math.log2(loc + 2) * 2.4)));
  const rng = seeded(entity.id, "sym-n");
  const n = Math.floor(baseCount + rng() * 4);
  const out: SynthSymbol[] = [];
  const names = seeded(entity.id, "sym-list");
  let line = 1;
  for (let i = 0; i < n; i++) {
    const r = names();
    const kind: SymbolKind =
      r < 0.12 ? "class" :
      r < 0.22 ? "interface" :
      r < 0.54 ? "function" :
      r < 0.84 ? "method" :
      "variable";
    const pool = SYMBOL_NAME_POOLS[kind];
    const basename = pool[Math.floor(names() * pool.length)]!;
    const nameSuffix = Math.floor(names() * 99);
    const name = kind === "variable" ? `${basename}_${nameSuffix}` : `${basename}${nameSuffix}`;
    const visR = names();
    const visibility: SymbolVisibility =
      visR < 0.3 ? "public" : visR < 0.72 ? "internal" : "private";
    const symLoc = Math.max(3, Math.floor(Math.pow(names(), 2.2) * 260 + 4));
    const cyclomatic = 1 + Math.floor(names() * 14);
    const cognitive = cyclomatic + Math.floor(names() * 12);
    const callers = Math.floor(Math.pow(names(), 2) * 30);
    const callees = Math.floor(Math.pow(names(), 1.6) * 18);
    const tests = Math.floor(Math.pow(names(), 3) * 12);
    out.push({
      id: `${entity.id}::${name}`,
      name,
      kind,
      visibility,
      loc: symLoc,
      line,
      cyclomatic,
      cognitive,
      callers,
      callees,
      tests,
    });
    line += symLoc + 2;
  }
  return out;
}

/** Nearest-k "twin" files by synthesized similarity — structural +
 *  co-change composite. Deterministic via id hashing. */
export function fileTwins(entity: Entity, pool: readonly Entity[], k: number = 6): Array<{ entity: Entity; similarity: number; reason: string }> {
  const me = hashId(entity.id);
  const scored: Array<{ entity: Entity; similarity: number; reason: string }> = [];
  for (const other of pool) {
    if (other.id === entity.id) continue;
    if (other.kind !== "building" && other.kind !== "floor") continue;
    // Hybrid score: string-overlap on name + seeded structural + seeded co-change.
    const nameOverlap = jaccardName(entity.name, other.name);
    const structural = seeded(`${entity.id}↔${other.id}`, "struct")();
    const coChange = seeded(`${entity.id}↔${other.id}`, "cc")();
    const score = nameOverlap * 0.35 + structural * 0.35 + coChange * 0.30;
    // Pick the dominant reason for the label.
    const reason =
      nameOverlap >= structural && nameOverlap >= coChange ? "이름 유사"
      : coChange >= structural ? "co-change"
      : "구조 유사";
    scored.push({ entity: other, similarity: score, reason });
  }
  // Stable tiebreak using me-hash for determinism.
  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    return (hashId(a.entity.id) - me) - (hashId(b.entity.id) - me);
  });
  return scored.slice(0, k);
}

function jaccardName(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase().replace(/\.[a-z]+$/, "")
        .split(/[-._/\s]+/)
        .filter(t => t.length > 1),
    );
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Robert C. Martin's Instability I = Ce / (Ca + Ce). 0..1. */
export function packageInstability(
  entity: Entity,
  tree: { byId: ReadonlyMap<string, Entity>; childrenOf(id: string): readonly Entity[] },
  edges?: ReadonlyArray<{ from: string; to: string }>,
): { ca: number; ce: number; instability: number } {
  // Collect descendant file ids.
  const descendants = new Set<string>();
  const stack = [entity.id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const e = tree.byId.get(id);
    if (!e) continue;
    if (e.kind === "building") descendants.add(e.id);
    for (const c of e.childIds) stack.push(c);
  }

  if (edges) {
    let ca = 0, ce = 0;
    for (const { from, to } of edges) {
      const fromIn = descendants.has(from);
      const toIn = descendants.has(to);
      if (fromIn && !toIn) ce++;
      else if (!fromIn && toIn) ca++;
    }
    const inst = (ca + ce) === 0 ? 0 : ce / (ca + ce);
    return { ca, ce, instability: inst };
  }

  // Fallback: seeded synth.
  const r1 = seeded(entity.id, "inst-ca")();
  const r2 = seeded(entity.id, "inst-ce")();
  const ca = Math.floor(r1 * 40);
  const ce = Math.floor(r2 * 40);
  const inst = (ca + ce) === 0 ? 0.5 : ce / (ca + ce);
  return { ca, ce, instability: inst };
}

/** Abstractness A = Na / Nc (abstract classes + interfaces / total).
 *  Synthesized from entity ids since we lack AST class info. */
export function packageAbstractness(entity: Entity): number {
  const r = seeded(entity.id, "abs")();
  return Math.pow(r, 1.6);
}

/** Distance from the main sequence |A + I - 1|. Low = healthy, high = "zone of pain / uselessness". */
export function mainSequenceDistance(a: number, i: number): number {
  return Math.abs(a + i - 1);
}

/** Package-level monthly LoC trail (12 months). */
export function packageLocHistory(entity: Entity, months: number = 12): number[] {
  const rng = seeded(entity.id, "pkg-loc");
  const base = 1000 + Math.floor(rng() * 8000);
  const out: number[] = [];
  let val = base;
  for (let i = 0; i < months; i++) {
    val = Math.max(100, val + Math.floor((rng() - 0.45) * 900));
    out.push(val);
  }
  return out;
}

/** Weekly churn (line-add + line-remove) history for a package. */
export function packageChurnHistory(entity: Entity, weeks: number = 26): Array<{ add: number; del: number }> {
  const rng = seeded(entity.id, "pkg-churn");
  const out: Array<{ add: number; del: number }> = [];
  for (let i = 0; i < weeks; i++) {
    const add = Math.floor(Math.pow(rng(), 1.8) * 1400);
    const del = Math.floor(Math.pow(rng(), 2.4) * 900);
    out.push({ add, del });
  }
  return out;
}

/** Active author count per month — proxy for team size. */
export function packageTeamHistory(entity: Entity, months: number = 12): number[] {
  const rng = seeded(entity.id, "pkg-team");
  const out: number[] = [];
  for (let i = 0; i < months; i++) {
    out.push(1 + Math.floor(Math.pow(rng(), 1.2) * 5));
  }
  return out;
}

/** Synthesized usage hits per file for a given symbol. Returns a map
 *  from fileId → hit count. Most files have 0 references; a few have
 *  concentrated usage (realistic symbol-usage skew). */
export function symbolUsageByFile(
  symbolId: string,
  pool: readonly Entity[],
): Map<string, number> {
  const out = new Map<string, number>();
  const rng = seeded(symbolId, "sym-usage");
  for (const e of pool) {
    if (e.kind !== "building" && e.kind !== "floor") continue;
    const r = rng();
    if (r < 0.78) continue;
    // A small fraction get hits; of those, most low, some concentrated.
    const hits = 1 + Math.floor(Math.pow(rng(), 2.8) * 16);
    out.set(e.id, hits);
  }
  return out;
}

/** Test names referencing a symbol. */
export function testsForSymbol(symbolId: string, count: number): string[] {
  const pool = [
    "parses valid input", "rejects malformed payload", "handles null selection",
    "preserves ordering", "rolls back on error", "retries on timeout",
    "deduplicates events", "caches warm results", "respects limits",
    "emits telemetry", "recovers from partial state", "matches snapshot",
  ];
  const rng = seeded(symbolId, "sym-tests");
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${pool[Math.floor(rng() * pool.length)]!} #${i + 1}`);
  }
  return out;
}

export function synthCfg(seedStr: string): SynthCfgNode[] {
  const rng = seeded(seedStr, "cfg");
  const nNodes = 6 + Math.floor(rng() * 9);
  const nodes: SynthCfgNode[] = [];
  nodes.push({ id: "n0", kind: "entry", label: "entry", children: ["n1"] });
  for (let i = 1; i < nNodes - 1; i++) {
    const r = rng();
    const kind: SynthCfgNode["kind"] = r < 0.72 ? "stmt" : r < 0.88 ? "branch" : "loop";
    const nextIds: string[] = [];
    if (kind === "branch") {
      const a = `n${i + 1}`;
      // Skip-ahead edge.
      const skip = `n${Math.min(nNodes - 1, i + 2 + Math.floor(rng() * 2))}`;
      nextIds.push(a, skip);
    } else if (kind === "loop") {
      // Self-loop edge + onward.
      nextIds.push(`n${i + 1}`, `n${i}`);
    } else {
      nextIds.push(`n${i + 1}`);
    }
    nodes.push({ id: `n${i}`, kind, label: ["guard", "call", "assign", "return"][i % 4]!, children: nextIds });
  }
  nodes.push({ id: `n${nNodes - 1}`, kind: "exit", label: "exit", children: [] });
  return nodes;
}
