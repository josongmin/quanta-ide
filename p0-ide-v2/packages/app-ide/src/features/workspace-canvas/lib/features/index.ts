// Merges all category-scoped feature arrays into the canonical
// FEATURE_REGISTRY. Register a new category by adding its file to
// /features and appending its export here. Do NOT scatter features
// across multiple arrays in one category file — the only exception is
// `temporal`, which predates archaeology and must be spliced around it
// to keep registry ordering byte-identical with the pre-split monolith.

import type { FeatureDescriptor } from "../feature-registry-types";
import { collabFeatures } from "./collab";
import { annotationFeatures } from "./annotation";
import { devmodeFeatures } from "./devmode";
import { reviewFeatures } from "./review";
import { navFeatures } from "./nav";
import { powerFeatures } from "./power";
import { embedsFeatures } from "./embeds";
import { aiFeatures } from "./ai";
import { temporalT1T2Features, temporalT4Features } from "./temporal";
import { archaeologyFeatures } from "./archaeology";
import { actionTerrainFeatures } from "./action-terrain";

// Canonical feature list. Ordered by category then introduction.
// Keep ids stable forever — they serialize into URL share state and user
// preferences. The archaeology block is sandwiched between temporal-T1/T2
// and temporal-T4 to preserve the exact order of the pre-split registry.
export const FEATURE_REGISTRY: readonly FeatureDescriptor[] = [
  ...collabFeatures,
  ...annotationFeatures,
  ...devmodeFeatures,
  ...reviewFeatures,
  ...navFeatures,
  ...powerFeatures,
  ...embedsFeatures,
  ...aiFeatures,
  ...temporalT1T2Features,
  ...archaeologyFeatures,
  ...temporalT4Features,
  ...actionTerrainFeatures,
];

/** Fast id → descriptor lookup. */
export const FEATURE_BY_ID: ReadonlyMap<string, FeatureDescriptor> = new Map(
  FEATURE_REGISTRY.map(f => [f.id, f]),
);
