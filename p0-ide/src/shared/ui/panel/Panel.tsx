import { forwardRef, useRef, type CSSProperties, type ReactNode } from "react";
import { Overlay } from "../Overlay";
import { useFocusTrap } from "./useFocusTrap";

export type PanelTier = "sheet" | "dialog" | "popover" | "floating";
export type PanelSize = "sm" | "md" | "lg" | "xl";

export interface PanelProps {
  tier: PanelTier;
  open: boolean;
  onClose?: () => void;
  size?: PanelSize;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  /** floating / popover tiers: consumer-controlled positioning */
  style?: CSSProperties;
  /** opt out of Overlay's ESC handler when the consumer manages keys itself */
  closeOnEsc?: boolean;
  /** dialog tiers default to role="dialog"; floating windows may set their own */
  role?: string;
  ariaModal?: boolean;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  {
    tier,
    open,
    onClose,
    size = "md",
    children,
    className = "",
    ariaLabel,
    style,
    closeOnEsc,
    role,
    ariaModal,
  },
  ref,
) {
  const innerRef = useRef<HTMLDivElement>(null);
  const setRefs = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const shouldTrap = open && (tier === "dialog" || tier === "sheet");
  useFocusTrap(innerRef, shouldTrap);

  const cls = `panel panel--${tier} panel--${size}${className ? ` ${className}` : ""}`;
  return (
    <Overlay tier={tier} open={open} onClose={onClose} closeOnEsc={closeOnEsc}>
      <div
        ref={setRefs}
        className={cls}
        style={style}
        aria-label={ariaLabel}
        role={role}
        aria-modal={ariaModal}
        tabIndex={-1}
      >
        {children}
      </div>
    </Overlay>
  );
});
