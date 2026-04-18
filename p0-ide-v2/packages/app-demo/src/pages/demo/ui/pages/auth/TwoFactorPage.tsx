import { useRef, useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { Brand } from "../../internal/Brand";

export function TwoFactorPage() {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const onChange = (i: number, v: string) => {
    const next = [...code];
    next[i] = v.slice(-1).replace(/\D/, "");
    setCode(next);
    if (next[i] && i < 5) refs.current[i + 1]?.focus();
  };
  const filled = code.every(Boolean);

  return (
    <>
      <Brand />
      <div className="demo-card">
        <div
          style={{
            width: 44, height: 44, borderRadius: 999,
            background: "var(--bg-accent-subtle)", color: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <ShieldCheck size={22} strokeWidth={1.8} />
        </div>

        <h1 className="demo-card__title">Two-factor authentication</h1>
        <p className="demo-card__sub">
          {mode === "totp"
            ? "Open your authenticator app and enter the 6-digit code."
            : "Use one of the backup codes you saved when you set up 2FA."}
        </p>

        <div className="demo-billing-toggle" style={{ marginBottom: 16 }}>
          <button className={mode === "totp" ? "is-active" : ""} onClick={() => setMode("totp")}>Authenticator</button>
          <button className={mode === "backup" ? "is-active" : ""} onClick={() => setMode("backup")}>Backup code</button>
        </div>

        {mode === "totp" ? (
          <>
            <div className="demo-otp">
              {code.map((v, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  inputMode="numeric"
                  maxLength={1}
                  value={v}
                  onChange={(e) => onChange(i, e.target.value)}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="demo-field">
            <label className="demo-field__label" htmlFor="bk">Backup code</label>
            <input id="bk" className="demo-input" type="text" placeholder="XXXX-XXXX" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }} />
            <span className="demo-field__hint">Each code can only be used once.</span>
          </div>
        )}

        <button className="demo-btn demo-btn--primary demo-btn--block" style={{ marginTop: 16 }} disabled={mode === "totp" && !filled}>
          Verify
        </button>

        <div className="demo-form-footer" style={{ justifyContent: "center", marginTop: 12 }}>
          <KeyRound size={12} strokeWidth={1.8} style={{ color: "var(--fg-subtle)" }} />
          <button className="demo-link" type="button">Use a different method</button>
        </div>
      </div>
    </>
  );
}
