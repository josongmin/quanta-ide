/**
 * createPanelStore — overlay/modal/panel용 Zustand store 팩토리
 *
 * 모든 overlay store의 공통 베이스(isOpen, open, close, toggle)를 제공하고
 * feature별 추가 상태/액션은 `extra` 슬라이스로 확장한다.
 *
 * 사용 예:
 *
 *   // 1) 단순 toggle
 *   export const useSimulateChange = createPanelStore();
 *
 *   // 2) 추가 상태 포함
 *   export const useCommandPalette = createPanelStore<{ query: string }>(
 *     (set) => ({
 *       query: "",
 *       open:   () => set({ isOpen: true, query: "" }),
 *       setQuery: (q: string) => set({ query: q }),
 *     })
 *   );
 *
 *   // 3) open에 payload 필요한 경우 (open/toggle override)
 *   export const useRiskDrawer = createPanelStore<{ anchor: RiskAnchor | null }>(
 *     (set) => ({
 *       anchor: null,
 *       open:   (anchor?: RiskAnchor) => set({ isOpen: true, anchor: anchor ?? null }),
 *       toggle: (anchor?: RiskAnchor) =>
 *         set((s) => ({ isOpen: !s.isOpen, anchor: !s.isOpen ? (anchor ?? null) : s.anchor })),
 *     })
 *   );
 */

import { create } from "zustand";
import type { StateCreator, StoreApi } from "zustand";

/* ── Base shape every panel store gets ─────────────────────────────────────── */
export interface PanelBase {
  isOpen: boolean;
  open: (...args: never[]) => void;
  close: () => void;
  toggle: (...args: never[]) => void;
}

/* ── Extra slice type helper ────────────────────────────────────────────────── */
type ExtraSlice<T> = T extends object ? T : object;

/* ── Factory ────────────────────────────────────────────────────────────────── */
export function createPanelStore<Extra extends object = object>(
  extra?: (
    set: StoreApi<PanelBase & ExtraSlice<Extra>>["setState"],
    get: StoreApi<PanelBase & ExtraSlice<Extra>>["getState"],
  ) => Partial<PanelBase> & ExtraSlice<Extra>
) {
  type S = PanelBase & ExtraSlice<Extra>;

  const creator: StateCreator<S> = (set, get) => {
    const base: PanelBase = {
      isOpen: false,
      open:   () => { set({ isOpen: true } as Partial<S>); },
      close:  () => { set({ isOpen: false } as Partial<S>); },
      toggle: () => { set((s) => ({ isOpen: !s.isOpen } as Partial<S>)); },
    };

    if (!extra) return base as S;

    const extraSlice = extra(
      set,
      get,
    );

    // extra가 base 액션을 override할 수 있도록 spread 순서 유지
    return { ...base, ...extraSlice } as S;
  };

  return create<S>()(creator);
}
