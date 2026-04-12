import { forwardRef, type InputHTMLAttributes } from "react";

export type InputVariant = "default" | "ghost" | "minimal";
export type InputSize = "sm" | "md" | "lg";
export type InputTone = "neutral" | "invalid";
export type TextInputType = "text" | "search" | "email" | "password";

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  variant?: InputVariant;
  size?: InputSize;
  tone?: InputTone;
  type?: TextInputType;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      variant = "default",
      size = "md",
      type = "text",
      tone = "neutral",
      className = "",
      ...rest
    },
    ref,
  ) {
    const invalid = tone === "invalid";
    const cls = `input input--${variant} input--${size}${
      invalid ? " is-invalid" : ""
    }${className ? ` ${className}` : ""}`;
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cls}
        {...rest}
      />
    );
  },
);
