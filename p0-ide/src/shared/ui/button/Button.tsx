import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "default" | "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "default",
      size = "md",
      type = "button",
      className = "",
      children,
      ...rest
    },
    ref,
  ) {
    const cls = `btn btn--${variant} btn--${size}${className ? ` ${className}` : ""}`;
    return (
      <button ref={ref} type={type} className={cls} {...rest}>
        {children}
      </button>
    );
  },
);
