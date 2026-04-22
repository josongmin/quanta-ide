// TaskQueueView — agent task queue with status × priority × kind filters.
// --------------------------------------------------------------------
// Top: 6 status counter tiles (backlog / todo / in-progress / review /
// done / blocked). rAF-animated numbers so the counters feel alive.
// Middle: 3 filter chip rows — status (AND), priority (AND), task-kind
// (AND). Chips are togglable multi-select inside each axis; chips across
// axes AND together.
// Main: ranked list sorted by priority desc → status order. Each row
// carries a priority pill, task-kind chip, title, owner avatar (authorHue
// dot), estimated/spent cost bar, ETA, and a dependency badge when the
// task is blocked. Clicking a row selects the first target file; a
// "Run now" stub button lives on the right.
//
// Reference: Linear / Jira / GitHub Projects task patterns adapted for
// AI agents; Motion / Claude Code task queue surfaces.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  AI_TASK_KINDS,
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

const STATUS_ORDER: readonly AgentTaskStatus[] = [
  "backlog", "todo", "in-progress", "review", "done", "blocked",
];

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

const STATUS_SORT: Record<AgentTaskStatus, number> = {
  "in-progress": 0, review: 1, todo: 2, blocked: 3, backlog: 4, done: 5,
};

const PRIORITY_ORDER: readonly AgentTaskPriority[] = ["critical", "high", "medium", "low"];

const PRIORITY_KOREAN: Record<AgentTaskPriority, string> = {
  critical: "치명", high: "높음", medium: "보통", low: "낮음",
};

const PRIORITY_TINT: Record<AgentTaskPriority, string> = {
  critical: color.danger,
  high: color.warn,
  medium: color.accent,
  low: color.text2,
};

const PRIORITY_RANK: Record<AgentTaskPriority, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명", "fix-bug": "버그 수정", "add-feature": "기능 추가",
  refactor: "리팩터", test: "테스트 작성", review: "코드 리뷰",
};

