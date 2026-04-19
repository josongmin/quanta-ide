import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { commentsStore, useCommentsStore } from "../store/comments-store";
import { useCursorsStore, cursorsStore, type CursorSnapshot } from "../store/cursors-store";
import { usePresenceStore } from "../store/presence-store";
import { useReactionsStore } from "../store/reactions-store";
import { viewportStore, useViewportStore } from "../store/viewport-store";
import { startMockCursors } from "../lib/mock-cursors";
import { CursorsLayer } from "./CursorsLayer";
import { CommentPin } from "./CommentPin";
import { CommentThreadPopover } from "./CommentThreadPopover";
import { ReactionChip } from "./ReactionChip";
import { FollowBanner } from "./FollowBanner";
import { followStore, useFollowStore } from "../store/follow-store";

interface Props {
  transform: string;
  scale: number;
  layout: WorkspaceLayout | null;
  graph: WorkspaceGraph;
}

// Single mount site for Batch 1 collab features: cursors, comments, reactions.
// Each sub-layer gates off its own feature flag so the bundle degrades
// gracefully when a flag is disabled.
export function CollabLayer({ transform, scale, layout, graph }: Props) {
  const cursorsOn = useFeature("collab.cursors");
  const commentsOn = useFeature("collab.comments");
  const reactionsOn = useFeature("collab.reactions");
  const followOn = useFeature("collab.follow");

  // Mock cursors driver — hard-disabled while we chase the canvas perf regression.
  // Re-enable by restoring `startMockCursors()` once frame-stall RCA is resolved.
  void startMockCursors;
  void cursorsOn;

  // Follow-mode tracker — when a follow target is set, pan the viewport to
  // keep its cursor centered on every tick.
  const followTargetId = useFollowStore(s => s.targetUserId);
  const cursors = useCursorsStore(s => s.cursors);
  const presence = usePresenceStore(s => s.agents);

  useFollowIntegration(followOn, followTargetId);

  // Seed demo comments once per layout when none exist.
  useEffect(() => {
    if (!commentsOn) return;
    if (!layout) return;
    if (commentsStore.getState().threads.length > 0) return;
    const rects = layout.fileRects;
    if (rects.size === 0) return;
    const files = graph.files;
    if (files.length === 0) return;
    const top = [...files].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    const seeds: { fileId: string; body: string }[] = [];
    if (top[0]) seeds.push({ fileId: top[0].id, body: "@alice can you double-check this surface?" });
    if (top[1] && top[1].id !== top[0]?.id) {
      seeds.push({ fileId: top[1].id, body: "perf concern here — @bob what's the p95?" });
    }
    for (const s of seeds) {
      const r = rects.get(s.fileId);
      if (!r) continue;
      commentsStore.createThread({
        targetKind: "file",
        targetId: s.fileId,
        posX: r.x + r.w - 10,
        posY: r.y - 10,
        firstMessage: s.body,
      });
    }
    commentsStore.setOpen(null);
  }, [commentsOn, layout, graph]);

  const threads = useCommentsStore(s => s.threads);
  const openThreadId = useCommentsStore(s => s.openThreadId);

  // Brief skeleton window — layout exists but no comment threads yet.
  // Covers the render frame between first layout and the seed useEffect
  // dispatching the demo threads, so users never see a blank pin layer.
  const [skeletonActive, setSkeletonActive] = useState(true);
  useEffect(() => {
    if (!commentsOn) { setSkeletonActive(false); return; }
    if (threads.length > 0) { setSkeletonActive(false); return; }
    if (!layout) return;
    const t = window.setTimeout(() => setSkeletonActive(false), 600);
    return () => window.clearTimeout(t);
  }, [commentsOn, threads.length, layout]);
  const openThread = useMemo(
    () => threads.find(t => t.id === openThreadId) ?? null,
    [threads, openThreadId],
  );

  const allReactions = useReactionsStore(s => s.reactions);
  const fileReactions = useMemo(() => {
    const map = new Map<string, typeof allReactions>();
    for (const r of allReactions) {
      if (r.targetKind !== "file") continue;
      let list = map.get(r.targetId);
      if (!list) { list = []; map.set(r.targetId, list); }
      (list as typeof allReactions[number][]).push(r);
    }
    return map;
  }, [allReactions]);

  const pinsLayerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pinsLayerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  const reactionsLayerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = reactionsLayerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  return (
    <>
      {cursorsOn && <CursorsLayer transform={transform} scale={scale} />}

      {reactionsOn && layout && (
        <div
          ref={reactionsLayerRef}
          className="workspace-canvas__reactions-layer"
          style={{ transformOrigin: "0 0" }}
        >
          {graph.files.map(file => {
            const rx = fileReactions.get(file.id);
            const rect = layout.fileRects.get(file.id);
            if (!rect) return null;
            // Hide entirely when there are no reactions AND we aren't hovering
            // — CSS handles the hover-to-show for the "+" affordance.
            return (
              <div
                key={file.id}
                className="ws-reactions-anchor"
                style={{
                  left: rect.x + rect.w - 4,
                  top: rect.y + rect.h - 4,
                }}
              >
                <ReactionChip
                  targetKind="file"
                  targetId={file.id}
                  reactions={rx ?? []}
                  scale={scale}
                />
              </div>
            );
          })}
        </div>
      )}

      {commentsOn && layout && (
        <div
          ref={pinsLayerRef}
          className="workspace-canvas__pins-layer"
          style={{ transformOrigin: "0 0" }}
        >
          {skeletonActive && threads.length === 0 && (
            <CollabSkeleton layout={layout} />
          )}
          {threads.map(t => (
            <CommentPin
              key={t.id}
              thread={t}
              isOpen={openThreadId === t.id}
              scale={scale}
            />
          ))}
          {openThread && (
            <CommentThreadPopover thread={openThread} scale={scale} />
          )}
        </div>
      )}

      {followOn && followTargetId && (
        <FollowBanner
          targetId={followTargetId}
          label={resolveFollowLabel(followTargetId, cursors, presence)}
        />
      )}
    </>
  );
}

