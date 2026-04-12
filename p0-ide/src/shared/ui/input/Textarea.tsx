import { forwardRef, type TextareaHTMLAttributes } from "react";
import type { InputVariant, InputSize, InputTone } from "./TextInput";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  variant?: InputVariant;
  size?: InputSize;
  tone?: InputTone;
  resize?: "none" | "vertical";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      variant = "default",
      size = "md",
      tone = "neutral",
      resize,
      className = "",
      ...rest
    },
    ref,
  ) {
    const invalid = tone === "invalid";
    const cls = `input textarea input--${variant} input--${size}${
      invalid ? " is-invalid" : ""
    }${className ? ` ${className}` : ""}`;
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cls}
        data-resize={resize}
        {...rest}
      />
    );
  },
);
