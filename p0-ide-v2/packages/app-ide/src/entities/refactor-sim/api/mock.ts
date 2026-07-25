import type {
  RefactorCandidate,
  RefactorSim,
} from "../model/types";

/* ─────────────────────────────────────────────────────────────
 * orchestrator.py — split-file showcase (2 candidates)
 * ───────────────────────────────────────────────────────────── */

const orchestratorSplit: RefactorCandidate = {
  id: "orchestrator-split",
  title: "Split orchestrator.py → orchestrator.py + planner.py",
  op: "split-file",
  description:
    "Extract planning concerns (build_plan, run_step, pick_next) into a new planner module. orchestrator.py keeps dispatch + lifecycle; planner.py owns scheduling. Public entry points stay on Orchestrator but run_step loses its implicit context.",
  before: {
    nodes: [
      { id: "o.dispatch",   label: "dispatch",    kind: "fn" },
      { id: "o.run_step",   label: "run_step",    kind: "fn" },
      { id: "o.build_plan", label: "build_plan",  kind: "fn" },
      { id: "o.lock_cache", label: "lock_cache",  kind: "fn" },
      { id: "ext.queue",    label: "task_queue",  kind: "external" },
      { id: "ext.registry", label: "registry",    kind: "external" },
    ],
    edges: [
      { from: "o.dispatch",   to: "o.run_step",   kind: "call" },
      { from: "o.dispatch",   to: "o.build_plan", kind: "call" },
      { from: "o.run_step",   to: "o.lock_cache", kind: "call" },
      { from: "o.build_plan", to: "ext.registry", kind: "call" },
      { from: "o.dispatch",   to: "ext.queue",    kind: "call" },
    ],
  },
  after: {
    nodes: [
      { id: "o.dispatch",   label: "dispatch",     kind: "fn" },
      { id: "o.lock_cache", label: "lock_cache",   kind: "fn" },
      { id: "p.run_step",   label: "run_step",     kind: "fn" },
      { id: "p.build_plan", label: "build_plan",   kind: "fn" },
      { id: "p.pick_next",  label: "pick_next",    kind: "fn" },
      { id: "p.planner",    label: "planner",      kind: "module" },
      { id: "ext.queue",    label: "task_queue",   kind: "external" },
      { id: "ext.registry", label: "registry",     kind: "external" },
    ],
    edges: [
      { from: "o.dispatch",   to: "p.planner",    kind: "import" },
      { from: "o.dispatch",   to: "p.run_step",   kind: "call" },
      { from: "p.run_step",   to: "p.build_plan", kind: "call" },
      { from: "p.run_step",   to: "p.pick_next",  kind: "call" },
      { from: "p.build_plan", to: "ext.registry", kind: "call" },
      { from: "p.run_step",   to: "o.lock_cache", kind: "call" },
      { from: "o.dispatch",   to: "ext.queue",    kind: "call" },
    ],
  },
  edgeDeltas: [
    { op: "remove", edge: { from: "o.dispatch", to: "o.run_step",   kind: "call" } },
    { op: "remove", edge: { from: "o.dispatch", to: "o.build_plan", kind: "call" } },
    { op: "remove", edge: { from: "o.run_step", to: "o.lock_cache", kind: "call" } },
    { op: "add",    edge: { from: "o.dispatch",   to: "p.planner",    kind: "import" } },
    { op: "add",    edge: { from: "o.dispatch",   to: "p.run_step",   kind: "call" } },
    { op: "add",    edge: { from: "p.run_step",   to: "p.build_plan", kind: "call" } },
    { op: "add",    edge: { from: "p.run_step",   to: "p.pick_next",  kind: "call" } },
    { op: "add",    edge: { from: "p.run_step",   to: "o.lock_cache", kind: "call" } },
  ],
  impact: {
    blastBefore: 12,
    blastAfter: 9,
    consumersAffected: 4,
    testsStale: 2,
    testsStillCover: 11,
    coverageGapLines: 14,
    ownershipShift: [
      { owner: "@songmin",  pctBefore: 81, pctAfter: 58 },
      { owner: "@leej",     pctBefore: 12, pctAfter: 26 },
      { owner: "@new-hire", pctBefore:  0, pctAfter: 12 },
      { owner: "@bot",      pctBefore:  7, pctAfter:  4 },
    ],
  },
  claims: [
    {
      id: "import-cycles",
      label: "no new cyclic imports",
      status: "pass",
      evidence: "planner → orchestrator: 0 cycles. DAG verified across 3 SCCs.",
      verifier: "scc-check@v2",
    },
    {
      id: "ownership-non-regress",
      label: "ownership diffusion ≥ threshold",
      status: "pass",
      evidence: "max-owner share drops 81% → 58% (bus-factor 1 → 2).",
      verifier: "ownership-balance@v1",
    },
    {
      id: "blast-non-regress",
      label: "blast radius does not grow",
      status: "pass",
      evidence: "12 → 9 affected files; reduction of 3.",
      verifier: "blast-delta@v1",
    },
    {
      id: "test-coverage",
      label: "≥80% of existing tests remain authoritative",
      status: "pass",
      evidence: "11/13 existing tests still transitively cover new planner module.",
      verifier: "test-reach@v1",
    },
    {
      id: "concurrency",
      label: "concurrency semantics preserved",
      status: "warn",
      evidence:
        "lock_cache is now called across module boundary from planner.run_step (L42). Lock acquisition order identical, but holding window increased by ~1 frame due to indirection.",
      verifier: "happens-before@v1",
    },
    {
      id: "public-api",
      label: "public API unchanged",
      status: "fail",
      evidence:
        "planner.run_step now requires explicit context=; callers of Orchestrator.run_step() continue to work but direct imports of run_step lose default ctx.",
      verifier: "api-diff@v1",
    },
  ],
  safetyScore: 72,
};

