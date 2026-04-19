import type { FeatureDescriptor } from "../feature-registry-types";

// Archaeology (T3) — drift detection, cycle genesis, symbol first
// appearance, smell genesis, and debt trajectory. Surfaces that trawl
// history to explain how the current codebase got this way.
export const archaeologyFeatures: readonly FeatureDescriptor[] = [
  {
    id: "archaeology.panel",
    category: "archaeology",
    label: "Archaeology HUD panel",
    description: "Collapsible debug-HUD section surfacing drift findings, cycle genesis, smell genesis, and debt trajectory in one place.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t3",
  },
  {
    id: "archaeology.driftDetector",
    category: "archaeology",
    label: "Architectural drift detector",
    description: "Compare two snapshots and surface layer escalations, fanout spikes, new cycle members, and ownership shifts.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t3",
  },
  {
    id: "archaeology.cycleGenesis",
    category: "archaeology",
    label: "Cycle genesis lookup",
    description: "For any active SCC, identify the commit and edge that first closed the cycle.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t3",
  },
  {
    id: "archaeology.symbolFirstAppearance",
    category: "archaeology",
    label: "Symbol first appearance",
    description: "Walk history to find the earliest commit that introduced a given symbol at a file.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t3",
  },
  {
    id: "archaeology.smellGenesis",
    category: "archaeology",
    label: "Smell genesis",
    description: "Locate the first commit where a file exhibits a code smell (high coupling, cycle member, risk spike, layer violation).",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t3",
  },
  {
    id: "archaeology.debtTrajectory",
    category: "archaeology",
    label: "Debt trajectory chart",
    description: "Timeseries of SCC count, arch violations, and complexity across recorded history — click a point to jump.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "t3",
  },
];