const KEYFRAMES = `
@keyframes tq-enter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes tq-item { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
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
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** rAF interpolated counter 0→target. */
function useCounter(target: number, durationMs: number = 620): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function TaskQueueViewImpl({ ctx }: Props): ReactElement | null {
  const tasks = useMemo<AgentTask[]>(() => synthAgentTasks(ctx.tree), [ctx.tree]);

  const [statusFilter, setStatusFilter] = useState<Set<AgentTaskStatus>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<AgentTaskPriority>>(new Set());
  const [kindFilter, setKindFilter] = useState<Set<AITaskKind>>(new Set());

  const statusCounts = useMemo(() => {
    const c: Record<AgentTaskStatus, number> = {
      backlog: 0, todo: 0, "in-progress": 0, review: 0, done: 0, blocked: 0,
    };
    for (const t of tasks) c[t.status]++;
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    const rows = tasks.filter(t => {
      if (statusFilter.size > 0 && !statusFilter.has(t.status)) return false;
      if (priorityFilter.size > 0 && !priorityFilter.has(t.priority)) return false;
      if (kindFilter.size > 0 && !kindFilter.has(t.task)) return false;
      return true;
    });
    rows.sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return STATUS_SORT[a.status] - STATUS_SORT[b.status];
    });
    return rows;
  }, [tasks, statusFilter, priorityFilter, kindFilter]);

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

  const totalSpent = filtered.reduce((s, t) => s + t.spentUsd, 0);
  const totalEst = filtered.reduce((s, t) => s + t.estimatedCostUsd, 0);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Task Queue</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            총 {tasks.length}건 · 필터 {filtered.length}건 · 예상 {fmtCost(totalEst)} / 사용 {fmtCost(totalSpent)}
          </div>
        </div>
      </header>

      <div style={tilesGrid}>
        {STATUS_ORDER.map((s, i) => (
          <StatusTile key={s} status={s} count={statusCounts[s]} index={i} />
        ))}
      </div>

      <div style={filtersBlock}>
        <FilterRow
          title="Status"
          items={STATUS_ORDER.map(s => ({ id: s, label: `${STATUS_KOREAN[s]} · ${statusCounts[s]}`, tint: STATUS_TINT[s] }))}
          active={statusFilter as Set<string>}
          onToggle={id => toggle(statusFilter, setStatusFilter, id as AgentTaskStatus)}
          onClear={() => setStatusFilter(new Set())}
        />
        <FilterRow
          title="Priority"
          items={PRIORITY_ORDER.map(p => ({ id: p, label: PRIORITY_KOREAN[p], tint: PRIORITY_TINT[p] }))}
          active={priorityFilter as Set<string>}
          onToggle={id => toggle(priorityFilter, setPriorityFilter, id as AgentTaskPriority)}
          onClear={() => setPriorityFilter(new Set())}
        />
        <FilterRow
          title="Kind"
          items={AI_TASK_KINDS.map(k => ({ id: k, label: TASK_KOREAN[k], tint: color.accent }))}
          active={kindFilter as Set<string>}
          onToggle={id => toggle(kindFilter, setKindFilter, id as AITaskKind)}
          onClear={() => setKindFilter(new Set())}
        />
      </div>

      <div style={listStyle}>
        {filtered.length === 0 ? (
          <div style={{ padding: space[5], color: color.text3, fontSize: font.size.sm, textAlign: "center" }}>
            조건에 맞는 태스크가 없습니다.
          </div>
        ) : filtered.map((t, i) => (
          <TaskRow
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
}

function toggle<T extends string>(
  set: Set<T>,
  setter: (next: Set<T>) => void,
  id: T,
): void {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  setter(next);
}

function StatusTile({ status, count, index }: { status: AgentTaskStatus; count: number; index: number }): ReactElement {
  const tint = STATUS_TINT[status];
  const animated = useCounter(count, 620);
  return (
    <div style={{
      ...tileStyle,
      animationDelay: `${index * 40}ms`,
    }}>
      <span style={{
        fontSize: font.size.xxs,
        color: color.text2,
        letterSpacing: font.letter.ultra,
        textTransform: "uppercase",
        fontWeight: font.weight.semibold,
      }}>{STATUS_KOREAN[status]}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: space[1], marginTop: 2 }}>
        <span style={{
          fontSize: 28,
          fontFamily: font.mono,
          fontWeight: font.weight.bold,
          color: count > 0 ? tint : color.text3,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}>
          {Math.round(animated)}
        </span>
        {count > 0 && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: tint }} />
        )}
      </div>
    </div>
  );
}

interface ChipItem { id: string; label: string; tint: string }

function FilterRow({
  title, items, active, onToggle, onClear,
}: {
  title: string;
  items: ChipItem[];
  active: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
      <span style={{
        fontSize: font.size.xxs,
        color: color.text2,
        letterSpacing: font.letter.ultra,
        textTransform: "uppercase",
        fontWeight: font.weight.semibold,
        minWidth: 60,
      }}>{title}</span>
      {items.map(it => {
        const on = active.has(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            style={{
              padding: `${space[1]}px ${space[3]}px`,
              border: `1px solid ${on ? it.tint : color.border}`,
              background: on ? `${it.tint}18` : color.bg1,
              color: on ? it.tint : color.text1,
              fontFamily: font.sans,
              fontSize: font.size.xs,
              fontWeight: font.weight.medium,
              borderRadius: radius.pill,
              cursor: "pointer",
              transition: `all ${transition.base}`,
            }}
          >
            {it.label}
          </button>
        );
      })}
      {active.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: `${space[1]}px ${space[2]}px`,
            border: "none",
            background: "transparent",
            color: color.text3,
            fontSize: font.size.xxs,
            cursor: "pointer",
            fontFamily: font.sans,
          }}
        >
          초기화
        </button>
      )}
    </div>
  );
}

function TaskRow({ task, index, onFocus }: { task: AgentTask; index: number; onFocus: () => void }): ReactElement {
  const pTint = PRIORITY_TINT[task.priority];
  const sTint = STATUS_TINT[task.status];
  const hue = authorHue(task.owner);
  const spent = Math.max(0, Math.min(1, task.estimatedCostUsd === 0 ? 0 : task.spentUsd / task.estimatedCostUsd));
  return (
    <div
      style={{
        ...rowStyle,
        animationDelay: `${Math.min(index, 30) * 18}ms`,
      }}
    >
      <button type="button" onClick={onFocus} style={rowMainBtn}>
        <span style={{
          padding: `${space[1]}px ${space[2]}px`,
          borderRadius: radius.sm,
          background: `${pTint}18`,
          color: pTint,
          fontFamily: font.mono,
          fontSize: 10,
          fontWeight: font.weight.semibold,
          minWidth: 52,
          textAlign: "center",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          {PRIORITY_KOREAN[task.priority]}
        </span>
        <span style={{
          padding: `${space[0]}px ${space[2]}px`,
          borderRadius: radius.pill,
          border: `1px solid ${color.border}`,
          background: color.bg1,
          color: color.text1,
          fontSize: font.size.xxs,
          fontWeight: font.weight.medium,
          flexShrink: 0,
        }}>
          {TASK_KOREAN[task.task]}
        </span>
        <span style={{
          fontSize: font.size.sm,
          color: color.text0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
          textAlign: "left",
        }}>{task.title}</span>

        <span title={task.owner} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: space[1],
          flexShrink: 0,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: "50%",
            background: `hsl(${hue}deg 62% 52%)`,
          }} />
          <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>{task.owner}</span>
        </span>

        <span style={{ display: "flex", flexDirection: "column", gap: 2, width: 120, flexShrink: 0 }}>
          <span style={{ display: "flex", justifyContent: "space-between", fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>
            <span>{fmtCost(task.spentUsd)}</span>
            <span style={{ color: color.text3 }}>/ {fmtCost(task.estimatedCostUsd)}</span>
          </span>
          <span style={{ height: 4, background: color.bg3, borderRadius: radius.pill, position: "relative", overflow: "hidden" }}>
            <span style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${spent * 100}%`,
              background: sTint,
              borderRadius: radius.pill,
            }} />
          </span>
        </span>

        <span style={{
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: color.text2,
          minWidth: 48,
          textAlign: "right",
          flexShrink: 0,
        }}>
          {fmtEta(task.etaMinutes)}
        </span>

        {task.blockedBy && (
          <span style={{
            padding: `${space[0]}px ${space[2]}px`,
            borderRadius: radius.sm,
            background: `${color.danger}18`,
            color: color.danger,
            fontSize: font.size.xxs,
            fontFamily: font.mono,
            flexShrink: 0,
          }}>
            dep: {task.blockedBy}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); }}
        style={runBtnStyle}
      >
        Run now
      </button>
    </div>
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
  animation: "tq-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  fontFamily: font.sans,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: space[4],
};

const tilesGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: space[3],
  marginBottom: space[4],
};

const tileStyle: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "tq-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const filtersBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  marginBottom: space[3],
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  animation: "tq-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const rowMainBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: 0,
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
};

const runBtnStyle: CSSProperties = {
  padding: `${space[1]}px ${space[3]}px`,
  borderRadius: radius.sm,
  border: `1px solid ${color.border}`,
  background: color.bg1,
  color: color.text1,
  fontSize: font.size.xxs,
  fontFamily: font.sans,
  fontWeight: font.weight.medium,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  transition: `all ${transition.base}`,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const TaskQueueView = memo(TaskQueueViewImpl);
