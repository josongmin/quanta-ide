import { ArrowLeft, Download, Mail } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface LineItem {
  desc: string;
  period?: string;
  qty: string;
  unit: string;
  amount: string;
  negative?: boolean;
}

const LINE_ITEMS: LineItem[] = [
  {
    desc: "Team seat",
    period: "Apr 2026 – Mar 2027",
    qty: "5",
    unit: "$180.00 / yr",
    amount: "$900.00",
  },
  {
    desc: "Yearly discount (-20%)",
    qty: "1",
    unit: "-$180.00",
    amount: "-$180.00",
    negative: true,
  },
  {
    desc: "Sales tax (VAT 10%)",
    qty: "—",
    unit: "—",
    amount: "$72.00",
  },
  {
    desc: "Rounding / adjustment",
    qty: "—",
    unit: "—",
    amount: "$0.00",
  },
];

interface TimelineRow {
  when: string;
  label: string;
}

const TIMELINE: TimelineRow[] = [
  { when: "2026-04-01 09:00:00", label: "Invoice created" },
  { when: "2026-04-01 09:00:00", label: "Card charged · Visa •• 4242" },
  { when: "2026-04-01 09:00:18", label: "Payment succeeded · pi_3NvKX82eZvKYlo2C1gH8a9Qc" },
  { when: "2026-04-01 09:00:19", label: "Receipt emailed · billing@acme.com" },
];

const KICKER_STYLE = {
  fontSize: "var(--fs-10)",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  fontWeight: "var(--fw-bold)",
  color: "var(--fg-subtle)",
};

function TotalsRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "var(--space-4)",
        fontSize: bold ? "var(--fs-md)" : "var(--fs-sm)",
        color: bold ? "var(--fg)" : "var(--fg-muted)",
        fontWeight: bold ? "var(--fw-bold)" : "var(--fw-medium)",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontFamily: bold ? "var(--font-sans)" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function InvoiceDetailPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Billing"
        title="Invoice INV-2026-0005"
        sub="Team plan · Yearly · Paid on April 1, 2026"
      />
      <div className="demo-app__body">

        {/* Top action bar */}
        <div className="demo-sectionbar">
          <button
            className="demo-btn demo-btn--ghost"
            style={{ padding: "0 10px", height: 30 }}
            aria-label="Back to invoices"
          >
            <ArrowLeft size={13} strokeWidth={1.8} /> All invoices
          </button>
          <span className="demo-badge demo-badge--success">Paid</span>
          <span
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--fg-subtle)",
              fontFamily: "var(--font-mono)",
              marginLeft: 4,
            }}
          >
            INV-2026-0005
          </span>
          <span className="demo-sectionbar__spacer" />
          <button
            className="demo-btn demo-btn--ghost"
            style={{ padding: "0 12px", height: 30 }}
          >
            <Mail size={13} strokeWidth={1.8} /> Send by email
          </button>
          <button
            className="demo-btn demo-btn--primary"
            style={{ padding: "0 12px", height: 30 }}
          >
            <Download size={13} strokeWidth={1.8} /> Download PDF
          </button>
        </div>

        {/* Paper document */}
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
            padding: "var(--space-7) var(--space-6) var(--space-6)",
          }}
        >
          {/* Top strip: brand + invoice meta */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "var(--space-6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2h)" }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--fg)",
                  color: "var(--bg)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--fw-bold)",
                  fontSize: "var(--fs-lg)",
                  letterSpacing: "-0.02em",
                }}
              >
                q
              </span>
              <div>
                <div style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)", color: "var(--fg)" }}>
                  Quanta, Inc.
                </div>
                <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
                  600 California St, San Francisco, CA
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={KICKER_STYLE}>Invoice</div>
              <div
                style={{
                  fontSize: "var(--fs-xl)",
                  fontWeight: "var(--fw-bold)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--fg)",
                  marginTop: 2,
                }}
              >
                INV-2026-0005
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", marginTop: 2 }}>
                Issued 2026-04-01 · Due on receipt
              </div>
            </div>
          </div>

          {/* Billed-to + Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-5)",
              marginBottom: "var(--space-5)",
              paddingBottom: "var(--space-5)",
              borderBottom: "1px dashed var(--border)",
            }}
          >
            <div>
              <div style={KICKER_STYLE}>Billed to</div>
              <div style={{ marginTop: 6, fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)" }}>
                Acme Inc.
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
                billing@acme.com
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                Seongnam-si, Gyeonggi-do 13529, KR
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                VAT: KR 123-45-67890
              </div>
            </div>
            <div>
              <div style={KICKER_STYLE}>Summary</div>
              <div
                style={{
                  fontSize: "var(--fs-2xl)",
                  fontWeight: "var(--fw-bold)",
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  marginTop: 6,
                  color: "var(--fg)",
                }}
              >
                $792.00 USD
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", marginTop: 2 }}>
                Paid 2026-04-01 · Visa •• 4242
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={KICKER_STYLE}>Line items</div>
          <table className="demo-table" style={{ marginTop: 6, marginBottom: "var(--space-4)" }}>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {LINE_ITEMS.map((li) => (
                <tr key={li.desc}>
                  <td>
                    <div style={{ fontWeight: "var(--fw-medium)", color: "var(--fg)" }}>{li.desc}</div>
                    {li.period && (
                      <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2 }}>
                        {li.period}
                      </div>
                    )}
                  </td>
                  <td className="is-num" style={{ color: "var(--fg-muted)" }}>{li.qty}</td>
                  <td className="is-num" style={{ color: "var(--fg-muted)" }}>{li.unit}</td>
                  <td
                    className="is-num"
                    style={{
                      color: li.negative ? "var(--success)" : "var(--fg)",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    {li.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
            <div
              style={{
                minWidth: 280,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: "var(--fs-sm)",
              }}
            >
              <TotalsRow label="Subtotal" value="$900.00" />
              <TotalsRow label="Yearly discount (-20%)" value="-$180.00" />
              <TotalsRow label="Sales tax (VAT 10%)" value="$72.00" />
              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
              <TotalsRow label="Total paid" value="$792.00 USD" bold />
            </div>
          </div>

          {/* Notes */}
          <section
            style={{
              marginTop: "var(--space-5)",
              padding: "var(--space-3) var(--space-4)",
              background: "var(--bg-subtle)",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--border)",
              fontSize: "var(--fs-xs)",
              color: "var(--fg-muted)",
              lineHeight: "var(--lh-relaxed)",
            }}
          >
            Thank you for being a Quanta customer. Payment confirmation #
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
              pi_3NvKX82eZvKYlo2C1gH8a9Qc
            </span>
            . Questions? <span style={{ color: "var(--accent)" }}>billing@quanta.dev</span>
          </section>
        </div>

        {/* Timeline below the paper */}
        <div
          className="demo-block"
          style={{ maxWidth: 880, margin: "var(--space-5) auto 0" }}
        >
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Payment timeline</div>
              <div className="demo-block__sub">Server-side audit trail for this invoice</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <span className="demo-badge demo-badge--success">All checks passed</span>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {TIMELINE.map((t, i) => (
              <div key={i} className="demo-row" style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
                <span className="demo-dot demo-dot--success" />
                <div className="demo-row__primary">
                  <div className="demo-row__title">{t.label}</div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {t.when}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
