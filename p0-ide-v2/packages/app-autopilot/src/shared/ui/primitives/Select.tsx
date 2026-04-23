import type { SelectHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import "./select.css";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "size"> {
  label?: ReactNode;
  value?: T;
  onChange?: (value: T) => void;
  options: readonly SelectOption<T>[];
  selectSize?: "sm" | "md";
  hint?: string;
}

export function Select<T extends string = string>({
  label,
  value,
  onChange,
  options,
  selectSize = "md",
  hint,
  className,
  id,
  ...rest
}: SelectProps<T>) {
  return (
    <div className={cn("ap-select", `ap-select--${selectSize}`, className)}>
      {label != null && (
        <label htmlFor={id} className="ap-select__label">
          {label}
        </label>
      )}
      <div className="ap-select__field">
        <select
          id={id}
          className="ap-select__native"
          value={value}
          onChange={(e) => onChange?.(e.target.value as T)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={1.8} aria-hidden className="ap-select__chev" />
      </div>
      {hint != null && <div className="ap-select__hint">{hint}</div>}
    </div>
  );
}
