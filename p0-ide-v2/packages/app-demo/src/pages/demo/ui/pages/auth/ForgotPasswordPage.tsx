import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

export function ForgotPasswordPage() {
  const nav = useDemoNav();
  const [sent, setSent] = useState(false);
  return (
    <>
      <Brand />
      <div className="demo-card">
        <button
          className="demo-link"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}
          onClick={() => nav.navigate("auth.login")}
        >
          <ArrowLeft size={13} strokeWidth={1.8} /> Back to log in
        </button>

        {sent ? (
          <>
            <div
              style={{
                width: 44, height: 44, borderRadius: 999,
                background: "var(--bg-success-subtle)", color: "var(--success)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Check size={22} strokeWidth={2} />
            </div>
            <h1 className="demo-card__title">Check your email</h1>
            <p className="demo-card__sub">
              We sent password reset instructions. The link expires in 30 minutes. If you don&apos;t
              see it, check your spam folder or try again.
            </p>
            <button className="demo-btn demo-btn--ghost demo-btn--block" type="button" onClick={() => setSent(false)}>
              Try a different email
            </button>
          </>
        ) : (
          <>
            <h1 className="demo-card__title">Reset your password</h1>
            <p className="demo-card__sub">
              Enter the email you use to log in. We&apos;ll send you a link to reset your password.
            </p>
            <form className="demo-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <div className="demo-field">
                <label className="demo-field__label" htmlFor="fp-email">Email</label>
                <input id="fp-email" className="demo-input" type="email" placeholder="you@company.com" autoFocus />
              </div>
              <button className="demo-btn demo-btn--primary demo-btn--block" type="submit">Send reset link</button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
