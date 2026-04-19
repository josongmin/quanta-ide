import type { FeatureDescriptor } from "../feature-registry-types";

// Action Terrain (Batch 9) — isometric 3D-style canvas with ROI-based
// terrain heights, blast/fix cones, and before/after simulation. Heavy
// (30fps target), so every flag defaults OFF.
export const actionTerrainFeatures: readonly FeatureDescriptor[] = [
  {
    id: "action-terrain.mode",
    category: "actionTerrain",
    label: "Action Terrain mode",
    description: "Isometric 3D-style mode — extruded bars where height = refactor ROI. Cmd+Shift+A to toggle.",
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-9",
  },
  {
    id: "action-terrain.leverage-topography",
    category: "actionTerrain",
    label: "Leverage topography",
    description: "Bar height encodes composite refactor-ROI score (churn × complexity × fan-in × test-debt × cycle-membership).",
    defaultEnabled: true,
    maturity: "experimental",
    dependsOn: ["action-terrain.mode"],
    introducedIn: "batch-9",
  },
  {
    id: "action-terrain.blast-fix-cone",
    category: "actionTerrain",
    label: "Blast / fix cone",
    description: "Click a file to see upward blast (change-breaks) and downward fix (change-stabilizes) cones.",
    defaultEnabled: true,
    maturity: "experimental",
    dependsOn: ["action-terrain.mode"],
    introducedIn: "batch-9",
  },
  {
    id: "action-terrain.before-after-sim",
    category: "actionTerrain",
    label: "Before / after simulation",
    description: "Apply an AI-suggested refactor and see projected terrain delta numerically.",
    defaultEnabled: true,
    maturity: "experimental",
    dependsOn: ["action-terrain.mode"],
    introducedIn: "batch-9",
  },
];
