import type { ReactNode } from "react";
import { Overlay } from "../Overlay";

export type PanelTier = "sheet" | "dialog" | "popover";
export type PanelSize = "sm" | "md" | "lg" | "xl";

export interface PanelProps {
  tier: PanelTier;
  open: boolean;
  onClose?: () => void;
  size?: PanelSize;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function Panel({
  tier,
  open,
  onClose,
  size = "md",
  children,
  className = "",
  ariaLabel,
}: PanelProps) {
  const cls = `panel panel--${tier} panel--${size}${className ? ` ${className}` : ""}`;
  return (
    <Overlay tier={tier} open={open} onClose={onClose}>
      <div className={cls} aria-label={ariaLabel}>
        {children}
      </div>
    </Overlay>
  );
}
