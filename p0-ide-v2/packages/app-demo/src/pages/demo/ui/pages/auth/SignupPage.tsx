import { useMemo, useState } from "react";
import { Globe, GitBranch } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

function scorePassword(p: string): { score: number; label: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  const labels = ["too short", "weak", "okay", "strong", "excellent"];
  return { score, label: labels[score] ?? "weak" };
}

export function SignupPage() {
  const nav = useDemoNav();
  const [password, setPassword] = useState("");
  const strength = useMemo(() => scorePassword(password), [password]);

  return (
    <>
      <Brand />
      <div className="demo-card demo-card--wide">
        <h1 className="demo-card__title">Create your Quanta account</h1>
        <p className="demo-card__sub">
          Free for 14 days. No credit card required.{" "}
          <button className="demo-link" onClick={() => nav.navigate("auth.login")}>Already have an account?</button>
        </p>

        <div className="demo-sso-row">
          <button className="demo-sso-btn" type="button"><Globe size={14} strokeWidth={1.8} /> Sign up with Google</button>
          <button className="demo-sso-btn" type="button"><GitBranch size={14} strokeWidth={1.8} /> Sign up with GitHub</button>
        </div>
        <div className="demo-divider">or with email</div>

        <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
          <div className="demo-grid-2">
            <div className="demo-field">
              <label className="demo-field__label" htmlFor="su-first">First name</label>
              <input id="su-first" className="demo-input" type="text" placeholder="Ada" autoComplete="given-name" />
            </div>
            <div className="demo-field">
              <label className="demo-field__label" htmlFor="su-last">Last name</label>
              <input id="su-last" className="demo-input" type="text" placeholder="Lovelace" autoComplete="family-name" />
            </div>
          </div>

          <div className="demo-field">
            <label className="demo-field__label" htmlFor="su-email">Work email</label>
            <input id="su-email" className="demo-input" type="email" placeholder="you@company.com" autoComplete="email" />
            <span className="demo-field__hint">We send a verification code to confirm your address.</span>
          </div>

          <div className="demo-field">
            <label className="demo-field__label" htmlFor="su-password">Password</label>
            <input
              id="su-password"
              className="demo-input"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div className="demo-strength">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={"demo-strength__bar" + (i < strength.score ? " is-on" : "")} />
              ))}
            </div>
            <div className="demo-strength__label">Strength: {strength.label}</div>
          </div>

          <div className="demo-field">
            <label className="demo-field__label" htmlFor="su-workspace">Workspace name</label>
            <input id="su-workspace" className="demo-input" type="text" placeholder="Acme Inc." />
            <span className="demo-field__hint">You can rename or invite teammates later.</span>
          </div>

          <label className="demo-check" style={{ marginTop: 4 }}>
            <input type="checkbox" />
            I agree to the{" "}
            <button type="button" className="demo-link" onClick={() => nav.navigate("legal.terms")}>Terms of Service</button>{" "}
            and{" "}
            <button type="button" className="demo-link" onClick={() => nav.navigate("legal.privacy")}>Privacy Policy</button>.
          </label>

          <button className="demo-btn demo-btn--primary demo-btn--block" type="submit">Create account</button>
        </form>
      </div>
    </>
  );
}
