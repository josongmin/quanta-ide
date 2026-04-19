// Uniform ON/OFF pill used across the debug HUD. Replaces the sea of
// `<label><input type="checkbox">` rows that all looked identical — the
// pill fills with accent colour when on, shows a dim outline when off,
// and falls back to a "locked" look when disabled. Exactly one visual
// vocabulary for every boolean toggle in the HUD.

export interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Disabled reason is surfaced as a tooltip so the user can tell why a
   *  control is locked without guessing. */
  disabled?: boolean;
  disabledReason?: string;
  /** Optional hint shown under the label when the toggle is on. Use for
   *  "what does this do" explanations. */
  hint?: string;
  /** Optional 2-letter badge or emoji shown on the left — kind swatch
   *  dot, feature icon, etc. */
  leading?: React.ReactNode;
}

export function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
  disabledReason,
  hint,
  leading,
}: ToggleRowProps) {
  const title = disabled && disabledReason ? disabledReason : undefined;
  return (
    <button
      type="button"
      className={`ws-debug__toggle${checked ? " is-on" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      title={title}
    >
      <span className="ws-debug__toggle-dot" aria-hidden>
        {leading ?? (checked ? "●" : "○")}
      </span>
      <span className="ws-debug__toggle-label">
        {label}
        {hint && checked ? <span className="ws-debug__toggle-hint"> — {hint}</span> : null}
      </span>
      <span className="ws-debug__toggle-state" aria-hidden>
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}
