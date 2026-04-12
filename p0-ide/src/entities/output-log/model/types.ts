/**
 * Output domain — 외부 툴(LSP, linter, bundler)의 raw 로그 채널 집합.
 *
 * Quanta 탭이 "엔진의 해석"을 보여준다면, Output 탭은 "원재료"다 —
 * 각 툴이 자체 포맷으로 뱉는 라인을 그대로 스트리밍한다.
 */

export type OutputLevel = "info" | "warn" | "error" | "debug";

export interface OutputLine {
  id: string;
  at: number;
  level: OutputLevel;
  text: string;
}

export interface OutputChannel {
  id: string;
  label: string;
  lines: readonly OutputLine[];
}

export interface OutputSnapshot {
  channels: readonly OutputChannel[];
  activeChannelId: string;
}
