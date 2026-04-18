import { useMemo } from "react";
import { useFeature } from "../../store/feature-flags-store";
import { useSceneStore } from "../../store/scene-store";
import {
  votingStore,
  useVotingStore,
  topVotedFiles,
} from "../../store/voting-store";
import {
  estimationStore,
  useEstimationStore,
  statsFor,
  allFileIdsWithEstimates,
} from "../../store/estimation-store";
import { formatMmSs, timerStore, useTimerStore } from "../../store/timer-store";
import { retroStore, useRetroStore } from "../../store/retro-store";
import {
  reviewStateStore,
  useReviewStateStore,
  countByLane,
} from "../../store/review-state-store";

// Review HUD section (8th tab)
// -----------------------------------------------------------------
// Thin stats + toggle surface for the 5 review features. Each sub-block
// is feature-gated — if a feature is off, its block renders a short
// "disabled" line with the feature id so the user can toggle via the
// features tab.

export function ReviewSection() {
  const votingOn = useFeature("review.voting");
  const pokerOn = useFeature("review.poker");
  const timerOn = useFeature("review.timer");
  const retroOn = useFeature("review.retrospective");
  const kanbanOn = useFeature("review.kanban");

  return (
    <>
      <VotingBlock enabled={votingOn} />
      <PokerBlock enabled={pokerOn} />
      <TimerBlock enabled={timerOn} />
      <RetroBlock enabled={retroOn} />
      <KanbanBlock enabled={kanbanOn} />
    </>
  );
}

function DisabledNote({ id }: { id: string }) {
  return (
    <div className="ws-debug__grid">
      <span className="ws-debug__k">상태</span>
      <span className="ws-debug__v" style={{ opacity: 0.6 }}>
        {id} — 기능 비활성
      </span>
    </div>
  );
}

