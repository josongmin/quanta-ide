import type {
  IncidentDnaSample,
  IncidentReplay,
  ReplayEvent,
  VariableSnapshot,
} from "../model/types";

/* ═══════════════════════════════════════════════════════════════
   orchestrator.py — taint-flow exception at t≈1500ms, line 142
   ~30 events, 1800ms, 3 snapshots, DNA every 100ms with CPU spike
   ═══════════════════════════════════════════════════════════════ */

const orchestratorEvents: ReplayEvent[] = [
  { id: "o1",  t: 0,    kind: "enter",  line: 12,  frame: "orchestrator.dispatch",       depth: 0, text: "enter dispatch(req)",                         detail: "req = Request(id=r-9f12, user=u-42)" },
  { id: "o2",  t: 40,   kind: "log",    line: 18,  frame: "orchestrator.dispatch",       depth: 1, text: "log: dispatch start",                         detail: "trace_id=ab12cd", level: "info" },
  { id: "o3",  t: 90,   kind: "enter",  line: 27,  frame: "orchestrator.resolve_user",   depth: 1, text: "enter resolve_user(u-42)" },
  { id: "o4",  t: 140,  kind: "read",   line: 33,  frame: "orchestrator.resolve_user",   depth: 2, text: "read: user_cache[u-42]" },
  { id: "o5",  t: 180,  kind: "branch", line: 41,  frame: "orchestrator.resolve_user",   depth: 2, text: "branch: cache_hit = false",                   variant: "took", counterfactual: "would have used cached user path (skip DB)" },
  { id: "o6",  t: 220,  kind: "await",  line: 48,  frame: "orchestrator.resolve_user",   depth: 2, text: "await db.query(user)",                        detail: "SELECT * FROM users WHERE id=$1" },
  { id: "o7",  t: 560,  kind: "resume", line: 48,  frame: "orchestrator.resolve_user",   depth: 2, text: "resume db.query → 1 row" },
  { id: "o8",  t: 590,  kind: "write",  line: 55,  frame: "orchestrator.resolve_user",   depth: 2, text: "write: user_cache[u-42] = user",              level: "info" },
  { id: "o9",  t: 620,  kind: "exit",   line: 58,  frame: "orchestrator.resolve_user",   depth: 2, text: "exit resolve_user → User(u-42)" },
  { id: "o10", t: 660,  kind: "enter",  line: 72,  frame: "orchestrator.build_plan",     depth: 1, text: "enter build_plan(user, req)" },
  { id: "o11", t: 700,  kind: "log",    line: 78,  frame: "orchestrator.build_plan",     depth: 2, text: "log: plan nodes=4",                           level: "info" },
  { id: "o12", t: 740,  kind: "branch", line: 85,  frame: "orchestrator.build_plan",     depth: 2, text: "branch: fast_path eligible",                  variant: "skipped", counterfactual: "would have taken fast-path (skip policy eval)" },
  { id: "o13", t: 780,  kind: "enter",  line: 92,  frame: "orchestrator.apply_policy",   depth: 2, text: "enter apply_policy(plan)" },
  { id: "o14", t: 820,  kind: "read",   line: 96,  frame: "orchestrator.apply_policy",   depth: 3, text: "read: policy_registry" },
  { id: "o15", t: 900,  kind: "log",    line: 104, frame: "orchestrator.apply_policy",   depth: 3, text: "log: policy=routing.v3 matched",              level: "info" },
  { id: "o16", t: 960,  kind: "await",  line: 110, frame: "orchestrator.apply_policy",   depth: 3, text: "await policy.evaluate(ctx)" },
  { id: "o17", t: 1180, kind: "resume", line: 110, frame: "orchestrator.apply_policy",   depth: 3, text: "resume policy.evaluate → allow" },
  { id: "o18", t: 1210, kind: "log",    line: 116, frame: "orchestrator.apply_policy",   depth: 3, text: "warn: tainted field 'raw_query' propagated",  detail: "src=req.body.q → sink=plan.args[2]", level: "warn" },
  { id: "o19", t: 1260, kind: "exit",   line: 120, frame: "orchestrator.apply_policy",   depth: 3, text: "exit apply_policy → plan" },
  { id: "o20", t: 1300, kind: "exit",   line: 128, frame: "orchestrator.build_plan",     depth: 2, text: "exit build_plan → plan" },
  { id: "o21", t: 1340, kind: "enter",  line: 134, frame: "orchestrator.execute",        depth: 1, text: "enter execute(plan)" },
  { id: "o22", t: 1380, kind: "branch", line: 138, frame: "orchestrator.execute",        depth: 2, text: "branch: sandbox disabled",                    variant: "took", counterfactual: "would have executed in sandboxed worker" },
  { id: "o23", t: 1420, kind: "read",   line: 140, frame: "orchestrator.execute",        depth: 2, text: "read: plan.args[2]  (tainted)" },
  { id: "o24", t: 1460, kind: "write",  line: 141, frame: "orchestrator.execute",        depth: 2, text: "write: db.exec(raw_sql)",                     detail: "raw_sql = \"SELECT * FROM t WHERE x=\" + tainted", level: "warn" },
  { id: "o25", t: 1500, kind: "exception", line: 142, frame: "orchestrator.execute",     depth: 2, text: "exception: TaintFlowError",                   detail: "TaintFlowError: untrusted input reached db.exec sink", level: "error" },
  { id: "o26", t: 1540, kind: "log",    line: 148, frame: "orchestrator.execute",        depth: 2, text: "error: abort transaction",                    level: "error" },
  { id: "o27", t: 1600, kind: "exit",   line: 150, frame: "orchestrator.execute",        depth: 2, text: "exit execute (unwinding)" },
  { id: "o28", t: 1680, kind: "log",    line: 162, frame: "orchestrator.dispatch",       depth: 1, text: "error: dispatch failed",                      level: "error" },
  { id: "o29", t: 1740, kind: "exit",   line: 170, frame: "orchestrator.dispatch",       depth: 1, text: "exit dispatch (unwinding)" },
  { id: "o30", t: 1800, kind: "log",    line: 170, frame: "orchestrator.dispatch",       depth: 0, text: "log: request returned 500",                   level: "error" },
];

