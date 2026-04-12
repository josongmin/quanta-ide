import { forwardRef, type ReactNode } from "react";

export type MenuItemVariant = "default" | "danger";

interface MenuItemProps {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: ReactNode;
  disabled?: boolean;
  active?: boolean;
  variant?: MenuItemVariant;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  {
    children,
    icon,
    shortcut,
    disabled,
    active,
    variant = "default",
    onClick,
    className,
    "aria-label": ariaLabel,
  },
  ref,
) {
  const variantClass = variant === "danger" ? " menu__item--danger" : "";
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={`menu__item${active ? " is-active" : ""}${variantClass} ${className ?? ""}`}
      disabled={disabled}
      aria-disabled={disabled ?? undefined}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {icon && <span className="menu__icon">{icon}</span>}
      <span className="menu__label">{children}</span>
      {shortcut && <span className="menu__shortcut">{shortcut}</span>}
    </button>
  );
});
