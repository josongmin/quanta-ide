import { forwardRef, type TextareaHTMLAttributes } from "react";
import type { InputVariant, InputSize } from "./TextInput";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  variant?: InputVariant;
  size?: InputSize;
  invalid?: boolean;
  resize?: "none" | "vertical";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      variant = "default",
      size = "md",
      invalid = false,
      resize,
      className = "",
      ...rest
    },
    ref,
  ) {
    const cls = `input textarea input--${variant} input--${size}${
      invalid ? " is-invalid" : ""
    }${className ? ` ${className}` : ""}`;
    return (
      <textarea
        ref={ref}
        className={cls}
        data-resize={resize}
        {...rest}
      />
    );
  },
);
