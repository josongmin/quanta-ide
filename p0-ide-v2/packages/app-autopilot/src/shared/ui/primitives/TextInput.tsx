import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@quanta/ui-kit/lib";
import "./text-input.css";

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  inputSize?: "sm" | "md";
  mono?: boolean;
}

export function TextInput({
  label,
  hint,
  error,
  leading,
  trailing,
  inputSize = "md",
  mono,
  className,
  id,
  ...rest
}: TextInputProps) {
  return (
    <div className={cn("ap-input", `ap-input--${inputSize}`, error && "is-error", mono && "is-mono", className)}>
      {label != null && (
        <label htmlFor={id} className="ap-input__label">
          {label}
        </label>
      )}
      <div className="ap-input__field">
        {leading != null && <span className="ap-input__lead">{leading}</span>}
        <input id={id} className="ap-input__native" {...rest} />
        {trailing != null && <span className="ap-input__trail">{trailing}</span>}
      </div>
      {error != null ? (
        <div className="ap-input__hint is-error">{error}</div>
      ) : hint != null ? (
        <div className="ap-input__hint">{hint}</div>
      ) : null}
    </div>
  );
}
