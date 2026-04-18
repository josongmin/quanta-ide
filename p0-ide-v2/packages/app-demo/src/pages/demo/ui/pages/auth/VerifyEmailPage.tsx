import { useState } from "react";
import { Mail } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { OtpInput } from "../../internal/OtpInput";

export function VerifyEmailPage() {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
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
          <Mail size={22} strokeWidth={1.8} />
        </div>
        <h1 className="demo-card__title">Verify your email</h1>
        <p className="demo-card__sub">
          We sent a six-digit code to <strong>ada@acme.com</strong>. Enter it below to activate your
          account.
        </p>

        <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
          <OtpInput value={code} onChange={setCode} />
          <button className="demo-btn demo-btn--primary demo-btn--block" type="submit" disabled={!filled}>
            Verify email
          </button>
          <div className="demo-form-footer" style={{ justifyContent: "center" }}>
            Didn&apos;t get the code?{" "}
            <button className="demo-link" type="button" style={{ marginLeft: 4 }}>Resend in 0:42</button>
          </div>
        </form>
      </div>
    </>
  );
}
