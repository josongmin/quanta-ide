import type { InputHTMLAttributes } from "react";
import { cn } from "@quanta/ui-kit/lib";
import "./toggle.css";

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export function Toggle({ label, description, checked, className, ...rest }: ToggleProps) {
  return (
    <label className={cn("ap-toggle", checked && "is-on", className)}>
      <input type="checkbox" checked={checked} {...rest} />
      <span className="ap-toggle__track">
        <span className="ap-toggle__thumb" />
      </span>
      {(label != null || description != null) && (
        <span className="ap-toggle__text">
          {label != null && <span className="ap-toggle__label">{label}</span>}
          {description != null && <span className="ap-toggle__desc">{description}</span>}
        </span>
      )}
    </label>
  );
}
