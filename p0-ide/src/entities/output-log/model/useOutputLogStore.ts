import { create } from "zustand";
import type { OutputChannel, OutputLine, OutputSnapshot } from "./types";

/**
 * Output store — 외부 툴 채널 로그.
 *
 * Selector는 state의 기존 참조만 꺼낸다 (파생 객체 금지).
 * 파생 리스트(활성 채널 라인 등)는 컴포넌트에서 useMemo.
 */

const MAX_LINES = 1000;
const INITIAL: OutputSnapshot = { channels: [], activeChannelId: "" };

interface OutputState {
  snapshot: OutputSnapshot;
  setSnapshot: (next: OutputSnapshot) => void;
  setActiveChannel: (id: string) => void;
  appendLine: (channelId: string, line: OutputLine) => void;
  clearActive: () => void;
}

export const useOutputLogStore = create<OutputState>()((set) => ({
  snapshot: INITIAL,
  setSnapshot: (next) => { set({ snapshot: next }); },
  setActiveChannel: (id) => {
    set((state) => ({ snapshot: { ...state.snapshot, activeChannelId: id } }));
  },
  appendLine: (channelId, line) => {
    set((state) => {
      const channels = state.snapshot.channels.map((c): OutputChannel => {
        if (c.id !== channelId) return c;
        const lines = [...c.lines, line];
        if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
        return { ...c, lines };
      });
      return { snapshot: { ...state.snapshot, channels } };
    });
  },
  clearActive: () => {
    set((state) => {
      const channels = state.snapshot.channels.map((c): OutputChannel =>
        c.id === state.snapshot.activeChannelId ? { ...c, lines: [] } : c,
      );
      return { snapshot: { ...state.snapshot, channels } };
    });
  },
}));

/* ── Selectors ─────────────────────────────────────────────────────────────── */

export const selectOutputSnapshot = (s: OutputState): OutputSnapshot =>
  s.snapshot;
export const selectOutputChannels = (s: OutputState): readonly OutputChannel[] =>
  s.snapshot.channels;
export const selectActiveChannelId = (s: OutputState): string =>
  s.snapshot.activeChannelId;
