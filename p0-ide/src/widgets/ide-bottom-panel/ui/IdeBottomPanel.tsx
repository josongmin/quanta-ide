import { useMemo } from "react";
import { ActivityRail } from "@/features/ide-activity-rail";
import { BottomPanel, type BottomPanelTab } from "@/features/ide-bottom-panel";
import { selectStatus, useWatcherStore } from "@/entities/watcher";
import { WatcherTab } from "@/features/ide-watcher";
import {
  computeProblemCounts,
  selectProblemsSnapshot,
  useProblemsStore,
} from "@/entities/problems";
import { ProblemsTab } from "@/features/ide-problems";
import {
  computeQuantaDot,
  selectQuantaEvents,
  useQuantaLogStore,
} from "@/entities/quanta-log";
import { QuantaLogTab } from "@/features/ide-quanta-log";
import { TerminalTab } from "@/features/ide-terminal";
import { OutputTab } from "@/features/ide-output";

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
  const problemsSnapshot = useProblemsStore(selectProblemsSnapshot);
  const quantaEvents = useQuantaLogStore(selectQuantaEvents);

  /* 파생값은 반드시 컴포넌트 측에서 useMemo — selector가 매 렌더 새 객체를
     만들면 useSyncExternalStore 가 무한 루프로 판단해 앱이 폭주한다. */
  const problemCounts = useMemo(
    () => computeProblemCounts(problemsSnapshot),
    [problemsSnapshot],
  );
  const quantaDot = useMemo(() => computeQuantaDot(quantaEvents), [quantaEvents]);

  const watcherDot: BottomPanelTab["statusDot"] =
    watcherStatus === "stable"
      ? "ok"
      : watcherStatus === "in-flux"
        ? "warn"
        : "danger";

  /* Problems dot: error → danger, warn → warn, 그 외 → dot 없음 (조용한 상태). */
  const problemsDot: BottomPanelTab["statusDot"] =
    problemCounts.error > 0
      ? "danger"
      : problemCounts.warn > 0
        ? "warn"
        : null;

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
      {
        id: "problems",
        label: "Problems",
        ariaLabel: "Problems — LSP & linter diagnostics",
        icon: <ProblemsIcon />,
        statusDot: problemsDot,
        content: <ProblemsTab />,
      },
      {
        id: "quanta",
        label: "Quanta",
        ariaLabel: "Quanta engine log — structural events",
        icon: <QuantaIcon />,
        statusDot: quantaDot,
        content: <QuantaLogTab />,
      },
      {
        id: "terminal",
        label: "Terminal",
        ariaLabel: "Terminal — shell session",
        icon: <TerminalIcon />,
        statusDot: null,
        content: <TerminalTab />,
      },
      {
        id: "output",
        label: "Output",
        ariaLabel: "Output — external tool logs",
        icon: <OutputIcon />,
        statusDot: null,
        content: <OutputTab />,
      },
    ],
    [watcherDot, problemsDot, quantaDot],
  );

  return (
    <>
      <ActivityRail tabs={tabs} />
      <BottomPanel tabs={tabs} />
    </>
  );
}

/* ── Local icons ────────────────────────────────────────────────────────────
 * Lucide-style: viewBox 24, stroke 2, round caps/joins. 균형있는 그리드.
 * CSS (.ar-icon svg) 에서 rail 컨텍스트일 때만 stroke-width 를 2.4 로 올린다.
 * 이 widget 안에서만 쓰이므로 별도 모듈로 빼지 않는다 (OCP; 재사용 시 승격).
 */
const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/* Watcher — activity (ECG pulse). 살아있는 모니터링. */
function WatcherIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

/* Problems — alert-circle. 표준 diagnostic 심볼. */
function ProblemsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* Quanta — node graph (3 connected nodes). 정적분석 호출 그래프의 축약. */
function QuantaIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <line x1="7" y1="7.5" x2="10.5" y2="16" />
      <line x1="17" y1="7.5" x2="13.5" y2="16" />
      <line x1="7.5" y1="6" x2="16.5" y2="6" />
    </svg>
  );
}

/* Terminal — Lucide 'terminal' glyph: prompt chevron + underline. */
function TerminalIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

/* Output — list (indented log feed). Lucide 'list' 기반. */
function OutputIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
