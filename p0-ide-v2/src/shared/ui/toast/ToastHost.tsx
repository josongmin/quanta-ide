import { createPortal } from "react-dom";
import { toastStore, useToasts, type ToastKind } from "@/shared/model/toast-store";
import "./toast.css";

const KIND_GLYPH: Record<ToastKind, string> = {
  info:    "i",
  success: "✓",
  warn:    "!",
  danger:  "!",
};

export function ToastHost() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-host" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} role="status">
          <span className={`toast__glyph toast__glyph--${t.kind}`} aria-hidden>
            {KIND_GLYPH[t.kind]}
          </span>
          <div className="toast__body">
            <div className="toast__title">
              <span>{t.title}</span>
              {t.engine && <span className="toast__engine">{t.engine}</span>}
            </div>
            {t.detail && <div className="toast__detail">{t.detail}</div>}
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => toastStore.dismiss(t.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
