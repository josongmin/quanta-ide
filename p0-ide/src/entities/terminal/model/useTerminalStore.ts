import { create } from "zustand";
import type { TerminalLine, TerminalSession, TerminalSnapshot } from "./types";

/**
 * Terminal store.
 *
 * SRP: shell session 보유 + append. 실제 PTY 연결은 외부 어댑터가 주입.
 * Ring buffer 느낌으로 세션별 라인 상한을 둔다.
 *
 * Selector는 반드시 state에서 기존 참조만 꺼낸다 — 새 배열/객체 생성 금지.
 */

const MAX_LINES_PER_SESSION = 1000;
const INITIAL: TerminalSnapshot = { sessions: [], activeSessionId: "" };

interface TerminalState {
  snapshot: TerminalSnapshot;
  setSnapshot: (next: TerminalSnapshot) => void;
  appendLine: (sessionId: string, line: TerminalLine) => void;
  setActiveSession: (id: string) => void;
  clearActive: () => void;
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  snapshot: INITIAL,
  setSnapshot: (next) => { set({ snapshot: next }); },
  appendLine: (sessionId, line) => {
    set((state) => {
      const sessions = state.snapshot.sessions.map((s): TerminalSession => {
        if (s.id !== sessionId) return s;
        let lines = [...s.lines, line];
        if (lines.length > MAX_LINES_PER_SESSION) {
          lines = lines.slice(-MAX_LINES_PER_SESSION);
        }
        return { ...s, lines };
      });
      return { snapshot: { ...state.snapshot, sessions } };
    });
  },
  setActiveSession: (id) => {
    set((state) => ({ snapshot: { ...state.snapshot, activeSessionId: id } }));
  },
  clearActive: () => {
    set((state) => {
      const sessions = state.snapshot.sessions.map((s): TerminalSession =>
        s.id === state.snapshot.activeSessionId ? { ...s, lines: [] } : s,
      );
      return { snapshot: { ...state.snapshot, sessions } };
    });
  },
}));

/* ── Selectors ─────────────────────────────────────────────────────────────── */

export const selectTerminalSnapshot = (s: TerminalState): TerminalSnapshot =>
  s.snapshot;
export const selectTerminalSessions = (s: TerminalState): readonly TerminalSession[] =>
  s.snapshot.sessions;
export const selectActiveSessionId = (s: TerminalState): string =>
  s.snapshot.activeSessionId;
