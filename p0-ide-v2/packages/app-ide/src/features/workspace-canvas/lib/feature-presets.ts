// Feature presets — curated bundles layered on top of the feature-flag
// registry. Each preset declares an explicit list of feature ids (plus
// optional glob forms) that should be enabled; everything else in the
// registry is disabled. Applying a preset is a single atomic write:
// the store is replaced with the computed flag set and persisted.
//
// This exists because the raw registry has ~50+ toggles across 11
// categories — far too many to discover one-by-one. Presets give users
// a one-click entry point ("Code Reviewer", "Onboarding Tour", etc.)
// while keeping the underlying flag system as the ground truth.
//
// Glob forms supported in a preset's `features` list:
//   "overlay.*" — every registered feature whose id starts with `overlay.`
//   "*"         — every feature whose maturity is `stable` or `beta`
//                 (experimental features stay OFF — they can bite).
//
// Round-trip:
//   applyPreset(id)        — enable preset features, disable all others.
//   inferActivePreset()    — return the preset id whose resolved feature
//                            set exactly matches the current flags, or
//                            null if no preset matches. Used for the HUD
//                            "active preset" highlight and URL compaction.

import { FEATURE_REGISTRY, FEATURE_BY_ID, type FeatureDescriptor } from "./feature-registry";
import { featureFlagsStore } from "../store/feature-flags-store";

export interface FeaturePreset {
  id: string;
  label: string;
  description: string;
  /** Feature ids to enable. All others → disabled. */
  features: readonly string[];
  /** Optional ordering hint for UI. */
  order: number;
}

