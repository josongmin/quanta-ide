import type { ReactNode } from "react";

export interface PanelFooterProps {
  children: ReactNode;
  className?: string;
  align?: "start" | "end" | "between";
}

export function PanelFooter({
  children,
  className = "",
  align = "end",
}: PanelFooterProps) {
  const cls = `panel__footer panel__footer--${align}${className ? ` ${className}` : ""}`;
  return <footer className={cls}>{children}</footer>;
}
