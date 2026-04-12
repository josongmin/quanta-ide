import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { ButtonVariant, ButtonSize } from "./Button";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "aria-label"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  "aria-label": string;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
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
    const cls = `btn btn--icon btn--${variant} btn--${size}${className ? ` ${className}` : ""}`;
    return (
      <button ref={ref} type={type} className={cls} {...rest}>
        {children}
      </button>
    );
  },
);
