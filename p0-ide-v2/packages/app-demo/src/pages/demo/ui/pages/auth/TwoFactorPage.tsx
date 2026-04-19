import { useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { OtpInput } from "../../internal/OtpInput";

export function TwoFactorPage() {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const filled = code.every(Boolean);

  return (
    <>
      <Brand />
      <div className="demo-card">
        <div
          style={{
            width: 52, height: 52, borderRadius: 999,
            background:
              "radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--accent) 22%, var(--bg)) 0%, var(--bg-accent-subtle) 60%, var(--bg) 100%)",
            color: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
            boxShadow:
              "inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent), 0 8px 22px -12px color-mix(in srgb, var(--accent) 55%, transparent)",
          }}
        >
          <ShieldCheck size={24} strokeWidth={1.8} />
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
          <OtpInput value={code} onChange={setCode} />
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
