import type { ReactNode } from "react";

export interface PanelTitleProps {
  children: ReactNode;
  className?: string;
}

export function PanelTitle({ children, className = "" }: PanelTitleProps) {
  const cls = `panel__title${className ? ` ${className}` : ""}`;
  return <h2 className={cls}>{children}</h2>;
}
