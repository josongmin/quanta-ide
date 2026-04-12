import type { ReactNode } from "react";

interface TabsProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function Tabs({ children, className, "aria-label": ariaLabel }: TabsProps) {
  return (
    <div role="tablist" className={`tabs ${className ?? ""}`} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