// ── Preset definitions ──────────────────────────────────────────────
// Feature ids below must exist in feature-registry.ts. We reference by
// stable id; the `overlay.*` glob is kept for forward compat even though
// no overlay.* features exist yet — it resolves to an empty set today.
export const FEATURE_PRESETS: readonly FeaturePreset[] = [
  {
    id: "minimal",
    label: "Minimal",
    description:
      "Fastest. Core canvas + basic overlays. No AI, no collab, no annotation.",
    order: 10,
    features: [
      // Only existing overlay.* features (today: none), plus the
      // command palette — the one QoL shortcut we always want.
      "overlay.*",
      "power.commandPalette",
      "power.themeSwitcher",
    ],
  },
  {
    id: "reviewer",
    label: "Code Reviewer",
    description:
      "PR review mode. Inspector, comments, reactions, dot voting, estimation poker, measure.",
    order: 20,
    features: [
      "overlay.*",
      "collab.presence",
      "collab.comments",
      "collab.reactions",
      "review.voting",
      "review.poker",
      "devmode.inspector",
      "devmode.copyAs",
      "devmode.measure",
      "devmode.export",
      "power.commandPalette",
      "power.lasso",
      "embeds.prBadge",
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding Tour",
    description:
      "New contributor first-look. AI tour, hover summaries, pages and bookmarks.",
    order: 30,
    features: [
      "overlay.*",
      "ai.repoTour",
      "devmode.hoverSummary",
      "devmode.inspector",
      "nav.pages",
      "nav.bookmarks",
      "nav.storyboard",
      "nav.templates",
      "power.commandPalette",
      "power.smoothCamera",
      "power.themeSwitcher",
    ],
  },
  {
    id: "architect",
    label: "Architect",
    description:
      "Structure + temporal. Drift detector, cycle genesis, debt trajectory, temporal scrubber, dual split.",
    order: 40,
    features: [
      "overlay.*",
      "archaeology.panel",
      "archaeology.driftDetector",
      "archaeology.cycleGenesis",
      "archaeology.smellGenesis",
      "archaeology.symbolFirstAppearance",
      "archaeology.debtTrajectory",
      "temporal.commitThumbnails",
      "temporal.filmStrip",
      "temporal.minimapStrip",
      "temporal.dualSplit",
      "temporal.blameTimeTravel",
      "temporal.dslExtensions",
      "devmode.inspector",
      "power.commandPalette",
      "power.smoothCamera",
    ],
  },
  {
    id: "perf-audit",
    label: "Perf Audit",
    description:
      "Hot paths + traces + runtime overlay. Low visual noise, high data density.",
    order: 50,
    features: [
      "overlay.*",
      "devmode.inspector",
      "devmode.measure",
      "ai.anomalyAlerts",
      "archaeology.debtTrajectory",
      "power.commandPalette",
      "power.smoothCamera",
    ],
  },
  {
    id: "demo",
    label: "Demo (Full Stack)",
    description:
      "Every stable and beta feature on. Heavy — 30fps target. Experimental stays off.",
    order: 60,
    features: ["*"],
  },
  {
    id: "collab-live",
    label: "Collab Live",
    description:
      "Multiplayer session. Cursors, follow, comments, reactions, annotations.",
    order: 70,
    features: [
      "overlay.*",
      "collab.presence",
      "collab.cursors",
      "collab.follow",
      "collab.comments",
      "collab.reactions",
      "collab.lock",
      "annotation.toolbar",
      "annotation.pen",
      "annotation.text",
      "annotation.shape",
      "annotation.connector",
      "annotation.frame",
      "power.commandPalette",
      "power.smoothCamera",
    ],
  },
] as const;

export const PRESET_BY_ID: ReadonlyMap<string, FeaturePreset> = new Map(
  FEATURE_PRESETS.map(p => [p.id, p]),
);

/**
 * Resolve a preset's `features` list (with glob patterns) to a concrete
 * set of feature ids that exist in the registry.
 *
 *   "overlay.*" → every feature with id starting `overlay.`
 *   "*"         → every feature with maturity `stable` or `beta`
 *
 * Unknown ids are skipped (preset authoring errors shouldn't crash).
 */
export function resolvePresetFeatureSet(preset: FeaturePreset): Set<string> {
  const out = new Set<string>();
  for (const token of preset.features) {
    if (token === "*") {
      for (const f of FEATURE_REGISTRY) {
        if (f.maturity === "stable" || f.maturity === "beta") out.add(f.id);
      }
      continue;
    }
    if (token.endsWith(".*")) {
      const prefix = token.slice(0, -1); // keep trailing "."
      for (const f of FEATURE_REGISTRY) {
        if (f.id.startsWith(prefix)) out.add(f.id);
      }
      continue;
    }
    // Literal id — verify it exists before adding.
    if (FEATURE_REGISTRY.some(f => f.id === token)) out.add(token);
  }
  // Close the set under `dependsOn` so a preset that forgets to list a
  // dep still produces a valid flag configuration. Without this, the
  // preset could turn a feature on while its dep stays off — same
  // "silent no-op toggle" failure mode we guard against in setFlag.
  const pending = [...out];
  while (pending.length > 0) {
    const id = pending.pop()!;
    const desc = FEATURE_BY_ID.get(id);
    if (!desc?.dependsOn) continue;
    for (const dep of desc.dependsOn) {
      if (!out.has(dep)) {
        out.add(dep);
        pending.push(dep);
      }
    }
  }
  return out;
}

/**
 * Apply a preset atomically: enable every feature in the resolved set,
 * disable every other registered feature. Persists via the flags store.
 * No-op if the preset id is unknown.
 */
export function applyPreset(presetId: string): void {
  const preset = PRESET_BY_ID.get(presetId);
  if (!preset) return;
  const enabled = resolvePresetFeatureSet(preset);
  const next: Record<string, boolean> = {};
  for (const f of FEATURE_REGISTRY) next[f.id] = enabled.has(f.id);
  featureFlagsStore.replaceFlags(next);
}

/**
 * Compare current flag state against each preset. Returns the preset id
 * whose resolved feature set matches exactly, or null if none match.
 * Used by the HUD to highlight the active chip, and by the URL encoder
 * to shrink share URLs ("preset=reviewer" instead of 50 flag fields).
 */
export function inferActivePreset(): string | null {
  const flags = featureFlagsStore.getState().flags;
  for (const preset of FEATURE_PRESETS) {
    const resolved = resolvePresetFeatureSet(preset);
    let match = true;
    for (const f of FEATURE_REGISTRY) {
      const should = resolved.has(f.id);
      const actual = flags[f.id] === true;
      if (should !== actual) { match = false; break; }
    }
    if (match) return preset.id;
  }
  return null;
}

/** Readonly view of all preset descriptors (for HUD iteration). */
export function listPresets(): readonly FeaturePreset[] {
  return [...FEATURE_PRESETS].sort((a, b) => a.order - b.order);
}

// Re-export FeatureDescriptor in case a caller needs it from here.
export type { FeatureDescriptor };
