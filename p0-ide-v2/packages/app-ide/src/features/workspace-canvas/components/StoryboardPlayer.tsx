import { useEffect, useMemo, useRef } from "react";
import { storyboardStore, useStoryboardStore, type StoryboardSpeed } from "../store/storyboard-store";
import { useBookmarksStore, bookmarksForPage } from "../store/bookmarks-store";
import { useFeature } from "../store/feature-flags-store";
import { applyBookmarkToCanvas } from "./BookmarksDrawer";
import { cancelCameraAnimation } from "../lib/camera-animator";

// StoryboardPlayer (Batch 5 — Navigation)
// -------------------------------------------------------------------
// Floating control strip at the bottom of the canvas. Walks the
// bookmarks of the currently-playing page in `order`, applying each
// and waiting a dwell time before advancing. Speed divides dwell (2×
// halves it, 4× quarters). Loops when `loop` is on.
//
// Only rendered when the storyboard is actively playing or paused,
// so the strip doesn't clutter the canvas when there's nothing to
// replay.

const SPEEDS: readonly StoryboardSpeed[] = [1, 2, 4];

export function StoryboardPlayer() {
  const on = useFeature("nav.storyboard");
  const playing = useStoryboardStore(s => s.playing);
  const pageId = useStoryboardStore(s => s.pageId);
  const stepIndex = useStoryboardStore(s => s.stepIndex);
  const speed = useStoryboardStore(s => s.speed);
  const loop = useStoryboardStore(s => s.loop);
  const dwellMs = useStoryboardStore(s => s.dwellMs);

  const bookmarks = useBookmarksStore(s => s.bookmarks);
  const ordered = useMemo(
    () => (pageId ? bookmarksForPage({ bookmarks }, pageId) : []),
    [bookmarks, pageId],
  );

  const current = ordered[stepIndex];
  const total = ordered.length;

  // Apply the bookmark whenever (pageId, stepIndex) change while the
  // storyboard is active. This is the single source of truth — a user
  // clicking next/prev also flows through here.
  const appliedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!pageId || !current) return;
    const key = `${pageId}:${current.id}`;
    if (appliedKey.current === key) return;
    appliedKey.current = key;
    applyBookmarkToCanvas(current.id);
  }, [pageId, current]);

  // Auto-advance timer. Tears down cleanly when we pause, stop, or
  // the step changes (timer resets per step).
  useEffect(() => {
    if (!playing || !pageId || total === 0) return;
    const scaledDwell = Math.max(300, Math.round(dwellMs / speed));
    const handle = window.setTimeout(() => {
      storyboardStore.next(total);
    }, scaledDwell);
    return () => {
      window.clearTimeout(handle);
    };
  }, [playing, pageId, stepIndex, speed, dwellMs, total]);

  // Cancel any in-flight camera animation when playback ends so we
  // don't leave the user mid-tween with a frozen panel.
  useEffect(() => {
    if (!playing && pageId === null) {
      cancelCameraAnimation();
    }
  }, [playing, pageId]);

  if (!on) return null;
  if (!pageId) return null;
  if (total === 0) return null;

  return (
    <div className="ws-storyboard" role="region" aria-label="Storyboard playback">
      <div className="ws-storyboard__banner">
        Touring: <b>{current?.label ?? "—"}</b>{" "}
        <span className="ws-storyboard__step">
          {Math.min(stepIndex + 1, total)} / {total}
        </span>
      </div>
      <div className="ws-storyboard__controls">
        <button
          type="button"
          className="ws-storyboard__btn"
          onClick={() => storyboardStore.prev()}
          disabled={stepIndex <= 0}
          title="Previous"
          aria-label="Previous"
        >
          ◀
        </button>
        <button
          type="button"
          className="ws-storyboard__btn ws-storyboard__btn--primary"
          onClick={() => (playing ? storyboardStore.pause() : storyboardStore.resume())}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="ws-storyboard__btn"
          onClick={() => storyboardStore.next(total)}
          disabled={!loop && stepIndex >= total - 1}
          title="Next"
          aria-label="Next"
        >
          ▶
        </button>
        <button
          type="button"
          className="ws-storyboard__btn"
          onClick={() => storyboardStore.stop()}
          title="Stop"
          aria-label="Stop"
        >
          ■
        </button>

        <div className="ws-storyboard__spacer" />

        <div className="ws-storyboard__speed">
          {SPEEDS.map(s => (
            <button
              key={s}
              type="button"
              className={`ws-storyboard__speed-chip${speed === s ? " is-on" : ""}`}
              onClick={() => storyboardStore.setSpeed(s)}
              title={`${s}× speed`}
            >
              {s}×
            </button>
          ))}
        </div>
        <label className="ws-storyboard__loop" title="Restart when the last step ends">
          <input
            type="checkbox"
            checked={loop}
            onChange={e => storyboardStore.setLoop(e.target.checked)}
          />
          <span>loop</span>
        </label>
      </div>
    </div>
  );
}