const orchestratorExtract: RefactorCandidate = {
  id: "orchestrator-extract-execute-step",
  title: "Extract method execute_step from dispatch",
  op: "extract-method",
  description:
    "Pull the per-step execution block out of dispatch into a private execute_step(ctx, step). No signature change at the public surface; dispatch becomes a thin loop.",
  before: {
    nodes: [
      { id: "o.dispatch",    label: "dispatch",    kind: "fn" },
      { id: "o.run_step",    label: "run_step",    kind: "fn" },
      { id: "o.lock_cache",  label: "lock_cache",  kind: "fn" },
      { id: "ext.queue",     label: "task_queue",  kind: "external" },
    ],
    edges: [
      { from: "o.dispatch",  to: "o.run_step",   kind: "call" },
      { from: "o.dispatch",  to: "o.lock_cache", kind: "call" },
      { from: "o.dispatch",  to: "ext.queue",    kind: "call" },
    ],
  },
  after: {
    nodes: [
      { id: "o.dispatch",    label: "dispatch",     kind: "fn" },
      { id: "o.execute_step", label: "execute_step", kind: "fn" },
      { id: "o.run_step",    label: "run_step",     kind: "fn" },
      { id: "o.lock_cache",  label: "lock_cache",   kind: "fn" },
      { id: "ext.queue",     label: "task_queue",   kind: "external" },
    ],
    edges: [
      { from: "o.dispatch",    to: "o.execute_step", kind: "call" },
      { from: "o.execute_step", to: "o.run_step",   kind: "call" },
      { from: "o.execute_step", to: "o.lock_cache", kind: "call" },
      { from: "o.dispatch",    to: "ext.queue",    kind: "call" },
    ],
  },
  edgeDeltas: [
    { op: "remove", edge: { from: "o.dispatch", to: "o.run_step",   kind: "call" } },
    { op: "remove", edge: { from: "o.dispatch", to: "o.lock_cache", kind: "call" } },
    { op: "add",    edge: { from: "o.dispatch",    to: "o.execute_step", kind: "call" } },
    { op: "add",    edge: { from: "o.execute_step", to: "o.run_step",    kind: "call" } },
    { op: "add",    edge: { from: "o.execute_step", to: "o.lock_cache",  kind: "call" } },
  ],
  impact: {
    blastBefore: 12,
    blastAfter: 12,
    consumersAffected: 0,
    testsStale: 0,
    testsStillCover: 13,
    coverageGapLines: 2,
    ownershipShift: [
      { owner: "@songmin", pctBefore: 81, pctAfter: 79 },
      { owner: "@leej",    pctBefore: 12, pctAfter: 14 },
      { owner: "@bot",     pctBefore:  7, pctAfter:  7 },
    ],
  },
  claims: [
    {
      id: "public-api",
      label: "public API unchanged",
      status: "pass",
      evidence: "Orchestrator.dispatch signature byte-identical; execute_step is private.",
      verifier: "api-diff@v1",
    },
    {
      id: "concurrency",
      label: "concurrency semantics preserved",
      status: "pass",
      evidence: "lock_cache still acquired within the same stack frame; no escape.",
      verifier: "happens-before@v1",
    },
    {
      id: "import-cycles",
      label: "no new cyclic imports",
      status: "pass",
      evidence: "Single-module change. No cross-module edges touched.",
      verifier: "scc-check@v2",
    },
    {
      id: "test-coverage",
      label: "existing tests remain authoritative",
      status: "pass",
      evidence: "13/13 tests still exercise dispatch and transitively execute_step.",
      verifier: "test-reach@v1",
    },
  ],
  safetyScore: 91,
};

