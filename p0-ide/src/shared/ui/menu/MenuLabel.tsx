import type { ReactNode } from "react";

interface MenuLabelProps {
  children: ReactNode;
}

export function MenuLabel({ children }: MenuLabelProps) {
  return <div className="menu__group-label">{children}</div>;
}