interface CollabSkeletonProps {
  layout: WorkspaceLayout;
}

// Subtle placeholder pins rendered while the comment thread seeder is
// still running. Avoids the blank-canvas feel during the first frame
// between layout arrival and the useEffect that creates demo threads.
// Picks the top 2 rectangles from the layout so the skeleton appears
// in plausible anchor positions and fades away as real pins arrive.
function CollabSkeleton({ layout }: CollabSkeletonProps) {
  const rects = useMemo(() => {
    const list = [...layout.fileRects.values()];
    return list.slice(0, 2);
  }, [layout]);
  return (
    <div className="ws-collab-skeleton" aria-hidden="true">
      {rects.map((r, i) => (
        <div
          key={i}
          className="ws-collab-skeleton__pin"
          style={{ left: r.x + r.w - 14, top: r.y - 14 }}
        />
      ))}
    </div>
  );
}

function resolveFollowLabel(
  id: string,
  cursors: readonly CursorSnapshot[],
  presence: readonly { agentId: string; label: string }[],
): string {
  const c = cursors.find(c => c.userId === id);
  if (c) return c.label;
  const p = presence.find(p => p.agentId === id);
  if (p) return p.label;
  return id;
}

function useFollowIntegration(
  enabled: boolean,
  targetId: string | null,
) {
  // Track the follow target and animate the viewport so its cursor stays
  // centered on screen. We lerp via rAF; bail when the flag or target goes
  // away. Uses store reads to avoid stale closures mid-animation.
  const rafRef = useRef<number | null>(null);
  const { width, height } = useViewportStore(s => s.viewport);

  useEffect(() => {
    if (!enabled) return;
    if (!targetId) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const target = cursorsStore.getState().cursors.find(c => c.userId === targetId);
      if (!target) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const vp = viewportStore.getState().viewport;
      if (vp.width <= 0 || vp.height <= 0 || vp.scale <= 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const cx = vp.width / 2;
      const cy = vp.height / 2;
      const desiredX = cx - target.worldX * vp.scale;
      const desiredY = cy - target.worldY * vp.scale;
      const nx = vp.x + (desiredX - vp.x) * 0.12;
      const ny = vp.y + (desiredY - vp.y) * 0.12;
      viewportStore.setViewport({ ...vp, x: nx, y: ny });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, targetId, width, height]);

  // ESC stops following.
  useEffect(() => {
    if (!enabled) return;
    if (!targetId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") followStore.stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, targetId]);
}
