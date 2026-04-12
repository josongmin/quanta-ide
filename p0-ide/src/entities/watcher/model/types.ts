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
}
