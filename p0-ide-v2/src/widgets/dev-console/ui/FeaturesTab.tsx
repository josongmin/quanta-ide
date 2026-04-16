import type { ReactNode } from "react";
import {
  featureRegistry,
  type FeatureRecord,
} from "@/shared/model/feature-registry";
import { formatIsoShort, stateDotClass, stateGlyph } from "./dev-console.utils";

interface FeaturesTabProps {
  features: FeatureRecord[];
  selected: FeatureRecord | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  dependedOnBy: string[];
}

export function FeaturesTab({
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
            {hasPrimary ? "yes" : "\u2014"}
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
        <li className="is-empty">{"\u2014"}</li>
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
