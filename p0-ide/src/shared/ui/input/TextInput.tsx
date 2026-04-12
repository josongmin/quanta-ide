import { forwardRef, type InputHTMLAttributes } from "react";

export type InputVariant = "default" | "ghost" | "minimal";
export type InputSize = "sm" | "md" | "lg";
export type TextInputType = "text" | "search" | "email" | "password";

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  variant?: InputVariant;
  size?: InputSize;
  invalid?: boolean;
  type?: TextInputType;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      variant = "default",
      size = "md",
      type = "text",
      invalid = false,
      className = "",
      ...rest
    },
    ref,
  ) {
    const cls = `input input--${variant} input--${size}${
      invalid ? " is-invalid" : ""
    }${className ? ` ${className}` : ""}`;
    return <input ref={ref} type={type} className={cls} {...rest} />;
  },
);
