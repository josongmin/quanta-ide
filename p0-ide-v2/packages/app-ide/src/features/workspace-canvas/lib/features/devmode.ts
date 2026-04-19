import type { FeatureDescriptor } from "../feature-registry-types";

// Dev Mode (Batch 2) — inspector sidebar + hover summary + copy-as / export
// / measure utilities.
export const devmodeFeatures: readonly FeatureDescriptor[] = [
  {
    id: "devmode.inspector",
    category: "devmode",
    label: "Right-sidebar inspector",
    description: "Per-file metadata panel (imports / callers / cpx / owner / CI).",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-2",
  },
  {
    id: "devmode.hoverSummary",
    category: "devmode",
    label: "Hover AI summary",
    description: "300ms hover → LLM 1-line file summary popover.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-2",
  },
  {
    id: "devmode.copyAs",
    category: "devmode",
    label: "Copy-as menu",
    description: "Copy file path / share URL / Mermaid / DOT from the inspector.",
    defaultEnabled: false,
    maturity: "stable",
    dependsOn: ["devmode.inspector"],
    introducedIn: "batch-2",
  },
  {
    id: "devmode.export",
    category: "devmode",
    label: "Export view",
    description: "Export current canvas view as PNG / SVG.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-2",
  },
  {
    id: "devmode.measure",
    category: "devmode",
    label: "Measure mode",
    description: "Two-file pick → shared deps + shortest path + edge count.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-2",
  },
];
