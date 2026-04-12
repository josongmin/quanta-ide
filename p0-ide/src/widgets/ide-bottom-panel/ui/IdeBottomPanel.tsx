import { useMemo } from "react";
import { ActivityRail } from "@/features/ide-activity-rail";
import { BottomPanel, type BottomPanelTab } from "@/features/ide-bottom-panel";
import { selectStatus, useWatcherStore } from "@/entities/watcher";
import { WatcherTab } from "@/features/ide-watcher";

/**
 * Widget: IdeBottomPanel
 *
 * 하단 패널의 *조립자*. 어떤 탭이 들어갈지 여기서 한 번 정의하고
 * 같은 배열을 ActivityRail(좌측 아이콘)과 BottomPanel(본문)에 흘려보낸다.
 *
 * SSOT: 탭 등록은 이 한 곳뿐. Phase 4에서 Lint/Console/Quick Analyze 등을
 * 추가할 때도 이 컴포넌트의 tabs 배열에만 항목을 늘리면 된다 (OCP).
 *
 * SOLID:
 *  - SRP: 조립만. 도메인 로직 0.
 *  - OCP: 새 탭 추가 = 배열 한 줄 추가.
 *  - DIP: BottomPanel/ActivityRail은 BottomPanelTab 인터페이스에만 의존.
 */
export function IdeBottomPanel() {
  const watcherStatus = useWatcherStore(selectStatus);

  const watcherDot: BottomPanelTab["statusDot"] =
    watcherStatus === "stable"
      ? "ok"
      : watcherStatus === "in-flux"
        ? "warn"
        : "danger";

  const tabs = useMemo<readonly BottomPanelTab[]>(
    () => [
      {
        id: "watcher",
        label: "Watcher",
        ariaLabel: "Watcher — live blast radius",
        icon: <WatcherIcon />,
        statusDot: watcherDot,
        content: <WatcherTab />,
      },
    ],
    [watcherDot],
  );

  return (
    <>
      <ActivityRail tabs={tabs} />
      <BottomPanel tabs={tabs} />
    </>
  );
}

/* ── Local icon ─────────────────────────────────────────────────────────────
 * RFC: ⚡ glyph. 이 widget 안에서만 쓰이므로 별도 모듈로 빼지 않는다.
 * Phase 4에서 다른 widget도 같은 아이콘을 쓰게 되면 shared/ui/icons로 승격.
 */
function WatcherIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 2 3 9h4l-1 5 6-7H8l1-5Z" />
    </svg>
  );
}
