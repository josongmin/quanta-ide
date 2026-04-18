import { Clock, LogIn } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

export function SessionExpiredPage() {
  const nav = useDemoNav();
  return (
    <>
      <Brand />
      <div className="demo-card">
        <div
          style={{
            width: 44, height: 44, borderRadius: 999,
            background: "var(--bg-subtle)", color: "var(--fg-subtle)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Clock size={22} strokeWidth={1.8} />
        </div>
        <h1 className="demo-card__title">Your session has expired</h1>
        <p className="demo-card__sub">
          For your security, we signed you out after 30 minutes of inactivity. Please sign in to continue
          where you left off.
        </p>

        <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
          <div className="demo-field">
            <label className="demo-field__label" htmlFor="session-email">Signed in as</label>
            <input
              id="session-email"
              className="demo-input"
              type="email"
              value="ada@acme.com"
              readOnly
              aria-readonly="true"
            />
            <div className="demo-field__hint">We&apos;ll remember this account on this device.</div>
          </div>

          <button
            className="demo-btn demo-btn--primary demo-btn--block"
            type="submit"
            onClick={() => nav.navigate("auth.login")}
          >
            <LogIn size={14} strokeWidth={1.8} /> Continue as Ada
          </button>

          <div className="demo-divider">or</div>

          <button
            className="demo-btn demo-btn--ghost demo-btn--block"
            type="button"
            onClick={() => nav.navigate("auth.login")}
          >
            Use a different account
          </button>
        </form>

        <p
          style={{
            marginTop: 16,
            fontSize: "var(--fs-xs)",
            color: "var(--fg-subtle)",
            textAlign: "center",
          }}
        >
          Session timeout can be adjusted in Settings &rarr; Security.
        </p>
      </div>
    </>
  );
}
