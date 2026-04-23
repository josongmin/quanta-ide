import type { ReactNode } from "react";
import "./kbd.css";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ap-kbd">{children}</kbd>;
}
