/** Public API surface delta vs. a baseline (last release / main). */
export interface ApiDrift {
  added: number;
  removed: number;
  deprecated: number;
  /** Semver-ish bump suggestion: "patch" | "minor" | "major". */
  bumpHint?: "patch" | "minor" | "major";
}
