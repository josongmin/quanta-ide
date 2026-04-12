import { useBottomPanel, type BottomPanelTab } from "@/features/ide-bottom-panel";

interface ActivityRailProps {
  /** 하단 패널에 등록된 탭 목록. 같은 배열을 BottomPanel에 넘겨 단일 출처 유지. */
  tabs: readonly BottomPanelTab[];
}

/**
 * 좌측 신설 아이콘 rail.
 *
 * 책임:
 *  - 등록된 탭의 아이콘을 세로로 나열
 *  - 클릭 시 useBottomPanel.toggle(tabId) 호출
 *  - 활성 탭 강조 + statusDot 표시
 *
 * 비책임:
 *  - 탭 본문 렌더 (BottomPanel 담당)
 *  - 도메인 상태 (각 feature 담당)
 *
 * 이 컴포넌트는 BottomPanel과 *동일한 tabs 배열*을 받는다 — 부모 widget이
 * 한 번만 정의해서 양쪽에 흘려보낸다. SSOT(single source of truth) 보장.
 */
export function ActivityRail({ tabs }: ActivityRailProps) {
  const activeTabId = useBottomPanel((s) => s.activeTabId);
  const toggle = useBottomPanel((s) => s.toggle);

  return (
    <nav className="ar-root" aria-label="Bottom panel tabs">
      <ul className="ar-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <li key={tab.id} className="ar-item">
              <button
                type="button"
                id={`bp-tab-${tab.id}`}
                className={`ar-btn${isActive ? " is-active" : ""}`}
                aria-label={tab.ariaLabel ?? tab.label}
                aria-pressed={isActive}
                title={tab.label}
                onClick={() => { toggle(tab.id); }}
              >
                <span className="ar-icon" aria-hidden>
                  {tab.icon}
                </span>
                {tab.statusDot !== null && tab.statusDot !== undefined ? (
                  <span
                    className={`ar-dot ar-dot-${tab.statusDot}`}
                    aria-hidden
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
