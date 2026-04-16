import type { Project, ChatSession, ChangedFile } from "../model/types";

export const PROJECTS: Project[] = [
  { id: "openagent-sdk", label: "openagent-sdk", kind: "repo" },
  { id: "forgecode", label: "forgecode", kind: "repo" },
  { id: "home", label: "Home", kind: "home" },
  { id: "kilo-org/kilocode", label: "kilo-org/kilocode", kind: "repo" },
  { id: "jsongmin/quanta-ide", label: "jsongmin/quanta-ide", kind: "repo" },
  { id: "leeyes1/claude-code-sourcemap", label: "leeyes1/claude-code-sourcemap", kind: "repo" },
];

export const RESPONSE_POOL: Record<string, string[]> = {
  forge: [
    "It's hard to answer \"is Forge better?\" in one line — it splits along several axes.\n\n- **On the terminal-bench CLI axis**, in the current `terminalbench` format ForgeCode looks favorable, and their docs point to a compact single-stream request loop (actual context) as a direct competitive lever.\n- **For the in-editor experience** — once you factor in team products (**Kilo**-adjacent / editor context), **Kilocode** is often the better pick. They're less \"same agent\" and more \"differently-shaped product.\"\n- **For open-source forkability**, Kilo is a thin shell layered on top of **opencode** — simple, but that's not inherently bad; it's a familiar extend-vs-own tradeoff.\n\nSo: **\"if you only look at terminal-agent tooling on benchmarks, Forge looks favorable\"** is fair, but **\"Forge is better overall\"** depends on who's using it and where.",
  ],
  refund: [
    "I traced the refund flow through **14 files** in the webhook chain.\n\n**Root cause:** `orchestrator.py:73` — the retry loop re-invokes `execute()` without checking the idempotency key. The ledger write at `ledger.py:45` can execute twice.\n\n```\nwebhook.py → retry_handler.py → orchestrator.py:execute()\n  → ledger.py:updateLedger()  ← NO DEDUP CHECK\n```\n\n**Impact:** 38 files · 6 writers · risk **0.92**",
  ],
  fix: [
    "On it. Here's the patch:\n\n```diff\n  # retry_handler.py\n+ from shared.idempotency import IdempotencyGuard\n+\n  async def retry_with_backoff(task):\n+     guard = IdempotencyGuard(task.idempotency_key)\n+     if guard.already_processed:\n+         return CachedResult(guard.previous_result)\n+\n      result = await orchestrator.execute(task)\n+     guard.mark_processed(task.idempotency_key, result)\n      return result\n```\n\n**3 files changed** · +47 -12 lines\n✅ Tests: 2/12 pass · 0 fail",
  ],
};