const orchestratorSnapshots: VariableSnapshot[] = [
  {
    t: 620,
    frame: "orchestrator.resolve_user",
    vars: [
      { name: "user_id",     value: "'u-42'" },
      { name: "cache_hit",   value: "false", changed: true },
      { name: "user",        value: "User(id='u-42', tier='pro')", changed: true },
      { name: "db_latency",  value: "340ms" },
    ],
  },
  {
    t: 1210,
    frame: "orchestrator.apply_policy",
    vars: [
      { name: "policy",      value: "'routing.v3'" },
      { name: "ctx.user",    value: "User(id='u-42', tier='pro')" },
      { name: "tainted",     value: "['raw_query']", changed: true },
      { name: "decision",    value: "'allow'" },
    ],
  },
  {
    t: 1500,
    frame: "orchestrator.execute",
    vars: [
      { name: "plan.args[2]", value: "\"' OR 1=1 --\"", changed: true },
      { name: "raw_sql",      value: "\"SELECT * FROM t WHERE x=' OR 1=1 --\"", changed: true },
      { name: "sandbox",      value: "false" },
      { name: "stage",        value: "'sink'", changed: true },
    ],
  },
];

const orchestratorDna: IncidentDnaSample[] = (() => {
  const out: IncidentDnaSample[] = [];
  for (let t = 0; t <= 1800; t += 100) {
    // CPU rises into spike before exception at 1500ms
    const cpuBase =
      t < 600  ? 18 + (t / 600) * 12 :
      t < 1200 ? 30 + ((t - 600) / 600) * 20 :
      t < 1500 ? 50 + ((t - 1200) / 300) * 40 :
                 80 - ((t - 1500) / 300) * 50;
    const memBase = 28 + Math.min(50, t / 36);
    const ioBase =
      t < 600  ? 10 + Math.sin(t / 120) * 5 :
      t < 1200 ? 42 + Math.sin(t / 90) * 8 :
                 22 + Math.sin(t / 70) * 6;
    out.push({
      t,
      cpu: Math.max(0, Math.min(100, Math.round(cpuBase))),
      mem: Math.max(0, Math.min(100, Math.round(memBase))),
      io:  Math.max(0, Math.min(100, Math.round(ioBase))),
    });
  }
  return out;
})();

const orchestratorReplay: IncidentReplay = {
  incidentId: "inc-2026-04-19-orch-001",
  title: "TaintFlow: untrusted query reached db.exec",
  capturedAt: "2026-04-19T14:32:08Z",
  rootCauseFrame: "orchestrator.execute",
  durationMs: 1800,
  events: orchestratorEvents,
  snapshots: orchestratorSnapshots,
  dna: orchestratorDna,
  failingLine: 142,
};

/* ═══════════════════════════════════════════════════════════════
   routing_policy.py — slow-path, ~12 events, 800ms, 1 snapshot
   ═══════════════════════════════════════════════════════════════ */

