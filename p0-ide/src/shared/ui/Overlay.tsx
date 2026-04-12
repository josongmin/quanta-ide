/**
 * Overlay — 모든 modal / panel / popover / ephemeral의 공통 래퍼
 *
 * tier에 따라 z-index, scrim, shadow, radius, animation을 자동 적용.
 * 컴포넌트 자체는 렌더링 껍데기이므로 위치/크기는 children이 직접 제어.
 *
 * 사용 예:
 *   <Overlay tier="dialog" open={isOpen} onClose={close}>
 *     <MyModalContent />
 *   </Overlay>
 *
 *   <Overlay tier="sheet" open={isOpen} onClose={close}>
 *     <MySidePanel />
 *   </Overlay>
 *
 *   <Overlay tier="ephemeral" open={visible}>
 *     <Toast />
 *   </Overlay>
 */

import { useEffect, useRef, type ReactNode } from "react";

export type OverlayTier = "sheet" | "dialog" | "popover" | "ephemeral" | "floating";

interface OverlayProps {
  tier: OverlayTier;
  open: boolean;
  onClose?: () => void;
  /** scrim 클릭으로 닫기 (기본 true, ephemeral/popover는 false) */
  closeOnScrim?: boolean;
  /** ESC 키로 닫기 (기본 true) */
  closeOnEsc?: boolean;
  /** scrim 렌더링 여부 (popover/ephemeral은 기본 false) */
  withScrim?: boolean;
  children: ReactNode;
  className?: string;
}

const TIER_DEFAULTS: Record<OverlayTier, { withScrim: boolean; closeOnScrim: boolean }> = {
  sheet:     { withScrim: true,  closeOnScrim: true  },
  dialog:    { withScrim: true,  closeOnScrim: true  },
  popover:   { withScrim: false, closeOnScrim: false },
  ephemeral: { withScrim: false, closeOnScrim: false },
  floating:  { withScrim: false, closeOnScrim: false },
};

export function Overlay({
  tier,
  open,
  onClose,
  closeOnScrim,
  closeOnEsc,
  withScrim,
  children,
  className = "",
}: OverlayProps) {
  const defaults = TIER_DEFAULTS[tier];
  const shouldScrim    = withScrim     ?? defaults.withScrim;
  const scrimCloseable = closeOnScrim  ?? defaults.closeOnScrim;
  const escCloseable   = closeOnEsc    ?? true;

  const contentRef = useRef<HTMLDivElement>(null);

  /* ESC to close */
  useEffect(() => {
    if (!open || !escCloseable || !onClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [open, escCloseable, onClose]);

  /* scroll lock on dialog/sheet only — floating/popover/ephemeral keep page scrollable */
  useEffect(() => {
    if (!open || (tier !== "dialog" && tier !== "sheet")) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, tier]);

  if (!open) return null;

  return (
    <>
      {/* Scrim */}
      {shouldScrim && (
        <div
          className={`overlay-scrim overlay-scrim--${tier === "sheet" ? "sheet" : "dialog"}`}
          aria-hidden="true"
          onClick={scrimCloseable ? onClose : undefined}
        />
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className={`overlay-content overlay-content--${tier}${className ? ` ${className}` : ""}`}
        role={tier === "dialog" ? "dialog" : undefined}
        aria-modal={tier === "dialog" ? "true" : undefined}
      >
        {children}
      </div>
    </>
  );
}
