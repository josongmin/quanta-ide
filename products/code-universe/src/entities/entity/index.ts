// Public API of the `entities/entity` slice.
// Only exports listed here may be imported from outside the slice;
// `./model/internal-*.ts` (if any) stay private. FSD slice isolation
// is enforced by the root Semgrep rule `fsd-no-cross-entity-internal`.
export type {
  Entity,
  EntityKind,
  EntityMetrics,
  EntityTree,
} from "./model/types";
export { ENTITY_DEPTH, buildEntityTree } from "./model/types";
export {
  entityStore,
  useEntityState,
  type EntityInteraction,
  type EntityState,
} from "./model/store";
