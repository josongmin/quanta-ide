import { useMemo } from "react";
import {
  isCmdK,
  isCmdShiftT,
  isCmdE,
  type GlobalKeybind,
} from "./use-keyboard-shortcuts";
import { featureFlagsStore } from "../store/feature-flags-store";
import { themeStore } from "../store/theme-store";
import { interactionStore } from "../store/interaction-store";
import { sceneStore } from "../store/scene-store";
import { inlineEditorStore } from "../store/inline-editor-store";
import {
  captureCurrentBookmark,
  applyBookmarkToCanvas,
} from "../components/BookmarksDrawer";
import { bookmarksStore, bookmarksForPage } from "../store/bookmarks-store";
import { pagesStore } from "../store/pages-store";

// Canvas-scoped keyboard shortcuts.
// ------------------------------------------------------------------
// Extracted from MultiFileCanvas to keep that component focused on
// layout/rendering orchestration. All handlers read state on-demand
// from module-level stores, so the only external dependency is the
// palette open setter (local React state on the canvas component).
//
// The returned list is intended to be passed straight to
// `useGlobalKeybinds` at the callsite — this hook itself doesn't
// register listeners, so tests can assert on the binding shape
// without having to drive keyboard events.

export interface UseCanvasKeybindsArgs {
  /** Opens the command palette when Cmd/Ctrl+K fires. */
  setPaletteOpen: (open: boolean) => void;
}

export function useCanvasKeybinds(
  args: UseCanvasKeybindsArgs,
): readonly GlobalKeybind[] {
  const { setPaletteOpen } = args;
  return useMemo<readonly GlobalKeybind[]>(() => ([
    {
      label: "Open command palette",
      match: isCmdK,
      fireInEditable: false,
      handler: () => {
        if (!featureFlagsStore.isEnabled("power.commandPalette")) return;
        setPaletteOpen(true);
      },
    },
    {
      label: "Cycle theme",
      match: isCmdShiftT,
      handler: () => {
        if (!featureFlagsStore.isEnabled("power.themeSwitcher")) return;
        themeStore.cycle();
      },
    },
    {
      label: "Edit selected card inline",
      match: isCmdE,
      fireInEditable: false,
      handler: () => {
        const selectedId = interactionStore.getState().viewState.selectedFileId;
        if (!selectedId) return;
        const source = sceneStore.getState().groundData[selectedId]?.source;
        if (typeof source !== "string") return;
        inlineEditorStore.beginEdit(selectedId, source);
        // Zoom-to-card is handled by a dedicated effect that watches
        // `editingFileId` — works whether edit was triggered by Cmd+E
        // or by double-clicking the card.
      },
    },
    {
      label: "Capture current view",
      match: e => (e.metaKey || e.ctrlKey)
        && !e.shiftKey && !e.altKey
        && (e.key === "d" || e.key === "D"),
      fireInEditable: false,
      handler: () => {
        if (!featureFlagsStore.isEnabled("nav.bookmarks")) return;
        const activePageId = pagesStore.getState().activeId;
        if (!activePageId) return;
        captureCurrentBookmark(activePageId);
      },
    },
    {
      label: "Jump to view 1–9",
      match: e => (e.metaKey || e.ctrlKey)
        && !e.shiftKey && !e.altKey
        && /^[1-9]$/.test(e.key),
      fireInEditable: false,
      handler: e => {
        if (!featureFlagsStore.isEnabled("nav.bookmarks")) return;
        const idx = parseInt(e.key, 10) - 1;
        const pageId = pagesStore.getState().activeId;
        const list = bookmarksForPage(bookmarksStore.getState(), pageId);
        const bm = list[idx];
        if (bm) applyBookmarkToCanvas(bm.id);
      },
    },
  ]), [setPaletteOpen]);
}