const routingEvents: ReplayEvent[] = [
  { id: "r1",  t: 0,   kind: "enter",  line: 8,   frame: "routing_policy.match",        depth: 0, text: "enter match(req)" },
  { id: "r2",  t: 20,  kind: "log",    line: 11,  frame: "routing_policy.match",        depth: 1, text: "log: 14 rules to evaluate", level: "info" },
  { id: "r3",  t: 40,  kind: "read",   line: 17,  frame: "routing_policy.match",        depth: 1, text: "read: rules_table" },
  { id: "r4",  t: 80,  kind: "enter",  line: 22,  frame: "routing_policy.score_rule",   depth: 1, text: "enter score_rule(rule=12)" },
  { id: "r5",  t: 180, kind: "await",  line: 29,  frame: "routing_policy.score_rule",   depth: 2, text: "await geoip.lookup(ip)" },
  { id: "r6",  t: 520, kind: "resume", line: 29,  frame: "routing_policy.score_rule",   depth: 2, text: "resume geoip.lookup → 'US-WA' (340ms slow)" },
  { id: "r7",  t: 560, kind: "log",    line: 34,  frame: "routing_policy.score_rule",   depth: 2, text: "warn: geoip exceeded p99 budget", level: "warn" },
  { id: "r8",  t: 600, kind: "branch", line: 41,  frame: "routing_policy.score_rule",   depth: 2, text: "branch: score > threshold",    variant: "took", counterfactual: "would have returned no-match early" },
  { id: "r9",  t: 640, kind: "exit",   line: 48,  frame: "routing_policy.score_rule",   depth: 2, text: "exit score_rule → 0.82" },
  { id: "r10", t: 700, kind: "write",  line: 56,  frame: "routing_policy.match",        depth: 1, text: "write: matched_rule = 12" },
  { id: "r11", t: 760, kind: "log",    line: 62,  frame: "routing_policy.match",        depth: 1, text: "log: match complete (slow)", level: "warn" },
  { id: "r12", t: 800, kind: "exit",   line: 68,  frame: "routing_policy.match",        depth: 1, text: "exit match → Rule(12)" },
];

const routingSnapshots: VariableSnapshot[] = [
  {
    t: 640,
    frame: "routing_policy.score_rule",
    vars: [
      { name: "rule_id",    value: "12" },
      { name: "geo",        value: "'US-WA'", changed: true },
      { name: "score",      value: "0.82", changed: true },
      { name: "threshold",  value: "0.70" },
      { name: "latency_ms", value: "340", changed: true },
    ],
  },
];

const routingDna: IncidentDnaSample[] = (() => {
  const out: IncidentDnaSample[] = [];
  for (let t = 0; t <= 800; t += 80) {
    // flat DNA except one IO spike around t=300-500
    const ioBase = t >= 200 && t <= 520 ? 70 + Math.sin((t - 200) / 60) * 10 : 12;
    out.push({
      t,
      cpu: 22 + Math.round(Math.sin(t / 80) * 3),
      mem: 35,
      io:  Math.max(0, Math.min(100, Math.round(ioBase))),
    });
  }
  return out;
})();

const routingReplay: IncidentReplay = {
  incidentId: "inc-2026-04-18-rout-007",
  title: "Slow-path: geoip lookup blocked rule scoring 340ms",
  capturedAt: "2026-04-18T09:11:44Z",
  rootCauseFrame: "routing_policy.score_rule",
  durationMs: 800,
  events: routingEvents,
  snapshots: routingSnapshots,
  dna: routingDna,
};

/* ═══════════════════════════════════════════════════════════════
   security.py — authz-leak, 18 events, 1200ms, final write on line 88
   ═══════════════════════════════════════════════════════════════ */

