import { useCallback, useEffect, useMemo } from "react";
import type { WorkspaceGraph, WorkspaceLayout, Rect, FileNode } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { useInteractionStore } from "../store/interaction-store";
import { useSceneStore } from "../store/scene-store";
import { votingStore, useVotingStore } from "../store/voting-store";
import {
  estimationStore,
  statsFor,
  useEstimationStore,
  POKER_DECK,
  type PokerScore,
} from "../store/estimation-store";
import { RetroColumns } from "./RetroColumns";
import { KanbanView } from "./KanbanView";

interface Props {
  graph: WorkspaceGraph;
  transform: string;
  scale: number;
}

// Review overlay layer (review.* features)
// -----------------------------------------------------------------
// One mount hosts all non-kanban review surfaces: voting badges on
// files, the poker chip on the selected file, and the retrospective
// 3-column overlay. Kanban is a sibling because it replaces the file
// layer wholesale rather than augmenting it.
//
// All children are feature-gated at this layer so an empty overlay
// does no DOM work when every review feature is off.

export function ReviewLayer({ graph, transform, scale }: Props) {
  const votingOn = useFeature("review.voting");
  const pokerOn = useFeature("review.poker");
  const retroOn = useFeature("review.retrospective");
  const kanbanOn = useFeature("review.kanban");

  const layout = useSceneStore(s => s.layout);
  const visibleFiles = useSceneStore(s => s.visibleScene?.files ?? null);
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);
  const hoveredFileId = useInteractionStore(s => s.viewState.hoveredFileId);

  // Ctrl+V quick-vote on the hovered file (also Cmd+V). Only active
  // when the voting feature is enabled and a file is hovered.
  useEffect(() => {
    if (!votingOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== "v" && e.key !== "V") return;
      // Let the browser paste happen in inputs.
      const tag = (e.target as Element | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const id = hoveredFileId;
      if (!id) return;
      e.preventDefault();
      votingStore.toggle({ kind: "file", id });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [votingOn, hoveredFileId]);

  if (!votingOn && !pokerOn && !retroOn && !kanbanOn) return null;

  return (
    <>
      {/* Per-file world-layer badges (voting + poker) */}
      {(votingOn || pokerOn) && layout && visibleFiles && (
        <FileBadgesLayer
          files={visibleFiles}
          layout={layout}
          transform={transform}
          scale={scale}
          votingOn={votingOn}
          pokerOn={pokerOn}
          selectedFileId={selectedFileId}
        />
      )}

      {/* Screen-layer overlays */}
      {retroOn && <RetroColumns />}
      {kanbanOn && <KanbanView graph={graph} />}
    </>
  );
}

// ── File-level badges (world coords) ──────────────────────────────

interface FileBadgesLayerProps {
  files: readonly FileNode[];
  layout: WorkspaceLayout;
  transform: string;
  scale: number;
  votingOn: boolean;
  pokerOn: boolean;
  selectedFileId: string | null;
}

function FileBadgesLayer({
  files, layout, transform, scale, votingOn, pokerOn, selectedFileId,
}: FileBadgesLayerProps) {
  const votes = useVotingStore(s => s.votes);
  const estimates = useEstimationStore(s => s.estimates);

  // Build fast lookups once per change.
  const voteCountByFile = useMemo(() => {
    const m = new Map<string, number>();
    if (!votingOn) return m;
    for (const v of votes) {
      if (v.targetKind !== "file") continue;
      m.set(v.targetId, (m.get(v.targetId) ?? 0) + 1);
    }
    return m;
  }, [votes, votingOn]);

  const fileHasMyVote = useMemo(() => {
    const s = new Set<string>();
    if (!votingOn) return s;
    for (const v of votes) {
      if (v.targetKind === "file" && v.voterId === "you") s.add(v.targetId);
    }
    return s;
  }, [votes, votingOn]);

  return (
    <div
      className="ws-review-layer"
      style={{ transform, transformOrigin: "0 0" }}
    >
      {files.map(file => {
        const rect: Rect | undefined = layout.fileRects.get(file.id);
        if (!rect) return null;
        const voteCount = voteCountByFile.get(file.id) ?? 0;
        const iVoted = fileHasMyVote.has(file.id);
        const isSelected = selectedFileId === file.id;
        const showPoker = pokerOn && isSelected;
        return (
          <FileBadges
            key={file.id}
            fileId={file.id}
            rect={rect}
            scale={scale}
            voteCount={voteCount}
            showVote={votingOn}
            iVoted={iVoted}
            showPoker={showPoker}
            estimates={estimates}
          />
        );
      })}
    </div>
  );
}

interface FileBadgesProps {
  fileId: string;
  rect: Rect;
  scale: number;
  voteCount: number;
  showVote: boolean;
  iVoted: boolean;
  showPoker: boolean;
  estimates: readonly import("../store/estimation-store").Estimate[];
}

function FileBadges({
  fileId, rect, scale, voteCount, showVote, iVoted, showPoker, estimates,
}: FileBadgesProps) {
  const onVoteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    votingStore.toggle({ kind: "file", id: fileId });
  }, [fileId]);

  // Voting dot appears even at 0 count? Spec says "≥1 vote". We render
  // a faint "+" target on hover via CSS so users can add a first vote;
  // but the visible badge only appears when count > 0.
  const showVoteBadge = showVote && voteCount >= 1;

  return (
    <>
      {showVoteBadge && (
        <button
          type="button"
          className={`ws-review-vote${iVoted ? " ws-review-vote--mine" : ""}`}
          style={{
            left: rect.x + rect.w - 10,
            top: rect.y - 10,
          }}
          onClick={onVoteClick}
          title={iVoted ? "Remove your vote" : "Toggle your vote"}
        >
          <span>{voteCount}</span>
        </button>
      )}
      {/* Invisible 0-state tap target so users can add a first vote.
          Kept small + pointer-only so it doesn't fight the card click. */}
      {showVote && !showVoteBadge && (
        <button
          type="button"
          className="ws-review-vote ws-review-vote--empty"
          style={{
            left: rect.x + rect.w - 10,
            top: rect.y - 10,
          }}
          onClick={onVoteClick}
          title="Add your vote"
        >
          <span>+</span>
        </button>
      )}
      {showPoker && (
        <PokerChip fileId={fileId} rect={rect} scale={scale} estimates={estimates} />
      )}
    </>
  );
}

