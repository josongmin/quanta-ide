import { useRef, useState } from "react";
import { Mail } from "lucide-react";
import { Brand } from "../../internal/Brand";

export function VerifyEmailPage() {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const onChange = (i: number, v: string) => {
    const next = [...code];
    next[i] = v.slice(-1).replace(/\D/, "");
    setCode(next);
    if (next[i] && i < 5) refs.current[i + 1]?.focus();
  };
  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus();
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
          <Mail size={22} strokeWidth={1.8} />
        </div>
        <h1 className="demo-card__title">Verify your email</h1>
        <p className="demo-card__sub">
          We sent a six-digit code to <strong>ada@acme.com</strong>. Enter it below to activate your
          account.
        </p>

        <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
          <div className="demo-otp">
            {code.map((v, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={v}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
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
