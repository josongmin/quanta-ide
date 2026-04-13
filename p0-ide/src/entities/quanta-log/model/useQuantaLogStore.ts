import { create } from "zustand";
import type { QuantaEvent, QuantaEventKind, QuantaLogSnapshot } from "./types";

/**
 * Quanta Engine Log store.
 *
 * SRP: 이벤트 스트림 보유. 엔진 어댑터(Phase 2+)가 append로 밀어 넣는다.
 * 버퍼 상한(MAX)을 두고 오래된 이벤트부터 자동 드롭 — ring buffer 느낌.
 */

const MAX_EVENTS = 200;
const INITIAL: QuantaLogSnapshot = { events: [] };

interface QuantaLogState {
  snapshot: QuantaLogSnapshot;
  setSnapshot: (next: QuantaLogSnapshot) => void;
  append: (event: QuantaEvent) => void;
  clear: () => void;
}

export const useQuantaLogStore = create<QuantaLogState>()((set) => ({
  snapshot: INITIAL,
  setSnapshot: (next) => { set({ snapshot: next }); },
  append: (event) => {
    set((state) => {
      let next = [event, ...state.snapshot.events];
      if (next.length > MAX_EVENTS) next = next.slice(0, MAX_EVENTS);
      return { snapshot: { events: next } };
    });
  },
  clear: () => { set({ snapshot: INITIAL }); },
}));

/* ── Selectors ─────────────────────────────────────────────────────────────── */
/* Selector는 state에서 기존 참조만 꺼낸다 — 새 객체/배열 생성 금지
 * (useSyncExternalStore 무한 루프 방지). 파생값은 pure helper + useMemo. */

export const selectQuantaEvents = (s: QuantaLogState): readonly QuantaEvent[] =>
  s.snapshot.events;

/**
 * 최근 이벤트 severity 를 보고 ActivityRail dot 색을 결정.
 * Pure — 컴포넌트에서 `useMemo(() => computeQuantaDot(events), [events])`.
 */
export function computeQuantaDot(
  events: readonly QuantaEvent[],
): "ok" | "warn" | "danger" {
  const limit = Math.min(events.length, 8);
  let hasNotice = false;
  for (let i = 0; i < limit; i += 1) {
    const e = events[i];
    if (e.severity === "warn") return "danger";
    if (e.severity === "notice") hasNotice = true;
  }
  return hasNotice ? "warn" : "ok";
}

/** 존재하는 kind 집합 — 필터 ui가 "가진 것만" 노출할 때 쓰지 않고, 고정 kind를 쓸 수도 있음. */
export const ALL_QUANTA_KINDS: readonly QuantaEventKind[] = [
  "drift",
  "impact",
  "dead",
  "graph",
  "sync",
] as const;
