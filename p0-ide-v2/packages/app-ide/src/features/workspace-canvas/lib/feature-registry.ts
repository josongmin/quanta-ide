// Feature registry — single source of truth for every toggleable feature
// in the workspace canvas. Each feature declares its metadata (id, label,
// default, dependencies, category) once here, and both the runtime gate
// (`useFeature(id)`) and the HUD's "features" tab read from the same list.
//
// This enables:
//   - user-level on/off for every experimental surface
//   - feature dependency checks (e.g., "realtime-cursors" requires "presence")
//   - preset bundles ("disable all collab", "experimental only")
//   - URL-shareable feature selection
//
// Adding a feature:
//   1. pick a category + stable id (kebab-case, never rename)
//   2. push to `FEATURE_REGISTRY` below
//   3. gate your code with `useFeature("your-id")` or `isFeatureEnabled("your-id")`

export type FeatureCategory =
  | "collab"      // multi-user presence, cursors, follow, comments, reactions
  | "annotation"  // drawing tools, frames, connectors, shapes
  | "devmode"     // right-sidebar inspector, export, copy-as, hover summary
  | "review"      // voting, estimation poker, timer, retrospective boards
  | "navigation"  // pages, bookmarks, storyboard, templates (Figma-style nav)
  | "power"       // command palette, lasso, smooth camera, zoom lens, theme switcher
  | "embeds"      // rich-media canvas embeds (image paste, tickets, PR, slack)
  | "overlay"     // existing visual overlays (kept as features for consistency)
  | "ai"          // AI-assisted helpers (summaries, clustering, tour)
  | "experimental"; // unproven / gated

export type FeatureMaturity = "stable" | "beta" | "experimental";

export interface FeatureDescriptor {
  id: string;
  category: FeatureCategory;
  label: string;
  description: string;
  defaultEnabled: boolean;
  maturity: FeatureMaturity;
  /** Hard requirements — disabling a dependency also disables this one. */
  dependsOn?: readonly string[];
  /** Indicates which roadmap batch delivered this feature (for changelog). */
  introducedIn?: string;
}

