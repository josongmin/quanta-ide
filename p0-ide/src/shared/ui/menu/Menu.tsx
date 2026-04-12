import type { ReactNode } from "react";

interface MenuProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function Menu({ children, className, "aria-label": ariaLabel }: MenuProps) {
  return (
    <div role="menu" className={`menu ${className ?? ""}`} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
