import type { ReactNode } from "react";

/**
 * 하단 패널에 등록되는 탭의 정의.
 *
 * 외부 feature(watcher, lint, console 등)가 자기 탭을 *서술*해서
 * 하단 패널 widget에 넘긴다. 하단 패널 자체는 어떤 탭이 들어올지 모른다.
 *
 * SOLID:
 *  - OCP: 새 탭 추가 시 BottomPanel 코드 수정 0. 등록 배열만 늘어남.
 *  - SRP: 탭 정의 = (id, 라벨, 아이콘, 본문 렌더). 셸은 탭의 *내용*을 모름.
 */
export interface BottomPanelTab {
  /** 안정 식별자. selection key. */
  id: string;
  /** 사람용 라벨. i18n 처리는 호출 측 책임. */
  label: string;
  /**
   * 좌측 아이콘 rail에 표시할 아이콘.
   * ReactNode로 받아 임의 SVG/이모지/컴포넌트 모두 허용.
   */
  icon: ReactNode;
  /**
   * 탭 우측 하단의 상태 dot 색.
   * 미지정 시 dot 미표시. status hook 결과를 직접 매핑하지 않고
   * 외부에서 계산한 색만 받음 — 셸이 도메인 의미를 모름.
   */
  statusDot?: "ok" | "warn" | "danger" | null;
  /** 탭 본문. lazy 회피를 위해 ReactNode를 직접 받음. */
  content: ReactNode;
  /** 접근성 라벨. 미지정 시 label 사용. */
  ariaLabel?: string;
}

/**
 * 하단 패널 높이 프리셋.
 *
 * 패널 영역은 사이드 패널처럼 항상 grid에 점유돼 있다 — 이 값은
 * grid `--bottom-h` CSS 변수에 적용되는 *영역 자체의 높이*이지,
 * 본문의 mount 여부가 아니다.
 */
export type BottomPanelHeight = "compact" | "default" | "expanded";

export const BOTTOM_PANEL_HEIGHT_PX: Record<BottomPanelHeight, number> = {
  compact: 120,
  default: 240,
  expanded: 400,
};
