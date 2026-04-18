import { useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Range {
  id: string;
  cidr: string;
  label: string;
  addedBy: string;
  addedOn: string;
  expiresNote?: string;
}

const RANGES: Range[] = [
  { id: "r1", cidr: "10.0.0.0/8",      label: "Office VPN",                addedBy: "Ada Lovelace", addedOn: "2025-11-02" },
  { id: "r2", cidr: "192.168.1.0/24",  label: "HQ wifi",                   addedBy: "Alan Turing",  addedOn: "2025-12-10" },
  { id: "r3", cidr: "203.0.113.0/28",  label: "External contractor",       addedBy: "Ada Lovelace", addedOn: "2026-03-01", expiresNote: "Expires in 7 days" },
];

export function IpAllowlistPage() {
  const [enabled, setEnabled] = useState(true);
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Security"
        title="IP allowlist"
        sub="Restrict workspace access to specific network ranges. Members outside these ranges will be blocked even with valid credentials."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Enforce IP allowlist</div>
              <div className="demo-block__sub">When enabled, only requests from listed ranges will be accepted.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <label className="demo-toggle" aria-label="Enforce IP allowlist">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span className="demo-toggle__track" />
            </label>
          </header>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Allowed ranges</div>
              <div className="demo-block__sub">IPv4 or IPv6 CIDR notation. Single hosts use /32 or /128.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 8, alignItems: "end" }}>
              <div className="demo-field">
                <label className="demo-field__label">CIDR range</label>
                <input
                  className="demo-input"
                  placeholder="203.0.113.0/24"
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)" }}
                />
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Label</label>
                <input
                  className="demo-input"
                  placeholder="e.g. Office VPN"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <button className="demo-btn demo-btn--primary" disabled={!cidr || !label}>
                <Plus size={13} strokeWidth={1.8} /> Add range
              </button>
            </div>
          </div>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Range</th>
                  <th>Label</th>
                  <th>Added by</th>
                  <th>Added on</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {RANGES.map((r) => (
                  <tr key={r.id}>
                    <td className="is-mono">{r.cidr}</td>
                    <td>{r.label}</td>
                    <td style={{ color: "var(--fg-muted)" }}>{r.addedBy}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{r.addedOn}</td>
                    <td>
                      {r.expiresNote ? (
                        <span className="demo-badge demo-badge--warn">{r.expiresNote}</span>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="demo-btn demo-btn--ghost"
                        style={{ padding: 0, width: 28, height: 28 }}
                        aria-label={`Remove range ${r.cidr}`}
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="demo-block" style={{ borderColor: "var(--border-warn-subtle, var(--border))" }}>
          <div className="demo-block__body" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg)" }}>
                You may lose access after saving
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 4 }}>
                Your current IP <span style={{ fontFamily: "var(--font-mono)" }}>121.210.53.12</span> is not covered by any allowed range. Add it, or sign in from an allowed network before saving.
              </div>
            </div>
          </div>
        </div>

        <div className="demo-sectionbar">
          <span className="demo-sectionbar__spacer" />
          <button className="demo-btn demo-btn--ghost">Cancel</button>
          <button className="demo-btn demo-btn--primary">Save changes</button>
        </div>
      </div>
    </div>
  );
}
