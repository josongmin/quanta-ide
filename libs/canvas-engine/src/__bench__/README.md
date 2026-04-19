# canvas-engine bench

Performance benchmarks for canvas-engine at 5k-file scale. Uses vitest's
`bench` API (part of the core vitest install — no extra dependency).

## What's covered

| Bench | What it measures | Budget |
| --- | --- | --- |
| `gridLayout 5k files` | Column-packed layout used for small graphs; sanity check on the same budget | 500 ms |
| `treemapLayout 5k files` | Production layout path past `TREEMAP_THRESHOLD` (≥100 files) | 500 ms |
| `computeWorkspaceMetrics 5k (betweenness off)` | Degree counts + top-K sort (the HUD's hot path) | 50 ms |
| `computeRefactorROI 5k` | Action-Terrain re-score on worker boundary | 50 ms |
| `cross-graph flash loop 5k` | The Map-optimised O(E + F) loop that replaced the O(E × F) hot path in `useCrossGraphFlash` | linear in E + F |

Budgets are documented here — they are **not** enforced as assertions.
Vitest `bench` records per-iteration timing; CI should read the JSON
output and fail when the mean exceeds the budget.

## Running

From the repo root:

```sh
cd p0-ide-v2 && bunx vitest bench --run
```

Watch mode:

```sh
cd p0-ide-v2 && bunx vitest bench
```

Filter to one bench:

```sh
cd p0-ide-v2 && bunx vitest bench --run canvas-5k
```

## When a budget is exceeded

1. Do **not** silently bump the budget. Open an issue with the measured
   numbers and a flamegraph if possible.
2. If the regression is environmental (CI runner change, Node version
   bump), note the baseline in the PR description.
3. Actual perf fixes belong in a separate change — this file is only the
   measurement surface.

## Synthetic graph

`synth.ts` exports `buildSynthGraph({ files, edgesPerFile, … })`. It
produces a deterministic `WorkspaceGraph` shaped like a real monorepo:

- `~sqrt(files)` top-level packages, six sub-dirs each (realistic treemap
  fanout).
- Long-tail function counts per file (1..12).
- 80% intra-cluster / 20% long-range edges.
- Planted cycles (3..6 node rings) so SCC and ROI's cycle axis have signal.
- 25% of files get blame entries spread across the last ~180 days.

Change the seed via `{ seed: 0xDEADBEEF }` to vary the synthetic graph.
Default seed is stable across runs.
