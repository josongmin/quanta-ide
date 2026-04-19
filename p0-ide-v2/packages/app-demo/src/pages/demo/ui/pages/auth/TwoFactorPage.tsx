import { useEffect, useState } from "react";
import {
  Smartphone,
  KeyRound,
  Fingerprint,
  Mail,
  Check,
  Clipboard,
  ChevronRight,
} from "lucide-react";
import { Brand } from "../../internal/Brand";
import { OtpInput } from "../../internal/OtpInput";
import { useDemoNav } from "../../DemoPage";

export function TwoFactorPage() {
  const nav = useDemoNav();
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [trust, setTrust] = useState(true);
  const [tick, setTick] = useState(7);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 30), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = 30 - tick;
  const filled = code.every(Boolean);
  const ringDeg = (tick / 30) * 360;
  const lowTime = remaining <= 5;

  const onPaste = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const digits = txt.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length) {
        const next = ["", "", "", "", "", ""];
        digits.forEach((d, i) => (next[i] = d));
        setCode(next);
      }
    } catch {
      /* clipboard not available — silent */
    }
  };

  return (
    <>
      <Brand />
      <div className="demo-card">
        <div className="demo-2fa-identity">
          <div className="demo-2fa-identity__avatar">A</div>
          <div className="demo-2fa-identity__meta">
            <div className="demo-2fa-identity__name">ada@acme.com</div>
            <div className="demo-2fa-identity__sub">Acme · Production workspace</div>
          </div>
          <button
            className="demo-link demo-2fa-identity__switch"
            type="button"
            onClick={() => nav.navigate("auth.login")}
          >
            Not you?
          </button>
        </div>

        <h1 className="demo-card__title">Confirm it&apos;s you</h1>
        <p className="demo-card__sub">
          Your workspace requires a second factor. Codes refresh every 30 seconds.
        </p>

        <div className="demo-2fa-source">
          <div className="demo-2fa-source__icon">
            <Smartphone size={14} strokeWidth={1.8} />
          </div>
          <div className="demo-2fa-source__label">
            <span className="demo-2fa-source__title">Authenticator app</span>
            <span className="demo-2fa-source__sub">iPhone · 1Password</span>
          </div>
          <div
            className={"demo-2fa-ring" + (lowTime ? " is-low" : "")}
            style={{
              background: `conic-gradient(currentColor ${ringDeg}deg, var(--bg-muted) 0)`,
            }}
            aria-label={`Code refreshes in ${remaining} seconds`}
          >
            <span>{remaining}</span>
          </div>
        </div>

        <OtpInput value={code} onChange={setCode} autoFocus />

        <button
          type="button"
          className="demo-2fa-paste"
          onClick={onPaste}
        >
          <Clipboard size={11} strokeWidth={1.8} />
          Paste 6-digit code
        </button>

        <label className="demo-check demo-2fa-trust">
          <input
            type="checkbox"
            checked={trust}
            onChange={(e) => setTrust(e.target.checked)}
          />
          <span>
            Trust this browser for <strong>30 days</strong>
          </span>
        </label>

        <button
          className="demo-btn demo-btn--primary demo-btn--block demo-2fa-verify"
          disabled={!filled}
          type="button"
        >
          {filled ? (
            <>
              <Check size={14} strokeWidth={2.2} /> Verify and continue
            </>
          ) : (
            <>Enter 6 digits to continue</>
          )}
        </button>

        <div className="demo-2fa-recovery">
          <div className="demo-2fa-recovery__head">
            <KeyRound size={11} strokeWidth={1.8} />
            <span>Lost access to your authenticator?</span>
          </div>
          <div className="demo-2fa-recovery__list">
            <button className="demo-2fa-recovery__item" type="button">
              <Fingerprint size={15} strokeWidth={1.8} />
              <span className="demo-2fa-recovery__item-title">Use a security key</span>
              <span className="demo-2fa-recovery__item-kbd">FIDO2</span>
              <ChevronRight
                size={13}
                strokeWidth={1.8}
                className="demo-2fa-recovery__item-arrow"
              />
            </button>
            <button className="demo-2fa-recovery__item" type="button">
              <KeyRound size={15} strokeWidth={1.8} />
              <span className="demo-2fa-recovery__item-title">Enter a backup code</span>
              <span className="demo-2fa-recovery__item-kbd">8 left</span>
              <ChevronRight
                size={13}
                strokeWidth={1.8}
                className="demo-2fa-recovery__item-arrow"
              />
            </button>
            <button className="demo-2fa-recovery__item" type="button">
              <Mail size={15} strokeWidth={1.8} />
              <span className="demo-2fa-recovery__item-title">Email a recovery link</span>
              <span className="demo-2fa-recovery__item-kbd">ada@…</span>
              <ChevronRight
                size={13}
                strokeWidth={1.8}
                className="demo-2fa-recovery__item-arrow"
              />
            </button>
          </div>
        </div>
      </div>

      <p
        style={{
          marginTop: 16,
          fontSize: "var(--fs-10)",
          color: "var(--fg-subtle)",
          letterSpacing: "0.06em",
          textAlign: "center",
        }}
      >
        Verification attempts are logged for security review.
      </p>
    </>
  );
}