export const CHANGED_FILES: ChangedFile[] = [
  {
    path: "docs/system-overview/agent-process.md",
    badge: "+978",
    tag: "New",
    isNew: true,
    diff: [
      { kind: "hunk", text: "@@ -0,0 +1,32 @@" },
      { kind: "add", new: 1, text: "# Agent Processing Overview" },
      { kind: "add", new: 2, text: "" },
      { kind: "add", new: 3, text: "This document traces user input through `packages/opencode/` into session" },
      { kind: "add", new: 4, text: "" },
      { kind: "add", new: 5, text: "**Audience:** not end users — **module-to-module calls** (CLI ↔ server ↔ Bus)" },
      { kind: "add", new: 6, text: "" },
      { kind: "add", new: 7, text: "---" },
      { kind: "add", new: 8, text: "" },
      { kind: "add", new: 9, text: "## Table of Contents" },
      { kind: "add", new: 10, text: "" },
      { kind: "add", new: 11, text: "1. [Products and runtime](#1-products-and-runtime)" },
      { kind: "add", new: 12, text: "2. [Where user input enters](#2-where-user-input-enters)" },
      { kind: "add", new: 13, text: "3. [Server entry: SessionPrompt](#3-server-entry-sessionprompt)" },
      { kind: "add", new: 14, text: "4. [createUserMessage — store and expand](#4-createusermessage--store-and-expand)" },
      { kind: "add", new: 15, text: "5. [SessionPrompt.loop — turn state machine](#5-sessionpromptloop--turn-state-machine)" },
      { kind: "add", new: 16, text: "6. [Tool surface: how tools are picked](#6-tool-surface-how-tools-are-picked)" },
      { kind: "add", new: 17, text: "7. [Stream handling — SessionProcessor](#7-stream-handling--sessionprocessor)" },
      { kind: "add", new: 18, text: "8. [Agents and plan mode](#8-agents-and-plan-mode)" },
      { kind: "add", new: 19, text: "9. [MCP lifecycle](#9-mcp-lifecycle)" },
      { kind: "add", new: 20, text: "10. [TUI remote control (optional)](#10-tui-remote-control-optional)" },
    ],
  },
  {
    path: "packages/opencode/src/session/prompt.ts",
    badge: "+512",
    tag: "M",
    diff: [
      { kind: "hunk", text: "@@ -41,6 +41,18 @@ export namespace SessionPrompt {" },
      { kind: "ctx", old: 41, new: 41, text: "  export async function run(input: Input) {" },
      { kind: "ctx", old: 42, new: 42, text: "    const session = await Session.get(input.sessionID)" },
      { kind: "ctx", old: 43, new: 43, text: "    const msg = await createUserMessage(session, input)" },
      { kind: "add", new: 44, text: "    const guard = new IdempotencyGuard(msg.id)" },
      { kind: "add", new: 45, text: "    if (guard.alreadyProcessed) return guard.previousResult" },
      { kind: "add", new: 46, text: "" },
      { kind: "ctx", old: 44, new: 47, text: "    return loop(session, msg)" },
      { kind: "ctx", old: 45, new: 48, text: "  }" },
    ],
  },
  {
    path: "packages/tui/src/sync-provider.ts",
    badge: "+235",
    tag: "M",
    diff: [
      { kind: "hunk", text: "@@ -112,5 +112,9 @@ export function createSyncProvider() {" },
      { kind: "ctx", old: 112, new: 112, text: "  bus.on(\"session.part\", (ev) => {" },
      { kind: "ctx", old: 113, new: 113, text: "    store.upsertPart(ev.part)" },
      { kind: "add", new: 114, text: "    metrics.track(\"sse.part\", { kind: ev.part.kind })" },
      { kind: "ctx", old: 114, new: 115, text: "  })" },
    ],
  },
];

