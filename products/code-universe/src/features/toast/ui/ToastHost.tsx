import type { CSSProperties, ReactElement } from "react";
import { toastStore, useToasts, type Toast, type ToastKind } from "../model/store";

// ToastHost
// --------------------------------------------------------------------
// Stack of passive confirmations rendered in the bottom-right corner,
// above the minimap if both are showing (mini is pointer-events auto,
// toasts are pointer-events none except on the dismiss/action
// controls — the two stack cleanly).
//
// Stacks newest-on-top so a burst of confirmations reads bottom-to-
// top like a chat timeline, matching user muscle memory from macOS
// notifications + iOS banners. CSS animation is keyframed on each
// toast's own createdAt so a freshly-pushed toast always fades in
// rather than popping in at full opacity.

const HOST: CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  display: "flex",
  flexDirection: "column-reverse",
  gap: 8,
  zIndex: 150,
  pointerEvents: "none",
  maxWidth: 360,
};

const ACCENT: Record<ToastKind, { bar: string; text: string; bg: string }> = {
  info:    { bar: "#6366f1", text: "#3730a3", bg: "#eef2ff" },
  success: { bar: "#10b981", text: "#065f46", bg: "#ecfdf5" },
  warn:    { bar: "#f59e0b", text: "#92400e", bg: "#fffbeb" },
  error:   { bar: "#ef4444", text: "#991b1b", bg: "#fef2f2" },
};

const TOAST: CSSProperties = {
  pointerEvents: "auto",
  display: "grid",
  gridTemplateColumns: "3px 1fr auto",
  columnGap: 10,
  padding: "10px 12px",
  borderRadius: 8,
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  lineHeight: 1.4,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
  border: "1px solid rgba(0,0,0,0.04)",
  // Matches the `fadeSlideIn` keyframes injected at mount below.
  animation: "cuToastIn 180ms ease-out",
};

const CLOSE: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 2,
  cursor: "pointer",
  color: "#9ca3af",
  fontSize: 14,
  lineHeight: 1,
  marginLeft: 6,
};

const ACTION: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "0 6px",
  fontSize: 11,
  cursor: "pointer",
  fontWeight: 600,
  fontFamily: "system-ui, sans-serif",
};

/**
 * Global keyframes for the mount-in animation. Injected once per
 * runtime via a module-level effect — the JSX host can't ship style
 * rules without a stylesheet, and a styled-components dep isn't worth
 * it for 4 lines of CSS.
 */
function ensureKeyframes(): void {
  if (typeof document === "undefined") return;
  const ID = "cu-toast-keyframes";
  if (document.getElementById(ID)) return;
  const el = document.createElement("style");
  el.id = ID;
  el.textContent = `
@keyframes cuToastIn {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}`;
  document.head.appendChild(el);
}

function ToastItem({ t }: { t: Toast }): ReactElement {
  const accent = ACCENT[t.kind];
  return (
    <div
      role="status"
      aria-live={t.kind === "error" || t.kind === "warn" ? "assertive" : "polite"}
      style={{ ...TOAST, background: accent.bg, color: accent.text }}
    >
      <span aria-hidden style={{ background: accent.bar, borderRadius: 2 }} />
      <span>{t.message}</span>
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {t.action ? (
          <button
            type="button"
            style={{ ...ACTION, color: accent.bar }}
            onClick={() => {
              t.action?.onClick();
              toastStore.dismiss(t.id);
            }}
          >
            {t.action.label}
          </button>
        ) : null}
        <button
          type="button"
          style={CLOSE}
          onClick={() => toastStore.dismiss(t.id)}
          aria-label="Dismiss"
          title="Dismiss"
        >
          ✕
        </button>
      </span>
    </div>
  );
}

export function ToastHost(): ReactElement | null {
  ensureKeyframes();
  const toasts = useToasts(s => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div style={HOST} aria-label="Notifications">
      {toasts.map(t => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
