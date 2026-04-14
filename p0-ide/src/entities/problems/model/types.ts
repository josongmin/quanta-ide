/**
 * Problems domain — LSP/lint diagnostic 통합 리스트의 entity 모델.
 *
 * 데이터는 Phase 1.5에선 mock fixture. Phase 2에서 LSP/linter 어댑터가
 * 동일 인터페이스로 ProblemsStore에 주입한다.
 */

export type ProblemSeverity = "error" | "warn" | "info";

export interface ProblemItem {
  id: string;
  severity: ProblemSeverity;
  /** 1-based line. */
  line: number;
  /** 1-based column. */
  col: number;
  message: string;
  /** 출처 태그. e.g. "ts(6133)", "eslint", "ruff". */
  source: string;
}

export interface ProblemFileGroup {
  /** repo-relative path. */
  path: string;
  items: readonly ProblemItem[];
}

export interface ProblemsSnapshot {
  groups: readonly ProblemFileGroup[];
}

/** Derived counters — selector에서 계산, store엔 저장 안 함. */
export interface ProblemCounts {
  error: number;
  warn: number;
  info: number;
  total: number;
}

/** 툴(linter/LSP) 단위 집계. Toolbar 의 툴 필터 칩 렌더용. */
export interface ProblemToolCount {
  /** e.g. "pyright", "ruff", "eslint". source 의 `(`앞 부분. */
  name: string;
  count: number;
}
