// Command registry (Batch 7 — power.commandPalette).
// -------------------------------------------------------------------
// Owns the fuzzy-matching algorithm + command assembly for the Cmd+K
// palette. Commands are built on demand from the current store
// snapshots — files / features / bookmarks / stickies — so the palette
// always sees the live world without needing external registration.
//
// Extension:
//   - `seedCommands({ ... })` takes the current store snapshots and
//     produces a Command[]. The palette calls this on open and when
//     dependent state changes.
//   - Fuzzy score is a small "characters-in-order" match with bonuses
//     for start-of-word hits and case-insensitive exact matches.

import type { WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import { FEATURE_REGISTRY } from "./feature-registry";
import { featureFlagsStore } from "../store/feature-flags-store";
import { interactionStore } from "../store/interaction-store";
import { viewportStore } from "../store/viewport-store";
import { sceneStore } from "../store/scene-store";
import { debugSettingsStore } from "../store/debug-settings-store";
import { renderSettingsStore } from "../store/render-settings-store";
import { stickiesStore, type Sticky } from "../store/stickies-store";
import { themeStore } from "../store/theme-store";
import { cancelAiRepoTour, runAiClusterStickies, runAiRepoTour } from "./ai-launchers";

export type CommandCategory =
  | "files"
  | "actions"
  | "features"
  | "bookmarks"
  | "stickies"
  | "other";

export interface Command {
  id: string;
  label: string;
  category: CommandCategory;
  icon?: string;
  keywords?: readonly string[];
  /** Optional short suffix rendered on the right (e.g., keybinding). */
  hint?: string;
  run: () => void;
  /** Only shown when this returns true (called once per assembly). */
  when?: () => boolean;
}

export interface CommandSeedContext {
  graph: WorkspaceGraph | null;
  layout: WorkspaceLayout | null;
  /** Optional zoom-to-file helper — falls back to instant snap on viewport store. */
  zoomToFile?: (fileId: string) => void;
  /** Optional fit-to-graph helper. */
  fitToGraph?: () => void;
  /** Optional reset-viewport helper — resets to (0,0) at default scale. */
  resetViewport?: () => void;
  /** Optional PNG export trigger. */
  exportPng?: () => void;
}

// ── Fuzzy match ────────────────────────────────────────────────────

/**
 * Cheap in-order character match with a couple of bonuses.
 *   - Each matched character advances a pointer through the haystack.
 *   - A hit immediately after a separator (/ . space _ -) or at index 0
 *     scores higher (start-of-word bonus).
 *   - A case-sensitive hit scores slightly higher than a case-insensitive
 *     hit so exact casing wins ties.
 *   - An unmatched character returns null (filter this command out).
 *   - Score is roughly proportional to matched chars; range is typically
 *     in [0, needle.length * 4]. Higher = better match.
 */
export function fuzzyScore(needle: string, haystack: string): number | null {
  if (needle.length === 0) return 0;
  if (haystack.length === 0) return null;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  let score = 0;
  let hi = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const want = n[ni];
    if (want === undefined) return null;
    let found = -1;
    while (hi < h.length) {
      if (h[hi] === want) { found = hi; break; }
      hi++;
    }
    if (found < 0) return null;
    // Base point for the match.
    score += 1;
    // Start-of-word bonus.
    const prev = found === 0 ? undefined : h[found - 1];
    if (
      found === 0 ||
      prev === " " || prev === "/" || prev === "." ||
      prev === "_" || prev === "-" || prev === ":"
    ) {
      score += 2;
    }
    // Case-exact bonus.
    if (haystack[found] === needle[ni]) score += 1;
    hi = found + 1;
  }
  return score;
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

// ── Command assembly ───────────────────────────────────────────────

export function seedCommands(ctx: CommandSeedContext): readonly Command[] {
  const out: Command[] = [];

  // Built-in actions ---------------------------------------------------
  out.push({
    id: "action.resetViewport",
    label: "Reset viewport",
    category: "actions",
    keywords: ["camera", "home", "origin"],
    run: () => {
      if (ctx.resetViewport) { ctx.resetViewport(); return; }
      const vp = viewportStore.getState().viewport;
      viewportStore.setViewport({ ...vp, x: 0, y: 0, scale: 0.1 });
    },
  });
  out.push({
    id: "action.fitToGraph",
    label: "Fit to graph",
    category: "actions",
    keywords: ["zoom", "fit", "overview"],
    run: () => {
      if (ctx.fitToGraph) { ctx.fitToGraph(); return; }
      const layout = sceneStore.getState().layout;
      if (!layout) return;
      const vp = viewportStore.getState().viewport;
      const tb = layout.totalBounds;
      if (tb.w <= 0 || tb.h <= 0 || vp.width <= 0 || vp.height <= 0) return;
      const scale = Math.min(vp.width / tb.w, vp.height / tb.h) * 0.9;
      viewportStore.setViewport({
        ...vp,
        scale,
        x: (vp.width - tb.w * scale) / 2,
        y: (vp.height - tb.h * scale) / 2,
      });
    },
  });
  out.push({
    id: "action.clearFilters",
    label: "Clear all filters",
    category: "actions",
    keywords: ["edges", "reset"],
    run: () => {
      renderSettingsStore.setEdgeFilterQuery("");
      renderSettingsStore.setShowEdges(true);
      interactionStore.clearPathQuery();
      interactionStore.resetSelection();
    },
  });
  out.push({
    id: "action.toggleHud",
    label: "Toggle debug HUD",
    category: "actions",
    hint: "⌘⇧D",
    keywords: ["debug", "hud"],
    run: () => debugSettingsStore.toggleDebugHud(),
  });
  out.push({
    id: "action.exportPng",
    label: "Export PNG",
    category: "actions",
    keywords: ["download", "image", "save"],
    when: () => featureFlagsStore.isEnabled("devmode.export"),
    run: () => {
      if (ctx.exportPng) ctx.exportPng();
    },
  });
  out.push({
    id: "action.cycleTheme",
    label: "Cycle theme (dark → light → high-contrast)",
    category: "actions",
    keywords: ["theme", "appearance", "dark", "light"],
    when: () => featureFlagsStore.isEnabled("power.themeSwitcher"),
    run: () => themeStore.cycle(),
  });
  // Temporal AI surfaces (T4) — each command dispatches the window-level
  // toggle custom event the panel listens for; only registered when the
  // corresponding feature is enabled.
  out.push({
    id: "action.temporal.regressionHunt",
    label: "Open regression hunt",
    category: "actions",
    keywords: ["ai", "test", "failure", "bisect", "attribution"],
    when: () => featureFlagsStore.isEnabled("temporal.regressionHunt"),
    run: () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("temporal-hunt-toggle", { detail: true }));
      }
    },
  });
  out.push({
    id: "action.temporal.prReplay",
    label: "Replay a PR / commit range",
    category: "actions",
    keywords: ["ai", "pr", "replay", "narration"],
    when: () => featureFlagsStore.isEnabled("temporal.prReplay"),
    run: () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("temporal-prreplay-toggle", { detail: true }));
      }
    },
  });
  out.push({
    id: "action.temporal.bisectGame",
    label: "Start bisect game",
    category: "actions",
    keywords: ["ai", "bisect", "game", "debug"],
    when: () => featureFlagsStore.isEnabled("temporal.bisectGame"),
    run: () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("temporal-bisect-toggle", { detail: true }));
      }
    },
  });

  // AI launchers — same launcher functions the HUD uses. Commands only
  // appear when the matching flag is on; the launcher itself
  // double-checks the flag so it's safe to invoke from anywhere.
  out.push({
    id: "action.ai.clusterStickies",
    label: "AI: cluster stickies",
    category: "actions",
    keywords: ["ai", "sticky", "group", "cluster", "organize"],
    when: () => featureFlagsStore.isEnabled("ai.clusterStickies"),
    run: () => { void runAiClusterStickies(); },
  });
  out.push({
    id: "action.ai.repoTour",
    label: "AI: start repo tour",
    category: "actions",
    keywords: ["ai", "tour", "onboarding", "start here", "guide"],
    when: () => featureFlagsStore.isEnabled("ai.repoTour"),
    run: () => { void runAiRepoTour(); },
  });
  out.push({
    id: "action.ai.cancelRepoTour",
    label: "AI: cancel repo tour",
    category: "actions",
    keywords: ["ai", "tour", "stop", "cancel"],
    when: () => featureFlagsStore.isEnabled("ai.repoTour"),
    run: () => { cancelAiRepoTour(); },
  });

  // Files --------------------------------------------------------------
  const files = ctx.graph?.files ?? [];
  for (const f of files) {
    out.push({
      id: `file.${f.id}`,
      label: `Open file: ${basename(f.id)}`,
      category: "files",
      keywords: [f.id],
      run: () => {
        if (ctx.zoomToFile) { ctx.zoomToFile(f.id); return; }
        interactionStore.selectFile(f.id);
        const rect = ctx.layout?.fileRects.get(f.id);
        if (!rect) return;
        const vp = viewportStore.getState().viewport;
        if (vp.width <= 0 || vp.height <= 0 || rect.w <= 0 || rect.h <= 0) return;
        const FILL = 0.85;
        const rawScale = Math.min(vp.width / rect.w, vp.height / rect.h) * FILL;
        const scale = Math.min(2.5, Math.max(0.001, rawScale));
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        viewportStore.setViewport({
          ...vp,
          scale,
          x: vp.width / 2 - cx * scale,
          y: vp.height / 2 - cy * scale,
        });
      },
    });
  }

  // Features -----------------------------------------------------------
  for (const feat of FEATURE_REGISTRY) {
    out.push({
      id: `feature.${feat.id}`,
      label: `Toggle: ${feat.label}`,
      category: "features",
      keywords: [feat.id, feat.category, feat.description],
      run: () => {
        const on = featureFlagsStore.getState().flags[feat.id];
        featureFlagsStore.setFlag(feat.id, !on);
      },
    });
  }

  // Stickies -----------------------------------------------------------
  const stickies = stickiesStore.getState().stickies;
  for (const s of stickies) {
    out.push({
      id: `sticky.${s.id}`,
      label: `Jump to sticky: ${stickyPreview(s)}`,
      category: "stickies",
      keywords: [s.author],
      run: () => {
        const vp = viewportStore.getState().viewport;
        if (vp.width <= 0 || vp.height <= 0) return;
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        viewportStore.setViewport({
          ...vp,
          scale: Math.max(vp.scale, 0.6),
          x: vp.width / 2 - cx * Math.max(vp.scale, 0.6),
          y: vp.height / 2 - cy * Math.max(vp.scale, 0.6),
        });
        stickiesStore.setActive(s.id);
      },
    });
  }

  // Bookmarks ---------------------------------------------------------
  // `nav.bookmarks` isn't wired to a real bookmarks store yet; gate the
  // command list on the flag so the category remains valid when the
  // feature lands without needing a palette change.
  if (featureFlagsStore.isEnabled("nav.bookmarks")) {
    // Intentionally empty for now — placeholder list; the palette still
    // renders the category header if any bookmark is registered later.
  }

  return out;
}

