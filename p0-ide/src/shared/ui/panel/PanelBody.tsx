import type { ReactNode } from "react";

export interface PanelBodyProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  scrollable?: boolean;
}

export function PanelBody({
  children,
  className = "",
  padded = true,
  scrollable = true,
}: PanelBodyProps) {
  const cls = [
    "panel__body",
    padded ? "panel__body--padded" : "",
    scrollable ? "panel__body--scrollable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{children}</div>;
}
