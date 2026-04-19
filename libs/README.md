# libs/

Reusable libraries. Framework-free (domain-types), pure engine math
(canvas-engine), render primitives (canvas-pixi), design primitives
(ui-kit), product-agnostic chrome (shell).

Any `products/*` or `p0-ide-v2` may depend on a lib.
Libs **may not** depend on `products/*` or `p0-ide-v2`.
Libs **may not** depend on each other except downward:
`domain-types` ← `canvas-engine` ← `canvas-pixi` ← `ui-kit` ← `shell`.

## Phase 2 migration

The following are currently in `p0-ide-v2/packages/` and will move here:

- `canvas-engine`
- `canvas-pixi`
- `canvas-worker`
- `domain-types`
- `shell`
- `shell-contract`
- `ui-kit`

Not migrating (stays inside p0-ide-v2 — product-specific surfaces):

- `app-ide`, `app-agent`, `app-pr`, `app-reviews`, `app-rules`,
  `app-scenario`, `app-settings`, `app-home`, `app-policy`, `app-demo`
