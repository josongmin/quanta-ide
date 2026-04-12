import { forwardRef, type ReactNode } from "react";

interface TabProps {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-controls"?: string;
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  {
    active,
    onClick,
    disabled,
    icon,
    badge,
    children,
    className,
    "aria-label": ariaLabel,
    "aria-controls": ariaControls,
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      tabIndex={active ? 0 : -1}
      aria-selected={active}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`tab${active ? " is-active" : ""} ${className ?? ""}`}
    >
      {icon && <span className="tab__icon">{icon}</span>}
      <span className="tab__label">{children}</span>
      {badge && <span className="tab__badge">{badge}</span>}
    </button>
  );
});
