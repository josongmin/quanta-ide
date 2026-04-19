# @quanta/code-universe

The multi-file code visualization surface. Mounted by the host web app
(`p0-ide-v2`) via the `/universe` route.

## Layering — Feature-Sliced Design

```
app ──> pages ──> widgets ──> features ──> entities ──> shared
                                                          │
                                                          └──> (libs/*)
```

Each arrow is a one-way import. Enforced by:

- ESLint `eslint-plugin-boundaries` — structural whitelist
- Semgrep `.semgrep/fsd-layers.yml` — patterns that block upward & lateral
  imports with a human-readable failure message

Slice rule within `features/` and `entities/`: only the slice's
`index.ts` is public. Reaching into `features/foo/model/internal.ts`
from outside the slice is a lint error.

## Why this layout

The legacy `app-ide/features/workspace-canvas/` grew into a 600-LoC
god-component because import boundaries weren't enforced. Same entity
(file node) behaved differently at different LOD tiers because hover
handlers in HTML cards silently drifted from the Pixi renderer's
callbacks. FSD makes those drifts impossible to merge: a new tier that
forgets to wire hover fails the boundary check.

## Phase roadmap

- **Phase 1 (done):** scaffold, FSD stubs, lint/semgrep rules
- **Phase 2:** extract reusable libs to `libs/` at repo root
- **Phase 3:** `Entity` hierarchical model + `TierSpec` + first tier
- **Phase 4:** remaining tier renderers (universe, galaxy, street,
  building, floor, room — mapping TBD)
- **Phase 5:** feature parity with legacy workspace-canvas, then sunset

## Not yet wired

- `libs/*` is empty. Libraries still live in `p0-ide-v2/packages/*`
  during Phase 1. The code below will import them via Vite alias through
  the host, not directly, until Phase 2 migrates them.
- No stores, no renderer registry, no interactions — Phase 3 work.