/* ─────────────────────────────────────────────────────────────
 * routing_policy.py — inline helper
 * ───────────────────────────────────────────────────────────── */

const routingInline: RefactorCandidate = {
  id: "routing-inline-legacy",
  title: "Inline legacy_router helper",
  op: "inline",
  description:
    "legacy_router has one remaining caller (pick_route) and mirrors a two-line lookup. Inline it and drop the helper.",
  before: {
    nodes: [
      { id: "r.pick_route",     label: "pick_route",     kind: "fn" },
      { id: "r.legacy_router",  label: "legacy_router",  kind: "fn" },
      { id: "r.table",          label: "route_table",    kind: "fn" },
      { id: "ext.metrics",      label: "metrics",        kind: "external" },
    ],
    edges: [
      { from: "r.pick_route",    to: "r.legacy_router", kind: "call" },
      { from: "r.legacy_router", to: "r.table",         kind: "call" },
      { from: "r.pick_route",    to: "ext.metrics",     kind: "call" },
    ],
  },
  after: {
    nodes: [
      { id: "r.pick_route", label: "pick_route",   kind: "fn" },
      { id: "r.table",      label: "route_table",  kind: "fn" },
      { id: "ext.metrics",  label: "metrics",      kind: "external" },
    ],
    edges: [
      { from: "r.pick_route", to: "r.table",     kind: "call" },
      { from: "r.pick_route", to: "ext.metrics", kind: "call" },
    ],
  },
  edgeDeltas: [
    { op: "remove", edge: { from: "r.pick_route",    to: "r.legacy_router", kind: "call" } },
    { op: "remove", edge: { from: "r.legacy_router", to: "r.table",         kind: "call" } },
    { op: "add",    edge: { from: "r.pick_route",    to: "r.table",         kind: "call" } },
  ],
  impact: {
    blastBefore: 5,
    blastAfter: 4,
    consumersAffected: 1,
    testsStale: 1,
    testsStillCover: 6,
    coverageGapLines: 3,
    ownershipShift: [
      { owner: "@leej",    pctBefore: 64, pctAfter: 66 },
      { owner: "@songmin", pctBefore: 24, pctAfter: 22 },
      { owner: "@bot",     pctBefore: 12, pctAfter: 12 },
    ],
  },
  claims: [
    {
      id: "public-api",
      label: "public API unchanged",
      status: "pass",
      evidence: "legacy_router was private (leading underscore); no external consumers.",
      verifier: "api-diff@v1",
    },
    {
      id: "dead-test",
      label: "no test becomes dead",
      status: "warn",
      evidence: "test_legacy_router_lookup targets a symbol that will vanish; 1 test flagged for deletion.",
      verifier: "test-reach@v1",
    },
    {
      id: "blast-non-regress",
      label: "blast radius does not grow",
      status: "pass",
      evidence: "5 → 4 affected files.",
      verifier: "blast-delta@v1",
    },
    {
      id: "concurrency",
      label: "concurrency semantics preserved",
      status: "pass",
      evidence: "Helper was pure; no shared state.",
      verifier: "happens-before@v1",
    },
  ],
  safetyScore: 85,
};