// ── Canonical feature list ─────────────────────────────────────────
// Ordered by category then introduction. Keep ids stable forever —
// they serialize into URL share state and user preferences.
export const FEATURE_REGISTRY: readonly FeatureDescriptor[] = [
  // ── Collab (Batch 1) ─────────────────────────────────────────────
  {
    id: "collab.presence",
    category: "collab",
    label: "Agent presence rings",
    description: "Pulsing rings around files each agent is currently viewing.",
    defaultEnabled: true,
    maturity: "stable",
    introducedIn: "stage-6",
  },
  {
    id: "collab.cursors",
    category: "collab",
    label: "Realtime cursors",
    description: "Other viewers' cursors rendered in world coords with name tags.",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["collab.presence"],
    introducedIn: "batch-1",
  },
  {
    id: "collab.follow",
    category: "collab",
    label: "Follow mode",
    description: "Snap your viewport to another viewer's camera.",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["collab.cursors"],
    introducedIn: "batch-1",
  },
  {
    id: "collab.comments",
    category: "collab",
    label: "Comment threads",
    description: "Pin threaded comments to files / edges with resolve + @mention.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-1",
  },
  {
    id: "collab.reactions",
    category: "collab",
    label: "Emoji reactions",
    description: "Drop quick emoji reactions on files, edges, or stickies.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-1",
  },
  {
    id: "collab.lock",
    category: "collab",
    label: "Lock element",
    description: "Prevent others from moving or editing a sticky / annotation.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-1",
  },

  // ── Annotation tools (Batch 3) ───────────────────────────────────
  {
    id: "annotation.toolbar",
    category: "annotation",
    label: "Annotation toolbar",
    description: "Floating toolbar with pen / text / shape / connector / laser / frame.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-3",
  },
  {
    id: "annotation.pen",
    category: "annotation",
    label: "Pen (freehand)",
    description: "Freehand pen strokes on canvas.",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["annotation.toolbar"],
    introducedIn: "batch-3",
  },
  {
    id: "annotation.text",
    category: "annotation",
    label: "Text labels",
    description: "Lightweight world-positioned text (simpler than stickies).",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["annotation.toolbar"],
    introducedIn: "batch-3",
  },
  {
    id: "annotation.shape",
    category: "annotation",
    label: "Shapes",
    description: "Rect / circle / arrow shapes for emphasis.",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["annotation.toolbar"],
    introducedIn: "batch-3",
  },
  {
    id: "annotation.connector",
    category: "annotation",
    label: "User connectors",
    description: "Hand-drawn arrows between elements (separate from engine edges).",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["annotation.toolbar"],
    introducedIn: "batch-3",
  },
  {
    id: "annotation.laser",
    category: "annotation",
    label: "Laser pointer",
    description: "Presentation-mode fading laser cursor trail.",
    defaultEnabled: true,
    maturity: "experimental",
    dependsOn: ["annotation.toolbar"],
    introducedIn: "batch-3",
  },
  {
    id: "annotation.frame",
    category: "annotation",
    label: "Frames",
    description: "Labeled bounding-box group around N files.",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["annotation.toolbar"],
    introducedIn: "batch-3",
  },

  // ── Dev Mode (Batch 2) ───────────────────────────────────────────
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
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-2",
  },
  {
    id: "devmode.copyAs",
    category: "devmode",
    label: "Copy-as menu",
    description: "Copy file path / share URL / Mermaid / DOT from the inspector.",
    defaultEnabled: true,
    maturity: "stable",
    dependsOn: ["devmode.inspector"],
    introducedIn: "batch-2",
  },
  {
    id: "devmode.export",
    category: "devmode",
    label: "Export view",
    description: "Export current canvas view as PNG / SVG.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-2",
  },
  {
    id: "devmode.measure",
    category: "devmode",
    label: "Measure mode",
    description: "Two-file pick → shared deps + shortest path + edge count.",
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-2",
  },

  // ── Review flows (Batch 4) ───────────────────────────────────────
  {
    id: "review.voting",
    category: "review",
    label: "Dot voting",
    description: "Team voting dots on files / stickies (retro-style).",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-4",
  },
  {
    id: "review.poker",
    category: "review",
    label: "Estimation poker",
    description: "Per-file effort estimate cards (Fibonacci deck).",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-4",
  },
  {
    id: "review.timer",
    category: "review",
    label: "Session timer",
    description: "Time-boxed review session widget.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-4",
  },
  {
    id: "review.retrospective",
    category: "review",
    label: "Retrospective board",
    description: "Went-well / didn't / action 3-column overlay.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-4",
  },
  {
    id: "review.kanban",
    category: "review",
    label: "Kanban swim lanes",
    description: "File PR review state: Todo / Review / Approved lanes.",
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-4",
  },

  // ── Navigation (Batch 5) ─────────────────────────────────────────
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
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["nav.bookmarks"],
    introducedIn: "batch-5",
  },
  {
    id: "nav.templates",
    category: "navigation",
    label: "Canvas templates",
    description: "Prebuilt scenario pages (security review, onboarding, post-mortem, architecture).",
    defaultEnabled: true,
    maturity: "beta",
    dependsOn: ["nav.pages", "nav.bookmarks"],
    introducedIn: "batch-5",
  },

  // ── Power user (Batch 7) ─────────────────────────────────────────
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
    defaultEnabled: true,
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
    defaultEnabled: true,
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

  // ── Smart embeds (Batch 8) ───────────────────────────────────────
  {
    id: "embeds.imagePaste",
    category: "embeds",
    label: "Paste image as element",
    description: "Clipboard paste of an image drops it on the canvas as a world-positioned, draggable image element (persisted in localStorage).",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-8",
  },
  {
    id: "embeds.tickets",
    category: "embeds",
    label: "Ticket cards (Linear / Jira / GitHub)",
    description: "Mock ticket cards linked to files (Linear / Jira / GitHub) — displayed adjacent to each file at city+ zoom.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-8",
  },
  {
    id: "embeds.prBadge",
    category: "embeds",
    label: "Pull-request badges",
    description: "Mock open / merged PRs as a top-left pill on file cards; hover shows title, stats, and a mini diff preview.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-8",
  },
  {
    id: "embeds.slackThread",
    category: "embeds",
    label: "Slack thread embed",
    description: "Mock Slack thread cards — last reply preview, message count, linked to files in the HUD.",
    defaultEnabled: true,
    maturity: "beta",
    introducedIn: "batch-8",
  },

  // ── AI assist (Batch 6) ──────────────────────────────────────────
  {
    id: "ai.naturalLanguageFilter",
    category: "ai",
    label: "Natural-language edge filter",
    description: "Type a plain-English question and the AI compiles it to the DSL.",
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
  {
    id: "ai.clusterStickies",
    category: "ai",
    label: "Cluster stickies",
    description: "Group stickies with similar text into labelled clusters.",
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
  {
    id: "ai.repoTour",
    category: "ai",
    label: "Repo tour",
    description: "AI-generated guided walk through the most important files.",
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
  {
    id: "ai.anomalyAlerts",
    category: "ai",
    label: "Anomaly alerts",
    description: "Badge files with coupling spikes, cycles, or unreachable status.",
    defaultEnabled: true,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
] as const;

/** Fast id → descriptor lookup. */
export const FEATURE_BY_ID: ReadonlyMap<string, FeatureDescriptor> = new Map(
  FEATURE_REGISTRY.map(f => [f.id, f]),
);

/** Group features by category for the HUD rendering. */
export function featuresByCategory(): ReadonlyMap<FeatureCategory, readonly FeatureDescriptor[]> {
  const out = new Map<FeatureCategory, FeatureDescriptor[]>();
  for (const f of FEATURE_REGISTRY) {
    let list = out.get(f.category);
    if (!list) { list = []; out.set(f.category, list); }
    list.push(f);
  }
  return out;
}
