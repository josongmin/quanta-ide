import { useEffect } from "react";
import type { WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import { inlineEditorStore } from "../store/inline-editor-store";
import { debugSettingsStore } from "../store/debug-settings-store";
import { stickiesStore } from "../store/stickies-store";
import { startMockPresence } from "../lib/mock-presence";
import { installPresenceBridge } from "../lib/presence-store-bridge";

// ------------------------------------------------------------------
// useCanvasInitialize — mount-time init effects for MultiFileCanvas.
// ------------------------------------------------------------------
// Single responsibility: own the side-effects that should fire once
// per Code Universe (re-)entry (or once per graph/layout handshake),
// not every viewport/pan tick. Keeping them here avoids spraying
// zero-dep `useEffect` blocks across the canvas body.
//
// Covered init concerns:
//   1) Tab-switch cleanup — end any in-flight inline edit on unmount.
//   2) forceLod reset — normalise the LOD kill-switch back to "auto"
//      so a pinned tier never silently survives a remount.
//   3) Presence transport bridge + mock presence ticker (idempotent).
//   4) Demo stickies seeding — seed 1-2 demo stickies the first time
//      a layout arrives on an empty stickies store.
//
// Anything that genuinely tracks live state (editing-card zoom,
// edge cache rebuilds, auto-fit, ResizeObserver, imperative transform
// write-through) intentionally stays in MultiFileCanvas — this hook
// is strictly for mount/init intent.

interface UseCanvasInitializeArgs {
  /** Reactive layout — demo stickies seed as soon as this becomes non-null. */
  layout: WorkspaceLayout | null;
  /** Full graph — used to pick seed anchors by risk / taint origin. */
  graph: WorkspaceGraph;
}

export function useCanvasInitialize({ layout, graph }: UseCanvasInitializeArgs): void {
  // Tab-switch cleanup — when the user navigates away from the canvas we
  // end any in-flight edit session. Drafts (draftByFileId) survive; only
  // the "which card is currently the edit target" flag is cleared. This
  // prevents two surprises on re-entry: (1) the canvas doesn't snap to
  // ground-tier zoom for a card the user may have forgotten about, and
  // (2) the dim-other-cards ambient doesn't linger without an obvious
  // way out for a user who doesn't remember they opened an inline edit
  // before leaving the tab.
  useEffect(() => {
    return () => {
      inlineEditorStore.endEdit();
    };
  }, []);

  // LOD kill-switch reset on mount. `forceLod` is a DEBUG knob — its
  // whole purpose is to pin the canvas to a single tier while testing.
  // It should NEVER survive a Code Universe (re-)entry for a casual
  // user, because any non-"auto" value completely disables the
  // viewport → LOD feedback loop and leaves the graph frozen at the
  // pinned tier (most damagingly: "ground", which force-renders every
  // visible file as a DOM syntax-highlighted card and both looks stuck
  // and tanks perf).
  //
  // Root-cause chain this closes:
  //   (a) Someone (user, share link, HUD click) set forceLod ≠ "auto".
  //   (b) Module-scoped debugSettingsStore keeps that value across
  //       tab switches, hard refreshes (via URL), and even after the
  //       user zooms out — because useLodSync reads forceLod FIRST
  //       and short-circuits `manager.update(scale)`.
  //   (c) The user has no indication the tier is pinned; the HUD chip
  //       is the only surface that exposes it, and not every user
  //       opens the HUD.
  //
  // Reset happens AFTER the URL-state-sync effect so an explicit share
  // link carrying `forceLod` still applies for the very first render,
  // then this effect normalises back to auto on the next tick. The
  // user retains full manual control via the HUD chip row — they just
  // don't get silently pinned anymore.
  useEffect(() => {
    if (debugSettingsStore.getState().forceLod !== "auto") {
      debugSettingsStore.setForceLod("auto");
    }
  }, []);

  useEffect(() => {
    // Install the transport↔store bridge once — idempotent across remounts.
    const uninstallBridge = installPresenceBridge();
    const stop = startMockPresence();
    return () => {
      stop();
      uninstallBridge();
    };
  }, []);

  // Demo stickies — once per layout, when no stickies exist yet.
  useEffect(() => {
    if (!layout) return;
    if (stickiesStore.getState().stickies.length > 0) return;
    const rects = layout.fileRects;
    if (rects.size === 0) return;
    const files = graph.files;
    if (files.length === 0) return;
    const scored = files
      .map(f => ({ file: f, risk: typeof f.riskScore === "number" ? f.riskScore : 0 }))
      .sort((a, b) => b.risk - a.risk);
    const topRisk = scored[0]?.file;
    const taintEdge = graph.fileEdges.find(
      e => e.kind === "taint-propagation" || e.layer === "safety",
    );
    const taintOriginId = taintEdge?.from;
    const taintOriginFile = taintOriginId ? files.find(f => f.id === taintOriginId) : undefined;
    const seed: Array<{ fileId: string; text: string }> = [];
    if (topRisk) seed.push({ fileId: topRisk.id, text: "TODO: refactor — high risk surface" });
    if (taintOriginFile && taintOriginFile.id !== topRisk?.id) {
      seed.push({ fileId: taintOriginFile.id, text: "ask security team about this source" });
    }
    if (seed.length < 2 && files[0]) {
      seed.push({ fileId: files[0].id, text: "welcome — shift+dblclick to add a note" });
    }
    for (const s of seed) {
      const r = rects.get(s.fileId);
      if (!r) continue;
      stickiesStore.create(r.x + r.w + 24, r.y, { text: s.text, anchorFileId: s.fileId });
    }
    stickiesStore.setActive(null);
  }, [layout, graph]);
}
