import type { QuantaEventKind } from "@/entities/quanta-log";

/**
 * Quanta 이벤트 kind별 정체성 글리프. 각 kind는 고유한 기호 + 의미를 갖는다.
 * 작고(12px) 중립적이며, 색은 부모 (.ql-row.ql-kind-*) 가 currentColor로 결정.
 *
 *  graph   : ●   (샘플된 노드 — 그래프 연산)
 *  drift   : △   (변형 — 구조가 움직임)
 *  impact  : ↯   (bolt — 영향이 퍼짐)
 *  dead    : ◌   (빈 원 — 사용되지 않는 자리)
 *  sync    : ↻   (회전 — 외부와 맞춤)
 */
export function QuantaKindGlyph({ kind }: { kind: QuantaEventKind }) {
  switch (kind) {
    case "graph":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="2.2" fill="currentColor" />
          <circle cx="6" cy="6" r="4.8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        </svg>
      );
    case "drift":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M6 1.8 L10.3 9.6 L1.7 9.6 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case "impact":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M7 1 L3 7 H6 L5 11 L9 5 H6 L7 1 Z" fill="currentColor" />
        </svg>
      );
    case "dead":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
        </svg>
      );
    case "sync":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M9.5 4.2 A4 4 0 1 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path d="M9.5 1.8 L9.5 4.4 L7 4.4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
