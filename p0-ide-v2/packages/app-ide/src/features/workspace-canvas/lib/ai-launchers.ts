import type { StickyCluster, TourStep } from "./ai-service";
import { getAiService } from "./ai-service-ref";
import { stickiesStore, type Sticky } from "../store/stickies-store";
import { sceneStore } from "../store/scene-store";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import { pagesStore } from "../store/pages-store";
import { bookmarksStore } from "../store/bookmarks-store";
import { storyboardStore, useStoryboardStore } from "../store/storyboard-store";
import { featureFlagsStore } from "../store/feature-flags-store";
import { toastStore } from "@quanta/shell/stores/toast-store";

// Side-effectful AI launchers. Callable from the command palette, from
// the debug HUD, or from any other trigger surface (context menu,
// keyboard shortcut, etc). Each returns a Promise<boolean> — true when
// the action reached a user-visible end state, false when it bailed for
// a recoverable reason (no data, feature off). Errors still reject.
//
// The HUD's AiAssistSection duplicates the cluster-stickies layout logic
// inline for its undo flow. This module is the canonical implementation
// used by non-HUD surfaces that don't need undo (palette, shortcuts).

// ── Cluster stickies ──────────────────────────────────────────────

const CLUSTER_GAP_X = 24;
const CLUSTER_GAP_Y = 24;

function applyClusterLayout(
  stickies: readonly Sticky[],
  clusters: readonly StickyCluster[],
): void {
  const byId = new Map(stickies.map(s => [s.id, s]));
  for (const c of clusters) {
    const members = c.stickyIds.map(id => byId.get(id)).filter((s): s is Sticky => !!s);
    if (members.length === 0) continue;
    let cx = 0;
    let cy = 0;
    for (const s of members) { cx += s.x; cy += s.y; }
    cx /= members.length;
    cy /= members.length;
    const cols = Math.ceil(Math.sqrt(members.length));
    const cellW = (members[0]?.width ?? 180) + CLUSTER_GAP_X;
    const cellH = (members[0]?.height ?? 120) + CLUSTER_GAP_Y;
    const rows = Math.ceil(members.length / cols);
    const originX = cx - (cols * cellW) / 2;
    const originY = cy - (rows * cellH) / 2;
    members.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      stickiesStore.setPosition(s.id, originX + col * cellW, originY + row * cellH);
    });
  }
}

/**
 * Group similar stickies via the AI service, then re-lay them into
 * clusters near their original centroid. Returns true when clusters
 * were applied; false when the feature is off or there aren't enough
 * stickies to cluster.
 *
 * Does NOT snapshot positions for undo — callers that need undo should
 * invoke `stickiesStore` directly before calling this.
 */
export async function runAiClusterStickies(): Promise<boolean> {
  if (!featureFlagsStore.isEnabled("ai.clusterStickies")) return false;
  const stickies = stickiesStore.getState().stickies;
  if (stickies.length < 2) {
    toastStore.push({
      kind: "info",
      title: "AI 클러스터",
      detail: "클러스터링할 스티커가 2개 이상 필요합니다.",
      ttlMs: 2200,
    });
    return false;
  }
  const svc = getAiService();
  const { clusters } = await svc.clusterStickies(stickies);
  applyClusterLayout(stickies, clusters);
  toastStore.push({
    kind: "info",
    title: "AI 클러스터 완료",
    detail: `스티커 ${stickies.length}개를 ${clusters.length}개 그룹으로 묶었습니다.`,
    ttlMs: 2400,
  });
  return true;
}

// ── Repo tour ─────────────────────────────────────────────────────

// Imperative-stepper timer handle (fallback mode). Cleared on every
// tour kick-off so repeated invocations don't stack interval callbacks.
// Exposed via `cancelAiRepoTour()` so UI callers (Esc handler, palette
// "cancel tour" command) can tear down a running tour.
let activeTourTimer: number | null = null;

/**
 * Cancel whichever repo tour is running — the imperative stepper
 * (fallback mode) and/or the storyboard playback (nav.* fully enabled).
 * Safe to call when no tour is active.
 */
export function cancelAiRepoTour(): void {
  if (activeTourTimer !== null) {
    window.clearInterval(activeTourTimer);
    activeTourTimer = null;
  }
  // Stopping storyboard while no tour is playing is a no-op on the
  // storyboard store, so we don't need to guard it here.
  storyboardStore.stop();
}

// React-hook spy for "is a tour currently running". Lets UI surfaces
// (e.g., palette command `when`) show/hide a "Cancel tour" action.
// We treat either transport as "running".
export function useIsAiRepoTourActive(): boolean {
  const storyboardPlaying = useStoryboardStore(s => s.playing);
  // `activeTourTimer` is module-level; read it at hook invocation time.
  // Not reactive on its own — the storyboard hook re-runs on playback
  // state changes, which covers the primary transport. For pure
  // fallback-mode tours the palette will only reflect changes on the
  // next open, which is acceptable for an edge-case trigger.
  return storyboardPlaying || activeTourTimer !== null;
}

