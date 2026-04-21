import { cn } from "@quanta/ui-kit/lib";
import {
  featureRegistry,
  type FeatureRecord,
} from "@quanta/shell/stores/feature-registry";
import { preferences } from "@quanta/shell/stores/preferences";
import { toast } from "@quanta/shell/stores/toast-store";
import { SettingsField } from "./SettingsField";

export function SettingsFeatureCard({
  feature,
  values,
  onChange,
}: {
  feature: FeatureRecord;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const hasSettings = (feature.settings?.length ?? 0) > 0;
  const disabled = feature.state !== "active";

  function toggleFeatureState() {
    const next = !disabled;
    preferences.setFeatureEnabled(feature.id, !next);
    featureRegistry.setState(feature.id, next ? "disabled" : "active");
    toast.info(
      `${feature.title} ${next ? "disabled" : "enabled"}`,
      feature.description,
      "settings",
    );
  }

  return (
    <li className={cn("settings-card", disabled && "is-disabled")} data-feature={feature.id}>
      <header className="settings-card__h">
        <div className="settings-card__title-col">
          <div className="settings-card__title-row">
            <h3 className="settings-card__title">{feature.title}</h3>
            {feature.badge && (
              <span className={`settings-card__badge settings-card__badge--${feature.badge}`}>
                {feature.badge}
              </span>
            )}
            <span className="settings-card__version">v{feature.version}</span>
          </div>
          <p className="settings-card__desc">{feature.description}</p>
          {feature.dependsOn && feature.dependsOn.length > 0 && (
            <div className="settings-card__deps">
              <span className="settings-card__deps-k">depends on</span>
              {feature.dependsOn.map((d) => (
                <span key={d} className="settings-card__dep">{d}</span>
              ))}
            </div>
          )}
        </div>
        <div className="settings-card__aside">
          {feature.state === "error" && (
            <span className="settings-card__state settings-card__state--error">
              <span className="settings-card__state-dot" aria-hidden />
              error
            </span>
          )}
          <label className="settings-card__toggle">
            <input
              type="checkbox"
              checked={!disabled}
              onChange={toggleFeatureState}
              aria-label={`Enable ${feature.title}`}
            />
            <span className="settings-card__toggle-track" aria-hidden />
          </label>
        </div>
      </header>

      {hasSettings && (
        <ul className="settings-fields">
          {feature.settings!.map((field) => (
            <SettingsField
              key={field.key}
              field={field}
              value={values[field.key]}
              disabled={disabled}
              onChange={(v) => onChange(field.key, v)}
            />
          ))}
        </ul>
      )}

      {feature.commands && feature.commands.length > 0 && (
        <div className="settings-card__commands">
          <span className="settings-card__commands-label">Commands</span>
          <div className="settings-card__commands-list">
            {feature.commands.map((c) => (
              <span key={c.id} className="settings-card__command" title={c.description}>
                <span className="settings-card__command-title">{c.title}</span>
                {c.keybinding && <kbd className="settings-card__kbd">{c.keybinding}</kbd>}
              </span>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
