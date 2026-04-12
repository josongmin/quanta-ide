import type { ReactNode } from "react";

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return <footer className={`card__footer ${className ?? ""}`}>{children}</footer>;
}
