import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@quanta/ui-kit/lib";
import "./button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  kbd?: string;
}

export function Button({
  variant = "secondary",
  size = "md",
  leading,
  trailing,
  kbd,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "ap-btn",
        `ap-btn--${variant}`,
        `ap-btn--${size}`,
        className,
      )}
      {...rest}
    >
      {leading != null && <span className="ap-btn__lead">{leading}</span>}
      <span className="ap-btn__label">{children}</span>
      {trailing != null && <span className="ap-btn__trail">{trailing}</span>}
      {kbd != null && <span className="ap-btn__kbd">{kbd}</span>}
    </button>
  );
}
