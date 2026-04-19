import type { FeatureDescriptor } from "../feature-registry-types";

// Temporal — history foundation (T1), time-travel UI (T2), and temporal AI
// (T4). Intentionally split into two exports because the canonical
// `FEATURE_REGISTRY` order interleaves archaeology (T3) between the T1/T2
// block and the T4 block. Keeping them as two arrays is the only way to
// preserve the exact historical ordering without flattening categories.

// ── T1 (data foundation) + T2 (time-travel UI). ─────────────────────
// These precede archaeology in registry order.
// `gitSource` defaults OFF — we keep the mock as the safe default until the
// real git backend is validated against the user's repo.
export const temporalT1T2Features: readonly FeatureDescriptor[] = [
  {
    id: "temporal.gitSource",
    category: "temporal",
    label: "Use real git history (dev only)",
    description: "Swap the mock commit history for real git log output from the dev server. Requires the /__git/log endpoint.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "t1",
  },
  {
    id: "temporal.commitThumbnails",
    category: "temporal",
    label: "Per-commit canvas thumbnails",
    description: "Lazily capture + cache 160×96 previews of the canvas at each commit, shown in the film strip and dual-split picker.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t1",
  },
  {
    id: "temporal.filmStrip",
    category: "temporal",
    label: "Film strip scrubber",
    description: "Horizontal commit thumbnail strip at the bottom of the canvas — drag to scrub through time.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t2",
  },
  {
    id: "temporal.minimapStrip",
    category: "temporal",
    label: "Temporal minimap strip",
    description: "1px-tall commit-density strip under the minimap; column color = churn intensity.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t2",
  },
  {
    id: "temporal.dualSplit",
    category: "temporal",
    label: "Dual-commit split view",
    description: "Side-by-side canvas at two different commits with a diff overlay.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "t2",
  },
  {
    id: "temporal.blameTimeTravel",
    category: "temporal",
    label: "Blame time-travel",
    description: "Ground-card blame gutter rewinds to the active commit's timestamp.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t2",
  },
  {
    id: "temporal.dslExtensions",
    category: "temporal",
    label: "Temporal DSL extensions",
    description: "Filter DSL keys: added_since, stable_since, touched_by, churn, introduced_between.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t2",
  },
];

// ── T4 (temporal AI). ───────────────────────────────────────────────
// Follows archaeology (T3) in registry order.
export const temporalT4Features: readonly FeatureDescriptor[] = [
  {
    id: "temporal.regressionHunt",
    category: "temporal",
    label: "Regression hunt",
    description: "Paste a failing test + log; AI attributes the likely commit range and highlights affected files.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "time-travel",
  },
  {
    id: "temporal.refactorPreview",
    category: "temporal",
    label: "Refactor preview (30d)",
    description: "Linear-regression forecast of new files / edges / cycle-risk over the next 30 days.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "time-travel",
  },
  {
    id: "temporal.prReplay",
    category: "temporal",
    label: "PR replay mode",
    description: "Replay a PR commit-by-commit with camera targeting and per-commit narration.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "time-travel",
  },
  {
    id: "temporal.bisectGame",
    category: "temporal",
    label: "Bisect game",
    description: "Gamified bisect — narrow the bug to a single commit with yes/no/skip prompts.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "time-travel",
  },
  {
    id: "temporal.authorFootprint",
    category: "temporal",
    label: "Author footprint tint",
    description: "Tint each file card by the dominant author who touched it at the active commit.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "time-travel",
  },
];
