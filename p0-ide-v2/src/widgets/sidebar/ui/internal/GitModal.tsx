import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../lib/icons";

interface GitModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

export function GitModal({ children, onClose }: GitModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="ide-git-modal-backdrop" role="dialog" aria-modal="true" aria-label="Git changes" onMouseDown={onClose}>
      <div className="ide-git-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ide-git-modal__head">
          <span className="ide-git-modal__title">Git</span>
          <button type="button" className="ide-git-modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="ide-git-modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
