import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "accent";
export type BadgeSize = "sm" | "md";
export type BadgeShape = "rounded" | "pill";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  shape?: BadgeShape;
  children?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    variant = "neutral",
    size = "sm",
    shape = "rounded",
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const cls = `badge badge--${variant} badge--${size} badge--${shape}${className ? ` ${className}` : ""}`;
  return (
    <span ref={ref} className={cls} {...rest}>
      {children}
    </span>
  );
});
