import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  featureRegistry,
  useFeatureRegistry,
  type FeatureRecord,
  type FeatureState,
  type RegistryEvent,
} from "@/shared/model/feature-registry";
import { uiBus, useUiBus } from "@/shared/model/ui-bus";
import "./dev-console.css";

type TabId = "features" | "events" | "graph";

const STATE_ORDER: Record<FeatureState, number> = {
  error: 0,
  active: 1,
  disabled: 2,
};

function pad(n: number, w: number): string {
  return n.toString().padStart(w, "0");
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}.${pad(d.getMilliseconds(), 3)}`;
}

function formatIsoShort(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
}

function stateDotClass(s: FeatureState): string {
  return `devc__feat-dot devc__feat-dot--${s}`;
}

function stateGlyph(s: FeatureState): string {
  if (s === "active") return "●";
  if (s === "disabled") return "○";
  return "⚠";
}

function eventFeatureId(e: RegistryEvent): string | undefined {
  return "featureId" in e ? e.featureId : undefined;
}

function eventCommandId(e: RegistryEvent): string | undefined {
  return "commandId" in e ? e.commandId : undefined;
}

function eventMessage(e: RegistryEvent): string | undefined {
  return "message" in e ? e.message : undefined;
}

export function DevConsoleHost() {
  const open = useUiBus((s) => s.devConsoleOpen);
  if (!open) return null;
  return <DevConsole />;
}

function DevConsole() {
  const [tab, setTab] = useState<TabId>("features");
  const [filter, setFilter] = useState("");
  const [includeDevOnly, setIncludeDevOnly] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const features = useFeatureRegistry((s) => s.features);
  const events = useFeatureRegistry((s) => s.events);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        uiBus.toggleDevConsole(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sortedFeatures = useMemo(() => {
    const all: FeatureRecord[] = [];
    for (const f of features.values()) {
      if (!includeDevOnly && f.visibility === "dev-only") continue;
      all.push(f);
    }
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (f) =>
            f.id.toLowerCase().includes(q) ||
            f.title.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q),
        )
      : all;
    return filtered.sort((a, b) => {
      const sd = STATE_ORDER[a.state] - STATE_ORDER[b.state];
      if (sd !== 0) return sd;
      return a.title.localeCompare(b.title);
    });
  }, [features, includeDevOnly, filter]);

  const selected = selectedId ? features.get(selectedId) : undefined;

  const dependedOnBy = useMemo(() => {
    if (!selected) return [] as string[];
    const out: string[] = [];
    for (const f of features.values()) {
      if (f.id === selected.id) continue;
      if (f.dependsOn?.includes(selected.id)) out.push(f.id);
    }
    return out.sort();
  }, [features, selected]);

  const filteredEvents = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        (eventFeatureId(e) ?? "").toLowerCase().includes(q) ||
        (eventCommandId(e) ?? "").toLowerCase().includes(q) ||
        (eventMessage(e) ?? "").toLowerCase().includes(q) ||
        e.kind.includes(q),
    );
  }, [events, filter]);

  const handleBackdrop = () => uiBus.toggleDevConsole(false);
  const stopProp = (e: ReactMouseEvent) => e.stopPropagation();

  return (
    <div className="devc__backdrop" onMouseDown={handleBackdrop}>
      <div
        className="devc"
        role="dialog"
        aria-label="Dev Console"
        onMouseDown={stopProp}
      >
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
              placeholder="filter…"
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

interface FeaturesTabProps {
  features: FeatureRecord[];
  selected: FeatureRecord | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  dependedOnBy: string[];
}

function FeaturesTab({
  features,
  selected,
  selectedId,
  onSelect,
  dependedOnBy,
}: FeaturesTabProps) {
  return (
    <div className="devc__features">
      <div className="devc__feat-list">
        {features.length === 0 ? (
          <div className="devc__feat-empty">No features.</div>
        ) : (
          features.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`devc__feat-row${selectedId === f.id ? " is-selected" : ""}`}
              onClick={() => onSelect(f.id)}
            >
              <span className={stateDotClass(f.state)}>{stateGlyph(f.state)}</span>
              <span className="devc__feat-id">{f.id}</span>
              <span className="devc__feat-state">{f.state}</span>
            </button>
          ))
        )}
      </div>
      <div className="devc__detail">
        {selected ? (
          <FeatureDetail feature={selected} dependedOnBy={dependedOnBy} />
        ) : (
          <div className="devc__detail-empty">Select a feature to inspect.</div>
        )}
      </div>
    </div>
  );
}

interface FeatureDetailProps {
  feature: FeatureRecord;
  dependedOnBy: string[];
}

function FeatureDetail({ feature, dependedOnBy }: FeatureDetailProps) {
  const commandCount = feature.commands?.length ?? 0;
  const shortcutCount = feature.shortcuts?.length ?? 0;
  const settingCount = feature.settings?.length ?? 0;
  const hasPrimary = feature.primary !== undefined;

  const handleDisable = () => featureRegistry.setState(feature.id, "disabled");
  const handleEnable = () => featureRegistry.setState(feature.id, "active");
  const handleClearError = () => featureRegistry.setState(feature.id, "active");

  return (
    <>
      <Section title="Identity">
        <dl className="devc__kv">
          <dt>id</dt>
          <dd>{feature.id}</dd>
          <dt>title</dt>
          <dd>{feature.title}</dd>
          <dt>version</dt>
          <dd>{feature.version}</dd>
          <dt>visibility</dt>
          <dd>{feature.visibility}</dd>
          <dt>category</dt>
          <dd>{feature.category}</dd>
        </dl>
      </Section>

      <Section title="State">
        <dl className="devc__kv">
          <dt>state</dt>
          <dd className={feature.state === "error" ? "is-error" : undefined}>
            {feature.state}
          </dd>
          <dt>loadedAt</dt>
          <dd>{formatIsoShort(feature.loadedAt)}</dd>
          <dt>loadMs</dt>
          <dd>{feature.loadMs} ms</dd>
          {feature.errorMessage !== undefined && (
            <>
              <dt>error</dt>
              <dd className="is-error">{feature.errorMessage}</dd>
            </>
          )}
        </dl>
      </Section>

      <Section title="Contributions">
        <dl className="devc__kv">
          <dt>commands</dt>
          <dd>{commandCount}</dd>
          <dt>shortcuts</dt>
          <dd>{shortcutCount}</dd>
          <dt>settings</dt>
          <dd>{settingCount}</dd>
          <dt>workspace</dt>
          <dd className={hasPrimary ? undefined : "is-muted"}>
            {hasPrimary ? "yes" : "—"}
          </dd>
        </dl>
      </Section>

      <Section title="Depends On">
        <DepList items={feature.dependsOn ? [...feature.dependsOn] : []} />
      </Section>

      <Section title="Depended On By">
        <DepList items={dependedOnBy} />
      </Section>

      <div className="devc__actions">
        {feature.state === "error" && (
          <button
            type="button"
            className="devc__btn devc__btn--danger"
            onClick={handleClearError}
          >
            Clear Error
          </button>
        )}
        {feature.state === "disabled" ? (
          <button type="button" className="devc__btn" onClick={handleEnable}>
            Enable
          </button>
        ) : (
          <button type="button" className="devc__btn" onClick={handleDisable}>
            Disable
          </button>
        )}
      </div>
    </>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="devc__section">
      <div className="devc__section-head">{title}</div>
      {children}
    </div>
  );
}

interface DepListProps {
  items: string[];
}

function DepList({ items }: DepListProps) {
  if (items.length === 0) {
    return (
      <ul className="devc__deplist">
        <li className="is-empty">—</li>
      </ul>
    );
  }
  return (
    <ul className="devc__deplist">
      {items.map((id) => (
        <li key={id}>{id}</li>
      ))}
    </ul>
  );
}

interface EventsTabProps {
  events: readonly RegistryEvent[];
}

function EventsTab({ events }: EventsTabProps) {
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
