import type { ReactElement, ReactNode } from "react";

interface KbdProps {
  children: ReactNode;
  size?: "sm" | "md";
}

export function Kbd({ children, size = "md" }: KbdProps): ReactElement {
  const isSm = size === "sm";
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: isSm ? 18 : 22,
        height: isSm ? 18 : 22,
        padding: isSm ? "0 var(--space-1)" : "0 var(--space-1h)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-10)",
        fontWeight: "var(--fw-semibold)",
        color: "var(--fg)",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderBottomWidth: 2,
        borderRadius: "var(--radius-xs)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </kbd>
  );
}
