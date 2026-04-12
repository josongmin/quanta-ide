import { forwardRef, type ReactNode, type ChangeEvent } from "react";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  name?: string;
  id?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    checked,
    defaultChecked,
    onChange,
    disabled = false,
    label,
    size = "md",
    className = "",
    "aria-label": ariaLabel,
    name,
    id,
  },
  ref,
) {
  const cls = `toggle toggle--switch toggle--${size}${
    disabled ? " is-disabled" : ""
  }${className ? ` ${className}` : ""}`;
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked);
  };
  return (
    <label className={cls}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        className="toggle__input"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        id={id}
        aria-label={ariaLabel}
        onChange={handleChange}
      />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      {label !== undefined && label !== null && <span className="toggle__label">{label}</span>}
    </label>
  );
});
