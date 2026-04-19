# entities/

FSD layer 2 (below features, above shared).

Business entities — the nouns of the Code Universe domain. Phase 3
plans:

- `entity/`   — the hierarchical `Entity` model (repo / package / dir /
                file / module / fn), parent/child links, kind enum.
                Replaces `FileNode` as the canonical unit.
- `tier/`     — `TierSpec` contract, tier ladder config, `visibleKind`
                + `edgeProjector` signatures.
- `edge-view/`— tier-aware edge projection (file-edge → dir-edge rollup).
- `workspace/`— workspace/graph aggregate, metrics rollups, coord system.

Each entity lives in its own slice, same shape as features:
```
entities/<entity-name>/
├── model/       types, stores, derivations
├── ui/          optional: tiny primitive renderers bound to the entity
├── lib/         pure helpers
└── index.ts     ← the ONLY public surface
```

**Can import from:** shared, any lib.
**Cannot import from:** app, pages, widgets, features, or sibling entities.
Cross-entity coupling belongs in features, not entities. Two entities
that seem to want each other probably share a concept that should be
extracted into `shared/` or into one of the underlying libs.