const securityEvents: ReplayEvent[] = [
  { id: "s1",  t: 0,    kind: "enter",  line: 14,  frame: "security.authorize",         depth: 0, text: "enter authorize(req, resource)" },
  { id: "s2",  t: 30,   kind: "log",    line: 20,  frame: "security.authorize",         depth: 1, text: "log: subject=u-17 res=order/8821", level: "info" },
  { id: "s3",  t: 70,   kind: "read",   line: 26,  frame: "security.authorize",         depth: 1, text: "read: role_cache[u-17]" },
  { id: "s4",  t: 110,  kind: "enter",  line: 34,  frame: "security.resolve_scope",     depth: 1, text: "enter resolve_scope(subject)" },
  { id: "s5",  t: 160,  kind: "await",  line: 41,  frame: "security.resolve_scope",     depth: 2, text: "await scope_service.fetch()" },
  { id: "s6",  t: 420,  kind: "resume", line: 41,  frame: "security.resolve_scope",     depth: 2, text: "resume scope_service → ['read:order']" },
  { id: "s7",  t: 460,  kind: "exit",   line: 46,  frame: "security.resolve_scope",     depth: 2, text: "exit resolve_scope → Scope(['read:order'])" },
  { id: "s8",  t: 500,  kind: "enter",  line: 52,  frame: "security.check_permission",  depth: 1, text: "enter check_permission(scope, 'write:order')" },
  { id: "s9",  t: 560,  kind: "branch", line: 58,  frame: "security.check_permission",  depth: 2, text: "branch: scope.contains('write:order')", variant: "skipped", counterfactual: "would have denied (correct behavior)" },
  { id: "s10", t: 600,  kind: "branch", line: 64,  frame: "security.check_permission",  depth: 2, text: "branch: legacy_bypass_flag",             variant: "took",    counterfactual: "would have enforced strict check" },
  { id: "s11", t: 640,  kind: "log",    line: 68,  frame: "security.check_permission",  depth: 2, text: "warn: legacy bypass engaged", level: "warn" },
  { id: "s12", t: 700,  kind: "exit",   line: 72,  frame: "security.check_permission",  depth: 2, text: "exit check_permission → allow" },
  { id: "s13", t: 760,  kind: "enter",  line: 78,  frame: "security.record_audit",      depth: 1, text: "enter record_audit(event)" },
  { id: "s14", t: 820,  kind: "read",   line: 82,  frame: "security.record_audit",      depth: 2, text: "read: audit_buffer" },
  { id: "s15", t: 900,  kind: "log",    line: 85,  frame: "security.record_audit",      depth: 2, text: "log: audit event appended", level: "info" },
  { id: "s16", t: 1020, kind: "exit",   line: 87,  frame: "security.record_audit",      depth: 2, text: "exit record_audit" },
  { id: "s17", t: 1120, kind: "write",  line: 88,  frame: "security.authorize",         depth: 1, text: "write: mutate_order(res, patch)  [LEAK]", detail: "authz leak: write occurred despite insufficient scope", counterfactual: "strict check would have rejected here", level: "error" },
  { id: "s18", t: 1200, kind: "exit",   line: 94,  frame: "security.authorize",         depth: 1, text: "exit authorize → ok (but leaked)" },
];

const securitySnapshots: VariableSnapshot[] = [
  {
    t: 460,
    frame: "security.resolve_scope",
    vars: [
      { name: "subject", value: "'u-17'" },
      { name: "scope",   value: "['read:order']", changed: true },
    ],
  },
  {
    t: 700,
    frame: "security.check_permission",
    vars: [
      { name: "required",            value: "'write:order'" },
      { name: "scope",               value: "['read:order']" },
      { name: "legacy_bypass_flag",  value: "true", changed: true },
      { name: "decision",            value: "'allow'", changed: true },
    ],
  },
  {
    t: 1120,
    frame: "security.authorize",
    vars: [
      { name: "resource", value: "'order/8821'" },
      { name: "patch",    value: "{status:'shipped'}" },
      { name: "decision", value: "'allow'" },
      { name: "side_effect", value: "'mutate_order'", changed: true },
    ],
  },
];

const securityDna: IncidentDnaSample[] = (() => {
  const out: IncidentDnaSample[] = [];
  for (let t = 0; t <= 1200; t += 100) {
    out.push({
      t,
      cpu: 24 + Math.round(Math.sin(t / 110) * 4),
      mem: 30 + Math.round(t / 60),
      io:  t >= 160 && t <= 420 ? 55 + Math.round(Math.sin((t - 160) / 60) * 8) : 14,
    });
  }
  return out;
})();

const securityReplay: IncidentReplay = {
  incidentId: "inc-2026-04-20-sec-003",
  title: "Authz leak: legacy bypass allowed write without scope",
  capturedAt: "2026-04-20T21:07:55Z",
  rootCauseFrame: "security.check_permission",
  durationMs: 1200,
  events: securityEvents,
  snapshots: securitySnapshots,
  dna: securityDna,
  failingLine: 88,
};

/* ─── Registry + lookup ──────────────────────────────────────── */

export const REPLAYS: Record<string, IncidentReplay> = {
  "orchestrator.py": orchestratorReplay,
  "routing_policy.py": routingReplay,
  "security.py": securityReplay,
};

export function getReplay(fileName: string): IncidentReplay | null {
  return REPLAYS[fileName] ?? null;
}
