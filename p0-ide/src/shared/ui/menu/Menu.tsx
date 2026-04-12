import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

interface MenuProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

/**
 * Menu — WAI-ARIA menu container with arrow-key roving focus.
 *
 * Focus model: items are discovered at runtime by `[role="menuitem"]` inside
 * the container. First item is auto-focused on mount; Arrow keys cycle; Home/End
 * jump to ends; Tab leaves the menu. Consumers don't need to wire anything
 * except rendering MenuItem children.
 */
export function Menu({ children, className, "aria-label": ariaLabel }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  const items = useCallback((): HTMLElement[] => {
    const el = ref.current;
    if (!el) return [];
    return Array.from(
      el.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
    );
  }, []);

  useEffect(() => {
    const list = items();
    if (list.length > 0) list[0].focus();
  }, [items]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const list = items();
      if (list.length === 0) return;
      const current = document.activeElement as HTMLElement | null;
      const idx = current ? list.indexOf(current) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(idx + 1 + list.length) % list.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(idx - 1 + list.length) % list.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1].focus();
      }
    },
    [items],
  );

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      className={`menu ${className ?? ""}`}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
