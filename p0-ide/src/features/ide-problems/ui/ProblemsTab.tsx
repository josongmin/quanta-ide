import { useEffect, useMemo, useState } from "react";
import {
  MOCK_PROBLEMS,
  computeProblemCounts,
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

  useEffect(() => {
    if (snapshot.groups.length === 0) {
      setSnapshot(MOCK_PROBLEMS);
    }
    // 최초 시드만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [active, setActive] = useState<ReadonlySet<ProblemSeverity>>(
    () => new Set<ProblemSeverity>(["error", "warn", "info"]),
  );

  const toggle = (sev: ProblemSeverity) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  return (
    <div className="pb-root">
      <ProblemsToolbar
        counts={counts}
        active={active}
        onToggle={toggle}
        onClear={clear}
      />
      <div className="pb-body">
        <ProblemsList
          groups={snapshot.groups}
          activeSeverities={active}
          onItemActivate={onNavigate}
        />
      </div>
    </div>
  );
}