export const GENERIC_RESPONSES = [
  "Let me analyze the codebase for that.\n\nI traced through the call graph and data flow. Here's what I found:\n- **12 files** are directly relevant\n- **3 call chains** involve the pattern you described\n- Risk score for this area: **0.67**\n\nWant me to dig deeper into any specific path?",
  "Looking at the code structure...\n\n- Cyclomatic complexity: **6.4**\n- 3 callers, 5 callees\n- Test coverage: **42%**\n\nShould I generate tests for the uncovered branches?",
  "I ran a blast-radius analysis on that change.\n\n**Direct impact:** 4 files\n**Transitive impact:** 23 files (via call graph)\n**Cross-service:** 2 downstream services affected",
  "Scanned the module. Two things stand out:\n\n1. `cache.ts:88` drops the stale entry **before** verifying the write succeeded — a crash between those lines leaves a hole.\n2. The retry wrapper at `retry.ts:21` swallows `AbortError`, so cancellations look like successes in telemetry.\n\nWant a patch for either?",
  "Here's the call chain for that endpoint:\n\n```\nhandlers/order.ts:create\n  → service/order.ts:draft\n    → repo/order.ts:insert\n      → db/pool.ts:exec\n```\n\nThree of these (`draft`, `insert`, `exec`) share a transaction. If you need a new side effect, hook it at `service/order.ts` so it joins the same tx.",
  "I checked the type flow. `Result<T, E>` is only unwrapped in 2 of 11 call sites — the rest `any`-cast it at the boundary. That's probably where your runtime errors come from.\n\nI can generate a codemod that turns those casts into a proper `.map/.mapErr` pipeline. Want me to draft it?",
  "Ran a quick hotspot analysis over the last 90 days:\n\n- **orchestrator.ts** — 42 commits, 6 authors, 0.71 risk\n- **session-store.ts** — 28 commits, 3 authors, 0.58 risk\n- **auth-middleware.ts** — 19 commits, 5 authors, 0.83 risk ← newest, riskiest\n\nThe auth middleware is where I'd focus a review first.",
  "Summary of what this file does:\n\n- **Input:** a raw webhook payload + a signing secret\n- **Output:** a verified `Event` or throws `InvalidSignatureError`\n- **Side effects:** emits `webhook.verified` on the event bus, writes an audit row\n\nThe interesting part is the timing-safe comparison at line 47 — that's the security-critical step.",
  "Diff of your staged changes, summarized:\n\n- **3 files**, **+127 / -44**\n- New dependency: `p-limit@6.2.0`\n- One public API change: `runTasks()` now returns `Promise<Result[]>` instead of `Promise<void>`\n\nThat return type change is breaking for any caller that doesn't await — grep finds 4 such sites.",
  "I can see two different patterns in this file — looks like a refactor in progress.\n\n- Old style: class-based, `this.db.query(...)`\n- New style: functional, `db.query(trx, ...)`\n\nThey're intermixed right now. Want me to finish the migration in one pass and delete the old helpers?",
  "For that query, the bottleneck is the **N+1** on `user.roles`. Each order pulls its user row, then separately pulls roles per user.\n\nYou can fold it into a single `JOIN` — roughly **`42ms → 6ms`** on the sample dataset. I'll draft the SQL if you want.",
  "Searching for that symbol...\n\nFound **14 references** across 8 files. Two of them are in test files, the rest live in:\n\n- `services/billing/` — 5 refs (core usage)\n- `workers/reconciler.ts` — 3 refs\n- `migrations/20240512_*.ts` — 2 refs (safe to ignore for refactors)\n- `scripts/cli.ts` — 2 refs\n\nWant me to rename all of them?",
  "That function is **dead code** — no callers anywhere in the repo (checked `src/`, `test/`, and `scripts/`).\n\nIt was added 14 months ago in a commit that also removed the feature flag it was guarding. Safe to delete.",
  "Checked the test coverage delta for your branch:\n\n- Covered lines added: **+318**\n- Uncovered lines added: **+41**\n- Overall: **76.4% → 77.1%** (+0.7pp)\n\nThe 41 uncovered lines are all in error branches. I can generate tests for them if you'd like.",
  "This is a classic **read-modify-write race**.\n\n1. Worker A reads `count` (= 5)\n2. Worker B reads `count` (= 5)\n3. A writes `count = 6`\n4. B writes `count = 6`\n\nYou'll want either a row-level lock or an atomic `UPDATE ... SET count = count + 1` — the latter is cheaper.",
  "Looking at the imports, this module depends on:\n\n- **3 internal packages** (`@app/core`, `@app/db`, `@app/logger`)\n- **2 npm packages** (`zod`, `date-fns`)\n- **0 node builtins**\n\nNothing stale. `zod` is on the latest minor, `date-fns` is one minor behind.",
  "For this feature flag, I checked the rollout state:\n\n- **`beta_checkout_v2`** — 45% rollout, 0 errors in the last 24h\n- No waivers, no forced on/off rules\n\nLooks healthy. You could probably ramp to 100% on the next deploy window.",
  "Pulled the error metrics for that endpoint over the last week:\n\n- Total requests: **1.2M**\n- 5xx rate: **0.08%**\n- P99 latency: **412ms**\n- Top error: `TimeoutError` from the payments provider (71% of 5xx)\n\nThe provider is your actual bottleneck, not this handler.",
  "There's a subtle bug here: `JSON.parse` is called inside a `try`, but the `catch` only logs and continues — so downstream code receives `undefined` where it expects an object.\n\nMinimal fix: `return null` on parse failure and handle `null` at the call site. Or throw a typed error.",
  "Here's the mental model for this module:\n\n- **Pure functions** for transforms (no I/O)\n- **Repositories** for data access (DB only)\n- **Services** compose repositories + transforms\n- **Handlers** are thin — just parse the request and call a service\n\nYour new code fits best as a service: it needs two repos and one transform.",
  "I'd recommend extracting this into a helper. The same 6-line block appears in **5 places** and they're already drifting — two of them handle `null` differently.\n\nA shared `normalizeEmail(input)` function would consolidate them and make the next bug a one-file fix.",
  "That migration is **not reversible** as written — the `down` step drops `legacy_id`, but `up` doesn't keep a backup.\n\nFor a production-safe rollback, you'd need a shadow table or a conditional restore. Want me to sketch a safer version?",
  "For this refactor, I'd split it into three PRs:\n\n1. **Extract** the pure helpers into a new file (no behavior change)\n2. **Rewire** the call sites to use the new helpers\n3. **Delete** the old class and its tests\n\nEach PR is easy to review alone; bundled together they're a 900-line diff.",
  "Checked the generated types — the OpenAPI spec and the TS types are **out of sync**.\n\n- Spec says `status: \"pending\" | \"approved\" | \"rejected\"`\n- Code treats it as `\"new\" | \"approved\" | \"denied\"`\n\nOne of them is wrong. Regenerating from the spec will break 3 call sites; I can do that fix at the same time.",
  "This file has a circular import:\n\n```\nuser.ts → auth.ts → session.ts → user.ts\n```\n\nIt works today because of hoisting, but it'll break the moment someone moves the `import` statement. Fix: extract the shared types into a new `types.ts` and re-import from there.",
  "For the concurrency issue you described, the fix is probably one of these three:\n\n1. **Mutex** — simplest, lowest throughput\n2. **Optimistic lock** (version column) — higher throughput, retries on conflict\n3. **Queue** — serialize externally\n\nYour workload has a low conflict rate, so I'd go with optimistic locking.",
  "That looks like a **use-after-free** in the disposal logic. `close()` sets `this.sock = null`, but `send()` doesn't re-check before writing.\n\nAny buffered `send()` between `close()` and the next tick will throw `TypeError: Cannot read properties of null`. Classic.",
  "Traced the permission check chain. The request hits:\n\n```\nauthMiddleware → rbacMiddleware → routeGuard → handler\n```\n\nBut `routeGuard` short-circuits on `user.admin === true` **without** verifying the token's `aud` claim. That's how an expired admin token still passes — you've got an auth bypass for stale admin sessions.",
  "The compiler is rejecting that because `Order` and `DraftOrder` are structurally similar but have different discriminants:\n\n- `Order.status: \"placed\"`\n- `DraftOrder.status: \"draft\"`\n\nTypeScript's narrowing won't let you assign one to the other directly. You need either a type guard or an explicit mapping function.",
  "Running test impact analysis on your branch:\n\n- **Tests that must re-run:** 42\n- **Tests that can be skipped:** 318\n- **Estimated CI time:** 2m 14s (vs. 9m for a full run)\n\nI can wire this into a `--since` flag for your test runner if you want to make it automatic.",
  "You're hitting the **10k connection cap** on the DB pool. Each worker opens 200 connections at peak, and you're running 52 workers → 10,400.\n\nTwo options: raise the cap (cheap, short-term), or put PgBouncer in transaction mode in front (proper fix). The latter also cuts idle memory significantly.",
  "Here's what `compact()` is doing under the hood:\n\n1. Walks the message history oldest-first\n2. Drops entries older than `maxAge`\n3. Merges adjacent `assistant` turns if the tool calls are empty\n4. Recomputes the token count\n\nThe gotcha: step 3 merges across **different model outputs**, which can blur provenance for debugging.",
  "I inspected the build output:\n\n- **Bundle size:** 284 KB (gzipped: 89 KB)\n- **Heaviest module:** `lodash-es` at 41 KB — but tree-shaking isn't fully working because of a `require()` in `utils/debounce.ts`\n- **Duplicate deps:** 2 copies of `buffer` (one from `node-fetch`, one direct)\n\nFixing the lodash import style would save ~28 KB.",
  "That panic is happening because the slice is being mutated while iterated. In Go:\n\n```go\nfor i, v := range items {\n    if shouldRemove(v) {\n        items = append(items[:i], items[i+1:]...) // ← bad\n    }\n}\n```\n\nCollect indices first, then remove in reverse. Or build a new slice — usually cleaner.",
  "Found the memory leak. Every request registers a listener on the process-wide event emitter but never removes it on response end. Over ~6 hours of traffic, that's roughly 2M dangling closures, each holding a reference to the request context.\n\nFix: `emitter.once()` instead of `emitter.on()`, or explicit `off()` in the `finally` block.",
  "The migration is idempotent except for one step: `ALTER TABLE ... ADD CONSTRAINT`. Postgres doesn't support `IF NOT EXISTS` there in your version.\n\nWrap it in a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block and it becomes safely re-runnable.",
  "I'd guess this is a caching issue. The ETag logic:\n\n```\nif (req.headers['if-none-match'] === etag) return 304\n```\n\n...compares against a variable that was computed **before** the body was serialized. If the body changes between computation and send, the ETag lies and clients get stale content.",
  "For a one-off script, I'd skip the framework entirely — it's ~40 lines of plain Node + a `for await` loop. Using the service layer brings in the full DI container and roughly 800ms of startup cost for no benefit at this scale.",
  "Counts for that grep across the whole repo:\n\n- `@deprecated` — 47 occurrences\n- `TODO` — 311\n- `FIXME` — 28\n- `HACK` — 6\n- `// eslint-disable` — 82\n\nThe HACKs are concentrated in one file (`legacy-import.ts`). Might be worth a dedicated cleanup pass.",
  "That component re-renders on every parent render because the `options` prop is a new object literal each time. Wrap it in `useMemo` at the caller, or switch the prop to accept a stable reference.\n\nRight now you're paying ~4ms per keystroke for that subtree.",
  "For load testing this endpoint, I'd start with:\n\n- **10 RPS** for 60s (smoke)\n- **100 RPS** for 5 min (soak)\n- **500 RPS** burst for 30s (spike)\n\nWatch P99 latency and DB connection count. You'll see the pool exhaust well before the CPU does — that's your real limit.",
  "Running static analysis on the diff:\n\n- **0** new lint errors\n- **2** new warnings (unused imports in `utils/date.ts`)\n- **1** type-check failure: `string | undefined` not assignable to `string` at `user.ts:88`\n\nThe type failure is real — that field is optional in the schema.",
  "The race condition is between `watcher.emit('change')` and the debounce timer on the other side. Under load, the debounce reference resets mid-flush so a late event replaces the in-flight one.\n\nFix: capture the batch into a local `const` before awaiting anything downstream.",
  "I'd model that as a state machine. There are 4 states: `idle`, `loading`, `success`, `error`. The current code uses 3 booleans (`isLoading`, `isError`, `isSuccess`) which allows 8 combinations — 4 of which are invalid.\n\nA discriminated union prevents those invalid states at the type level.",
  "Spec file looks correct but the assertion order is brittle:\n\n```\nexpect(result.items[0].id).toBe(\"a\")\n```\n\n...depends on DB insertion order. If you ever switch to a parallel test DB, this flakes. Use `toContain` or sort before asserting.",
  "Ran the rollout simulator for that config change:\n\n- **Affected users:** ~18,400 (0.9% of MAU)\n- **Estimated latency hit:** +12ms P99\n- **Estimated cost hit:** +$0.03/req on the premium tier\n\nWell within budget, but you'll want to pre-warm the cache before the first batch.",
  "The retry backoff is too aggressive for your downstream SLA. You're waiting `2^n * 100ms`, which hits **51 seconds** by attempt 8 — longer than the client's 30s timeout, so the retry is effectively wasted.\n\nCap at `min(backoff, 5000)` and you'll stay inside the window.",
  "For observability on this worker, minimum I'd instrument:\n\n- **Counter:** jobs processed, by outcome (success/fail/skipped)\n- **Histogram:** job duration\n- **Gauge:** in-flight jobs\n- **Log:** structured entry per job with `trace_id`\n\nThat's enough to chase any incident without being expensive.",
  "The query planner is doing a full table scan because the `WHERE` clause uses `LOWER(email) = ?`. The index on `email` is case-sensitive, so it doesn't apply.\n\nOptions: add a functional index on `LOWER(email)`, or store the email lowercased at write time and drop the `LOWER()` at read time. The latter is simpler.",
  "Doesn't look like a bug — looks like config drift. Staging has `WORKER_CONCURRENCY=4`, production has it unset (defaulting to 1).\n\nThat's why staging handles the burst cleanly and prod piles up. One-line fix in the prod env file.",
  "Quick sanity check on your branch: **you forgot to run the formatter.** 14 files have style-only drift. Not a blocker, but CI will complain.\n\nI can format them in a separate commit so the review diff stays clean.",
];