/* ─────────────────────────────────────────────────────────────
 * security.py — extract interface (additive)
 * ───────────────────────────────────────────────────────────── */

const securityExtractInterface: RefactorCandidate = {
  id: "security-extract-tokenstore",
  title: "Extract interface TokenStore",
  op: "extract-interface",
  description:
    "Introduce a TokenStore protocol above the concrete RedisTokenStore so tests and alt backends (Memory, Vault) can substitute cleanly.",
  before: {
    nodes: [
      { id: "s.auth",        label: "authenticate",     kind: "fn" },
      { id: "s.redis_store", label: "RedisTokenStore",  kind: "class" },
      { id: "ext.redis",     label: "redis",            kind: "external" },
    ],
    edges: [
      { from: "s.auth",        to: "s.redis_store", kind: "call" },
      { from: "s.redis_store", to: "ext.redis",     kind: "call" },
    ],
  },
  after: {
    nodes: [
      { id: "s.auth",         label: "authenticate",     kind: "fn" },
      { id: "s.token_iface",  label: "TokenStore",       kind: "class" },
      { id: "s.redis_store",  label: "RedisTokenStore",  kind: "class" },
      { id: "ext.redis",      label: "redis",            kind: "external" },
    ],
    edges: [
      { from: "s.auth",        to: "s.token_iface", kind: "call" },
      { from: "s.redis_store", to: "s.token_iface", kind: "import" },
      { from: "s.redis_store", to: "ext.redis",     kind: "call" },
    ],
  },
  edgeDeltas: [
    { op: "remove", edge: { from: "s.auth",       to: "s.redis_store", kind: "call" } },
    { op: "add",    edge: { from: "s.auth",        to: "s.token_iface", kind: "call" } },
    { op: "add",    edge: { from: "s.redis_store", to: "s.token_iface", kind: "import" } },
  ],
  impact: {
    blastBefore: 7,
    blastAfter: 7,
    consumersAffected: 2,
    testsStale: 0,
    testsStillCover: 9,
    coverageGapLines: 0,
    ownershipShift: [
      { owner: "@songmin", pctBefore: 52, pctAfter: 48 },
      { owner: "@leej",    pctBefore: 30, pctAfter: 32 },
      { owner: "@sec-team", pctBefore: 18, pctAfter: 20 },
    ],
  },
  claims: [
    {
      id: "public-api",
      label: "public API unchanged",
      status: "pass",
      evidence: "Interface is additive; RedisTokenStore remains exported under the same name.",
      verifier: "api-diff@v1",
    },
    {
      id: "substitutability",
      label: "Liskov-substitutable at all call sites",
      status: "pass",
      evidence: "All 9 call sites type-check against TokenStore.",
      verifier: "lsp-check@v1",
    },
    {
      id: "test-coverage",
      label: "existing tests remain authoritative",
      status: "pass",
      evidence: "9/9 tests still green without modification.",
      verifier: "test-reach@v1",
    },
    {
      id: "blast-non-regress",
      label: "blast radius does not grow",
      status: "pass",
      evidence: "7 → 7 affected files (no change).",
      verifier: "blast-delta@v1",
    },
  ],
  safetyScore: 96,
};

export const REFACTOR_SIMS: Record<string, RefactorSim> = {
  "orchestrator.py": {
    candidates: [orchestratorSplit, orchestratorExtract],
  },
  "routing_policy.py": {
    candidates: [routingInline],
  },
  "security.py": {
    candidates: [securityExtractInterface],
  },
};

export function getRefactorSim(fileName: string): RefactorSim | null {
  return REFACTOR_SIMS[fileName] ?? null;
}
