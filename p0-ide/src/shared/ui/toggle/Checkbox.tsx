import { forwardRef, type ReactNode, type ChangeEvent } from "react";
import { IconCheck } from "../icons";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  size?: "sm" | "md";
  name?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      checked,
      defaultChecked,
      onChange,
      disabled = false,
      label,
      size = "md",
      name,
      id,
      className = "",
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    const cls = `toggle toggle--checkbox toggle--${size}${
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
          className="toggle__input"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          name={name}
          id={id}
          aria-label={ariaLabel}
          onChange={handleChange}
        />
        <span className="toggle__indicator">
          <IconCheck size={10} strokeWidth={3} className="toggle__check" />
        </span>
        {label !== undefined && label !== null && <span className="toggle__label">{label}</span>}
      </label>
    );
  },
);
