import {
  featureRegistry,
  type RegistryEvent,
} from "@quanta/shell/stores/feature-registry";
import { eventCommandId, eventFeatureId, eventMessage, formatTime } from "./dev-console.utils";

interface EventsTabProps {
  events: readonly RegistryEvent[];
}

export function EventsTab({ events }: EventsTabProps) {
  const handleClear = () => featureRegistry.clearEvents();
  return (
    <div className="devc__events">
      <div className="devc__events-bar">
        <button type="button" className="devc__btn" onClick={handleClear}>
          clear
        </button>
      </div>
      <div className="devc__events-list">
        {events.length === 0 ? (
          <div className="devc__empty">No events recorded yet.</div>
        ) : (
          events.map((e, i) => (
            <div className="devc__event" key={`${e.t}-${i}`}>
              <span className="devc__event-time">{formatTime(e.t)}</span>
              <span className={`devc__event-kind devc__event-kind--${e.kind}`}>
                {e.kind}
              </span>
              <span className="devc__event-feat">{eventFeatureId(e) ?? ""}</span>
              <span className="devc__event-msg">
                {eventCommandId(e) ?? eventMessage(e) ?? ""}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
