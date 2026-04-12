import { forwardRef, type ReactNode } from "react";

interface MenuItemProps {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: ReactNode;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { children, icon, shortcut, disabled, active, danger, onClick, className, "aria-label": ariaLabel },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      className={`menu__item${active ? " is-active" : ""}${danger ? " menu__item--danger" : ""} ${className ?? ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {icon && <span className="menu__icon">{icon}</span>}
      <span className="menu__label">{children}</span>
      {shortcut && <span className="menu__shortcut">{shortcut}</span>}
    </button>
  );
});
