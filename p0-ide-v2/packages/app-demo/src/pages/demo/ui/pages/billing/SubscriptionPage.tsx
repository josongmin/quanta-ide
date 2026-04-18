import { CreditCard } from "lucide-react";
import { useDemoNav } from "../../DemoPage";

export function SubscriptionPage() {
  const nav = useDemoNav();
  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Billing</span>
        <h1 className="demo-app__hero-title">Subscription</h1>
        <p className="demo-app__hero-sub">Manage your current plan, payment method, and billing contacts.</p>
      </header>
      <div className="demo-app__body">

        <div className="demo-grid-2" style={{ marginBottom: 16 }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Current plan</div>
            <div className="demo-stat__value">Team</div>
            <div className="demo-stat__delta">Billed yearly · renews Dec 14, 2026</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Seats used</div>
            <div className="demo-stat__value">12 / 25</div>
            <div className="demo-progress" style={{ marginTop: 8 }}>
              <div className="demo-progress__bar"><div className="demo-progress__fill" style={{ width: "48%" }} /></div>
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Plan details</div>
              <div className="demo-block__sub">Next invoice $792.00 on Dec 14, 2026.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost" onClick={() => nav.navigate("billing.pricing")}>Change plan</button>
            <button className="demo-btn demo-btn--primary">Add seats</button>
          </header>
          <div className="demo-block__body">
            <div className="demo-kv">
              <div className="demo-kv__k">Billing cycle</div>
              <div className="demo-kv__v">Yearly · $15/seat/mo ($180/seat/yr)</div>
              <div className="demo-kv__k">Seats</div>
              <div className="demo-kv__v">12 active, 13 available</div>
              <div className="demo-kv__k">Next charge</div>
              <div className="demo-kv__v">$792.00 · Dec 14, 2026</div>
              <div className="demo-kv__k">Trial status</div>
              <div className="demo-kv__v">Ended Mar 1, 2026</div>
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Payment method</div>
              <div className="demo-block__sub">Primary card on file.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost">Update card</button>
          </header>
          <div className="demo-block__body">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44, height: 32, borderRadius: 6,
                  background: "var(--bg-muted)", border: "1px solid var(--border)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "var(--fg-muted)",
                }}
              >
                <CreditCard size={18} strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>Visa ending in 4242</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>Expires 08 / 2028 · Billing contact: ada@acme.com</div>
              </div>
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Billing contacts</div>
              <div className="demo-block__sub">Invoice emails and VAT info.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost">Edit</button>
          </header>
          <div className="demo-block__body">
            <div className="demo-kv">
              <div className="demo-kv__k">Company</div>
              <div className="demo-kv__v">Acme Inc.</div>
              <div className="demo-kv__k">Invoice email</div>
              <div className="demo-kv__v">billing@acme.com</div>
              <div className="demo-kv__k">Billing address</div>
              <div className="demo-kv__v">Seongnam-si, Gyeonggi-do, 13529, KR</div>
              <div className="demo-kv__k">Tax / VAT ID</div>
              <div className="demo-kv__v">KR 123-45-67890</div>
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Danger zone</div>
              <div className="demo-block__sub">Cancellation takes effect at the end of the current billing period.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--danger">Cancel subscription</button>
          </header>
        </div>

      </div>
    </div>
  );
}
