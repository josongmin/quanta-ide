import { useState } from "react";
import { Eye, EyeOff, GitBranch, Globe } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

export function LoginPage() {
  const nav = useDemoNav();
  const [show, setShow] = useState(false);
  return (
    <>
      <Brand />
      <div className="demo-card">
        <h1 className="demo-card__title">Welcome back</h1>
        <p className="demo-card__sub">
          Sign in to your workspace. No account yet?{" "}
          <button className="demo-link" onClick={() => nav.navigate("auth.signup")}>
            Create one
          </button>.
        </p>

        <div className="demo-sso-row">
          <button className="demo-sso-btn" type="button">
            <Globe size={14} strokeWidth={1.8} /> Continue with Google
          </button>
          <button className="demo-sso-btn" type="button">
            <GitBranch size={14} strokeWidth={1.8} /> Continue with GitHub
          </button>
        </div>

        <div className="demo-divider">or with email</div>

        <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
          <div className="demo-field">
            <label className="demo-field__label" htmlFor="login-email">Email</label>
            <input id="login-email" className="demo-input" type="email" placeholder="you@company.com" autoComplete="email" />
          </div>

          <div className="demo-field">
            <label className="demo-field__label" htmlFor="login-password">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                className="demo-input"
                type={show ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  height: 18,
                  width: 24,
                  border: 0,
                  background: "transparent",
                  color: "var(--fg-subtle)",
                  cursor: "pointer",
                }}
              >
                {show ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
              </button>
            </div>
          </div>

          <div className="demo-form-footer">
            <label className="demo-check">
              <input type="checkbox" defaultChecked />
              Remember this device
            </label>
            <button className="demo-link" type="button" onClick={() => nav.navigate("auth.forgot")}>
              Forgot password?
            </button>
          </div>

          <button className="demo-btn demo-btn--primary demo-btn--block" type="submit">Log in</button>

          <div style={{ textAlign: "center", fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
            Signing in via your organization?{" "}
            <button className="demo-link" type="button" onClick={() => nav.navigate("auth.sso")}>
              Use SSO
            </button>
          </div>
        </form>
      </div>

      <p style={{ marginTop: 24, fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em" }}>
        By continuing you agree to the <button className="demo-link" onClick={() => nav.navigate("legal.terms")}>Terms</button> and{" "}
        <button className="demo-link" onClick={() => nav.navigate("legal.privacy")}>Privacy Policy</button>.
      </p>
    </>
  );
}
