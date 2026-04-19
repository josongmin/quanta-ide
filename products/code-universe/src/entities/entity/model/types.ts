// Re-export the engine's entity model verbatim so the rest of the
// product imports `Entity` from `@/entities/entity`, not directly from
// `@quanta/canvas-engine`. Keeping the engine type import localised
// at the slice boundary makes it easy to swap in a product-specific
// augmented Entity later (e.g. UI-only fields like `isPinned`)
// without ripple-refactoring every consumer.
export type {
  Entity,
  EntityKind,
  EntityMetrics,
  EntityTree,
} from "@quanta/canvas-engine";
export { ENTITY_DEPTH, buildEntityTree } from "@quanta/canvas-engine";
