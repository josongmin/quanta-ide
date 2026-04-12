import { useCallback, useRef, type KeyboardEvent, type ReactNode } from "react";

interface TabsProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  /** Orientation drives which arrow keys move focus. Defaults to horizontal. */
  orientation?: "horizontal" | "vertical";
}

/**
 * Tabs — WAI-ARIA tablist with arrow-key roving focus. Home/End jump to ends.
 * Activation is manual (focus != select); consumers still drive active state
 * via Tab's `active` prop and `onClick`.
 */
export function Tabs({
  children,
  className,
  "aria-label": ariaLabel,
  orientation = "horizontal",
}: TabsProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
      if (tabs.length === 0) return;
      const current = document.activeElement as HTMLElement | null;
      const idx = current ? tabs.indexOf(current) : -1;

      const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
      const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";

      if (e.key === nextKey) {
        e.preventDefault();
        tabs[(idx + 1 + tabs.length) % tabs.length].focus();
      } else if (e.key === prevKey) {
        e.preventDefault();
        tabs[(idx - 1 + tabs.length) % tabs.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        tabs[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        tabs[tabs.length - 1].focus();
      }
    },
    [orientation],
  );

  return (
    <div
      ref={ref}
      role="tablist"
      tabIndex={-1}
      aria-orientation={orientation}
      className={`tabs ${className ?? ""}`}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
