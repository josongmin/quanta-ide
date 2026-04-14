import { useEffect, useMemo, useRef, useState } from "react";
import {
  MOCK_PROBLEMS,
  computeProblemCounts,
  computeProblemTools,
  selectProblemsSnapshot,
  useProblemsStore,
  type ProblemFileGroup,
  type ProblemItem,
  type ProblemSeverity,
} from "@/entities/problems";
import { ProblemsToolbar } from "./ProblemsToolbar";
import { ProblemsList } from "./ProblemsList";

interface ProblemsTabProps {
  /** 부모가 editor로 점프 시키기 위해 받는다. Phase 1.5 에선 미사용. */
  onNavigate?: (group: ProblemFileGroup, item: ProblemItem) => void;
}

/**
 * Problems 탭 셸.
 *
 * 책임:
 *  - ProblemsStore 구독 + mock seed (1회)
 *  - severity 필터 ui-state 보유 (탭 전환시 유지되도록 여기 둠)
 *  - Toolbar/List 조립
 */
export function ProblemsTab({ onNavigate }: ProblemsTabProps) {
  const snapshot = useProblemsStore(selectProblemsSnapshot);
  const setSnapshot = useProblemsStore((s) => s.setSnapshot);
  const clear = useProblemsStore((s) => s.clear);

  const counts = useMemo(() => computeProblemCounts(snapshot), [snapshot]);
  const tools = useMemo(() => computeProblemTools(snapshot), [snapshot]);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (snapshot.groups.length === 0) {
      setSnapshot(MOCK_PROBLEMS);
    }
  }, [snapshot, setSnapshot]);

  const [active, setActive] = useState<ReadonlySet<ProblemSeverity>>(
    () => new Set<ProblemSeverity>(["error", "warn", "info"]),
  );

  /** 제외된 툴 집합 — 빈 집합 = 전체 표시. 스냅샷에 새 툴이 들어와도
   * 자동으로 기본 "보임"이 되도록 "exclude" 의미로 관리한다. */
  const [excludedTools, setExcludedTools] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const toggle = (sev: ProblemSeverity) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  const toggleTool = (name: string) => {
    setExcludedTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="pb-root">
      <ProblemsToolbar
        counts={counts}
        active={active}
        onToggle={toggle}
        tools={tools}
        excludedTools={excludedTools}
        onToggleTool={toggleTool}
        onClear={clear}
      />
      <div className="pb-body">
        <ProblemsList
          groups={snapshot.groups}
          activeSeverities={active}
          excludedTools={excludedTools}
          onItemActivate={onNavigate}
        />
      </div>
    </div>
  );
}