// ── Poker chip ────────────────────────────────────────────────────

interface PokerChipProps {
  fileId: string;
  rect: Rect;
  scale: number;
  estimates: readonly import("../store/estimation-store").Estimate[];
}

function PokerChip({ fileId, rect, estimates }: PokerChipProps) {
  const fileEstimates = useMemo(
    () => estimates.filter(e => e.fileId === fileId),
    [estimates, fileId],
  );
  const stats = useMemo(
    () => statsFor({ estimates: fileEstimates }, fileId),
    [fileEstimates, fileId],
  );
  // Show median across all voters if ≥1 numeric; else show my pick if any;
  // else "—".
  const myEstimate = fileEstimates.find(e => e.voterId === "you");
  const headline = stats.median !== null
    ? formatScore(stats.median)
    : myEstimate
      ? String(myEstimate.score)
      : "—";
  const count = fileEstimates.length;

  const [open, setOpen] = useStateBool(false);

  const pick = useCallback((s: PokerScore) => {
    estimationStore.estimate(fileId, s);
    setOpen(false);
  }, [fileId, setOpen]);

  return (
    <div
      className="ws-review-poker"
      style={{
        left: rect.x + rect.w - 56,
        top: rect.y + rect.h + 6,
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <button
        type="button"
        className={`ws-review-poker__chip${open ? " is-open" : ""}`}
        onClick={e => { e.stopPropagation(); setOpen(!open); }}
        title={count === 0
          ? "Estimate effort"
          : `${count} estimate${count === 1 ? "" : "s"}${stats.mean !== null ? ` • μ=${stats.mean.toFixed(1)}` : ""}`}
      >
        <span className="ws-review-poker__label">pts</span>
        <span className="ws-review-poker__value">{headline}</span>
        {count > 0 && <span className="ws-review-poker__count">×{count}</span>}
      </button>
      {open && (
        <div className="ws-review-poker__deck">
          {POKER_DECK.map(s => {
            const mine = myEstimate?.score === s;
            return (
              <button
                key={String(s)}
                type="button"
                className={`ws-review-poker__card${mine ? " is-mine" : ""}`}
                onClick={() => pick(s)}
                title={`Estimate ${String(s)}`}
              >
                {String(s)}
              </button>
            );
          })}
          {myEstimate && (
            <button
              type="button"
              className="ws-review-poker__clear"
              onClick={() => { estimationStore.clearEstimate(fileId); setOpen(false); }}
              title="Clear your estimate"
            >
              clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatScore(n: number): string {
  // Fibonacci values are small integers; show one decimal for non-integers.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Tiny wrapper — React's `useState` returns a tuple but we want the
// setter callable with a plain boolean without destructuring each call.
import { useState as _useState } from "react";
function useStateBool(initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = _useState(initial);
  return [v, setV];
}
