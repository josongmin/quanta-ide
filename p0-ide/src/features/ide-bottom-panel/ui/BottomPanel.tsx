import { useMemo } from "react";
import { PanelResizer } from "@/shared/ui";
import type { BottomPanelTab } from "../model/types";
import { useBottomPanel } from "../model/useBottomPanel";

interface BottomPanelProps {
  /** 등록된 탭 목록. 외부(widget)에서 정적으로 주입. */
  tabs: readonly BottomPanelTab[];
}

/**
 * 하단 패널 셸.
 *
 * 사이드 패널과 동일한 1급 시민 — grid가 항상 영역을 보유하고
 * 이 컴포넌트는 그 영역을 채울 뿐. 본문이 비어 있어도 영역은 유지된다.
 *
 * 책임:
 *  - 활성 탭의 content를 렌더
 *
 * 비책임:
 *  - 영역 높이 (CSS grid `--bottom-h`가 결정)
 *  - 탭 활성화/전환 (좌측 ActivityRail이 담당)
 */
export function BottomPanel({ tabs }: BottomPanelProps) {
  const activeTabId = useBottomPanel((s) => s.activeTabId);

  const activeTab = useMemo<BottomPanelTab | null>(() => {
    if (activeTabId === null) return null;
    return tabs.find((t) => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  return (
    <section className="bp-root" aria-label="Bottom panel">
      <PanelResizer cssVar="--bottom-h" side="top" min={80} max={600} />
      {activeTab !== null ? (
        <div
          className="bp-body"
          role="tabpanel"
          aria-labelledby={`bp-tab-${activeTab.id}`}
        >
          {activeTab.content}
        </div>
      ) : (
        <div className="bp-empty" aria-hidden />
      )}
    </section>
  );
}
