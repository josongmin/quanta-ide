# features/

FSD layer 3 (below widgets, above entities).

User-facing scenarios that change state or drive interaction. Examples
planned for Phase 3+:

- `tier-switch/` — animate camera + swap renderer when LOD threshold is crossed
- `edge-interaction/` — hover/select/cmd+click on edges, dispatches to entity store
- `navigation/` — zoom-to-fit, breadcrumb drill, keyboard jumps
- `selection/` — single/multi-select, lasso
- `sticky-notes/`, `comments/` — optional social overlays (port from legacy)

Each feature lives in its own slice:
```
features/<feature-name>/
├── model/          stores, hooks, business logic
├── ui/             React components specific to this feature
├── lib/            feature-local helpers
└── index.ts        ← the ONLY file consumers outside this slice import
```

**Can import from:** entities, shared, any lib.
**Cannot import from:** app, pages, widgets, or sibling features.
Crossing features = refactor the shared bit down to entities or shared.
**Public API:** `index.ts` re-exports the feature's public surface.
