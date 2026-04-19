# pages/

FSD layer 5 (below app, above widgets).

A page composes widgets into a complete screen bound to a route.
Code Universe currently has one implicit page (the canvas itself), so
this layer may stay empty until multi-view is added (e.g. a list-mode
fallback, a print view).

**Can import from:** widgets, features, entities, shared, any lib.
**Cannot import from:** app, or sibling pages.
**Public API:** each page exports a single React component via its
`index.ts`.
