# shared/

FSD layer 1 (the bottom). Reusable primitives scoped to THIS product.
If something is reusable across products, it belongs in `libs/` at the
repo root instead.

Unlike other layers, `shared/` has **no slices** — it's sub-divided by
*kind*:

```
shared/
├── ui/      dumb presentational primitives (Spinner, Divider, ...)
├── lib/     hooks, utils, adapters
├── config/  constants, feature flags (this product only)
└── api/     adapter code that wraps external libs (e.g. engine facades)
```

**Can import from:** any lib.
**Cannot import from:** app, pages, widgets, features, entities.
Shared never reaches up; it only provides.
