import { useEffect, useMemo } from "react";
import {
  MOCK_TERMINAL,
  selectActiveSessionId,
  selectTerminalSessions,
  useTerminalStore,
  type TerminalSession,
} from "@/entities/terminal";
import { TerminalSessionStrip } from "./TerminalSessionStrip";
import { TerminalBuffer } from "./TerminalBuffer";

/**
 * Terminal 탭 조립.
 *
 * - sessions 가 비어있으면 MOCK 시드 1회
 * - 활성 세션을 찾아 TerminalBuffer 에 전달
 * - 활성 세션이 없거나 못 찾으면 빈 상태
 */
export function TerminalTab() {
  const sessions = useTerminalStore(selectTerminalSessions);
  const activeId = useTerminalStore(selectActiveSessionId);
  const setSnapshot = useTerminalStore((s) => s.setSnapshot);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const clearActive = useTerminalStore((s) => s.clearActive);

  useEffect(() => {
    if (sessions.length === 0) {
      setSnapshot(MOCK_TERMINAL);
    }
    // 최초 시드만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active: TerminalSession | undefined = useMemo(() => {
    if (sessions.length === 0) return undefined;
    const byId = sessions.find((s) => s.id === activeId);
    return byId ?? sessions[0];
  }, [sessions, activeId]);

  return (
    <div className="tm-root">
      <TerminalSessionStrip
        sessions={sessions}
        activeId={active === undefined ? "" : active.id}
        onSelect={setActiveSession}
        onClear={clearActive}
      />
      {active === undefined ? (
        <div className="tm-empty" aria-live="polite">
          no terminal session
        </div>
      ) : (
        <TerminalBuffer session={active} />
      )}
    </div>
  );
}
