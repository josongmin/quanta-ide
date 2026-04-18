import { useState } from "react";
import { Building2, ArrowLeft } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

export function SsoPage() {
  const nav = useDemoNav();
  const [domain, setDomain] = useState("");
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

        <div
          style={{
            width: 44, height: 44, borderRadius: 999,
            background: "var(--bg-muted)", color: "var(--fg)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Building2 size={22} strokeWidth={1.8} />
        </div>

        <h1 className="demo-card__title">Sign in with SSO</h1>
        <p className="demo-card__sub">
          Enter your organization&apos;s domain. We&apos;ll redirect you to your identity provider
          to complete the sign-in.
        </p>

        <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
          <div className="demo-field">
            <label className="demo-field__label" htmlFor="sso-domain">Organization domain</label>
            <div style={{ position: "relative" }}>
              <input
                id="sso-domain"
                className="demo-input"
                type="text"
                placeholder="acme"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                style={{ paddingRight: 120 }}
              />
              <span
                style={{
                  position: "absolute",
                  right: 10,
                  top: 9,
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-subtle)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                .quanta.dev
              </span>
            </div>
            <span className="demo-field__hint">Supports SAML 2.0 and OpenID Connect.</span>
          </div>

          <button className="demo-btn demo-btn--primary demo-btn--block" type="submit" disabled={!domain}>
            Continue with SSO
          </button>

          <div className="demo-divider">or</div>

          <button
            type="button"
            className="demo-btn demo-btn--ghost demo-btn--block"
            onClick={() => nav.navigate("auth.login")}
          >
            Sign in with email instead
          </button>
        </form>
      </div>
    </>
  );
}
