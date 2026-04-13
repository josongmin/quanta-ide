import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_QUANTA_KINDS,
  MOCK_QUANTA_LOG,
  selectQuantaEvents,
  useQuantaLogStore,
  type QuantaEvent,
  type QuantaEventKind,
} from "@/entities/quanta-log";
import { QuantaToolbar } from "./QuantaToolbar";
import { QuantaLogList } from "./QuantaLogList";

interface QuantaLogTabProps {
  onEventActivate?: (event: QuantaEvent) => void;
}

/**
 * Quanta engine log tab. 정체성 표면.
 *
 * 탭 전환시 필터 상태가 유지되도록 ui-state는 여기 둔다.
 * 빈 store면 mock seed를 1회 주입 (Watcher와 같은 패턴).
 */
export function QuantaLogTab({ onEventActivate }: QuantaLogTabProps) {
  const events = useQuantaLogStore(selectQuantaEvents);
  const setSnapshot = useQuantaLogStore((s) => s.setSnapshot);
  const clear = useQuantaLogStore((s) => s.clear);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (events.length === 0) {
      setSnapshot(MOCK_QUANTA_LOG);
    }
  }, [events, setSnapshot]);

  const [active, setActive] = useState<ReadonlySet<QuantaEventKind>>(
    () => new Set(ALL_QUANTA_KINDS),
  );

  const toggle = (k: QuantaEventKind) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const counts = useMemo(() => {
    const c: Record<QuantaEventKind, number> = {
      drift: 0,
      impact: 0,
      dead: 0,
      graph: 0,
      sync: 0,
    };
    for (const e of events) c[e.kind] += 1;
    return c;
  }, [events]);

  return (
    <div className="ql-root">
      <QuantaToolbar
        kinds={ALL_QUANTA_KINDS}
        active={active}
        counts={counts}
        onToggle={toggle}
        onClear={clear}
      />
      <div className="ql-body">
        <QuantaLogList events={events} activeKinds={active} onEventActivate={onEventActivate} />
      </div>
    </div>
  );
}
