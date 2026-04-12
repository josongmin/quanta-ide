import { create } from "zustand";
import type { BottomPanelHeight } from "./types";

/**
 * 하단 패널 상태 store
 *
 * SRP: 활성 탭 id + 높이 프리셋만 보관. 탭 *목록*은 보관하지 않는다 —
 * 탭은 widget이 props로 받는 정적 등록이다(런타임 등록 X).
 *
 * createPanelStore는 isOpen 단일 상태인 반면, 하단 패널은 4단계 높이
 * 프리셋을 가지므로 별도 store를 둔다.
 */
interface BottomPanelState {
  /** 현재 활성 탭 id. null이면 본문 비움(영역은 유지). */
  activeTabId: string | null;
  /** 높이 프리셋. drag/preset 변경 시 사용. */
  height: BottomPanelHeight;
  /** 탭 활성화. */
  activate: (tabId: string) => void;
  /** 같은 탭 클릭 시 본문 비우기, 다른 탭 클릭 시 전환. 영역은 항상 유지. */
  toggle: (tabId: string) => void;
  /** 본문 비우기. */
  clear: () => void;
  /** 높이 프리셋 설정. */
  setHeight: (h: BottomPanelHeight) => void;
}

export const useBottomPanel = create<BottomPanelState>()((set) => ({
  activeTabId: "watcher",
  height: "default",

  activate: (tabId) => { set({ activeTabId: tabId }); },

  toggle: (tabId) => {
    set((state) => ({
      activeTabId: state.activeTabId === tabId ? null : tabId,
    }));
  },

  clear: () => { set({ activeTabId: null }); },

  setHeight: (height) => { set({ height }); },
}));