function VotingBlock({ enabled }: { enabled: boolean }) {
  const votes = useVotingStore(s => s.votes);
  const files = useSceneStore(s => s.visibleScene?.files ?? null);

  const tally = useMemo(() => topVotedFiles({ votes }, 5), [votes]);
  const fileNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files ?? []) m.set(f.id, f.name);
    return m;
  }, [files]);

  return (
    <>
      <div className="ws-debug__divider">투표 집계</div>
      {!enabled ? (
        <DisabledNote id="review.voting" />
      ) : (
        <>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">전체 투표</span>
            <span className="ws-debug__v ws-debug__v--hl">{votes.length}</span>
          </div>
          {tally.length === 0 && (
            <div className="ws-debug__grid">
              <span className="ws-debug__k">집계</span>
              <span className="ws-debug__v" style={{ opacity: 0.6 }}>— 아직 투표 없음 —</span>
            </div>
          )}
          {tally.map(t => (
            <div key={t.fileId} className="ws-debug__grid" title={t.fileId}>
              <span className="ws-debug__k" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {fileNameById.get(t.fileId) ?? t.fileId}
              </span>
              <span className="ws-debug__v ws-debug__v--hl">{t.count}</span>
            </div>
          ))}
          {votes.length > 0 && (
            <div className="ws-debug__lod" style={{ gap: 2 }}>
              <button
                type="button"
                className="ws-debug__chip"
                onClick={() => votingStore.reset()}
                title="모든 투표 비우기"
              >투표 비우기</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PokerBlock({ enabled }: { enabled: boolean }) {
  const estimates = useEstimationStore(s => s.estimates);
  const files = useSceneStore(s => s.visibleScene?.files ?? null);
  const fileIds = useMemo(() => allFileIdsWithEstimates({ estimates }), [estimates]);
  const fileNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files ?? []) m.set(f.id, f.name);
    return m;
  }, [files]);

  return (
    <>
      <div className="ws-debug__divider">추정 포커</div>
      {!enabled ? (
        <DisabledNote id="review.poker" />
      ) : (
        <>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">파일</span>
            <span className="ws-debug__v ws-debug__v--hl">{fileIds.length}</span>
          </div>
          {fileIds.length === 0 && (
            <div className="ws-debug__grid">
              <span className="ws-debug__k">통계</span>
              <span className="ws-debug__v" style={{ opacity: 0.6 }}>— 추정값 없음 —</span>
            </div>
          )}
          {fileIds.slice(0, 5).map(id => {
            const s = statsFor({ estimates }, id);
            return (
              <div key={id} className="ws-debug__grid" title={id}>
                <span className="ws-debug__k" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fileNameById.get(id) ?? id}
                </span>
                <span className="ws-debug__v ws-debug__v--hl">
                  {s.mean !== null ? `μ ${s.mean.toFixed(1)}` : "?"}
                  {s.stddev !== null && s.stddev > 0 ? ` ±${s.stddev.toFixed(1)}` : ""}
                  {` (n=${s.count})`}
                </span>
              </div>
            );
          })}
          {estimates.length > 0 && (
            <div className="ws-debug__lod" style={{ gap: 2 }}>
              <button
                type="button"
                className="ws-debug__chip"
                onClick={() => estimationStore.reset()}
                title="모든 추정값 비우기"
              >추정값 비우기</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function TimerBlock({ enabled }: { enabled: boolean }) {
  const remaining = useTimerStore(s => s.remainingSec);
  const running = useTimerStore(s => s.running);
  const initial = useTimerStore(s => s.initialSec);

  return (
    <>
      <div className="ws-debug__divider">세션 타이머</div>
      {!enabled ? (
        <DisabledNote id="review.timer" />
      ) : (
        <>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">남은 시간</span>
            <span className="ws-debug__v ws-debug__v--hl">{formatMmSs(remaining)}</span>
          </div>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">상태</span>
            <span className="ws-debug__v">{running ? "실행 중" : remaining === 0 ? "완료" : "일시 정지"}</span>
          </div>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">프리셋</span>
            <span className="ws-debug__v">{formatMmSs(initial)}</span>
          </div>
          <div className="ws-debug__lod" style={{ gap: 2 }}>
            {running ? (
              <button type="button" className="ws-debug__chip" onClick={() => timerStore.pause()}>일시 정지</button>
            ) : (
              <button type="button" className="ws-debug__chip" onClick={() => timerStore.start()}>시작</button>
            )}
            <button type="button" className="ws-debug__chip" onClick={() => timerStore.reset()}>초기화</button>
          </div>
        </>
      )}
    </>
  );
}

function RetroBlock({ enabled }: { enabled: boolean }) {
  const visible = useRetroStore(s => s.visible);

  return (
    <>
      <div className="ws-debug__divider">회고</div>
      {!enabled ? (
        <DisabledNote id="review.retrospective" />
      ) : (
        <>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">패널</span>
            <span className="ws-debug__v">{visible ? "표시" : "숨김"}</span>
          </div>
          <div className="ws-debug__lod" style={{ gap: 2 }}>
            <button
              type="button"
              className={`ws-debug__chip${visible ? " is-on" : ""}`}
              onClick={() => retroStore.toggle()}
              title="회고 오버레이 토글"
            >
              {visible ? "회고 숨기기" : "회고 표시"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function KanbanBlock({ enabled }: { enabled: boolean }) {
  const visible = useReviewStateStore(s => s.kanbanVisible);
  const lanes = useReviewStateStore(s => s.lanes);
  const files = useSceneStore(s => s.visibleScene?.files ?? null);
  const counts = useMemo(() => {
    if (!files) return { todo: 0, review: 0, approved: 0 };
    return countByLane({ lanes, kanbanVisible: visible }, files.map(f => f.id));
  }, [lanes, visible, files]);

  return (
    <>
      <div className="ws-debug__divider">Kanban</div>
      {!enabled ? (
        <DisabledNote id="review.kanban" />
      ) : (
        <>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">todo</span>
            <span className="ws-debug__v ws-debug__v--hl">{counts.todo}</span>
          </div>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">in review</span>
            <span className="ws-debug__v ws-debug__v--hl">{counts.review}</span>
          </div>
          <div className="ws-debug__grid">
            <span className="ws-debug__k">approved</span>
            <span className="ws-debug__v ws-debug__v--hl">{counts.approved}</span>
          </div>
          <div className="ws-debug__lod" style={{ gap: 2 }}>
            <button
              type="button"
              className={`ws-debug__chip${visible ? " is-on" : ""}`}
              onClick={() => reviewStateStore.toggleKanban()}
              title="Toggle kanban overlay"
            >
              {visible ? "exit kanban" : "enter kanban"}
            </button>
            <button
              type="button"
              className="ws-debug__chip"
              onClick={() => reviewStateStore.reset()}
              title="Clear all lane assignments"
            >
              clear lanes
            </button>
          </div>
        </>
      )}
    </>
  );
}