function stickyPreview(s: Sticky): string {
  const trimmed = s.text.trim();
  if (trimmed.length === 0) return "(empty)";
  if (trimmed.length <= 40) return trimmed;
  return `${trimmed.slice(0, 37)}…`;
}

// ── Search ────────────────────────────────────────────────────────

export interface RankedCommand {
  command: Command;
  score: number;
}

export function searchCommands(
  commands: readonly Command[],
  query: string,
  limit = 80,
): readonly RankedCommand[] {
  const q = query.trim();
  const filtered = commands.filter(c => (c.when ? c.when() : true));
  if (q.length === 0) {
    return filtered.slice(0, limit).map(command => ({ command, score: 0 }));
  }
  const ranked: RankedCommand[] = [];
  for (const c of filtered) {
    const labelScore = fuzzyScore(q, c.label);
    let best: number | null = labelScore;
    if (c.keywords) {
      for (const kw of c.keywords) {
        const s = fuzzyScore(q, kw);
        if (s !== null && (best === null || s > best)) best = s;
      }
    }
    if (best !== null) ranked.push({ command: c, score: best });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export const COMMAND_CATEGORY_ORDER: readonly CommandCategory[] = [
  "files",
  "actions",
  "features",
  "bookmarks",
  "stickies",
  "other",
];

export const COMMAND_CATEGORY_LABEL: Record<CommandCategory, string> = {
  files: "Files",
  actions: "Actions",
  features: "Features",
  bookmarks: "Bookmarks",
  stickies: "Stickies",
  other: "Other",
};
