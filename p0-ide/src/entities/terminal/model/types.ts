/**
 * Terminal domain — 전통적 shell 하단 패널.
 *
 * Phase 1.5 에선 실제 PTY 연결이 없다. mock buffer 가 보여주는 라인을
 * 어댑터(Phase 2+)가 그대로 뒤이어 append 할 수 있도록 인터페이스만 맞춰 둔다.
 *
 * 라인 타입:
 *   stdout  — 일반 출력
 *   stderr  — 빨강 틴트
 *   prompt  — 사용자가 친 명령 + 프롬프트 머리글 (accent 틴트)
 *   system  — 툴이 주입한 메타 (dim)
 */

export type TerminalLineKind = "stdout" | "stderr" | "prompt" | "system";

export interface TerminalLine {
  id: string;
  kind: TerminalLineKind;
  text: string;
}

export interface TerminalSession {
  id: string;
  label: string;
  /** 프롬프트 헤더. "~/quanta-ide main ●" 같은 문자열 그대로. */
  promptHead: string;
  lines: readonly TerminalLine[];
}

export interface TerminalSnapshot {
  sessions: readonly TerminalSession[];
  activeSessionId: string;
}
