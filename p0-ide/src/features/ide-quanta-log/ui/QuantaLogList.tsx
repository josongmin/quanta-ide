import type { QuantaEvent, QuantaEventKind } from "@/entities/quanta-log";
import { formatAbsolute, formatRelative } from "../lib/formatRelative";
import { QuantaKindGlyph } from "./QuantaKindGlyph";

interface QuantaLogListProps {
  events: readonly QuantaEvent[];
  activeKinds: ReadonlySet<QuantaEventKind>;
  onEventActivate?: (event: QuantaEvent) => void;
}

export function QuantaLogList({ events, activeKinds, onEventActivate }: QuantaLogListProps) {
  const visible = events.filter((e) => activeKinds.has(e.kind));

  if (visible.length === 0) {
    return (
      <div className="ql-empty" aria-live="polite">
        watching for structural changes…
      </div>
    );
  }

  return (
    <ul className="ql-list" role="log" aria-label="Quanta engine events">
      {visible.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            className={`ql-row ql-kind-${e.kind} ql-sev-${e.severity}`}
            onClick={() => onEventActivate?.(e)}
            title={`${formatAbsolute(e.at)} — ${e.kind}`}
          >
            <span className="ql-row-rail" aria-hidden />
            <span className="ql-row-time">{formatRelative(e.at)}</span>
            <span className="ql-row-glyph" aria-hidden>
              <QuantaKindGlyph kind={e.kind} />
            </span>
            <span className="ql-row-body">
              <span className="ql-row-title">{e.title}</span>
              {e.detail !== undefined ? (
                <span className="ql-row-detail">{e.detail}</span>
              ) : null}
            </span>
            {e.meta !== undefined ? (
              <span className="ql-row-meta">{e.meta}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