export function createInitialSessions(): ChatSession[] {
  return [
    { id: "s1", projectId: "openagent-sdk", title: "Code understanding logic", time: "2h ago", messages: [] },
    { id: "s2", projectId: "openagent-sdk", title: "Doom loop, compaction, and hook system", time: "5h ago", messages: [] },
    { id: "s3", projectId: "openagent-sdk", title: "Project code", time: "1d ago", messages: [] },

    { id: "s4", projectId: "forgecode", title: "Project LoC testing and domain traits", time: "3h ago", messages: [] },
    { id: "s5", projectId: "forgecode", title: "ForgeCode agent loop evaluation", time: "6h ago", messages: [] },

    { id: "s6", projectId: "home", title: "Casual greeting", time: "1d ago", messages: [] },
    { id: "s7", projectId: "home", title: "Casual greeting", time: "2d ago", messages: [] },

    {
      id: "s8",
      projectId: "kilo-org/kilocode",
      title: "Agent loop code repository location",
      time: "35s",
      branch: "main",
      messages: [
        { id: "m1", role: "user", text: "is forge better" },
        {
          id: "m2",
          role: "agent",
          text:
            "It's hard to answer \"is Forge better?\" in one line — it splits along several axes.\n\n- **On the terminal-bench CLI axis**, in the current `terminalbench` format ForgeCode looks favorable, and their docs point to a compact single-stream request loop (actual context) as a direct competitive lever.\n- **For the in-editor experience** — once you factor in team products (**Kilo**-adjacent / editor context), **Kilocode** is often the better pick.\n- **For open-source forkability**, Kilo is a thin shell layered on top of **opencode** — simple, but that's not inherently bad; it's a familiar extend-vs-own tradeoff.\n\nSo: **\"if you only look at terminal-agent tooling on benchmarks, Forge looks favorable\"** is fair, but **\"Forge is better overall\"** depends on who's using it and where.",
        },
      ],
    },
    { id: "s9", projectId: "kilo-org/kilocode", title: "LLM and prompt caching implementation", time: "12h ago", messages: [] },

    { id: "s10", projectId: "jsongmin/quanta-ide", title: "Git activity trends for the last three weeks", time: "1h ago", messages: [] },
    { id: "s11", projectId: "jsongmin/quanta-ide", title: "Git add, commit, and push process", time: "4h ago", messages: [] },

    { id: "s12", projectId: "leeyes1/claude-code-sourcemap", title: "Java dependency audit", time: "2d ago", messages: [] },
  ];
}
