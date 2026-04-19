import type { FeatureDescriptor } from "../feature-registry-types";

// Navigation (Batch 5) — canvas pages, named views / bookmarks, storyboard
// playback, and prebuilt templates. `nav.pages` + `nav.bookmarks` default ON.
export const navFeatures: readonly FeatureDescriptor[] = [
  {
    id: "nav.pages",
    category: "navigation",
    label: "Canvas pages",
    description: "Figma-style multi-page canvas — switch between independent canvases with their own viewport + selection.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-5",
  },
  {
    id: "nav.bookmarks",
    category: "navigation",
    label: "Named views",
    description: "Saved cameras / bookmarks per page — click a thumbnail to restore camera + filters.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-5",
  },
  {
    id: "nav.storyboard",
    category: "navigation",
    label: "Storyboard playback",
    description: "Play through the current page's bookmarks like a presentation (play / pause / speed).",
    defaultEnabled: false,
    maturity: "beta",
    dependsOn: ["nav.bookmarks"],
    introducedIn: "batch-5",
  },
  {
    id: "nav.templates",
    category: "navigation",
    label: "Canvas templates",
    description: "Prebuilt scenario pages (security review, onboarding, post-mortem, architecture).",
    defaultEnabled: false,
    maturity: "beta",
    dependsOn: ["nav.pages", "nav.bookmarks"],
    introducedIn: "batch-5",
  },
];
