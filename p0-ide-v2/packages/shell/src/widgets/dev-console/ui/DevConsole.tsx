import type { MouseEvent as ReactMouseEvent } from "react";
import { uiBus, useUiBus } from "@quanta/shell/stores/ui-bus";
import { useDevConsole } from "./use-dev-console";
import { FeaturesTab } from "./FeaturesTab";
import { EventsTab } from "./EventsTab";
import "./dev-console.css";

export function DevConsoleHost() {
  const open = useUiBus((s) => s.devConsoleOpen);
  if (!open) return null;
  return <DevConsole />;
}

function DevConsole() {
  const {
    tab, setTab,
    filter, setFilter,
    includeDevOnly, setIncludeDevOnly,
    selectedId, setSelectedId,
    sortedFeatures, selected, dependedOnBy,
    filteredEvents,
  } = useDevConsole();

  const handleBackdrop = () => uiBus.toggleDevConsole(false);
  const stopProp = (e: ReactMouseEvent) => e.stopPropagation();

  return (
    <div className="devc__backdrop" onMouseDown={handleBackdrop}>
      <div className="devc" role="dialog" aria-label="Dev Console" onMouseDown={stopProp}>
        <div className="devc__top">
          <div className="devc__tabs">
            {(["features", "events", "graph"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`devc__tab${tab === t ? " is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "features" ? "Features" : t === "events" ? "Events" : "Registry Graph"}
              </button>
            ))}
          </div>

          <div className="devc__top-right">
            <input
              className="devc__filter"
              placeholder="filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <label className="devc__devonly">
              <input
                type="checkbox"
                checked={includeDevOnly}
                onChange={(e) => setIncludeDevOnly(e.target.checked)}
              />
              include dev-only
            </label>
            <button
              type="button"
              className="devc__close"
              aria-label="Close"
              onClick={() => uiBus.toggleDevConsole(false)}
            >
              ×
            </button>
          </div>
        </div>

        <div className="devc__body">
          {tab === "features" && (
            <FeaturesTab
              features={sortedFeatures}
              selected={selected}
              selectedId={selectedId}
              onSelect={setSelectedId}
              dependedOnBy={dependedOnBy}
            />
          )}
          {tab === "events" && <EventsTab events={filteredEvents} />}
          {tab === "graph" && (
            <div className="devc__graph">
              v0.2+ — feature dependency graph
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
