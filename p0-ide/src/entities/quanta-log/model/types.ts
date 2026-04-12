/**
 * Quanta Engine Log — 정적분석 엔진이 뱉는 구조 이벤트 스트림.
 *
 * 이 탭은 우리 제품의 정체성 표면이다 — "코드 구조 무결성 인텔리전스"가
 * 실제로 뭘 감지하고 있는지 사용자에게 끊김없이 보여주는 창.
 *
 * 이벤트는 시간 역순(신규가 위)으로 렌더되며 각 kind마다 의미가 다르다:
 *  - graph  : 호출 그래프/인덱스 (재)빌드 같은 내부 작업 마커
 *  - drift  : 함수/모듈의 구조 변경 감지 (signature, exports, deps 등)
 *  - impact : drift가 실제로 영향 주는 범위 계산 결과
 *  - dead   : 사용처 없음으로 판정된 심볼/파일
 *  - sync   : 외부 tool (LSP, git, watcher)와의 동기화 이벤트
 */

export type QuantaEventKind = "graph" | "drift" | "impact" | "dead" | "sync";

export type QuantaEventSeverity = "info" | "notice" | "warn";

export interface QuantaEvent {
  id: string;
  /** epoch ms. 렌더 측에서 포맷. */
  at: number;
  kind: QuantaEventKind;
  severity: QuantaEventSeverity;
  /** 짧은 제목. 파일명/심볼명이 주로 들어감. */
  title: string;
  /** 한 줄 설명. 생략 가능. */
  detail?: string;
  /** 보조 메트릭. "312 nodes · 48 edges Δ · 84ms" 같은 자유 포맷. */
  meta?: string;
}

export interface QuantaLogSnapshot {
  /** 최신이 index 0. 렌더 측은 그대로 map. */
  events: readonly QuantaEvent[];
}
