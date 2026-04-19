import type { FeatureDescriptor } from "../feature-registry-types";

// Power user (Batch 7) — command palette, lasso select, smooth camera, zoom
// lens, theme switcher. Cmd+K, smooth camera, and theme switcher default ON
// as expected UX.
export const powerFeatures: readonly FeatureDescriptor[] = [
  {
    id: "power.commandPalette",
    category: "power",
    label: "Command palette",
    description: "Cmd+K / Ctrl+K fuzzy-matched command palette — files, actions, features, bookmarks, stickies.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-7",
  },
  {
    id: "power.lasso",
    category: "power",
    label: "Multi-select lasso",
    description: "Shift+drag on empty canvas to rectangle-select file cards; bulk action toolbar while selection is non-empty.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-7",
  },
  {
    id: "power.smoothCamera",
    category: "power",
    label: "Smooth camera transitions",
    description: "Eased pan/zoom for cluster click, double-click fit, bookmark jumps, and palette navigation.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-7",
  },
  {
    id: "power.zoomLens",
    category: "power",
    label: "Zoom lens magnifier",
    description: "Hold Z to magnify under the cursor with a circular lens — 2x extra zoom over the canvas.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-7",
  },
  {
    id: "power.themeSwitcher",
    category: "power",
    label: "Theme switcher",
    description: "Switch between dark, light, and high-contrast themes — persisted to localStorage.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-7",
  },
];
