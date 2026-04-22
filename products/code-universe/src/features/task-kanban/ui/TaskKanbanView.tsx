// TaskKanbanView — agent task board with 4 live columns + WIP guard.
// --------------------------------------------------------------------
// Columns: Todo | In Progress | Review | Done. Each column header
// shows the card count and total estimated cost. Backlog and Blocked
// tasks are collapsed into banners pinned above the board so they
// remain visible without crowding the working columns.
//
// Cards show title, priority dot, owner chip, file-count chip, a
// spent/estimated cost mini-bar, and ETA. Hover lifts the card
// (scale 1.02 + shadow-md). Clicking a card selects the first
// target file. A WIP banner warns the user when In-Progress breaches
// the 5-task limit.
//
// Reference: Kanban method (David J. Anderson 2010); Linear board;
// Claude Code agent board.

import { memo, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  authorHue,
  synthAgentTasks,
  type AITaskKind,
  type AgentTask,
  type AgentTaskPriority,
  type AgentTaskStatus,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const COLUMNS: readonly AgentTaskStatus[] = ["todo", "in-progress", "review", "done"];

const STATUS_KOREAN: Record<AgentTaskStatus, string> = {
  backlog: "백로그", todo: "대기", "in-progress": "진행 중",
  review: "리뷰", done: "완료", blocked: "블록",
};

const STATUS_TINT: Record<AgentTaskStatus, string> = {
  backlog: color.text3,
  todo: color.text2,
  "in-progress": color.accent,
  review: color.warn,
  done: color.success,
  blocked: color.danger,
};

const PRIORITY_TINT: Record<AgentTaskPriority, string> = {
  critical: color.danger,
  high: color.warn,
  medium: color.accent,
  low: color.text2,
};

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명", "fix-bug": "버그 수정", "add-feature": "기능 추가",
  refactor: "리팩터", test: "테스트 작성", review: "코드 리뷰",
};

const WIP_LIMIT = 5;

const KEYFRAMES = `
@keyframes tk-enter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes tk-card { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
`;

function fmtCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtEta(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h${rem}`;
}

function TaskKanbanViewImpl({ ctx }: Props): ReactElement | null {
  const tasks = useMemo<AgentTask[]>(() => synthAgentTasks(ctx.tree), [ctx.tree]);

  const groups = useMemo(() => {
    const map: Record<AgentTaskStatus, AgentTask[]> = {
      backlog: [], todo: [], "in-progress": [], review: [], done: [], blocked: [],
    };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div style={emptyStyle}>
        <style>{KEYFRAMES}</style>
        <div style={{ color: color.text3, fontSize: font.size.md, fontFamily: font.sans }}>
          에이전트 태스크가 없습니다.
        </div>
      </div>
    );
  }

  const wipCount = groups["in-progress"].length;
  const overWip = wipCount > WIP_LIMIT;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Task Kanban</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            총 {tasks.length}건 · 진행 중 {wipCount}건 · WIP limit {WIP_LIMIT}
          </div>
        </div>
      </header>

      {overWip && (
        <div style={wipBanner}>
          <span style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.danger }}>
            WIP 초과
          </span>
          <span style={{ fontSize: font.size.xs, color: color.text1 }}>
            진행 중 {wipCount}건 &gt; 한계 {WIP_LIMIT}건 — 병목이 생길 가능성이 큽니다.
          </span>
        </div>
      )}

      <div style={collapsedBanners}>
        <CollapsedBanner label={STATUS_KOREAN.backlog} tasks={groups.backlog} tint={STATUS_TINT.backlog} />
        <CollapsedBanner label={STATUS_KOREAN.blocked} tasks={groups.blocked} tint={STATUS_TINT.blocked} />
      </div>

      <div style={boardStyle}>
        {COLUMNS.map((s, ci) => {
          const col = groups[s];
          const totalEst = col.reduce((sum, t) => sum + t.estimatedCostUsd, 0);
          return (
            <div key={s} style={{ ...columnStyle, animationDelay: `${ci * 40}ms` }}>
              <div style={colHeaderStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: space[2] }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_TINT[s] }} />
                  <span style={{
                    fontSize: font.size.xs,
                    fontWeight: font.weight.semibold,
                    color: color.text0,
                    textTransform: "uppercase",
                    letterSpacing: font.letter.ultra,
                  }}>
                    {STATUS_KOREAN[s]}
                  </span>
                  <span style={{
                    fontSize: font.size.xxs,
                    fontFamily: font.mono,
                    color: color.text2,
                    padding: `0 ${space[2]}px`,
                    borderRadius: radius.pill,
                    background: color.bg3,
                  }}>
                    {col.length}
                  </span>
                </span>
                <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
                  {fmtCost(totalEst)}
                </span>
              </div>
              <div style={cardListStyle}>
                {col.length === 0 ? (
                  <div style={emptyColStyle}>—</div>
                ) : col.map((t, i) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    index={i}
                    onFocus={() => {
                      const first = t.targetFileIds[0];
                      if (first) ctx.dispatch.selectEntity(first);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CollapsedBanner({
  label, tasks, tint,
}: { label: string; tasks: AgentTask[]; tint: string }): ReactElement {
  return (
    <div style={bannerStyle}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tint }} />
      <span style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.text0 }}>{label}</span>
      <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>{tasks.length}건</span>
    </div>
  );
}

function TaskCard({
  task, index, onFocus,
}: { task: AgentTask; index: number; onFocus: () => void }): ReactElement {
  const [hover, setHover] = useState(false);
  const pTint = PRIORITY_TINT[task.priority];
  const hue = authorHue(task.owner);
  const spent = Math.max(0, Math.min(1, task.estimatedCostUsd === 0 ? 0 : task.spentUsd / task.estimatedCostUsd));
  return (
    <button
      type="button"
      onClick={onFocus}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...cardStyle,
        transform: hover ? "scale(1.02)" : "scale(1)",
        boxShadow: hover ? shadow.md : shadow.xs,
        borderColor: hover ? color.borderStrong : color.border,
        animationDelay: `${Math.min(index, 30) * 18}ms`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: pTint, flexShrink: 0 }} />
        <span style={{
          fontSize: font.size.sm,
          color: color.text0,
          fontWeight: font.weight.medium,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
          textAlign: "left",
        }}>
          {task.title}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginTop: space[2] }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          background: color.bg3,
          fontSize: font.size.xxs,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: `hsl(${hue}deg 62% 52%)`,
          }} />
          <span style={{ color: color.text1, fontFamily: font.mono }}>{task.owner}</span>
        </span>
        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          background: color.bg3,
          color: color.text2,
          fontSize: font.size.xxs,
          fontFamily: font.mono,
        }}>
          {task.targetFileIds.length} file{task.targetFileIds.length > 1 ? "s" : ""}
        </span>
        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          border: `1px solid ${color.border}`,
          color: color.text2,
          fontSize: font.size.xxs,
        }}>
          {TASK_KOREAN[task.task]}
        </span>
      </div>

      <div style={{ marginTop: space[2] }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono, marginBottom: 2 }}>
          <span>{fmtCost(task.spentUsd)} / {fmtCost(task.estimatedCostUsd)}</span>
          <span>{fmtEta(task.etaMinutes)}</span>
        </div>
        <div style={{ height: 4, background: color.bg3, borderRadius: radius.pill, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${spent * 100}%`,
            background: STATUS_TINT[task.status],
          }} />
        </div>
      </div>
    </button>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "tk-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  fontFamily: font.sans,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: space[3],
};

const wipBanner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.danger}`,
  background: `${color.danger}10`,
  marginBottom: space[3],
};

const collapsedBanners: CSSProperties = {
  display: "flex",
  gap: space[3],
  marginBottom: space[3],
};

const bannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const boardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  alignItems: "start",
};

const columnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
  minHeight: 200,
  animation: "tk-card 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const colHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: space[3],
};

const cardListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const cardStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  fontFamily: font.sans,
  font: "inherit",
  cursor: "pointer",
  textAlign: "left",
  transition: `transform ${transition.base}, box-shadow ${transition.base}, border-color ${transition.base}`,
  animation: "tk-card 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const emptyColStyle: CSSProperties = {
  color: color.text3,
  fontSize: font.size.xs,
  textAlign: "center",
  padding: space[3],
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const TaskKanbanView = memo(TaskKanbanViewImpl);
