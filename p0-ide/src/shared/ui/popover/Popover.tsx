/**
 * Popover — lightweight anchor-positioned popover wrapper.
 *
 * Unlike Panel tier="popover" (which provides header/body/footer slots for
 * richer popovers like risk-drawer), this component is for menu-style or
 * hover-card style anchored UI. It handles:
 *   - placement computation (6 directions) from an anchorRect
 *   - vertical auto-flip when the chosen side lacks space
 *   - click-outside (mousedown outside popover element) + ESC to close
 *
 * Limitation: anchorRect is plain rect data (not a ref), so click-outside is
 * detected purely from the popover ref. Clicks on the anchor element itself
 * are treated as "outside" — consumers typically use a toggle handler on
 * the anchor that flips `open`, which remains correct because the mousedown
 * close fires first, then the anchor's click handler re-opens. If that isn't
 * desired, guard the anchor's onClick accordingly.
 */

import { forwardRef, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useFocusTrap } from "../panel/useFocusTrap";
import { computePopoverPosition, type PopoverAnchorRect, type PopoverPlacement } from "./computePopoverPosition";

export interface PopoverProps {
  open: boolean;
  anchorRect: DOMRect | PopoverAnchorRect | null;
  placement?: PopoverPlacement;
  offset?: number;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  role?: "menu" | "dialog" | "listbox" | "tooltip";
  "aria-label"?: string;
  /** Trap Tab focus inside the popover (for dialog-style popovers). Default: false. */
  trapFocus?: boolean;
}

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  {
    open,
    anchorRect,
    placement = "bottom-start",
    offset = 4,
    onClose,
    children,
    className = "",
    role,
    "aria-label": ariaLabel,
    trapFocus = false,
  },
  forwardedRef,
) {
  const innerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(innerRef, open && trapFocus);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  /* ESC to close */
  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  /* Click outside (mousedown) — close when target is outside popover element. */
  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: MouseEvent) => {
      const el = innerRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onClose]);

  /* Position computation after mount/update. */
  useEffect(() => {
    if (!open || !anchorRect) return;
    const el = innerRef.current;
    if (!el) return;

    el.style.top = "0px";
    el.style.left = "0px";

    const rect = el.getBoundingClientRect();
    const pos = computePopoverPosition(
      anchorRect,
      placement,
      offset,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    el.style.top = `${pos.top}px`;
    el.style.left = `${pos.left}px`;
  }, [open, anchorRect, placement, offset, children]);

  if (!open || !anchorRect) return null;

  return (
    <div
      ref={setRefs}
      className={`popover${className ? ` ${className}` : ""}`}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
});
