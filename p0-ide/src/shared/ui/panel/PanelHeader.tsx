import type { ReactNode } from "react";
import { CloseButton } from "../button";

export interface PanelHeaderProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  ariaLabel?: string;
}

export function PanelHeader({
  children,
  onClose,
  className = "",
  ariaLabel,
}: PanelHeaderProps) {
  const cls = `panel__header${className ? ` ${className}` : ""}`;
  return (
    <header className={cls} aria-label={ariaLabel}>
      <div className="panel__header-content">{children}</div>
      {onClose && <CloseButton size="sm" onClick={onClose} />}
    </header>
  );
}
