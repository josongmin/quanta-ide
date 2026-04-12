import type { QuantaEventKind } from "@/entities/quanta-log";

interface QuantaToolbarProps {
  kinds: readonly QuantaEventKind[];
  active: ReadonlySet<QuantaEventKind>;
  counts: Record<QuantaEventKind, number>;
  onToggle: (k: QuantaEventKind) => void;
  onClear: () => void;
  /** Live indicator — store가 "수신 중"임을 시각적으로 보여줌. */
  live?: boolean;
}

const KIND_LABEL: Record<QuantaEventKind, string> = {
  drift: "drift",
  impact: "impact",
  dead: "dead",
  graph: "graph",
  sync: "sync",
};

export function QuantaToolbar({
  kinds,
  active,
  counts,
  onToggle,
  onClear,
  live = true,
}: QuantaToolbarProps) {
  return (
    <div className="ql-toolbar">
      <span className="bp-panel-title">Quanta</span>
      <span className="bp-toolbar-sep" aria-hidden />
      <div className="ql-toolbar-live" aria-live="polite">
        <span className={`ql-live-dot${live ? " is-live" : ""}`} aria-hidden />
        <span className="ql-live-label">{live ? "live" : "paused"}</span>
      </div>
      <div className="ql-toolbar-filters" role="group" aria-label="Kind filters">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            className={`ql-chip ql-chip-${k}${active.has(k) ? " is-active" : ""}`}
            onClick={() => { onToggle(k); }}
            aria-pressed={active.has(k)}
            title={`${KIND_LABEL[k]}: ${String(counts[k])}`}
          >
            <span className="ql-chip-label">{KIND_LABEL[k]}</span>
            <span className="ql-chip-count">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="ql-toolbar-spacer" />
      <button
        type="button"
        className="ql-toolbar-action"
        onClick={onClear}
        aria-label="Clear engine log"
        title="Clear"
      >
        clear
      </button>
    </div>
  );
}
