/**
 * Watcher 도메인 타입
 *
 * Tier 0 Persistent Surface(RFC: Flow-Aware Analysis Surfacing)에서
 * 사용자에게 항상 노출되는 vitals/sparkline/now-watching의 데이터 모델.
 *
 * 이 모듈은 UI/zustand에 의존하지 않는다 — 순수 타입만.
 */

/** 분석 신호의 신뢰 상태. UI 색/dot 매핑은 features 계층 책임. */
export type WatcherStatus = "stable" | "in-flux" | "critical";

/** blast radius 시계열 변화 방향. */
export type WatcherTrend = "converging" | "diverging" | "steady";

/** 엔진이 현재 주의 깊게 보고 있는 대상 1건. */
export interface NowWatchingItem {
  /** UI key. 안정적 식별자. */
  id: string;
  /** 사용자에게 보일 라벨. e.g. "strategy_selector.py". */
  label: string;
  /** 부가 사유 (선택). e.g. "high churn". */
  reason?: string;
  /** 클릭 시 점프 대상의 종류. */
  kind: "file" | "api-path" | "symbol";
}

/** AI가 실시간으로 수정 중인 파일 1건. */
export interface LiveDiffEntry {
  id: string;
  file: string;
  linesAdded: number;
  linesRemoved: number;
  summary: string;
  /** 초 단위 경과 시간. */
  agoSec: number;
}

/** 정책/룰 위반 실시간 카운트. */
export interface GuardStatus {
  passed: number;
  warnings: number;
  blocked: number;
  rules: readonly GuardRuleHit[];
}

export interface GuardRuleHit {
  id: string;
  rule: string;
  severity: "pass" | "warn" | "block";
  file?: string;
}

/** 관련 테스트 실시간 상태. */
export interface TestPulseEntry {
  id: string;
  name: string;
  status: "pass" | "fail" | "running" | "pending";
  durationMs?: number;
}

/** 히트맵 셀 — 프로젝트 파일 1개의 실시간 상태. */
export interface HeatmapCell {
  id: string;
  /** 상대 경로. e.g. "codegraph_agent/orchestrator.py" */
  file: string;
  /** 짧은 파일명. */
  shortName: string;
  /** 변경 규모 (lines added + removed). 0이면 untouched. */
  churn: number;
  /** 종합 상태. */
  heat: "idle" | "clean" | "warn" | "block" | "active";
  /** 지금 이 순간 AI가 수정 중인지. */
  editing: boolean;
  /** diff 요약. */
  summary?: string;
  /** +/- */
  linesAdded?: number;
  linesRemoved?: number;
  /** guard 위반 rule 이름. */
  guardHit?: string;
  /** 테스트 상태. */
  testStatus?: "pass" | "fail" | "running" | "none";
  /** 경과 시간 (초). */
  agoSec?: number;
}

/** 롤백 체크포인트 1건. */
export interface RollbackCheckpoint {
  id: string;
  label: string;
  filesChanged: number;
  agoSec: number;
}

/** Watcher가 노출하는 단일 스냅샷. */
export interface WatcherSnapshot {
  /** 현재 blast radius (영향 파일 수). */
  impactedFiles: number;
  /** 신호 신뢰 상태. */
  status: WatcherStatus;
  /** 시계열 트렌드. */
  trend: WatcherTrend;
  /**
   * blast radius sparkline용 시계열.
   * 짧은 윈도우(최근 N분)의 정수 시퀀스.
   * 비어 있을 수 있다 (envelope 시작 직후).
   */
  series: readonly number[];
  /**
   * 현재 envelope 동안 관측된 최대값.
   * sparkline 라벨/회고 카드에서 재사용.
   */
  peak: number;
  /** 엔진이 현재 주시 중인 대상들. 0~3개. */
  nowWatching: readonly NowWatchingItem[];
  /** AI 실시간 변경 피드. */
  liveDiff: readonly LiveDiffEntry[];
  /** 정책/가드 상태. */
  guard: GuardStatus;
  /** 테스트 펄스. */
  testPulse: readonly TestPulseEntry[];
  /** 롤백 체크포인트 스택. */
  rollbackStack: readonly RollbackCheckpoint[];
  /** 파일 히트맵. */
  heatmap: readonly HeatmapCell[];
}
