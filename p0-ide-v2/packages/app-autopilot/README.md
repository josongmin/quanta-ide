# app-autopilot

Autonomous Repo Engineer (ARE) surface.

Index-level entry point for **Goals / WorkItems / Runs / Proofs / Opportunities / Operators / Snapshot**. Frontend-first exploratory implementation — all data is mock fixtures, no real execution.

See `docs/rfc/2026-04-23-autonomous-repo-engine.md` for the conceptual model.

## Package boundary

- This app only renders the ARE **index layer** — per-domain surfaces are delegated to sibling apps via `tabBus`:
  - Proof detail → (future) `app-reviews` / `app-pr`
  - Policy editing → `app-policy`
  - Operator: rule_repair → `app-rules`

## FSD layout

```
entities/
  goal/         policy/     autonomy/    metric/
  work-item/    run/        proof/       snapshot/
  operator/     opportunity/ inbox/
shared/
  ui/primitives/   Button, Chip, Badge, StatDot, Kbd, ...
  ui/viz/          MetricDelta, Sparkline, Gauge, Timeline, AutonomyLadder, ProofBadge
  lib/             id, time, format utilities
stores/          subscriber stores (useSyncExternalStore)
widgets/nav-rail/   left-hand nav
pages/
  overview/    goals/      goal-detail/   runs/      run-detail/
  proof-detail/   workitems/  opportunities/  operators/  snapshot/
```

Do not reach into sibling slice internals. Always go through the slice `index.ts`.