/**
 * Generate an AI repo tour and play it back. When nav.pages +
 * nav.bookmarks + nav.storyboard are all on, emits a dedicated page
 * with one bookmark per step and hands playback to storyboardStore.
 * Otherwise falls back to imperatively stepping viewport+selection,
 * advancing 3.5s per step on an interval (cancel via
 * `cancelAiRepoTour()`).
 *
 * Repeat invocations are safe: an existing imperative-stepper timer is
 * cleared before starting a new tour so multiple callers don't stack
 * simultaneous step advances.
 */
export async function runAiRepoTour(): Promise<boolean> {
  if (!featureFlagsStore.isEnabled("ai.repoTour")) return false;
  const scene = sceneStore.getState();
  const graph = scene.graph;
  const layout = scene.layout;
  if (!graph || !layout) {
    toastStore.push({
      kind: "warn",
      title: "AI 투어",
      detail: "그래프 또는 레이아웃이 아직 준비되지 않았습니다.",
      ttlMs: 2200,
    });
    return false;
  }
  const svc = getAiService();
  const { steps } = await svc.generateTour(graph, layout);
  if (steps.length === 0) {
    toastStore.push({
      kind: "info",
      title: "AI 투어",
      detail: "투어할 파일을 찾지 못했습니다.",
      ttlMs: 2200,
    });
    return false;
  }

  const pagesOn = featureFlagsStore.isEnabled("nav.pages");
  const bookmarksOn = featureFlagsStore.isEnabled("nav.bookmarks");
  const storyboardOn = featureFlagsStore.isEnabled("nav.storyboard");

  if (pagesOn && bookmarksOn && storyboardOn) {
    // Storyboard-driven playback — reuses the same page+bookmarks
    // mechanism PR replay employs, so the tour appears in the same
    // UI surface (storyboard player hotkeys, bookmarks drawer).
    kickOffStoryboardTour(steps);
    toastStore.push({
      kind: "info",
      title: "AI 투어 시작",
      detail: `${steps.length}단계 · 스토리보드에서 재생 중`,
      ttlMs: 2400,
    });
    return true;
  }

  // Fallback: imperative stepper. Clear any previous tour first so
  // duplicate invocations don't stack interval callbacks, focus the
  // first step, then step every ~3.5s until exhausted.
  cancelAiRepoTour();
  focusTourStep(steps[0]);
  toastStore.push({
    kind: "info",
    title: "AI 투어 시작",
    detail: `${steps.length}단계 · 자동 진행 (Cmd+K → Cancel tour)`,
    ttlMs: 2800,
  });
  let idx = 0;
  activeTourTimer = window.setInterval(() => {
    idx += 1;
    if (idx >= steps.length) {
      cancelAiRepoTour();
      return;
    }
    focusTourStep(steps[idx]);
  }, 3500);
  return true;
}

function focusTourStep(step: TourStep): void {
  interactionStore.selectFile(step.fileId);
  interactionStore.setFocusHops(step.focusHops === 2 ? 2 : 1);
  const layout = sceneStore.getState().layout;
  const rect = layout?.fileRects.get(step.fileId);
  if (!rect) return;
  const vp = viewportStore.getState().viewport;
  if (vp.width <= 0 || vp.height <= 0 || vp.scale <= 0) return;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  viewportStore.setViewport({
    ...vp,
    x: vp.width / 2 - cx * vp.scale,
    y: vp.height / 2 - cy * vp.scale,
  });
}

function kickOffStoryboardTour(steps: readonly TourStep[]): void {
  const pageId = pagesStore.create("AI tour", { description: "Auto-generated repo tour" });
  const vp = viewportStore.getState().viewport;
  steps.forEach((step, i) => {
    const layout = sceneStore.getState().layout;
    const rect = layout?.fileRects.get(step.fileId);
    const cameraState = rect && vp.scale > 0
      ? {
        x: vp.width / 2 - (rect.x + rect.w / 2) * vp.scale,
        y: vp.height / 2 - (rect.y + rect.h / 2) * vp.scale,
        scale: vp.scale,
      }
      : { x: vp.x, y: vp.y, scale: vp.scale };
    bookmarksStore.create({
      pageId,
      label: step.narration.slice(0, 60),
      cameraState,
      filterState: { focusFileId: step.fileId },
      order: i,
    });
  });
  storyboardStore.start(pageId, 0);
  focusTourStep(steps[0]);
}
