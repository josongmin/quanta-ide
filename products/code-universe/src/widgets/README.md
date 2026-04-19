# widgets/

FSD layer 4 (below pages, above features).

Compound UI blocks that combine multiple features + entities into a
self-contained piece of the interface. Phase 3 expects the main widget
here to be `CanvasShell` — the tier-switching canvas container that
orchestrates layout + renderer dispatch.

**Can import from:** features, entities, shared, any lib.
**Cannot import from:** app, pages, or sibling widgets.
**Public API:** each widget exports a React component via its
`index.ts`. No cross-widget internal imports — share via features/.
