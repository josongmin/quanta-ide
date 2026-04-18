import { Lock, CreditCard } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

export function CheckoutPage() {
  const nav = useDemoNav();
  return (
    <div style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Brand size="sm" />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--fg-subtle)", fontSize: "var(--fs-xs)" }}>
          <Lock size={13} strokeWidth={1.8} /> Secure checkout — payments processed by Stripe.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 24 }}>
        <div className="demo-card demo-card--wide" style={{ maxWidth: "none", boxShadow: "none" }}>
          <h1 className="demo-card__title">Complete your subscription</h1>
          <p className="demo-card__sub">You&apos;re upgrading to <strong>Team (Yearly)</strong>.</p>

          <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
            <div className="demo-field">
              <label className="demo-field__label">Billing email</label>
              <input className="demo-input" type="email" defaultValue="ada@acme.com" />
            </div>

            <div className="demo-field">
              <label className="demo-field__label">Card information</label>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 80px", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <input className="demo-input" placeholder="Card number" style={{ paddingLeft: 36 }} />
                  <CreditCard size={15} strokeWidth={1.8} style={{ position: "absolute", left: 10, top: 9, color: "var(--fg-subtle)" }} />
                </div>
                <input className="demo-input" placeholder="MM / YY" />
                <input className="demo-input" placeholder="CVC" />
              </div>
            </div>

            <div className="demo-field">
              <label className="demo-field__label">Name on card</label>
              <input className="demo-input" placeholder="Ada Lovelace" />
            </div>

            <div className="demo-grid-2">
              <div className="demo-field">
                <label className="demo-field__label">Country</label>
                <select className="demo-select" defaultValue="KR">
                  <option value="US">United States</option>
                  <option value="KR">Republic of Korea</option>
                  <option value="JP">Japan</option>
                  <option value="DE">Germany</option>
                </select>
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Postal code</label>
                <input className="demo-input" placeholder="06234" />
              </div>
            </div>

            <div className="demo-field">
              <label className="demo-field__label">Coupon (optional)</label>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
                <input className="demo-input" placeholder="LAUNCH24" />
                <button type="button" className="demo-btn demo-btn--ghost">Apply</button>
              </div>
            </div>

            <label className="demo-check">
              <input type="checkbox" /> Save card for future invoices
            </label>
          </form>
        </div>

        <aside className="demo-card" style={{ maxWidth: "none", alignSelf: "start", height: "fit-content" }}>
          <div style={{ fontSize: "var(--fs-10)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-subtle)", fontWeight: 700 }}>
            Order summary
          </div>
          <div style={{ margin: "12px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-sm)" }}>
              <span>Team plan · 5 seats × yearly</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>$900.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", marginTop: 4 }}>
              <span>Yearly discount (-20%)</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>-$180.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", marginTop: 4 }}>
              <span>Tax (VAT 10%)</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>$72.00</span>
            </div>
          </div>
          <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: "var(--fs-lg)", fontWeight: 700, letterSpacing: "-0.01em" }}>
            <span>Total due today</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>$792.00</span>
          </div>
          <button className="demo-btn demo-btn--primary demo-btn--block" style={{ marginTop: 16 }}>
            Pay $792.00
          </button>
          <p style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 10, textAlign: "center" }}>
            Renews annually. Cancel anytime from{" "}
            <button className="demo-link" onClick={() => nav.navigate("billing.subscription")}>Subscription</button>.
          </p>
        </aside>
      </div>
    </div>
  );
}
