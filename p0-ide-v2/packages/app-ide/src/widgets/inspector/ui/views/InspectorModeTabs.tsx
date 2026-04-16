import { INSPECTOR_MODES } from "@quanta/app-ide/entities/inspector";
import { focusStore, useFocusStore, type InspectorMode } from "@quanta/app-ide/stores/focus-store";

export function InspectorModeTabs({
  counts,
}: {
  counts: Partial<Record<InspectorMode, number | undefined>>;
}) {
  const mode = useFocusStore((s) => s.mode);
  return (
    <nav className="insp__modes" role="tablist" aria-label="Inspector mode">
      {INSPECTOR_MODES.map((m) => {
        const active = m.id === mode;
        const count = counts[m.id];
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`insp__mode${active ? " is-active" : ""}`}
            onClick={() => focusStore.setMode(m.id)}
          >
            <span>{m.label}</span>
            {count !== undefined && count > 0 && (
              <span className="insp__mode-count">{count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
