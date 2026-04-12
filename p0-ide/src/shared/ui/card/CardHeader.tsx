import type { ReactNode } from "react";

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <header className={`card__header ${className ?? ""}`}>{children}</header>;
}
