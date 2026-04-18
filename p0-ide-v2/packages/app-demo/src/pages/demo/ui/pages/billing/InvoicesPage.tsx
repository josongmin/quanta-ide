import { Download } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

const INVOICES = [
  { id: "INV-2026-0005", date: "2026-04-01", amount: "$792.00", status: "paid",    method: "Visa •• 4242" },
  { id: "INV-2026-0004", date: "2026-03-01", amount: "$792.00", status: "paid",    method: "Visa •• 4242" },
  { id: "INV-2026-0003", date: "2026-02-01", amount: "$792.00", status: "paid",    method: "Visa •• 4242" },
  { id: "INV-2026-0002", date: "2026-01-01", amount: "$660.00", status: "paid",    method: "Visa •• 4242" },
  { id: "INV-2025-0012", date: "2025-12-14", amount: "$900.00", status: "refunded", method: "Visa •• 4242" },
  { id: "INV-2025-0011", date: "2025-11-14", amount: "$60.00",  status: "failed",  method: "Visa •• 0001" },
];

const STATUS_BADGE: Record<string, string> = {
  paid:     "demo-badge demo-badge--success",
  refunded: "demo-badge demo-badge--warn",
  failed:   "demo-badge demo-badge--danger",
};

export function InvoicesPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Billing"
        title="Invoices"
        sub="Download receipts or tax invoices for the past 24 months."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((i) => (
                  <tr key={i.id}>
                    <td className="is-mono">{i.id}</td>
                    <td>{i.date}</td>
                    <td>{i.method}</td>
                    <td><span className={STATUS_BADGE[i.status]}>{i.status}</span></td>
                    <td className="is-num">{i.amount}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="demo-btn demo-btn--ghost" style={{ padding: "0 10px", height: 28, fontSize: "var(--fs-10)" }}>
                        <Download size={12} strokeWidth={1.8} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
