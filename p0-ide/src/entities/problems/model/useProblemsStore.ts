import { create } from "zustand";
import type { ProblemCounts, ProblemsSnapshot, ProblemToolCount } from "./types";

/**
 * Problems store
 *
 * 단일 책임: BottomPanel "Problems" 탭이 읽는 diagnostic 스냅샷 보관.
 *
 * LSP/linter adapter(Phase 2+)는 setSnapshot으로 주입한다. store 자체는
 * diagnostic 수집/정렬/필터링 로직을 모른다.
 *
 * SRP: 상태 보유 + setter. OCP: 외부 계산기 교체가 store 변경을 요구하지 않음.
 */

const INITIAL: ProblemsSnapshot = { groups: [] };

interface ProblemsState {
  snapshot: ProblemsSnapshot;
  setSnapshot: (next: ProblemsSnapshot) => void;
  clear: () => void;
}

export const useProblemsStore = create<ProblemsState>()((set) => ({
  snapshot: INITIAL,
  setSnapshot: (next) => { set({ snapshot: next }); },
  clear: () => { set({ snapshot: INITIAL }); },
}));

/* ── Selectors ─────────────────────────────────────────────────────────────── */
/* Selector는 store state에서 *기존 참조*만 꺼낸다. 파생 객체를 만들지 않는다
 * — useSyncExternalStore는 매 getSnapshot 호출 결과의 참조 동등성으로
 * 리렌더 여부를 판단하므로 selector가 매번 새 객체를 만들면 무한 루프에 빠진다.
 * 파생 계산은 아래 pure helper 로 내리고, 소비자는 useMemo 로 캐싱한다. */

export const selectProblemsSnapshot = (s: ProblemsState): ProblemsSnapshot =>
  s.snapshot;

export const selectProblemGroups = (s: ProblemsState) => s.snapshot.groups;

/**
 * Pure helper — 컴포넌트에서 `useMemo(() => computeProblemCounts(snapshot), [snapshot])`
 * 로 캐싱해서 쓴다. store에 두면 setter가 없어도 getSnapshot 마다 새 객체가 나와
 * useSyncExternalStore 가 무한 루프를 감지한다.
 */
export function computeProblemCounts(snapshot: ProblemsSnapshot): ProblemCounts {
  let error = 0;
  let warn = 0;
  let info = 0;
  for (const g of snapshot.groups) {
    for (const it of g.items) {
      if (it.severity === "error") error += 1;
      else if (it.severity === "warn") warn += 1;
      else info += 1;
    }
  }
  return { error, warn, info, total: error + warn + info };
}

/**
 * Source tag 앞부분(툴 이름)만 추출. e.g. "ruff(F401)" → "ruff",
 * "pyright(reportArgumentType)" → "pyright", "eslint" → "eslint".
 */
export function extractProblemTool(source: string): string {
  const i = source.indexOf("(");
  const name = i === -1 ? source : source.slice(0, i);
  return name.trim();
}

/**
 * Snapshot 안에 등장하는 툴별 카운트. 건수 내림차순, 동률이면 이름 오름차순.
 * Toolbar 에서 툴 필터 칩 렌더용. useMemo 로 캐싱해서 쓴다.
 */
export function computeProblemTools(snapshot: ProblemsSnapshot): readonly ProblemToolCount[] {
  const map = new Map<string, number>();
  for (const g of snapshot.groups) {
    for (const it of g.items) {
      const name = extractProblemTool(it.source);
      map.set(name, (map.get(name) ?? 0) + 1);
    }
  }
  return Array.from(map, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}
