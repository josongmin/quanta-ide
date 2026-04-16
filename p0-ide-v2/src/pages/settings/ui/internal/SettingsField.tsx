import { cn } from "@/shared/lib";
import type { SettingFieldContribution } from "@/shared/model/feature-registry";

export function SettingsField({
  field,
  value,
  disabled,
  onChange,
}: {
  field: SettingFieldContribution;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  return (
    <li className={cn(`settings-field settings-field--${field.type}`, disabled && "is-disabled")}>
      <div className="settings-field__text">
        <span className="settings-field__label">{field.label}</span>
        {field.description && <span className="settings-field__desc">{field.description}</span>}
        <span className="settings-field__key">{field.key}</span>
      </div>
      <div className="settings-field__control">
        {field.type === "boolean" && (
          <label className="settings-field__toggle">
            <input
              type="checkbox"
              checked={Boolean(value)}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="settings-field__toggle-track" aria-hidden />
          </label>
        )}
        {field.type === "string" && (
          <input
            type="text"
            className="settings-field__input"
            value={String(value ?? "")}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {field.type === "number" && (
          <input
            type="number"
            className="settings-field__input settings-field__input--num"
            value={Number(value ?? 0)}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}
        {field.type === "enum" && field.enumValues && (
          <select
            className="settings-field__select"
            value={String(value ?? field.default)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            {field.enumValues.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
      </div>
    </li>
  );
}
