import { createPortal } from "react-dom";
import type { Toast, ToastKind } from "@quanta/shell-contract";
import "./toast.css";

const KIND_GLYPH: Record<ToastKind, string> = {
  info:    "i",
  success: "✓",
  warn:    "!",
  danger:  "!",
};

export interface ToastHostProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/** Pure presentational toast renderer. Store subscription lives in the shell. */
export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-host" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.kind}${t.leaving ? " toast--leaving" : ""}`}
          role="status"
          style={t.ttlMs ? { "--toast-ttl": `${t.ttlMs}ms` } as React.CSSProperties : undefined}
        >
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
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
          {t.ttlMs && !t.leaving && <span className="toast__timer" aria-hidden />}
        </div>
      ))}
    </div>,
    document.body,
  );
}
