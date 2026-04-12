import type { ReactNode } from "react";

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={`card__body ${className ?? ""}`}>{children}</div>;
}
