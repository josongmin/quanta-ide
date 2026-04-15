import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { focusManager } from "../../lib/focus-manager";
import "./modal.css";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "fit";
}

export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  size = "md",
}: ModalProps): ReactElement | null {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    focusManager.save();
    const el = rootRef.current;
    const dispose = el ? focusManager.trap(el) : undefined;
    return () => {
      dispose?.();
      focusManager.restore();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="ide-modal-backdrop" onMouseDown={onClose}>
      <div
        ref={rootRef}
        className={`ide-modal ide-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
